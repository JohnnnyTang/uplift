import { describe, expect, it } from "vitest";
import { BindingEngine } from "@hachure/runtime";
// 7E's lesson (D-W7-7E), through @uplift/spreads' public index (registered in 7F).
import { platesProbes, platesSpread, platesLesson as lesson } from "@uplift/spreads";
import { PLATES_LESSON_COPY as copy } from "./lesson-copy";
import { PLATES_PROBE_KINDS, platesProbeValues } from "./bindings";
import { PLATES_RELIEF_CONFIG } from "./relief/index";
import type { PlateBoundary } from "./relief/index";

// D-W7-7D × D-W7-7E: every key 7E's page reads is served by the scene, in every view state.

const STATES: { boundary: PlateBoundary | null; stage: number; ghosts: PlateBoundary[] }[] = [
  { boundary: null, stage: 0, ghosts: [] },
  { boundary: "convergent", stage: 0, ghosts: [] },
  { boundary: "divergent", stage: 0.5, ghosts: ["convergent"] },
  { boundary: "transform", stage: 1, ghosts: ["convergent", "divergent"] },
];

describe("the scene serves 7E's bindings", () => {
  it("uses the request kinds 7E declares", () => {
    for (const p of platesProbes) expect(PLATES_PROBE_KINDS).toContain(p.request.kind);
    expect(platesSpread.probes).toEqual(platesProbes);
  });

  it("gives every probe of the lesson a value at both levels and in every state", () => {
    for (const level of ["hs", "uni"] as const)
      for (const s of STATES) {
        const values = platesProbeValues(platesProbes, PLATES_RELIEF_CONFIG, copy, level, s);
        for (const p of platesProbes) expect(values, `${p.id} (${level})`).toHaveProperty(p.id);
      }
  });

  it("renders the lesson's bound texts without a gap", () => {
    const engine = new BindingEngine({ probes: platesProbes, controls: [] });
    engine.update({
      probe: platesProbeValues(platesProbes, PLATES_RELIEF_CONFIG, copy, "hs", STATES[3]!),
    });
    const texts = [
      lesson.figure.scaleNote.hs,
      lesson.textAlternatives.scale.hs,
      lesson.textAlternatives.ghosts.hs,
      ...Object.values(lesson.textAlternatives.boundary).map((t) => t.hs),
    ];
    for (const text of texts) {
      const out = engine.render(text);
      expect(out, text).not.toMatch(/—|\{\{/);
    }
    expect(engine.render(lesson.figure.scaleNote.hs)).toMatch(/×4.*×0\.75/);
    expect(engine.render("{{probe.scaleBar}}")).toMatch(/^\d+ km$/);
    expect(engine.render("{{probe.ghostNames}}")).toBe("convergent and divergent");
  });
});
