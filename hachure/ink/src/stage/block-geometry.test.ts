import { describe, expect, it } from "vitest";
import {
  PROVISIONAL_LITHOLOGIES,
  lithologyById,
  lithologyPatternSvg,
  mixHex,
  patternMarks,
} from "../materials/natural/lithology";
import {
  type BlockFrame,
  blockBaseM,
  blockOutline,
  blockY,
  blockZ,
  buildGround,
  buildIce,
  buildIceSection,
  buildWalls,
  clampCutRow,
  dashedProfile,
  solidProfile,
} from "./block-geometry";
import { surfaceCover } from "./dressing";
import {
  type LandscapeSnapshot,
  elevationRange,
  toBlockGrid,
  validateSnapshot,
  valleyGridIndex,
} from "./snapshot";

function snapshot(): LandscapeSnapshot {
  const columns = 9;
  const rows = 12;
  const bedM = new Float32Array(columns * rows);
  const iceThicknessM = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      bedM[r * columns + c] = 1000 - r * 10 + Math.abs(c - 4) * 40;
      if (r < 6) iceThicknessM[r * columns + c] = Math.max(0, 60 - Math.abs(c - 4) * 25);
    }
  return { columns, rows, metresPerCell: 100, bedM, iceThicknessM, rockId: 1, modelTimeYr: 250 };
}

describe("snapshot seam", () => {
  it("validates sizes", () => {
    expect(() => validateSnapshot({ ...snapshot(), bedM: new Float32Array(3) })).toThrow(/bedM/);
    expect(() => validateSnapshot({ ...snapshot(), metresPerCell: 0 })).toThrow(/metresPerCell/);
  });

  it("re-orients any grid axis to head-at-back without mirroring", () => {
    const s = snapshot();
    const g = toBlockGrid(s);
    expect([g.across, g.along]).toEqual([9, 12]);
    expect(g.modelTimeYr).toBe(250);
    expect(g.rockId[0]).toBe(1);
    // Same valley stored along columns, flowing towards lower column index.
    const t = {
      columns: s.rows,
      rows: s.columns,
      metresPerCell: s.metresPerCell,
      bedM: new Float32Array(s.bedM.length),
    };
    for (let r = 0; r < s.rows; r++)
      for (let c = 0; c < s.columns; c++)
        t.bedM[c * t.columns + (t.columns - 1 - r)] = s.bedM[r * s.columns + c]!;
    const h = toBlockGrid(t, {
      valleyAxis: "columns",
      downstream: "decreasing",
    });
    expect([h.across, h.along]).toEqual([9, 12]);
    // Head row (l = 0) has the highest floor in both.
    const floor = (grid: typeof g, l: number) =>
      Math.min(...Array.from(grid.bedM.subarray(l * 9, l * 9 + 9)));
    expect(floor(h, 0)).toBeCloseTo(floor(g, 0), 6);
    expect(floor(h, 11)).toBeCloseTo(floor(g, 11), 6);
  });

  it("maps a block row back to the model's index along the valley", () => {
    const columns = { valleyAxis: "columns", downstream: "decreasing" } as const;
    // Head at the back (block row 0) is the last grid column; the front row is the mouth, i = 0.
    expect(valleyGridIndex(columns, 128, 0)).toBe(127);
    expect(valleyGridIndex(columns, 128, 127)).toBe(0);
    expect(valleyGridIndex(columns, 128, 200)).toBe(0);
    expect(valleyGridIndex({ valleyAxis: "rows", downstream: "increasing" }, 12, 4)).toBe(4);
  });
});

describe("block geometry", () => {
  const g = toBlockGrid(snapshot());
  const r = elevationRange(g);
  const frame = (cut: number): BlockFrame => ({
    across: g.across,
    along: g.along,
    metresPerCell: g.metresPerCell,
    baseM: blockBaseM(r.minM, r.maxM),
    reliefScale: 1,
    cutRow: clampCutRow(g, cut),
  });

  it("cutting draws fewer rows and never moves the rest of the block", () => {
    const full = buildGround(g, frame(11), surfaceCover(g));
    const cut = buildGround(g, frame(5), surfaceCover(g));
    expect(full.position.length / 3).toBe(9 * 12);
    expect(cut.position.length / 3).toBe(9 * 6);
    expect(Array.from(cut.position.subarray(0, 30))).toEqual(Array.from(full.position.subarray(0, 30)));
    expect(clampCutRow(g, 0)).toBe(2);
    expect(clampCutRow(g, 99)).toBe(11);
  });

  it("the base sits below the lowest point and walls reach from base to bed", () => {
    const f = frame(11);
    expect(f.baseM).toBeLessThan(r.minM);
    const walls = buildWalls(g, f, () => 20);
    let minY = Infinity;
    for (let i = 1; i < walls.position.length; i += 3) minY = Math.min(minY, walls.position[i]!);
    expect(minY).toBe(0);
    expect(walls.attributes.soilM!.every((v) => v === 20 || v === 0)).toBe(true);
  });

  it("ice and its section appear only where the cut crosses ice", () => {
    expect(buildIce(g, frame(11), 1)).not.toBeNull();
    expect(buildIceSection(g, frame(3), 1)).not.toBeNull();
    expect(buildIceSection(g, frame(9), 1)).toBeNull();
    const lines = blockOutline(g, frame(3), 1);
    expect(lines.length).toBeGreaterThanOrEqual(7); // top ring, base, 4 corners, ice outline
  });

  it("dashed starting profile lies on the cut face at the reference bed", () => {
    const f = frame(4);
    const segs = dashedProfile(g, f);
    expect(segs.length % 6).toBe(0);
    for (let i = 0; i < segs.length; i += 6) expect(segs[i + 1]).toBeCloseTo(blockZ(f, 4) + 4, 6);
    const centre = blockY(f, g.bedM[4 * 9 + 4]!);
    const lowest = Math.min(...Array.from(segs).filter((_, i) => i % 3 === 2));
    expect(Math.abs(lowest - centre)).toBeLessThan(10);
  });

  it("a comparison profile (kept-run ghost halo) follows the other bed along the cut face", () => {
    const f = frame(4);
    const pts = solidProfile(g, f, 0.05);
    expect(pts.length % 3).toBe(0);
    for (let i = 0; i < pts.length; i += 3) expect(pts[i + 1]).toBeCloseTo(blockZ(f, 4) + 5, 6);
    expect(pts[2]).toBeCloseTo(blockY(f, g.bedM[4 * 9]!), 4);
  });
});

describe("lithology looks", () => {
  it("every provisional rock has a distinct pattern (the non-colour cue)", () => {
    const patterns = PROVISIONAL_LITHOLOGIES.map((l) => l.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
    for (const l of PROVISIONAL_LITHOLOGIES) expect(patternMarks(l.pattern).length).toBeGreaterThan(0);
  });

  it("produces an SVG pattern and falls back to the first look", () => {
    const svg = lithologyPatternSvg(PROVISIONAL_LITHOLOGIES[1]!, "p1");
    expect(svg).toMatch(/^<pattern id="p1"/);
    expect(lithologyById(PROVISIONAL_LITHOLOGIES, 99)).toBe(PROVISIONAL_LITHOLOGIES[0]);
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
