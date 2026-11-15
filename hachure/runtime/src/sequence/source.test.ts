import { describe, expect, it, vi } from "vitest";
import { type AnimationScheduler, driveSequence } from "./driver";
import { type SequenceState, createAuthoredSequence, sequenceStops } from "./source";

/** A tiny authored frame: a value that varies continuously with the stage, tagged with its sequence. */
interface Frame {
  readonly key: string;
  readonly stage: number;
  readonly heightM: Float64Array;
}

const generator = (key: string, amplitudeM: number) => (stage: number) => ({
  key,
  stage,
  heightM: Float64Array.from({ length: 8 }, (_, i) => 100 + amplitudeM * stage * Math.sin(i + 1)),
});

const make = (extra: Partial<Parameters<typeof createAuthoredSequence<Frame>>[0]> = {}) =>
  createAuthoredSequence<Frame>({
    sequences: [
      { key: "a", generate: generator("a", 900) },
      { key: "b", generate: generator("b", -400) },
      { key: "c", generate: generator("c", 50) },
    ],
    stagePerViewSecond: 0.1,
    ...extra,
  });

describe("authored-sequence source", () => {
  it("validates its options", () => {
    expect(() => createAuthoredSequence({ sequences: [], stagePerViewSecond: 1 })).toThrow(RangeError);
    const g = generator("a", 1);
    expect(() =>
      createAuthoredSequence({
        sequences: [
          { key: "a", generate: g },
          { key: "a", generate: g },
        ],
        stagePerViewSecond: 1,
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      createAuthoredSequence({ sequences: [{ key: " ", generate: g }], stagePerViewSecond: 1 }),
    ).toThrow(RangeError);
    expect(() => make({ stagePerViewSecond: 0 })).toThrow(RangeError);
    expect(() => make({ reducedMotionStops: 2 })).toThrow(RangeError);
    expect(() => make({ reducedMotionStops: 6 })).toThrow(RangeError);
    expect(sequenceStops(3)).toEqual([0, 0.5, 1]);
    expect(sequenceStops(5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("starts with no sequence chosen and shows the start frame, holding no model time", () => {
    const s = make();
    const state = s.state();
    expect(state).toMatchObject({ key: null, stage: 0, playing: false, departed: false, viewed: [] });
    expect(Object.keys(state)).not.toContain("modelTimeYr");
    expect(Object.keys(state).some((k) => /year|time|run/i.test(k))).toBe(false);
    expect(s.frame()).toMatchObject({ key: "a", stage: 0 });
    const start = { key: "start", stage: 0, heightM: new Float64Array(8) };
    expect(make({ start: () => start }).frame()).toBe(start);
    expect(s.dispatch({ kind: "play" })).toMatchObject({ kind: "unchanged" });
  });

  it("is deterministic: the same commands and view clock give the same stages and equal frames", () => {
    const trace = () => {
      const s = make();
      s.dispatch({ kind: "choose", key: "b" });
      s.dispatch({ kind: "play" });
      const out: number[] = [];
      for (const dt of [0.016, 0.017, 0.5, 0.016, 0.033, 0.016]) {
        s.advance(dt);
        out.push(s.state().stage, ...s.frame().heightM);
      }
      s.dispatch({ kind: "set-stage", stage: 0.37 });
      out.push(...s.frame().heightM);
      return out;
    };
    expect(trace()).toEqual(trace());
    const s = make();
    expect(s.frameAt("a", 0.42)).toEqual(make().frameAt("a", 0.42));
  });

  it("plays at the fixed view-clock rate, drops long gaps, and stops at the late end", () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "play" });
    s.advance(1);
    // A one-second gap is capped at maxFrameSeconds (0.25 s) of view time: no catch-up.
    expect(s.state().stage).toBeCloseTo(0.025, 12);
    for (let i = 0; i < 40; i++) s.advance(0.25);
    expect(s.state().stage).toBe(1);
    expect(s.state().playing).toBe(false);
    // Play at the end starts again from the early end.
    s.dispatch({ kind: "play" });
    expect(s.state()).toMatchObject({ stage: 0, playing: true });
  });

  it("advances continuously: each frame moves the stage by at most rate × maxFrameSeconds, monotonically", () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "play" });
    let previous = s.frame();
    let stage = 0;
    const dts = [0.016, 0.3, 0.001, 0.05, 0.25, 0.016];
    for (let i = 0; s.state().playing; i++) {
      s.advance(dts[i % dts.length]!);
      const now = s.state().stage;
      expect(now).toBeGreaterThanOrEqual(stage);
      expect(now - stage).toBeLessThanOrEqual(0.1 * 0.25 + 1e-12);
      const frame = s.frame();
      // The generator is continuous, so a bounded stage step gives a bounded change in the frame.
      for (let k = 0; k < 8; k++)
        expect(Math.abs(frame.heightM[k]! - previous.heightM[k]!)).toBeLessThanOrEqual(
          900 * (now - stage) + 1e-9,
        );
      previous = frame;
      stage = now;
    }
    expect(stage).toBe(1);
  });

  it("pauses, scrubs directly (clamped) and refuses a NaN stage", () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "play" });
    s.advance(0.2);
    s.dispatch({ kind: "pause" });
    const paused = s.state().stage;
    s.advance(0.2);
    expect(s.state().stage).toBe(paused);
    s.dispatch({ kind: "play" });
    s.dispatch({ kind: "set-stage", stage: 0.6 });
    expect(s.state()).toMatchObject({ stage: 0.6, playing: false });
    expect(s.frame()).toMatchObject({ key: "a", stage: 0.6 });
    s.dispatch({ kind: "set-stage", stage: 7 });
    expect(s.state().stage).toBe(1);
    s.dispatch({ kind: "set-stage", stage: -2 });
    expect(s.state().stage).toBe(0);
    expect(s.dispatch({ kind: "set-stage", stage: Number.NaN })).toMatchObject({ kind: "unchanged" });
    expect(() => s.frameAt("a", 1.5)).toThrow(RangeError);
    expect(() => s.frameAt("zzz", 0.5)).toThrow(RangeError);
  });

  it("choosing a sequence starts it from stage 0, paused, and re-choosing restarts it", () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "set-stage", stage: 0.8 });
    s.dispatch({ kind: "play" });
    s.dispatch({ kind: "choose", key: "b" });
    expect(s.state()).toMatchObject({ key: "b", stage: 0, playing: false, viewed: ["a", "b"] });
    s.dispatch({ kind: "set-stage", stage: 0.5 });
    s.dispatch({ kind: "choose", key: "b" });
    expect(s.state()).toMatchObject({ key: "b", stage: 0, viewed: ["a", "b"] });
    expect(s.dispatch({ kind: "choose", key: "nope" })).toMatchObject({ kind: "unchanged" });
  });

  it("steps through 3–5 discrete stops in reduced motion, dwelling at each", () => {
    const s = make({ reducedMotion: true, reducedMotionStops: 4, reducedMotionStepSeconds: 1 });
    expect(s.state().stops).toEqual([0, 1 / 3, 2 / 3, 1]);
    s.dispatch({ kind: "choose", key: "c" });
    s.dispatch({ kind: "play" });
    const seen = new Set<number>([s.state().stage]);
    for (let i = 0; i < 100 && s.state().playing; i++) {
      s.advance(0.25);
      seen.add(s.state().stage);
    }
    // Only the stops are ever shown; no in-between stage.
    expect([...seen]).toEqual([0, 1 / 3, 2 / 3, 1]);
    // From a scrubbed position, play goes to the next stop above it.
    s.dispatch({ kind: "set-stage", stage: 0.4 });
    s.dispatch({ kind: "play" });
    for (let i = 0; i < 4; i++) s.advance(0.25);
    expect(s.state().stage).toBeCloseTo(2 / 3, 12);
    // Switching the preference never moves the stage.
    s.dispatch({ kind: "pause" });
    s.dispatch({ kind: "set-reduced-motion", reduced: false });
    expect(s.state()).toMatchObject({ reducedMotion: false, stage: 2 / 3 });
  });

  it("steps to the next and previous stops from anywhere (keyboard path)", () => {
    const s = make({ reducedMotionStops: 3 });
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "step", direction: 1 });
    expect(s.state().stage).toBe(0.5);
    s.dispatch({ kind: "set-stage", stage: 0.7 });
    s.dispatch({ kind: "step", direction: -1 });
    expect(s.state().stage).toBe(0.5);
    s.dispatch({ kind: "step", direction: 1 });
    s.dispatch({ kind: "step", direction: 1 });
    expect(s.state().stage).toBe(1);
    s.dispatch({ kind: "step", direction: -1 });
    s.dispatch({ kind: "step", direction: -1 });
    s.dispatch({ kind: "step", direction: -1 });
    expect(s.state().stage).toBe(0);
  });

  it("pauses on leave and restores the sequence, stage, ghosts and play intent on return, with no catch-up", async () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "choose", key: "b" });
    s.dispatch({ kind: "play" });
    s.advance(0.25);
    const before = s.state();
    await s.pauseAndSettle();
    expect(s.state()).toMatchObject({ departed: true, playing: false });
    // Time away is not simulated, and commands that change what is shown are refused.
    for (let i = 0; i < 10; i++) s.advance(0.25);
    expect(s.dispatch({ kind: "choose", key: "c" })).toMatchObject({ kind: "unchanged" });
    expect(s.dispatch({ kind: "set-stage", stage: 0.9 })).toMatchObject({ kind: "unchanged" });
    expect(s.state()).toMatchObject({ key: "b", stage: before.stage, viewed: ["a", "b"] });
    s.resume();
    expect(s.state()).toMatchObject({ departed: false, playing: true, key: "b", stage: before.stage });
    expect(s.ghosts().map((g) => g.key)).toEqual(["a"]);
    // The first frame after returning is dropped: no hidden advance for the gap.
    s.advance(0.25);
    expect(s.state().stage).toBe(before.stage);
    s.advance(0.1);
    expect(s.state().stage).toBeCloseTo(before.stage + 0.01, 12);

    // A paused source stays paused across leave and return.
    s.dispatch({ kind: "pause" });
    await s.pauseAndSettle();
    s.resume();
    expect(s.state().playing).toBe(false);
  });

  it("looks up the other viewed sequences as ghosts at the same stage, in viewing order", () => {
    const s = make();
    s.dispatch({ kind: "choose", key: "c" });
    expect(s.ghosts()).toEqual([]);
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "choose", key: "b" });
    s.dispatch({ kind: "set-stage", stage: 0.5 });
    const ghosts = s.ghosts();
    expect(ghosts.map((g) => g.key)).toEqual(["c", "a"]);
    for (const g of ghosts) {
      expect(g.stage).toBe(0.5);
      expect(g.frame).toEqual(s.frameAt(g.key, 0.5));
      expect(g.frame.stage).toBe(0.5);
    }
    // Reset clears the choice and the viewed list, so no ghosts remain.
    s.dispatch({ kind: "reset" });
    expect(s.state()).toMatchObject({ key: null, stage: 0, viewed: [], playing: false });
    expect(s.ghosts()).toEqual([]);
  });

  it("memoises frames per key and never calls a generator while paused", () => {
    const spy = vi.fn(generator("a", 10));
    const s = createAuthoredSequence<Frame>({
      sequences: [{ key: "a", generate: spy }],
      stagePerViewSecond: 1,
    });
    s.dispatch({ kind: "choose", key: "a" });
    s.frame();
    s.frame();
    s.dispatch({ kind: "set-stage", stage: 0.3 });
    s.frame();
    s.frame();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((c) => c[0])).toEqual([0, 0.3]);
  });

  it("publishes state with a frame serial that changes exactly when the shown frame changes", () => {
    const s = make();
    const states: SequenceState[] = [];
    const off = s.subscribe((state) => states.push(state));
    s.dispatch({ kind: "choose", key: "a" });
    const afterChoose = s.state().frameSerial;
    s.dispatch({ kind: "play" });
    expect(s.state().frameSerial).toBe(afterChoose);
    s.advance(0.1);
    expect(s.state().frameSerial).toBe(afterChoose + 1);
    s.dispatch({ kind: "pause" });
    s.dispatch({ kind: "set-reduced-motion", reduced: true });
    expect(s.state().frameSerial).toBe(afterChoose + 1);
    expect(states.length).toBeGreaterThanOrEqual(4);
    off();
    const n = states.length;
    s.dispatch({ kind: "set-stage", stage: 0.9 });
    expect(states.length).toBe(n);
  });

  it("is driven by an injected animation scheduler through the same seam as the glacial host", () => {
    const queue: ((t: number) => void)[] = [];
    const scheduler: AnimationScheduler = {
      request: (cb) => queue.push(cb),
      cancel: () => undefined,
    };
    const s = make();
    s.dispatch({ kind: "choose", key: "a" });
    s.dispatch({ kind: "play" });
    const stop = driveSequence(s, scheduler);
    let t = 1000;
    for (let i = 0; i < 11; i++) {
      queue.shift()!(t);
      t += 100;
    }
    // Ten 100 ms gaps of view time at 0.1 stage per second.
    expect(s.state().stage).toBeCloseTo(0.1, 12);
    stop();
    stop();
    expect(queue.length).toBe(1);
  });

  it("ignores everything after dispose", () => {
    const s = make();
    s.dispose();
    expect(s.dispatch({ kind: "choose", key: "a" })).toMatchObject({ kind: "unchanged" });
    expect(() => s.advance(0.1)).not.toThrow();
  });
});
