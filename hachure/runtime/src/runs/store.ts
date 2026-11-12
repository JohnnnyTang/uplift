/**
 * The live run and the kept runs (wave plan §4): at most `maxKeptRuns` kept runs, the oldest dropped first,
 * and nearest-time lookup for comparison. Pure bookkeeping over recorded view data; it never runs a model.
 */
import type { GlacierProbes, GlacierSnapshot, RockId } from "@hachure/glacier";
import type { GlacialRunPlan } from "./config";
import type { RecordedRun, RunBackend } from "./recorded-run";

export interface RunHandoff {
  /** The previous live run, now kept; null when it had no history and was discarded. */
  readonly kept: RecordedRun | null;
  /** The oldest kept run, dropped to stay within `maxKeptRuns`; null when none was. */
  readonly evicted: RecordedRun | null;
}

/** A recorded moment located in a run. */
export interface RunMoment {
  readonly run: RecordedRun;
  readonly index: number;
  readonly step: number;
  readonly modelYears: number;
}

/** What the page compares against: a kept run at the recorded time nearest to the viewed time. */
export type RunComparison =
  | {
      /** "matched": the recorded time equals the viewed time; "nearest": the closest recorded time. */
      readonly status: "matched" | "nearest";
      readonly runId: string;
      readonly ordinal: number;
      readonly rockId: RockId;
      readonly backend: RunBackend;
      readonly index: number;
      /** Actual recorded time of the compared snapshot (unit: model years); label with this. */
      readonly modelYears: number;
      /** Time being viewed (unit: model years). */
      readonly viewModelYears: number;
      /** The two runs were computed on different backends (numerically different runs, D-W5-5I). */
      readonly crossBackend: boolean;
      readonly probes: GlacierProbes;
      snapshot(): GlacierSnapshot;
    }
  | {
      /** Runs on different backends compare only at matched recorded times (D-W5-5I); this time is not one. */
      readonly status: "unmatched";
      readonly runId: string;
      readonly ordinal: number;
      readonly rockId: RockId;
      readonly backend: RunBackend;
      readonly viewModelYears: number;
      /** Nearest recorded time of the other run (unit: model years). */
      readonly nearestModelYears: number;
      readonly crossBackend: true;
      readonly reason: string;
    };

export class RunStore {
  private liveRun: RecordedRun | null = null;
  private keptRuns: RecordedRun[] = [];
  constructor(readonly plan: GlacialRunPlan) {}

  get live(): RecordedRun | null {
    return this.liveRun;
  }
  /** Kept runs, oldest first. */
  get kept(): readonly RecordedRun[] {
    return this.keptRuns;
  }
  all(): readonly RecordedRun[] {
    return this.liveRun ? [...this.keptRuns, this.liveRun] : [...this.keptRuns];
  }
  get(id: string): RecordedRun | undefined {
    return this.all().find((run) => run.id === id);
  }

  /**
   * Makes `run` the live run. The previous live run is kept if it has history (it advanced past its start),
   * otherwise discarded: a rock chosen before a run has started just sets the rock. Kept runs over the limit
   * are dropped oldest first; the caller shows a visible note for the dropped run.
   */
  startLive(run: RecordedRun): RunHandoff {
    if (this.get(run.id)) throw new Error(`run ${run.id} is already held`);
    const previous = this.liveRun;
    let kept: RecordedRun | null = null;
    let evicted: RecordedRun | null = null;
    if (previous && previous.hasHistory) {
      kept = previous;
      this.keptRuns.push(previous);
      if (this.keptRuns.length > this.plan.config.maxKeptRuns) evicted = this.keptRuns.shift() ?? null;
    }
    this.liveRun = run;
    this.assertBudget();
    return { kept, evicted };
  }

  /** Drops every run (explicit reset). */
  clear(): void {
    this.liveRun = null;
    this.keptRuns = [];
  }

  /** Recorded bytes over the live and kept runs (unit: bytes). */
  memoryBytes(): number {
    return this.all().reduce((sum, run) => sum + run.recordedBytes, 0);
  }

  /** Throws if the recorded bytes exceed the budget (cannot happen within the plan; a guard). */
  assertBudget(): void {
    const used = this.memoryBytes();
    if (used > this.plan.config.memoryBudgetBytes)
      throw new RangeError(
        `recorded runs hold ${used} bytes, above the ${this.plan.config.memoryBudgetBytes}-byte budget`,
      );
  }

  /** The recorded snapshot of `runId` nearest to `modelYears`, or null when the run is unknown or empty. */
  nearest(runId: string, modelYears: number): RunMoment | null {
    const run = this.get(runId);
    if (!run) return null;
    const index = run.nearestIndex(modelYears);
    if (index < 0) return null;
    return { run, index, step: run.recordedStep(index), modelYears: run.recordedModelYears(index) };
  }

  /**
   * Compares the viewed moment with another held run at the nearest recorded time. Runs on different backends
   * are numerically different runs, so they compare only where the recorded time equals the viewed time.
   */
  compare(
    view: { readonly runId: string; readonly modelYears: number; readonly backend: RunBackend },
    otherId: string,
  ): RunComparison | null {
    if (otherId === view.runId) return null;
    const moment = this.nearest(otherId, view.modelYears);
    if (!moment) return null;
    const { run, index } = moment;
    const matched = Math.abs(moment.modelYears - view.modelYears) <= this.plan.dtYears / 2;
    const crossBackend = run.backend !== view.backend;
    if (crossBackend && !matched)
      return {
        status: "unmatched",
        runId: run.id,
        ordinal: run.ordinal,
        rockId: run.rockId,
        backend: run.backend,
        viewModelYears: view.modelYears,
        nearestModelYears: moment.modelYears,
        crossBackend: true,
        reason: `run ${run.ordinal} was computed on ${run.backend}; runs on different backends are compared only at matched recorded times`,
      };
    return {
      status: matched ? "matched" : "nearest",
      runId: run.id,
      ordinal: run.ordinal,
      rockId: run.rockId,
      backend: run.backend,
      index,
      modelYears: moment.modelYears,
      viewModelYears: view.modelYears,
      crossBackend,
      probes: run.probes(index),
      snapshot: () => run.snapshot(index),
    };
  }
}
