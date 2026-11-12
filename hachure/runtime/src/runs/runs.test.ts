import {
  DEFAULT_GLACIER_CONFIG,
  createCpuGlacier,
  decodeCapturedRun,
  type GlacierConfig,
  resolveGlacierConfig,
} from "@hachure/glacier";
import { PROTOCOL_HORIZON_YEARS, PROTOCOL_SNAPSHOT_YEARS, START_PRESET_ID } from "@hachure/glacier/testing";
import { describe, expect, it } from "vitest";
import { GLACIAL_START } from "../glacial-host/engine";
import { TEST_MODEL, TEST_RUNS } from "../glacial-host/test-support";
import {
  DEFAULT_GLACIAL_RUN_CONFIG,
  GLACIAL_MEMORY_BUDGET_BYTES,
  RecordedRun,
  RunStore,
  encodeRunRecord,
  planGlacialRuns,
  runQuantization,
  type RunBackend,
} from "./index";

describe("run plan", () => {
  it("defaults to the registered horizon and snapshot interval, inside the memory budget", () => {
    expect(DEFAULT_GLACIAL_RUN_CONFIG.horizonYears).toBe(PROTOCOL_HORIZON_YEARS);
    expect(DEFAULT_GLACIAL_RUN_CONFIG.snapshotIntervalYears).toBe(PROTOCOL_SNAPSHOT_YEARS);
    expect(DEFAULT_GLACIAL_RUN_CONFIG.maxKeptRuns).toBe(2);
    const plan = planGlacialRuns({}, DEFAULT_GLACIER_CONFIG);
    expect(plan.recordEverySteps).toBe(8000);
    expect(plan.horizonSteps).toBe(120_000);
    expect(plan.snapshotsPerRun).toBe(16);
    expect(plan.bytesPerSnapshot).toBe(81_920);
    // D-W5-5G2: 1.31 MB per run; live + 2 kept = 3.93 MB, far inside the 32 MiB budget.
    expect(plan.worstCaseBytes).toBe(3 * 16 * 81_920);
    expect(plan.worstCaseBytes).toBeLessThan(GLACIAL_MEMORY_BUDGET_BYTES);
  });

  it("rejects intervals that are not whole steps, horizons that are not whole intervals, and over-budget plans", () => {
    expect(() => planGlacialRuns({ snapshotIntervalYears: 0.001 }, DEFAULT_GLACIER_CONFIG)).toThrow(
      /whole number of fixed steps/,
    );
    expect(() => planGlacialRuns({ horizonYears: 310 }, DEFAULT_GLACIER_CONFIG)).toThrow(
      /whole number of snapshot intervals/,
    );
    expect(() => planGlacialRuns({ memoryBudgetBytes: 3 * 16 * 81_920 - 1 }, DEFAULT_GLACIER_CONFIG)).toThrow(
      /budget/,
    );
    expect(() => planGlacialRuns({ maxKeptRuns: 1.5 }, DEFAULT_GLACIER_CONFIG)).toThrow(/maxKeptRuns/);
    expect(() => planGlacialRuns({ frameIntervalSeconds: 0.01 }, DEFAULT_GLACIER_CONFIG)).toThrow(
      /frameInterval/,
    );
  });

  it("names the authored start the captures name", () => {
    expect(GLACIAL_START.preset).toBe(START_PRESET_ID);
  });
});

const model: GlacierConfig = resolveGlacierConfig({ ...TEST_MODEL, rockId: "shale" });
const plan = planGlacialRuns(TEST_RUNS, model);

/** A real CPU run, recorded through the same encoder the engine uses. */
function recordRun(
  id: string,
  ordinal: number,
  steps: number,
  backend: RunBackend = "cpu",
  rockId = model.rockId,
) {
  const config = resolveGlacierConfig({ ...TEST_MODEL, rockId });
  const solver = createCpuGlacier(config);
  const start = solver.snapshot();
  const layers = runQuantization(start.bedM);
  const run = new RecordedRun({
    id,
    ordinal,
    rockId,
    backend,
    fallbackReason: null,
    config,
    start: GLACIAL_START,
    layers,
    snapshotIntervalYears: plan.config.snapshotIntervalYears,
    maxSnapshots: plan.snapshotsPerRun,
  });
  let index = 0;
  const record = () =>
    run.append(
      encodeRunRecord({
        index: index++,
        config,
        start: GLACIAL_START,
        layers,
        snapshotIntervalYears: plan.config.snapshotIntervalYears,
        snapshot: solver.snapshot(),
        probes: solver.probes(),
        stateHash: solver.hash(),
      }),
    );
  record();
  while (solver.step < steps) {
    solver.advance(plan.recordEverySteps);
    record();
  }
  return { run, solver };
}

