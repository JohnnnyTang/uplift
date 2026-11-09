/** Persistent clean-water sources live in the solver; terrain brushes use the shared applyBrush primitive. */
import {
  type ClampReason,
  type TerrainConfig,
  type ToolOp,
  type ToolResult,
  cellAt,
} from "../contract/index";
import type { BrushOp } from "../tools/index";
import { MM_PER_HR_TO_M_PER_S } from "./constants";
import type { CpuBuffers } from "./kernel";
export interface WaterSource {
  readonly cells: Int32Array;
  readonly depthRateMPerS: number;
}
export interface ToolContext {
  readonly buf: CpuBuffers;
  readonly config: TerrainConfig;
  readonly sources: Map<string, WaterSource>;
}
export function rebuildSourceRate(buf: CpuBuffers, sources: ReadonlyMap<string, WaterSource>): void {
  buf.sourceRateMPerS.fill(0);
  for (const source of sources.values())
    for (const i of source.cells) buf.sourceRateMPerS[i] += source.depthRateMPerS;
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
}
export function applyCpuTool(ctx: ToolContext, op: Exclude<ToolOp, BrushOp>): ToolResult {
  const { buf, config, sources } = ctx;
  if (op.kind === "remove-source") {
    const applied = sources.delete(op.id);
    if (applied) rebuildSourceRate(buf, sources);
    return { applied, clamped: [], volumeChangeM3: 0 };
  }
  if (!cellAt(buf.n, buf.l, op.at)) return { applied: false, clamped: ["off-grid"], volumeChangeM3: 0 };
  if (op.kind === "spring") {
    positive(op.flowM3PerS, "flowM3PerS");
    const cell = cellAt(buf.n, buf.l, op.at)!;
    sources.set(op.id, {
      cells: Int32Array.of(cell.y * buf.n + cell.x),
      depthRateMPerS: op.flowM3PerS / buf.area,
    });
    rebuildSourceRate(buf, sources);
    return { applied: true, clamped: [], volumeChangeM3: 0 };
  }
  positive(op.rainMmPerHr, "rainMmPerHr");
  positive(op.radiusM, "radiusM");
  const clamped: ClampReason[] = [];
  const radiusM = Math.max(buf.l, Math.min(op.radiusM, config.brushMaxRadiusM, (buf.n * buf.l) / 4));
  if (radiusM !== op.radiusM) clamped.push("radius");
  const cells: number[] = [];
  const x0 = Math.max(0, Math.floor((op.at.xM - radiusM) / buf.l)),
    x1 = Math.min(buf.n - 1, Math.floor((op.at.xM + radiusM) / buf.l));
  const y0 = Math.max(0, Math.floor((op.at.yM - radiusM) / buf.l)),
    y1 = Math.min(buf.n - 1, Math.floor((op.at.yM + radiusM) / buf.l));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (Math.hypot((x + 0.5) * buf.l - op.at.xM, (y + 0.5) * buf.l - op.at.yM) <= radiusM)
        cells.push(y * buf.n + x);
  sources.set(op.id, {
    cells: Int32Array.from(cells),
    depthRateMPerS: op.rainMmPerHr * MM_PER_HR_TO_M_PER_S,
  });
  rebuildSourceRate(buf, sources);
  return { applied: true, clamped, volumeChangeM3: 0 };
}
