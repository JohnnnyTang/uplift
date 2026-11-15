import { describe, expect, it } from "vitest";
import type { Probe } from "@hachure/runtime";
import { PLATES_PLACEHOLDER_COPY as copy } from "./copy";
import { PLATES_DEFAULT_PROBES, configValue, platesProbeValues, platesSceneValues } from "./bindings";
import { PLATES_RELIEF_CONFIG, platesSceneScales } from "./relief/index";
import { PLAY_SECONDS, STAGE_STEPS, createPlatesSequence, quantiseStage } from "./sequence";
import { describeScene, stageWord } from "./words";
import { platesDrawingSvg } from "./drawing";
import { boundaryGlyphSvg } from "./scene-glyphs";

describe("stage words and the text alternative", () => {
  it("names only early, middle and late", () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(stageWord)).toEqual(["early", "early", "middle", "late", "late"]);
  });

  it("describes boundary, stage and front face, and never claims simulation or prints a figure", () => {
    for (const boundary of [null, "convergent", "divergent", "transform"] as const)
      for (const stage of [0, 0.5, 1]) {
        const text = describeScene({ boundary, stage, cutFraction: 1, ghosts: [], copy, level: "hs" });
        expect(text).not.toMatch(/simulat|comput|model|\brun\b|years?\b|\d/i);
        expect(text).toMatch(/front face/);
        if (boundary)
          expect(text).toMatch(
            new RegExp(`${copy.boundaries[boundary].name.hs} boundary, (early|middle|late) stage`),
          );
      }
    expect(
      describeScene({ boundary: "convergent", stage: 1, cutFraction: 1, ghosts: [], copy, level: "hs" }),
    ).toMatch(/root/);
    expect(
      describeScene({ boundary: "divergent", stage: 1, cutFraction: 1, ghosts: [], copy, level: "hs" }),
    ).toMatch(/thins/);
    expect(
      describeScene({ boundary: "transform", stage: 1, cutFraction: 1, ghosts: [], copy, level: "hs" }),
    ).toMatch(/unchanged/);
  });

  it("names each ghost line by its pattern and boundary", () => {
    const text = describeScene({
      boundary: "transform",
      stage: 0.75,
      cutFraction: 0.5,
      ghosts: ["convergent", "divergent"],
      copy,
      level: "hs",
    });
    expect(text).toMatch(/dotted line on the front face is the convergent profile/);
    expect(text).toMatch(/dash-dot line on the front face is the divergent profile/);
    expect(text).toMatch(/halfway/);
  });
});

describe("bindings come from the config and the state, never typed", () => {
  it("serves the scene fields", () => {
    const v = platesSceneValues(PLATES_RELIEF_CONFIG, copy, "hs", {
      boundary: "divergent",
      stage: 0.6,
      ghosts: ["convergent", "transform"],
    });
    expect(v.surfaceVerticalExaggeration).toBe(platesSceneScales(PLATES_RELIEF_CONFIG).reliefScale);
    expect(v.crustVerticalExaggeration).toBe(PLATES_RELIEF_CONFIG.display.crustVerticalExaggeration);
    expect(v.boundaryName).toBe("Divergent");
    expect(v.stageLabel).toBe("middle");
    expect(v.viewedNames).toBe("convergent and transform");
    expect(v.blockWidthKm).toBe(
      ((PLATES_RELIEF_CONFIG.grid.columns - 1) * PLATES_RELIEF_CONFIG.grid.metresPerCell) / 1000,
    );
  });

  it("serves any numeric config leaf by path, and only declared probes of its kinds", () => {
    expect(configValue(PLATES_RELIEF_CONFIG, "crust.normalThicknessM")).toBe(
      PLATES_RELIEF_CONFIG.crust.normalThicknessM,
    );
    expect(configValue(PLATES_RELIEF_CONFIG, "transform.sense")).toBeUndefined();
    expect(configValue(PLATES_RELIEF_CONFIG, "nope.x")).toBeUndefined();
    const probes: Probe[] = [
      ...PLATES_DEFAULT_PROBES,
      {
        id: "crest",
        label: { hs: "", uni: "" },
        request: { kind: "plates-config" },
        field: "convergent.rangeCrestElevationM",
        shape: "scalar",
        unit: "m",
        significantFigures: 2,
      },
      {
        id: "other",
        label: { hs: "", uni: "" },
        request: { kind: "glacier-run" },
        field: "modelYears",
        shape: "scalar",
        unit: "",
        significantFigures: 2,
      },
    ];
    const values = platesProbeValues(probes, PLATES_RELIEF_CONFIG, copy, "hs", {
      boundary: null,
      stage: 0,
      ghosts: [],
    });
    expect(values.crest).toBe(PLATES_RELIEF_CONFIG.convergent.rangeCrestElevationM);
    expect(values.boundaryName).toBe(copy.controls.noBoundary.hs);
    expect("other" in values).toBe(false);
  });
});

