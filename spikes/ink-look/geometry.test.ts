import { describe, expect, it } from "vitest";
import { buildGeometry, config, makeFixture, project, svgContours } from "./geometry";
describe("flat-to-relief geometry", () => {
  it("retains contour heights and leaves horizontal projection unchanged through the lift", () => {
    const { segments } = buildGeometry(makeFixture());
    expect(segments.length).toBeGreaterThan(0);
    for (const { a, b } of segments) {
      expect(a[2]).toBe(b[2]);
      expect(a[2] % config.contourIntervalM).toBe(0);
      for (const p of [a, b]) {
        expect(project(p, 0)[0]).toBe(project(p, 1)[0]);
        expect(project(p, 1)[1] - project(p, 0)[1]).toBeCloseTo((p[2] / 220) * 0.9, 10);
      }
    }
  });
  it("makes no contours for a flat field, including exact interval heights", () => {
    expect(buildGeometry(new Float32Array(config.gridSize ** 2).fill(48)).segments).toEqual([]);
  });
  it("exports SVG endpoints through the same projection", () => {
    const a: [number, number, number] = [0, 0, 12],
      b: [number, number, number] = [1, 1, 12];
    expect(svgContours([{ a, b, index: true }])).toContain("M500 656L500 304");
  });
});
