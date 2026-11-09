import { describe, expect, it } from "vitest";
import {
  type ContourSet,
  DRAW_MIN_SPACING_CELLS,
  contourSegmentCount,
  drawnPoints,
  extractContours,
} from "./contours";
import { type Heightfield, heightfieldFromFunction } from "./heightfield";
import { buildTriangleIndex, quadDiagonal, sampleSurface } from "./topology";

const field = (gridSize: number, heights: number[], metresPerCell = 1): Heightfield => ({
  gridSize,
  metresPerCell,
  heightsM: Float32Array.from(heights),
});

/** Every vertex of every line lies on the triangulated surface at the line's level. */
function expectOnLevel(hf: Heightfield, contours: ContourSet, tolerance = 1e-4) {
  for (const line of contours.lines) {
    for (let i = 0; i < line.pointsM.length; i += 2) {
      expect(sampleSurface(hf, line.pointsM[i]!, line.pointsM[i + 1]!)).toBeCloseTo(
        line.levelM,
        -Math.log10(tolerance),
      );
    }
  }
}

/** Height of the uploaded mesh (index buffer) at a point, found by brute force over the square's triangles. */
function meshHeightAt(hf: Heightfield, index: Uint32Array, xM: number, yM: number): number {
  const { gridSize: n, metresPerCell: m, heightsM: h } = hf;
  const gx = xM / m - 0.5;
  const gy = yM / m - 0.5;
  const qx = Math.min(n - 2, Math.max(0, Math.floor(gx)));
  const qy = Math.min(n - 2, Math.max(0, Math.floor(gy)));
  const base = (qy * (n - 1) + qx) * 6;
  for (let t = base; t < base + 6; t += 3) {
    const v = [index[t]!, index[t + 1]!, index[t + 2]!];
    const p = v.map((i) => [i % n, Math.floor(i / n)] as const);
    const [a, b, c] = p as [readonly [number, number], readonly [number, number], readonly [number, number]];
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const w0 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / det;
    const w1 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / det;
    const w2 = 1 - w0 - w1;
    const eps = 1e-9;
    if (w0 >= -eps && w1 >= -eps && w2 >= -eps) {
      return w0 * h[v[0]!]! + w1 * h[v[1]!]! + w2 * h[v[2]!]!;
    }
  }
  throw new Error(`point (${xM}, ${yM}) not in any mesh triangle`);
}

