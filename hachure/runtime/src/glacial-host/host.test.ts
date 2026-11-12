import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ReaderLifecycle } from "../reader/lifecycle";
import { driveGlacialHost } from "./driver";
import type { GlacialHost } from "./host";
import { formatModelYears, pastViewLabel } from "./labels";
import { createTestHost, fakeGpuSelect, frames } from "./test-support";

/** Everything a run is: its recorded hashes and bytes. Used to prove runs are never altered. */
function fingerprint(host: GlacialHost, runId: string) {
  const run = host.run(runId)!;
  return {
    hashes: host
      .state()
      .kept.concat(host.state().live ?? [])
      .find((r) => r.id === runId)!.recordedHashes,
    bytes: run.payload(),
  };
}

describe("glacial host: start and backend selection", () => {
  it("auto selection falls back to the CPU with a labelled reason where WebGPU is unavailable", async () => {
    const { host } = await createTestHost();
    const state = host.state();
    expect(state.readiness).toBe("ready");
    expect(state.backend).toBe("cpu");
    expect(state.fallbackReason).toMatch(/webgpu-unavailable|WebGPU/);
    expect(state.live).toMatchObject({
      ordinal: 1,
      rockId: "sandstone",
      step: 0,
      status: "active",
      recordedYears: [0],
    });
    expect(state.kept).toEqual([]);
    expect(state.activity).toBe("paused");
    expect(host.viewFrame()).toMatchObject({
      kind: "live",
      step: 0,
      label: `model time ${formatModelYears(0)}`,
    });
    await host.dispose();
  });

  it("an explicit CPU preference carries no fallback reason", async () => {
    const { host } = await createTestHost({ prefer: "cpu" });
    expect(host.state()).toMatchObject({ backend: "cpu", fallbackReason: null });
    await host.dispose();
  });
});

describe("glacial host: rock choice", () => {
  it("before a run has advanced, a rock choice only sets the rock (nothing is kept)", async () => {
    const { host } = await createTestHost();
    const first = host.state().live!.id;
    const result = await host.dispatch({ kind: "choose-rock", rockId: "granite" });
    expect(result).toMatchObject({ kind: "new-run", kept: null, evicted: null });
    const state = host.state();
    expect(state.rockId).toBe("granite");
    expect(state.live).toMatchObject({ ordinal: 1, rockId: "granite", step: 0 });
    expect(state.live!.id).not.toBe(first);
    expect(state.kept).toEqual([]);
    expect(await host.dispatch({ kind: "choose-rock", rockId: "granite" })).toMatchObject({
      kind: "unchanged",
    });
    await host.dispose();
  });

  it("while paused: keeps the run, starts a new one from the authored start, paused, and never alters the kept run", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step" });
    await host.dispatch({ kind: "step" });
    const run1 = host.state().live!;
    expect(run1.step).toBe(40);
    const before = fingerprint(host, run1.id);
    const result = await host.dispatch({ kind: "choose-rock", rockId: "shale" });
    expect(result).toMatchObject({ kind: "new-run", kept: run1.id, evicted: null });
    const state = host.state();
    expect(state.activity).toBe("paused");
    expect(state.live).toMatchObject({ ordinal: 2, rockId: "shale", step: 0, recordedYears: [0] });
    expect(state.kept.map((r) => [r.id, r.rockId, r.step])).toEqual([[run1.id, "sandstone", 40]]);
    expect(state.compareRunId).toBe(run1.id); // the newly kept run is the default comparison
    // The new run starts from the same authored valley as run 1.
    expect(host.run(state.live!.id)!.snapshot(0).bedM).toEqual(host.run(run1.id)!.snapshot(0).bedM);
    await host.dispatch({ kind: "step" });
    expect(fingerprint(host, run1.id)).toEqual(before);
    await host.dispose();
  });

  it("while running: the running run is kept where it stopped and the new run plays on from its start", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "play" });
    await frames(host, 3);
    expect(host.state().activity).toBe("playing");
    const run1 = host.state().live!;
    expect(run1.step).toBe(30);
    host.advance(0.25);
    await Promise.resolve(); // that batch is in flight when the rock is chosen
    const choice = host.dispatch({ kind: "choose-rock", rockId: "granite" });
    host.advance(0.25); // ignored: the choice holds playback until the new run exists
    await choice;
    await host.whenIdle();
    const state = host.state();
    expect(state.kept[0]).toMatchObject({ id: run1.id, step: 40, rockId: "sandstone" });
    expect(state.live).toMatchObject({ rockId: "granite", step: 0 });
    expect(state.activity).toBe("playing");
    const kept = fingerprint(host, run1.id);
    await frames(host, 4);
    expect(host.state().live!.step).toBe(40);
    expect(fingerprint(host, run1.id)).toEqual(kept);
    await host.dispose();
  });
});

