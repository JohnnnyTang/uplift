/**
 * Reader tools applied to the CPU solver's float64 state, between steps.
 *
 * PLACEHOLDER FOR THE BRUSH OPS. Session 2B owns the brush tools (`hachure/terrain/src/tools/`,
 * `applyBrush(state, op, limits): ToolResult`, PR #8, not on main when 2A was written). Once both are on
 * main, `applyCpuTool` should hand raise/dig/smooth/harden to `applyBrush` and keep only the source ops
 * (spring, rain-source, remove-source), which are solver state. Because the solver's authoritative state is
 * float64, the swap must run `applyBrush` on the float32 mirror and copy back only the cells it changed
 * (see DECISIONS.md D-2A-1). The caller adds `volumeChangeM3` to `toolNetM3`.
 *
 * Behaviour follows `docs/science/parameters.md` ("Reader controls and joint clamps"):
 * - raise adds loose sediment; dig removes sediment first, then bedrock; both are budgeted in `toolNetM3`;
 * - per-application height/depth ≤ `brushMaxHeightM`/`brushMaxDepthM`;
 * - radius between one cell and `min(brushMaxRadiusM, gridSize × metresPerCell / 4)`;
 * - the applied amplitude is limited so no edited face becomes steeper than `brushMaxSlopeDeg` (a face that
 *   was already steeper may not steepen further), and the clamp is reported;
 * - smooth conserves solid volume exactly (its net is still counted, so the ledger stays honest);
 * - harden writes exposed-column hardness, clamped to `hardnessRange`.
 *
 * Tools may allocate (they run between steps, not inside `step()`).
 */
import {
  type ClampReason,
  type PointM,
  type TerrainConfig,
  type ToolOp,
  type ToolResult,
  cellAt,
} from "../contract/index";
import { MM_PER_HR_TO_M_PER_S } from "./constants";
import type { CpuBuffers } from "./kernel";

/** A persistent water source: extra depth rate on a set of cells. */
export interface WaterSource {
  readonly cells: Int32Array;
  /** Water depth added per second on each listed cell (unit: m/s). */
  readonly depthRateMPerS: number;
}

export interface ToolContext {
  readonly buf: CpuBuffers;
  readonly config: TerrainConfig;
  readonly sources: Map<string, WaterSource>;
}

interface DiskCell {
  readonly i: number;
  readonly x: number;
  readonly y: number;
  /** Distance from the brush centre to the cell centre (unit: m). */
  readonly d: number;
}

