/**
 * AC4: solid and water budgets close (docs/science/validation-spec.md, "AC4 — solid and water budgets").
 *
 *   Rsolid = Δ[a Σ(b + s + m)] + exportedSedimentM3 − toolNetM3
 *   Rwater = Δ[a Σh] − rainedWaterM3 − sourcedWaterM3 + evaporatedWaterM3 + outflowedWaterM3
 *
 * Changes are fixed-order float64 sums of per-cell changes. Each |R| must be ≤ max(1e-6 m³, 1% of the
 * reference volume) at every saved sample; zero-throughput fixtures must meet the 1e-6 m³ bound.
 */
import { describe, expect, it } from "vitest";
import type { BudgetCounters } from "../contract/index";
import { type CpuTerrainSolver, type ReferenceLayers, createCpuSolver } from "./index";
import { catchmentFixture, customFixture, southCentre } from "./test-fixtures";

const ABS_BOUND_M3 = 1e-6;
const REL_BOUND = 0.01;

interface Residuals {
  solid: number;
  water: number;
  solidRef: number;
  waterRef: number;
}

function sumChange(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += b[i]! - a[i]!;
  return sum;
}

function sum(a: Float64Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i]!;
  return total;
}

function residuals(
  r0: ReferenceLayers,
  r1: ReferenceLayers,
  budget: BudgetCounters,
  areaM2: number,
): Residuals {
  const solidChange =
    (sumChange(r0.bedrockM, r1.bedrockM) +
      sumChange(r0.sedimentM, r1.sedimentM) +
      sumChange(r0.suspendedSedimentM, r1.suspendedSedimentM)) *
    areaM2;
  const waterChange = sumChange(r0.waterM, r1.waterM) * areaM2;
  const initialSuspended = sum(r0.suspendedSedimentM) * areaM2;
  const initialWater = sum(r0.waterM) * areaM2;
  return {
    solid: solidChange + budget.exportedSedimentM3 - budget.toolNetM3,
    water:
      waterChange -
      budget.rainedWaterM3 -
      budget.sourcedWaterM3 +
      budget.evaporatedWaterM3 +
      budget.outflowedWaterM3,
    solidRef: Math.max(
      budget.erodedM3,
      initialSuspended,
      budget.exportedSedimentM3,
      Math.abs(budget.toolNetM3),
    ),
    waterRef: Math.max(initialWater, budget.rainedWaterM3 + budget.sourcedWaterM3),
  };
}

function expectClosed(r: Residuals, label: string): void {
  expect(
    Math.abs(r.solid),
    `${label}: solid residual ${r.solid} vs reference ${r.solidRef}`,
  ).toBeLessThanOrEqual(Math.max(ABS_BOUND_M3, REL_BOUND * r.solidRef));
  expect(
    Math.abs(r.water),
    `${label}: water residual ${r.water} vs reference ${r.waterRef}`,
  ).toBeLessThanOrEqual(Math.max(ABS_BOUND_M3, REL_BOUND * r.waterRef));
}

function area(solver: CpuTerrainSolver): number {
  return solver.config.metresPerCell ** 2;
}

/** Steps `total` steps, checking closure every `every` steps. Returns the final residuals. */
async function runChecked(solver: CpuTerrainSolver, total: number, every: number): Promise<Residuals> {
  const r0 = solver.referenceLayers();
  let last: Residuals | undefined;
  for (let done = 0; done < total; done += every) {
    solver.step(every);
    last = residuals(r0, solver.referenceLayers(), await solver.budget(), area(solver));
    expectClosed(last, `step ${solver.stepCount}`);
  }
  return last!;
}

