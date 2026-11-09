import { describe, expect, it } from "vitest";
import { createCpuSolver, WAVE_SAFETY_FACTOR } from "./index";
import { resistDischarge } from "./kernel";
import { catchmentFixture } from "./test-fixtures";

describe("hydraulic resistance prerequisite", () => {
  it("preserves Manning equilibrium and damps a supercritical discharge without sign reversal", () => {
    const l = 10,
      h = 0.02,
      roughness = 0.035,
      slope = 0.05,
      pipeArea = 20,
      g = 9.81;
    const area = l * h,
      radius = area / (l + 2 * h);
    const equilibrium = (area * radius ** (2 / 3) * Math.sqrt(slope)) / roughness;
    for (const dt of [0.05, 0.025, 0.0125]) {
      const beta = (dt * pipeArea * g * roughness ** 2) / (area ** 2 * radius ** (4 / 3));
      expect(resistDischarge(equilibrium + dt * pipeArea * g * slope, beta)).toBeCloseTo(equilibrium, 12);
      const damped = resistDischarge(2 * equilibrium, beta);
      expect(damped).toBeGreaterThan(0);
      expect(damped).toBeLessThan(2 * equilibrium);
    }
    expect(resistDischarge(0, 1e20)).toBe(0);
    expect(resistDischarge(1, 0)).toBe(1);
  });

  it("the 2A counterexample converges at equal 50-second hydraulic durations", async () => {
    const results: {
      dt: number;
      maxSpeedMPerS: number;
      incisionM: number;
      exportedM3: number;
      wave: number;
    }[] = [];
    for (const dt of [0.05, 0.025, 0.0125]) {
      const solver = createCpuSolver(
        { gridSize: 64, dtSimSeconds: dt, evaporationFractionPerStep: 1 - (1 - 0.00001) ** (dt / 0.05) },
        catchmentFixture(),
      );
      await solver.applyTool({ kind: "spring", id: "s", at: { xM: 325, yM: 85 }, flowM3PerS: 0.1 });
      const initial = solver.referenceLayers();
      solver.step(Math.round(50 / dt));
      const layers = solver.referenceLayers();
      const snap = await solver.snapshot();
      let incisionM = 0,
        maxSpeedMPerS = 0;
      for (let i = 0; i < layers.bedrockM.length; i++) {
        incisionM = Math.max(
          incisionM,
          initial.bedrockM[i]! + initial.sedimentM[i]! - layers.bedrockM[i]! - layers.sedimentM[i]!,
        );
        maxSpeedMPerS = Math.max(
          maxSpeedMPerS,
          Math.hypot(snap.layers.velocityXMPerS![i]!, snap.layers.velocityYMPerS![i]!),
        );
      }
      const budget = await solver.budget();
      results.push({
        dt,
        maxSpeedMPerS,
        incisionM,
        exportedM3: budget.exportedSedimentM3,
        wave: solver.diagnostics().peakWaveCourant,
      });
      expect(solver.diagnostics().waveGuardViolationSteps).toBe(0);
      expect(solver.diagnostics().peakWaveCourant).toBeLessThan(WAVE_SAFETY_FACTOR);
      expect(maxSpeedMPerS).toBeLessThan(1);
      solver.dispose();
    }
    console.info("RESISTANCE_REFINEMENT", JSON.stringify(results));
    for (const key of ["maxSpeedMPerS", "incisionM", "exportedM3"] as const) {
      const coarse = Math.abs(results[0]![key] - results[1]![key]);
      const fine = Math.abs(results[1]![key] - results[2]![key]);
      expect(fine, key).toBeLessThan(coarse);
      expect(fine / results[2]![key], key).toBeLessThan(0.02);
    }
  }, 120000);
});

// These are the public fixtures 3C must run against its real-browser water backend.
import { WATER_COMPARISON_CONFIG, waterComparisonPreset } from "./comparison-fixtures";
for (const kind of ["dry", "wet", "front"] as const) {
  it(`CPU comparison fixture ${kind} is deterministic and guarded`, async () => {
    const a = createCpuSolver(WATER_COMPARISON_CONFIG, waterComparisonPreset(kind));
    const b = createCpuSolver(WATER_COMPARISON_CONFIG, waterComparisonPreset(kind));
    a.step(100);
    b.step(100);
    expect(await a.hash()).toBe(await b.hash());
    expect(a.diagnostics().waveGuardViolationSteps).toBe(0);
    expect(a.diagnostics().peakWaveCourant).toBeLessThan(WAVE_SAFETY_FACTOR);
  });
}