const NOT_APPLIED_OFF_GRID: ToolResult = Object.freeze({
  applied: false,
  clamped: Object.freeze(["off-grid"]) as readonly ClampReason[],
  volumeChangeM3: 0,
});

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number, got ${value}`);
}

/** Rebuilds the per-cell source rate from the source map, in insertion order (deterministic). */
export function rebuildSourceRate(buf: CpuBuffers, sources: ReadonlyMap<string, WaterSource>): void {
  const rate = buf.sourceRateMPerS;
  rate.fill(0);
  for (const source of sources.values()) {
    for (let k = 0; k < source.cells.length; k++) {
      const i = source.cells[k]!;
      rate[i] = rate[i]! + source.depthRateMPerS;
    }
  }
}

function cellsInDisk(buf: CpuBuffers, at: PointM, radiusM: number): DiskCell[] {
  const { n, l } = buf;
  const out: DiskCell[] = [];
  const x0 = Math.max(0, Math.floor((at.xM - radiusM) / l));
  const x1 = Math.min(n - 1, Math.floor((at.xM + radiusM) / l));
  const y0 = Math.max(0, Math.floor((at.yM - radiusM) / l));
  const y1 = Math.min(n - 1, Math.floor((at.yM + radiusM) / l));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x + 0.5) * l - at.xM, (y + 0.5) * l - at.yM);
      if (d <= radiusM) out.push({ i: y * n + x, x, y, d });
    }
  }
  return out;
}

/** Clamps the radius to [one cell, min(brushMaxRadiusM, domain width / 4)]. */
function clampRadius(ctx: ToolContext, radiusM: number, clamped: ClampReason[]): number {
  const { l, n } = ctx.buf;
  const max = Math.min(ctx.config.brushMaxRadiusM, (n * l) / 4);
  if (radiusM > max) {
    clamped.push("radius");
    return max;
  }
  if (radiusM < l) {
    clamped.push("radius");
    return l;
  }
  return radiusM;
}

/**
 * Largest factor α in [0, 1] such that adding `α × delta` to the ground makes no cardinal face steeper
 * than `max(tan(maxSlope) × l, its current steepness)`.
 */
function slopeLimitFactor(
  buf: CpuBuffers,
  delta: Float64Array,
  cells: readonly DiskCell[],
  maxSlopeDeg: number,
): number {
  const { n, l, b, s } = buf;
  const limit = Math.tan((maxSlopeDeg * Math.PI) / 180) * l;
  let alpha = 1;
  const face = (i: number, j: number) => {
    const dz0 = b[i]! + s[i]! - (b[j]! + s[j]!);
    const dh = delta[i]! - delta[j]!;
    if (dh === 0) return;
    const after = Math.abs(dz0 + dh);
    const bound = Math.max(limit, Math.abs(dz0));
    if (after <= bound) return;
    const a = dh > 0 ? (bound - dz0) / dh : (bound + dz0) / -dh;
    if (a < alpha) alpha = Math.max(0, a);
  };
  for (const { i, x, y } of cells) {
    if (x > 0) face(i, i - 1);
    if (x < n - 1) face(i, i + 1);
    if (y > 0) face(i, i - n);
    if (y < n - 1) face(i, i + n);
  }
  return alpha;
}

/** Adds `dz` to the ground: positive as loose sediment, negative from sediment first, then bedrock. */
function applyGroundChange(buf: CpuBuffers, i: number, dz: number): number {
  if (dz >= 0) {
    buf.s[i] = buf.s[i]! + dz;
    return dz;
  }
  const remove = -dz;
  const fromSediment = Math.min(buf.s[i]!, remove);
  buf.s[i] = buf.s[i]! - fromSediment;
  buf.b[i] = buf.b[i]! - (remove - fromSediment);
  return dz;
}

export function applyCpuTool(ctx: ToolContext, op: ToolOp): ToolResult {
  const { buf, config, sources } = ctx;
  switch (op.kind) {
    case "remove-source": {
      const removed = sources.delete(op.id);
      if (removed) rebuildSourceRate(buf, sources);
      return { applied: removed, clamped: [], volumeChangeM3: 0 };
    }
    case "spring": {
      requireFinite("flowM3PerS", op.flowM3PerS);
      if (op.flowM3PerS < 0) throw new RangeError(`flowM3PerS must be ≥ 0, got ${op.flowM3PerS}`);
      const cell = cellAt(buf.n, buf.l, op.at);
      if (!cell) return NOT_APPLIED_OFF_GRID;
      sources.set(op.id, {
        cells: Int32Array.of(cell.y * buf.n + cell.x),
        depthRateMPerS: op.flowM3PerS / buf.area,
      });
      rebuildSourceRate(buf, sources);
      return { applied: true, clamped: [], volumeChangeM3: 0 };
    }
    default:
      break;
  }

  requireFinite("radiusM", op.radiusM);
  if (!cellAt(buf.n, buf.l, op.at)) return NOT_APPLIED_OFF_GRID;
  const clamped: ClampReason[] = [];
  const radiusM = clampRadius(ctx, op.radiusM, clamped);
  const cells = cellsInDisk(buf, op.at, radiusM);

  switch (op.kind) {
    case "harden": {
      requireFinite("hardness", op.hardness);
      const [lo, hi] = config.hardnessRange;
      const target = Math.min(hi, Math.max(lo, op.hardness));
      if (target !== op.hardness) clamped.push("hardness");
      for (const { i } of cells) buf.hardness[i] = target;
      return { applied: cells.length > 0, clamped, volumeChangeM3: 0 };
    }
    case "rain-source": {
      requireFinite("rainMmPerHr", op.rainMmPerHr);
      if (op.rainMmPerHr < 0) throw new RangeError(`rainMmPerHr must be ≥ 0, got ${op.rainMmPerHr}`);
      sources.set(op.id, {
        cells: Int32Array.from(cells, (c) => c.i),
        depthRateMPerS: op.rainMmPerHr * MM_PER_HR_TO_M_PER_S,
      });
      rebuildSourceRate(buf, sources);
      return { applied: true, clamped, volumeChangeM3: 0 };
    }
    case "smooth": {
      requireFinite("strength", op.strength);
      if (op.strength < 0 || op.strength > 1)
        throw new RangeError(`strength must lie in [0, 1], got ${op.strength}`);
      if (cells.length === 0) return { applied: false, clamped, volumeChangeM3: 0 };
      const { n, b, s, area } = buf;
      const delta = new Float64Array(cells.length);
      let total = 0;
      cells.forEach(({ i, x, y }, k) => {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            const j = yy * n + xx;
            sum += b[j]! + s[j]!;
            count++;
          }
        }
        delta[k] = (sum / count - (b[i]! + s[i]!)) * op.strength;
        total += delta[k]!;
      });
      const mean = total / cells.length;
      let net = 0;
      cells.forEach(({ i }, k) => {
        net += applyGroundChange(buf, i, delta[k]! - mean);
      });
      const volume = net * area;
      return { applied: true, clamped, volumeChangeM3: volume };
    }
    case "raise":
    case "dig": {
      const raise = op.kind === "raise";
      const requested = raise ? op.heightM : op.depthM;
      requireFinite(raise ? "heightM" : "depthM", requested);
      const limit = raise ? config.brushMaxHeightM : config.brushMaxDepthM;
      let amplitude = Math.max(0, requested);
      if (amplitude > limit) {
        amplitude = limit;
        clamped.push(raise ? "height" : "depth");
      }
      if (amplitude === 0 || cells.length === 0) return { applied: false, clamped, volumeChangeM3: 0 };
      // Raised-cosine profile, peaking at the centre.
      const sign = raise ? 1 : -1;
      const delta = new Float64Array(buf.cells);
      for (const { i, d } of cells)
        delta[i] = sign * amplitude * 0.5 * (1 + Math.cos((Math.PI * d) / radiusM));
      const alpha = slopeLimitFactor(buf, delta, cells, config.brushMaxSlopeDeg);
      if (alpha < 1) clamped.push("slope");
      if (alpha <= 0) return { applied: false, clamped, volumeChangeM3: 0 };
      let net = 0;
      for (const { i } of cells) net += applyGroundChange(buf, i, alpha * delta[i]!);
      const volume = net * buf.area;
      return { applied: volume !== 0, clamped, volumeChangeM3: volume };
    }
  }
}
