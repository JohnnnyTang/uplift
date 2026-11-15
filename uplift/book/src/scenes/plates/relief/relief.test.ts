import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elevationRange, toBlockGrid, validateSnapshot } from "@hachure/ink/stage";
import {
  PLATES_RELIEF_CONFIG,
  PLATE_BOUNDARIES,
  type PlateBoundary,
  type PlatesReliefConfig,
  type PlatesReliefSnapshot,
  createPlatesRelief,
  platesSceneScales,
  relief,
  startingLandscape,
} from "./index";

const repo = new URL("../../../../../../", import.meta.url);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, repo), "utf8")) as T;

const bytes = (a: Float32Array) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const sameBits = (a: Float32Array, b: Float32Array) => {
  expect(a.length).toBe(b.length);
  expect(Buffer.compare(bytes(a), bytes(b))).toBe(0);
};
const sameSnapshot = (a: PlatesReliefSnapshot, b: PlatesReliefSnapshot) => {
  expect([a.columns, a.rows, a.metresPerCell, a.rockId]).toEqual([
    b.columns,
    b.rows,
    b.metresPerCell,
    b.rockId,
  ]);
  sameBits(a.bedM, b.bedM);
  sameBits(a.crustBaseM, b.crustBaseM);
  sameBits(a.layerOffsetM, b.layerOffsetM);
  sameBits(a.coverBaseM, b.coverBaseM);
};
const maxAbsDiff = (a: Float32Array, b: Float32Array) => {
  let m = 0;
  for (let k = 0; k < a.length; k++) m = Math.max(m, Math.abs(a[k]! - b[k]!));
  return m;
};
const maxOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, v), -Infinity);
const minOf = (a: Float32Array) => a.reduce((m, v) => Math.min(m, v), Infinity);

const { columns, rows, metresPerCell } = PLATES_RELIEF_CONFIG.grid;
const xOf = (c: number) => (c - (columns - 1) / 2) * metresPerCell;
const STAGES = Array.from({ length: 11 }, (_, i) => i / 10);
const frames = (b: PlateBoundary) => STAGES.map((s) => relief(b, s));

