/**
 * FIXTURE — authored landform, NOT model output.
 *
 * Two hand-written valley states used to develop the book stage, the look and the transition (session 5H)
 * before the glacier model's captured runs exist. They are separate authored drawings in data form:
 *
 * - `start`: a V-shaped river valley, no ice.
 * - `glaciated`: the same valley with a U-shaped trough and a glacier from a cirque to a snout.
 *
 * Nothing interpolates between them and nothing here simulates ice flow or erosion. The review route labels
 * every view that uses them "Authored fixture — not a model run". When 5G's captured runs are merged,
 * the review build switches to them through the same `LandscapeSnapshot` seam and these stay only as a
 * renderer test input.
 */
import type { LandscapeSnapshot } from "@hachure/ink/stage";

export const FIXTURE_LABEL = "Authored fixture — not a model run";

/** Grid of the authored fixture (its own size; the recorded runs take theirs from each capture manifest). */
export const FIXTURE_GRID = Object.freeze({
  columns: 96,
  rows: 128,
  /** Horizontal cell size (unit: metres). */
  metresPerCell: 50,
});

/**
 * Display altitudes for the fixture (unit: metres). The real snowline comes from the glacier model's fixed,
 * authored snowline config; the treeline is illustrative.
 */
export const FIXTURE_DRESSING = Object.freeze({ snowlineM: 2250, treelineM: 1650 });

/** Where the fixture glacier ends, as a fraction of the valley length from the head (unit: none). */
const SNOUT_FRACTION = 0.6;

function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [−1, 1] at cell-scale coordinates. Deterministic. */
function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const v = (i: number, j: number) => hash(x0 + i, y0 + j) * 2 - 1;
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/** A few octaves of value noise (unit: none, about −1 to 1). */
function ridgeNoise(x: number, y: number): number {
  return (
    valueNoise(x / 11, y / 11) * 0.66 + valueNoise(x / 5, y / 5) * 0.26 + valueNoise(x / 2.5, y / 2.5) * 0.08
  );
}

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Authored valley geometry, shared by the fixture grids and the textbook drawing. */
export interface AuthoredValley {
  /** Bed elevation at a point (unit: metres). `xM` across from the block centre, `u` head → front (0–1). */
  bedM(xM: number, u: number): number;
  /** Ice thickness at a point (unit: metres); zero for the start valley. */
  iceM(xM: number, u: number): number;
  /** Valley centre line (unit: metres from the block centre). */
  centreM(u: number): number;
}

/** The authored landform, in its start (V, no ice) or glaciated (U trough, glacier) form. */
export function authoredValley(kind: "start" | "glaciated"): AuthoredValley {
  const halfWidthM = ((FIXTURE_GRID.columns - 1) * FIXTURE_GRID.metresPerCell) / 2;
  const centreM = (u: number) => 260 * Math.sin(u * 2.4 + 0.5) - 120;
  const floorM = (u: number) => 1700 - 900 * u;
  const crestM = (xM: number, u: number) =>
    2560 - 430 * u + 240 * ridgeNoise(xM / 50 + 40, u * 127) + 110 * Math.cos(xM / 900 + u * 5);
  const vBed = (xM: number, u: number) => {
    const t = Math.min(1, Math.abs(xM - centreM(u)) / (halfWidthM * 0.82));
    // River-cut V: nearly straight sides, a narrow floor.
    const v = floorM(u) + (crestM(xM, u) - floorM(u)) * Math.pow(t, 1.05);
    // Valley head: the ridges close around the top of the valley.
    const head = smoothstep(0.16, 0, u);
    return v + (crestM(xM, u) - v) * head * 0.85 + 30 * ridgeNoise(xM / 50, u * 127);
  };
  if (kind === "start") return { bedM: vBed, iceM: () => 0, centreM };

  const trough = (u: number) => smoothstep(SNOUT_FRACTION + 0.1, SNOUT_FRACTION - 0.12, u);
  const uFloorM = (u: number) => floorM(u) - 210 * trough(u) - 120 * smoothstep(0.22, 0.04, u) * trough(u);
  const bedM = (xM: number, u: number) => {
    const v = vBed(xM, u);
    const w = trough(u);
    if (w <= 0) return v;
    // Glacial trough: a broad floor and steep, concave walls (a power of about 2 across the section),
    // reaching the same ridge crests. Cirque at the head: the trough opens into a bowl.
    const cirque = smoothstep(0.2, 0.02, u);
    const t = Math.min(1, Math.abs(xM - centreM(u)) / (halfWidthM * (0.62 + 0.18 * cirque)));
    const uShape = uFloorM(u) + (crestM(xM, u) - uFloorM(u)) * Math.pow(t, 2.3);
    return v - w * Math.max(0, v - uShape);
  };
  const iceM = (xM: number, u: number) => {
    if (u > SNOUT_FRACTION) return 0;
    // Surface: thickest in the upper valley, thinning to the snout (a parabolic profile).
    const thickness = 300 * Math.sqrt(Math.max(0, 1 - u / SNOUT_FRACTION)) + 20;
    const surface = uFloorM(u) + thickness + 140 * smoothstep(0.25, 0, u);
    return Math.max(0, surface - bedM(xM, u));
  };
  return { bedM, iceM, centreM };
}

function grid(valley: AuthoredValley, modelTimeYr?: number): LandscapeSnapshot {
  const { columns, rows, metresPerCell } = FIXTURE_GRID;
  const bedM = new Float32Array(columns * rows);
  const iceThicknessM = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1);
    for (let c = 0; c < columns; c++) {
      const xM = (c - (columns - 1) / 2) * metresPerCell;
      bedM[r * columns + c] = valley.bedM(xM, u);
      iceThicknessM[r * columns + c] = valley.iceM(xM, u);
    }
  }
  return {
    columns,
    rows,
    metresPerCell,
    bedM,
    iceThicknessM,
    rockId: 0,
    ...(modelTimeYr === undefined ? {} : { modelTimeYr }),
  };
}

export interface FixtureFrame {
  readonly label: string;
  readonly snapshot: LandscapeSnapshot;
}

/**
 * The fixture "series": two authored frames, not a time series. They carry no model time; the review route
 * steps between them without any tween and labels both as authored.
 */
export function fixtureFrames(): { start: FixtureFrame; glaciated: FixtureFrame } {
  return {
    start: { label: "Authored start: V-shaped river valley", snapshot: grid(authoredValley("start")) },
    glaciated: {
      label: "Authored glaciated valley (fixture)",
      snapshot: grid(authoredValley("glaciated")),
    },
  };
}
