/**
 * FAKE SOLVER — A TEST FIXTURE, NEVER SCIENCE.
 *
 * An analytic tilted plane with a channel that deepens down its centre line at a made-up rate. It exists
 * so that wave 2 consumers (renderer, runtime, page widgets, probes) can run before the real solver lands.
 * It implements the full `TerrainSolver` contract, budgets included, but its landforms are scripted, not
 * simulated. It must never be shown to readers as a model of anything.
 */
import {
  type BudgetCounters,
  type ClampReason,
  type LayerName,
  type PointM,
  type SnapshotOptions,
  type StateSnapshot,
  type TerrainConfig,
  type TerrainPreset,
  type TerrainSolver,
  type TerrainState,
  type ToolOp,
  type ToolResult,
  type TunableConfig,
  SolverDisposedError,
  TERRAIN_LAYERS,
  TerrainConfigError,
  cellAt,
  cellIndex,
  createTerrainState,
  hashSnapshot,
  resolveTerrainConfig,
  simYearsPerStep,
  validateTerrainConfig,
  zeroBudget,
} from "../contract/index";

/** Fixture constants. Arbitrary, chosen only to make the fake visible. Not science. */
const FAKE = {
  /** Plane gradient (m per m). */
  slope: 0.05,
  /** Elevation of the low (south) edge (m). */
  baseM: 10,
  /** Amplitude of seeded per-cell jitter (m), so different seeds give different states. */
  jitterM: 0.01,
  /** Final channel depth (m) and the e-folding time of its deepening (steps). */
  channelDepthM: 8,
  channelTauSteps: 400,
  /** Fraction of off-channel water that leaves through the outlet each step. */
  drainFractionPerStep: 0.5,
  /** Fixture flow speed in the channel (m/s). */
  channelSpeedMPerS: 1,
};

const MM_PER_HR_TO_M_PER_S = 1 / 3_600_000;

/** Deterministic integer hash of (seed, index) to [0, 1). No `Math.random()`. */
function unitHash(seed: number, index: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

/** The fixture's starting landscape: a plane tilting down to the south edge, outlet at the bottom centre. */
export const fakeTiltedPlanePreset: TerrainPreset = {
  id: "fake-tilted-plane",
  create({ gridSize, metresPerCell, seed, hardnessRange }) {
    const outlet = { x: Math.floor(gridSize / 2), y: gridSize - 1 };
    const state = createTerrainState(gridSize, metresPerCell, outlet);
    const { bedrockM, hardness } = state.layers;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const i = cellIndex(gridSize, x, y);
        const distanceFromSouthM = (gridSize - 1 - y) * metresPerCell;
        bedrockM[i] = FAKE.baseM + FAKE.slope * distanceFromSouthM + FAKE.jitterM * unitHash(seed, i);
        hardness[i] = hardnessRange[0];
      }
    }
    return state;
  },
};

interface Source {
  readonly cells: readonly number[];
  /** Water added to each listed cell per second (unit: metres per second of depth). */
  readonly depthRateMPerS: number;
}

class FakeSolver implements TerrainSolver {
  readonly backend = "fake" as const;
  private cfg: TerrainConfig;
  private state!: TerrainState;
  private steps = 0;
  private counters: { -readonly [K in keyof BudgetCounters]: number } = zeroBudget();
  private sources = new Map<string, Source>();
  /** Channel cross-profile weight per cell, in [0, 1]. */
  private shape!: Float32Array;
  private disposed = false;

  constructor(config: TerrainConfig, preset: TerrainPreset) {
    this.cfg = config;
    this.reset(preset, config.seed);
  }

  get config(): TerrainConfig {
    return this.cfg;
  }

  get stepCount(): number {
    return this.steps;
  }

  private live(): void {
    if (this.disposed) throw new SolverDisposedError();
  }