describe("config", () => {
  it("transcribes the 7A parameter table (parameters.json) exactly", () => {
    type Json = Omit<PlatesReliefConfig, "start"> & {
      version: string;
      stage: { ease: string };
      start: Omit<PlatesReliefConfig["start"], "layers" | "basement"> & {
        layers: { name: string; thicknessM: number }[];
        basementName: string;
      };
    };
    const p = readJson<Json>("docs/science/plates/parameters.json");
    const c = PLATES_RELIEF_CONFIG;
    // 7A's table as revised at the owner's look review (D-W7-7R: rows 10, 28, 29).
    expect(p.version).toBe("7R-1");
    expect(p.stage.ease).toBe("linear");
    expect(c.seed).toBe(p.seed);
    expect(c.grid).toEqual(p.grid);
    expect(c.display).toEqual(p.display);
    const { layers, basementName, ...startScalars } = p.start;
    const { layers: cLayers, basement, ...cStartScalars } = c.start;
    expect(cStartScalars).toEqual(startScalars);
    expect(cLayers.map((l) => ({ name: l.key, thicknessM: l.thicknessM }))).toEqual(layers);
    expect(basement.key).toBe(basementName);
    expect(c.crust).toEqual(p.crust);
    expect(c.convergent).toEqual(p.convergent);
    expect(c.divergent).toEqual(p.divergent);
    expect(c.transform).toEqual(p.transform);
    expect(c.dressing).toEqual(p.dressing);
  });

  it("carries the owner's look-review values (D-W7-7R)", () => {
    const { start, divergent } = PLATES_RELIEF_CONFIG;
    expect(start.ridgeReliefM).toBe(1_500); // row 10, ARTISTIC
    // Rows 28 + 29: shoulder-to-floor relief at the top of the cited 0.5–2.1 km range (Cho05).
    expect(divergent.floorDropM + divergent.shoulderHeightM).toBe(2_100);
    expect(divergent.crustThicknessAtAxisM).toBe(25_000); // row 32 stays cited
  });

  it("keeps the derived Airy proportion consistent with the densities (row 18)", () => {
    const {
      crustDensityKgPerM3: rc,
      mantleDensityKgPerM3: rm,
      airyRootPerMetreOfUplift,
    } = PLATES_RELIEF_CONFIG.crust;
    expect(airyRootPerMetreOfUplift).toBeCloseTo(rc / (rm - rc), 10);
  });

  it("derives the scene scales from the config (D-W7-7A, decision 3)", () => {
    const s = platesSceneScales();
    expect(s.reliefScale).toBe(4);
    expect(s.crustSceneFactor).toBe(0.1875);
    expect(s.blockBaseSceneM).toBe(-13_500);
    // The crust scale must stay ≥ surface scale / Airy factor, or the root reads shallower than the range.
    const { display, crust } = PLATES_RELIEF_CONFIG;
    expect(display.crustVerticalExaggeration).toBeGreaterThanOrEqual(
      display.surfaceVerticalExaggeration / crust.airyRootPerMetreOfUplift,
    );
  });

  it("never uses Math.random in the relief code", () => {
    const dir = new URL("./", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts")))
      expect(readFileSync(new URL(f, dir), "utf8"), f).not.toMatch(/Math\s*\.\s*random\s*\(/);
  });
});

describe("snapshot shape", () => {
  it("is a timeless LandscapeSnapshot-shaped frame on the 7A grid", () => {
    for (const b of PLATE_BOUNDARIES) {
      const s = relief(b, 0.5) as PlatesReliefSnapshot & { modelTimeYr?: number };
      expect([s.columns, s.rows, s.metresPerCell]).toEqual([160, 160, 1000]);
      for (const f of [s.bedM, s.crustBaseM, s.layerOffsetM, s.coverBaseM]) {
        expect(f.length).toBe(160 * 160);
        expect(f.every(Number.isFinite)).toBe(true);
      }
      expect(s.rockId).toBe(PLATES_RELIEF_CONFIG.start.layers[0]!.rockId);
      expect("modelTimeYr" in s).toBe(false);
      // The crust base always lies far below the surface.
      for (let k = 0; k < s.bedM.length; k++) expect(s.crustBaseM[k]!).toBeLessThan(s.bedM[k]! - 1000);
    }
  });

  it("passes the stage's own snapshot checks and resamples with its crust base and layer offset", () => {
    const frame = createPlatesRelief().elevationFrame();
    for (const b of PLATE_BOUNDARIES) {
      const s = relief(b, 1);
      expect(() => validateSnapshot(s)).not.toThrow();
      const g = toBlockGrid(s);
      expect(g.crustBaseM).toBeDefined();
      expect(g.layerOffsetM).toBeDefined();
      expect(g.coverBaseM).toBeDefined();
      expect(g.modelTimeYr).toBeNull();
      const r = elevationRange(g);
      expect(r.minM).toBeGreaterThanOrEqual(frame.minM);
      expect(r.maxM).toBeLessThanOrEqual(frame.maxM);
    }
  });

  it("clamps the stage to [0, 1] and refuses NaN", () => {
    sameSnapshot(relief("convergent", 1.5), relief("convergent", 1));
    sameSnapshot(relief("divergent", -0.2), relief("divergent", 0));
    expect(() => relief("transform", Number.NaN)).toThrow(RangeError);
  });
});

describe("determinism", () => {
  it("gives an identical field for the same seed, boundary and stage", () => {
    const other = createPlatesRelief(PLATES_RELIEF_CONFIG);
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0, 0.37, 1]) {
        sameSnapshot(relief(b, s), relief(b, s));
        sameSnapshot(relief(b, s), other.relief(b, s));
      }
  });

  it("matches the pointwise reference formula (field.cell) bit for bit on the grid", () => {
    const r = createPlatesRelief();
    const f32 = (v: number) => Math.fround(v);
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0, 0.3, 1]) {
        const snap = r.relief(b, s);
        let mismatches = 0;
        for (let row = 0; row < rows; row += 3)
          for (let c = 0; c < columns; c++) {
            const k = row * columns + c;
            const cell = r.field.cell(b, s, xOf(c), (row - (rows - 1) / 2) * metresPerCell);
            if (snap.bedM[k] !== f32(cell.bedM)) mismatches++;
            if (snap.crustBaseM[k] !== f32(-cell.mohoDepthM * 0.1875)) mismatches++;
            if (!Object.is(snap.layerOffsetM[k], f32(cell.layerOffsetM))) mismatches++;
            if (!Object.is(snap.coverBaseM[k], f32(cell.coverBaseM))) mismatches++;
          }
        expect(mismatches, `${b} @ ${s}`).toBe(0);
      }
  });

  it("changes the texture, not the landforms, with the seed", () => {
    const reseeded = createPlatesRelief({ ...PLATES_RELIEF_CONFIG, seed: 8 });
    const a = relief("convergent", 1);
    const b = reseeded.relief("convergent", 1);
    expect(maxAbsDiff(a.bedM, b.bedM)).toBeGreaterThan(1);
    sameBits(a.crustBaseM, b.crustBaseM); // the root follows the smooth envelope only
    sameBits(a.layerOffsetM, b.layerOffsetM);
    sameBits(a.coverBaseM, b.coverBaseM);
  });
});

