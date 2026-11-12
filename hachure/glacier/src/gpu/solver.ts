/**
 * WebGPU glacier solver (session 5I): the frozen 5G/5G2 model as compute kernels (`./shaders.ts`).
 *
 * Same stepping, state, probe, budget and diagnostic interface as the CPU reference, made asynchronous
 * (`AsyncGlacierSolver`), so the runtime can select a backend. Raw WebGPU (no Three.js): the glacier package
 * stays renderer-free and the solver can run in a worker. Patterns follow the water solver (D-S1-W3-3C,
 * D-S1-W4-4A): explicit capability rejection before any work, serialized operations, one small status read
 * per batch, full reads only on request, latched failure, no float atomics, split precision lanes.
 *
 * Readbacks reconstruct Float64 fields from the two float32 lanes; probes, sections and the hash use the
 * same pure contract functions as the CPU. Results are not bitwise equal to the CPU or across devices
 * (docs/review/glacial/gpu/tolerances.md); same-device replay is bitwise identical.
 */
import { type GlacierConfig, resolveGlacierConfig } from "../contract/config";
import { hashGlacierState } from "../contract/hash";
import {
  type GlacierProbes,
  type SectionMeasure,
  type SectionOptions,
  measureSection,
  probesFromFields,
} from "../contract/probes";
import type { GlacierDiagnostics, GlacierSnapshot, IceBudget } from "../contract/state";
import { FRAME_CELLS, type CpuGlacierInit } from "../cpu/solver";
import { createVValleyBed } from "../presets/v-valley";
import type { AsyncGlacierSolver } from "./async";
import { GlacierGpuError } from "./errors";
import {
  BUFFERS,
  type BufferName,
  ENTRY_POINTS,
  type KernelName,
  WORKGROUP_SIZE,
  glacierWgsl,
} from "./shaders";

export interface GpuGlacierOptions {
  /** WebGPU entry point; defaults to `navigator.gpu`. Injected by tests. */
  readonly gpu?: GPU | undefined;
  readonly powerPreference?: GPUPowerPreference;
  /** Fixed steps encoded per command buffer (unit: steps). Scheduling only; never changes results. */
  readonly stepsPerSubmit?: number;
  /** Diagnostic fault injection for the fallback tests. Never set in product code. */
  readonly forceFault?: "invalid-shader" | "skew-erosion";
}

/** Float64 views reconstructed from one readback. */
export interface GpuGlacierFields {
  readonly step: number;
  readonly bedM: Float64Array;
  readonly initialBedM: Float64Array;
  readonly iceThicknessM: Float64Array;
  readonly shapeFactor: Float64Array;
  readonly slidingSpeedMPerYear: Float64Array;
  readonly surfaceVelocityXMPerYear: Float64Array;
  readonly surfaceVelocityYMPerYear: Float64Array;
}

interface Reading extends GpuGlacierFields {
  readonly smbM: number;
  readonly edgeM: number;
  readonly counts: GlacierDiagnostics;
}

const MAX_BATCH_STEPS = 1 << 20;

// WebGPU flag values (the spec's GPUBufferUsage / GPUShaderStage / GPUMapMode; not in TypeScript's DOM lib).
const USAGE = { MAP_READ: 0x0001, COPY_SRC: 0x0004, COPY_DST: 0x0008, STORAGE: 0x0080 } as const;
const STAGE_COMPUTE = 0x4;
const MAP_READ = 0x0001;

export interface GpuGlacierSolver extends AsyncGlacierSolver {
  readonly backend: "webgpu";
  /** Adapter identity as the browser reports it (may be blank). */
  readonly adapterInfo: Readonly<Record<string, string | boolean>>;
  /** The run's local datum: lanes hold elevation minus this (unit: metres). */
  readonly datumM: number;
  /** Latched failure, or null while the solver is healthy. */
  readonly failure: GlacierGpuError | null;
  /** Float64 reconstruction of the live fields (one atomic readback). Never changes the model. */
  fields(): Promise<GpuGlacierFields>;
  /** Diagnostic: destroys the device to exercise the device-lost path. */
  loseDeviceForTest(): void;
}

