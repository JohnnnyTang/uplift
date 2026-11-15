import { describe, expect, it } from "vitest";
import { type BlockFrame, blockY, buildRibbon } from "./block-geometry";
import { toBlockGrid } from "./snapshot";
import { buildLakes, buildStreams, mergeMeshArrays } from "./water";

// D-W7-7D: extra surface water from dressing rules (several streams, standing water at a per-cell level).

const COLUMNS = 9;
const ROWS = 7;
/** A bowl: lowest in the middle (integer metres). */
const grid = toBlockGrid({
  columns: COLUMNS,
  rows: ROWS,
  metresPerCell: 100,
  bedM: Float32Array.from({ length: COLUMNS * ROWS }, (_, k) => {
    const c = k % COLUMNS;
    const r = Math.floor(k / COLUMNS);
    return 100 + 10 * Math.abs(c - 4) + 10 * Math.abs(r - 3);
  }),
});
const frame: BlockFrame = {
  across: COLUMNS,
  along: ROWS,
  metresPerCell: 100,
  baseM: 0,
  reliefScale: 2,
  cutRow: ROWS - 1,
};

describe("stream and lake geometry", () => {
  it("merges meshes, offsetting indices, and returns null when empty", () => {
    expect(mergeMeshArrays([])).toBeNull();
    expect(mergeMeshArrays([null])).toBeNull();
    const a = buildRibbon(grid, frame, [1, 1, 2, 2, 3, 3], 0.8)!;
    const m = mergeMeshArrays([a, a])!;
    const va = a.position.length / 3;
    expect(m.position.length).toBe(a.position.length * 2);
    expect(m.index.length).toBe(a.index.length * 2);
    expect(Math.min(...m.index.slice(a.index.length))).toBe(va);
    expect(Math.max(...m.index)).toBe(2 * va - 1);
  });

  it("draws each stream as one ribbon of the merged mesh, clipped at the cut", () => {
    const one = buildStreams(grid, frame, [[1, 1, 2, 2, 3, 3]], 0.8)!;
    const two = buildStreams(
      grid,
      frame,
      [
        [1, 1, 2, 2, 3, 3],
        [6, 0, 6, 2, 6, 4],
      ],
      0.8,
    )!;
    expect(two.index.length).toBe(one.index.length * 2);
    expect(buildStreams(grid, { ...frame, cutRow: 2 }, [[6, 4, 6, 5, 6, 6]], 0.8)).toBeNull();
  });

  it("puts standing water at its level over wet cells, and nothing without water", () => {
    expect(buildLakes(grid, frame, new Float32Array(COLUMNS * ROWS).fill(NaN))).toBeNull();
    const level = new Float32Array(COLUMNS * ROWS).fill(NaN);
    const centre = 3 * COLUMNS + 4;
    level[centre] = 105;
    const lake = buildLakes(grid, frame, level)!;
    expect(lake.position[centre * 3 + 1]).toBeCloseTo(blockY(frame, 105));
    // Every vertex of a neighbouring dry cell dips under its own bed, so the shore is a clean intersection.
    const dry = centre + 1;
    expect(lake.position[dry * 3 + 1]!).toBeLessThan(blockY(frame, grid.bedM[dry]!));
    expect(lake.index.length).toBe(4 * 6);
  });
});