describe("stage 0 is the shared starting landscape", () => {
  it("is identical bit for bit for all three boundaries", () => {
    const start = startingLandscape();
    for (const b of PLATE_BOUNDARIES) sameSnapshot(relief(b, 0), start);
  });

  it("has a flat crust base and no layer offset", () => {
    const start = startingLandscape();
    const normal = -(35_000 - 400) * 0.1875; // rows 15 and 3 / 2
    for (const v of start.crustBaseM) expect(v).toBeCloseTo(normal, 2);
    expect(start.layerOffsetM.every((v) => Object.is(v, 0))).toBe(true);
  });

  it("has ridges and stream valleys running across the boundary", () => {
    const start = startingLandscape();
    const f = createPlatesRelief().field;
    // Down one column (along the boundary) the surface rises and falls by about the ridge relief.
    const c = 40;
    const col = Array.from({ length: rows }, (_, r) => start.bedM[r * columns + c]!);
    expect(Math.max(...col) - Math.min(...col)).toBeGreaterThan(400);
    // Across the block, a trough line keeps its depth: streams cross the boundary at right angles.
    expect(f.startM(-60_000, 10_000)).toBeLessThan(f.startM(-60_000, 0));
  });
});

describe("continuity in the stage", () => {
  it("has no jumps: small stage steps make small, shrinking changes", () => {
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0, 0.25, 0.5, 0.75, 0.999]) {
        const a = relief(b, s);
        const coarse = relief(b, s + 1e-3);
        const fine = relief(b, s + 1e-4);
        const dc = maxAbsDiff(a.bedM, coarse.bedM);
        const df = maxAbsDiff(a.bedM, fine.bedM);
        expect(dc, `${b} @ ${s}`).toBeLessThan(25);
        expect(df, `${b} @ ${s}`).toBeLessThanOrEqual(dc / 4 + 0.01);
        expect(maxAbsDiff(a.crustBaseM, coarse.crustBaseM)).toBeLessThan(10);
        expect(maxAbsDiff(a.layerOffsetM, coarse.layerOffsetM)).toBeLessThan(10);
        expect(maxAbsDiff(a.coverBaseM, coarse.coverBaseM)).toBeLessThan(10);
      }
  });
});