export async function createGpuGlacier(
  overrides: Partial<GlacierConfig> = {},
  init: CpuGlacierInit = {},
  options: GpuGlacierOptions = {},
): Promise<GpuGlacierSolver> {
  const config = resolveGlacierConfig(overrides);
  const gpu = "gpu" in options ? options.gpu : typeof navigator === "undefined" ? undefined : navigator.gpu;
  if (!gpu) throw new GlacierGpuError("webgpu-unavailable", "WebGPU is not available in this context");
  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: options.powerPreference ?? "high-performance" });
  } catch (error) {
    throw new GlacierGpuError("adapter-unavailable", `WebGPU adapter request failed: ${String(error)}`);
  }
  if (!adapter) throw new GlacierGpuError("adapter-unavailable", "No WebGPU adapter");
  if (adapter.limits.maxStorageBuffersPerShaderStage < BUFFERS.length)
    throw new GlacierGpuError(
      "limits-insufficient",
      `adapter allows ${adapter.limits.maxStorageBuffersPerShaderStage} storage buffers per stage; ${BUFFERS.length} needed`,
    );
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (error) {
    throw new GlacierGpuError("device-request-failed", `WebGPU device request failed: ${String(error)}`);
  }
  const solver = new GpuGlacier(config, init, device, adapter, options);
  try {
    await solver.build();
  } catch (error) {
    device.destroy();
    throw error instanceof GlacierGpuError ? error : new GlacierGpuError("pipeline-failed", String(error));
  }
  return solver;
}

class GpuGlacier implements GpuGlacierSolver {
  readonly backend = "webgpu" as const;
  readonly config: GlacierConfig;
  readonly datumM: number;
  readonly adapterInfo: Readonly<Record<string, string | boolean>>;
  private readonly nx: number;
  private readonly ny: number;
  private readonly n: number;
  private readonly dx: number;
  private readonly initialBed: Float64Array;
  private readonly initialIce: Float64Array;
  private readonly initialState: Float32Array;
  private readonly initialAux: Float32Array;
  private readonly buffers = {} as Record<BufferName, GPUBuffer>;
  private readonly pipelines = {} as Record<KernelName, GPUComputePipeline>;
  private bindGroup!: GPUBindGroup;
  private stepCount = 0;
  /** Counts scheduled steps (at enqueue time), so a read queued after an advance never reuses an older read. */
  private version = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private latched: GlacierGpuError | null = null;
  private pendingGpuError: GlacierGpuError | null = null;
  private disposed = false;
  private cache: { version: number; reading: Promise<Reading> } | null = null;
  private readonly stepsPerSubmit: number;
  private readonly workgroups: number;

