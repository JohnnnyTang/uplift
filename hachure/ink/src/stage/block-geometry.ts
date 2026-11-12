/**
 * Geometry of a landscape block, as plain typed arrays (no three.js), so it is testable in Node.
 *
 * Block-local frame (unit: model metres, vertical scaled by `reliefScale`): X across the valley (left to
 * right as the reader sees the front face), Y up from the block's base, Z along the valley from the head
 * (back) to the downstream end (front, towards the reader). The block is centred on X and Z; the base is
 * Y = 0. Cutting the block (the front face at row `cutRow`) never moves the rest of it.
 */
import type { SurfaceCover } from "./dressing";
import { sampleField } from "./dressing";
import type { BlockGrid } from "./snapshot";

export interface BlockFrame {
  readonly across: number;
  readonly along: number;
  readonly metresPerCell: number;
  /** Elevation of the block's base (unit: metres). */
  readonly baseM: number;
  /** Vertical scale (unit: none; 1 = true scale). */
  readonly reliefScale: number;
  /** Row of the front (cut) face; rows beyond it are not drawn. */
  readonly cutRow: number;
}

export interface MeshArrays {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly index: Uint32Array;
  readonly attributes: Readonly<Record<string, Float32Array>>;
}

export const blockX = (f: BlockFrame, a: number) => (a - (f.across - 1) / 2) * f.metresPerCell;
export const blockZ = (f: BlockFrame, l: number) => (l - (f.along - 1) / 2) * f.metresPerCell;
export const blockY = (f: BlockFrame, hM: number) => (hM - f.baseM) * f.reliefScale;

/** Base elevation leaving a band of rock under the lowest point (unit: metres). */
export function blockBaseM(minM: number, maxM: number, fraction = 0.2): number {
  return minM - Math.max(1, (maxM - minM) * fraction);
}

/** Clamps a requested cut row to the drawable range [2, along − 1]. */
export function clampCutRow(g: BlockGrid, row: number): number {
  return Math.min(g.along - 1, Math.max(2, Math.round(row)));
}

/** Normals of a heightfield surface (heights already in block Y) by central differences. */
function surfaceNormals(f: BlockFrame, heightY: Float32Array, rows: number): Float32Array {
  const { across } = f;
  const m = f.metresPerCell;
  const out = new Float32Array(across * rows * 3);
  for (let l = 0; l < rows; l++) {
    for (let a = 0; a < across; a++) {
      const a0 = Math.max(0, a - 1);
      const a1 = Math.min(across - 1, a + 1);
      const l0 = Math.max(0, l - 1);
      const l1 = Math.min(rows - 1, l + 1);
      const dx = (heightY[l * across + a1]! - heightY[l * across + a0]!) / ((a1 - a0) * m);
      const dz = (heightY[l1 * across + a]! - heightY[l0 * across + a]!) / ((l1 - l0) * m);
      const len = Math.hypot(dx, 1, dz);
      const o = (l * across + a) * 3;
      out[o] = -dx / len;
      out[o + 1] = 1 / len;
      out[o + 2] = -dz / len;
    }
  }
  return out;
}

function gridPositions(f: BlockFrame, heightY: Float32Array, rows: number): Float32Array {
  const p = new Float32Array(f.across * rows * 3);
  for (let l = 0; l < rows; l++)
    for (let a = 0; a < f.across; a++) {
      const o = (l * f.across + a) * 3;
      p[o] = blockX(f, a);
      p[o + 1] = heightY[l * f.across + a]!;
      p[o + 2] = blockZ(f, l);
    }
  return p;
}

/** Two triangles per cell, optionally only cells for which `keep(k00, k10, k01, k11)` is true. */
function gridIndex(across: number, rows: number, keep?: (k: readonly number[]) => boolean): Uint32Array {
  const out: number[] = [];
  for (let l = 0; l < rows - 1; l++)
    for (let a = 0; a < across - 1; a++) {
      const k00 = l * across + a;
      const k = [k00, k00 + 1, k00 + across, k00 + across + 1];
      if (keep && !keep(k)) continue;
      out.push(k[0]!, k[2]!, k[1]!, k[1]!, k[2]!, k[3]!);
    }
  return Uint32Array.from(out);
}

