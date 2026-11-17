import { describe, expect, it } from "vitest";
import {
  type BookFurniture,
  type StageGeometry,
  cssProjectBookPoint,
  fitBookScale,
  projectedBookBounds,
} from "./camera-match";

/** The 6G book: laid out 1040 px wide, tilted 48°, on a 1366 × 768 desk below the controls. */
const desk = (widthPx: number, heightPx: number, bookHeight = 860): StageGeometry => ({
  widthPx,
  heightPx,
  perspectivePx: Math.round(Math.max(widthPx, heightPx) * 1.25),
  book: { x: (widthPx - 1040) / 2, y: (heightPx - bookHeight) / 2, width: 1040, height: bookHeight },
  tiltDeg: 48,
  pivotHeightPx: 1040 * 0.06,
});
const furniture: BookFurniture = { sidePx: 40, topPx: 280, bottomPx: 18, depthPx: 54 };
const insets = { top: 14, right: 60, bottom: 14, left: 60 };

describe("contain fit of the tilted book (6G)", () => {
  it("projects the paper corners exactly as the browser draws them", () => {
    const g = { ...desk(1366, 578), viewScale: 0.8 };
    const b = projectedBookBounds(g);
    const corners = [
      cssProjectBookPoint(g, 0, 0),
      cssProjectBookPoint(g, g.book.width, 0),
      cssProjectBookPoint(g, 0, g.book.height),
      cssProjectBookPoint(g, g.book.width, g.book.height),
    ];
    expect(b.left).toBeCloseTo(Math.min(...corners.map((c) => c[0])), 6);
    expect(b.right).toBeCloseTo(Math.max(...corners.map((c) => c[0])), 6);
    expect(b.top).toBeCloseTo(Math.min(...corners.map((c) => c[1])), 6);
    expect(b.bottom).toBeCloseTo(Math.max(...corners.map((c) => c[1])), 6);
  });

  it("finds the largest scale that keeps the book and its furniture inside the insets", () => {
    for (const [w, h] of [
      [1366, 578],
      [1440, 710],
      [1920, 890],
      [2560, 1250],
    ] as const) {
      const g = desk(w, h);
      const s = fitBookScale(g, insets, furniture, 0.4, 2);
      const inside = projectedBookBounds({ ...g, viewScale: s }, furniture);
      expect(inside.left).toBeGreaterThanOrEqual(insets.left - 1e-6);
      expect(inside.right).toBeLessThanOrEqual(w - insets.right + 1e-6);
      expect(inside.top).toBeGreaterThanOrEqual(insets.top - 1e-6);
      expect(inside.bottom).toBeLessThanOrEqual(h - insets.bottom + 1e-6);
      // One step larger touches an edge: the fit is tight, not merely safe.
      const over = projectedBookBounds({ ...g, viewScale: s * 1.01 }, furniture);
      expect(
        over.left < insets.left ||
          over.right > w - insets.right ||
          over.top < insets.top ||
          over.bottom > h - insets.bottom,
      ).toBe(true);
    }
  });

  it("grows the book with the desk and is deterministic", () => {
    const small = fitBookScale(desk(1366, 578), insets, furniture);
    const large = fitBookScale(desk(2560, 1250), insets, furniture);
    expect(large).toBeGreaterThan(small * 1.8);
    expect(fitBookScale(desk(1366, 578), insets, furniture)).toBe(small);
  });

  it("clamps to the bounds", () => {
    expect(fitBookScale(desk(200, 150), insets, furniture, 0.4, 2)).toBe(0.4);
    expect(fitBookScale(desk(9000, 9000), insets, furniture, 0.4, 2)).toBe(2);
  });
});
