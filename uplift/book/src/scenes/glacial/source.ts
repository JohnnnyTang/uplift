/**
 * What the glacial scene shows, behind one interface (session 5M). The scene (5K) draws whatever the source
 * says is shown and sends every reader action on runs and time to it; it never decides run semantics itself.
 *
 * Two sources implement it:
 * - the **live runtime** (5J `GlacialHost`, wired by the book in `app/glacial-live-source.ts`): a rock choice
 *   starts a new run from the authored start, play advances the model, scrubbing shows recorded snapshots;
 * - the **recorded runs** (5G2 captures, below): the review route's stand-in, frozen at R1, which shows each
 *   rock's recorded run and plays its snapshots (view-only; nothing is simulated).
 *
 * No glacier physics here: measures come from the model's own section probes (`createFrameMeasures`).
 */
import type { LandscapeSnapshot, ValleyOrientation } from "@hachure/ink/stage";
import { type RockCommand, type RunsState } from "./commands";
import type { FrameMeasures, ReviewRun, ReviewSection } from "./runs";

/** A run as the page names it. */
export interface SceneRunRef {
  readonly id: string;
  /** The model's rock id string (shale, sandstone, granite). */
  readonly rockKey: string;
  /** Presentation id of the rock's lithology look. */
  readonly rockId: number;
  /** Reader-facing run number since the last reset; null for recorded stand-ins. */
  readonly ordinal: number | null;
  /** Backend that computed the run ("webgpu" | "cpu"); null for recorded stand-ins. */
  readonly backend: string | null;
}

/** What the figure shows now: the live state or a recorded moment, with the model's measures of it. */
export interface SceneShown extends FrameMeasures {
  /** Changes whenever the shown state changes (run, step or view). */
  readonly key: string;
  readonly run: SceneRunRef;
  /** Bound label of the moment (model time, and "earlier" for a past view). */
  readonly label: string;
  /** Model time shown (unit: model years); null for authored, timeless frames. */
  readonly modelYears: number | null;
  /** True when this is a recorded earlier moment, not the live run's latest state. */
  readonly past: boolean;
  readonly snapshot: LandscapeSnapshot;
  /** The run's authored start, drawn dashed on the cut face. */
  readonly start: LandscapeSnapshot;
}

/** The compared run at the recorded time nearest the shown one. */
export interface SceneGhost extends FrameMeasures {
  readonly key: string;
  readonly run: SceneRunRef;
  readonly label: string;
  /** Actual recorded time of the compared snapshot (unit: model years). */
  readonly modelYears: number;
  readonly snapshot: LandscapeSnapshot;
}

export interface SceneTimeline {
  /** Recorded times of the live run, plus its live head when that is newer (unit: model years). */
  readonly times: readonly number[];
  /** Index into `times` of the shown moment. */
  readonly index: number;
  /** The live run's latest state is shown. */
  readonly atLive: boolean;
  readonly playing: boolean;
  /** Settling, or a command is being applied. */
  readonly busy: boolean;
  /** The live run's status. */
  readonly status: "active" | "complete" | "halted";
}

export type SceneNotice =
  | { readonly kind: "dropped"; readonly run: SceneRunRef }
  | { readonly kind: "halted"; readonly message: string };

/** One point of a run graph: the section under the front face at a recorded time. */
export interface SceneSeriesPoint {
  readonly modelYears: number;
  readonly section: ReviewSection | null;
}

export interface GlacialSceneSource {
  readonly kind: "live" | "recorded" | "fixture";
  /** Provenance phrase shown with the figure. */
  readonly provenance: string;
  readonly orientation: ValleyOrientation;
  /** Display altitudes for snow and trees (unit: metres). The snowline is the model's. */
  readonly dressing: { readonly snowlineM: number; readonly treelineM: number };
  /** Vertical frame of the block (unit: metres), fixed so switching rock or time never resizes it. */
  readonly elevationRangeM: { readonly minM: number; readonly maxM: number };
  /** Rock keys the reader may choose, soft to hard. */
  readonly rocks: readonly string[];
  shown(): SceneShown;
  ghost(): SceneGhost | null;
  /** Why the compared run is not drawn now (e.g. different backend at an unmatched time), or null. */
  ghostNote(): string | null;
  /** Kept runs, newest first, and which one is compared. */
  kept(): readonly SceneRunRef[];
  comparedId(): string | null;
  timeline(): SceneTimeline;
  notice(): SceneNotice | null;
  /** A WebGPU run halted; a new CPU run may be started. */
  offersCpuRestart(): boolean;
  /** Backend of the live run and why it is not the preferred one (deeper level). */
  backend(): { readonly backend: string; readonly fallbackReason: string | null } | null;
  /** The shared model config and recording interval of live runs (deeper level); null for recorded stand-ins. */
  modelConfig(): {
    readonly model: Readonly<Record<string, unknown>>;
    readonly snapshotIntervalYears: number;
  } | null;
  /** Each held run's section at `valleyIndex` over its recorded times (deeper-level graphs). */
  series(
    valleyIndex: number,
  ): readonly { readonly run: SceneRunRef; readonly points: readonly SceneSeriesPoint[] }[];