/** The land surface (bed) up to the cut, with snow and meadow weights. */
export function buildGround(g: BlockGrid, f: BlockFrame, cover: SurfaceCover): MeshArrays {
  const rows = f.cutRow + 1;
  const n = g.across * rows;
  const heightY = new Float32Array(n);
  for (let k = 0; k < n; k++) heightY[k] = blockY(f, g.bedM[k]!);
  return {
    position: gridPositions(f, heightY, rows),
    normal: surfaceNormals(f, heightY, rows),
    index: gridIndex(g.across, rows),
    attributes: { snowW: cover.snow.slice(0, n), meadowW: cover.meadow.slice(0, n) },
  };
}

/**
 * The glacier surface. Ice-free vertices sit slightly below the bed, so the ice meets the valley walls in a
 * clean intersection line instead of a stepped cell edge. Null when there is no ice before the cut.
 */
export function buildIce(g: BlockGrid, f: BlockFrame, iceThresholdM: number): MeshArrays | null {
  const rows = f.cutRow + 1;
  const n = g.across * rows;
  const heightY = new Float32Array(n);
  const surfaceY = new Float32Array(n);
  const dipM = g.metresPerCell * 0.6;
  let any = false;
  for (let k = 0; k < n; k++) {
    const iced = g.iceM[k]! > iceThresholdM;
    any ||= iced;
    surfaceY[k] = blockY(f, g.bedM[k]! + g.iceM[k]!);
    heightY[k] = iced ? surfaceY[k]! : blockY(f, g.bedM[k]! - dipM);
  }
  if (!any) return null;
  const iced = (k: number) => g.iceM[k]! > iceThresholdM;
  return {
    position: gridPositions(f, heightY, rows),
    normal: surfaceNormals(f, surfaceY, rows),
    index: gridIndex(g.across, rows, (ks) => ks.some(iced)),
    attributes: {},
  };
}

/**
 * The four sides of the block, from the base to the bed. Attributes for the wall material: `wallU`
 * (distance along the wall), `wallV` (elevation), `depthM` (depth below the ground) and `soilM` (soil
 * thickness at that column), all in metres. `soil(k)` gives the soil thickness at grid cell k.
 */
export function buildWalls(g: BlockGrid, f: BlockFrame, soil: (k: number) => number): MeshArrays {
  const m = f.metresPerCell;
  const last = f.cutRow;
  const sides: { cells: number[]; normal: [number, number, number]; u: (i: number) => number }[] = [];
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  // Front (cut face), left, right and back, each listed in a consistent order along the wall.
  sides.push({ cells: range(g.across).map((a) => last * g.across + a), normal: [0, 0, 1], u: (i) => i * m });
  sides.push({ cells: range(last + 1).map((l) => l * g.across), normal: [-1, 0, 0], u: (i) => i * m });
  sides.push({
    cells: range(last + 1).map((l) => l * g.across + g.across - 1),
    normal: [1, 0, 0],
    u: (i) => i * m,
  });
  sides.push({ cells: range(g.across).map((a) => a), normal: [0, 0, -1], u: (i) => i * m });
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  const wallU: number[] = [];
  const wallV: number[] = [];
  const depthM: number[] = [];
  const soilM: number[] = [];
  for (const side of sides) {
    const first = position.length / 3;
    side.cells.forEach((k, i) => {
      const a = k % g.across;
      const l = Math.floor(k / g.across);
      const x = blockX(f, a);
      const z = blockZ(f, l);
      const top = g.bedM[k]!;
      for (const [y, elev] of [
        [blockY(f, top), top],
        [0, f.baseM],
      ] as const) {
        position.push(x, y, z);
        normal.push(...side.normal);
        wallU.push(side.u(i));
        wallV.push(elev);
        depthM.push(top - elev);
        soilM.push(soil(k));
      }
      if (i > 0) {
        const v = first + i * 2;
        index.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    });
  }
  // The base, so the block casts a solid shadow and never looks hollow from below.
  const b = position.length / 3;
  const x0 = blockX(f, 0);
  const x1 = blockX(f, g.across - 1);
  const z0 = blockZ(f, 0);
  const z1 = blockZ(f, last);
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const) {
    position.push(x, 0, z);
    normal.push(0, -1, 0);
    wallU.push(0);
    wallV.push(f.baseM);
    depthM.push(1e9);
    soilM.push(0);
  }
  index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  return {
    position: Float32Array.from(position),
    normal: Float32Array.from(normal),
    index: Uint32Array.from(index),
    attributes: {
      wallU: Float32Array.from(wallU),
      wallV: Float32Array.from(wallV),
      depthM: Float32Array.from(depthM),
      soilM: Float32Array.from(soilM),
    },
  };
}

