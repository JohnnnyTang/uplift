/**
 * Run, timeline and comparison configuration for the glacier lesson (session 5J, wave plan §4).
 *
 * One typed config with units in the names (AGENTS.md). These values schedule and record runs; none of them
 * is a model parameter. The model's own config is `GlacierConfig` (`@hachure/glacier`, frozen in D-W5-5G),
 * and its fixed step `dtYears` is never changed by anything here.
 */
import { GLACIER_LAYERS, type GlacierConfig } from "@hachure/glacier";
import type { RunBackend } from "./recorded-run";

export interface GlacialRunConfig {
  /**
   * Model-time spacing of recorded snapshots (unit: model years). Proposed in D-W5-5G item 7 and equal to the
   * registered protocol's snapshot interval, so recorded times are the protocol's matched times. Must be a
   * whole number of fixed steps.
   */
  readonly snapshotIntervalYears: number;
  /**
   * Model time at which a run is complete and stops (unit: model years). The registered horizon (D-W5-5G
   * item 7). Must be a whole number of snapshot intervals.
   */
  readonly horizonYears: number;
  /** Ceiling on recorded snapshot bytes over the live run and every kept run (unit: bytes). Wave plan §4. */
  readonly memoryBudgetBytes: number;
  /** Kept earlier runs besides the live run (unit: runs). Wave plan §4: up to two. */
  readonly maxKeptRuns: number;
  /**
   * Playback rate at speed 1 (unit: model years per real second). Scheduling only: a slower backend
   * drops wall-clock time and never changes the step or the results.
   */
  readonly modelYearsPerRealSecond: number;
  /**
   * Largest automatic batch sent to a WebGPU solver at once (unit: model years). Scheduling only. A batch
   * already sent is never interrupted: Pause, scrubbing and leaving wait for it.
   */
  readonly maxBatchModelYears: number;
  /**
   * Largest automatic batch sent to the CPU solver at once (unit: model years). Scheduling only. Smaller than
   * the WebGPU batch because a CPU batch is much slower (one model year took about 300 ms on the 6A laptop)
   * and Pause, scrubbing and leaving wait for the batch in flight. 0.2 (about 60 ms there) keeps scrubbing
   * right after Pause within 100 ms at a 2 % throughput cost; 0.1 halves the wait for about 7 % (D-W6-6A2).
   * Fixed-step results do not depend on it: the engine advances whole fixed steps and splits batches at
   * record boundaries (D-W5-5J).
   */
  readonly cpuMaxBatchModelYears: number;
  /** Real time between live view frames while playing (unit: seconds). Scheduling only. */
  readonly frameIntervalSeconds: number;
}

/** 32 MiB: the "around 32 MB total" of wave plan §4. */
export const GLACIAL_MEMORY_BUDGET_BYTES = 32 * 1024 * 1024;

export const DEFAULT_GLACIAL_RUN_CONFIG: GlacialRunConfig = Object.freeze({
  snapshotIntervalYears: 20,
  horizonYears: 300,
  memoryBudgetBytes: GLACIAL_MEMORY_BUDGET_BYTES,
  maxKeptRuns: 2,
  modelYearsPerRealSecond: 10,
  maxBatchModelYears: 1,
  cpuMaxBatchModelYears: 0.2,
  frameIntervalSeconds: 0.2,
});

/** Speeds the reader may choose (unit: × normal). Scheduling only. */
export const GLACIAL_SPEED_RANGE = Object.freeze({ min: 0.25, max: 4 });

/** Derived whole-step quantities. */
export interface GlacialRunPlan {
  readonly config: GlacialRunConfig;
  readonly dtYears: number;
  /** Fixed steps between recorded snapshots (unit: steps). */
  readonly recordEverySteps: number;
  /** Fixed steps in a complete run (unit: steps). */
  readonly horizonSteps: number;
  /** Snapshots a complete run records, including the start (unit: snapshots). */
  readonly snapshotsPerRun: number;
  /** Bytes of one recorded snapshot in the capture format (unit: bytes). */
  readonly bytesPerSnapshot: number;
  /** Worst case over the live run and every kept run (unit: bytes). Never above the budget. */
  readonly worstCaseBytes: number;
}

