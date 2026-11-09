/**
 * Brush operations (raise, dig, smooth, harden) on CPU terrain state, with reader clamps.
 *
 * A solver's `applyTool` calls `applyBrush` for brush ops, adds `volumeChangeM3` to its `toolNetM3` budget
 * counter, and returns the result unchanged, so the page can acknowledge any clamp that engaged (handoff,
 * "Input clamping"). Sources (`rain-source`, `spring`, `remove-source`) are solver state, not terrain edits,
 * and stay with the solver.
 *
 * Material rules follow docs/science/parameters.md ("Reader controls and joint clamps", expert-review
 * draft): raise adds loose sediment; dig removes sediment first, then bedrock; smooth moves material between
 * neighbouring cells (removing sediment before bedrock, depositing as sediment), so it conserves solid volume;
 * harden writes the exposed-column hardness. Water and suspended sediment are never touched.
 *
 * Clamps, all per application:
 * - radius to `[metresPerCell, min(brushMaxRadiusM, gridSize × metresPerCell / 4)]` ("radius");
 * - raise height to `brushMaxHeightM` ("height"), dig depth to `brushMaxDepthM` ("depth");
 * - the whole edit is scaled down so no cardinal neighbour pair ends steeper than `brushMaxSlopeDeg`, unless
 *   it was already steeper and the edit does not steepen it further ("slope");
 * - harden target to `hardnessRange` ("hardness");
 * - a centre off the grid applies nothing ("off-grid").
 * Per-application clamps do not stop repeated edits from building an unrealistic landscape; the page says so.
 *
 * Inputs that are not numbers a control could produce (NaN, a negative height, smooth strength outside
 * [0, 1]) throw `RangeError` instead of being clamped silently.
 */
import {
  type ClampReason,
  type DigOp,
  type HardenOp,
  type RaiseOp,
  type SmoothOp,
  type TerrainConfig,
  type TerrainState,
  type ToolOp,
  type ToolResult,
  cellAt,
  cellIndex,
} from "../contract/index";

export type BrushOp = RaiseOp | DigOp | SmoothOp | HardenOp;
export type BrushKind = BrushOp["kind"];

export const BRUSH_KINDS = ["raise", "dig", "smooth", "harden"] as const satisfies readonly BrushKind[];

/** The config fields that limit brushes. A full `TerrainConfig` fits. */
export type BrushLimits = Pick<
  TerrainConfig,
  "brushMaxHeightM" | "brushMaxDepthM" | "brushMaxRadiusM" | "brushMaxSlopeDeg" | "hardnessRange"
>;

export function isBrushOp(op: ToolOp): op is BrushOp {
  return (BRUSH_KINDS as readonly string[]).includes(op.kind);
}

/** Allowed brush radius on this grid (unit: metres). `maxM < minM` means the brush is disabled. */
export interface BrushRadiusRange {
  readonly minM: number;
  readonly maxM: number;
}

/**
 * The radius range a control should offer: at least one cell, at most `brushMaxRadiusM` and a quarter of the
 * domain width (docs/science/parameters.md, "Brush radius"). Recompute when the grid changes.
 */
export function brushRadiusRangeM(
  grid: Pick<TerrainState, "gridSize" | "metresPerCell">,
  limits: Pick<BrushLimits, "brushMaxRadiusM">,
): BrushRadiusRange {
  return {
    minM: grid.metresPerCell,
    maxM: Math.min(limits.brushMaxRadiusM, (grid.gridSize * grid.metresPerCell) / 4),
  };
}

/** Cells whose centres lie within the brush disk, as a bounding box with per-cell weights. */
interface Footprint {
  readonly x0: number;
  readonly y0: number;
  readonly width: number;
  readonly height: number;
  /** 1 where the cell centre is inside the disk. */
  readonly inside: Uint8Array;
  /** Raised-cosine falloff `½(1 + cos(π d / r))`: 1 at the centre, 0 at the rim and outside. */
  readonly weight: Float64Array;
  readonly count: number;
}

function footprint(state: TerrainState, xM: number, yM: number, radiusM: number): Footprint {
  const { gridSize: n, metresPerCell: m } = state;
  const x0 = Math.max(0, Math.floor((xM - radiusM) / m));
  const x1 = Math.min(n - 1, Math.floor((xM + radiusM) / m));
  const y0 = Math.max(0, Math.floor((yM - radiusM) / m));
  const y1 = Math.min(n - 1, Math.floor((yM + radiusM) / m));
  const width = Math.max(0, x1 - x0 + 1);
  const height = Math.max(0, y1 - y0 + 1);
  const inside = new Uint8Array(width * height);
  const weight = new Float64Array(width * height);
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x + 0.5) * m - xM, (y + 0.5) * m - yM);
      if (d > radiusM) continue;
      const k = (y - y0) * width + (x - x0);
      inside[k] = 1;
      weight[k] = 0.5 * (1 + Math.cos((Math.PI * d) / radiusM));
      count++;
    }
  }
  return { x0, y0, width, height, inside, weight, count };
}