/** Ice in section on the front face (between bed and ice surface). Null where the cut misses the ice. */
export function buildIceSection(g: BlockGrid, f: BlockFrame, iceThresholdM: number): MeshArrays | null {
  const l = f.cutRow;
  const z = blockZ(f, l) + g.metresPerCell * 0.02;
  const position: number[] = [];
  const index: number[] = [];
  for (let a = 0; a < g.across; a++) {
    const k = l * g.across + a;
    const bed = g.bedM[k]!;
    const ice = g.iceM[k]! > iceThresholdM ? g.iceM[k]! : 0;
    position.push(blockX(f, a), blockY(f, bed + ice), z, blockX(f, a), blockY(f, bed), z);
    if (a > 0) {
      const iceHere = ice > 0;
      const iceBefore = g.iceM[k - 1]! > iceThresholdM;
      if (iceHere || iceBefore) {
        const v = a * 2;
        index.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    }
  }
  if (!index.length) return null;
  const count = position.length / 3;
  const normal = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normal[i * 3 + 2] = 1;
  return { position: Float32Array.from(position), normal, index: Uint32Array.from(index), attributes: {} };
}

/** A flat ribbon following a smoothed path (`a0, l0, …` in cells), lying just above the bed. */
export function buildRibbon(
  g: BlockGrid,
  f: BlockFrame,
  path: readonly number[],
  widthCells: number,
): MeshArrays | null {
  const pts: number[] = [];
  for (let i = 0; i < path.length; i += 2) if (path[i + 1]! <= f.cutRow) pts.push(path[i]!, path[i + 1]!);
  if (pts.length < 4) return null;
  const position: number[] = [];
  const index: number[] = [];
  const lift = g.metresPerCell * 0.08;
  const count = pts.length / 2;
  for (let i = 0; i < count; i++) {
    const p = Math.max(0, i - 1);
    const q = Math.min(count - 1, i + 1);
    let tx = pts[q * 2]! - pts[p * 2]!;
    let tz = pts[q * 2 + 1]! - pts[p * 2 + 1]!;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // Narrow at the source, full width after a few cells: reads as a stream gathering from the snout.
    const w = (widthCells / 2) * Math.min(1, 0.35 + i / 10);
    for (const side of [-1, 1]) {
      const a = pts[i * 2]! - tz * w * side;
      const l = pts[i * 2 + 1]! + tx * w * side;
      position.push(blockX(f, a), blockY(f, sampleField(g.bedM, g, a, l) + lift), blockZ(f, l));
    }
    if (i > 0) {
      const v = i * 2;
      index.push(v - 2, v, v - 1, v - 1, v, v + 1);
    }
  }
  const n = position.length / 3;
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) normal[i * 3 + 1] = 1;
  return { position: Float32Array.from(position), normal, index: Uint32Array.from(index), attributes: {} };
}

/**
 * Ink outline polylines as `[x, z, y, …]` triples (the stroke buffer's terrain order: across, along, up):
 * the top edge of every side, the base rectangle, the four vertical corners and the ice outline on the
 * front face (flagged `ice`, so it hides with the ice).
 */
