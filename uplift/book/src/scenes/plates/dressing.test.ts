import { describe, expect, it } from "vitest";
import { toBlockGrid } from "@hachure/ink/stage";
import { createPlatesRelief } from "./relief/index";
import {
  drainage,
  drawnSlopeHachures,
  lakeLevels,
  platesDressingRules,
  scarpLines,
  streamPaths,
} from "./dressing";
import { DEFAULT_DRESSING } from "@hachure/ink/stage";

const relief = createPlatesRelief();
const grid = (b: "convergent" | "divergent" | "transform", s: number) => toBlockGrid(relief.relief(b, s));
const centre = (relief.config.grid.columns - 1) / 2;
/** Stream segments that cross the boundary column. */
const crossings = (paths: number[][]) => {
  let n = 0;
  for (const p of paths)
    for (let i = 0; i + 3 < p.length; i += 2) if ((p[i]! - centre) * (p[i + 2]! - centre) <= 0) n++;
  return n;
};

describe("plates dressing rules (read the field, never change it)", () => {
  it("draws a stream in every valley that crosses the boundary at the start", () => {
    const g = grid("transform", 0);
    const paths = streamPaths(g, drainage(g), 140, g.along - 1);
    const valleys = Math.floor(
      (relief.config.grid.rows * relief.config.grid.metresPerCell) / relief.config.start.ridgeSpacingM,
    );
    expect(crossings(paths)).toBeGreaterThanOrEqual(valleys - 1);
  });

  it("keeps the streams crossing the transform fault when the offset is largest", () => {
    const g = grid("transform", 1);
    expect(crossings(streamPaths(g, drainage(g), 140, g.along - 1))).toBeGreaterThanOrEqual(6);
  });

  it("routes every cell to the block's edge, downhill or across a filled hollow", () => {
    const g = grid("divergent", 1);
    const d = drainage(g);
    for (let k = 0; k < d.receiver.length; k++) {
      const r = d.receiver[k]!;
      if (r >= 0) expect(d.filledM[r]!).toBeLessThanOrEqual(d.filledM[k]!);
      expect(d.filledM[k]!).toBeGreaterThanOrEqual(g.bedM[k]! - 1e-3);
    }
  });

  it("puts lakes only on dropped ground (the rift floor), below their spill level", () => {
    for (const s of [0, 1])
      for (const b of ["convergent", "transform"] as const) {
        const g = grid(b, s);
        expect(
          lakeLevels(g, drainage(g), { minDepthM: 40, maxDepthM: 70, droppedBelowM: -150 }, g.along - 1),
        ).toBeNull();
      }
    const g = grid("divergent", 1);
    const d = drainage(g);
    const levels = lakeLevels(g, d, { minDepthM: 40, maxDepthM: 70, droppedBelowM: -150 }, g.along - 1);
    expect(levels).not.toBeNull();
    let wet = 0;
    levels!.forEach((v, k) => {
      if (!Number.isFinite(v)) return;
      wet++;
      expect(g.layerOffsetM![k]!).toBeLessThan(-150);
      expect(v).toBeGreaterThan(g.bedM[k]!);
      // Spill level of its hollow (filled flats rise by a millimetre a step, hence the small margin).
      expect(v).toBeLessThanOrEqual(d.filledM[k]! + 1);
    });
    expect(wet).toBeGreaterThan(0);
  });

  it("finds the rift's fault scarps as lines, and none for the range or the transform", () => {
    const rift = grid("divergent", 1);
    const lines = scarpLines(rift, 45, rift.along - 1);
    expect(lines.length).toBe(2 * relief.config.divergent.scarpsPerSide);
    for (const l of lines) expect(l.length / 2).toBeGreaterThan(rift.along * 0.9);
    expect(scarpLines(grid("convergent", 1), 45, 159)).toEqual([]);
    expect(scarpLines(grid("transform", 1), 45, 159)).toEqual([]);
    expect(scarpLines(grid("divergent", 0), 45, 159)).toEqual([]);
  });

  it("hachures steep ground as drawn: scarps and range flanks, not the starting lowland", () => {
    expect(drawnSlopeHachures(grid("divergent", 1), 4, 38, 2, 159).length).toBeGreaterThan(0);
    expect(drawnSlopeHachures(grid("convergent", 1), 4, 38, 2, 159).length).toBeGreaterThan(0);
    const start = drawnSlopeHachures(grid("convergent", 0), 4, 38, 2, 159).length;
    expect(start).toBeLessThan(drawnSlopeHachures(grid("divergent", 1), 4, 38, 2, 159).length);
  });

  it("draws few streams on the rift floor: only large catchments start there (owner look note)", () => {
    const g = grid("divergent", 1);
    const d = drainage(g);
    const all = streamPaths(g, d, 140, g.along - 1);
    const fewer = streamPaths(g, d, 140, g.along - 1, { droppedBelowM: -150, minDrainageCells: 1200 });
    const onFloor = (paths: number[][]) =>
      paths.filter((p) => {
        const k = Math.round(p[1]!) * g.across + Math.round(p[0]!);
        return g.layerOffsetM![k]! < -150;
      }).length;
    expect(onFloor(fewer)).toBeLessThan(onFloor(all));
    expect(onFloor(fewer)).toBeLessThanOrEqual(3);
    // The streams crossing from the shoulders are kept.
    expect(fewer.length).toBeGreaterThanOrEqual(all.length - onFloor(all));
  });

  it("draws no lakes in the production look, and at most maxLakes when asked", () => {
    const g = grid("divergent", 1);
    const rules = platesDressingRules({ reliefScale: 4 });
    expect(rules.lakes!(g, DEFAULT_DRESSING, g.along - 1)).toBeNull();
    const o = { minDepthM: 40, maxDepthM: 70, droppedBelowM: -150 };
    const count = (levels: Float32Array | null) => new Set([...(levels ?? [])].filter(Number.isFinite)).size;
    const one = lakeLevels(g, drainage(g), { ...o, maxLakes: 1 }, g.along - 1);
    expect(count(one)).toBe(1);
    expect(count(lakeLevels(g, drainage(g), o, g.along - 1))).toBeGreaterThanOrEqual(count(one));
  });

  it("puts no hachures on the starting ridges at the production threshold (no rows of dots)", () => {
    expect(drawnSlopeHachures(grid("transform", 0), 4, 46, 2, 159).length).toBe(0);
    expect(drawnSlopeHachures(grid("divergent", 1), 4, 46, 2, 159).length).toBeGreaterThan(0);
    expect(drawnSlopeHachures(grid("convergent", 1), 4, 46, 2, 159).length).toBeGreaterThan(0);
  });

  it("is deterministic and leaves the grid untouched", () => {
    const g = grid("divergent", 0.6);
    const before = Float32Array.from(g.bedM);
    const rules = platesDressingRules({ reliefScale: 4, faultTraceColumn: () => centre });
    const a = JSON.stringify([
      rules.streams!(g, DEFAULT_DRESSING, 159),
      rules.inkLines!(g, DEFAULT_DRESSING, 159),
    ]);
    const b = JSON.stringify([
      rules.streams!(g, DEFAULT_DRESSING, 159),
      rules.inkLines!(g, DEFAULT_DRESSING, 159),
    ]);
    expect(a).toBe(b);
    expect(g.bedM).toEqual(before);
    expect(rules.river!(g, DEFAULT_DRESSING)).toEqual([]);
  });

  it("draws the fault trace only when the page asks for one", () => {
    const g = grid("transform", 1);
    let trace: number | null = null;
    const rules = platesDressingRules({ reliefScale: 4, faultTraceColumn: () => trace });
    expect(rules.inkLines!(g, DEFAULT_DRESSING, 159)).toEqual([]);
    trace = centre;
    const lines = rules.inkLines!(g, DEFAULT_DRESSING, 120);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points.length / 2).toBe(121);
  });
});