function requireFinite(name: string, value: number, min = -Infinity, max = Infinity): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} = ${value} must be finite and in [${min}, ${max}]`);
  }
}

function validate(op: BrushOp): void {
  requireFinite("at.xM", op.at.xM);
  requireFinite("at.yM", op.at.yM);
  requireFinite("radiusM", op.radiusM, Number.MIN_VALUE);
  switch (op.kind) {
    case "raise":
      return requireFinite("heightM", op.heightM, 0);
    case "dig":
      return requireFinite("depthM", op.depthM, 0);
    case "smooth":
      return requireFinite("strength", op.strength, 0, 1);
    case "harden":
      return requireFinite("hardness", op.hardness);
  }
}

const NOTHING_APPLIED = (clamped: ClampReason[]): ToolResult => ({
  applied: false,
  clamped,
  volumeChangeM3: 0,
});

/**
 * Applies one brush op to `state` in place and reports what happened. `volumeChangeM3` is the measured change
 * of rock plus sediment volume (from the stored float32 values, summed in float64), so a solver that adds it
 * to `toolNetM3` keeps its sediment budget closed exactly. Deterministic: the same state and op give the same
 * bytes.
 */
export function applyBrush(state: TerrainState, op: BrushOp, limits: BrushLimits): ToolResult {
  validate(op);
  const clamped: ClampReason[] = [];
  const { gridSize: n, metresPerCell: m } = state;
  if (!cellAt(n, m, op.at)) return NOTHING_APPLIED(["off-grid"]);

  const range = brushRadiusRangeM(state, limits);
  if (range.maxM < range.minM) return NOTHING_APPLIED(["radius"]);
  let radiusM = op.radiusM;
  if (radiusM > range.maxM) {
    radiusM = range.maxM;
    clamped.push("radius");
  } else if (radiusM < range.minM) {
    radiusM = range.minM;
    clamped.push("radius");
  }
  const fp = footprint(state, op.at.xM, op.at.yM, radiusM);

  if (op.kind === "harden") return harden(state, fp, op.hardness, limits.hardnessRange, clamped);

  let delta: Float64Array;
  if (op.kind === "smooth") {
    delta = smoothDelta(state, fp, op.strength);
  } else {
    const isRaise = op.kind === "raise";
    const limit = isRaise ? limits.brushMaxHeightM : limits.brushMaxDepthM;
    let amplitude = isRaise ? op.heightM : op.depthM;
    if (amplitude > limit) {
      amplitude = limit;
      clamped.push(isRaise ? "height" : "depth");
    }
    const signed = isRaise ? amplitude : -amplitude;
    delta = new Float64Array(fp.weight.length);
    for (let k = 0; k < delta.length; k++) delta[k] = signed * fp.weight[k]!;
  }

  const scale = slopeScale(state, fp, delta, limits.brushMaxSlopeDeg);
  if (scale < 1) clamped.push("slope");
  return applyDelta(state, fp, delta, scale, clamped);
}

function harden(
  state: TerrainState,
  fp: Footprint,
  requested: number,
  [lo, hi]: readonly [number, number],
  clamped: ClampReason[],
): ToolResult {
  const target = Math.min(hi, Math.max(lo, requested));
  if (target !== requested) clamped.push("hardness");
  const stored = Math.fround(target);
  const { hardness } = state.layers;
  let changed = false;
  for (let k = 0; k < fp.inside.length; k++) {
    if (!fp.inside[k]) continue;
    const i = cellIndex(state.gridSize, fp.x0 + (k % fp.width), fp.y0 + Math.floor(k / fp.width));
    if (hardness[i] !== stored) changed = true;
    hardness[i] = stored;
  }
  return { applied: changed, clamped, volumeChangeM3: 0 };
}

/** Cardinal neighbour offsets in a fixed order (west, east, north, south). */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const EAST_AND_SOUTH: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
];

function groundAt(state: TerrainState, i: number): number {
  return state.layers.bedrockM[i]! + state.layers.sedimentM[i]!;
}

/**
 * Conservative relaxation towards the local mean: every cardinal pair of cells inside the brush exchanges
 * `(strength / 4) × min(w_i, w_j) × (z_i − z_j)`. A cell with all four neighbours at full weight moves
 * `strength` of the way to their mean. Each exchange is debited from one cell and credited to the other,
 * so the total is unchanged (up to float32 storage).
 */
function smoothDelta(state: TerrainState, fp: Footprint, strength: number): Float64Array {
  const delta = new Float64Array(fp.weight.length);
  const n = state.gridSize;
  const k4 = strength / 4;
  for (let ly = 0; ly < fp.height; ly++) {
    for (let lx = 0; lx < fp.width; lx++) {
      const k = ly * fp.width + lx;
      if (!fp.inside[k]) continue;
      // East and south partners only, so each pair is visited once.
      for (const [dx, dy] of EAST_AND_SOUTH) {
        const jx = lx + dx;
        const jy = ly + dy;
        if (jx >= fp.width || jy >= fp.height) continue;
        const kj = jy * fp.width + jx;
        if (!fp.inside[kj]) continue;
        const zi = groundAt(state, cellIndex(n, fp.x0 + lx, fp.y0 + ly));
        const zj = groundAt(state, cellIndex(n, fp.x0 + jx, fp.y0 + jy));
        const flow = k4 * Math.min(fp.weight[k]!, fp.weight[kj]!) * (zi - zj);
        delta[k] = delta[k]! - flow;
        delta[kj] = delta[kj]! + flow;
      }
    }
  }
  return delta;
}

/**
 * The largest factor in [0, 1] by which `delta` can be applied without any cardinal neighbour pair ending
 * steeper than `maxSlopeDeg`. A pair that is already steeper may not be made steeper, but may be eased.
 */
function slopeScale(state: TerrainState, fp: Footprint, delta: Float64Array, maxSlopeDeg: number): number {
  const n = state.gridSize;
  const limitM = Math.tan((maxSlopeDeg * Math.PI) / 180) * state.metresPerCell;
  let scale = 1;
  for (let ly = 0; ly < fp.height; ly++) {
    for (let lx = 0; lx < fp.width; lx++) {
      const k = ly * fp.width + lx;
      const di = delta[k]!;
      if (di === 0) continue;
      const x = fp.x0 + lx;
      const y = fp.y0 + ly;
      const zi = groundAt(state, cellIndex(n, x, y));
      for (const [dx, dy] of NEIGHBOURS) {
        const jx = x + dx;
        const jy = y + dy;
        if (jx < 0 || jy < 0 || jx >= n || jy >= n) continue;
        const ljx = lx + dx;
        const ljy = ly + dy;
        const inBox = ljx >= 0 && ljy >= 0 && ljx < fp.width && ljy < fp.height;
        const dj = inBox ? delta[ljy * fp.width + ljx]! : 0;
        const g0 = zi - groundAt(state, cellIndex(n, jx, jy));
        const dg = di - dj;
        if (dg === 0) continue;
        const bound = Math.max(limitM, Math.abs(g0));
        // Need |g0 + s·dg| ≤ bound; g0 already satisfies it, so only the side dg moves towards binds.
        const s = dg > 0 ? (bound - g0) / dg : (-bound - g0) / dg;
        if (s < scale) scale = Math.max(0, s);
      }
    }
  }
  return scale;
}

function applyDelta(
  state: TerrainState,
  fp: Footprint,
  delta: Float64Array,
  scale: number,
  clamped: ClampReason[],
): ToolResult {
  const { bedrockM, sedimentM } = state.layers;
  const n = state.gridSize;
  let changeM = 0;
  let changed = false;
  if (scale > 0) {
    for (let k = 0; k < delta.length; k++) {
      const d = delta[k]! * scale;
      if (d === 0) continue;
      const i = cellIndex(n, fp.x0 + (k % fp.width), fp.y0 + Math.floor(k / fp.width));
      const b0 = bedrockM[i]!;
      const s0 = sedimentM[i]!;
      if (d > 0) {
        sedimentM[i] = s0 + d; // new material is loose
      } else {
        const fromSediment = Math.min(s0, -d);
        sedimentM[i] = fromSediment === s0 ? 0 : s0 - fromSediment;
        bedrockM[i] = b0 - (-d - fromSediment);
      }
      const b1 = bedrockM[i]!;
      const s1 = sedimentM[i]!;
      if (b1 !== b0 || s1 !== s0) changed = true;
      changeM += b1 - b0 + (s1 - s0);
    }
  }
  return { applied: changed, clamped, volumeChangeM3: changeM * state.metresPerCell * state.metresPerCell };
}
