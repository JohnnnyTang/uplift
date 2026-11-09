/**
 * The handoff from the flat page to 3D, and the lift (T8, D-1C):
 *
 * 1. `flat`: the SVG drawing is showing; the canvas is transparent, at zero exaggeration, with hachures and
 *    quantity overlays hidden, so it draws exactly the SVG's lines.
 * 2. `crossfade`: the canvas fades in over the SVG. Nothing moves.
 * 3. `lift`: exaggeration rises from 0 to 1; contours rise with the terrain.
 * 4. `done`: hachures and overlays appear.
 *
 * Reduced motion skips the animation: the sequence jumps straight to `done`. Nothing starts on its own;
 * the host calls `runLift` (for example after the reader commits a prediction).
 *
 * The state at any moment is a pure function of elapsed time (`liftStateAt`), so the sequence is
 * deterministic and testable without a browser.
 */

export interface LiftTiming {
  /** Duration of the SVG-to-canvas crossfade (unit: milliseconds). */
  readonly crossfadeMs: number;
  /** Duration of the rise from flat to full relief (unit: milliseconds). */
  readonly liftMs: number;
  /** Skip animation and show the end state at once. */
  readonly reducedMotion: boolean;
}

export const DEFAULT_LIFT_TIMING: LiftTiming = Object.freeze({
  crossfadeMs: 600,
  liftMs: 2400,
  reducedMotion: false,
});

export type LiftPhase = "flat" | "crossfade" | "lift" | "done";

export interface LiftState {
  readonly phase: LiftPhase;
  /** Opacity of the 3D canvas (unit: none, 0–1). */
  readonly canvasOpacity: number;
  /** Opacity of the flat SVG drawing (unit: none, 0–1). */
  readonly flatOpacity: number;
  /** Vertical exaggeration (unit: none, 0 = flat, 1 = full relief). */
  readonly exaggeration: number;
  /** Whether hachures and the water and sediment overlays are shown. */
  readonly overlays: boolean;
}

/** The starting state: SVG showing, canvas transparent and flat. */
export const FLAT_STATE: LiftState = Object.freeze({
  phase: "flat",
  canvasOpacity: 0,
  flatOpacity: 1,
  exaggeration: 0,
  overlays: false,
});

/** The end state: canvas showing at full relief with overlays. */
export const LIFTED_STATE: LiftState = Object.freeze({
  phase: "done",
  canvasOpacity: 1,
  flatOpacity: 0,
  exaggeration: 1,
  overlays: true,
});

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** The sequence state `elapsedMs` after it starts. Negative elapsed time gives the flat state. */
export function liftStateAt(elapsedMs: number, timing: LiftTiming = DEFAULT_LIFT_TIMING): LiftState {
  if (timing.reducedMotion) return LIFTED_STATE;
  if (elapsedMs < 0) return FLAT_STATE;
  if (elapsedMs < timing.crossfadeMs) {
    const t = elapsedMs / timing.crossfadeMs;
    return { phase: "crossfade", canvasOpacity: t, flatOpacity: 1 - t, exaggeration: 0, overlays: false };
  }
  const intoLift = elapsedMs - timing.crossfadeMs;
  if (intoLift < timing.liftMs) {
    return {
      phase: "lift",
      canvasOpacity: 1,
      flatOpacity: 0,
      exaggeration: smoothstep(intoLift / timing.liftMs),
      overlays: false,
    };
  }
  return LIFTED_STATE;
}

/** What the sequence drives. The host wires these to the InkView and the page elements. */
export interface LiftTargets {
  apply(state: LiftState): void;
}

/** Animation clock; defaults to `performance.now` and `requestAnimationFrame`. Injected in tests. */
export interface FrameClock {
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export interface LiftRun {
  /** Resolves `true` when the sequence completes, `false` if it was cancelled. */
  readonly done: Promise<boolean>;
  /** Stops at the current state. */
  cancel(): void;
}

function browserClock(): FrameClock {
  return {
    now: () => performance.now(),
    request: (callback) => requestAnimationFrame(() => callback()),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

/** Runs the handoff and lift, applying the state every frame. */
export function runLift(
  targets: LiftTargets,
  timing: Partial<LiftTiming> = {},
  clock: FrameClock = browserClock(),
): LiftRun {
  const t: LiftTiming = { ...DEFAULT_LIFT_TIMING, ...timing };
  let handle = -1;
  let finished = false;
  let resolve!: (completed: boolean) => void;
  const done = new Promise<boolean>((r) => (resolve = r));
  const finish = (completed: boolean) => {
    if (finished) return;
    finished = true;
    resolve(completed);
  };
  if (t.reducedMotion) {
    targets.apply(LIFTED_STATE);
    finish(true);
    return { done, cancel: () => undefined };
  }
  const start = clock.now();
  targets.apply(FLAT_STATE);
  const frame = () => {
    if (finished) return;
    const state = liftStateAt(clock.now() - start, t);
    targets.apply(state);
    if (state.phase === "done") finish(true);
    else handle = clock.request(frame);
  };
  handle = clock.request(frame);
  return {
    done,
    cancel: () => {
      if (finished) return;
      clock.cancel(handle);
      finish(false);
    },
  };
}