describe("extractContours", () => {
  it("draws one closed ring per level around a single peak", () => {
    const hf = heightfieldFromFunction(33, 10, (x, y) => 100 - Math.hypot(x - 165, y - 165) * 0.5);
    const contours = extractContours(hf, 10);
    const levels = new Set(contours.lines.map((l) => l.levelM));
    expect(levels.size).toBeGreaterThan(3);
    for (const level of levels) {
      const atLevel = contours.lines.filter((l) => l.levelM === level);
      // Rings fully inside the grid are closed; the outermost may hit the edge.
      if (atLevel.every((l) => l.closed)) expect(atLevel).toHaveLength(1);
    }
    const inner = contours.lines.filter((l) => l.levelM === 90);
    expect(inner).toHaveLength(1);
    expect(inner[0]!.closed).toBe(true);
    // A closed ring does not repeat its first vertex.
    const p = inner[0]!.pointsM;
    expect(p[0] === p[p.length - 2] && p[1] === p[p.length - 1]).toBe(false);
    expectOnLevel(hf, contours);
  });

  it("finds two separate rings around two peaks", () => {
    const hf = heightfieldFromFunction(
      41,
      1,
      (x, y) =>
        10 * Math.exp(-((x - 12) ** 2 + (y - 20) ** 2) / 20) +
        10 * Math.exp(-((x - 29) ** 2 + (y - 20) ** 2) / 20),
    );
    const rings = extractContours(hf, 5).lines.filter((l) => l.levelM === 5);
    expect(rings).toHaveLength(2);
    expect(rings.every((l) => l.closed)).toBe(true);
  });

  it("ends open lines exactly on the grid edge", () => {
    // Plane rising east: contours run north–south across the whole grid.
    const hf = heightfieldFromFunction(16, 2, (x) => x * 0.5);
    const contours = extractContours(hf, 2);
    expect(contours.lines.length).toBeGreaterThan(5);
    const lo = 0.5 * 2;
    const hi = (16 - 0.5) * 2;
    for (const line of contours.lines) {
      expect(line.closed).toBe(false);
      const p = line.pointsM;
      const ends = [p[1]!, p[p.length - 1]!].sort((a, b) => a - b);
      expect(ends[0]).toBeCloseTo(lo, 9);
      expect(ends[1]).toBeCloseTo(hi, 9);
      // h = 0.5·x, so the line sits at x = 2·level.
      for (let i = 0; i < p.length; i += 2) expect(p[i]).toBeCloseTo(line.levelM * 2, 4);
    }
    expect(new Set(contours.lines.map((l) => l.levelM)).size).toBe(contours.lines.length);
  });

  it("draws nothing on a flat field, and nothing at a level equal to the maximum", () => {
    expect(extractContours(field(4, new Array(16).fill(7)), 1).lines).toHaveLength(0);
    // Max is exactly 10: the half-open rule (h ≤ L is below) means level 10 is not drawn.
    const hf = heightfieldFromFunction(8, 1, (x) => (x - 0.5) * (10 / 7));
    const levels = extractContours(hf, 5).lines.map((l) => l.levelM);
    expect(levels).toContain(5);
    expect(levels).not.toContain(10);
  });

  it("has no repeated consecutive vertices when samples sit exactly on a level", () => {
    const heights: number[] = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) heights.push(Math.abs(x - 4) + Math.abs(y - 4));
    const hf = field(9, heights);
    const contours = extractContours(hf, 1);
    expect(contours.lines.length).toBeGreaterThan(0);
    for (const line of contours.lines) {
      const p = line.pointsM;
      for (let i = 2; i < p.length; i += 2) {
        expect(p[i] === p[i - 2] && p[i + 1] === p[i - 1]).toBe(false);
      }
    }
    expectOnLevel(hf, contours);
  });

  it("flags every indexEvery-th level, counting from zero, including negative levels", () => {
    const hf = heightfieldFromFunction(12, 1, (x) => (x - 6) * 2);
    const contours = extractContours(hf, 1, { indexEvery: 5 });
    for (const line of contours.lines) {
      expect(line.index).toBe(line.levelIndex % 5 === 0);
      expect(line.levelM).toBe(line.levelIndex * 1);
    }
    expect(contours.lines.some((l) => l.index && l.levelM < 0)).toBe(true);
  });

  it("is deterministic and leaves the heightfield unchanged", () => {
    const hf = heightfieldFromFunction(24, 5, (x, y) => Math.sin(x / 17) * 20 + Math.cos(y / 11) * 15);
    const before = hf.heightsM.slice();
    const a = extractContours(hf, 3);
    const b = extractContours(hf, 3);
    expect(b).toEqual(a);
    expect(hf.heightsM).toEqual(before);
    expect(contourSegmentCount(a)).toBeGreaterThan(0);
  });

  it("rejects a non-positive interval or index spacing", () => {
    const hf = field(2, [0, 1, 2, 3]);
    expect(() => extractContours(hf, 0)).toThrow(RangeError);
    expect(() => extractContours(hf, Number.NaN)).toThrow(RangeError);
    expect(() => extractContours(hf, 1, { indexEvery: 0 })).toThrow(RangeError);
  });
});

