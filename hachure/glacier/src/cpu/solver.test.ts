/**
 * CPU glacier solver: determinism, conservation, controls and view-only guarantees on a small grid.
 */
import { describe, expect, it } from "vitest";
import type { GlacierConfig } from "../contract/index";
import { ROCK_TYPES } from "../contract/index";
import { gridScaleShare } from "../testing/ripple";
import { createCpuGlacier } from "./index";

/** A 40 × 32 version of the authored valley; same physics, fewer cells. */
const SMALL: Partial<GlacierConfig> = {
  nx: 40,
  ny: 32,
  metresPerCell: 120,
  dtYears: 0.05,
  // The coarse test glacier is thin; let all of it slide so erosion is exercised.
  slidingOnsetIceThicknessM: 0,
  fullSlidingIceThicknessM: 1,
};
const YEARS = 60;

function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k]!;
  return s;
}

describe("CPU glacier", () => {
  it("is deterministic: same config gives a bitwise-identical state, however the steps are chunked", () => {
    const a = createCpuGlacier(SMALL);
    const b = createCpuGlacier(SMALL);
    a.advanceYears(YEARS);
    const steps = Math.round(YEARS / SMALL.dtYears!);
    for (let s = 0; s < steps; s++) b.advance(1);
    expect(a.step).toBe(steps);
    expect(a.hash()).toBe(b.hash());
    expect(a.budget()).toEqual(b.budget());
  });

  it("a different seed gives a different start and run", () => {
    const a = createCpuGlacier(SMALL);
    const b = createCpuGlacier({ ...SMALL, seed: 2 });
    expect(a.hash()).not.toBe(b.hash());
  });

  it("view calls never change the model", () => {
    const a = createCpuGlacier(SMALL);
    const b = createCpuGlacier(SMALL);
    for (let y = 0; y < YEARS; y += 10) {
      a.advanceYears(10);
      b.advanceYears(10);
      b.snapshot();
      b.probes();
      b.section(20);
      b.budget();
      b.diagnostics();
      b.hash();
    }
    expect(b.hash()).toBe(a.hash());
  });

  it("conserves ice: volume equals applied mass balance minus edge outflow, and thickness stays non-negative", () => {
    const g = createCpuGlacier(SMALL);
    g.advanceYears(YEARS);
    const budget = g.budget();
    expect(budget.surfaceMassBalanceM3).toBeGreaterThan(0);
    const volume = g.probes().iceVolumeM3;
    expect(Math.abs(budget.residualM3)).toBeLessThan(1e-9 * Math.max(1, volume) + 1e-3);
    expect(Math.min(...g.fields.iceThicknessM)).toBeGreaterThanOrEqual(0);
    expect(g.probes().iceVolumeM3).toBeGreaterThan(0);
  });

  it("wall failure conserves rock: net bed lowering equals the glacial erosion it integrates", () => {
    // With erosion on, the only net loss of rock is erosion; wall failure only moves rock.
    const g = createCpuGlacier({ ...SMALL, rockId: "shale" });
    g.advanceYears(YEARS);
    const area = SMALL.metresPerCell! ** 2;
    const net = (sum(g.fields.initialBedM) - sum(g.fields.bedM)) * area;
    expect(g.probes().erodedVolumeM3).toBeCloseTo(net, 3);
    expect(net).toBeGreaterThan(0);
  });

  it("control: without ice the valley never changes, even in the weakest rock", () => {
    // On the reference grid: the authored start must hold even in the weakest rock.
    const g = createCpuGlacier({ iceEnabled: false, rockId: "shale", dtYears: 0.05 });
    const before = Float64Array.from(g.fields.bedM);
    g.advanceYears(YEARS);
    expect(g.fields.bedM).toEqual(before);
    expect(g.probes().iceVolumeM3).toBe(0);
  });

  it("control: with erosion off the ice flows but the bed never changes", () => {
    const g = createCpuGlacier({ ...SMALL, erosionEnabled: false });
    const before = Float64Array.from(g.fields.bedM);
    g.advanceYears(YEARS);
    expect(g.fields.bedM).toEqual(before);
    expect(g.probes().iceVolumeM3).toBeGreaterThan(0);
    expect(g.probes().maxSurfaceSpeedMPerYear).toBeGreaterThan(0);
  });

  it("softer rock erodes more than harder rock under the same ice", () => {
    const eroded = (rockId: GlacierConfig["rockId"]) => {
      const g = createCpuGlacier({ ...SMALL, rockId });
      g.advanceYears(YEARS);
      return g.probes().erodedVolumeM3;
    };
    const shale = eroded("shale");
    const granite = eroded("granite");
    expect(shale).toBeGreaterThan(granite);
    expect(ROCK_TYPES.shale.relativeErodibility).toBeGreaterThan(ROCK_TYPES.granite.relativeErodibility);
  });

  it("snapshots carry every layer at the grid size, with zero velocity where ice-free", () => {
    const g = createCpuGlacier(SMALL);
    g.advanceYears(20);
    const s = g.snapshot();
    const n = SMALL.nx! * SMALL.ny!;
    for (const layer of [
      "bedM",
      "iceThicknessM",
      "surfaceVelocityXMPerYear",
      "surfaceVelocityYMPerYear",
    ] as const) {
      expect(s[layer]).toBeInstanceOf(Float32Array);
      expect(s[layer].length).toBe(n);
    }
    for (let k = 0; k < n; k++) {
      if (s.iceThicknessM[k] === 0) {
        expect(s.surfaceVelocityXMPerYear[k]).toBe(0);
        expect(s.surfaceVelocityYMPerYear[k]).toBe(0);
      }
    }
    expect(s.modelYears).toBeCloseTo(20, 9);
  });

  it("rejects a bed of the wrong size and negative step counts", () => {
    expect(() => createCpuGlacier(SMALL, { bedM: new Float64Array(10) })).toThrow(/cells/);
    expect(() => createCpuGlacier(SMALL).advance(-1)).toThrow(RangeError);
  });

  it("an odd/even bed ripple under a smooth ice surface does not make an odd/even sliding (erosion) pattern", () => {
    // Session 5G2 found a grid-scale (2Δx) mode: with a centred gradient and the cell's own thickness,
    // a low cell (thicker ice) slid and eroded faster than its neighbours and the ripple fed itself.
    const nx = 40;
    const ny = 16;
    const dx = 40;
    const bed = new Float64Array(nx * ny);
    const ice = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const h = 200 + 20 * (i % 2 === 0 ? 1 : -1);
        ice[j * nx + i] = h;
        bed[j * nx + i] = 2000 - 0.05 * i * dx - h; // smooth surface, rippled bed
      }
    const g = createCpuGlacier(
      { nx, ny, metresPerCell: dx, lateralDragEnabled: false },
      { bedM: bed, iceThicknessM: ice },
    );
    const row = Array.from(g.fields.slidingSpeedMPerYear.subarray(8 * nx, 9 * nx));
    expect(Math.min(...row.slice(2, nx - 2))).toBeGreaterThan(0);
    // Without the edge-mean thickness this share is ≈ 1 (sliding ∝ H² alternates by ±20 %).
    expect(gridScaleShare(row, 2, nx - 2)).toBeLessThan(1e-6);
  });
});