  reset(preset: TerrainPreset, seed: number): void {
    this.live();
    this.cfg = resolveTerrainConfig({ ...this.cfg, seed });
    this.state = preset.create(this.cfg);
    if (this.state.gridSize !== this.cfg.gridSize) throw new Error("preset returned the wrong grid size");
    this.steps = 0;
    this.counters = zeroBudget();
    this.sources.clear();
    const n = this.cfg.gridSize;
    const widthCells = Math.max(1, n / 16);
    this.shape = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = (x - this.state.outlet.x) / widthCells;
        this.shape[cellIndex(n, x, y)] = Math.exp(-u * u);
      }
    }
  }

  configure(patch: Partial<TunableConfig>): void {
    this.live();
    const next: TerrainConfig = { ...this.cfg, ...patch };
    const issues = validateTerrainConfig(next);
    if (issues.length > 0) throw new TerrainConfigError(issues);
    this.cfg = resolveTerrainConfig(next);
  }

  step(n = 1): void {
    this.live();
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`step(n) needs a non-negative integer, got ${n}`);
    for (let k = 0; k < n; k++) this.stepOnce();
  }

  private stepOnce(): void {
    const { gridSize: size, metresPerCell: m } = this.state;
    const { bedrockM, sedimentM, hardness, waterM, fluxSouthM3PerS, velocityYMPerS } = this.state.layers;
    const cellArea = m * m;
    const dt = this.cfg.dtSimSeconds;
    const rainDepth = this.cfg.rainMmPerHr * MM_PER_HR_TO_M_PER_S * dt;
    const evapFraction = this.cfg.evaporationFractionPerStep;
    const tau = FAKE.channelTauSteps;
    // Channel depth increment this step: d(t+1) − d(t) for d(t) = D (1 − e^(−t/τ)).
    const carveM = FAKE.channelDepthM * (Math.exp(-this.steps / tau) - Math.exp(-(this.steps + 1) / tau));

    const sourceRate = new Float32Array(size * size);
    for (const source of this.sources.values()) {
      for (const i of source.cells) sourceRate[i]! += source.depthRateMPerS;
    }

    for (let i = 0; i < size * size; i++) {
      const s = this.shape[i]!;
      // "Erosion": scripted carving, all of it exported at once. Fixture only.
      const removed = carveM * s * (1 - hardness[i]!);
      const fromSediment = Math.min(sedimentM[i]!, removed);
      sedimentM[i] = sedimentM[i]! - fromSediment;
      bedrockM[i] = bedrockM[i]! - (removed - fromSediment);
      this.counters.erodedM3 += removed * cellArea;
      this.counters.exportedSedimentM3 += removed * cellArea;

      // "Water": rain in, evaporation and a drain fraction out. Accumulates in the channel.
      const sourced = sourceRate[i]! * dt;
      let w = waterM[i]! + rainDepth + sourced;
      const evaporated = w * evapFraction;
      const drained = (w - evaporated) * FAKE.drainFractionPerStep * (1 - s);
      w = w - evaporated - drained;
      waterM[i] = w;
      this.counters.rainedWaterM3 += rainDepth * cellArea;
      this.counters.sourcedWaterM3 += sourced * cellArea;
      this.counters.evaporatedWaterM3 += evaporated * cellArea;
      this.counters.outflowedWaterM3 += drained * cellArea;

      velocityYMPerS[i] = FAKE.channelSpeedMPerS * s;
      fluxSouthM3PerS[i] = FAKE.channelSpeedMPerS * s * w * m;
    }
    this.steps++;
  }

  async applyTool(op: ToolOp): Promise<ToolResult> {
    this.live();
    switch (op.kind) {
      case "remove-source":
        return { applied: this.sources.delete(op.id), clamped: [], volumeChangeM3: 0 };
      case "spring": {
        const cell = cellAt(this.state.gridSize, this.state.metresPerCell, op.at);
        if (!cell) return { applied: false, clamped: ["off-grid"], volumeChangeM3: 0 };
        const area = this.state.metresPerCell ** 2;
        this.sources.set(op.id, {
          cells: [cellIndex(this.state.gridSize, cell.x, cell.y)],
          depthRateMPerS: op.flowM3PerS / area,
        });
        return { applied: true, clamped: [], volumeChangeM3: 0 };
      }
      default:
        return this.applyBrush(op);
    }
  }

  private applyBrush(op: Exclude<ToolOp, { kind: "spring" | "remove-source" }>): ToolResult {
    const { gridSize: n, metresPerCell: m } = this.state;
    const clamped: ClampReason[] = [];
    if (!cellAt(n, m, op.at)) return { applied: false, clamped: ["off-grid"], volumeChangeM3: 0 };
    let radiusM = op.radiusM;
    if (radiusM > this.cfg.brushMaxRadiusM) {
      radiusM = this.cfg.brushMaxRadiusM;
      clamped.push("radius");
    }
    radiusM = Math.max(radiusM, m / 2);
    const cells = this.cellsInDisk(op.at, radiusM);
    const { bedrockM, sedimentM, hardness } = this.state.layers;
    const area = m * m;

    if (op.kind === "harden") {
      const [lo, hi] = this.cfg.hardnessRange;
      const target = Math.min(hi, Math.max(lo, op.hardness));
      if (target !== op.hardness) clamped.push("hardness");
      for (const { i } of cells) hardness[i] = target;
      return { applied: cells.length > 0, clamped, volumeChangeM3: 0 };
    }

    if (op.kind === "rain-source") {
      this.sources.set(op.id, {
        cells: cells.map((c) => c.i),
        depthRateMPerS: op.rainMmPerHr * MM_PER_HR_TO_M_PER_S,
      });
      return { applied: true, clamped, volumeChangeM3: 0 };
    }

    if (op.kind === "smooth") {
      // Blend towards the 3×3 mean, then remove the mean change so total volume is conserved.
      const strength = Math.min(1, Math.max(0, op.strength));
      const delta = cells.map(({ i, x, y }) => {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            sum += bedrockM[cellIndex(n, xx, yy)]!;
            count++;
          }
        }
        return (sum / count - bedrockM[i]!) * strength;
      });
      const meanDelta = delta.reduce((a, b) => a + b, 0) / Math.max(1, delta.length);
      cells.forEach(({ i }, k) => (bedrockM[i] = bedrockM[i]! + delta[k]! - meanDelta));
      return { applied: cells.length > 0, clamped, volumeChangeM3: 0 };
    }

    // Raise or dig with a raised-cosine profile; peak gradient is amplitude × π / (2 r).
    const sign = op.kind === "raise" ? 1 : -1;
    const limit = op.kind === "raise" ? this.cfg.brushMaxHeightM : this.cfg.brushMaxDepthM;
    let amplitude = op.kind === "raise" ? op.heightM : op.depthM;
    if (amplitude > limit) {
      amplitude = limit;
      clamped.push(op.kind === "raise" ? "height" : "depth");
    }
    const maxAmplitudeForSlope =
      (Math.tan((this.cfg.brushMaxSlopeDeg * Math.PI) / 180) * 2 * radiusM) / Math.PI;
    if (amplitude > maxAmplitudeForSlope) {
      amplitude = maxAmplitudeForSlope;
      clamped.push("slope");
    }
    amplitude = Math.max(0, amplitude);
    let volume = 0;
    for (const { i, d } of cells) {
      const h = amplitude * 0.5 * (1 + Math.cos((Math.PI * d) / radiusM));
      if (sign > 0) {
        bedrockM[i] = bedrockM[i]! + h;
        volume += h * area;
      } else {
        const fromSediment = Math.min(sedimentM[i]!, h);
        sedimentM[i] = sedimentM[i]! - fromSediment;
        bedrockM[i] = bedrockM[i]! - (h - fromSediment);
        volume -= h * area;
      }
    }
    this.counters.toolNetM3 += volume;
    return { applied: amplitude > 0 && cells.length > 0, clamped, volumeChangeM3: volume };
  }

  private cellsInDisk(at: PointM, radiusM: number): { i: number; x: number; y: number; d: number }[] {
    const { gridSize: n, metresPerCell: m } = this.state;
    const out: { i: number; x: number; y: number; d: number }[] = [];
    const x0 = Math.max(0, Math.floor((at.xM - radiusM) / m));
    const x1 = Math.min(n - 1, Math.floor((at.xM + radiusM) / m));
    const y0 = Math.max(0, Math.floor((at.yM - radiusM) / m));
    const y1 = Math.min(n - 1, Math.floor((at.yM + radiusM) / m));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot((x + 0.5) * m - at.xM, (y + 0.5) * m - at.yM);
        if (d <= radiusM) out.push({ i: cellIndex(n, x, y), x, y, d });
      }
    }
    return out;
  }

  async snapshot(options: SnapshotOptions = {}): Promise<StateSnapshot> {
    this.live();
    const names: readonly LayerName[] = options.layers ?? TERRAIN_LAYERS;
    const layers: Partial<Record<LayerName, Float32Array>> = {};
    for (const name of names) layers[name] = this.state.layers[name].slice();
    return {
      step: this.steps,
      simYears: this.steps * simYearsPerStep(this.cfg),
      gridSize: this.state.gridSize,
      metresPerCell: this.state.metresPerCell,
      outlet: { ...this.state.outlet },
      layers,
      budget: this.currentBudget(),
    };
  }

  private currentBudget(): BudgetCounters {
    return { ...this.counters };
  }

  async budget(): Promise<BudgetCounters> {
    this.live();
    return this.currentBudget();
  }

  async hash(): Promise<string> {
    this.live();
    return hashSnapshot({ step: this.steps, gridSize: this.state.gridSize, layers: this.state.layers });
  }

  dispose(): void {
    this.disposed = true;
  }
}

/**
 * Creates the fixture solver. Fixture only: see the file header. Fills missing config fields from the
 * defaults and starts reset to `preset` (the fake tilted plane by default).
 */
export function createFakeSolver(
  config: Partial<TerrainConfig> = {},
  preset: TerrainPreset = fakeTiltedPlanePreset,
): TerrainSolver {
  return new FakeSolver(resolveTerrainConfig(config), preset);
}
