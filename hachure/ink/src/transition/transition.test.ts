import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSITION_TIMING,
  DRAWING_STATE,
  type TransitionClock,
  type TransitionState,
  runTransition,
  sceneState,
  transitionDurationMs,
  transitionStateAt,
} from "./index";

const t = DEFAULT_TRANSITION_TIMING;

describe("drawing → ink → colour transition", () => {
  it("lasts two to four seconds, and reduced motion is a short crossfade", () => {
    expect(transitionDurationMs(t)).toBeGreaterThanOrEqual(2000);
    expect(transitionDurationMs(t)).toBeLessThanOrEqual(4000);
    expect(transitionDurationMs({ ...t, reducedMotion: true })).toBeLessThanOrEqual(600);
  });

  it("starts at the drawing and ends at the finished scene", () => {
    expect(transitionStateAt(-1)).toEqual(DRAWING_STATE);
    expect(transitionStateAt(transitionDurationMs(t))).toEqual(sceneState(t));
  });

  it("runs its phases in order: sketch, rise in ink, then colour", () => {
    const early = transitionStateAt(t.riseDelayMs * 0.5);
    expect(early.phase).toBe("sketch");
    expect(early.rise).toBe(0);
    expect(early.drawingRoughness).toBeGreaterThan(0);
    const rising = transitionStateAt(t.riseDelayMs + t.riseMs * 0.5);
    expect(rising.phase).toBe("rise");
    expect(rising.rise).toBeGreaterThan(0.5);
    expect(rising.colour).toBe(0);
    expect(rising.ink).toBe(1);
    const colouring = transitionStateAt(t.riseDelayMs + t.riseMs + t.colourMs * 0.5);
    expect(colouring.phase).toBe("colour");
    expect(colouring.rise).toBe(1);
    expect(colouring.colour).toBeGreaterThan(0);
    expect(colouring.colour).toBeLessThan(1);
    expect(colouring.drawingOpacity).toBe(0);
  });

  it("is monotonic in rise and colour", () => {
    let prev = DRAWING_STATE;
    for (let ms = 0; ms <= transitionDurationMs(t); ms += 25) {
      const s = transitionStateAt(ms);
      expect(s.rise).toBeGreaterThanOrEqual(prev.rise - 1e-12);
      expect(s.colour).toBeGreaterThanOrEqual(prev.colour - 1e-12);
      expect(s.drawingOpacity).toBeLessThanOrEqual(prev.drawingOpacity + 1e-12);
      prev = s;
    }
  });

  it("reduced motion never moves the block: full relief throughout the crossfade", () => {
    const rm = { ...t, reducedMotion: true };
    for (let ms = 0; ms <= rm.crossfadeMs; ms += 50) {
      const s = transitionStateAt(ms, rm);
      expect(s.rise).toBe(1);
      expect(s.drawingRoughness).toBe(0);
      expect(s.drawingOpacity + s.sceneOpacity).toBeCloseTo(1, 9);
    }
  });

  it("runner applies states, can finish early, and replays from the drawing", async () => {
    let now = 0;
    const queue: (() => void)[] = [];
    const clock: TransitionClock = {
      now: () => now,
      request: (cb) => queue.push(cb),
      cancel: () => undefined,
    };
    const seen: TransitionState[] = [];
    const run = runTransition((s) => seen.push(s), {}, clock);
    while (queue.length) {
      now += 100;
      queue.shift()!();
    }
    expect(await run.done).toBe(true);
    expect(seen.at(-1)).toEqual(sceneState(t));
    const replay = runTransition((s) => seen.push(s), {}, clock);
    expect(seen.at(-1)!.rise).toBe(0);
    replay.finish();
    expect(await replay.done).toBe(true);
    expect(seen.at(-1)).toEqual(sceneState(t));
    const cancelled = runTransition(() => undefined, {}, clock);
    cancelled.cancel();
    expect(await cancelled.done).toBe(false);
  });
});