export function blockOutline(
  g: BlockGrid,
  f: BlockFrame,
  iceThresholdM: number,
): { closed: boolean; points: number[]; ice?: true }[] {
  const last = f.cutRow;
  const p = (a: number, l: number, hM: number) => [blockX(f, a), blockZ(f, l), blockY(f, hM)];
  const bed = (a: number, l: number) => g.bedM[l * g.across + a]!;
  const top: number[] = [];
  for (let a = 0; a < g.across; a++) top.push(...p(a, 0, bed(a, 0)));
  for (let l = 1; l <= last; l++) top.push(...p(g.across - 1, l, bed(g.across - 1, l)));
  for (let a = g.across - 2; a >= 0; a--) top.push(...p(a, last, bed(a, last)));
  for (let l = last - 1; l > 0; l--) top.push(...p(0, l, bed(0, l)));
  const corners = [
    [0, 0],
    [g.across - 1, 0],
    [g.across - 1, last],
    [0, last],
  ] as const;
  const base: number[] = [];
  const lines: { closed: boolean; points: number[]; ice?: true }[] = [{ closed: true, points: top }];
  for (const [a, l] of corners) {
    base.push(blockX(f, a), blockZ(f, l), 0);
    lines.push({ closed: false, points: [blockX(f, a), blockZ(f, l), 0, ...p(a, l, bed(a, l))] });
  }
  lines.push({ closed: true, points: base });
  // Ice surface on the cut face, one polyline per ice-covered run of columns.
  let run: number[] = [];
  for (let a = 0; a < g.across; a++) {
    const k = last * g.across + a;
    if (g.iceM[k]! > iceThresholdM) {
      if (!run.length && a > 0) run.push(...p(a - 1, last, bed(a - 1, last)));
      run.push(...p(a, last, g.bedM[k]! + g.iceM[k]!));
    } else if (run.length) {
      run.push(...p(a, last, bed(a, last)));
      lines.push({ closed: false, points: run, ice: true });
      run = [];
    }
  }
  if (run.length) lines.push({ closed: false, points: run, ice: true });
  return lines;
}

/**
 * A dashed line on the cut face following another snapshot's bed at the same row (the starting valley, or
 * a kept run's profile). Returns single segments, six numbers each (`x0, z0, y0, x1, z1, y1`).
 */
export function dashedProfile(
  reference: BlockGrid,
  f: BlockFrame,
  dashCells = 0.9,
  gapCells = 0.7,
): Float64Array {
  const l = Math.min(f.cutRow, reference.along - 1);
  const z = blockZ(f, l) + reference.metresPerCell * 0.04;
  const out: number[] = [];
  const at = (a: number) => sampleField(reference.bedM, reference, a, l);
  let a = 0;
  while (a < reference.across - 1) {
    const end = Math.min(reference.across - 1, a + dashCells);
    // Subdivide each dash so it follows the profile's curvature.
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      const a0 = a + ((end - a) * s) / steps;
      const a1 = a + ((end - a) * (s + 1)) / steps;
      out.push(blockX(f, a0), z, blockY(f, at(a0)), blockX(f, a1), z, blockY(f, at(a1)));
    }
    a = end + gapCells;
  }
  return Float64Array.from(out);
}

/**
 * Another snapshot's bed along the cut face as one polyline (`x, z, y` triples, the stroke buffer's terrain
 * order), lifted `offsetCells` in front of the face. Used under a dotted line as its halo.
 */
export function solidProfile(reference: BlockGrid, f: BlockFrame, offsetCells = 0.04): number[] {
  const l = Math.min(f.cutRow, reference.along - 1);
  const z = blockZ(f, l) + reference.metresPerCell * offsetCells;
  const out: number[] = [];
  for (let a = 0; a < reference.across; a += 0.5) {
    const x = Math.min(reference.across - 1, a);
    out.push(blockX(f, x), z, blockY(f, sampleField(reference.bedM, reference, x, l)));
  }
  return out;
}
