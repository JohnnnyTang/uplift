/**
 * @hachure/ink/transition — the drawing → sketch → lift → colour entrance (owner decision 2, 2026-11-09;
 * slowed and given its construction sketch by owner request, D-W6-6H).
 *
 * An entrance effect, not a process: the finished textbook drawing is held on the page; a pencil then
 * constructs the block in the air above it, stroke by stroke (`@hachure/ink/stage` reads the strokes from
 * the block it is about to show); the block lifts off the paper into that sketch, drawn in ink (paper-white
 * fill, ink edges and hachures), with weight and a small settle; then natural colour and shading wash in.
 * There is no geometric correspondence between the drawing and the block, and the effect never touches
 * model state; it only sets presentation values.
 *
 * ```
 * hold     ████████                                    the complete drawing, still
 * sketch           ░▒▓█████████                        pencil strokes drawn in order; drawing recedes
 * lift                         ▒▓██████▇▇██            block height 0 → 1 (+ settle), ink on, pencil fades
 * colour                                   ░▒▒▓▓███    colour 0 → 1, hachures soften
 * ```
 *
 * Reduced motion immediately shows the finished scene; nothing moves.
 * The state is a pure function of elapsed time (`transitionStateAt`), so it is deterministic and testable,
 * and replaying is simply running it again. A reader is never made to wait: `TransitionRun.finish()` jumps
 * to the finished scene, and `skipOnInput` calls it on the first key press or pointer press.
 */

export interface TransitionTiming {
  /** The complete drawing is held still on the page (unit: milliseconds). */
  readonly holdMs: number;
  /** The construction sketch is drawn in the air, stroke by stroke (unit: milliseconds). */
  readonly sketchMs: number;
  /** The block lifts off the paper and settles (unit: milliseconds). */
  readonly liftMs: number;
  /** Colour and shading wash in after the lift (unit: milliseconds). */
  readonly colourMs: number;
  /** How far the block rises past its height before it settles (unit: none, fraction of full relief). */
  readonly liftOvershoot: number;
  /** @deprecated Retained for source compatibility; reduced motion is immediate. Unit: milliseconds. */
  readonly crossfadeMs: number;
  /** Final opacity of the ink hachures once colour is in (unit: none, 0–1). */
  readonly restingHachure: number;
  readonly reducedMotion: boolean;
}

export const DEFAULT_TRANSITION_TIMING: TransitionTiming = Object.freeze({
  holdMs: 2400,
  sketchMs: 2600,
  liftMs: 2200,
  colourMs: 1300,
  liftOvershoot: 0.03,
  crossfadeMs: 450,
  restingHachure: 0.22,
  reducedMotion: false,
});

export type TransitionPhase = "drawing" | "hold" | "sketch" | "lift" | "colour" | "crossfade" | "done";

/** Phases of the full entrance, in order. */
export const TRANSITION_PHASES = ["hold", "sketch", "lift", "colour", "done"] as const;

export interface TransitionState {
  readonly phase: TransitionPhase;
  /** Opacity of the DOM line drawing (unit: none, 0–1). */
  readonly drawingOpacity: number;
  /** How sketchy the drawing's lines are (unit: none, 0 = clean, 1 = fully broken up). */
  readonly drawingRoughness: number;
  /** Opacity of the 3D canvas (unit: none, 0–1). */
  readonly sceneOpacity: number;
  /** How much of the construction sketch has been drawn, in stroke order (unit: none, 0–1). */
  readonly sketch: number;
  /** Opacity of the construction sketch (unit: none, 0–1). */
  readonly pencil: number;
  /**
   * Block height as a fraction of full relief (unit: none, 0 = flat on the paper, 1 = full). Briefly above
   * 1 while the block settles.
   */
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
  sketch: 0,
  pencil: 0,
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
    sketch: 1,
    pencil: 0,
    rise: 1,
    ink: 1,
    hachure: timing.restingHachure,
    colour: 1,
  };
}

/** Total duration (unit: milliseconds). */
export function transitionDurationMs(timing: TransitionTiming = DEFAULT_TRANSITION_TIMING): number {
  return timing.reducedMotion ? 0 : timing.holdMs + timing.sketchMs + timing.liftMs + timing.colourMs;
}

