import { describe, expect, it } from "vitest";
import { clampBookView } from "./book-stage";

describe("bounded camera zoom", () => {
  it("never zooms out beyond the fitted view or beyond the inspection limit", () => {
    for (const zoom of [-Infinity, -1, 0, 1, 1.25, 1.5, 100, Infinity, NaN]) {
      const pose = clampBookView({ tiltDeg: 48, orbitDeg: 12, zoom });
      expect(pose.zoom).toBeGreaterThanOrEqual(1);
      expect(pose.zoom).toBeLessThanOrEqual(1.5);
      expect(pose.tiltDeg).toBe(48);
      expect(pose.orbitDeg).toBe(12);
    }
    expect(clampBookView({ tiltDeg: 48, orbitDeg: 0, zoom: 1.25 }).zoom).toBe(1.25);
  });
});
