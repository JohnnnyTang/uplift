import { describe, expect, it } from "vitest";
import { type FrameClock, type LiftState, FLAT_STATE, LIFTED_STATE, liftStateAt, runLift } from "./lift";

const timing = { crossfadeMs: 100, liftMs: 400, reducedMotion: false };

function fakeClock() {
  let time = 0;
  let pending: (() => void) | null = null;
  const clock: FrameClock = {
    now: () => time,
    request: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  return {
    clock,
    advance(ms: number) {
      time += ms;
      const cb = pending;
      pending = null;
      cb?.();
    },
  };
}

describe("lift sequence", () => {
  it("crossfades at zero exaggeration with overlays hidden, then lifts, then shows overlays", () => {
    expect(liftStateAt(-1, timing)).toEqual(FLAT_STATE);
    const fading = liftStateAt(50, timing);
    expect(fading).toMatchObject({ phase: "crossfade", exaggeration: 0, overlays: false });
    expect(fading.canvasOpacity).toBeCloseTo(0.5);
    expect(fading.canvasOpacity + fading.flatOpacity).toBeCloseTo(1);
    const lifting = liftStateAt(300, timing);
    expect(lifting).toMatchObject({ phase: "lift", canvasOpacity: 1, flatOpacity: 0, overlays: false });
    expect(lifting.exaggeration).toBeCloseTo(0.5);
    expect(liftStateAt(500, timing)).toEqual(LIFTED_STATE);
  });

  it("raises exaggeration monotonically from 0 to 1", () => {
    let last = -1;
    for (let t = 0; t <= 520; t += 10) {
      const e = liftStateAt(t, timing).exaggeration;
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
    expect(last).toBe(1);
  });

  it("jumps to the end state in reduced-motion mode, without requesting frames", async () => {
    const applied: LiftState[] = [];
    const { clock } = fakeClock();
    const run = runLift({ apply: (s) => applied.push(s) }, { reducedMotion: true }, clock);
    await expect(run.done).resolves.toBe(true);
    expect(applied).toEqual([LIFTED_STATE]);
    expect(liftStateAt(0, { ...timing, reducedMotion: true })).toEqual(LIFTED_STATE);
  });

  it("runs frame by frame to completion, and can be cancelled", async () => {
    const applied: LiftState[] = [];
    const { clock, advance } = fakeClock();
    const run = runLift({ apply: (s) => applied.push(s) }, timing, clock);
    expect(applied[0]).toEqual(FLAT_STATE);
    for (let i = 0; i < 60; i++) advance(10);
    await expect(run.done).resolves.toBe(true);
    expect(applied.at(-1)).toEqual(LIFTED_STATE);
    expect(applied.map((s) => s.phase)).toContain("lift");

    const second = fakeClock();
    const stopped = runLift({ apply: () => undefined }, timing, second.clock);
    second.advance(10);
    stopped.cancel();
    await expect(stopped.done).resolves.toBe(false);
  });
});
