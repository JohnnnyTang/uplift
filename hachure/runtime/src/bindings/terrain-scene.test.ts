import { describe, expect, it } from "vitest";
import { resolveTerrainConfig, SECONDS_PER_YEAR } from "@hachure/terrain";
import { terrainSceneBindings } from "./terrain-scene";
const calibration = {
  status: "approved",
  recordId: "test-record",
  approver: "test-reviewer",
  approvedAt: "test-date",
} as const;
const scene = { stepsPerRealSecond: 10, durations: { predict: { simYears: 100 } } };

describe("terrain scene labels", () => {
  it("suppresses every landscape-year value without approval, regardless of factor", () => {
    const config = resolveTerrainConfig({ morphAccelerationFactor: 100_000_000 });
    const result = terrainSceneBindings({ config, scene, stepCount: 100 });
    for (const key of [
      "timeScale",
      "timeScaleLabel",
      "simYearsPerRealSecond",
      "simYearsElapsed",
      "duration.predict",
    ])
      expect(result[key]).toBe("Landscape time not calibrated");
    expect(result.metresPerCell).toBe("10 m");
    expect(result.scaleBar).toBe("1,280 m");
  });
  it("derives speed, elapsed time, durations and scale labels from the same config", () => {
    const config = resolveTerrainConfig({
      dtSimSeconds: 1,
      morphAccelerationFactor: SECONDS_PER_YEAR,
      gridSize: 8,
      metresPerCell: 2,
    });
    const normal = terrainSceneBindings({ config, scene, stepCount: 25, calibration });
    const fast = terrainSceneBindings({ config, scene, stepCount: 25, speed: 2, paused: true, calibration });
    expect(normal.timeScale).toBe("1 s ≈ 10 years");
    expect(fast.timeScale).toBe("1 s ≈ 20 years (paused)");
    expect(fast.simYearsElapsed).toBe("≈ 25 years");
    expect(fast["duration.predict"]).toBe("≈ 100 years");
    expect(fast.scaleBar).toBe("16 m");
  });
  it("requires complete approval metadata and valid clock inputs", () => {
    const config = resolveTerrainConfig();
    expect(
      terrainSceneBindings({ config, scene, stepCount: 0, calibration: { ...calibration, recordId: "" } })
        .timeScale,
    ).toBe("Landscape time not calibrated");
    expect(() => terrainSceneBindings({ config, scene, stepCount: -1 })).toThrow();
    expect(() => terrainSceneBindings({ config, scene, stepCount: 0, speed: NaN })).toThrow();
  });
});