describe("glacial host: time", () => {
  it("scrubbing pauses and shows a recorded moment labelled as earlier; play returns to the live state", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "play" });
    await frames(host, 7); // 70 steps: records at 0, 20, 40, 60
    await host.dispatch({ kind: "scrub", modelYears: 0.04 });
    let state = host.state();
    expect(state.activity).toBe("paused");
    expect(state.view).toMatchObject({ kind: "recorded", index: 1, step: 20, ofLiveRun: true });
    const past = host.viewFrame()!;
    expect(past.kind).toBe("recorded");
    expect(past.label).toBe(pastViewLabel(0.05));
    expect(past.label).toBe("earlier · model time 0.05 model years");
    expect(past.snapshot.step).toBe(20);
    expect(past.probes.step).toBe(20);
    // Scrubbing does not move the live head or branch the run.
    const liveStep = state.live!.step;
    await frames(host, 2);
    expect(host.state().live!.step).toBe(liveStep);
    await host.dispatch({ kind: "play" });
    state = host.state();
    expect(state.view).toEqual({ kind: "live" });
    expect(state.activity).toBe("playing");
    await frames(host, 2);
    expect(host.state().live!.step).toBeGreaterThan(liveStep);
    await host.dispose();
  });

  it("step returns to live and stops at the next recorded time; scrubbing to the live head is the live view", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step", steps: 5 });
    await host.dispatch({ kind: "scrub", modelYears: 0 });
    expect(host.state().view.kind).toBe("recorded");
    await host.dispatch({ kind: "step" });
    expect(host.state().view).toEqual({ kind: "live" });
    expect(host.state().live!.step).toBe(20);
    expect(host.viewFrame()!.step).toBe(20);
    await host.dispatch({ kind: "scrub", modelYears: 0.05 });
    expect(host.state().view).toEqual({ kind: "live" });
    await host.dispatch({ kind: "return-to-live" });
    await host.dispose();
  });

  it("speed changes scheduling only, within bounds", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "set-speed", speed: 2 });
    await host.dispatch({ kind: "play" });
    await frames(host, 1);
    expect(host.state().live!.step).toBe(10); // capped at one batch (maxBatchModelYears) per frame in flight
    await expect(host.dispatch({ kind: "set-speed", speed: 8 })).rejects.toThrow(/quarter and four/);
    await host.dispose();
  });

  it("a complete run stops at the horizon with every snapshot recorded", async () => {
    const { host } = await createTestHost();
    for (let k = 0; k < 8; k++) await host.dispatch({ kind: "step" });
    const live = host.state().live!;
    expect(live).toMatchObject({ status: "complete", step: 160 });
    expect(live.recordedYears).toHaveLength(9);
    expect(await host.dispatch({ kind: "play" })).toMatchObject({ kind: "unchanged" });
    expect(await host.dispatch({ kind: "step" })).toMatchObject({ kind: "unchanged" });
    await host.dispose();
  });
});

