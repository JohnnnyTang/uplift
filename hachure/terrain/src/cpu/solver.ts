/**
 * The CPU reference solver: `TerrainSolver` over the process model in `docs/science/model.md`.
 *
 * - Authoritative state is float64 inside the solver. The contract's float32 layers are a mirror, refreshed
 *   before every read (`snapshot`, `hash`), so hashes are bitwise reproducible and float32 rounding of
 *   ~100 m elevations never swallows per-step erosion of micrometres.
 * - `step()` allocates nothing and touches no DOM, so the solver can run in a Worker.
 * - `morphAccelerationFactor` maps the display clock only (`simYears`); it never enters a kernel.
 * - Config is checked against the contract limits, the admissible ranges in `docs/science/parameters.md`
 *   and the joint guards in model.md. A step that yields a non-finite value or a negative stock (or, under
 *   the `"halt"` wave-guard policy, breaks the wave guard) is rejected: the state is left as it was, the
 *   solver pauses, and `step()` throws a `TerrainStabilityError` with a diagnostic until `reset`. The
 *   caller reruns from reset at a smaller fixed step recorded in config (model.md failure policy); the
 *   solver never changes `dt` itself. Wave-guard exceedances under the default `"report"` policy are
 *   counted in `diagnostics()` (DECISIONS.md D-2A-1).
 */
import {
  type BudgetCounters,
  type LayerName,
  type SnapshotOptions,
  type StateSnapshot,
  type TerrainConfig,
  type TerrainPreset,
  type TerrainSolver,
  type TerrainState,
  type ToolOp,
  type ToolResult,
  type TunableConfig,
  type TunableConfigKey,
  SolverDisposedError,
  TERRAIN_LAYERS,
  TerrainConfigError,
  hashSnapshot,
  resolveTerrainConfig,
  simYearsPerStep,
  zeroBudget,
} from "../contract/index";
import { WAVE_SAFETY_FACTOR } from "./constants";
import { validateCpuSolverConfig } from "./guards";
import { CpuBuffers, type KernelParams, StepLedger, computeStep, outletFace } from "./kernel";
import { type WaterSource, applyCpuTool, rebuildSourceRate } from "./tools";

const TUNABLE_KEYS: ReadonlySet<string> = new Set<TunableConfigKey>([
  "rainMmPerHr",
  "gravityMPerS2",
  "pipeAreaM2",
  "dtSimSeconds",
  "morphAccelerationFactor",
  "capacityCoefficient",
  "erosionRatePerS",
  "depositionRatePerS",
  "hardnessRange",
  "talusAngleDeg",
  "thermalRatePerS",
  "evaporationFractionPerStep",
  "brushMaxHeightM",
  "brushMaxDepthM",
  "brushMaxRadiusM",
  "brushMaxSlopeDeg",
]);

/** Why the solver paused. */
export type StabilityFailure = "wave-guard" | "non-finite-or-negative";

/** Diagnostic for a rejected step. */
export interface StabilityDiagnostic {
  readonly reason: StabilityFailure;
  /** The step number that was rejected (the state stays at `step − 1`). */
  readonly step: number;
  /** Offending cell, as `(x, y)`. */
  readonly cell: { readonly x: number; readonly y: number };
  /** Human-readable detail, for the debug overlay and logs. */
  readonly message: string;
  /** Wave Courant number of the rejected step (unit: none). */
  readonly waveCourant: number;
}

/** Thrown by `step()` when a step is rejected, and by every later `step()` until `reset`. */
export class TerrainStabilityError extends Error {
  readonly diagnostic: StabilityDiagnostic;
  constructor(diagnostic: StabilityDiagnostic) {
    super(`Terrain step rejected: ${diagnostic.message}`);
    this.name = "TerrainStabilityError";
    this.diagnostic = diagnostic;
  }
}

/** Numerical health of the last accepted step, for the debug overlay and the stress tests. */
export interface StepDiagnostics {
  /** Largest wave Courant number of the last accepted step; must stay ≤ `WAVE_SAFETY_FACTOR`. */
  readonly maxWaveCourant: number;
  /** Largest donor transport number of the last accepted step; ≤ 1 by construction of the limiter. */
  readonly maxTransportCourant: number;
  /** Largest wave Courant number seen since reset. */
  readonly peakWaveCourant: number;
  /** Accepted steps since reset whose wave Courant number exceeded `WAVE_SAFETY_FACTOR` ("report" policy). */
  readonly waveGuardViolationSteps: number;
  /** The wave guard policy in force. */
  readonly waveGuard: WaveGuardPolicy;
  /** Set when the solver has paused on a rejected step. */
  readonly failure: StabilityDiagnostic | undefined;
}

