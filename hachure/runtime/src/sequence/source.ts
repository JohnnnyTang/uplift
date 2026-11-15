/**
 * The authored-sequence source (session 7B, D-W7-7B): feeds the book stage from authored generators
 * `(stage ∈ [0, 1]) → frame` instead of a solver. It uses the same seam as the glacial host: a driver calls
 * `advance(viewSeconds)` from animation frames, the page subscribes and re-reads `frame()` whenever
 * `frameSerial` changes, and leaving and returning are `pauseAndSettle` and `resume`.
 *
 * It holds no model time, no runs and no years: the stage is the only position. Every reader action is one
 * command through `dispatch`, so a page picker and an on-block gesture send the same `choose`.
 *
 * Deterministic: the only time input is the injected view clock (`advance`); there is no randomness and no
 * wall-clock read. Generic in the frame type (the book uses `LandscapeSnapshot`) and in its keys.
 */

/** A pure, deterministic generator: the same stage gives an equal frame. Stage ∈ [0, 1], unitless. */
export type SequenceGenerator<TFrame> = (stage: number) => TFrame;

export interface AuthoredSequenceOptions<TFrame> {
  /** Registered sequences in display order. Keys are non-empty and unique. */
  readonly sequences: readonly { readonly key: string; readonly generate: SequenceGenerator<TFrame> }[];
  /** Frame shown when no sequence is chosen. Default: the first sequence at stage 0. */
  readonly start?: () => TFrame;
  /** Play rate on the view clock (unit: stage per view second; 1/12 = early → late in 12 s). */
  readonly stagePerViewSecond: number;
  /** Reduced-motion stops, evenly spaced from 0 to 1 inclusive (unit: count, 3–5). Default 5. */
  readonly reducedMotionStops?: number;
  /** Reduced-motion dwell at each stop while playing (unit: view seconds). Default 1.5. */
  readonly reducedMotionStepSeconds?: number;
  /** Start in reduced motion. Default false. */
  readonly reducedMotion?: boolean;
  /** Longest view-clock gap accepted from one `advance`; longer gaps are not caught up (unit: s). Default 0.25. */
  readonly maxFrameSeconds?: number;
}

export type SequenceCommand =
  /** Page picker and on-block gesture alike: show `key` from stage 0, paused; `key` joins `viewed`. */
  | { readonly kind: "choose"; readonly key: string }
  /** Play from the current stage (from 0 when at 1). Refused with no sequence chosen. */
  | { readonly kind: "play" }
  | { readonly kind: "pause" }
  /** Scrub: pause and set the stage directly (clamped to [0, 1]; NaN is refused). */
  | { readonly kind: "set-stage"; readonly stage: number }
  /** Pause and move to the next (+1) or previous (−1) reduced-motion stop (keyboard stepping). */
  | { readonly kind: "step"; readonly direction: 1 | -1 }
  /** Preference: continuous play or stop-to-stop play. Never changes the stage. */
  | { readonly kind: "set-reduced-motion"; readonly reduced: boolean }
  /** No sequence chosen, stage 0, paused, `viewed` cleared (so no ghosts). */
  | { readonly kind: "reset" };

export type SequenceCommandResult =
  { readonly kind: "done" } | { readonly kind: "unchanged"; readonly reason: string };

export interface SequenceState {
  readonly key: string | null;
  /** Stage shown (unit: none, 0 = early, 1 = late). */
  readonly stage: number;
  readonly playing: boolean;
  /**
   * Left the page: paused; `resume` restores the play intent. Commands other than the reduced-motion
   * preference are refused ("unchanged") while departed.
   */
  readonly departed: boolean;
  readonly reducedMotion: boolean;
  /** Stops used by reduced-motion play and by `step` (unit: stage). */
  readonly stops: readonly number[];
  /** Keys chosen since the last reset, in first-chosen order (includes the current key). */
  readonly viewed: readonly string[];
  /** Increments whenever the shown frame changes (key or stage); re-read `frame()` then. */
  readonly frameSerial: number;
}

export interface SequenceGhost<TFrame> {
  readonly key: string;
  readonly stage: number;
  readonly frame: TFrame;
}