describe("saddles: contours follow the mesh diagonal", () => {
  it("in a symmetric saddle (a tie), joins the v00–v11 pair, cutting off v10 and v01", () => {
    // v00 = 1, v10 = 0, v01 = 0, v11 = 1.
    const hf = field(2, [1, 0, 0, 1]);
    expect(quadDiagonal(1, 0, 0, 1)).toBe(0);
    const lines = extractContours(hf, 0.5).lines;
    expect(lines).toHaveLength(2);
    // Each line cuts off one low corner: its midpoint lies on that corner's side of the main diagonal.
    const sides = lines.map((l) => {
      const p = l.pointsM;
      const mx = (p[0]! + p[p.length - 2]!) / 2;
      const my = (p[1]! + p[p.length - 1]!) / 2;
      return Math.sign(mx - my);
    });
    expect(sides.sort()).toEqual([-1, 1]);
  });

  it("when the anti diagonal is flatter, joins v10–v01 and cuts off the high corners instead", () => {
    // v00 = 1, v10 = 0, v01 = 0, v11 = 0.8: |v10 − v01| = 0 < |v00 − v11| = 0.2.
    const hf = field(2, [1, 0, 0, 0.8]);
    expect(quadDiagonal(1, 0, 0, 0.8)).toBe(1);
    const lines = extractContours(hf, 0.5).lines.filter((l) => l.levelM === 0.5);
    expect(lines).toHaveLength(2);
    // Each line cuts off a high corner: v00 at (0.5, 0.5) or v11 at (1.5, 1.5).
    const cutOff = lines.map((l) => {
      const p = l.pointsM;
      const mx = (p[0]! + p[p.length - 2]!) / 2;
      const my = (p[1]! + p[p.length - 1]!) / 2;
      return mx + my < 2 ? "v00" : "v11";
    });
    expect(cutOff.sort()).toEqual(["v00", "v11"]);
  });

  it("every contour segment lies on the uploaded mesh at its level, across a field full of saddles", () => {
    // An egg-crate surface: a saddle between every pair of bumps, with both diagonal choices present.
    const hf = heightfieldFromFunction(
      40,
      3,
      (x, y) => 20 * Math.sin(x / 9) * Math.sin(y / 9) + 0.3 * Math.sin(x * 1.7 + y * 0.9),
    );
    const index = buildTriangleIndex(hf);
    const diagonals = new Set<number>();
    for (let y = 0; y < 39; y++) {
      for (let x = 0; x < 39; x++) {
        const i = y * 40 + x;
        const h = hf.heightsM;
        diagonals.add(quadDiagonal(h[i]!, h[i + 1]!, h[i + 40]!, h[i + 41]!));
      }
    }
    expect(diagonals.size).toBe(2);
    const contours = extractContours(hf, 2.5);
    let checked = 0;
    for (const line of contours.lines) {
      const p = line.pointsM;
      const count = p.length / 2;
      const segments = line.closed ? count : count - 1;
      for (let s = 0; s < segments; s++) {
        const a = s * 2;
        const b = ((s + 1) % count) * 2;
        // Endpoints and midpoint: a segment from the wrong diagonal leaves the mesh plane in between.
        for (const t of [0, 0.5, 1]) {
          const x = p[a]! + t * (p[b]! - p[a]!);
          const y = p[a + 1]! + t * (p[b + 1]! - p[a + 1]!);
          expect(Math.abs(meshHeightAt(hf, index, x, y) - line.levelM)).toBeLessThan(1e-3);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("the agreement check catches a contour drawn with the other diagonal", () => {
    // Saddle where the rule picks the main diagonal; draw the anti-diagonal contour by hand.
    const hf = field(2, [1, 0, 0.3, 0.95]);
    expect(quadDiagonal(1, 0, 0.3, 0.95)).toBe(0);
    const index = buildTriangleIndex(hf);
    // Under the anti diagonal, level 0.5 near v00 joins edge v00–v10 at (1, 0.5) to edge v00–v01 at
    // (0.5, 0.5 + 0.5 / 0.7). Its midpoint is not at height 0.5 on the real (main-diagonal) mesh.
    const mid = [(1 + 0.5) / 2, (0.5 + 0.5 + 0.5 / 0.7) / 2] as const;
    expect(Math.abs(meshHeightAt(hf, index, mid[0], mid[1]) - 0.5)).toBeGreaterThan(0.05);
    // The extracted contour, by contrast, lies on the mesh.
    const near = extractContours(hf, 0.5).lines.filter((l) => l.levelM === 0.5);
    expect(near.length).toBeGreaterThan(0);
    for (const line of near) {
      const p = line.pointsM;
      const x = (p[0]! + p[2]!) / 2;
      const y = (p[1]! + p[3]!) / 2;
      expect(Math.abs(meshHeightAt(hf, index, x, y) - 0.5)).toBeLessThan(1e-6);
    }
  });
});

describe("drawnPoints", () => {
  it("drops sub-pixel vertices but keeps grid-edge end points and exact contour vertices", () => {
    // A plane whose contours hug sample rows, producing vertices a few thousandths of a cell apart.
    // Each sample row sits just above a level (rows fall 0.5 m; levels every 0.5 m; small positive jitter).
    const hf = heightfieldFromFunction(
      20,
      10,
      (x, y) => 100.25 - y * 0.05 + 0.001 * (1.5 + Math.sin(x * 7.3)),
    );
    const contours = extractContours(hf, 0.5);
    let dropped = 0;
    for (const line of contours.lines) {
      const drawn = drawnPoints(line, DRAW_MIN_SPACING_CELLS * 10);
      dropped += line.pointsM.length - drawn.length;
      if (!line.closed) {
        expect(drawn.slice(0, 2)).toEqual(line.pointsM.slice(0, 2));
        expect(drawn.slice(-2)).toEqual(line.pointsM.slice(-2));
      }
      for (let i = 0; i < drawn.length; i += 2) {
        expect(sampleSurface(hf, drawn[i]!, drawn[i + 1]!)).toBeCloseTo(line.levelM, 4);
      }
      for (let i = 2; i < drawn.length; i += 2) {
        expect(Math.hypot(drawn[i]! - drawn[i - 2]!, drawn[i + 1]! - drawn[i - 1]!)).toBeGreaterThan(0);
      }
    }
    expect(dropped).toBeGreaterThan(0);
  });
});