describe("convergent: a collision range and its root", () => {
  const fs = frames("convergent");

  it("raises the surface and deepens the root monotonically at every cell", () => {
    for (let i = 1; i < fs.length; i++) {
      const [p, q] = [fs[i - 1]!, fs[i]!];
      let violations = 0;
      for (let k = 0; k < p.bedM.length; k++) {
        if (q.bedM[k]! < p.bedM[k]!) violations++;
        if (q.crustBaseM[k]! > p.crustBaseM[k]!) violations++;
        if (q.layerOffsetM[k]! < p.layerOffsetM[k]!) violations++;
      }
      expect(violations, `stage ${STAGES[i]}`).toBe(0);
      expect(maxOf(q.bedM)).toBeGreaterThan(maxOf(p.bedM));
      expect(minOf(q.crustBaseM)).toBeLessThan(minOf(p.crustBaseM));
    }
  });

  it("widens as it grows and stays on the boundary", () => {
    const halfWidth = (s: PlatesReliefSnapshot) => {
      let w = 0;
      for (let c = 0; c < columns; c++) if (s.layerOffsetM[c]! > 1) w = Math.max(w, Math.abs(xOf(c)));
      return w;
    };
    expect(halfWidth(fs[5]!)).toBeGreaterThan(halfWidth(fs[1]!));
    expect(halfWidth(fs[10]!)).toBeLessThanOrEqual(40_000); // row 20: 80 km base to base
    expect(halfWidth(fs[10]!)).toBeGreaterThan(35_000);
  });

  it("follows the Airy proportion: root = 5.6 × the smooth uplift (row 18)", () => {
    const s = fs[10]!;
    const normal = -(35_000 - 400) * 0.1875;
    for (let k = 0; k < s.bedM.length; k += 97) {
      const rootSceneM = normal - s.crustBaseM[k]!;
      expect(rootSceneM).toBeCloseTo(5.6 * s.layerOffsetM[k]! * 0.1875, 1);
    }
  });

  it("reaches the 7A extremes and keeps peaks below Everest", () => {
    const top = maxOf(fs[10]!.bedM);
    expect(top).toBeGreaterThan(6_500);
    // 7A drew peaks to about 7,000 m; the 1,500 m starting ridges of D-W7-7R add 500 m at their crests
    // (maximum 7,534 m), still below Everest's 8,849 m.
    expect(top).toBeLessThan(7_600);
    expect(minOf(fs[10]!.crustBaseM)).toBeCloseTo(-11_842, -1); // deepest crust base, scene metres
  });
});

describe("divergent: a rift valley between stepped scarps", () => {
  const fs = frames("divergent");
  const { riftWidthM, riftFloorWidthM } = PLATES_RELIEF_CONFIG.divergent;

  it("deepens the rift monotonically and thins the crust monotonically", () => {
    for (let i = 1; i < fs.length; i++) {
      const [p, q] = [fs[i - 1]!, fs[i]!];
      let violations = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < columns; c++) {
          const k = r * columns + c;
          const a = Math.abs(xOf(c));
          if (a < riftFloorWidthM / 2 && !(q.bedM[k]! < p.bedM[k]!)) violations++;
          if (a < riftWidthM / 2 - 500 && q.bedM[k]! > p.bedM[k]!) violations++;
          // A rising Moho: the crust base comes up (less negative) or stays.
          if (q.crustBaseM[k]! < p.crustBaseM[k]!) violations++;
        }
      expect(violations, `stage ${STAGES[i]}`).toBe(0);
      expect(minOf(q.bedM)).toBeLessThan(minOf(p.bedM));
    }
  });

  it("steps down in three scarps per side and raises the shoulders slightly", () => {
    const s = fs[10]!;
    const offsets = Array.from({ length: columns / 2 }, (_, i) => s.layerOffsetM[columns / 2 + i]!);
    // Plateaus (at least three cells wide) between the faults; a cell right on a fault line sits mid-scarp.
    const counts = new Map<number, number>();
    for (const v of offsets) counts.set(Math.round(v), (counts.get(Math.round(v)) ?? 0) + 1);
    const levels = [...counts].filter(([v, n]) => v < 0 && n >= 3).map(([v]) => v);
    expect(levels.sort((a, b) => a - b)).toEqual([-1500, -1050, -600]); // 0.4, 0.3, 0.3 of row 28
    expect(maxOf(s.layerOffsetM)).toBeGreaterThan(400);
    expect(maxOf(s.layerOffsetM)).toBeLessThanOrEqual(600); // row 29
  });
});

