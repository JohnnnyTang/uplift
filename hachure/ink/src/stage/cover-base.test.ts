import { describe, expect, it } from "vitest";
import { sectionLensSvg } from "../glacial/section-lens";
import { PROVISIONAL_LITHOLOGIES } from "../materials/natural/lithology";
import {
  type BlockFrame,
  type MeshArrays,
  blockY,
  buildCrustSection,
  buildWalls,
  drawnCoverBaseM,
  drawnCrustBaseM,
} from "./block-geometry";
import {
  type BlockGrid,
  type LandscapeSnapshot,
  elevationRange,
  toBlockGrid,
  validateSnapshot,
} from "./snapshot";

// D-W7-7R2: the optional cover base. With a crust base, the front face shows the layered rock (the wall,
// moved by `layerOffsetM`) from the bed down to `coverBaseM`, and the crust band from there to the crust base.

const COLUMNS = 11;
const ROWS = 6;
const COVER_THICKNESS_M = 2000;

/** A range across the middle, raised layers under it; integer metres, so every value is exact in Float32. */
const upM = (c: number) => 400 * Math.max(0, 3 - Math.abs(c - 5));

function snapshot(o: { crust?: boolean; cover?: boolean; offset?: boolean } = {}): LandscapeSnapshot {
  const n = COLUMNS * ROWS;
  const bedM = new Float32Array(n);
  const crustBaseM = new Float32Array(n);
  const coverBaseM = new Float32Array(n);
  const layerOffsetM = new Float32Array(n);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLUMNS; c++) {
      const k = r * COLUMNS + c;
      bedM[k] = 1000 + upM(c) + 10 * r;
      crustBaseM[k] = 1000 - 9000 - 3 * upM(c);
      // The cover base sits a fixed depth under the starting surface, raised with the layers.
      coverBaseM[k] = 1000 - COVER_THICKNESS_M + upM(c);
      layerOffsetM[k] = upM(c);
    }
  return {
    columns: COLUMNS,
    rows: ROWS,
    metresPerCell: 1000,
    bedM,
    ...(o.crust ? { crustBaseM } : {}),
    ...(o.cover ? { coverBaseM } : {}),
    ...(o.offset ? { layerOffsetM } : {}),
  };
}

const frameFor = (g: BlockGrid, reliefScale = 2): BlockFrame => ({
  across: g.across,
  along: g.along,
  metresPerCell: g.metresPerCell,
  baseM: -12_000,
  reliefScale,
  cutRow: g.along - 1,
});

/** Block Y of the layer boundary `hM` on the wall column whose top vertex is `top`, from `wallV`. */
function layerY(w: MeshArrays, top: number, hM: number): number {
  const v = w.attributes.wallV!;
  const yTop = w.position[top * 3 + 1]!;
  const yBase = w.position[(top + 1) * 3 + 1]!;
  return yBase + ((hM - v[top + 1]!) / (v[top]! - v[top + 1]!)) * (yTop - yBase);
}

describe("cover-base field on the snapshot seam (D-W7-7R2)", () => {
  it("is optional: without it the grid has no field and the crust band starts at the bed, as before", () => {
    const g = toBlockGrid(snapshot({ crust: true }));
    expect("coverBaseM" in g).toBe(false);
    const f = frameFor(g);
    const section = buildCrustSection(g, f)!;
    expect("coverBasePolyline" in section).toBe(false);
    for (let a = 0; a < g.across; a++) {
      const k = f.cutRow * g.across + a;
      expect(drawnCoverBaseM(g, f, k)).toBe(g.bedM[k]);
      expect(section.crust.position[a * 6 + 1]).toBe(blockY(f, g.bedM[k]!));
    }
    // A cover base at the bed draws the very same band (only the contact polyline is added).
    const atBed = toBlockGrid({ ...snapshot({ crust: true }), coverBaseM: snapshot().bedM });
    const { coverBasePolyline, ...rest } = buildCrustSection(atBed, f)!;
    expect(rest).toEqual(section);
    // The contact polyline runs along the band's top edge (x and y; it sits a hair in front in z).
    for (let a = 0; a < g.across; a++) {
      expect(coverBasePolyline![a * 3]).toBe(section.crust.position[a * 6]);
      expect(coverBasePolyline![a * 3 + 2]).toBe(section.crust.position[a * 6 + 1]);
    }
  });

  it("is validated, resampled with the bed, and never widens the elevation range", () => {
    const s = snapshot({ crust: true, cover: true });
    expect(() => validateSnapshot({ ...s, coverBaseM: new Float32Array(3) })).toThrow(/coverBaseM/);
    for (const orientation of [
      { valleyAxis: "rows", downstream: "decreasing" },
      { valleyAxis: "columns", downstream: "increasing" },
    ] as const) {
      const byBed = toBlockGrid({ ...s, bedM: s.coverBaseM! }, orientation);
      expect(toBlockGrid(s, orientation).coverBaseM).toEqual(byBed.bedM);
    }
    expect(elevationRange(toBlockGrid(s))).toEqual(elevationRange(toBlockGrid(snapshot({ crust: true }))));
  });

  it("without a crust base it draws nothing: walls and section are exactly as without it", () => {
    const plain = toBlockGrid(snapshot({ offset: true }));
    const covered = toBlockGrid(snapshot({ offset: true, cover: true }));
    const f = frameFor(plain);
    expect(buildWalls(covered, f, () => 20)).toEqual(buildWalls(plain, f, () => 20));
    expect(buildCrustSection(covered, f)).toBeNull();
    expect(drawnCoverBaseM(covered, f, 0)).toBeNull();
  });
});