/**
 * What the solver does when the state-dependent wave guard of model.md is exceeded.
 * - `"halt"`: model.md's failure policy. Reject the step, pause, throw `TerrainStabilityError`.
 * - `"report"` (default): accept the step and count it in `diagnostics()`. See DECISIONS.md D-2A-1: with
 *   model.md's frictionless pipes, any cell the donor limiter drains has `dt|u|/l = 1` for every `dt`, so
 *   "halt" stops the default configuration in its first steps and a smaller step cannot help.
 * Non-finite values and negative stocks always halt, under either policy.
 */
export type WaveGuardPolicy = "halt" | "report";

export interface CpuSolverOptions {
  readonly waveGuard?: WaveGuardPolicy;
}

/** Float64 copies of the conserved stocks, for budget tests that need more than float32 precision. */
export interface ReferenceLayers {
  readonly bedrockM: Float64Array;
  readonly sedimentM: Float64Array;
  readonly suspendedSedimentM: Float64Array;
  readonly waterM: Float64Array;
}

type MutableBudget = { -readonly [K in keyof BudgetCounters]: number };

function checkConfig(config: TerrainConfig): void {
  const issues = validateCpuSolverConfig(config);
  if (issues.length > 0) throw new TerrainConfigError(issues);
}

/** The CPU reference solver. Create it with `createCpuSolver`. */
export class CpuTerrainSolver implements TerrainSolver {
  readonly backend = "cpu" as const;
  private cfg: TerrainConfig;
  private state!: TerrainState;
  private buf!: CpuBuffers;
  private steps = 0;
  private simYearsElapsed = 0;
  private counters: MutableBudget = zeroBudget();
  private sources = new Map<string, WaterSource>();
  private readonly ledger = new StepLedger();
  private readonly params: KernelParams;
  private mirrorStale = true;
  private failure: StabilityDiagnostic | undefined;
  private peakWave = 0;
  private lastWave = 0;
  private lastTransport = 0;
  private violationSteps = 0;
  private readonly waveGuard: WaveGuardPolicy;
  private disposed = false;

  constructor(config: TerrainConfig, preset: TerrainPreset, options: CpuSolverOptions = {}) {
    checkConfig(config);
    this.cfg = config;
    this.waveGuard = options.waveGuard ?? "report";
    this.params = {
      dtSimSeconds: 0,
      rainMmPerHr: 0,
      gravityMPerS2: 0,
      pipeAreaM2: 0,
      capacityCoefficient: 0,
      erosionRatePerS: 0,
      depositionRatePerS: 0,
      talusAngleDeg: 0,
      thermalRatePerS: 0,
      evaporationFractionPerStep: 0,
    };
    this.loadParams();
    this.reset(preset, config.seed);
  }

  get config(): TerrainConfig {
    return this.cfg;
  }

  get stepCount(): number {
    return this.steps;
  }

  /** Fixed receiving water surface at the outlet: the outlet's ground elevation at reset (unit: m). */
  get outletBaseLevelM(): number {
    return this.buf.outletBaseLevelM;
  }

  private live(): void {
    if (this.disposed) throw new SolverDisposedError();
  }

  private loadParams(): void {
    const p = this.params;
    const c = this.cfg;
    p.dtSimSeconds = c.dtSimSeconds;
    p.rainMmPerHr = c.rainMmPerHr;
    p.gravityMPerS2 = c.gravityMPerS2;
    p.pipeAreaM2 = c.pipeAreaM2;
    p.capacityCoefficient = c.capacityCoefficient;
    p.erosionRatePerS = c.erosionRatePerS;
    p.depositionRatePerS = c.depositionRatePerS;
    p.talusAngleDeg = c.talusAngleDeg;
    p.thermalRatePerS = c.thermalRatePerS;
    p.evaporationFractionPerStep = c.evaporationFractionPerStep;
  }

