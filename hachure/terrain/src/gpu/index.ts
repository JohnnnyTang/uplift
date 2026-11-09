import { WebGPURenderer, StorageBufferAttribute, type ComputeNode, type Node } from "three/webgpu";
import { Fn, storage, instanceIndex, uint, float, vec4, max, wgslFn } from "three/tsl";
import { type TerrainConfig, type TerrainState, resolveTerrainConfig } from "../contract/index";
import { splitElevation, validateWaterStage } from "./data";
import { rainWgsl, pipeWgsl, limitWgsl, gatherWgsl, diagnosticWgsl, guardWgsl, changeWgsl } from "./shaders";

function vectorWgslFn(code: string) {
  const fn = wgslFn(code);
  // Three r187 types do not infer the declared WGSL return type.
  return (args: Record<string, Node | number>) => fn(args) as Node<"vec4">;
}

export interface WaterSnapshot {
  readonly step: number;
  /** Changes with each completed mutation, including elevation-change diagnostics. */
  readonly version: number;
  readonly gridSize: number;
  readonly metresPerCell: number;
  readonly waterM: Float32Array;
  /** West, east, north, south, interleaved per cell, in m³/s. */
  readonly fluxM3PerS: Float32Array;
  readonly velocityXMPerS: Float32Array;
  readonly velocityYMPerS: Float32Array;
  /** Float64 reconstruction is diagnostic; ongoing GPU pressure differences use split lanes. */
  readonly groundM: Float64Array;
  readonly elevationChangeM: Float32Array;
  readonly waveCourant: number;
  readonly transportCourant: number;
  readonly failure: "wave-guard" | "non-finite-or-negative" | null;
}
export interface GpuWaterOptions {
  /** Fixed extra depth input, m/s per cell (e.g. a spring divided by cell area). */
  readonly sourceRateMPerS?: Float32Array;
  /** Fixed outlet receiving elevation, metres. Defaults to initial outlet ground. */
  readonly outletBaseLevelM?: number;
}

/**
 * Managed WebGPU water stage. Deliberately not TerrainSolver: erosion/transport/budgets belong to 4A.
 * Configuration is immutable per run; every kernel reads old buffers and has one writer per output.
 */
export class GpuWaterSolver {
  readonly backend = "webgpu-water";
  private readonly attributes: StorageBufferAttribute[] = [];
  private readonly initialKernels: ComputeNode[];
  private readonly device: GPUDevice;
  private gpuError: Error | null = null;
  private readonly onGpuError = (event: GPUUncapturedErrorEvent) => {
    this.gpuError = new Error(event.error.message);
  };
  private readonly kernels: ComputeNode[][];
  private readonly changes: StorageBufferAttribute;
  private readonly delta: StorageBufferAttribute;
  private readonly changeKernel: ComputeNode;
  private readonly water: StorageBufferAttribute[];
  private readonly flux: StorageBufferAttribute[];
  private readonly status: StorageBufferAttribute;
  private readonly base: Float32Array;
  private readonly datumM: number;
  private parity = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private readInFlight: Promise<WaterSnapshot> | null = null;
  private disposed = false;
  private failure: WaterSnapshot["failure"] = null;
  private steps = 0;
  private version = 0;
  private lastSampleMs = -Infinity;

