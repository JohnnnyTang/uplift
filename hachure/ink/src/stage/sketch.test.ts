import { describe, expect, it } from "vitest";
import { type BlockFrame, blockBaseM, blockOutline, blockY, clampCutRow } from "./block-geometry";
import { DEFAULT_DRESSING, slopeHachures } from "./dressing";
import { DEFAULT_SKETCH, SKETCH_ORDER, buildSketch, packSketch, seededRandom } from "./sketch";
import { type LandscapeSnapshot, elevationRange, toBlockGrid } from "./snapshot";

function snapshot(iceRows = 12): LandscapeSnapshot {
  const columns = 9;
  const rows = 12;
  const bedM = new Float32Array(columns * rows);
  const iceThicknessM = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      bedM[r * columns + c] = 1000 - r * 10 + Math.abs(c - 4) * 40;
      if (r < iceRows) iceThicknessM[r * columns + c] = Math.max(0, 60 - Math.abs(c - 4) * 25);
    }
  return { columns, rows, metresPerCell: 100, bedM, iceThicknessM, rockId: 1, modelTimeYr: 250 };
}

function block(s = snapshot(), cut = 1) {
  const g = toBlockGrid(s);
  const r = elevationRange(g);
  const f: BlockFrame = {
    across: g.across,
    along: g.along,
    metresPerCell: g.metresPerCell,
    baseM: blockBaseM(r.minM, r.maxM),
    reliefScale: 1,
    cutRow: clampCutRow(g, cut * (g.along - 1)),
  };
  const input = {
    iceThresholdM: DEFAULT_DRESSING.iceThresholdM,
    hachures: slopeHachures(g, DEFAULT_DRESSING, f.cutRow, 1),
  };
  return { g, f, input };
}