describe("the sequence: quantised, memoised, deterministic", () => {
  it("quantises frames without rounding the stage the page reads", () => {
    const { source } = createPlatesSequence();
    source.dispatch({ kind: "choose", key: "convergent" });
    source.dispatch({ kind: "set-stage", stage: 0.333 });
    expect(source.state().stage).toBe(0.333);
    const a = source.frame();
    source.dispatch({ kind: "set-stage", stage: 0.3349 });
    expect(source.frame()).toBe(a);
    expect(quantiseStage(0.3349)).toBe(0.33);
  });

  it("plays early to late in the configured view time, then stops", () => {
    const { source } = createPlatesSequence();
    source.dispatch({ kind: "choose", key: "divergent" });
    source.dispatch({ kind: "play" });
    for (let t = 0; t < PLAY_SECONDS * 10 + 5; t++) source.advance(0.1);
    expect(source.state()).toMatchObject({ stage: 1, playing: false });
  });

  it("gives equal frames for the same boundary and stage in two sequences", () => {
    const a = createPlatesSequence().source;
    const b = createPlatesSequence().source;
    for (const s of [a, b]) {
      s.dispatch({ kind: "choose", key: "transform" });
      s.dispatch({ kind: "set-stage", stage: 0.62 });
    }
    expect(a.frame().bedM).toEqual(b.frame().bedM);
  });

  it("prefetches the very frame the source later shows", () => {
    const seq = createPlatesSequence();
    seq.prefetch("convergent", 0.5);
    const n = seq.generated();
    seq.source.dispatch({ kind: "choose", key: "convergent" });
    seq.source.dispatch({ kind: "set-stage", stage: 0.5 });
    seq.source.frame();
    expect(seq.generated()).toBe(n);
    expect(STAGE_STEPS).toBeGreaterThanOrEqual(50);
  });
});

describe("Fig. 2, the flat drawing", () => {
  const seq = createPlatesSequence();
  const draw = (arrows: "towards" | "apart" | "along" | null) =>
    platesDrawingSvg({
      snapshot: seq.start,
      frame: seq.relief.elevationFrame(),
      reliefScale: 4,
      strataM: [-200, -800],
      arrows,
      labels: [{ feature: "boundary", text: "plate boundary" }],
    });
  it("is deterministic and labelled, with a dashed boundary and two plate arrows", () => {
    expect(draw("towards")).toBe(draw("towards"));
    const svg = draw(null);
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/class="boundary"/);
    expect(svg.match(/class="plate-arrow/g)).toHaveLength(2);
    expect(svg).toMatch(/plate boundary/);
    expect(draw("apart")).not.toBe(draw("towards"));
  });
  it("gives every boundary its own picker glyph", () => {
    const glyphs = (["convergent", "divergent", "transform"] as const).map(boundaryGlyphSvg);
    expect(new Set(glyphs).size).toBe(3);
  });
});
