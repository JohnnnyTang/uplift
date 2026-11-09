import { describe, expect, it, vi } from "vitest";
import type { BindingDefinitions } from "./engine";
import { BindingEngine } from "./engine";
import { formatBoundNumber } from "./format";
import { assertNoTypedNumbers } from "./assert-no-typed-numbers";

const definitions: BindingDefinitions = {
  probes: [
    {
      id: "out",
      shape: "scalar",
      request: { kind: "budget" },
      label: { hs: "Out", uni: "Out" },
      unit: "m³",
      significantFigures: 2,
    },
    {
      id: "profile",
      shape: "series",
      request: { kind: "long-profile" },
      label: { hs: "Profile", uni: "Profile" },
      unit: "m",
      significantFigures: 3,
    },
  ],
  controls: [
    {
      kind: "slider",
      id: "rain",
      param: "rainMmPerHr",
      label: { hs: "Rain", uni: "Rain" },
      levels: ["hs", "uni"],
      min: 0,
      max: 50,
      step: 1,
      default: 10,
      unit: "mm/h",
    },
  ],
  durationIds: ["predict"],
};

describe("binding engine", () => {
  it("formats numeric scene values and resolves the time-scale alias", () => {
    const engine = new BindingEngine(definitions);
    engine.update({
      scene: { metresPerCell: 10, gridSize: 128, "duration.predict": 100, timeScale: "Pending calibration" },
    });
    expect(
      engine.render(
        "{{scene.metresPerCell}}, {{scene.gridSize}}, {{scene.duration.predict}}, {{scene.timeScaleLabel}}",
      ),
    ).toBe("10 m, 128 cells, 100 years, Pending calibration");
  });
  it("parses repeated, spaced and nested bindings and formats them with declared units", () => {
    const engine = new BindingEngine(definitions);
    engine.update({
      probe: { out: 12.34 },
      scene: { timeScaleLabel: "Landscape time not calibrated", "duration.predict": "Pending calibration" },
    });
    expect(
      engine.render(
        "Rain {{ control.rain }}. Out {{probe.out}} / {{probe.out}}. {{scene.timeScaleLabel}}. {{scene.duration.predict}}.",
      ),
    ).toBe("Rain 10 mm/h. Out 12 m³ / 12 m³. Landscape time not calibrated. Pending calibration.");
  });
  it("updates subscribers once per published sample, only when their displayed text changes", () => {
    const engine = new BindingEngine(definitions);
    const listener = vi.fn();
    const stop = engine.subscribeText("Out {{probe.out}}", listener);
    expect(listener).toHaveBeenLastCalledWith("Out —");
    engine.update({ probe: { out: 1 }, control: { rain: 20 } });
    expect(listener).toHaveBeenLastCalledWith("Out 1 m³");
    engine.update({ probe: { out: 1.001 } });
    engine.update({ control: { rain: 30 } });
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    engine.update({ probe: { out: 2 } });
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed, unknown and series bindings and atomically rejects bad samples", () => {
    const engine = new BindingEngine(definitions);
    for (const text of [
      "{{probe}}",
      "{{probe.profile}}",
      "{{probe.nope}}",
      "{{scene.nope}}",
      "{{wrong.rain}}",
      "{{control.nope}}",
      "{{probe.out",
    ])
      expect(() => engine.render(text)).toThrow();
    expect(() => engine.update({ control: { rain: 25 }, probe: { out: Infinity } })).toThrow();
    expect(engine.render("{{control.rain}}")).toBe("10 mm/h");
  });
});

describe("number formatting", () => {
  it.each([
    [12345, "m", 3, "12,300 m"],
    [0.000012345, "m³/s", 3, "0.0000123 m³/s"],
    [-0, "1", 3, "0"],
    [-1.2345, "m", 2, "-1.2 m"],
  ] as const)("formats %s with units and precision", (value, unit, digits, expected) => {
    expect(formatBoundNumber(value, unit, digits)).toBe(expected);
  });
  it("rejects nonfinite values and invalid precision", () => {
    expect(() => formatBoundNumber(NaN)).toThrow();
    expect(() => formatBoundNumber(1, "m", 0)).toThrow();
  });
});

describe("no typed page numbers", () => {
  it("allows bindings, V-shaped, dimension names and chemical notation", () => {
    expect(() =>
      assertNoTypedNumbers({
        hs: "A V-shaped valley in 3D, CO2 and H2O.",
        uni: "{{scene.duration.predict}}; first watch {{probe.out}}.",
      }),
    ).not.toThrow();
  });
  it.each([
    "Run for 10,000 years",
    "Down 0.5 m",
    "The 1st run",
    "A 2nd step",
    "3rd place",
    "Flow 10km",
    "A 20% slope",
  ])("catches %s", (text) => {
    expect(() => assertNoTypedNumbers(text)).toThrow("Page numbers must be bindings");
  });
  it("reports the level and offending value", () => {
    expect(() => assertNoTypedNumbers({ hs: "Watch", uni: "Over 100 years" })).toThrow("uni: 100");
  });
});