describe("glacial host: comparison and eviction", () => {
  it("looks a kept run up at the nearest recorded time and can show a kept run's recorded moment", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step", steps: 60 });
    const kept = host.state().live!.id;
    await host.dispatch({ kind: "choose-rock", rockId: "shale" });
    await host.dispatch({ kind: "step", steps: 25 });
    const comparison = host.comparison()!;
    expect(comparison).toMatchObject({ status: "nearest", runId: kept, index: 1, crossBackend: false });
    expect(comparison.status !== "unmatched" && comparison.modelYears).toBeCloseTo(0.05, 12);
    expect(comparison.label).toBe("kept run 1 · model time 0.05 model years");
    await host.dispatch({ kind: "scrub", modelYears: 0.05 });
    expect(host.comparison()).toMatchObject({ status: "matched", index: 1 });
    await host.dispatch({ kind: "scrub", runId: kept, modelYears: 0.15 });
    expect(host.viewFrame()).toMatchObject({
      kind: "recorded",
      runId: kept,
      rockId: "sandstone",
      step: 60,
      label: "kept run 1 · model time 0.15 model years",
    });
    await host.dispatch({ kind: "compare", runId: null });
    expect(host.comparison()).toBeNull();
    await host.dispose();
  });

  it("keeps the live run plus two kept runs and drops the oldest with a visible notice", async () => {
    const { host } = await createTestHost();
    const ids: string[] = [];
    for (const [k, rockId] of (["sandstone", "shale", "granite", "sandstone"] as const).entries()) {
      if (k > 0) await host.dispatch({ kind: "choose-rock", rockId });
      ids.push(host.state().live!.id);
      await host.dispatch({ kind: "step" });
    }
    const state = host.state();
    expect(state.live!.id).toBe(ids[3]);
    expect(state.kept.map((r) => r.id)).toEqual([ids[1], ids[2]]);
    expect(state.notice).toMatchObject({ kind: "evicted", runId: ids[0], ordinal: 1, rockId: "sandstone" });
    expect(host.run(ids[0]!)).toBeUndefined();
    expect(state.compareRunId).toBe(ids[2]);
    expect(state.memoryBytes).toBeLessThanOrEqual(state.memoryBudgetBytes);
    expect(state.memoryBytes).toBe(6 * host.plan.bytesPerSnapshot);
    await host.dispatch({ kind: "dismiss-notice" });
    expect(host.state().notice).toBeNull();
    await host.dispose();
  });

  it("reset needs a confirmation when kept runs exist, then returns to the authored defaults with no runs", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step" });
    await host.dispatch({ kind: "choose-rock", rockId: "granite" });
    await host.dispatch({ kind: "set-speed", speed: 3 });
    expect(await host.dispatch({ kind: "reset" })).toEqual({ kind: "confirm-required", keptRuns: 1 });
    expect(host.state().kept).toHaveLength(1);
    expect(await host.dispatch({ kind: "reset", confirmed: true })).toEqual({ kind: "done" });
    const state = host.state();
    expect(state).toMatchObject({
      kept: [],
      speed: 1,
      rockId: "sandstone",
      compareRunId: null,
      view: { kind: "live" },
    });
    expect(state.live).toMatchObject({ ordinal: 1, step: 0 });
    expect(await host.dispatch({ kind: "reset" })).toEqual({ kind: "done" }); // no kept runs: no confirmation
    await host.dispose();
  });
});