describe("transform: offset ridges and streams", () => {
  const fs = frames("transform");
  const start = startingLandscape();

  /** Best whole-row shift of a column against the start (rows towards the reader positive). */
  const bestShift = (s: PlatesReliefSnapshot, c: number) => {
    let best = 0;
    let bestErr = Infinity;
    for (let d = -8; d <= 8; d++) {
      let err = 0;
      for (let r = 10; r < rows - 10; r++)
        err += (s.bedM[r * columns + c]! - start.bedM[(r - d) * columns + c]!) ** 2;
      if (err < bestErr) [best, bestErr] = [d, err];
    }
    return best;
  };

  it("offsets the crossing ridges more as the stage grows, right-laterally", () => {
    const right = columns - 1;
    const shifts = fs
      .filter((_, i) => i % 2 === 0 || i === 5)
      .map((s) => [bestShift(s, right), bestShift(s, 0)]);
    // Stages 0, 0.2, 0.4, 0.5, 0.6, 0.8, 1: half the offset on each side, in opposite directions.
    const half = PLATES_RELIEF_CONFIG.transform.offsetM / 2 / metresPerCell;
    expect(shifts.map(([r]) => r)).toEqual([0, 1, 2, 2, 2, 3, 4].map((v) => (v * half) / 4));
    for (const [r, l] of shifts) expect(l! + r!).toBe(0);
    // At stage 1, a far column is exactly the start moved by half the offset.
    const s1 = fs[10]!;
    for (let r = half; r < rows; r++)
      expect(s1.bedM[r * columns + right]).toBe(start.bedM[(r - half) * columns + right]);
  });

  it("leaves the crust, the layers and the cover base exactly unchanged", () => {
    for (const s of fs) {
      sameBits(s.crustBaseM, start.crustBaseM);
      expect(s.layerOffsetM.every((v) => v === 0)).toBe(true);
      sameBits(s.coverBaseM, start.coverBaseM);
    }
    // So the distribution of cover-base elevations is unchanged too (the weaker, distributional form).
    const sorted = (a: Float32Array) => Float32Array.from(a).sort();
    sameBits(sorted(fs[10]!.coverBaseM), sorted(start.coverBaseM));
  });

  it("keeps the distribution of elevations (up to edge effects)", () => {
    const sorted = (a: Float32Array) => Float32Array.from(a).sort();
    const a = sorted(start.bedM);
    for (const s of [fs[5]!, fs[10]!]) {
      const b = sorted(s.bedM);
      for (const q of [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]) {
        const k = Math.floor(q * (a.length - 1));
        expect(Math.abs(b[k]! - a[k]!), `quantile ${q}`).toBeLessThan(10);
      }
      const mean = (x: Float32Array) => x.reduce((m, v) => m + v, 0) / x.length;
      expect(Math.abs(mean(s.bedM) - mean(start.bedM))).toBeLessThan(3);
    }
  });
});

describe("the 7A crust geometry (docs/review/plates/brief/crust-geometry.json)", () => {
  interface Row {
    boundary: PlateBoundary;
    stage: number;
    xFromBoundaryKm: number;
    smoothSurfaceM: number;
    mohoDepthBelowSeaLevelM: number;
    crustThicknessM: number;
    crustBaseSceneM: number;
  }
  const expected = readJson<Row[]>("docs/review/plates/brief/crust-geometry.json");
  // An odd grid puts a column exactly on the boundary and on every whole kilometre from it.
  const onKm = createPlatesRelief({
    ...PLATES_RELIEF_CONFIG,
    grid: { columns: 161, rows: 9, metresPerCell: 1000 },
  });

  it("covers every boundary at stages 0, 0.5 and 1", () => {
    expect(new Set(expected.map((r) => `${r.boundary}@${r.stage}`)).size).toBe(9);
  });

  it.each(expected.map((r) => [`${r.boundary} @ ${r.stage}, ${r.xFromBoundaryKm} km`, r] as const))(
    "%s",
    (_, r) => {
      const f = onKm.field;
      const x = r.xFromBoundaryKm * 1000;
      const moho = f.cell(r.boundary, r.stage, x, 0).mohoDepthM;
      expect(Math.abs(f.smoothSurfaceM(r.boundary, r.stage, x) - r.smoothSurfaceM)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(moho - r.mohoDepthBelowSeaLevelM)).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(f.smoothSurfaceM(r.boundary, r.stage, x) + moho - r.crustThicknessM),
      ).toBeLessThanOrEqual(0.5);
      // The snapshot carries the same values: crust base in scene metres, layer offset on the smooth start.
      const s = onKm.relief(r.boundary, r.stage);
      const k = 4 * 161 + 80 + r.xFromBoundaryKm;
      expect(Math.abs(s.crustBaseM[k]! - r.crustBaseSceneM)).toBeLessThanOrEqual(0.51);
      expect(Math.abs(f.startSmoothM(x) + s.layerOffsetM[k]! - r.smoothSurfaceM)).toBeLessThanOrEqual(0.51);
    },
  );
});

