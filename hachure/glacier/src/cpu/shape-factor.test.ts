import { describe, expect, it } from "vitest";
import { computeShapeFactor, createShapeFactorScratch } from "./shape-factor";

/** A straight channel along x: bed z(j) across, flat ice surface at `surfaceM`, flow down-x. */
function channel(nx: number, ny: number, dx: number, z: (j: number) => number, surfaceM: number) {
  const bed = new Float64Array(nx * ny);
  const ice = new Float64Array(nx * ny);
  const surface = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      // A gentle down-valley slope so the flow direction (and the across-flow direction) is defined.
      const tilt = -0.05 * i * dx;
      bed[k] = z(j) + tilt;
      ice[k] = Math.max(0, surfaceM - z(j));
      surface[k] = bed[k]! + ice[k]!;
    }
  }
  const f = new Float64Array(nx * ny);
  computeShapeFactor(
    { nx, ny, dx, bed, surface, ice, minIce: 1, searchCells: 14 },
    f,
    createShapeFactorScratch(14, nx * ny),
  );
  return { f, ice, row: (j: number) => f[j * nx + Math.floor(nx / 2)]! };
}

describe("lateral-drag shape factor", () => {
  it("is 1 under a wide flat slab (plain shallow ice recovered)", () => {
    const { row } = channel(12, 40, 50, () => 0, 200);
    for (let j = 10; j < 30; j++) expect(row(j)).toBeCloseTo(1, 6);
  });

  it("shields the bottom of a V: the axis has a lower factor than the lower walls", () => {
    const ny = 41;
    const { row } = channel(12, ny, 40, (j) => Math.abs(j - 20) * 40 * Math.tan((40 * Math.PI) / 180), 300);
    expect(row(20)).toBeLessThan(0.8);
    expect(row(20)).toBeLessThan(row(17));
    // The resulting stress f·H peaks off-axis, the Harbor et al. (1988) pattern.
    const H = (j: number) => 300 - Math.abs(j - 20) * 40 * Math.tan((40 * Math.PI) / 180);
    const stress = (j: number) => row(j) * H(j);
    const peak = [16, 17, 18, 19].some((j) => stress(j) > stress(20));
    expect(peak).toBe(true);
  });

  it("stays within [0, 1] and is 1 where there is no ice", () => {
    const { f, ice } = channel(12, 41, 40, (j) => 0.02 * (j - 20) ** 2 * 40, 120);
    for (let k = 0; k < f.length; k++) {
      expect(f[k]).toBeGreaterThanOrEqual(0);
      expect(f[k]).toBeLessThanOrEqual(1);
      if (ice[k]! < 1) expect(f[k]).toBe(1);
    }
  });
});