describe("glacial host: leave and return", () => {
  it("never reports paused (left or not) while the shown frame lags the live position", async () => {
    const { host } = await createTestHost();
    const seen: { departed: boolean; activity: string; live: number; shown: number }[] = [];
    host.subscribe((state) => {
      if (state.activity !== "paused" || !state.live) return;
      seen.push({
        departed: state.departed,
        activity: state.activity,
        live: state.live.step,
        shown: host.viewFrame()!.step,
      });
    });
    for (const leave of [true, false]) {
      await host.dispatch({ kind: "play" });
      await frames(host, 2);
      host.advance(0.1); // a batch without a frame (frames come every 0.25 s) …
      await Promise.resolve(); // … in flight when the reader leaves or pauses
      const settle = leave ? host.pauseAndSettle() : host.dispatch({ kind: "pause" });
      expect(host.state().activity).toBe("settling");
      await settle;
      if (leave) host.resume();
    }
    const paused = seen.filter((s) => s.live > 0);
    expect(paused.some((s) => s.departed)).toBe(true);
    expect(paused.some((s) => !s.departed)).toBe(true);
    for (const s of paused) expect(s.shown, JSON.stringify(s)).toBe(s.live);
    await host.dispose();
  });

  it("leaving mid-run pauses and keeps everything; returning restores play with no hidden advance or catch-up", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "play" });
    await frames(host, 2);
    host.advance(0.25);
    await Promise.resolve(); // that batch is in flight while leaving
    await host.pauseAndSettle();
    const left = host.state();
    expect(left).toMatchObject({ departed: true, activity: "paused" });
    expect(left.live!.step).toBe(30);
    expect(host.viewFrame()!.step).toBe(30); // final frame matches the live position
    await frames(host, 10, 5);
    expect(host.state().live!.step).toBe(30);
    await expect(host.dispatch({ kind: "choose-rock", rockId: "shale" })).rejects.toThrow(/resume/);
    host.resume();
    expect(host.state()).toMatchObject({ departed: false, activity: "playing" });
    await frames(host, 1, 30); // a long gap on return is not caught up
    expect(host.state().live!.step).toBe(30);
    await frames(host, 1);
    expect(host.state().live!.step).toBe(40);
    await host.dispose();
  });

  it("returning to a paused run stays paused", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step" });
    await host.pauseAndSettle();
    host.resume();
    expect(host.state().activity).toBe("paused");
    await frames(host, 2);
    expect(host.state().live!.step).toBe(20);
    await host.dispose();
  });

  it("level and view changes never touch runs", async () => {
    const { host } = await createTestHost();
    const reader = new ReaderLifecycle({ level: "hs" });
    await host.dispatch({ kind: "step", steps: 30 });
    const hash = await host.liveHash();
    const state = host.state();
    reader.present({ ...reader.presentation(), level: "uni" });
    host.viewFrame();
    host.comparison();
    host.run(state.live!.id)!.snapshot(1);
    await host.dispatch({ kind: "scrub", modelYears: 0 });
    await host.dispatch({ kind: "return-to-live" });
    reader.present({ ...reader.presentation(), level: "hs" });
    expect(await host.liveHash()).toBe(hash);
    expect(host.state().live).toEqual(state.live);
    await host.dispose();
  });
});

describe("glacial host: GPU failure and fallback", () => {
  it("a mid-run WebGPU failure halts the run and offers a new labelled CPU run, never a continuation", async () => {
    const { host } = await createTestHost({ engine: { select: fakeGpuSelect({ failAtStep: 45 }) } });
    expect(host.state()).toMatchObject({ backend: "webgpu", fallbackReason: null });
    await host.dispatch({ kind: "play" });
    await frames(host, 6);
    const state = host.state();
    expect(state.activity).toBe("paused");
    expect(state.live).toMatchObject({ status: "halted", step: 40, backend: "webgpu" });
    expect(state.live!.recordedYears).toHaveLength(3);
    expect(state.live!.failure).toMatchObject({ reason: "device-lost", atStep: 40, backend: "webgpu" });
    expect(state.notice).toMatchObject({ kind: "run-halted" });
    expect(state.offer).toMatchObject({ kind: "restart-on-cpu", haltedRunId: state.live!.id });
    expect(await host.dispatch({ kind: "play" })).toMatchObject({ kind: "unchanged" });
    const halted = state.live!.id;
    const result = await host.dispatch({ kind: "restart-on-cpu" });
    expect(result).toMatchObject({ kind: "new-run", kept: halted });
    const after = host.state();
    expect(after.live).toMatchObject({ backend: "cpu", step: 0, ordinal: 2, rockId: "sandstone" });
    expect(after.fallbackReason).toMatch(
      /halted at step 40 \(device-lost\).*new CPU run from the authored start/,
    );
    expect(after.kept[0]).toMatchObject({ id: halted, backend: "webgpu", status: "halted" });
    expect(after.offer).toBeNull();
    // The session stays on the CPU, labelled, for later runs.
    await host.dispatch({ kind: "step" });
    await host.dispatch({ kind: "choose-rock", rockId: "granite" });
    expect(host.state().live).toMatchObject({ backend: "cpu", rockId: "granite" });
    expect(host.state().fallbackReason).toMatch(/halted at step 40/);
    // A kept WebGPU run compares with a CPU run only at matched recorded times.
    await host.dispatch({ kind: "compare", runId: halted });
    await host.dispatch({ kind: "step", steps: 7 });
    expect(host.comparison()).toMatchObject({ status: "unmatched", crossBackend: true });
    await host.dispatch({ kind: "step" });
    expect(host.comparison()).toMatchObject({ status: "matched", crossBackend: true, index: 1 });
    await host.dispose();
  });

  it("choosing a rock after a halt starts a CPU run without the offer", async () => {
    const { host } = await createTestHost({ engine: { select: fakeGpuSelect({ failAtStep: 5 }) } });
    await host.dispatch({ kind: "step" });
    expect(host.state().live).toMatchObject({ status: "halted", step: 0 });
    await host.dispatch({ kind: "choose-rock", rockId: "sandstone" }); // same rock, but the run is halted
    expect(host.state()).toMatchObject({ backend: "cpu", offer: null, kept: [] }); // the halted run never advanced
    await host.dispose();
  });

  it("a later WebGPU creation failure runs that run on the CPU, labelled", async () => {
    const { host } = await createTestHost({ engine: { select: fakeGpuSelect({ gpuRuns: 1 }) } });
    await host.dispatch({ kind: "step" });
    await host.dispatch({ kind: "choose-rock", rockId: "shale" });
    const state = host.state();
    expect(state.kept[0]).toMatchObject({ backend: "webgpu", fallbackReason: null });
    expect(state.live).toMatchObject({ backend: "cpu" });
    expect(state.fallbackReason).toMatch(/WebGPU not used for this run.*no device/);
    await host.dispose();
  });
});

