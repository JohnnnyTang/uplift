import { describe, expect, it } from "vitest";
import { extractHachures } from "./hachures";
import { heightfieldFromFunction } from "./heightfield";
import { sampleSurface } from "./topology";

const plane = (slopeDeg: number) =>
  heightfieldFromFunction(30, 10, (_x, y) => 100 - y * Math.tan((slopeDeg * Math.PI) / 180));

describe("extractHachures", () => {
  it("draws nothing on flat ground or below the minimum slope", () => {
    expect(extractHachures(heightfieldFromFunction(20, 10, () => 5)).count).toBe(0);
    expect(extractHachures(plane(2)).count).toBe(0);
  });

  it("points every stroke downslope, with both ends on the surface", () => {
    const hf = plane(20);
    const { strokesM, count } = extractHachures(hf);
    expect(count).toBeGreaterThan(0);
    for (let k = 0; k < count; k++) {
      const [x0, y0, h0, x1, y1, h1] = strokesM.subarray(k * 6, k * 6 + 6);
      expect(h1!).toBeLessThan(h0!); // upslope end first
      expect(Math.abs(x1! - x0!)).toBeLessThan(1e-9); // the plane falls due south
      expect(y1!).toBeGreaterThan(y0!);
      expect(sampleSurface(hf, x0!, y0!)).toBeCloseTo(h0!, 9);
      expect(sampleSurface(hf, x1!, y1!)).toBeCloseTo(h1!, 9);
    }
  });

  it("is denser and longer on steeper ground", () => {
    const gentle = extractHachures(plane(5));
    const steep = extractHachures(plane(30));
    expect(steep.count).toBeGreaterThan(gentle.count);
    const length = (s: Float64Array) => Math.hypot(s[3]! - s[0]!, s[4]! - s[1]!);
    expect(length(steep.strokesM)).toBeGreaterThan(length(gentle.strokesM));
  });

  it("is deterministic", () => {
    const hf = heightfieldFromFunction(40, 5, (x, y) => 30 * Math.sin(x / 40) * Math.cos(y / 30));
    expect(extractHachures(hf).strokesM).toEqual(extractHachures(hf).strokesM);
  });
});