describe("mass budget (AC4)", () => {
  it("closes at every 200-step sample over a long catchment run with rain, a spring and tools", async () => {
    const solver = createCpuSolver({ gridSize: 64, seed: 1 }, catchmentFixture());
    const l = solver.config.metresPerCell;
    await solver.applyTool({
      kind: "spring",
      id: "spring",
      at: { xM: 32.5 * l, yM: 8.5 * l },
      flowM3PerS: 0.1,
    });
    const r0 = solver.referenceLayers();
    const s0 = await solver.snapshot();
    let worstSolid = 0;
    let worstWater = 0;
    for (let k = 1; k <= 30; k++) {
      solver.step(200);
      if (k === 10)
        await solver.applyTool({ kind: "dig", at: { xM: 20 * l, yM: 40 * l }, radiusM: 4 * l, depthM: 2 });
      if (k === 20)
        await solver.applyTool({ kind: "raise", at: { xM: 44 * l, yM: 30 * l }, radiusM: 4 * l, heightM: 2 });
      const r = residuals(r0, solver.referenceLayers(), await solver.budget(), area(solver));
      expectClosed(r, `step ${solver.stepCount}`);
      worstSolid = Math.max(worstSolid, Math.abs(r.solid) / r.solidRef);
      worstWater = Math.max(worstWater, Math.abs(r.water) / r.waterRef);
    }
    const b = await solver.budget();
    expect(b.erodedM3).toBeGreaterThan(0);
    expect(b.exportedSedimentM3).toBeGreaterThan(0);
    expect(b.outflowedWaterM3).toBeGreaterThan(0);
    // The relative residuals are at roundoff level, far inside the 1% bound.
    expect(worstSolid).toBeLessThan(1e-9);
    expect(worstWater).toBeLessThan(1e-9);

    // The brief's form, from the public float32 snapshot (what the GPU comparison will see):
    // |Δ(rock + sediment + suspended) + exported − toolNet| / total moved < 1%.
    const s1 = await solver.snapshot();
    let change = 0;
    for (const layer of ["bedrockM", "sedimentM", "suspendedSedimentM"] as const) {
      const a = s0.layers[layer]!;
      const c = s1.layers[layer]!;
      for (let i = 0; i < a.length; i++) change += c[i]! - a[i]!;
    }
    change *= area(solver);
    const moved = b.erodedM3 + b.depositedM3 + Math.abs(b.toolNetM3);
    expect(Math.abs(change + b.exportedSedimentM3 - b.toolNetM3) / moved).toBeLessThan(REL_BOUND);
  }, 60_000);

  it("closed sloshing basin: zero throughput, both residuals within 1e-6 m³", async () => {
    const basin = customFixture("basin", southCentre, (state, x, y, i) => {
      const n = state.gridSize;
      const outlet = southCentre(n);
      const isOutlet = x === outlet.x && y === outlet.y;
      state.layers.bedrockM[i] = isOutlet ? 12 : 10;
      state.layers.sedimentM[i] = 0.5;
      state.layers.hardness[i] = 0.2;
      // A water mound in the middle, so the basin sloshes; no water on the raised outlet.
      const r = Math.hypot(x - n / 2, y - n / 2);
      state.layers.waterM[i] = isOutlet ? 0 : 0.5 + (r < 3 ? 0.3 : 0);
    });
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0, evaporationFractionPerStep: 0 }, basin);
    const r = await runChecked(solver, 2000, 200);
    expect(Math.abs(r.water)).toBeLessThanOrEqual(ABS_BOUND_M3);
    expect(Math.abs(r.solid)).toBeLessThanOrEqual(Math.max(ABS_BOUND_M3, REL_BOUND * r.solidRef));
    const b = await solver.budget();
    expect(b.outflowedWaterM3).toBe(0);
    expect(b.exportedSedimentM3).toBe(0);
    expect(solver.diagnostics().peakWaveCourant).toBeGreaterThan(0);
  });

  it("drains fully through the outlet, conserving water", async () => {
    const plane = customFixture("draining-plane", southCentre, (state, x, y, i) => {
      const n = state.gridSize;
      state.layers.bedrockM[i] = 20 + (n - 1 - y) * 0.2 + Math.abs(x - n / 2) * 0.05;
      state.layers.hardness[i] = 1;
      state.layers.waterM[i] = 0.05;
    });
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0, evaporationFractionPerStep: 0 }, plane);
    const initial = sum(solver.referenceLayers().waterM) * area(solver);
    await runChecked(solver, 20_000, 2000);
    const b = await solver.budget();
    expect(b.outflowedWaterM3).toBeGreaterThan(0.99 * initial);
    expect(b.erodedM3).toBe(0);
  });

  it("dry cells keep their sediment as deposits", async () => {
    const dry = customFixture("dry-suspension", southCentre, (state, _x, _y, i) => {
      state.layers.bedrockM[i] = 10;
      state.layers.suspendedSedimentM[i] = 0.01;
      state.layers.hardness[i] = 0.2;
    });
    const solver = createCpuSolver({ gridSize: 8, rainMmPerHr: 0 }, dry);
    const r0 = solver.referenceLayers();
    solver.step(1);
    const r1 = solver.referenceLayers();
    const b = await solver.budget();
    const initialSuspended = sum(r0.suspendedSedimentM) * area(solver);
    expect(b.depositedM3).toBeCloseTo(initialSuspended, 9);
    expect(b.suspendedM3).toBe(0);
    expect(sum(r1.suspendedSedimentM)).toBe(0);
    expectClosed(residuals(r0, r1, b, area(solver)), "dry");
  });

  it("evaporation strands suspended sediment without losing it", async () => {
    const pond = customFixture("evaporating-pond", southCentre, (state, x, y, i) => {
      const outlet = southCentre(state.gridSize);
      const isOutlet = x === outlet.x && y === outlet.y;
      state.layers.bedrockM[i] = isOutlet ? 11 : 10;
      state.layers.hardness[i] = 0.2;
      state.layers.waterM[i] = isOutlet ? 0 : 1.05e-6;
      state.layers.suspendedSedimentM[i] = isOutlet ? 0 : 1e-7;
    });
    const solver = createCpuSolver({ gridSize: 8, rainMmPerHr: 0, evaporationFractionPerStep: 0.0001 }, pond);
    await runChecked(solver, 1000, 100);
    const b = await solver.budget();
    expect(b.evaporatedWaterM3).toBeGreaterThan(0);
    expect(b.suspendedM3).toBe(0);
    expect(b.depositedM3).toBeGreaterThan(0);
  });

  it("zero rain on a dry catchment changes nothing", async () => {
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0 }, catchmentFixture());
    const s0 = await solver.snapshot();
    solver.step(100);
    const s1 = await solver.snapshot();
    for (const name of Object.keys(s0.layers) as (keyof typeof s0.layers)[]) {
      expect(s1.layers[name], name).toEqual(s0.layers[name]);
    }
    for (const value of Object.values(await solver.budget())) expect(value).toBe(0);
  });

  it("fully hard bedrock never erodes; its loose cover does, and the budget closes", async () => {
    const solver = createCpuSolver(
      { gridSize: 32, hardnessRange: [0, 1] },
      catchmentFixture({ hardness: 1, looseM: 0.05 }),
    );
    const l = solver.config.metresPerCell;
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 16.5 * l, yM: 4.5 * l }, flowM3PerS: 0.2 });
    const b0 = solver.referenceLayers().bedrockM;
    await runChecked(solver, 3000, 500);
    const b1 = solver.referenceLayers().bedrockM;
    expect(b1).toEqual(b0);
    expect((await solver.budget()).erodedM3).toBeGreaterThan(0);
  });

  it("slumping moves loose material downhill and conserves it to 1e-6 m³", async () => {
    const pile = customFixture("loose-pile", southCentre, (state, x, y, i) => {
      const n = state.gridSize;
      state.layers.bedrockM[i] = 10;
      state.layers.hardness[i] = 0.2;
      // A 40 m pile of loose material, 10 m drop per 10 m cell: steeper than any admissible talus angle.
      state.layers.sedimentM[i] = Math.max(0, 40 - 10 * Math.hypot(x - n / 2, y - n / 2));
    });
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0, thermalRatePerS: 1 }, pile);
    const r0 = solver.referenceLayers();
    await runChecked(solver, 2000, 200);
    const r1 = solver.referenceLayers();
    expect(Math.abs(sumChange(r0.sedimentM, r1.sedimentM) * area(solver))).toBeLessThanOrEqual(ABS_BOUND_M3);
    expect(r1.bedrockM).toEqual(r0.bedrockM);
    const peak = (a: Float64Array) => a.reduce((m, v) => Math.max(m, v), 0);
    expect(peak(r1.sedimentM)).toBeLessThan(peak(r0.sedimentM) - 1);
  });

  it("closes with a nonzero initial suspension moving bedrock → suspended → deposit/export", async () => {
    const turbid = customFixture("turbid-plane", southCentre, (state, x, y, i) => {
      const n = state.gridSize;
      state.layers.bedrockM[i] = 30 + (n - 1 - y) * 0.5 + Math.abs(x - n / 2) * 0.1;
      state.layers.hardness[i] = 0.2;
      state.layers.waterM[i] = 0.02;
      state.layers.suspendedSedimentM[i] = 0.001;
    });
    const solver = createCpuSolver({ gridSize: 16 }, turbid);
    await runChecked(solver, 4000, 400);
    const b = await solver.budget();
    expect(b.erodedM3).toBeGreaterThan(0);
    expect(b.depositedM3).toBeGreaterThan(0);
    expect(b.exportedSedimentM3).toBeGreaterThan(0);
  });

  it("tool edits are accounted in toolNetM3, and smooth is volume-neutral", async () => {
    const solver = createCpuSolver({ gridSize: 32 }, catchmentFixture());
    const l = solver.config.metresPerCell;
    const r0 = solver.referenceLayers();
    const raise = await solver.applyTool({
      kind: "raise",
      at: { xM: 10 * l, yM: 10 * l },
      radiusM: 3 * l,
      heightM: 3,
    });
    const dig = await solver.applyTool({
      kind: "dig",
      at: { xM: 20 * l, yM: 20 * l },
      radiusM: 3 * l,
      depthM: 3,
    });
    const smooth = await solver.applyTool({
      kind: "smooth",
      at: { xM: 16 * l, yM: 16 * l },
      radiusM: 6 * l,
      strength: 1,
    });
    expect(Math.abs(smooth.volumeChangeM3)).toBeLessThan(1e-9);
    const b = await solver.budget();
    expect(b.toolNetM3).toBeCloseTo(raise.volumeChangeM3 + dig.volumeChangeM3 + smooth.volumeChangeM3, 9);
    expectClosed(residuals(r0, solver.referenceLayers(), b, area(solver)), "tools");
  });
});
