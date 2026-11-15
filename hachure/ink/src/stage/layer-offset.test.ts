import { describe, expect, it } from "vitest";
import { type BlockFrame, type MeshArrays, blockY, buildCrustSection, buildWalls } from "./block-geometry";
import {
  type BlockGrid,
  type LandscapeSnapshot,
  elevationRange,
  toBlockGrid,
  validateSnapshot,
} from "./snapshot";

// D-W7-7B2: the optional per-cell rock-layer offset. The walls draw the rock layers by `wallV`; a layer
// boundary at elevation h of the undeformed stack sits where the interpolated `wallV` equals h.

const COLUMNS = 11;
const ROWS = 6;

/** A ridge across the middle (integer metres, so every value is exact in Float32). */
function snapshot(layerOffsetM?: (c: number, r: number) => number, crust = false): LandscapeSnapshot {
  const bedM = new Float32Array(COLUMNS * ROWS);
  const crustBaseM = new Float32Array(COLUMNS * ROWS);
  const offset = new Float32Array(COLUMNS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLUMNS; c++) {
      const k = r * COLUMNS + c;
      bedM[k] = 1000 + 400 * Math.max(0, 3 - Math.abs(c - 5)) + 10 * r;
      crustBaseM[k] = bedM[k]! - 9000;
      offset[k] = layerOffsetM ? layerOffsetM(c, r) : 0;
    }
  return {
    columns: COLUMNS,
    rows: ROWS,
    metresPerCell: 1000,
    bedM,
    ...(layerOffsetM ? { layerOffsetM: offset } : {}),
    ...(crust ? { crustBaseM } : {}),
  };
}

const frameFor = (g: BlockGrid, reliefScale = 1): BlockFrame => ({
  across: g.across,
  along: g.along,
  metresPerCell: g.metresPerCell,
  baseM: -2000,
  reliefScale,
  cutRow: g.along - 1,
});

/**
 * Block Y of the layer boundary `hM` on the wall column whose top vertex is `top` (its base vertex is
 * `top + 1`), solved from the wall mesh itself: `wallV` is linear along the column.
 */
function layerY(w: MeshArrays, top: number, hM: number): number {
  const v = w.attributes.wallV!;
  const yTop = w.position[top * 3 + 1]!;
  const yBase = w.position[(top + 1) * 3 + 1]!;
  return yBase + ((hM - v[top + 1]!) / (v[top]! - v[top + 1]!)) * (yTop - yBase);
}

/** The layer boundary `hM` along the front face, one block Y per column, left to right. */
const frontLayerLine = (w: MeshArrays, g: BlockGrid, hM: number) =>
  Array.from({ length: g.across }, (_, a) => layerY(w, a * 2, hM));

/** Number of wall-column vertices (two per column on the four sides; the last four are the base). */
const columnVertices = (w: MeshArrays) => w.position.length / 3 - 4;

