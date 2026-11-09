/**
 * Stage-level checks of the kernel against docs/science/model.md: rain, boundaries and the outlet, the
 * hardness rule, and why the pipe wave guard exists.
 */
import { describe, expect, it } from "vitest";
import { createTerrainState } from "../contract/index";
import { createCpuSolver } from "./index";
import {
  CpuBuffers,
  FACE_EAST,
  FACE_NORTH,
  FACE_SOUTH,
  FACE_WEST,
  type KernelParams,
  StepLedger,
  computeStep,
  outletFace,
} from "./kernel";
import { catchmentFixture, customFixture, southCentre } from "./test-fixtures";

describe("outlet face", () => {
  it("corner outlets choose south, east, north, west in that order", () => {
    expect(outletFace(8, 7, 7)).toBe(FACE_SOUTH);
    expect(outletFace(8, 0, 7)).toBe(FACE_SOUTH);
    expect(outletFace(8, 7, 0)).toBe(FACE_EAST);
    expect(outletFace(8, 0, 0)).toBe(FACE_NORTH);
    expect(outletFace(8, 0, 3)).toBe(FACE_WEST);
    expect(() => outletFace(8, 3, 3)).toThrow(RangeError);
  });
});

describe("stage 1: rain", () => {
  it("adds dt × rain / 3 600 000 of depth to every cell and counts it", async () => {
    const flat = customFixture("flat", southCentre, (state, _x, _y, i) => {
      state.layers.bedrockM[i] = 10;
    });
    const solver = createCpuSolver({ gridSize: 8, rainMmPerHr: 36, evaporationFractionPerStep: 0 }, flat);
    solver.step();
    const depth = (0.05 * 36) / 3_600_000;
    const water = solver.referenceLayers().waterM;
    // Every closed cell holds exactly one step of rain; only the outlet cell can already discharge.
    const outlet = 7 * 8 + 4;
    water.forEach((h, i) => {
      if (i !== outlet) expect(h).toBe(depth);
    });
    expect((await solver.budget()).rainedWaterM3).toBeCloseTo(depth * 64 * 100, 15);
  });
});

describe("stage 2: boundaries and outlet", () => {
  it("closed faces carry no flux even when the initial flux layers say otherwise", async () => {
    const leaky = customFixture("leaky", southCentre, (state, x, y, i) => {
      const n = state.gridSize;
      state.layers.bedrockM[i] = 10;
      state.layers.waterM[i] = 0.5;
      if (x === 0) state.layers.fluxWestM3PerS[i] = 5;
      if (x === n - 1) state.layers.fluxEastM3PerS[i] = 5;
      if (y === 0) state.layers.fluxNorthM3PerS[i] = 5;
    });
    const solver = createCpuSolver({ gridSize: 8, rainMmPerHr: 0, evaporationFractionPerStep: 0 }, leaky);
    solver.step(10);
    const snap = await solver.snapshot();
    const n = 8;
    for (let k = 0; k < n; k++) {
      expect(snap.layers.fluxWestM3PerS![k * n]).toBe(0);
      expect(snap.layers.fluxEastM3PerS![k * n + n - 1]).toBe(0);
      expect(snap.layers.fluxNorthM3PerS![k]).toBe(0);
    }
    // The south row: only the outlet cell may discharge south.
    for (let x = 0; x < n; x++) {
      if (x !== southCentre(n).x) expect(snap.layers.fluxSouthM3PerS![(n - 1) * n + x]).toBe(0);
    }
  });

  it("the outlet discharges water above its base level and never takes water in", async () => {
    const pond = customFixture("outlet-pond", southCentre, (state, _x, _y, i) => {
      state.layers.bedrockM[i] = 10;
      state.layers.waterM[i] = 0.2;
    });
    const solver = createCpuSolver({ gridSize: 8, rainMmPerHr: 0, evaporationFractionPerStep: 0 }, pond);
    expect(solver.outletBaseLevelM).toBe(10);
    let previousOut = 0;
    for (let k = 0; k < 50; k++) {
      solver.step(100);
      const out = (await solver.budget()).outflowedWaterM3;
      expect(out).toBeGreaterThanOrEqual(previousOut);
      previousOut = out;
    }
    expect(previousOut).toBeGreaterThan(0);
    // The surface drains towards, but never below, the receiving water surface.
    const water = solver.referenceLayers().waterM;
    for (const h of water) expect(h).toBeGreaterThanOrEqual(0);
  });

  it("a dry outlet at base level passes nothing", async () => {
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0 }, catchmentFixture());
    solver.step(200);
    expect((await solver.budget()).outflowedWaterM3).toBe(0);
  });
});