  /** The one rock command: the page selector and the specimen dropped on the block both call it. */
  chooseRock(rockKey: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Advance to the next recorded time. */
  step(): Promise<void>;
  setSpeed(speed: number): Promise<void>;
  speed(): number;
  /** Show the recorded moment `index` of `timeline().times` (pauses). */
  scrubTo(index: number): Promise<void>;
  returnToLive(): Promise<void>;
  compare(runId: string | null): Promise<void>;
  restartOnCpu(): Promise<void>;
  /** Returns "confirm" when kept runs exist and `confirmed` is not set. */
  reset(confirmed: boolean): Promise<"done" | "confirm">;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** How long each recorded snapshot shows while a recorded run plays (unit: milliseconds). Presentation only. */
export const RECORDED_PLAY_FRAME_MS = 650;

const refOf = (run: ReviewRun): SceneRunRef => ({
  id: run.id,
  rockKey: run.rockKey,
  rockId: run.rockId,
  ordinal: null,
  backend: null,
});

/**
 * The recorded runs as a source (the review route's stand-in; R1-frozen behaviour): a rock choice shows that
 * rock's recorded run at the same model time and keeps the previous one; play steps through snapshots.
 */
export function createRecordedSource(
  runs: readonly ReviewRun[],
  command: RockCommand,
  options: { readonly frame?: number | undefined; readonly combinedRange: { minM: number; maxM: number } },
): GlacialSceneSource {
  let run = command.state.live;
  let frameIndex = Math.min(run.frames.length - 1, Math.max(0, options.frame ?? run.frames.length - 1));
  let playing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let compared: string | null = command.state.kept[0]?.id ?? null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const last = () => run.frames.length - 1;
  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    playing = false;
  };
  const measuresAt = (r: ReviewRun, k: number): FrameMeasures => ({
    section: (i) => r.section(k, i),
    overdeepening: (i) => r.overdeepening(k, i),
    profile: (i) => r.profile(k, i),
  });
  const keptRun = () => command.state.kept.find((r) => r.id === compared) ?? null;
  const apply = (state: RunsState) => {
    const years = run.frames[frameIndex]!.modelYears;
    run = state.live;
    compared = state.kept[0]?.id ?? null;
    const k = run.frames.findIndex((f) => f.modelYears === years);
    frameIndex = k >= 0 ? k : Math.min(frameIndex, last());
  };
  const source: GlacialSceneSource = {
    kind: run.isFixture ? "fixture" : "recorded",
    get provenance() {
      return run.provenance;
    },
    orientation: run.orientation,
    dressing: run.dressing,
    elevationRangeM: options.combinedRange,
    rocks: runs.filter((r) => !r.isFixture).map((r) => r.rockKey),
    shown() {
      const f = run.frames[frameIndex]!;
      return {
        key: `${run.id}:${frameIndex}`,
        run: refOf(run),
        label: f.label,
        modelYears: f.modelYears,
        past: false,
        snapshot: f.snapshot,
        start: run.start,
        ...measuresAt(run, frameIndex),
      };
    },
    ghost() {
      const kept = keptRun();
      if (!kept || run.isFixture) return null;
      const years = run.frames[frameIndex]!.modelYears ?? 0;
      let k = 0;
      kept.frames.forEach((f, i) => {
        if (Math.abs((f.modelYears ?? 0) - years) < Math.abs((kept.frames[k]!.modelYears ?? 0) - years))
          k = i;
      });
      const frame = kept.frames[k]!;
      return {
        key: `${kept.id}:${k}`,
        run: refOf(kept),
        label: frame.label,
        modelYears: frame.modelYears ?? 0,
        snapshot: frame.snapshot,
        ...measuresAt(kept, k),
      };
    },
    ghostNote: () => null,
    kept: () => command.state.kept.map(refOf),
    comparedId: () => compared,
    timeline: () => ({
      times: run.frames.map((f) => f.modelYears ?? 0),
      index: frameIndex,
      atLive: true,
      playing,
      busy: false,
      status: "active",
    }),
    notice: () => (command.state.dropped ? { kind: "dropped", run: refOf(command.state.dropped) } : null),
    offersCpuRestart: () => false,
    backend: () => null,
    modelConfig: () => null,
    series(i) {
      const all = [run, ...command.state.kept];
      return all
        .filter((r) => !r.isFixture)
        .map((r) => ({
          run: refOf(r),
          points: r.frames.map((f, k) => ({ modelYears: f.modelYears ?? 0, section: r.section(k, i) })),
        }));
    },
    async chooseRock(rockKey) {
      const state = command.chooseRock(rockKey);
      if (state) {
        apply(state);
        emit();
      }
    },
    async play() {
      if (playing || run.isFixture) return;
      if (frameIndex >= last()) frameIndex = 0;
      playing = true;
      timer = setInterval(() => {
        if (frameIndex >= last()) stop();
        else frameIndex++;
        emit();
      }, RECORDED_PLAY_FRAME_MS);
      emit();
    },
    async pause() {
      stop();
      emit();
    },
    async step() {
      stop();
      frameIndex = Math.min(last(), frameIndex + 1);
      emit();
    },
    async setSpeed() {},
    speed: () => 1,
    async scrubTo(index) {
      stop();
      frameIndex = Math.min(last(), Math.max(0, index));
      emit();
    },
    async returnToLive() {},
    async compare(runId) {
      compared = runId;
      emit();
    },
    async restartOnCpu() {},
    async reset(confirmed) {
      if (command.state.kept.length && !confirmed) return "confirm";
      stop();
      const state = command.reset(run);
      apply(state);
      emit();
      return "done";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stop();
      listeners.clear();
    },
  };
  return source;
}