  reset(preset: TerrainPreset, seed: number): void {
    this.live();
    const cfg = resolveTerrainConfig({ ...this.cfg, seed });
    checkConfig(cfg);
    const state = preset.create(cfg);
    if (state.gridSize !== cfg.gridSize || state.metresPerCell !== cfg.metresPerCell) {
      throw new Error(
        `preset "${preset.id}" built a ${state.gridSize}² grid of ${state.metresPerCell} m cells; config wants ${cfg.gridSize}² of ${cfg.metresPerCell} m`,
      );
    }
    const L = state.layers;
    for (let i = 0; i < L.bedrockM.length; i++) {
      const ok =
        Number.isFinite(L.bedrockM[i]!) &&
        L.sedimentM[i]! >= 0 &&
        L.waterM[i]! >= 0 &&
        L.suspendedSedimentM[i]! >= 0 &&
        L.hardness[i]! >= 0 &&
        L.hardness[i]! <= 1 &&
        Number.isFinite(L.sedimentM[i]! + L.waterM[i]! + L.suspendedSedimentM[i]!);
      if (!ok) throw new RangeError(`preset "${preset.id}" produced an invalid cell at index ${i}`);
    }
    const { gridSize: n, outlet } = state;
    const outletIndex = outlet.y * n + outlet.x;
    const baseLevel = L.bedrockM[outletIndex]! + L.sedimentM[outletIndex]!;
    const buf = new CpuBuffers(
      n,
      state.metresPerCell,
      outletIndex,
      outletFace(n, outlet.x, outlet.y),
      baseLevel,
      L.hardness,
    );
    buf.b.set(L.bedrockM);
    buf.s.set(L.sedimentM);
    buf.m.set(L.suspendedSedimentM);
    buf.h.set(L.waterM);
    buf.qW.set(L.fluxWestM3PerS);
    buf.qE.set(L.fluxEastM3PerS);
    buf.qN.set(L.fluxNorthM3PerS);
    buf.qS.set(L.fluxSouthM3PerS);
    buf.u.set(L.velocityXMPerS);
    buf.v.set(L.velocityYMPerS);

    this.cfg = cfg;
    this.loadParams();
    this.state = state;
    this.buf = buf;
    this.steps = 0;
    this.simYearsElapsed = 0;
    this.counters = zeroBudget();
    this.sources.clear();
    rebuildSourceRate(buf, this.sources);
    this.failure = undefined;
    this.peakWave = 0;
    this.violationSteps = 0;
    this.lastWave = 0;
    this.lastTransport = 0;
    this.mirrorStale = true;
  }

  configure(patch: Partial<TunableConfig>): void {
    this.live();
    for (const key of Object.keys(patch)) {
      if (!TUNABLE_KEYS.has(key)) {
        throw new TerrainConfigError([
          { field: key as keyof TerrainConfig, message: `${key} cannot change while running` },
        ]);
      }
    }
    if (patch.dtSimSeconds !== undefined && patch.dtSimSeconds !== this.cfg.dtSimSeconds && this.steps > 0) {
      throw new TerrainConfigError([
        {
          field: "dtSimSeconds",
          message: "dtSimSeconds is fixed per run (model.md); change it only right after reset, at step 0",
        },
      ]);
    }
    const next: TerrainConfig = { ...this.cfg, ...patch };
    checkConfig(next);
    this.cfg = resolveTerrainConfig(next);
    this.loadParams();
  }