describe("stage 4: hardness acts on exposed bedrock", () => {
  async function rockEroded(hardness: number): Promise<number> {
    const solver = createCpuSolver({ gridSize: 32 }, catchmentFixture({ looseM: 0, hardness }));
    const l = solver.config.metresPerCell;
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 16.5 * l, yM: 4.5 * l }, flowM3PerS: 0.2 });
    const b0 = solver.referenceLayers().bedrockM;
    solver.step(1000);
    const b1 = solver.referenceLayers().bedrockM;
    let cut = 0;
    for (let i = 0; i < b0.length; i++) cut += b0[i]! - b1[i]!;
    return cut;
  }

  it("harder bare rock loses less bedrock under the same flow", async () => {
    const soft = await rockEroded(0.2);
    const hard = await rockEroded(0.8);
    expect(soft).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(0);
    expect(hard).toBeLessThan(soft);
  });
});

describe("pipe wave guard", () => {
  /** Sloshing in a closed flat basin, run straight through the kernel (the solver would refuse A = 100). */
  function slosh(pipeAreaM2: number, steps: number): { maxAnomaly: number; invalid: boolean } {
    const n = 16;
    const state = createTerrainState(n, 1, { x: 8, y: 15 });
    const buf = new CpuBuffers(n, 1, 15 * n + 8, FACE_SOUTH, 100, state.layers.hardness);
    for (let i = 0; i < n * n; i++) {
      buf.b[i] = 0;
      buf.h[i] = 1 + (i === 7 * n + 7 ? 0.05 : 0);
    }
    buf.b[15 * n + 8] = 5; // raised outlet: the basin is closed
    buf.h[15 * n + 8] = 0;
    const params: KernelParams = {
      dtSimSeconds: 0.05,
      rainMmPerHr: 0,
      gravityMPerS2: 9.81,
      pipeAreaM2,
      capacityCoefficient: 0,
      erosionRatePerS: 0,
      depositionRatePerS: 0,
      talusAngleDeg: 33,
      thermalRatePerS: 0,
      evaporationFractionPerStep: 0,
    };
    const ledger = new StepLedger();
    for (let k = 0; k < steps; k++) {
      computeStep(buf, params, ledger);
      if (ledger.invalidIndex !== -1) return { maxAnomaly: Infinity, invalid: true };
      buf.commit();
    }
    let maxAnomaly = 0;
    for (let i = 0; i < n * n; i++)
      if (i !== 15 * n + 8) maxAnomaly = Math.max(maxAnomaly, Math.abs(buf.h[i]! - 1));
    return { maxAnomaly, invalid: false };
  }

  it("stays bounded inside the guard and grows outside it (1 m cells)", () => {
    // A = 0.2 m²: Courant 0.14, allowed.  A = 100 m²: Courant 3.1, rejected by validateCpuSolverConfig.
    const stable = slosh(0.2, 2000);
    const unstable = slosh(100, 2000);
    expect(stable.invalid).toBe(false);
    expect(stable.maxAnomaly).toBeLessThan(0.05);
    expect(unstable.invalid || unstable.maxAnomaly > 0.5).toBe(true);
  });
});