/** When each phase of the full entrance starts (unit: milliseconds from the start). */
export function transitionPhaseStartsMs(
  timing: TransitionTiming = DEFAULT_TRANSITION_TIMING,
): Readonly<Record<(typeof TRANSITION_PHASES)[number], number>> {
  const sketch = timing.holdMs;
  const lift = sketch + timing.sketchMs;
  const colour = lift + timing.liftMs;
  return { hold: 0, sketch, lift, colour, done: colour + timing.colourMs };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** How far the lift's oscillation has died away by its end (unit: none; e^−LIFT_DECAY of its start). */
const LIFT_DECAY = 6.5;
/** The sketch is complete this far through its phase; the rest is a beat before the lift (unit: none). */
const SKETCH_DRAWN_BY = 0.92;
/** How much of its opacity the drawing loses while the sketch is built over it (unit: none). */
const DRAWING_RECEDES = 0.55;

/**
 * The lift as a weight on a spring: at rest at 0, it gathers speed, passes its height by `overshoot` and
 * settles at 1. `t` is 0–1 of the lift; the result is exactly 0 at 0 and 1 at 1.
 */
export function liftCurve(t: number, overshoot: number): number {
  const x = clamp01(t);
  const o = Math.min(0.5, Math.max(0, overshoot));
  return springStep(x, o) + (1 - springStep(1, o)) * x;
}

function springStep(u: number, o: number): number {
  if (o < 1e-6) {
    // No overshoot: critically damped.
    const w = LIFT_DECAY * 1.6;
    return 1 - Math.exp(-w * u) * (1 + w * u);
  }
  const ln = Math.log(o);
  const zeta = -ln / Math.hypot(Math.PI, ln);
  const w = LIFT_DECAY / zeta;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * u) * (Math.cos(wd * u) + ((zeta * w) / wd) * Math.sin(wd * u));
}

type MutableState = { -readonly [K in keyof TransitionState]: TransitionState[K] };

/** Pure snapshot for callers outside the animation loop. */
export function transitionStateAt(
  elapsedMs: number,
  timing: TransitionTiming = DEFAULT_TRANSITION_TIMING,
): TransitionState {
  return updateState(elapsedMs, timing, { ...DRAWING_STATE });
}

