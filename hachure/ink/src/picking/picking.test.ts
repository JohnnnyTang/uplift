import { describe, expect, it } from "vitest";
import { heightfieldFromFunction } from "../heightfield";
import { createProjection, projectToViewport, terrainFrameFromHeightfield } from "../projection";
import { sampleSurface } from "../topology";
import { brushCursorPath, pickHeightfield, rayFromViewport } from "./index";

describe("terrain picking matches the displayed mesh", () => {
  const field = heightfieldFromFunction(8, 10, (x, y) => 100 + x / 5 - y / 10);
  const projection = createProjection(
    terrainFrameFromHeightfield(field),
    {},
    { widthPx: 800, heightPx: 600 },
    2,
  );
  for (const exaggeration of [0, 0.5, 1]) {
    it(`round-trips a known cell through the projection at lift ${exaggeration}`, () => {
      const [px, py] = projectToViewport(projection, 35, 45, sampleSurface(field, 35, 45), exaggeration);
      const hit = pickHeightfield(field, projection, exaggeration, rayFromViewport(projection, px, py))!;
      expect(hit.xM).toBeCloseTo(35, 10);
      expect(hit.yM).toBeCloseTo(45, 10);
      expect(hit.heightM).toBeCloseTo(102.5, 10);
      expect(hit.column).toBe(3);
      expect(hit.row).toBe(4);
    });
  }
  it("misses outside the sampled terrain and behind the ray", () => {
    expect(pickHeightfield(field, projection, 1, rayFromViewport(projection, -500, -500))).toBeNull();
    expect(pickHeightfield(field, projection, 1, { origin: [0, -100, 0], direction: [0, -1, 0] })).toBeNull();
  });
  it("selects the exact triangulated saddle rather than a bilinear approximation", () => {
    const saddle = heightfieldFromFunction(2, 10, (x, y) => (x === y ? 10 : 0));
    const p = createProjection(terrainFrameFromHeightfield(saddle), {}, { widthPx: 800, heightPx: 600 });
    const hit = pickHeightfield(saddle, p, 1, { origin: [0, 100, 0], direction: [0, -2, 0] });
    expect(hit?.heightM).toBe(10);
    expect(hit?.distanceM).toBe(90);
  });
  it("keeps a clipped brush ring finite at the terrain edge", () => {
    const path = brushCursorPath(field, projection, 1, { xM: 5, yM: 5 }, 20);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).not.toMatch(/NaN|Infinity/);
  });
  it("rejects malformed rays and incompatible frames", () => {
    expect(() => rayFromViewport(projection, NaN, 0)).toThrow(RangeError);
    expect(() => pickHeightfield(field, projection, 1, { origin: [0, 0, 0], direction: [0, 0, 0] })).toThrow(
      RangeError,
    );
    const other = heightfieldFromFunction(4, 10, () => 0);
    expect(() => pickHeightfield(other, projection, 1, rayFromViewport(projection, 0, 0))).toThrow(
      RangeError,
    );
  });
});