describe("layer offset on the snapshot seam (D-W7-7B2)", () => {
  it("is optional: without it the grid has no field and the walls draw layers by elevation, as before", () => {
    const g = toBlockGrid(snapshot());
    expect("layerOffsetM" in g).toBe(false);
    const f = frameFor(g, 3);
    const w = buildWalls(g, f, () => 0);
    const v = w.attributes.wallV!;
    // Before D-W7-7B2, wallV was the elevation of the vertex: the bed at the top, the base below.
    for (let i = 0; i < columnVertices(w); i += 2) {
      expect(v[i]).toBe(f.baseM + w.position[i * 3 + 1]! / f.reliefScale);
      expect(v[i + 1]).toBe(f.baseM);
    }
    // An all-zero offset draws exactly the same walls as no offset.
    const zero = buildWalls(toBlockGrid(snapshot(() => 0)), f, () => 0);
    expect(zero).toEqual(w);
  });

  it("never moves the block: geometry, elevation range and the other wall attributes are unchanged", () => {
    const flat = toBlockGrid(snapshot());
    const raised = toBlockGrid(snapshot((c) => 250 * c));
    expect(elevationRange(raised)).toEqual(elevationRange(flat));
    const f = frameFor(flat, 2);
    const a = buildWalls(flat, f, () => 30);
    const b = buildWalls(raised, f, () => 30);
    expect(b.position).toEqual(a.position);
    expect(b.normal).toEqual(a.normal);
    expect(b.index).toEqual(a.index);
    expect(b.attributes.depthM).toEqual(a.attributes.depthM);
    expect(b.attributes.soilM).toEqual(a.attributes.soilM);
    expect(b.attributes.wallV).not.toEqual(a.attributes.wallV);
  });

  it("a uniform offset shifts every layer boundary by exactly the offset times the exaggeration", () => {
    const offsetM = 500;
    for (const reliefScale of [1, 3]) {
      const flat = toBlockGrid(snapshot());
      const raised = toBlockGrid(snapshot(() => offsetM));
      const f = frameFor(flat, reliefScale);
      const a = buildWalls(flat, f, () => 0);
      const b = buildWalls(raised, f, () => 0);
      for (const hM of [-1500, -400, 0, 700]) {
        for (let i = 0; i < columnVertices(a); i += 2) {
          expect(layerY(a, i, hM)).toBeCloseTo(blockY(f, hM), 6);
          expect(layerY(b, i, hM) - layerY(a, i, hM)).toBeCloseTo(offsetM * reliefScale, 6);
        }
      }
    }
  });

  it("a step offset (a fault) steps the layer lines on the front face, and only at the fault", () => {
    const dropM = 800;
    const g = toBlockGrid(snapshot((c) => (c >= 6 ? -dropM : 0)));
    const f = frameFor(g, 2);
    const line = frontLayerLine(
      buildWalls(g, f, () => 0),
      g,
      -1000,
    );
    for (let a = 0; a < g.across; a++)
      expect(line[a]).toBeCloseTo(blockY(f, -1000 + (a >= 6 ? -dropM : 0)), 6);
    const steps = line.slice(1).map((y, a) => y - line[a]!);
    steps.forEach((d, a) => expect(d).toBeCloseTo(a === 5 ? -dropM * f.reliefScale : 0, 6));
  });

  it("a raised range bends the layers up under it, following the offset cell by cell", () => {
    const upM = (c: number) => 300 * Math.max(0, 3 - Math.abs(c - 5));
    const g = toBlockGrid(snapshot(upM));
    const f = frameFor(g, 4);
    const line = frontLayerLine(
      buildWalls(g, f, () => 0),
      g,
      0,
    );
    for (let a = 0; a < g.across; a++) expect(line[a]).toBeCloseTo(blockY(f, upM(a)), 6);
    expect(Math.max(...line)).toBe(line[5]);
  });

  it("is resampled with the bed for every orientation, and validated for length", () => {
    const s = snapshot((c, r) => 7 * c + 100 * r);
    for (const orientation of [
      { valleyAxis: "rows", downstream: "decreasing" },
      { valleyAxis: "columns", downstream: "increasing" },
    ] as const) {
      const byBed = toBlockGrid({ ...s, bedM: s.layerOffsetM! }, orientation);
      expect(toBlockGrid(s, orientation).layerOffsetM).toEqual(byBed.bedM);
    }
    expect(() => validateSnapshot({ ...s, layerOffsetM: new Float32Array(5) })).toThrow(/layerOffsetM/);
  });

  it("leaves the crust band on the front face unchanged", () => {
    const withCrust = toBlockGrid(snapshot(undefined, true));
    const both = toBlockGrid(snapshot((c) => 200 * c, true));
    const f = frameFor(withCrust, 2);
    expect(buildCrustSection(both, f)).toEqual(buildCrustSection(withCrust, f));
  });
});