export interface AuthoredSequenceSource<TFrame> {
  readonly keys: readonly string[];
  state(): SequenceState;
  subscribe(listener: (state: SequenceState) => void): () => void;
  dispatch(command: SequenceCommand): SequenceCommandResult;
  /** View-clock advance from the driver (unit: seconds). Ignored when paused or departed. */
  advance(viewSeconds: number): void;
  /** The frame shown now: the chosen sequence at the current stage, or `start` when none is chosen. */
  frame(): TFrame;
  /** Any registered sequence at any stage ∈ [0, 1] (RangeError otherwise). */
  frameAt(key: string, stage: number): TFrame;
  /** Viewed sequences other than the current one, at the current stage, in `viewed` order. */
  ghosts(): readonly SequenceGhost<TFrame>[];
  /** Leaving the page: pause and remember the play intent. Resolves at once (nothing to drain). */
  pauseAndSettle(): Promise<void>;
  /** Returning: restore key, stage, ghosts and play intent; the first advance after it is dropped. */
  resume(): void;
  dispose(): void;
}

/** Evenly spaced stops from 0 to 1 inclusive. */
export function sequenceStops(count: number): number[] {
  if (!Number.isInteger(count) || count < 3 || count > 5)
    throw new RangeError("reducedMotionStops must be a whole number from 3 to 5");
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 1 : i / (count - 1)));
}