/** Reuses the runner's state; no per-frame objects or geometry. */
function updateState(ms: number, timing: TransitionTiming, out: MutableState): TransitionState {
  Object.assign(out, DRAWING_STATE);
  if (ms < 0) return out;
  const sketch = timing.holdMs;
  const lift = sketch + timing.sketchMs;
  const colour = lift + timing.liftMs;
  if (timing.reducedMotion || ms >= colour) {
    out.phase = "done";
    out.drawingOpacity = 0;
    out.sceneOpacity = 1;
    out.sketch = 1;
    out.rise = 1;
    out.ink = 1;
    out.hachure = timing.restingHachure;
    out.colour = 1;
    if (!timing.reducedMotion && ms < colour + timing.colourMs) {
      const t = smooth((ms - colour) / timing.colourMs);
      out.phase = "colour";
      out.hachure = 1 - (1 - timing.restingHachure) * t;
      out.colour = t;
    }
  } else if (ms < sketch) out.phase = "hold";
  else if (ms < lift) {
    const t = (ms - sketch) / timing.sketchMs;
    out.phase = "sketch";
    out.sceneOpacity = 1;
    out.sketch = clamp01(t / SKETCH_DRAWN_BY);
    out.pencil = smooth(t * 20);
    out.drawingOpacity = 1 - DRAWING_RECEDES * smooth(t);
    out.drawingRoughness = 0.3 * smooth(t);
  } else {
    const t = (ms - lift) / timing.liftMs;
    out.phase = "lift";
    out.sceneOpacity = 1;
    out.sketch = 1;
    out.pencil = 1 - smooth((t - 0.3) / 0.45);
    out.rise = liftCurve(t, timing.liftOvershoot);
    out.ink = smooth(t * 6);
    out.hachure = out.ink;
    out.drawingOpacity = (1 - DRAWING_RECEDES) * (1 - smooth(t / 0.3));
    out.drawingRoughness = 0.3 + 0.7 * smooth(t / 0.3);
  }
  return out;
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
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

/** Maximum presentation-time advance per frame (milliseconds); stalls must not erase phases. */
const MAX_PRESENTATION_FRAME_MS = 100;

/** Plays the transition on a bounded presentation clock (unlike the exact-time sampler), calling `apply` once per frame with a reused read-only state. Copy it to retain a snapshot. Replay by calling again. */
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
  let previous = clock.now();
  let elapsedMs = 0;
  const state: MutableState = { ...DRAWING_STATE };
  apply(updateState(0, t, state));
  const frame = () => {
    if (finished) return;
    const now = clock.now();
    // Presentation time pauses across render stalls so an expensive frame cannot erase a whole phase.
    elapsedMs += Math.min(MAX_PRESENTATION_FRAME_MS, Math.max(0, now - previous));
    previous = now;
    const previousPhase = state.phase;
    updateState(elapsedMs, t, state);
    // The held drawing is unchanged; do not queue invisible GPU work on every clock tick.
    if (state.phase !== "hold" || previousPhase !== "hold") apply(state);
    if (state.phase === "done") stop(true);
    else handle = clock.request(frame);
  };
  if (state.phase === "done") stop(true);
  else handle = clock.request(frame);
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

/**
 * Lets the reader skip the entrance: the first pointer press or key press on `target` (default: the
 * document) jumps `run` to the finished scene. The press itself still reaches its control, so pressing Play
 * during the entrance both ends it and plays. Every key skips, including Tab; default focus movement is preserved. Returns a function that stops listening; listening also
 * stops by itself when the run ends.
 */
export function skipOnInput(
  run: TransitionRun,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener"> = document,
): () => void {
  const stop = () => {
    target.removeEventListener("pointerdown", onInput, true);
    target.removeEventListener("click", onInput, true);
    target.removeEventListener("keydown", onInput, true);
  };
  const onInput = () => {
    stop();
    run.finish();
  };
  target.addEventListener("pointerdown", onInput, true);
  target.addEventListener("click", onInput, true);
  target.addEventListener("keydown", onInput, true);
  void run.done.then(stop);
  return stop;
}

/** Presentation-only departure: wash to ink, lower to the paper, restore the flat drawing. */
export function returnToDrawingStateAt(
  progress: number,
  from: TransitionState = sceneState(),
): TransitionState {
  const p = clamp01(progress);
  if (p >= 1) return DRAWING_STATE;
  const wash = smooth(p / 0.32);
  const lower = smooth((p - 0.2) / 0.65);
  const dissolve = smooth((p - 0.62) / 0.38);
  return {
    ...from,
    phase: "drawing",
    colour: from.colour * (1 - wash),
    hachure: (from.hachure + (1 - from.hachure) * wash) * (1 - dissolve),
    rise: from.rise * (1 - lower),
    ink: from.ink * (1 - dissolve),
    pencil: from.pencil * (1 - dissolve),
    drawingRoughness: 0,
    drawingOpacity: from.drawingOpacity + (1 - from.drawingOpacity) * dissolve,
    sceneOpacity: from.sceneOpacity * (1 - dissolve),
  };
}

export function runReturnToDrawing(
  apply: (state: TransitionState) => void,
  from: TransitionState,
  options: { readonly reducedMotion?: boolean; readonly signal?: AbortSignal } = {},
  clock: TransitionClock = browserClock(),
): TransitionRun {
  let handle = -1,
    finished = false,
    elapsed = 0,
    previous = clock.now();
  let resolve!: (completed: boolean) => void;
  const done = new Promise<boolean>((r) => (resolve = r));
  const stop = (completed: boolean) => {
    if (finished) return;
    finished = true;
    clock.cancel(handle);
    options.signal?.removeEventListener("abort", finish);
    resolve(completed);
  };
  const finish = () => {
    if (finished) return;
    apply(DRAWING_STATE);
    stop(true);
  };
  const frame = () => {
    if (finished) return;
    const now = clock.now();
    elapsed += Math.min(MAX_PRESENTATION_FRAME_MS, Math.max(0, now - previous));
    previous = now;
    apply(returnToDrawingStateAt(elapsed / 850, from));
    if (elapsed >= 850) stop(true);
    else handle = clock.request(frame);
  };
  options.signal?.addEventListener("abort", finish, { once: true });
  if (options.reducedMotion || options.signal?.aborted || from.sceneOpacity === 0) finish();
  else handle = clock.request(frame);
  return { done, finish, cancel: () => stop(false) };
}
