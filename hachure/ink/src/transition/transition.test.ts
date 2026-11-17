import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSITION_TIMING,
  DRAWING_STATE,
  TRANSITION_PHASES,
  type TransitionClock,
  type TransitionState,
  liftCurve,
  runTransition,
  sceneState,
  skipOnInput,
  transitionDurationMs,
  transitionPhaseStartsMs,
  transitionStateAt,
} from "./index";

const t = DEFAULT_TRANSITION_TIMING;
const starts = transitionPhaseStartsMs(t);

function manualClock() {
  let now = 0;
  const queue: (() => void)[] = [];
  const clock: TransitionClock = {
    now: () => now,
    request: (cb) => queue.push(cb),
    cancel: () => undefined,
  };
  return {
    clock,
    /** Runs queued frames `stepMs` apart until none is left (or `frames` have run). */
    run(stepMs: number, frames = Infinity) {
      for (let i = 0; i < frames && queue.length; i++) {
        now += stepMs;
        queue.shift()!();
      }
    },
  };
}

describe("drawing → sketch → lift → colour entrance", () => {
  it("holds the complete drawing for two to three seconds before anything moves", () => {
    expect(t.holdMs).toBeGreaterThanOrEqual(2000);
    expect(t.holdMs).toBeLessThanOrEqual(3000);
    for (let ms = 0; ms < t.holdMs; ms += 100)
      expect(transitionStateAt(ms)).toEqual({ ...DRAWING_STATE, phase: "hold" });
  });

  it("has fixed phase timings that add up, and reduced motion is a immediate", () => {
    expect(starts).toEqual({
      hold: 0,
      sketch: t.holdMs,
      lift: t.holdMs + t.sketchMs,
      colour: t.holdMs + t.sketchMs + t.liftMs,
      done: t.holdMs + t.sketchMs + t.liftMs + t.colourMs,
    });
    expect(transitionDurationMs(t)).toBe(starts.done);
    // Slower than the 2.7 s entrance it replaces, and still under ten seconds.
    expect(transitionDurationMs(t)).toBeGreaterThan(6000);
    expect(transitionDurationMs(t)).toBeLessThan(10000);
    expect(transitionDurationMs({ ...t, reducedMotion: true })).toBe(0);
  });

  it("starts at the drawing and ends at the finished scene", () => {
    expect(transitionStateAt(-1)).toEqual(DRAWING_STATE);
    expect(transitionStateAt(transitionDurationMs(t))).toEqual(sceneState(t));
  });

  it("runs its phases in order: hold, sketch, lift in ink, then colour", () => {
    const seen: string[] = [];
    for (let ms = 0; ms <= starts.done; ms += 20) {
      const phase = transitionStateAt(ms).phase;
      if (seen.at(-1) !== phase) seen.push(phase);
    }
    expect(seen).toEqual([...TRANSITION_PHASES]);

    const sketching = transitionStateAt(starts.sketch + t.sketchMs * 0.5);
    expect(sketching.phase).toBe("sketch");
    expect(sketching.rise).toBe(0);
    expect(sketching.ink).toBe(0);
    expect(sketching.pencil).toBe(1);
    expect(sketching.sceneOpacity).toBe(1);
    expect(sketching.sketch).toBeGreaterThan(0.3);
    expect(sketching.sketch).toBeLessThan(0.8);
    // The drawing recedes under the sketch but is still there.
    expect(sketching.drawingOpacity).toBeGreaterThan(0.4);
    expect(sketching.drawingOpacity).toBeLessThan(1);

    // The sketch is complete before the block starts to lift.
    expect(transitionStateAt(starts.lift - 1).sketch).toBe(1);
    expect(transitionStateAt(starts.lift - 1).rise).toBe(0);

    const lifting = transitionStateAt(starts.lift + t.liftMs * 0.5);
    expect(lifting.phase).toBe("lift");
    expect(lifting.rise).toBeGreaterThan(0.5);
    expect(lifting.colour).toBe(0);
    expect(lifting.ink).toBe(1);
    expect(lifting.drawingOpacity).toBe(0);

    const colouring = transitionStateAt(starts.colour + t.colourMs * 0.5);
    expect(colouring.phase).toBe("colour");
    expect(colouring.rise).toBe(1);
    expect(colouring.pencil).toBe(0);
    expect(colouring.colour).toBeGreaterThan(0);
    expect(colouring.colour).toBeLessThan(1);
    expect(colouring.drawingOpacity).toBe(0);
  });

  it("is monotonic in sketch and colour, and the drawing only ever fades", () => {
    let prev = DRAWING_STATE;
    for (let ms = 0; ms <= transitionDurationMs(t); ms += 25) {
      const s = transitionStateAt(ms);
      expect(s.sketch).toBeGreaterThanOrEqual(prev.sketch - 1e-12);
      expect(s.colour).toBeGreaterThanOrEqual(prev.colour - 1e-12);
      expect(s.drawingOpacity).toBeLessThanOrEqual(prev.drawingOpacity + 1e-12);
      prev = s;
    }
  });

  it("is continuous: no presentation value jumps between frames", () => {
    let prev = transitionStateAt(0);
    for (let ms = 4; ms <= transitionDurationMs(t); ms += 4) {
      const s = transitionStateAt(ms);
      for (const key of ["drawingOpacity", "rise", "ink", "colour", "sketch", "pencil"] as const)
        expect(Math.abs(s[key] - prev[key]), `${key} at ${ms} ms`).toBeLessThan(0.05);
      // The roughness of the drawing matters only while the drawing shows.
      if (s.drawingOpacity > 0)
        expect(Math.abs(s.drawingRoughness - prev.drawingRoughness)).toBeLessThan(0.05);
      prev = s;
    }
  });

  it("lifts with weight: from rest, past its height by the overshoot, then settles exactly", () => {
    expect(liftCurve(0, t.liftOvershoot)).toBe(0);
    expect(liftCurve(1, t.liftOvershoot)).toBeCloseTo(1, 12);
    // From rest: it gathers speed, so the first hundredth of the lift covers under half a hundredth of the height.
    expect(liftCurve(0.01, t.liftOvershoot)).toBeLessThan(0.005);
    let peak = 0;
    let peakAt = 0;
    for (let x = 0; x <= 1; x += 0.001) {
      const v = liftCurve(x, t.liftOvershoot);
      if (v > peak) [peak, peakAt] = [v, x];
    }
    expect(peak - 1).toBeGreaterThan(t.liftOvershoot * 0.8);
    expect(peak - 1).toBeLessThan(t.liftOvershoot * 1.2);
    expect(peakAt).toBeGreaterThan(0.3);
    expect(peakAt).toBeLessThan(0.95);
    // Rising all the way to the peak, then only a small settle back.
    for (let x = 0.001; x <= peakAt; x += 0.001)
      expect(liftCurve(x, t.liftOvershoot)).toBeGreaterThanOrEqual(liftCurve(x - 0.001, t.liftOvershoot));
    // Without overshoot the lift never passes its height.
    for (let x = 0; x <= 1; x += 0.01) expect(liftCurve(x, 0)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it("reduced motion never moves the block or sketches: immediately finished", () => {
    const rm = { ...t, reducedMotion: true };
    for (let ms = 0; ms <= rm.crossfadeMs; ms += 50) {
      const s = transitionStateAt(ms, rm);
      expect(s).toEqual(sceneState(rm));
      expect(s.rise).toBe(1);
      expect(s.pencil).toBe(0);
      expect(s.drawingRoughness).toBe(0);
      expect(s.drawingOpacity + s.sceneOpacity).toBeCloseTo(1, 9);
    }
    expect(transitionStateAt(rm.crossfadeMs, rm)).toEqual(sceneState(rm));
  });

  it("reduced motion resolves without scheduling a frame", async () => {
    let requested = 0;
    const states: TransitionState[] = [];
    const run = runTransition(
      (s) => states.push({ ...s }),
      { reducedMotion: true },
      {
        now: () => 0,
        request: () => ++requested,
        cancel: () => undefined,
      },
    );
    expect(requested).toBe(0);
    expect(states).toEqual([sceneState()]);
    expect(await run.done).toBe(true);
  });

  it("runner applies states, can finish early, and replays from the drawing", async () => {
    const m = manualClock();
    const seen: TransitionState[] = [];
    const run = runTransition((s) => seen.push({ ...s }), {}, m.clock);
    m.run(100);
    expect(await run.done).toBe(true);
    expect(seen.at(-1)).toEqual(sceneState(t));
    const replay = runTransition((s) => seen.push({ ...s }), {}, m.clock);
    expect(seen.at(-1)!.phase).toBe("hold");
    expect(seen.at(-1)!.rise).toBe(0);
    replay.finish();
    expect(await replay.done).toBe(true);
    expect(seen.at(-1)).toEqual(sceneState(t));
    const cancelled = runTransition(() => undefined, {}, m.clock);
    cancelled.cancel();
    expect(await cancelled.done).toBe(false);
  });

  it("is deterministic: the same clock gives the same states", () => {
    const record = () => {
      const m = manualClock();
      const seen: TransitionState[] = [];
      runTransition((s) => seen.push({ ...s }), {}, m.clock);
      m.run(1000 / 60);
      return seen;
    };
    expect(record()).toEqual(record());
  });

  it("skips to the finished scene on the first pointer or key press, including Tab and modifiers", async () => {
    const key = (k: string) => Object.assign(new Event("keydown"), { key: k });
    for (const press of [
      new Event("pointerdown"),
      new Event("click"),
      key("Enter"),
      key(" "),
      key("ArrowRight"),
      key("Tab"),
      key("Shift"),
    ]) {
      const m = manualClock();
      const target = new EventTarget();
      const seen: TransitionState[] = [];
      const run = runTransition((s) => seen.push({ ...s }), {}, m.clock);
      skipOnInput(run, target);
      m.run(100, 5);
      expect(seen.at(-1)!.phase).toBe("hold");
      target.dispatchEvent(press);
      expect(seen.at(-1)).toEqual(sceneState(t));
      expect(await run.done).toBe(true);
      // Later presses do nothing: the listener is gone.
      const count = seen.length;
      target.dispatchEvent(new Event("pointerdown"));
      expect(seen.length).toBe(count);
    }
  });

  it("stops listening for a skip when the entrance ends or is cancelled", async () => {
    const m = manualClock();
    const target = new EventTarget();
    let applied = 0;
    const run = runTransition(() => applied++, {}, m.clock);
    skipOnInput(run, target);
    run.cancel();
    await run.done;
    await Promise.resolve();
    const count = applied;
    target.dispatchEvent(new Event("pointerdown"));
    expect(applied).toBe(count);
  });
});

it("render stalls cannot erase an authored phase; input can still finish immediately", async () => {
  const m = manualClock();
  const phases: string[] = [];
  const run = runTransition(
    (s) => {
      if (phases.at(-1) !== s.phase) phases.push(s.phase);
    },
    {},
    m.clock,
  );
  m.run(20000);
  expect(phases).toEqual([...TRANSITION_PHASES]);
  expect(await run.done).toBe(true);
  const skip = runTransition(() => undefined, {}, m.clock);
  m.run(20000, 1);
  skip.finish();
  expect(await skip.done).toBe(true);
});

it("the still hold applies once instead of requesting repeated invisible renders", () => {
  const m = manualClock();
  let applied = 0;
  const run = runTransition(() => applied++, {}, m.clock);
  m.run(100, 20);
  expect(applied).toBe(1);
  m.run(100, 5);
  expect(applied).toBeGreaterThan(1);
  run.cancel();
});