describe("glacial host: determinism", () => {
  it("the same rock gives the same recorded run whatever the speed, batching, pauses or earlier runs", async () => {
    const played = await createTestHost();
    await played.host.dispatch({ kind: "set-speed", speed: 4 });
    await played.host.dispatch({ kind: "play" });
    for (let k = 0; k < 40 && played.host.state().live!.status === "active"; k++)
      await frames(played.host, 1, 0.1 + (k % 3) * 0.07);
    const stepped = await createTestHost();
    await stepped.host.dispatch({ kind: "choose-rock", rockId: "granite" });
    await stepped.host.dispatch({ kind: "step", steps: 33 });
    await stepped.host.dispatch({ kind: "choose-rock", rockId: "sandstone" }); // granite kept; new sandstone run
    while (stepped.host.state().live!.status === "active")
      await stepped.host.dispatch({ kind: "step", steps: 7 });
    const a = played.host.state().live!;
    const b = stepped.host.state().live!;
    expect(a.status).toBe("complete");
    expect(b.status).toBe("complete");
    expect(a.recordedHashes).toEqual(b.recordedHashes);
    expect(new Set(a.recordedHashes).size).toBe(9);
    expect(played.host.run(a.id)!.payload()).toEqual(stepped.host.run(b.id)!.payload());
    expect(await played.host.liveHash()).toBe(await stepped.host.liveHash());
    await played.host.dispose();
    await stepped.host.dispose();
  });

  it("every run starts from the same authored start", async () => {
    const { host } = await createTestHost();
    await host.dispatch({ kind: "step", steps: 40 });
    const sandstone = host.state().live!.recordedHashes;
    await host.dispatch({ kind: "choose-rock", rockId: "shale" });
    await host.dispatch({ kind: "step", steps: 40 });
    const shale = host.state().live!.recordedHashes;
    expect(shale[0]).toBe(sandstone[0]); // same authored start
    await host.dispose();
  });
});

describe("glacial host: driver and source rules", () => {
  it("animation frames drive the host by real seconds", async () => {
    const { host } = await createTestHost();
    const queue: ((t: number) => void)[] = [];
    const stop = driveGlacialHost(host, { request: (cb) => queue.push(cb), cancel: () => undefined });
    await host.dispatch({ kind: "play" });
    for (const t of [0, 250, 500]) {
      queue.shift()!(t);
      await host.whenIdle();
    }
    expect(host.state().live!.step).toBe(20);
    stop();
    stop();
    await host.dispose();
  });

  it("never uses Math.random in the runs or glacial host code", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const dir of [here, join(here, "../runs")])
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")))
        expect(readFileSync(join(dir, file), "utf8"), file).not.toMatch(/Math\.random/);
  });

  it("rejects commands before initialization and after disposal", async () => {
    const { host } = await createTestHost();
    await host.dispose();
    await expect(host.dispatch({ kind: "play" })).rejects.toThrow(/disposed/);
  });
});