  step(n = 1): void {
    this.live();
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`step(n) needs a non-negative integer, got ${n}`);
    if (this.failure) throw new TerrainStabilityError(this.failure);
    const buf = this.buf;
    const ledger = this.ledger;
    const c = this.counters;
    const yearsPerStep = simYearsPerStep(this.cfg);
    for (let k = 0; k < n; k++) {
      computeStep(buf, this.params, ledger);
      if (ledger.invalidIndex !== -1) this.reject("non-finite-or-negative", ledger.invalidIndex);
      if (ledger.maxWaveCourant > WAVE_SAFETY_FACTOR) {
        if (this.waveGuard === "halt") this.reject("wave-guard", ledger.maxWaveCourantIndex);
        this.violationSteps++;
      }
      buf.commit();
      c.rainedWaterM3 += ledger.rainedWaterM3;
      c.sourcedWaterM3 += ledger.sourcedWaterM3;
      c.evaporatedWaterM3 += ledger.evaporatedWaterM3;
      c.outflowedWaterM3 += ledger.outflowedWaterM3;
      c.erodedM3 += ledger.erodedM3;
      c.depositedM3 += ledger.depositedM3;
      c.exportedSedimentM3 += ledger.exportedSedimentM3;
      c.suspendedM3 = ledger.suspendedM3;
      this.lastWave = ledger.maxWaveCourant;
      this.lastTransport = ledger.maxTransportCourant;
      if (ledger.maxWaveCourant > this.peakWave) this.peakWave = ledger.maxWaveCourant;
      this.steps++;
      this.simYearsElapsed += yearsPerStep;
    }
    if (n > 0) this.mirrorStale = true;
  }

  private reject(reason: StabilityFailure, index: number): never {
    const n = this.buf.n;
    const cell = { x: index % n, y: Math.floor(index / n) };
    const wave = this.ledger.maxWaveCourant;
    const message =
      reason === "wave-guard"
        ? `wave guard dt[(|u|+√(gh))/l + (|v|+√(gh))/l] = ${wave.toPrecision(4)} > ${WAVE_SAFETY_FACTOR} at cell (${cell.x}, ${cell.y}), step ${this.steps + 1}; rerun from reset with a smaller dtSimSeconds`
        : `non-finite value or negative stock in ${this.ledger.invalidLayer} at cell (${cell.x}, ${cell.y}), step ${this.steps + 1}`;
    this.failure = { reason, step: this.steps + 1, cell, message, waveCourant: wave };
    this.mirrorStale = true;
    throw new TerrainStabilityError(this.failure);
  }

  /** Numerical health of the run (no copy of the state). */
  diagnostics(): StepDiagnostics {
    this.live();
    return {
      maxWaveCourant: this.lastWave,
      maxTransportCourant: this.lastTransport,
      peakWaveCourant: this.peakWave,
      waveGuardViolationSteps: this.violationSteps,
      waveGuard: this.waveGuard,
      failure: this.failure,
    };
  }

  async applyTool(op: ToolOp): Promise<ToolResult> {
    this.live();
    // Sources (spring, rain-source, remove-source) are solver state. Brush ops go to the placeholder in
    // tools.ts, which 2B's `applyBrush` replaces once both sessions are on main (DECISIONS.md D-2A-1).
    const result = applyCpuTool({ buf: this.buf, config: this.cfg, sources: this.sources }, op);
    // Every tool's actual net solid volume enters the budget ledger.
    this.counters.toolNetM3 += result.volumeChangeM3;
    this.mirrorStale = true;
    return result;
  }

  /** Writes the float64 state into the contract's float32 layers. */
  private syncMirror(): void {
    if (!this.mirrorStale) return;
    const L = this.state.layers;
    const buf = this.buf;
    L.bedrockM.set(buf.b);
    L.sedimentM.set(buf.s);
    L.waterM.set(buf.h);
    L.fluxWestM3PerS.set(buf.qW);
    L.fluxEastM3PerS.set(buf.qE);
    L.fluxNorthM3PerS.set(buf.qN);
    L.fluxSouthM3PerS.set(buf.qS);
    L.velocityXMPerS.set(buf.u);
    L.velocityYMPerS.set(buf.v);
    L.suspendedSedimentM.set(buf.m);
    this.mirrorStale = false;
  }

  async snapshot(options: SnapshotOptions = {}): Promise<StateSnapshot> {
    this.live();
    this.syncMirror();
    const names: readonly LayerName[] = options.layers ?? TERRAIN_LAYERS;
    const layers: Partial<Record<LayerName, Float32Array>> = {};
    for (const name of names) layers[name] = this.state.layers[name].slice();
    return {
      step: this.steps,
      simYears: this.simYearsElapsed,
      gridSize: this.state.gridSize,
      metresPerCell: this.state.metresPerCell,
      outlet: { ...this.state.outlet },
      layers,
      budget: { ...this.counters },
    };
  }

  /** Float64 copies of the conserved stocks (bedrock, loose and suspended sediment, water). */
  referenceLayers(): ReferenceLayers {
    this.live();
    return {
      bedrockM: this.buf.b.slice(),
      sedimentM: this.buf.s.slice(),
      suspendedSedimentM: this.buf.m.slice(),
      waterM: this.buf.h.slice(),
    };
  }

  async budget(): Promise<BudgetCounters> {
    this.live();
    return { ...this.counters };
  }

  async hash(): Promise<string> {
    this.live();
    this.syncMirror();
    return hashSnapshot({ step: this.steps, gridSize: this.state.gridSize, layers: this.state.layers });
  }

  dispose(): void {
    this.disposed = true;
  }
}

/**
 * Creates the CPU reference solver, reset to `preset` with `config.seed`. Missing config fields come from
 * the defaults. Throws `TerrainConfigError` if the config breaks a range or joint stability guard.
 */
export function createCpuSolver(
  config: Partial<TerrainConfig>,
  preset: TerrainPreset,
  options: CpuSolverOptions = {},
): CpuTerrainSolver {
  return new CpuTerrainSolver(resolveTerrainConfig(config), preset, options);
}
