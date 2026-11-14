/**
 * The live glacier runtime as the scene's source (5M): one command path, page and figure on the same run and
 * time (GV5), comparison at matched recorded times (GV2), and level/view never touching a run.
 * A small grid over the same footprint keeps CPU runs fast; the source logic does not depend on the grid.
 */
import { describe, expect, it } from "vitest";
import { GlacialHost } from "@hachure/runtime/glacial";
import { InProcessGlacialTransport } from "@hachure/runtime/glacial-worker";
import { createLiveSource } from "./glacial-live-source";
import { createFrameMeasures } from "../scenes/glacial/runs";

const LOOK_IDS: Record<string, number> = { shale: 0, sandstone: 1, granite: 2 };

async function liveSource() {
  const host = new GlacialHost({
    transport: new InProcessGlacialTransport(),
    prefer: "cpu",
    model: { nx: 40, ny: 16, metresPerCell: 160 },
    runConfig: {
      snapshotIntervalYears: 0.05,
      horizonYears: 0.4,
      modelYearsPerRealSecond: 0.1,
      maxBatchModelYears: 0.025,
      frameIntervalSeconds: 0.25,
    },
  });
  await host.initialize();
  return { host, source: createLiveSource(host, (key) => LOOK_IDS[key]!) };
}

describe("live source", () => {
  it("shows the live run at the authored start, measured with the model's own section probe", async () => {
    const { host, source } = await liveSource();
    const shown = source.shown();
    expect(shown).toMatchObject({ past: false, modelYears: 0, run: { rockKey: "sandstone", ordinal: 1 } });
    expect(shown.label).toBe("model time 0 model years");
    const frame = host.viewFrame()!;
    const start = host.run(frame.runId)!.snapshot(0);
    expect(shown.section(20)).toEqual(createFrameMeasures(frame.snapshot, start).section(20));
    expect(source.timeline()).toMatchObject({ times: [0], index: 0, atLive: true, playing: false });
    expect(source.backend()).toEqual({ backend: "cpu", fallbackReason: null });
    expect(source.modelConfig()!.snapshotIntervalYears).toBe(0.05);
    source.dispose();
    await host.dispose();
  });

  it("a rock choice starts a new run; the advanced run is kept and compared at the matched time", async () => {
    const { host, source } = await liveSource();
    await source.chooseRock("shale");
    expect(source.shown().run.rockKey).toBe("shale");
    expect(source.kept()).toEqual([]);
    await source.step();
    expect(source.shown().modelYears).toBeCloseTo(0.05, 9);
    const shaleRun = source.shown().run.id;
    await source.chooseRock("granite");
    expect(source.shown()).toMatchObject({ modelYears: 0, run: { rockKey: "granite", ordinal: 2 } });
    expect(source.kept().map((k) => k.id)).toEqual([shaleRun]);
    expect(source.comparedId()).toBe(shaleRun);
    expect(source.ghost()).toMatchObject({ modelYears: 0, run: { rockKey: "shale" } });
    await source.step();
    // At a recorded time the ghost is the kept run at that same model time.
    expect(source.ghost()!.modelYears).toBeCloseTo(source.shown().modelYears!, 9);
    await source.compare(null);
    expect(source.ghost()).toBeNull();
    source.dispose();
    await host.dispose();
  });

  it("scrubbing shows a recorded earlier moment; return to live; reset asks first when runs are kept", async () => {
    const { host, source } = await liveSource();
    await source.step();
    await source.step();
    expect(source.timeline().times.length).toBe(3);
    await source.scrubTo(0);
    expect(source.shown()).toMatchObject({ past: true, modelYears: 0 });
    expect(source.timeline()).toMatchObject({ atLive: false, index: 0 });
    await source.returnToLive();
    expect(source.timeline().atLive).toBe(true);
    await source.chooseRock("shale");
    expect(await source.reset(false)).toBe("confirm");
    expect(source.kept()).toHaveLength(1);
    expect(await source.reset(true)).toBe("done");
    expect(source.kept()).toEqual([]);
    expect(source.shown()).toMatchObject({ modelYears: 0, run: { rockKey: "sandstone", ordinal: 1 } });
    source.dispose();
    await host.dispose();
  });

  it("series reads every held run's recorded snapshots at the cut", async () => {
    const { host, source } = await liveSource();
    await source.step();
    await source.chooseRock("granite");
    const series = source.series(20);
    expect(series.map((s) => s.run.rockKey).sort()).toEqual(["granite", "sandstone"]);
    expect(series.find((s) => s.run.rockKey === "sandstone")!.points.map((p) => p.modelYears)).toEqual([
      0, 0.05,
    ]);
    source.dispose();
    await host.dispose();
  });
});
