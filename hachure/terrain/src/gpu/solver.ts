import {
  type BudgetCounters,
  type StateSnapshot,
  type SnapshotOptions,
  type TerrainConfig,
  type TerrainPreset,
  type TerrainSolver,
  type ToolOp,
  type ToolResult,
  type TunableConfig,
  createTerrainState,
  hashSnapshot,
  resolveTerrainConfig,
  simYearsPerStep,
  zeroBudget,
  SolverDisposedError,
  TerrainConfigError,
} from "../contract/index";
import { validateCpuSolverConfig } from "../cpu/index";
import { CpuBuffers, outletFace } from "../cpu/kernel";
import { applyCpuTool, type WaterSource } from "../cpu/tools";
import { applyBrush, isBrushOp } from "../tools/index";
import { createGpuWaterSolver, type GpuWaterSolver, type WaterSnapshot } from "./index";

type MutableBudget = { -readonly [K in keyof BudgetCounters]: number };
/** Complete managed WebGPU solver. All mutations and full snapshots are serialized. */
export class GpuTerrainSolver implements TerrainSolver {
  readonly backend = "gpu" as const;
  private chain: Promise<unknown> = Promise.resolve();
  private failure: unknown;
  private disposed = false;
  private disposal: Promise<void> | undefined;
  private cfg: TerrainConfig;
  private requestedConfig: TerrainConfig;
  private core!: GpuWaterSolver;
  private sourceBuffer!: CpuBuffers;
  private sources = new Map<string, WaterSource>();
  private offsetSteps = 0;
  private scheduledSteps = 0;
  private elapsedYears = 0;
  private offsetBudget: MutableBudget = zeroBudget();
  private outlet!: { x: number; y: number };
  private baseLevelM = 0;
  private readInFlight: Promise<StateSnapshot> | null = null;
  private lastSampleMs = -Infinity;
  private mutationSequence = 0;
  private readSequence = -1;
  private constructor(config: TerrainConfig) {
    this.cfg = config;
    this.requestedConfig = config;
  }
  static async create(config: TerrainConfig, preset: TerrainPreset): Promise<GpuTerrainSolver> {
    const solver = new GpuTerrainSolver(resolveTerrainConfig(config));
    await solver.initialize(preset);
    return solver;
  }
  get config() {
    return this.requestedConfig;
  }
  get stepCount() {
    return this.scheduledSteps;
  }
  get outletBaseLevelM() {
    return this.baseLevelM;
  }
  private queue<T>(
    action: () => Promise<T>,
    recover = false,
    mutation = true,
    latchFailure = false,
  ): Promise<T> {
    if (this.disposed) return Promise.reject(new SolverDisposedError());
    if (mutation) this.mutationSequence++;
    const result = this.chain.then(() => {
      if (this.failure && !recover) throw this.failure;
      return action();
    });
    this.chain = result.catch((error) => {
      if (latchFailure) this.failure = error;
    });
    return result;
  }
  private async initialize(preset: TerrainPreset) {
    const state = preset.create(this.cfg);
    this.outlet = { ...state.outlet };
    const n = this.cfg.gridSize,
      i = this.outlet.y * n + this.outlet.x;
    this.baseLevelM = state.layers.bedrockM[i] + state.layers.sedimentM[i];
    this.sourceBuffer = new CpuBuffers(
      n,
      this.cfg.metresPerCell,
      i,
      outletFace(n, this.outlet.x, this.outlet.y),
      this.baseLevelM,
      state.layers.hardness,
    );
    this.sources.clear();
    this.offsetBudget = zeroBudget();
    this.offsetSteps = 0;
    this.elapsedYears = 0;
    this.failure = undefined;
    this.core = await createGpuWaterSolver(this.cfg, state, {
      fullProcesses: true,
      outletBaseLevelM: this.baseLevelM,
    });
  }
  private assertLive(): void {
    if (this.disposed) throw new SolverDisposedError();
  }
  step(count = 1): Promise<void> {
    this.assertLive();
    if (!Number.isInteger(count) || count < 0 || count > 65536)
      throw new RangeError("Invalid fixed-step batch");
    this.scheduledSteps += count;
    const result = this.queue(
      async () => {
        const before = this.core.stepCount;
        try {
          await this.core.step(count);
        } catch (error) {
          this.scheduledSteps = this.offsetSteps + this.core.stepCount;
          throw error;
        } finally {
          this.elapsedYears += (this.core.stepCount - before) * simYearsPerStep(this.cfg);
        }
      },
      false,
      true,
      true,
    );
    // Contract permits fire-and-enqueue; reads surface queued errors without unhandled rejections.
    void result.catch(() => undefined);
    return result;
  }
  configure(patch: Partial<TunableConfig>): void {
    this.assertLive();
    const next = resolveTerrainConfig({ ...this.requestedConfig, ...patch });
    const issues = validateCpuSolverConfig(next);
    if (issues.length) throw new TerrainConfigError(issues);
    if (Object.keys(patch).some((k) => !(k in this.cfg) || ["gridSize", "metresPerCell", "seed"].includes(k)))
      throw new RangeError("Only tunable configuration may change");
    this.requestedConfig = next;
    void this.queue(
      async () => {
        const raw = await this.core.snapshot(),
          snapshot = this.convert(raw);
        this.offsetSteps = snapshot.step;
        this.offsetBudget = { ...snapshot.budget };
        const state = createTerrainState(next.gridSize, next.metresPerCell, this.outlet);
        for (const [name, values] of Object.entries(snapshot.layers))
          state.layers[name as keyof typeof state.layers].set(values!);
        await this.core.dispose();
        this.cfg = next;
        this.core = await createGpuWaterSolver(next, state, {
          fullProcesses: true,
          sourceRateMPerS: Float32Array.from(this.sourceBuffer.sourceRateMPerS),
          outletBaseLevelM: this.baseLevelM,
        });
        const correction = Float32Array.from(raw.bedrockM, (b, i) => b - state.layers.bedrockM[i]);
        await this.core.addElevationChange(
          correction,
          1,
          Float32Array.from(raw.sedimentM, (s, i) => s - state.layers.sedimentM[i]),
        );
      },
      false,
      true,
      true,
    ).catch(() => undefined);
  }
  private convert(raw: WaterSnapshot): StateSnapshot {
    const state = createTerrainState(this.cfg.gridSize, this.cfg.metresPerCell, this.outlet),
      l = state.layers,
      material = raw.material!,
      totals = raw.totals!,
      area = this.cfg.metresPerCell ** 2;
    l.bedrockM.set(raw.bedrockM);
    l.waterM.set(raw.waterM);
    l.velocityXMPerS.set(raw.velocityXMPerS);
    l.velocityYMPerS.set(raw.velocityYMPerS);
    for (let i = 0; i < this.cfg.gridSize ** 2; i++) {
      l.sedimentM[i] = material[i * 4];
      l.suspendedSedimentM[i] = material[i * 4 + 1];
      l.hardness[i] = material[i * 4 + 2];
      l.fluxWestM3PerS[i] = raw.fluxM3PerS[i * 4];
      l.fluxEastM3PerS[i] = raw.fluxM3PerS[i * 4 + 1];
      l.fluxNorthM3PerS[i] = raw.fluxM3PerS[i * 4 + 2];
      l.fluxSouthM3PerS[i] = raw.fluxM3PerS[i * 4 + 3];
    }
    const b = this.offsetBudget,
      a = totals[0],
      w = totals[1];
    return {
      step: this.offsetSteps + raw.step,
      simYears: this.elapsedYears,
      gridSize: this.cfg.gridSize,
      metresPerCell: this.cfg.metresPerCell,
      outlet: { ...this.outlet },
      layers: l,
      budget: {
        erodedM3: b.erodedM3 + a[0],
        depositedM3: b.depositedM3 + a[1],
        exportedSedimentM3: b.exportedSedimentM3 + a[2],
        evaporatedWaterM3: b.evaporatedWaterM3 + a[3],
        rainedWaterM3: b.rainedWaterM3 + w[0],
        sourcedWaterM3: b.sourcedWaterM3 + w[1],
        outflowedWaterM3: b.outflowedWaterM3 + w[2],
        toolNetM3: b.toolNetM3,
        suspendedM3: totals[2][1] * area,
      },
    };
  }
  snapshot(options: SnapshotOptions = {}): Promise<StateSnapshot> {
    if (this.disposed) return Promise.reject(new SolverDisposedError());
    if (!options.layers && this.readInFlight && this.readSequence === this.mutationSequence)
      return this.readInFlight;
    const sequence = this.mutationSequence;
    const result = this.queue(
      async () => {
        const snapshot = this.convert(await this.core.snapshot());
        if (!options.layers) return snapshot;
        return {
          ...snapshot,
          layers: Object.fromEntries(options.layers.map((name) => [name, snapshot.layers[name]])),
        };
      },
      true,
      false,
    );
    if (options.layers) return result;
    const read = result.finally(() => {
      if (this.readInFlight === read) this.readInFlight = null;
    });
    this.readSequence = sequence;
    this.readInFlight = read;
    return read;
  }
  sample(nowMs: number): Promise<StateSnapshot> | null {
    if (!Number.isFinite(nowMs)) throw new RangeError("Sampling clock must be finite");
    if (this.readInFlight || nowMs - this.lastSampleMs < 500) return null;
    this.lastSampleMs = nowMs;
    return this.snapshot();
  }
  async referenceLayers() {
    return this.queue(
      async () => {
        const raw = await this.core.snapshot();
        return {
          bedrockM: raw.bedrockM,
          sedimentM: raw.sedimentM,
          waterM: Float64Array.from(raw.waterM),
          suspendedSedimentM: Float64Array.from(raw.material!.filter((_, i) => i % 4 === 1)),
        };
      },
      true,
      false,
    );
  }
  applyTool(op: ToolOp): Promise<ToolResult> {
    return this.queue(async () => {
      const raw = await this.core.snapshot(),
        snapshot = this.convert(raw),
        state = createTerrainState(this.cfg.gridSize, this.cfg.metresPerCell, this.outlet);
      for (const [name, values] of Object.entries(snapshot.layers))
        state.layers[name as keyof typeof state.layers].set(values!);
      let result: ToolResult;
      if (isBrushOp(op)) {
        const oldB = state.layers.bedrockM.slice(),
          oldS = state.layers.sedimentM.slice();
        result = applyBrush(state, op, this.cfg);
        const delta = new Float32Array(oldB.length),
          looseDelta = new Float32Array(oldB.length);
        let net = 0;
        for (let i = 0; i < oldB.length; i++) {
          if (state.layers.bedrockM[i] !== oldB[i]) {
            delta[i] = state.layers.bedrockM[i] - raw.bedrockM[i];
            net += delta[i];
          }
          if (state.layers.sedimentM[i] !== oldS[i]) {
            looseDelta[i] = state.layers.sedimentM[i] - raw.sedimentM[i];
            net += looseDelta[i];
          }
          raw.material![i * 4] = state.layers.sedimentM[i];
          raw.material![i * 4 + 2] = state.layers.hardness[i];
        }
        result = { ...result, volumeChangeM3: net * this.cfg.metresPerCell ** 2 };
        await this.core.addElevationChange(delta, 1, looseDelta);
      } else result = applyCpuTool({ buf: this.sourceBuffer, config: this.cfg, sources: this.sources }, op);
      await this.core.updateMaterial(raw.material!, Float32Array.from(this.sourceBuffer.sourceRateMPerS));
      this.offsetBudget.toolNetM3 += result.volumeChangeM3;
      return result;
    });
  }
  budget(): Promise<BudgetCounters> {
    return this.snapshot().then((s) => s.budget);
  }
  hash(): Promise<string> {
    return this.snapshot().then((s) => hashSnapshot(s));
  }
  reset(preset: TerrainPreset, seed: number): void {
    this.assertLive();
    const config = resolveTerrainConfig({ ...this.requestedConfig, seed });
    this.requestedConfig = config;
    this.scheduledSteps = 0;
    void this.queue(
      async () => {
        await this.core.dispose();
        this.cfg = config;
        await this.initialize(preset);
      },
      true,
      true,
      true,
    ).catch(() => undefined);
  }
  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.disposal = this.chain.then(() => this.core.dispose());
    return this.disposal;
  }
}
export function createGpuTerrainSolver(
  config: TerrainConfig,
  preset: TerrainPreset,
): Promise<GpuTerrainSolver> {
  return GpuTerrainSolver.create(config, preset);
}