function wholeMultiple(value: number, unit: number): number | null {
  const ratio = value / unit;
  const rounded = Math.round(ratio);
  return rounded >= 1 && Math.abs(ratio - rounded) <= 1e-9 * Math.max(1, rounded) ? rounded : null;
}

/**
 * Validates a run config against the model's grid and fixed step and returns the derived plan. Throws with
 * every problem listed; in particular when the live run plus the kept runs could exceed the memory budget.
 */
export function planGlacialRuns(
  overrides: Partial<GlacialRunConfig>,
  model: Pick<GlacierConfig, "nx" | "ny" | "dtYears">,
): GlacialRunPlan {
  const config = Object.freeze({ ...DEFAULT_GLACIAL_RUN_CONFIG, ...overrides });
  const problems: string[] = [];
  const positive = (key: keyof GlacialRunConfig) => {
    const value = config[key];
    if (!(typeof value === "number" && Number.isFinite(value) && value > 0))
      problems.push(`${key} must be a positive finite number`);
  };
  for (const key of [
    "snapshotIntervalYears",
    "horizonYears",
    "memoryBudgetBytes",
    "modelYearsPerRealSecond",
    "maxBatchModelYears",
    "cpuMaxBatchModelYears",
    "frameIntervalSeconds",
  ] as const)
    positive(key);
  if (!Number.isInteger(config.maxKeptRuns) || config.maxKeptRuns < 0 || config.maxKeptRuns > 8)
    problems.push("maxKeptRuns must be an integer in [0, 8]");
  if (config.frameIntervalSeconds < 0.05) problems.push("frameIntervalSeconds must be at least 0.05");
  const recordEverySteps = wholeMultiple(config.snapshotIntervalYears, model.dtYears);
  if (recordEverySteps === null) problems.push("snapshotIntervalYears must be a whole number of fixed steps");
  const intervals = wholeMultiple(config.horizonYears, config.snapshotIntervalYears);
  if (intervals === null) problems.push("horizonYears must be a whole number of snapshot intervals");
  for (const key of ["maxBatchModelYears", "cpuMaxBatchModelYears"] as const)
    if (Math.round(config[key] / model.dtYears) < 1)
      problems.push(`${key} must cover at least one fixed step`);
  const bytesPerSnapshot = GLACIER_LAYERS.length * model.nx * model.ny * 2;
  const snapshotsPerRun = (intervals ?? 0) + 1;
  const worstCaseBytes = (config.maxKeptRuns + 1) * snapshotsPerRun * bytesPerSnapshot;
  if (problems.length === 0 && worstCaseBytes > config.memoryBudgetBytes)
    problems.push(
      `live run plus ${config.maxKeptRuns} kept runs need up to ${worstCaseBytes} bytes, above the ${config.memoryBudgetBytes}-byte budget`,
    );
  if (problems.length > 0) throw new RangeError(`Invalid GlacialRunConfig: ${problems.join("; ")}`);
  return Object.freeze({
    config,
    dtYears: model.dtYears,
    recordEverySteps: recordEverySteps!,
    horizonSteps: recordEverySteps! * intervals!,
    snapshotsPerRun,
    bytesPerSnapshot,
    worstCaseBytes,
  });
}

/**
 * Largest automatic batch for a plan on a backend (unit: steps): `maxBatchModelYears` on WebGPU,
 * `cpuMaxBatchModelYears` on the CPU. Scheduling only.
 */
export function maxBatchSteps(plan: GlacialRunPlan, backend: RunBackend): number {
  const years = backend === "cpu" ? plan.config.cpuMaxBatchModelYears : plan.config.maxBatchModelYears;
  return Math.max(1, Math.round(years / plan.dtYears));
}