describe("recorded run", () => {
  it("holds snapshots in the frozen capture format, decodable by the capture decoder", () => {
    const { run, solver } = recordRun("a", 1, 60);
    expect(run.count).toBe(4);
    expect(run.times).toEqual([0, 0.05, 0.1, 0.15].map((t) => expect.closeTo(t, 12)));
    expect(run.clampedValues).toBe(0);
    expect(run.recordedBytes).toBe(4 * plan.bytesPerSnapshot);
    const capture = decodeCapturedRun(run.manifest, run.payload());
    const last = solver.snapshot();
    for (const decoded of [run.snapshot(3), capture.snapshot(3)]) {
      expect(decoded.step).toBe(60);
      let worst = 0;
      for (let k = 0; k < last.bedM.length; k++)
        worst = Math.max(worst, Math.abs(decoded.bedM[k]! - last.bedM[k]!));
      expect(worst).toBeLessThanOrEqual(0.025 + 1e-3); // half the 0.05 m bed quantum
    }
    expect(run.manifest.finalStateHash).toBe(solver.hash());
  });

  it("finds the nearest recorded time, ties to the earlier snapshot", () => {
    const { run } = recordRun("a", 1, 60);
    expect(run.nearestIndex(0.074)).toBe(1);
    expect(run.nearestIndex(0.075)).toBe(1);
    expect(run.nearestIndex(0.076)).toBe(2);
    expect(run.nearestIndex(99)).toBe(3);
    expect(run.nearestIndex(-1)).toBe(0);
  });

  it("refuses out-of-order records, records after completion and records beyond the run's limit", () => {
    const { run } = recordRun("a", 1, 20);
    const config = run.config;
    const solver = createCpuGlacier(config);
    const bad = encodeRunRecord({
      index: 5,
      config,
      start: GLACIAL_START,
      layers: run.manifest.layers,
      snapshotIntervalYears: 0.05,
      snapshot: solver.snapshot(),
      probes: solver.probes(),
      stateHash: solver.hash(),
    });
    expect(() => run.append(bad)).toThrow(/expected snapshot 2/);
    run.complete();
    expect(() => run.append({ ...bad, index: 2 })).toThrow(/complete/);
    const full = recordRun("b", 2, plan.horizonSteps).run;
    expect(full.count).toBe(plan.snapshotsPerRun);
    expect(() => full.append({ ...bad, index: full.count, step: 10_000 })).toThrow(/already holds/);
  });
});

describe("run store", () => {
  it("keeps the previous run only if it advanced, and drops the oldest kept run beyond two", () => {
    const store = new RunStore(plan);
    const unstarted = recordRun("r0", 1, 0).run;
    expect(store.startLive(unstarted)).toEqual({ kept: null, evicted: null });
    const r1 = recordRun("r1", 1, 40).run;
    expect(store.startLive(r1)).toEqual({ kept: null, evicted: null }); // r0 had no history: replaced
    const r2 = recordRun("r2", 2, 40, "cpu", "granite").run;
    expect(store.startLive(r2).kept).toBe(r1);
    const r3 = recordRun("r3", 3, 40).run;
    store.startLive(r3);
    expect(store.kept.map((r) => r.id)).toEqual(["r1", "r2"]);
    const r4 = recordRun("r4", 4, 20).run;
    const handoff = store.startLive(r4);
    expect(handoff.evicted).toBe(r1);
    expect(store.kept.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(store.get("r1")).toBeUndefined();
    expect(store.memoryBytes()).toBe([r2, r3, r4].reduce((s, r) => s + r.recordedBytes, 0));
    expect(store.memoryBytes()).toBeLessThanOrEqual(plan.config.memoryBudgetBytes);
  });

  it("compares at the nearest recorded time, labelled with that time; across backends only at matched times", () => {
    const store = new RunStore(plan);
    const kept = recordRun("k", 1, 60).run;
    store.startLive(kept);
    const gpu = recordRun("g", 2, 60, "webgpu").run;
    store.startLive(recordRun("c", 3, 20).run); // k kept
    store.startLive(gpu); // c kept
    const near = store.compare({ runId: "c", modelYears: 0.07, backend: "cpu" }, "k");
    expect(near).toMatchObject({ status: "nearest", runId: "k", index: 1, crossBackend: false });
    expect(near?.status !== "unmatched" && near?.modelYears).toBeCloseTo(0.05, 12);
    const matched = store.compare({ runId: "g", modelYears: 0.1, backend: "webgpu" }, "k");
    expect(matched).toMatchObject({ status: "matched", index: 2, crossBackend: true });
    const unmatched = store.compare({ runId: "g", modelYears: 0.11, backend: "webgpu" }, "k");
    expect(unmatched).toMatchObject({
      status: "unmatched",
      crossBackend: true,
      nearestModelYears: expect.closeTo(0.1, 12),
    });
    expect(store.compare({ runId: "k", modelYears: 0, backend: "cpu" }, "k")).toBeNull();
    expect(store.compare({ runId: "c", modelYears: 0, backend: "cpu" }, "missing")).toBeNull();
  });
});

describe("run quantization on the registered runs", () => {
  it("every registered 300-year capture fits the quantization fixed at its start, with nothing clamped", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const dir = fileURLToPath(new URL("../../../glacier/src/testing/captured-runs/", import.meta.url));
    for (const rock of ["shale", "sandstone", "granite"]) {
      const manifest = JSON.parse(readFileSync(`${dir}${rock}.json`, "utf8"));
      const capture = decodeCapturedRun(manifest, readFileSync(`${dir}${rock}.bin`));
      const layers = runQuantization(capture.snapshot(0).bedM);
      let clamped = 0;
      for (let k = 0; k < capture.count; k++)
        clamped += encodeRunRecord({
          index: k,
          config: manifest.config,
          start: GLACIAL_START,
          layers,
          snapshotIntervalYears: manifest.snapshotIntervalYears,
          snapshot: capture.snapshot(k),
          probes: manifest.snapshots[k].probes,
          stateHash: "",
        }).clampedValues;
      expect(capture.times.at(-1)).toBe(PROTOCOL_HORIZON_YEARS);
      expect(clamped, rock).toBe(0);
    }
  });
});
