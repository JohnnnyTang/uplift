/**
 * Stability: no NaN or Inf across the admissible extremes of docs/science/parameters.md, a rejected step
 * leaves the state untouched, and the wave-guard policy behaves as documented (DECISIONS.md D-2A-1).
 */
import { describe, expect, it } from "vitest";
import { type TerrainConfig, TERRAIN_LAYERS } from "../contract/index";
import { type CpuTerrainSolver, TerrainStabilityError, WAVE_SAFETY_FACTOR, createCpuSolver } from "./index";
import { catchmentFixture, customFixture, southCentre } from "./test-fixtures";

const STEPS = 1500;

/** One-at-a-time extremes, plus the most and least active combinations. Grid 32², 10 m cells by default. */
const CASES: Record<string, Partial<TerrainConfig>> = {
  "rain 0": { rainMmPerHr: 0 },
  "rain 50": { rainMmPerHr: 50 },
  "pipe area 0.01": { pipeAreaM2: 0.01 },
  "pipe area 100": { pipeAreaM2: 100 },
  "dt 0.0001": { dtSimSeconds: 0.0001, evaporationFractionPerStep: 0 },
  "capacity 0": { capacityCoefficient: 0 },
  "capacity 0.1": { capacityCoefficient: 0.1 },
  "erosion 0": { erosionRatePerS: 0 },
  "erosion 1": { erosionRatePerS: 1 },
  "deposition 0": { depositionRatePerS: 0 },
  "deposition 2": { depositionRatePerS: 2 },
  "talus 30": { talusAngleDeg: 30 },
  "talus 42": { talusAngleDeg: 42 },
  "thermal 0": { thermalRatePerS: 0 },
  "thermal 1": { thermalRatePerS: 1 },
  "evaporation 0": { evaporationFractionPerStep: 0 },
  "evaporation 0.0001": { evaporationFractionPerStep: 0.0001 },
  "hardness [0, 0]": { hardnessRange: [0, 0] },
  "hardness [1, 1]": { hardnessRange: [1, 1] },
  "1 m cells": { metresPerCell: 1, pipeAreaM2: 0.2, brushMaxRadiusM: 8 },
  "20 m cells": { metresPerCell: 20, pipeAreaM2: 80, brushMaxRadiusM: 160 },
  // 2B keeps one landscape at both tiers by running 256² at 5 m cells.
  "5 m cells, default pipe area": { metresPerCell: 5 },
  "5 m cells, pipe area 0.2 l²": { metresPerCell: 5, pipeAreaM2: 5 },
  "grid 8": { gridSize: 8 },
  "morph factor 1e9": { morphAccelerationFactor: 1e9 },
  "most active": {
    rainMmPerHr: 50,
    pipeAreaM2: 100,
    capacityCoefficient: 0.1,
    erosionRatePerS: 1,
    depositionRatePerS: 2,
    talusAngleDeg: 30,
    thermalRatePerS: 1,
    evaporationFractionPerStep: 0,
    hardnessRange: [0, 0],
  },
  "least active": {
    rainMmPerHr: 0,
    pipeAreaM2: 0.01,
    capacityCoefficient: 0,
    erosionRatePerS: 0,
    depositionRatePerS: 0,
    talusAngleDeg: 42,
    thermalRatePerS: 0,
    evaporationFractionPerStep: 0.0001,
    hardnessRange: [1, 1],
  },
};

async function expectHealthy(solver: CpuTerrainSolver, label: string): Promise<void> {
  const snap = await solver.snapshot();
  for (const name of TERRAIN_LAYERS) {
    const layer = snap.layers[name]!;
    for (let i = 0; i < layer.length; i++) {
      if (!Number.isFinite(layer[i]!)) throw new Error(`${label}: ${name}[${i}] = ${layer[i]}`);
    }
  }
  const ref = solver.referenceLayers();
  for (const name of ["sedimentM", "suspendedSedimentM", "waterM"] as const) {
    expect(
      ref[name].every((v) => v >= 0 && Number.isFinite(v)),
      `${label}: ${name} ≥ 0`,
    ).toBe(true);
  }
  for (const [key, value] of Object.entries(snap.budget)) {
    expect(Number.isFinite(value), `${label}: budget ${key}`).toBe(true);
  }
  expect(solver.diagnostics().failure, label).toBeUndefined();
}