describe("cover rock above the crust (D-W7-7R2)", () => {
  const r = createPlatesRelief();
  const layers = PLATES_RELIEF_CONFIG.start.layers;
  const stackM = layers.reduce((sum, l) => sum + l.thicknessM, 0);
  const riftHalfWidthM = PLATES_RELIEF_CONFIG.divergent.riftWidthM / 2 - 500;

  it("starts at the base of the start's layer stack (row 14), under the ridge troughs", () => {
    const start = startingLandscape();
    expect(stackM).toBe(1_800);
    for (let c = 0; c < columns; c += 7) {
      const x = xOf(c);
      const expected = r.field.startSmoothM(x) - PLATES_RELIEF_CONFIG.start.ridgeReliefM / 2 - stackM;
      expect(r.field.coverBaseStartM(x)).toBeCloseTo(expected, 6);
      for (let row = 0; row < rows; row += 31)
        expect(start.coverBaseM[row * columns + c]).toBe(Math.fround(expected));
    }
  });

  it("bends with the layer offset: cover base = start cover base + layerOffsetM, for every boundary", () => {
    const start = startingLandscape();
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0.5, 1]) {
        const snap = relief(b, s);
        let worst = 0;
        for (let k = 0; k < snap.coverBaseM.length; k++)
          worst = Math.max(
            worst,
            Math.abs(snap.coverBaseM[k]! - start.coverBaseM[k]! - snap.layerOffsetM[k]!),
          );
        expect(worst, `${b} @ ${s}`).toBeLessThan(0.01);
      }
    // Up under the range, down in steps in the rift.
    const mid = columns / 2;
    expect(relief("convergent", 1).coverBaseM[mid]! - start.coverBaseM[mid]!).toBeGreaterThan(5_000);
    expect(relief("divergent", 1).coverBaseM[mid]! - start.coverBaseM[mid]!).toBeCloseTo(-1_500, 0);
  });

  it("always lies between the crust base and the surface", () => {
    const { reliefScale } = platesSceneScales();
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0, 0.5, 1]) {
        const snap = relief(b, s);
        for (let k = 0; k < snap.bedM.length; k++) {
          expect(snap.coverBaseM[k]!).toBeLessThan(snap.bedM[k]!);
          // Both are drawn ×reliefScale; the cover sits well above the (scene-metre) crust base.
          expect(snap.coverBaseM[k]!).toBeGreaterThan(snap.crustBaseM[k]! + 1_000 / reliefScale);
        }
      }
  });

  it("rises monotonically under the range and sinks monotonically in the rift", () => {
    for (const b of ["convergent", "divergent"] as const) {
      const fs = frames(b);
      for (let i = 1; i < fs.length; i++) {
        let violations = 0;
        for (let k = 0; k < fs[i]!.coverBaseM.length; k++) {
          const d = fs[i]!.coverBaseM[k]! - fs[i - 1]!.coverBaseM[k]!;
          if (b === "convergent" ? d < 0 : Math.abs(xOf(k % columns)) < riftHalfWidthM && d > 0) violations++;
        }
        expect(violations, `${b} stage ${STAGES[i]}`).toBe(0);
      }
    }
  });
});

describe("fixed elevation frame", () => {
  it("is one frame for every boundary and stage, from the deepest crust base to the highest peak", () => {
    const frame = createPlatesRelief().elevationFrame();
    expect(frame.minM).toBe(minOf(relief("convergent", 1).crustBaseM));
    expect(frame.minM).toBeCloseTo(-11_842, -1); // 7A: deepest crust base, scene metres
    expect(frame.maxM).toBe(maxOf(relief("convergent", 1).bedM));
    for (const b of PLATE_BOUNDARIES)
      for (const s of [0, 0.5, 1]) {
        const snap = relief(b, s);
        expect(maxOf(snap.bedM)).toBeLessThanOrEqual(frame.maxM);
        expect(minOf(snap.crustBaseM)).toBeGreaterThanOrEqual(frame.minM);
        expect(minOf(snap.bedM)).toBeGreaterThan(frame.minM);
      }
  });
});