describe("front face with layered cover rock over the crust band", () => {
  const g = toBlockGrid(snapshot({ crust: true, cover: true, offset: true }));
  const f = frameFor(g);
  const row = f.cutRow * g.across;

  it("starts the crust band at the cover base and keeps its base and the mantle unchanged", () => {
    const section = buildCrustSection(g, f)!;
    const bare = buildCrustSection(toBlockGrid(snapshot({ crust: true, offset: true })), f)!;
    for (let a = 0; a < g.across; a++) {
      const k = row + a;
      expect(section.crust.position[a * 6 + 1]).toBe(blockY(f, g.coverBaseM![k]!));
      expect(section.crust.position[a * 6 + 4]).toBe(blockY(f, g.crustBaseM![k]!));
      expect(section.crust.attributes.wallV![a * 2]).toBe(section.crust.position[a * 6 + 1]);
      expect(section.coverBasePolyline![a * 3 + 2]).toBe(section.crust.position[a * 6 + 1]);
    }
    expect(section.mantle).toEqual(bare.mantle);
    expect(section.basePolyline).toEqual(bare.basePolyline);
    // The band's top follows the cover base, so it bends up under the range with the layers.
    const top = (a: number) => section.crust.position[a * 6 + 1]!;
    expect(top(5) - top(0)).toBeCloseTo(upM(5) * f.reliefScale, 3);
  });

  it("keeps the drawn cover base between the crust base and the bed", () => {
    const s = snapshot({ crust: true, cover: true });
    const cover = Float32Array.from(s.coverBaseM!);
    cover[(ROWS - 1) * COLUMNS + 1] = 1e5; // above the bed
    cover[(ROWS - 1) * COLUMNS + 2] = -1e5; // below the crust base
    const h = toBlockGrid({ ...s, coverBaseM: cover });
    expect(drawnCoverBaseM(h, f, row + 1)).toBe(h.bedM[row + 1]);
    expect(drawnCoverBaseM(h, f, row + 2)).toBe(drawnCrustBaseM(h, f, row + 2));
  });

  it("draws the front wall only from the bed to the cover base, meeting the band without overlap", () => {
    const w = buildWalls(g, f, () => 0);
    const section = buildCrustSection(g, f)!;
    for (let a = 0; a < g.across; a++) {
      const k = row + a;
      expect(w.position[a * 6 + 1]).toBe(blockY(f, g.bedM[k]!));
      expect(w.position[a * 6 + 4]).toBe(blockY(f, g.coverBaseM![k]!));
      expect(w.position[a * 6 + 4]).toBe(section.crust.position[a * 6 + 1]);
    }
    // The other three sides still reach the block's base.
    const vertices = w.position.length / 3 - 4;
    for (let i = g.across * 2 + 1; i < vertices; i += 2) expect(w.position[i * 3 + 1]).toBe(0);
  });

  it("draws the layers between the bed and the cover base moved by the layer offset", () => {
    const w = buildWalls(g, f, () => 0);
    // A boundary 1,000 m below the undeformed surface lies inside the cover everywhere on this face.
    const hM = 1000 - 1000;
    for (let a = 0; a < g.across; a++) {
      const y = layerY(w, a * 2, hM);
      expect(y).toBeCloseTo(blockY(f, hM + upM(a)), 6);
      expect(y).toBeLessThan(w.position[a * 6 + 1]!);
      expect(y).toBeGreaterThan(w.position[a * 6 + 4]!);
    }
  });

  it("with a crust base but no cover, the front wall collapses to the bed (the band covers the face)", () => {
    const h = toBlockGrid(snapshot({ crust: true }));
    const w = buildWalls(h, f, () => 0);
    for (let a = 0; a < h.across; a++) expect(w.position[a * 6 + 4]).toBe(w.position[a * 6 + 1]);
  });
});

describe("section lens with a cover base", () => {
  const n = 21;
  const acrossM = Float64Array.from({ length: n }, (_, a) => a * 5000);
  const ridge = (a: number) => Math.max(0, 1 - Math.abs(a - 10) / 5);
  const bedM = Float64Array.from({ length: n }, (_, a) => 300 + 3000 * ridge(a));
  const startBedM = new Float64Array(n).fill(300);
  const crustBaseM = Float64Array.from({ length: n }, (_, a) => -34_700 - 18_000 * ridge(a));
  const coverBaseM = Float64Array.from({ length: n }, (_, a) => 300 - 2000 + 3000 * ridge(a));
  const look = PROVISIONAL_LITHOLOGIES[0]!;
  const words = { start: "start", crust: "crust", mantle: "mantle", cover: "layered rock" };
  const base = { acrossM, bedM, startBedM, look, crustBaseM };

  it("starts the band at the cover base and draws the contact; without it the output is unchanged", () => {
    const without = sectionLensSvg(base, { words });
    const withCover = sectionLensSvg({ ...base, coverBaseM }, { words });
    expect(without).not.toContain("lens-cover");
    expect(withCover).toContain('class="lens-cover-base"');
    expect(withCover).toContain(">layered rock</text>");
    expect(sectionLensSvg({ ...base, coverBaseM: undefined }, { words })).toBe(without);
    const crustPath = (svg: string) => svg.match(/class="lens-crust" d="([^"]+)"/)![1]!;
    expect(crustPath(withCover)).not.toBe(crustPath(without));
    // Ignored without a crust base: the plain lens is unchanged.
    const plain = { acrossM, bedM, startBedM, look };
    expect(sectionLensSvg({ ...plain, coverBaseM }, { words })).toBe(sectionLensSvg(plain, { words }));
  });
});