  constructor(
    private readonly renderer: WebGPURenderer,
    readonly config: TerrainConfig,
    state: TerrainState,
    options: GpuWaterOptions = {},
  ) {
    config = resolveTerrainConfig(config);
    this.config = config;
    validateWaterStage(config, state);
    const split = splitElevation(state, options.sourceRateMPerS);
    const outlet = state.outlet.y * config.gridSize + state.outlet.x;
    const outletBase =
      (options.outletBaseLevelM ?? state.layers.bedrockM[outlet] + state.layers.sedimentM[outlet]) -
      split.datumM;
    if (!Number.isFinite(outletBase)) throw new RangeError("Outlet base level must be finite");
    this.device = (renderer.backend as unknown as { device: GPUDevice }).device;
    this.device.addEventListener("uncapturederror", this.onGpuError);
    void this.device.lost.then((info) => {
      if (!this.disposed) this.gpuError = new Error(`WebGPU device lost: ${info.message}`);
    });
    const { gridSize: n, metresPerCell: l, dtSimSeconds: dt, gravityMPerS2: g } = config;
    const cells = n * n;
    this.base = split.base;
    this.datumM = split.datumM;
    const allocate = (data: Float32Array | number) => {
      const attr = new StorageBufferAttribute(
        typeof data === "number" ? new Float32Array(data * 4) : data,
        4,
      );
      this.attributes.push(attr);
      return attr;
    };
    const buffer = (attr: StorageBufferAttribute) => storage(attr, "vec4", attr.count);
    const base = buffer(allocate(this.base));
    this.changes = allocate(cells);
    const changes = buffer(this.changes);
    this.delta = allocate(cells);
    const delta = buffer(this.delta);
    const initialWater = new Float32Array(cells * 4),
      initialFlux = new Float32Array(cells * 4);
    const layers = state.layers;
    for (let i = 0; i < cells; i++) {
      initialWater.set([layers.waterM[i], layers.velocityXMPerS[i], layers.velocityYMPerS[i], 0], i * 4);
      initialFlux.set(
        [
          layers.fluxWestM3PerS[i],
          layers.fluxEastM3PerS[i],
          layers.fluxNorthM3PerS[i],
          layers.fluxSouthM3PerS[i],
        ],
        i * 4,
      );
    }
    this.water = [allocate(initialWater), allocate(cells)];
    this.flux = [allocate(initialFlux), allocate(cells)];
    const rain = buffer(allocate(cells)),
      candidateFlux = buffer(allocate(cells)),
      limits = buffer(allocate(cells));
    const candidateWater = buffer(allocate(cells));
    const reductions = [buffer(allocate(cells)), buffer(allocate(cells))];
    this.status = allocate(1);
    const status = buffer(this.status);
    const initialWaterBuffer = buffer(this.water[0]),
      copiedWater = buffer(this.water[1]);
    const initialFluxBuffer = buffer(this.flux[0]),
      copiedFlux = buffer(this.flux[1]);
    this.initialKernels = [
      Fn(() => {
        const i = instanceIndex;
        copiedWater.element(i).assign(initialWaterBuffer.element(i));
        copiedFlux.element(i).assign(initialFluxBuffer.element(i));
        changes.element(i).assign(vec4(0));
      })().compute(cells, [64]),
      Fn(() => {
        status.element(0).assign(vec4(0));
      })().compute(1, [1]),
    ];
    renderer.compute(this.initialKernels);
    const face = state.outlet.y === n - 1 ? 3 : state.outlet.x === n - 1 ? 1 : state.outlet.y === 0 ? 2 : 0;

    const rainFn = wgslFn(rainWgsl),
      pipeFn = vectorWgslFn(pipeWgsl),
      limitFn = vectorWgslFn(limitWgsl);
    const gatherFn = vectorWgslFn(gatherWgsl),
      diagnosticFn = wgslFn(diagnosticWgsl),
      guardFn = wgslFn(guardWgsl);
    const changeFn = wgslFn(changeWgsl);
    this.changeKernel = Fn(() => {
      const i = instanceIndex;
      changes.element(i).assign(changeFn({ old: changes.element(i), delta: delta.element(i).x }));
    })().compute(cells, [64]);
    const reductionKernels: ComputeNode[] = [];
    let reductionParity = 0;
    for (let count = cells; count > 1; count = Math.ceil(count / 2)) {
      const source = reductions[reductionParity],
        dest = reductions[1 - reductionParity];
      reductionKernels.push(
        Fn(() => {
          const i = instanceIndex,
            first = i.mul(2),
            second = first.add(1);
          const a = source.element(first),
            b = source.element(second.lessThan(count).select(second, first));
          dest.element(i).assign(max(a, b));
        })().compute(Math.ceil(count / 2), [64]),
      );
      reductionParity = 1 - reductionParity;
    }
    const finalReduction = reductions[reductionParity];
    const guardKernel = Fn(() => {
      status.element(0).assign(guardFn({ old: status.element(0), candidate: finalReduction.element(0) }));
    })().compute(1, [1]);
    this.kernels = [0, 1].map((parity) => {
      const oldWater = buffer(this.water[parity]),
        nextWater = buffer(this.water[1 - parity]);
      const oldFlux = buffer(this.flux[parity]),
        nextFlux = buffer(this.flux[1 - parity]);
      const rainKernel = Fn(() => {
        const i = instanceIndex;
        rain.element(i).assign(
          rainFn({
            a: oldWater.element(i),
            base: base.element(i),
            change: changes.element(i),
            dt: float(dt),
            rain: float(config.rainMmPerHr),
          }),
        );
      })().compute(cells, [64]);
      const fluxKernel = Fn(() => {
        const i = instanceIndex,
          x = i.mod(uint(n)),
          y = i.div(uint(n));
        const w = x.greaterThan(0).select(i.sub(1), i),
          e = x.lessThan(n - 1).select(i.add(1), i);
        const north = y.greaterThan(0).select(i.sub(n), i),
          south = y.lessThan(n - 1).select(i.add(n), i);
        const q = vec4(
          pipeFn({
            c: rain.element(i),
            w: rain.element(w),
            e: rain.element(e),
            n: rain.element(north),
            s: rain.element(south),
            old: oldFlux.element(i),
            i,
            size: uint(n),
            outlet: uint(outlet),
            face: uint(face),
            base: float(outletBase),
            dt: float(dt),
            l: float(l),
            area: float(config.pipeAreaM2),
            g: float(g),
            rough: float(config.manningNSPerMOneThird),
          }),
        ).toVar();
        const limited = vec4(limitFn({ q, h: rain.element(i).x, dt: float(dt), l: float(l) })).toVar();
        candidateFlux.element(i).assign(q.mul(limited.x));
        limits.element(i).assign(limited);
      })().compute(cells, [64]);
      const gatherKernel = Fn(() => {
        const i = instanceIndex,
          x = i.mod(uint(n)),
          y = i.div(uint(n));
        const w = x.greaterThan(0).select(i.sub(1), i),
          e = x.lessThan(n - 1).select(i.add(1), i);
        const north = y.greaterThan(0).select(i.sub(n), i),
          south = y.lessThan(n - 1).select(i.add(n), i);
        const a = vec4(
          gatherFn({
            c: rain.element(i),
            w: rain.element(w),
            e: rain.element(e),
            n: rain.element(north),
            s: rain.element(south),
            q: candidateFlux.element(i),
            qw: candidateFlux.element(w),
            qe: candidateFlux.element(e),
            qn: candidateFlux.element(north),
            qs: candidateFlux.element(south),
            k: limits.element(i).x,
            i,
            size: uint(n),
            dt: float(dt),
            l: float(l),
            g: float(g),
          }),
        ).toVar();
        candidateWater.element(i).assign(a);
        reductions[0]
          .element(i)
          .assign(diagnosticFn({ a, q: candidateFlux.element(i), transport: limits.element(i).y }));
      })().compute(cells, [64]);
      const commitKernel = Fn(() => {
        const i = instanceIndex,
          accepted = status.element(0).y.equal(0);
        nextWater.element(i).assign(accepted.select(candidateWater.element(i), oldWater.element(i)));
        nextFlux.element(i).assign(accepted.select(candidateFlux.element(i), oldFlux.element(i)));
      })().compute(cells, [64]);
      return [rainKernel, fluxKernel, gatherKernel, ...reductionKernels, guardKernel, commitKernel];
    });
  }
  get stepCount() {
    return this.steps;
  }
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error("GPU water solver is disposed"));
    const result = this.chain.then(action);
    this.chain = result.catch(() => undefined);
    return result;
  }
  /** Ordered fixed steps, one small guard read per batch. No full-field read on the frame loop. */
  step(count = 1): Promise<void> {
    if (!Number.isInteger(count) || count < 0 || count > 65536)
      return Promise.reject(new RangeError("Batch size must be an integer in [0, 65536]"));
    return this.enqueue(async () => {
      if (this.failure) throw new Error(`GPU water halted: ${this.failure}`);
      if (this.steps + count >= 2 ** 24)
        throw new RangeError("Restart before the exact GPU step counter is exhausted");
      for (let i = 0; i < count; i++) {
        this.renderer.compute(this.kernels[this.parity]);
        this.parity = 1 - this.parity;
      }
      if (!count) return;
      const status = new Float32Array(await this.renderer.getArrayBufferAsync(this.status));
      if (this.gpuError) throw this.gpuError;
      this.steps = status[2];
      this.version++;
      this.failure = status[1] === 1 ? "wave-guard" : status[1] === 2 ? "non-finite-or-negative" : null;
      if (this.failure)
        throw new Error(`GPU water halted before committing step ${this.steps + 1}: ${this.failure}`);
    });
  }
  /** Diagnostic/4A primitive: add bedrock increments in a separate compensated GPU lane. */
  addElevationChange(deltaM: Float32Array, repetitions = 1): Promise<void> {
    if (
      deltaM.length !== this.config.gridSize ** 2 ||
      !Array.from(deltaM).every(Number.isFinite) ||
      !Number.isInteger(repetitions) ||
      repetitions < 1 ||
      repetitions > 65536
    )
      return Promise.reject(
        new RangeError("Elevation changes need finite grid-sized increments and bounded repetitions"),
      );
    const copy = deltaM.slice();
    return this.enqueue(async () => {
      if (this.failure) throw new Error(`GPU water halted: ${this.failure}`);
      const array = this.delta.array as Float32Array;
      for (let i = 0; i < copy.length; i++) array[i * 4] = copy[i];
      this.delta.needsUpdate = true;
      for (let i = 0; i < repetitions; i++) this.renderer.compute(this.changeKernel);
      // Synchronise only this explicit diagnostic operation; future erosion writes the resident lane.
      await this.renderer.getArrayBufferAsync(this.changes, null, 0, 16);
      if (this.gpuError) throw this.gpuError;
      this.version++;
    });
  }
  /** Atomic diagnostic snapshot. Calls coalesce and mutations wait until all fields have been copied. */
  snapshot(): Promise<WaterSnapshot> {
    if (this.readInFlight) return this.readInFlight;
    this.readInFlight = this.enqueue(async () => {
      const [waterBytes, fluxBytes, changeBytes, statusBytes] = await Promise.all([
        this.renderer.getArrayBufferAsync(this.water[this.parity]),
        this.renderer.getArrayBufferAsync(this.flux[this.parity]),
        this.renderer.getArrayBufferAsync(this.changes),
        this.renderer.getArrayBufferAsync(this.status),
      ]);
      if (this.gpuError) throw this.gpuError;
      const water = new Float32Array(waterBytes),
        flux = new Float32Array(fluxBytes),
        changes = new Float32Array(changeBytes),
        status = new Float32Array(statusBytes);
      const cells = this.config.gridSize ** 2,
        waterM = new Float32Array(cells),
        u = new Float32Array(cells),
        v = new Float32Array(cells),
        groundM = new Float64Array(cells),
        elevationChangeM = new Float32Array(cells);
      for (let i = 0; i < cells; i++) {
        waterM[i] = water[i * 4];
        u[i] = water[i * 4 + 1];
        v[i] = water[i * 4 + 2];
        elevationChangeM[i] = changes[i * 4];
        groundM[i] = this.datumM + this.base[i * 4] + this.base[i * 4 + 1] + changes[i * 4];
      }
      return {
        step: status[2],
        version: this.version,
        gridSize: this.config.gridSize,
        metresPerCell: this.config.metresPerCell,
        waterM,
        fluxM3PerS: flux,
        velocityXMPerS: u,
        velocityYMPerS: v,
        groundM,
        elevationChangeM,
        waveCourant: status[0],
        transportCourant: status[3],
        failure: this.failure,
      };
    }).finally(() => {
      this.readInFlight = null;
    });
    return this.readInFlight;
  }
  /** View/probe sampling: at most 2 Hz and one atomic read in flight; skipped samples do not queue. */
  sample(nowMs: number): Promise<WaterSnapshot> | null {
    if (!Number.isFinite(nowMs)) throw new RangeError("Sampling clock must be finite");
    if (this.readInFlight || nowMs - this.lastSampleMs < 500) return null;
    this.lastSampleMs = nowMs;
    return this.snapshot();
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    await this.chain;
    for (const kernel of new Set([...this.kernels.flat(), ...this.initialKernels, this.changeKernel]))
      kernel.dispose();
    this.attributes.forEach((attribute) => attribute.dispose());
    this.device.removeEventListener("uncapturederror", this.onGpuError);
    this.renderer.dispose();
  }
}

export async function createGpuWaterSolver(
  config: TerrainConfig,
  state: TerrainState,
  options: GpuWaterOptions = {},
): Promise<GpuWaterSolver> {
  validateWaterStage(config, state);
  const renderer = new WebGPURenderer();
  try {
    await renderer.init();
    if (!(renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend)
      throw new Error("GPU water requires WebGPU; use CPU fallback instead of WebGL2 compute");
    return new GpuWaterSolver(renderer, resolveTerrainConfig(config), state, options);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}
