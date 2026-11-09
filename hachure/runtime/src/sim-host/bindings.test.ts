import { expect, it } from "vitest";
import { BindingEngine } from "../bindings/index";
import { publishTerrainSample } from "./bindings";
import { TerrainWorkerEngine } from "./worker-engine";

it("publishes unavailable metrics over a previous numeric value without inventing calibrated years", async () => {
  const bindings = new BindingEngine({
    controls: [
      {
        id: "rain",
        kind: "slider",
        label: { hs: "Rain", uni: "Rain" },
        levels: ["hs", "uni"],
        param: "rainMmPerHr",
        min: 0,
        max: 50,
        default: 10,
        step: 1,
        unit: "mm/h",
      },
      {
        id: "speed",
        kind: "speed",
        label: { hs: "Speed", uni: "Speed" },
        levels: ["hs", "uni"],
        min: 0.25,
        max: 4,
        default: 1,
        step: 0.25,
      },
    ],
    probes: ["incisionDepth", "sedimentOut"].map((id) => ({
      id,
      label: { hs: id, uni: id },
      request: { kind: "budget" },
      shape: "scalar",
      unit: id === "incisionDepth" ? "m" : "m³",
      significantFigures: 3,
    })),
    durationIds: ["predictSpan"],
  });
  const engine = new TerrainWorkerEngine();
  const { sample } = await engine.execute({
    kind: "init",
    config: { gridSize: 32, metresPerCell: 10 },
    calibration: { status: "failed", recordId: "test-calibration" },
  });
  expect(sample!.calibration).toEqual({ status: "failed", recordId: "test-calibration" });
  const scene = {
    preset: "tilted-plateau",
    seed: 1,
    stepsPerRealSecond: 30,
    camera: { position: [0, 1, 1] as const, target: [0, 0, 0] as const, fovDeg: 45 },
    durations: { predictSpan: { simYears: 10000 } },
  };
  publishTerrainSample(
    bindings,
    { ...sample!, probes: { incisionDepth: 2, sedimentOut: 3 } },
    scene,
    1,
    true,
  );
  expect(bindings.render("{{probe.incisionDepth}}")).toBe("2 m");
  publishTerrainSample(
    bindings,
    { ...sample!, probes: { incisionDepth: null, sedimentOut: 4 } },
    scene,
    1,
    true,
  );
  expect(bindings.render("{{probe.incisionDepth}} / {{probe.sedimentOut}}")).toBe(
    "Unavailable: unresolved sections / 4 m³",
  );
  expect(bindings.render("{{scene.timeScale}}")).toContain("Landscape time not calibrated");
  expect(bindings.render("{{scene.duration.predictSpan}}")).not.toContain("10000");
  engine.dispose();
});