  constructor(
    config: GlacierConfig,
    init: CpuGlacierInit,
    private readonly device: GPUDevice,
    adapter: GPUAdapter,
    private readonly options: GpuGlacierOptions,
  ) {
    this.config = config;
    this.nx = config.nx;
    this.ny = config.ny;
    this.n = config.nx * config.ny;
    this.dx = config.metresPerCell;
    const n = this.n;
    const bed = init.bedM ? Float64Array.from(init.bedM) : createVValleyBed(config);
    if (bed.length !== n)
      throw new GlacierGpuError("invalid-input", `bed has ${bed.length} cells, expected ${n}`);
    const ice = init.iceThicknessM ? Float64Array.from(init.iceThicknessM) : new Float64Array(n);
    if (ice.length !== n)
      throw new GlacierGpuError("invalid-input", `ice has ${ice.length} cells, expected ${n}`);
    let datum = Number.POSITIVE_INFINITY;
    for (let k = 0; k < n; k++) if (bed[k]! < datum) datum = bed[k]!;
    this.datumM = Number.isFinite(datum) ? datum : 0;
    // Split each Float64 value into hi + lo float32 lanes; the Float64 reconstruction is the run's start.
    this.initialState = new Float32Array(n * 4);
    this.initialBed = new Float64Array(n);
    this.initialIce = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const b = bed[k]! - this.datumM;
      const bHi = Math.fround(b);
      const bLo = Math.fround(b - bHi);
      const h = ice[k]!;
      const hHi = Math.fround(h);
      const hLo = Math.fround(h - hHi);
      this.initialState.set([bHi, bLo, hHi, hLo], k * 4);
      this.initialBed[k] = this.datumM + (bHi + bLo);
      this.initialIce[k] = hHi + hLo;
    }
    // Snowline balance on the starting bed is fixed for the run: computed in Float64 as the CPU does, then
    // rounded once. Zero in the border frame.
    this.initialAux = new Float32Array(n * 4);
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        const frame = Math.min(i, j, this.nx - 1 - i, this.ny - 1 - j) < FRAME_CELLS;
        const balance = frame
          ? 0
          : Math.min(
              config.massBalanceGradientPerYear * (bed[k]! - config.snowlineAltitudeM),
              config.maxAccumulationMPerYear,
            ) * config.dtYears;
        this.initialAux[k * 4 + 3] = balance;
      }
    }
    const info = adapter.info as GPUAdapterInfo | undefined;
    this.adapterInfo = Object.freeze({
      vendor: info?.vendor ?? "",
      architecture: info?.architecture ?? "",
      device: info?.device ?? "",
      description: info?.description ?? "",
      isFallbackAdapter: (info as { isFallbackAdapter?: boolean } | undefined)?.isFallbackAdapter ?? false,
    });
    this.stepsPerSubmit = Math.max(1, Math.floor(options.stepsPerSubmit ?? 200));
    this.workgroups = Math.ceil(n / WORKGROUP_SIZE);
    device.addEventListener("uncapturederror", (event) => {
      this.pendingGpuError ??= new GlacierGpuError(
        "validation-error",
        `WebGPU error: ${(event as GPUUncapturedErrorEvent).error.message}`,
      );
    });
    void device.lost.then((info) => {
      if (!this.disposed)
        this.pendingGpuError ??= new GlacierGpuError(
          "device-lost",
          `WebGPU device lost: ${info.message || info.reason}`,
        );
    });
  }

  async build(): Promise<void> {
    const device = this.device;
    device.pushErrorScope("validation");
    const module = device.createShaderModule({
      code: glacierWgsl(this.config, this.datumM, {
        invalid: this.options.forceFault === "invalid-shader",
        skewErosion: this.options.forceFault === "skew-erosion",
      }),
    });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((msg) => msg.type === "error");
    if (errors.length) {
      await device.popErrorScope();
      throw new GlacierGpuError(
        "pipeline-failed",
        `WGSL compilation failed: ${errors.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`,
      );
    }
    const layout = device.createBindGroupLayout({
      entries: BUFFERS.map((_, binding) => ({
        binding,
        visibility: STAGE_COMPUTE,
        buffer: { type: "storage" as const },
      })),
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const sizes: Record<BufferName, number> = {
      state: this.n * 16,
      rates: this.n * 16,
      flux: this.n * 16,
      aux: this.n * 16,
      ledger: this.n * 16,
      counts: this.n * 16,
      status: 16,
    };
    for (const name of BUFFERS) {
      this.buffers[name] = device.createBuffer({
        label: `glacier-${name}`,
        size: sizes[name],
        usage: USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST,
      });
    }
    device.queue.writeBuffer(this.buffers.state, 0, this.initialState);
    device.queue.writeBuffer(this.buffers.aux, 0, this.initialAux);
    const flux = new Float32Array(this.n * 4);
    for (let k = 0; k < this.n; k++) {
      flux[k * 4 + 2] = 1; // f = 1 until the first shape-factor pass (CPU: fill(1))
      flux[k * 4 + 3] = 1;
    }
    device.queue.writeBuffer(this.buffers.flux, 0, flux);
    this.bindGroup = device.createBindGroup({
      layout,
      entries: BUFFERS.map((name, binding) => ({ binding, resource: { buffer: this.buffers[name] } })),
    });
    try {
      const entries = Object.entries(ENTRY_POINTS) as [KernelName, string][];
      const built = await Promise.all(
        entries.map(([, entryPoint]) =>
          device.createComputePipelineAsync({ layout: pipelineLayout, compute: { module, entryPoint } }),
        ),
      );
      entries.forEach(([name], idx) => (this.pipelines[name] = built[idx]!));
    } catch (error) {
      await device.popErrorScope();
      throw new GlacierGpuError("pipeline-failed", `WebGPU pipeline creation failed: ${String(error)}`);
    }
    const scoped = await device.popErrorScope();
    if (scoped) throw new GlacierGpuError("pipeline-failed", `WebGPU validation failed: ${scoped.message}`);
    // Confirm the uploads landed before the solver is handed out.
    await device.queue.onSubmittedWorkDone();
    if (this.pendingGpuError) throw this.pendingGpuError;
  }

  get step(): number {
    return this.stepCount;
  }

  get modelYears(): number {
    return this.stepCount * this.config.dtYears;
  }

  get failure(): GlacierGpuError | null {
    return this.latched;
  }

  /**
   * Serializes every operation. A latched failure rejects all later steps; reads stay possible after a
   * non-finite halt (as the CPU's state stays readable after its guard throws), not after a device failure.
   */
  private enqueue<T>(action: () => Promise<T>, isStep = false): Promise<T> {
    if (this.disposed)
      return Promise.reject(new GlacierGpuError("disposed", "GPU glacier solver is disposed"));
    const result = this.chain.then(() => {
      if (this.latched && (isStep || this.latched.reason !== "non-finite")) throw this.latched;
      return action();
    });
    this.chain = result.catch(() => undefined);
    return result;
  }

  private latch(error: GlacierGpuError): never {
    this.latched ??= error;
    throw this.latched;
  }

  private checkGpuError(): void {
    if (this.pendingGpuError) this.latch(this.pendingGpuError);
  }

  private dispatch(pass: GPUComputePassEncoder, kernel: KernelName): void {
    pass.setPipeline(this.pipelines[kernel]);
    pass.dispatchWorkgroups(this.workgroups);
  }

  /** Encodes one fixed step whose step-start count is `s` (same pass order as CpuGlacier.stepOnce). */
  private encodeStep(pass: GPUComputePassEncoder, s: number): void {
    const c = this.config;
    if (c.iceEnabled) {
      if (c.lateralDragEnabled && s % c.shapeFactorIntervalSteps === 0) {
        this.dispatch(pass, "shapeRaw");
        this.dispatch(pass, "shapeSmooth");
      }
      this.dispatch(pass, "rates");
      this.dispatch(pass, "flux");
      this.dispatch(pass, "ratio");
      this.dispatch(pass, "transport");
    }
    if (Math.min(0.2, c.wallFailureRatePerYear * c.dtYears) > 0) this.dispatch(pass, "walls");
    this.dispatch(pass, "commit");
  }

  advance(steps: number): Promise<void> {
    if (!Number.isInteger(steps) || steps < 0 || steps > MAX_BATCH_STEPS)
      return Promise.reject(new RangeError(`steps must be an integer in [0, ${MAX_BATCH_STEPS}]`));
    if (steps > 0) this.version++;
    return this.enqueue(async () => {
      this.checkGpuError();
      if (steps === 0) return;
      let s = this.stepCount;
      const end = s + steps;
      while (s < end) {
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, this.bindGroup);
        const chunkEnd = Math.min(end, s + this.stepsPerSubmit);
        for (; s < chunkEnd; s++) this.encodeStep(pass, s);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
      }
      const status = new Uint32Array(await this.read("status", 16));
      this.checkGpuError();
      this.stepCount = end;

      if (status[0] !== 0)
        this.latch(
          new GlacierGpuError(
            "non-finite",
            `glacier state became non-finite by step ${this.stepCount} (GPU)`,
          ),
        );
    }, true);
  }

  advanceYears(years: number): Promise<void> {
    return this.advance(Math.round(years / this.config.dtYears));
  }

  private async read(name: BufferName, size: number): Promise<ArrayBuffer> {
    const staging = this.device.createBuffer({ size, usage: USAGE.MAP_READ | USAGE.COPY_DST });
    try {
      const encoder = this.device.createCommandEncoder();
      encoder.copyBufferToBuffer(this.buffers[name], 0, staging, 0, size);
      this.device.queue.submit([encoder.finish()]);
      try {
        await staging.mapAsync(MAP_READ);
      } catch (error) {
        this.checkGpuError();
        this.latch(new GlacierGpuError("device-lost", `WebGPU readback failed: ${String(error)}`));
      }
      return staging.getMappedRange().slice(0);
    } finally {
      staging.destroy();
    }
  }

  /** One atomic read of every field at the current step: velocities are recomputed first (view-only). */
  private reading(): Promise<Reading> {
    if (this.cache && this.cache.version === this.version) return this.cache.reading;
    const reading = this.enqueue(async () => {
      this.checkGpuError();
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setBindGroup(0, this.bindGroup);
      this.dispatch(pass, "rates");
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      const bytes = this.n * 16;
      const [state, rates, flux, aux, ledger, counts] = await Promise.all([
        this.read("state", bytes),
        this.read("rates", bytes),
        this.read("flux", bytes),
        this.read("aux", bytes),
        this.read("ledger", bytes),
        this.read("counts", bytes),
      ]);
      this.checkGpuError();
      return this.reconstruct(
        new Float32Array(state),
        new Float32Array(rates),
        new Float32Array(flux),
        new Float32Array(aux),
        new Float32Array(ledger),
        new Uint32Array(counts),
      );
    });
    this.cache = { version: this.version, reading };
    reading.catch(() => {
      if (this.cache?.reading === reading) this.cache = null;
    });
    return reading;
  }

  private reconstruct(
    state: Float32Array,
    rates: Float32Array,
    flux: Float32Array,
    aux: Float32Array,
    ledger: Float32Array,
    counts: Uint32Array,
  ): Reading {
    const n = this.n;
    const bedM = new Float64Array(n);
    const iceThicknessM = new Float64Array(n);
    const shapeFactor = new Float64Array(n);
    const slidingSpeedMPerYear = new Float64Array(n);
    const vx = new Float64Array(n);
    const vy = new Float64Array(n);
    let smb = 0;
    let edge = 0;
    let capped = 0;
    let iceEdges = 0;
    let limited = 0;
    for (let k = 0; k < n; k++) {
      const o = k * 4;
      bedM[k] = this.datumM + (state[o]! + state[o + 1]!);
      iceThicknessM[k] = state[o + 2]! + state[o + 3]!;
      slidingSpeedMPerYear[k] = rates[o + 2]!;
      shapeFactor[k] = flux[o + 2]!;
      vx[k] = aux[o]!;
      vy[k] = aux[o + 1]!;
      smb += ledger[o]! + ledger[o + 1]!;
      edge += ledger[o + 2]! + ledger[o + 3]!;
      capped += counts[o]!;
      iceEdges += counts[o + 1]!;
      limited += counts[o + 2]!;
    }
    return {
      step: this.stepCount,
      bedM,
      initialBedM: this.initialBed,
      iceThicknessM,
      shapeFactor,
      slidingSpeedMPerYear,
      surfaceVelocityXMPerYear: vx,
      surfaceVelocityYMPerYear: vy,
      smbM: smb,
      edgeM: edge,
      counts: { cappedEdgeSteps: capped, iceEdgeSteps: iceEdges, limitedCellSteps: limited },
    };
  }

  async fields(): Promise<GpuGlacierFields> {
    return this.reading();
  }

  async snapshot(): Promise<GlacierSnapshot> {
    const r = await this.reading();
    return {
      nx: this.nx,
      ny: this.ny,
      metresPerCell: this.dx,
      rockId: this.config.rockId,
      step: r.step,
      modelYears: r.step * this.config.dtYears,
      bedM: Float32Array.from(r.bedM),
      iceThicknessM: Float32Array.from(r.iceThicknessM),
      surfaceVelocityXMPerYear: Float32Array.from(r.surfaceVelocityXMPerYear),
      surfaceVelocityYMPerYear: Float32Array.from(r.surfaceVelocityYMPerYear),
    };
  }

  async probes(): Promise<GlacierProbes> {
    const r = await this.reading();
    let maxUb = 0;
    for (let k = 0; k < this.n; k++)
      if (r.slidingSpeedMPerYear[k]! > maxUb) maxUb = r.slidingSpeedMPerYear[k]!;
    return probesFromFields(
      { nx: this.nx, ny: this.ny, metresPerCell: this.dx },
      r,
      r.step,
      r.step * this.config.dtYears,
      this.config.minIceThicknessM,
      maxUb,
    );
  }

  async section(i: number, options?: SectionOptions): Promise<SectionMeasure> {
    const r = await this.reading();
    return measureSection(
      r.bedM,
      r.iceThicknessM,
      { nx: this.nx, ny: this.ny, metresPerCell: this.dx },
      i,
      options,
    );
  }

  async budget(): Promise<IceBudget> {
    const r = await this.reading();
    const area = this.dx * this.dx;
    let vol = 0;
    let vol0 = 0;
    for (let k = 0; k < this.n; k++) {
      vol += r.iceThicknessM[k]!;
      vol0 += this.initialIce[k]!;
    }
    const smb = r.smbM * area;
    const edge = r.edgeM * area;
    return {
      surfaceMassBalanceM3: smb,
      edgeOutflowM3: edge,
      residualM3: vol * area - (vol0 * area + smb - edge),
    };
  }

  async diagnostics(): Promise<GlacierDiagnostics> {
    return (await this.reading()).counts;
  }

  async hash(): Promise<string> {
    const r = await this.reading();
    return hashGlacierState(r.step, [r.bedM, r.iceThicknessM]);
  }

  loseDeviceForTest(): void {
    this.device.destroy();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.chain;
    for (const buffer of Object.values(this.buffers)) buffer.destroy();
    this.device.destroy();
  }
}