const EPS = 1e-9;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createAuthoredSequence<TFrame>(
  options: AuthoredSequenceOptions<TFrame>,
): AuthoredSequenceSource<TFrame> {
  const generators = new Map<string, SequenceGenerator<TFrame>>();
  for (const { key, generate } of options.sequences) {
    if (typeof key !== "string" || !key.trim()) throw new RangeError("Sequence keys must be non-empty");
    if (generators.has(key)) throw new RangeError(`Duplicate sequence key "${key}"`);
    if (typeof generate !== "function") throw new TypeError(`Sequence "${key}" has no generator`);
    generators.set(key, generate);
  }
  if (generators.size === 0) throw new RangeError("An authored sequence needs at least one generator");
  const rate = options.stagePerViewSecond;
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError("stagePerViewSecond must be positive");
  const dwell = options.reducedMotionStepSeconds ?? 1.5;
  if (!Number.isFinite(dwell) || dwell <= 0)
    throw new RangeError("reducedMotionStepSeconds must be positive");
  const maxFrame = options.maxFrameSeconds ?? 0.25;
  if (!Number.isFinite(maxFrame) || maxFrame <= 0) throw new RangeError("maxFrameSeconds must be positive");
  const stops = Object.freeze(sequenceStops(options.reducedMotionStops ?? 5));
  const keys = Object.freeze([...generators.keys()]);
  const firstKey = keys[0]!;

  let key: string | null = null;
  let stage = 0;
  let playing = false;
  let departed = false;
  let resumeIntent = false;
  let skipNextAdvance = false;
  let reducedMotion = options.reducedMotion ?? false;
  /** View seconds spent at the current stop during reduced-motion play. */
  let dwellSeconds = 0;
  let viewed: string[] = [];
  let frameSerial = 0;
  let disposed = false;
  const listeners = new Set<(state: SequenceState) => void>();
  /** One memoised frame per key, for the last stage asked. */
  const memo = new Map<string, { stage: number; frame: TFrame }>();
  let startFrame: { frame: TFrame } | null = null;

  const snapshotState = (): SequenceState => ({
    key,
    stage,
    playing,
    departed,
    reducedMotion,
    stops,
    viewed: Object.freeze([...viewed]),
    frameSerial,
  });
  const publish = () => {
    if (listeners.size === 0) return;
    const state = snapshotState();
    for (const listener of listeners) listener(state);
  };
  const setStage = (next: number) => {
    if (next !== stage) {
      stage = next;
      frameSerial++;
    }
  };
  const unchanged = (reason: string): SequenceCommandResult => ({ kind: "unchanged", reason });
  const done = (): SequenceCommandResult => {
    publish();
    return { kind: "done" };
  };

  const frameAt = (k: string, s: number): TFrame => {
    const generate = generators.get(k);
    if (!generate) throw new RangeError(`Unknown sequence "${k}"`);
    if (!(s >= 0 && s <= 1)) throw new RangeError(`Stage must lie in [0, 1]; got ${s}`);
    const cached = memo.get(k);
    if (cached && cached.stage === s) return cached.frame;
    const frame = generate(s);
    memo.set(k, { stage: s, frame });
    return frame;
  };

  const nextStopAbove = (s: number) => stops.find((p) => p > s + EPS) ?? 1;
  const nextStopBelow = (s: number) => [...stops].reverse().find((p) => p < s - EPS) ?? 0;

  const source: AuthoredSequenceSource<TFrame> = {
    keys,
    state: snapshotState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(command) {
      if (disposed) return unchanged("disposed");
      if (command.kind === "set-reduced-motion") {
        if (command.reduced === reducedMotion) return unchanged("already set");
        reducedMotion = command.reduced;
        dwellSeconds = 0;
        return done();
      }
      if (departed) return unchanged("departed; resume before changing the sequence");
      switch (command.kind) {
        case "choose": {
          if (!generators.has(command.key)) return unchanged(`unknown sequence "${command.key}"`);
          if (key !== command.key) frameSerial++;
          key = command.key;
          playing = false;
          dwellSeconds = 0;
          setStage(0);
          if (!viewed.includes(key)) viewed.push(key);
          return done();
        }
        case "play": {
          if (key === null) return unchanged("no sequence chosen");
          if (playing) return unchanged("already playing");
          if (stage >= 1) setStage(0);
          playing = true;
          dwellSeconds = 0;
          return done();
        }
        case "pause": {
          if (!playing) return unchanged("already paused");
          playing = false;
          return done();
        }
        case "set-stage": {
          if (Number.isNaN(command.stage)) return unchanged("stage is not a number");
          if (key === null) return unchanged("no sequence chosen");
          playing = false;
          dwellSeconds = 0;
          setStage(clamp01(command.stage));
          return done();
        }
        case "step": {
          if (key === null) return unchanged("no sequence chosen");
          playing = false;
          dwellSeconds = 0;
          setStage(command.direction > 0 ? nextStopAbove(stage) : nextStopBelow(stage));
          return done();
        }
        case "reset": {
          if (key !== null) frameSerial++;
          key = null;
          playing = false;
          dwellSeconds = 0;
          stage = 0;
          viewed = [];
          return done();
        }
      }
    },
    advance(viewSeconds) {
      if (!Number.isFinite(viewSeconds) || viewSeconds < 0)
        throw new RangeError("advance needs a non-negative, finite number of view seconds");
      if (departed || disposed) return;
      if (skipNextAdvance) {
        skipNextAdvance = false;
        return;
      }
      if (!playing || key === null) return;
      const dt = Math.min(maxFrame, viewSeconds);
      if (reducedMotion) {
        dwellSeconds += dt;
        if (dwellSeconds + EPS < dwell) return;
        dwellSeconds = 0;
        setStage(nextStopAbove(stage));
      } else {
        setStage(clamp01(stage + dt * rate));
      }
      if (stage >= 1) playing = false;
      publish();
    },
    frame() {
      if (key !== null) return frameAt(key, stage);
      if (options.start) {
        startFrame ??= { frame: options.start() };
        return startFrame.frame;
      }
      return frameAt(firstKey, 0);
    },
    frameAt,
    ghosts() {
      return viewed.filter((k) => k !== key).map((k) => ({ key: k, stage, frame: frameAt(k, stage) }));
    },
    pauseAndSettle() {
      if (!disposed && !departed) {
        departed = true;
        resumeIntent = playing;
        playing = false;
        publish();
      }
      return Promise.resolve();
    },
    resume() {
      if (!departed || disposed) return;
      departed = false;
      // No hidden advance: the first frame after returning only re-arms the driver's clock.
      skipNextAdvance = true;
      playing = resumeIntent && key !== null && stage < 1;
      resumeIntent = false;
      publish();
    },
    dispose() {
      disposed = true;
      playing = false;
      listeners.clear();
      memo.clear();
      startFrame = null;
    },
  };
  return source;
}
