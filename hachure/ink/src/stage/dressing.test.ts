import { describe, expect, it } from "vitest";
import {
  type DressingConfig,
  cellHash,
  iceFlowLines,
  riverCells,
  slopeHachures,
  smoothPolyline,
  surfaceCover,
  treeSites,
} from "./dressing";
import { type LandscapeSnapshot, toBlockGrid } from "./snapshot";

/** A V valley along rows, floor falling downstream, with ice in the upper half. */
function valley(withIce: boolean): LandscapeSnapshot {
  const columns = 21;
  const rows = 30;
  const bedM = new Float32Array(columns * rows);
  const iceThicknessM = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const k = r * columns + c;
      bedM[k] = 1500 - r * 20 + Math.abs(c - 10) * 60;
      if (withIce && r < 15) iceThicknessM[k] = Math.max(0, 120 - Math.abs(c - 10) * 30);
    }
  return { columns, rows, metresPerCell: 50, bedM, iceThicknessM };
}

const open: DressingConfig = {
  snowlineM: 2500,
  treelineM: 1500,
  bareRockSlopeDeg: 60,
  maxTreeSlopeDeg: 60,
  treeDensity: 1,
  iceThresholdM: 1,
};

describe("dressing", () => {
  it("hash is deterministic and in [0, 1)", () => {
    expect(cellHash(3, 4, 1)).toBe(cellHash(3, 4, 1));
    for (let i = 0; i < 200; i++) {
      const h = cellHash(i, i * 7, 2);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("river starts just below the snout and follows the thalweg to the edge", () => {
    const g = toBlockGrid(valley(true));
    const path = riverCells(g);
    expect(Math.floor(path[0]! / g.across)).toBe(15);
    expect(Math.floor(path.at(-1)! / g.across)).toBe(g.along - 1);
    for (const k of path) expect(k % g.across).toBe(10);
  });

  it("river runs from the head when there is no ice", () => {
    const g = toBlockGrid(valley(false));
    expect(Math.floor(riverCells(g)[0]! / g.across)).toBe(1);
  });

  it("cover marks ice, and never puts snow or meadow on ice", () => {
    const g = toBlockGrid(valley(true));
    const cover = surfaceCover(g, { ...open, snowlineM: 1800, treelineM: 1300 });
    let iced = 0;
    for (let k = 0; k < g.bedM.length; k++)
      if (cover.ice[k]) {
        iced++;
        expect(cover.snow[k]).toBe(0);
        expect(cover.meadow[k]).toBe(0);
      }
    expect(iced).toBeGreaterThan(0);
  });

  it("trees avoid ice and the river, stay below the treeline, and are reproducible", () => {
    const g = toBlockGrid(valley(true));
    const river = new Set(riverCells(g));
    const trees = treeSites(g, open, river);
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) {
      expect(t.groundM).toBeLessThan(open.treelineM + 60);
      expect(Math.round(t.l)).toBeGreaterThan(15);
    }
    expect(treeSites(g, open, river)).toEqual(trees);
  });

  it("flow lines stay on the ice and run downstream", () => {
    const g = toBlockGrid(valley(true));
    const lines = iceFlowLines(g);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.at(-1)!).toBeGreaterThan(line[1]!);
      expect(line.at(-1)!).toBeLessThan(16);
    }
  });

  it("hachures point downslope (towards the valley centre line) and never lie on ice", () => {
    const g = toBlockGrid(valley(true));
    const h = slopeHachures(g);
    expect(h.length).toBeGreaterThan(0);
    for (let i = 0; i < h.length; i += 4) {
      const [a0, l0, a1] = [h[i]!, h[i + 1]!, h[i + 2]!];
      expect(g.iceM[l0 * g.across + a0]!).toBeLessThanOrEqual(1);
      if (a0 !== 10) expect(Math.sign(a1 - a0)).toBe(-Math.sign(a0 - 10));
    }
  });

  it("smoothing keeps the end points", () => {
    const p = smoothPolyline([0, 0, 1, 0, 1, 1, 2, 1], 2);
    expect(p.slice(0, 2)).toEqual([0, 0]);
    expect(p.slice(-2)).toEqual([2, 1]);
  });
});
