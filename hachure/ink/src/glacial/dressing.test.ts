import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_DRESSING } from "../stage/dressing";
import { type LandscapeSnapshot, toBlockGrid } from "../stage/snapshot";
import { riverOnFilledBed, routeFilledBed, snoutRow, speedFlowLines } from "./dressing";

const columns = 21;
const rows = 40;
/**
 * A V valley along rows (head at row 0), floor falling downstream, ice in the upper half. `basinAt` carves a
 * closed hollow into the floor below the snout; `velocity` gives the ice a speed that peaks on the axis.
 */
function valley(options: { basinAt?: number; velocity?: boolean } = {}): LandscapeSnapshot {
  const n = columns * rows;
  const bedM = new Float32Array(n);
  const iceThicknessM = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const k = r * columns + c;
      const basin = options.basinAt === undefined ? 0 : Math.max(0, 60 - Math.abs(r - options.basinAt) * 20);
      bedM[k] = 1500 - r * 10 + Math.abs(c - 10) * 60 - (Math.abs(c - 10) <= 2 ? basin : 0);
      if (r < 18) iceThicknessM[k] = Math.max(0, 150 - Math.abs(c - 10) * 30);
      if (iceThicknessM[k]! > 0) vy[k] = 40 - Math.abs(c - 10) * 8;
    }
  return {
    columns,
    rows,
    metresPerCell: 50,
    bedM,
    iceThicknessM,
    ...(options.velocity ? { iceVelocityMPerYr: { x: vx, y: vy } } : {}),
  };
}

describe("riverOnFilledBed", () => {
  it("starts just below the snout, never steps up the valley or onto ice, and leaves at the front", () => {
    const g = toBlockGrid(valley());
    const snout = snoutRow(g);
    expect(snout).toBe(17);
    const path = riverOnFilledBed(g);
    const row = (k: number) => Math.floor(k / g.across);
    expect(row(path[0]!)).toBe(snout + 1);
    expect(row(path.at(-1)!)).toBe(g.along - 1);
    for (let i = 1; i < path.length; i++) expect(row(path[i]!)).toBeGreaterThanOrEqual(row(path[i - 1]!));
    for (const k of path) expect(g.iceM[k]!).toBeLessThanOrEqual(DEFAULT_DRESSING.iceThresholdM);
  });

  it("crosses a closed hollow below the snout at its spill level instead of stopping in it", () => {
    const g = toBlockGrid(valley({ basinAt: 26 }));
    const { filledM } = routeFilledBed(g);
    const axis = 26 * g.across + 10;
    expect(filledM[axis]! - g.bedM[axis]!).toBeGreaterThan(5);
    const path = riverOnFilledBed(g);
    expect(path).toContain(axis);
    expect(Math.floor(path.at(-1)! / g.across)).toBe(g.along - 1);
  });

  it("is deterministic", () => {
    const g = toBlockGrid(valley({ basinAt: 26 }));
    expect(riverOnFilledBed(g)).toEqual(riverOnFilledBed(g));
  });
});

describe("speedFlowLines", () => {
  it("follows the modelled velocity down the glacier, with longer marks where the ice is faster", () => {
    const g = toBlockGrid(valley({ velocity: true }));
    const lines = speedFlowLines(g);
    expect(lines.length).toBeGreaterThan(4);
    const length = (l: number[]) => {
      let s = 0;
      for (let i = 2; i < l.length; i += 2) s += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
      return s;
    };
    // Downstream only (rows increase along every mark), and never past the ice.
    for (const l of lines) {
      expect(l.at(-1)!).toBeGreaterThan(l[1]!);
      expect(l.at(-1)!).toBeLessThanOrEqual(18);
    }
    const onAxis = lines.filter((l) => Math.abs(l[0]! - 10) < 0.5).map(length);
    const offAxis = lines.filter((l) => Math.abs(l[0]! - 10) > 1).map(length);
    expect(Math.max(...onAxis)).toBeGreaterThan(Math.max(...offAxis));
    expect(speedFlowLines(g)).toEqual(lines);
  });

  it("falls back to the surface-slope rule without velocity", () => {
    expect(speedFlowLines(toBlockGrid(valley())).length).toBeGreaterThan(0);
  });
});

describe("glacial engine source", () => {
  it("uses no Math.random (placement comes from model state or a deterministic hash)", () => {
    const dir = new URL("./", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts")))
      expect(readFileSync(new URL(f, dir), "utf8")).not.toMatch(/Math\.random/);
  });
});
