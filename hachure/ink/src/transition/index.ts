/**
 * @hachure/ink/transition — the drawing → ink → colour reveal (owner decision 2, 2026-11-09).
 *
 * An entrance effect, not a process: the textbook drawing goes sketchy and fades, the 3D block rises off
 * the paper drawn in ink (paper-white fill, ink edges and hachures), then natural colour and shading wash
 * in. There is no geometric correspondence between the drawing and the block, and the effect never touches
 * model state; it only sets presentation values.
 *
 * Phases overlap so the whole effect is one continuous move of about three seconds:
 *
 * ```
 * drawing  ██████▓▓▓▒▒░░                       roughness ↑, opacity ↓
 * rise           ░▒▒▓▓▓████████                block height 0 → 1, ink on
 * colour                       ░▒▒▓▓▓████      colour 0 → 1, hachures soften
 * ```
 *
 * Reduced motion replaces it with a short crossfade from the drawing to the finished scene; nothing moves.
 * The state is a pure function of elapsed time (`transitionStateAt`), so it is deterministic and testable,
 * and replaying is simply running it again.
 */

export interface TransitionTiming {
  /** Drawing goes sketchy and fades (unit: milliseconds). */
  readonly sketchMs: number;
  /** Delay from the start until the block begins to rise (unit: milliseconds). */
  readonly riseDelayMs: number;
  /** Block rises from the paper (unit: milliseconds). */
  readonly riseMs: number;
  /** Colour and shading wash in after the rise (unit: milliseconds). */
  readonly colourMs: number;
  /** Crossfade used instead under reduced motion (unit: milliseconds). */
  readonly crossfadeMs: number;
  /** Final opacity of the ink hachures once colour is in (unit: none, 0–1). */
  readonly restingHachure: number;
  readonly reducedMotion: boolean;
}

export const DEFAULT_TRANSITION_TIMING: TransitionTiming = Object.freeze({
  sketchMs: 800,
  riseDelayMs: 300,
  riseMs: 1300,
  colourMs: 1100,
  crossfadeMs: 450,
  restingHachure: 0.22,
  reducedMotion: false,
});

export type TransitionPhase = "drawing" | "sketch" | "rise" | "colour" | "done";

export interface TransitionState {
  readonly phase: TransitionPhase;
  /** Opacity of the DOM line drawing (unit: none, 0–1). */
  readonly drawingOpacity: number;
  /** How sketchy the drawing's lines are (unit: none, 0 = clean, 1 = fully broken up). */
  readonly drawingRoughness: number;
  /** Opacity of the 3D canvas (unit: none, 0–1). */
  readonly sceneOpacity: number;
  /** Block height as a fraction of full relief (unit: none, 0 = flat on the paper, 1 = full). */
  readonly rise: number;
  /** Opacity of ink edges (unit: none, 0–1). */
  readonly ink: number;
  /** Opacity of ink hachures on the slopes (unit: none, 0–1). */
  readonly hachure: number;
  /** Colour wash from paper to natural colour (unit: none, 0–1). */
  readonly colour: number;
}

/** Before the transition: the drawing alone. */
export const DRAWING_STATE: TransitionState = Object.freeze({
  phase: "drawing",
  drawingOpacity: 1,
  drawingRoughness: 0,
  sceneOpacity: 0,
  rise: 0,
  ink: 0,
  hachure: 0,
  colour: 0,
});

/** After the transition: the finished scene. `hachure` follows the timing's resting value. */
export function sceneState(timing: TransitionTiming = DEFAULT_TRANSITION_TIMING): TransitionState {
  return {
    phase: "done",
    drawingOpacity: 0,
    drawingRoughness: 0,
    sceneOpacity: 1,
    rise: 1,
    ink: 1,
    hachure: timing.restingHachure,
    colour: 1,
  };
}

/** Total duration (unit: milliseconds). */
export function transitionDurationMs(timing: TransitionTiming = DEFAULT_TRANSITION_TIMING): number {
  return timing.reducedMotion ? timing.crossfadeMs : timing.riseDelayMs + timing.riseMs + timing.colourMs;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Ease-out with a small settle: the block lifts briskly and lands softly. */
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** The presentation state `elapsedMs` after the transition starts. */
export function transitionStateAt(
  elapsedMs: number,
  timing: TransitionTiming = DEFAULT_TRANSITION_TIMING,
): TransitionState {
  if (elapsedMs < 0) return DRAWING_STATE;
  const end = sceneState(timing);
  if (timing.reducedMotion) {
    if (elapsedMs >= timing.crossfadeMs) return end;
    const t = smooth(elapsedMs / timing.crossfadeMs);
    return { ...end, phase: "sketch", drawingOpacity: 1 - t, sceneOpacity: t };
  }
  if (elapsedMs >= transitionDurationMs(timing)) return end;
  const sketch = clamp01(elapsedMs / timing.sketchMs);
  const riseT = (elapsedMs - timing.riseDelayMs) / timing.riseMs;
  const colourT = (elapsedMs - timing.riseDelayMs - timing.riseMs) / timing.colourMs;
  const phase: TransitionPhase = colourT >= 0 ? "colour" : riseT >= 0 ? "rise" : "sketch";
  return {
    phase,
    drawingRoughness: smooth(sketch * 1.4),
    drawingOpacity: 1 - smooth((elapsedMs - timing.sketchMs * 0.25) / (timing.sketchMs * 0.75)),
    sceneOpacity: smooth(riseT * 4),
    rise: easeOut(riseT),
    ink: smooth(riseT * 4),
    hachure: riseT < 0 ? 0 : 1 - (1 - timing.restingHachure) * smooth(colourT),
    colour: smooth(colourT),
  };
}

/** Animation clock; `performance.now` and `requestAnimationFrame` in the browser, injected in tests. */
export interface TransitionClock {
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export interface TransitionRun {
  /** Resolves `true` when the transition completes or is skipped to the end, `false` if cancelled. */
  readonly done: Promise<boolean>;
  /** Stops where it is. */
  cancel(): void;
  /** Jumps to the finished scene. */
  finish(): void;
}

function browserClock(): TransitionClock {
  return {
    now: () => performance.now(),
    request: (callback) => requestAnimationFrame(() => callback()),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

/** Plays the transition, calling `apply` once per frame with the current state. Replay by calling again. */
export function runTransition(
  apply: (state: TransitionState) => void,
  timing: Partial<TransitionTiming> = {},
  clock: TransitionClock = browserClock(),
): TransitionRun {
  const t: TransitionTiming = { ...DEFAULT_TRANSITION_TIMING, ...timing };
  let handle = -1;
  let finished = false;
  let resolve!: (completed: boolean) => void;
  const done = new Promise<boolean>((r) => (resolve = r));
  const stop = (completed: boolean) => {
    if (finished) return;
    finished = true;
    clock.cancel(handle);
    resolve(completed);
  };
  const start = clock.now();
  apply(transitionStateAt(0, t));
  const frame = () => {
    if (finished) return;
    const state = transitionStateAt(clock.now() - start, t);
    apply(state);
    if (state.phase === "done") stop(true);
    else handle = clock.request(frame);
  };
  handle = clock.request(frame);
  return {
    done,
    cancel: () => stop(false),
    finish: () => {
      if (finished) return;
      apply(sceneState(t));
      stop(true);
    },
  };
}
