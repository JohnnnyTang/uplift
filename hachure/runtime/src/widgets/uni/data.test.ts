import { describe, expect, it } from "vitest";
import { DEFAULT_TERRAIN_CONFIG, hashSnapshot } from "@hachure/terrain";
import { TerrainWorkerEngine } from "../../sim-host/worker-engine";
import {
  changedUniversityParameters,
  formatUniversityNumber,
  universityDefaults,
  universitySample,
} from "./data";

describe("university sample bindings", () => {
  it("reads the fixed route and current stocks from one sample without altering state", async () => {
    const engine = new TerrainWorkerEngine();
    const initial = (await engine.execute({ kind: "init", config: { gridSize: 16, metresPerCell: 10 } }))
      .sample!;
    const sample = (await engine.execute({ kind: "advance", steps: 4, sample: true })).sample!;
    const before = hashSnapshot(sample.snapshot);
    const data = universitySample({
      ...sample,
      paths: { baseline: initial.paths.baseline, current: { ...sample.paths.current, path: [] } },
    });
    expect(data.profile!.distanceM.at(-1)).toBeGreaterThan(0);
    const at = initial.paths.baseline.path[0]!;
    const index =
      Math.floor(at.yM / sample.snapshot.metresPerCell) * sample.snapshot.gridSize +
      Math.floor(at.xM / sample.snapshot.metresPerCell);
    expect(data.profile!.groundM[0]).toBe(
      sample.snapshot.layers.bedrockM![index]! + sample.snapshot.layers.sedimentM![index]!,
    );
    expect(data.budget.erodedM3).toBe(sample.snapshot.budget.erodedM3);
    let suspended = 0;
    for (const v of sample.snapshot.layers.suspendedSedimentM!)
      suspended += v * sample.snapshot.metresPerCell ** 2;
    expect(data.budget.suspendedM3).toBe(suspended);
    expect(hashSnapshot(sample.snapshot)).toBe(before);
  });
  it("marks a subcell route unavailable instead of inventing a full reach", async () => {
    const engine = new TerrainWorkerEngine();
    const sample = (await engine.execute({ kind: "init", config: { gridSize: 16 } })).sample!;
    const route = { ...sample.paths.baseline, path: sample.paths.baseline.path.slice(0, 1), complete: false };
    const data = universitySample({ ...sample, paths: { ...sample.paths, baseline: route } });
    expect(data.profile).toBeUndefined();
    expect(data.route.complete).toBe(false);
  });
  it("compares effective scene defaults and restores only the hidden university parameters", () => {
    const defaults = { ...DEFAULT_TERRAIN_CONFIG, erosionRatePerS: 0.37 };
    expect(changedUniversityParameters(defaults, defaults)).toEqual([]);
    const live = { ...defaults, erosionRatePerS: 0.64, rainMmPerHr: 25 };
    expect(changedUniversityParameters(live, defaults)).toEqual(["erosionRatePerS"]);
    expect(universityDefaults(defaults)).toEqual({
      capacityCoefficient: defaults.capacityCoefficient,
      erosionRatePerS: 0.37,
      depositionRatePerS: defaults.depositionRatePerS,
    });
    expect({ ...live, ...universityDefaults(defaults) }.rainMmPerHr).toBe(25);
  });
});

describe("university numerical presentation", () => {
  it("preserves tiny nonzero transfers in compact scientific notation", () => {
    expect(formatUniversityNumber(4.84e-10, "model m³")).toBe("4.84e-10 model m³");
    expect(formatUniversityNumber(0, "model m³")).toBe("0 model m³");
    expect(formatUniversityNumber(1.235, "model m³")).toBe("1.24 model m³");
  });
});