describe("stability across admissible extremes", () => {
  for (const [label, overrides] of Object.entries(CASES)) {
    it(`${label}: finite, non-negative stocks, no rejected step`, async () => {
      const config = { gridSize: 32, ...overrides };
      const solver = createCpuSolver(
        config,
        catchmentFixture({ hardness: config.hardnessRange?.[0] ?? 0.2 }),
      );
      const { gridSize: n, metresPerCell: l } = solver.config;
      await solver.applyTool({
        kind: "spring",
        id: "s",
        at: { xM: (n / 2 + 0.5) * l, yM: 2.5 * l },
        flowM3PerS: 1,
      });
      await solver.applyTool({
        kind: "rain-source",
        id: "storm",
        at: { xM: (n / 2) * l, yM: (n / 2) * l },
        radiusM: 4 * l,
        rainMmPerHr: 50,
      });
      solver.step(STEPS / 2);
      // Reader extremes mid-run: deepest dig and highest raise the clamps allow.
      await solver.applyTool({
        kind: "dig",
        at: { xM: (n / 2) * l, yM: (n / 2) * l },
        radiusM: 2 * l,
        depthM: 1e3,
      });
      await solver.applyTool({
        kind: "raise",
        at: { xM: (n / 4) * l, yM: (n / 2) * l },
        radiusM: 2 * l,
        heightM: 1e3,
      });
      solver.step(STEPS / 2);
      await expectHealthy(solver, label);
    });
  }

  it("256² at 5 m cells (the GPU tier landscape): finite after a short run", async () => {
    const solver = createCpuSolver({ gridSize: 256, metresPerCell: 5 }, catchmentFixture());
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 642.5, yM: 42.5 }, flowM3PerS: 0.1 });
    solver.step(100);
    await expectHealthy(solver, "256² at 5 m");
  });

  it("grid 512: finite after a short run", async () => {
    const solver = createCpuSolver({ gridSize: 512 }, catchmentFixture());
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 2565, yM: 85 }, flowM3PerS: 1 });
    solver.step(10);
    await expectHealthy(solver, "grid 512");
  });
});

describe("rejected steps", () => {
  const plain = catchmentFixture();

  it("leave the state untouched, pause the solver, and clear on reset", async () => {
    const solver = createCpuSolver({ gridSize: 8 }, plain);
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 45, yM: 25 }, flowM3PerS: 0.1 });
    solver.step(5);
    const before = await solver.hash();
    const beforeBudget = await solver.budget();
    // No admissible input produces a non-finite value, so corrupt one float64 cell to exercise the path.
    const internal = (solver as unknown as { buf: { h: Float64Array } }).buf;
    const original = internal.h[20]!;
    internal.h[20] = Number.NaN;
    let error: unknown;
    try {
      solver.step(3);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TerrainStabilityError);
    const diagnostic = (error as TerrainStabilityError).diagnostic;
    expect(diagnostic.reason).toBe("non-finite-or-negative");
    expect(diagnostic.step).toBe(6);
    expect(solver.stepCount).toBe(5);
    expect(await solver.budget()).toEqual(beforeBudget);
    expect(solver.diagnostics().failure).toEqual(diagnostic);
    expect(() => solver.step()).toThrow(TerrainStabilityError);
    // Nothing was committed: undoing the corruption restores the exact pre-step state.
    (solver as unknown as { buf: { h: Float64Array } }).buf.h[20] = original;
    expect(await solver.hash()).toBe(before);
    solver.reset(plain, 1);
    expect(solver.diagnostics().failure).toBeUndefined();
    expect(() => solver.step()).not.toThrow();
  });
});

describe("wave guard (model.md) and D-2A-1", () => {
  const spring = async (solver: CpuTerrainSolver) => {
    const l = solver.config.metresPerCell;
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 16.5 * l, yM: 8.5 * l }, flowM3PerS: 0.1 });
  };

  it('"halt" rejects the first step that exceeds the guard, with a diagnostic', async () => {
    const deep = customFixture("deep", southCentre, (state, _x, _y, i) => {
      state.layers.waterM[i] = 1000;
    });
    const solver = createCpuSolver({ gridSize: 32 }, deep);
    await spring(solver);
    expect(() => solver.step(100)).toThrow(TerrainStabilityError);
    const failure = solver.diagnostics().failure!;
    expect(failure.reason).toBe("wave-guard");
    expect(failure.waveCourant).toBeGreaterThan(WAVE_SAFETY_FACTOR);
    expect(solver.stepCount).toBe(failure.step - 1);
  });

  it('"halt" accepts a still, closed basin', async () => {
    const still = customFixture("still", southCentre, (state, x, y, i) => {
      const o = southCentre(state.gridSize);
      state.layers.bedrockM[i] = x === o.x && y === o.y ? 2 : 1;
      state.layers.waterM[i] = x === o.x && y === o.y ? 0 : 0.5;
    });
    const solver = createCpuSolver({ gridSize: 16, rainMmPerHr: 0 }, still, { waveGuard: "halt" });
    solver.step(500);
    expect(solver.diagnostics().failure).toBeUndefined();
    expect(solver.diagnostics().peakWaveCourant).toBeLessThan(WAVE_SAFETY_FACTOR);
  });

  // Regression for D-2A-1: resistance and donor-area face velocities remove l/dt thin-flow speeds.
  for (const dt of [0.05, 0.01, 0.002]) {
    it(`corrected thin flow stays below the wave guard at dt = ${dt}`, async () => {
      const solver = createCpuSolver(
        { gridSize: 32, dtSimSeconds: dt, evaporationFractionPerStep: 0 },
        catchmentFixture(),
      );
      await spring(solver);
      solver.step(Math.round(5 / dt));
      const d = solver.diagnostics();
      expect(d.failure).toBeUndefined();
      expect(d.peakWaveCourant).toBeGreaterThan(0);
      expect(d.peakWaveCourant).toBeLessThan(WAVE_SAFETY_FACTOR);
      expect(d.waveGuardViolationSteps).toBe(0);
      expect(d.waveGuard).toBe("halt");
      // The donor transport guard holds by construction of the limiter.
      expect(d.maxTransportCourant).toBeLessThanOrEqual(1 + 1e-12);
    });
  }
});