describe("construction sketch", () => {
  it("draws its strokes in construction order: base, uprights, rim, section, form, hachures", () => {
    const { g, f, input } = block();
    const strokes = buildSketch(g, f, input);
    const kinds = strokes.map((s) => s.kind);
    // Kinds appear in the fixed order, each as one run.
    const runs = kinds.filter((k, i) => k !== kinds[i - 1]);
    expect(runs).toEqual(SKETCH_ORDER.filter((k) => kinds.includes(k)));
    expect(runs.slice(0, 3)).toEqual(["base", "upright", "rim"]);
    expect(kinds.filter((k) => k === "base")).toHaveLength(4);
    expect(kinds.filter((k) => k === "upright")).toHaveLength(4);
    expect(kinds.filter((k) => k === "rim")).toHaveLength(4);
    expect(kinds).toContain("section");
    expect(kinds).toContain("form");
    expect(kinds).toContain("hachure");
    expect(kinds.filter((k) => k === "hachure").length).toBeLessThanOrEqual(DEFAULT_SKETCH.maxHachures);
  });

  it("gives every stroke its own interval: one pencil, one stroke at a time, 0 to 1", () => {
    const { g, f, input } = block();
    const strokes = buildSketch(g, f, input);
    expect(strokes[0]!.times[0]).toBe(0);
    expect(strokes.at(-1)!.times.at(-1)).toBeCloseTo(1, 12);
    let previousEnd = 0;
    for (const s of strokes) {
      expect(s.times).toHaveLength(s.points.length / 3);
      // Each stroke starts after the one before it ended (the pencil leaves the paper between them).
      expect(s.times[0]!).toBeGreaterThanOrEqual(previousEnd - 1e-12);
      for (let i = 1; i < s.times.length; i++) expect(s.times[i]!).toBeGreaterThan(s.times[i - 1]!);
      previousEnd = s.times.at(-1)!;
    }
  });

  it("is deterministic for a seed, and another seed changes only the hand, not the plan", () => {
    const { g, f, input } = block();
    const a = buildSketch(g, f, input);
    const b = buildSketch(g, f, input);
    expect(b).toEqual(a);
    const other = buildSketch(g, f, input, { seed: 7 });
    expect(other.map((s) => s.kind)).toEqual(a.map((s) => s.kind));
    expect(other.map((s) => s.points)).not.toEqual(a.map((s) => s.points));
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    for (let i = 0; i < 20; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("stays registered with the block: within the wobble of its outline, never under the paper", () => {
    const { g, f, input } = block();
    const strokes = buildSketch(g, f, input);
    const m = g.metresPerCell;
    const halfX = ((g.across - 1) / 2) * m;
    const halfZ = ((g.along - 1) / 2) * m;
    const top = blockY(f, elevationRange(g).maxM + 60);
    const slack = m * (DEFAULT_SKETCH.wobbleCells + 0.01);
    const over = DEFAULT_SKETCH.overshoot;
    for (const s of strokes)
      for (let i = 0; i < s.points.length; i += 3) {
        expect(Math.abs(s.points[i]!)).toBeLessThanOrEqual(halfX * (1 + 2 * over) + slack);
        expect(Math.abs(s.points[i + 1]!)).toBeLessThanOrEqual(halfZ * (1 + 2 * over) + slack);
        expect(s.points[i + 2]!).toBeGreaterThanOrEqual(0);
        expect(s.points[i + 2]!).toBeLessThanOrEqual(top * (1 + over) + slack);
      }
    // The front rim follows the block's own front profile (the ink outline) to within the wobble.
    const outline = blockOutline(g, f, input.iceThresholdM)[0]!.points;
    const frontRim = strokes.find((s) => s.kind === "rim")!;
    for (let i = 0; i < frontRim.points.length; i += 3) {
      const [x, z, y] = [frontRim.points[i]!, frontRim.points[i + 1]!, frontRim.points[i + 2]!];
      let best = Infinity;
      for (let o = 0; o < outline.length; o += 3)
        best = Math.min(best, Math.hypot(outline[o]! - x, outline[o + 1]! - z, outline[o + 2]! - y));
      expect(best).toBeLessThanOrEqual(slack);
    }
  });

  it("follows the block's current state: the cut face and the ice on it", () => {
    const whole = block();
    const cut = block(snapshot(), 0.5);
    const frontZ = (s: ReturnType<typeof buildSketch>) => s.find((k) => k.kind === "rim")!.points[1]!;
    expect(frontZ(buildSketch(cut.g, cut.f, cut.input))).toBeLessThan(
      frontZ(buildSketch(whole.g, whole.f, whole.input)),
    );
    // No ice on the front face and no caller lines: no section strokes, and the others take their share.
    const bare = block(snapshot(0));
    const strokes = buildSketch(bare.g, bare.f, bare.input);
    expect(strokes.some((s) => s.kind === "section")).toBe(false);
    expect(strokes.at(-1)!.times.at(-1)).toBeCloseTo(1, 12);
    const withLine = buildSketch(bare.g, bare.f, {
      ...bare.input,
      sectionLines: [[-400, 550, 20, 0, 550, 30, 400, 550, 20]],
    });
    expect(withLine.filter((s) => s.kind === "section")).toHaveLength(1);
  });

  it("packs one segment per stroke step with its reveal interval and neighbours", () => {
    const { g, f, input } = block();
    const strokes = buildSketch(g, f, input);
    const packed = packSketch(strokes);
    expect(packed.count).toBe(strokes.reduce((n, s) => n + s.points.length / 3 - 1, 0));
    expect(packed.segReveal).toHaveLength(packed.count * 2);
    for (let i = 0; i < packed.count; i++) {
      expect(packed.segReveal[i * 2 + 1]!).toBeGreaterThan(packed.segReveal[i * 2]!);
      expect(packed.segWidth[i]!).toBeGreaterThan(0);
    }
    // First segment of the first stroke: an open end repeats its own start as the previous point.
    expect(Array.from(packed.segPrev.subarray(0, 3))).toEqual(Array.from(packed.segStart.subarray(0, 3)));
    expect(Array.from(packed.segStart.subarray(0, 3))).toEqual(
      strokes[0]!.points.slice(0, 3).map((v) => Math.fround(v)),
    );
    expect(packSketch([]).count).toBe(0);
  });
});
