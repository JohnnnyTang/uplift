import { describe, expect, it } from "vitest";
import {
  createCpuSolver,
  WATER_COMPARISON_CONFIG,
  waterComparisonPreset,
  type ReferenceLayers,
} from "../cpu/index";
import { createTerrainState, type TerrainPreset } from "../contract/index";
import { measureFixedSectionIncision, validationSectionRows } from "./metrics";

describe("fixed-section incision", () => {
  it("preserves deposition signs and follows fixed sections, not a moving row", () => {
    const n = 128;
    const baseline = {
      gridSize: n,
      metresPerCell: 10,
      bedrockM: new Float64Array(n * n).fill(100),
      sedimentM: new Float64Array(n * n),
    };
    const current = { ...baseline, bedrockM: baseline.bedrockM.slice() };
    for (const row of validationSectionRows(n)) current.bedrockM[row * n + 64] -= 2;
    current.bedrockM[10 * n + 64] -= 50;
    expect(measureFixedSectionIncision(baseline, current).medianIncisionM).toBe(2);
    current.bedrockM.fill(103);
    expect(measureFixedSectionIncision(baseline, current).medianIncisionM).toBe(-3);
    expect(validationSectionRows(64)).toEqual([16, 24, 32, 40, 48]);
    expect(validationSectionRows(256)).toEqual([64, 96, 128, 160, 192]);
  });
  it("retains sub-float32 incision and rejects invalid or mismatched surfaces", () => {
    const baseline = {
      gridSize: 8,
      metresPerCell: 10,
      bedrockM: new Float64Array(64).fill(100),
      sedimentM: new Float64Array(64),
    };
    const current = { ...baseline, bedrockM: new Float64Array(64).fill(100 - 1e-8) };
    expect(measureFixedSectionIncision(baseline, current).medianIncisionM).toBeCloseTo(1e-8, 12);
    current.bedrockM[2 * 8 + 3] = NaN;
    expect(measureFixedSectionIncision(baseline, current).resolved).toBe(false);
    expect(() => measureFixedSectionIncision(baseline, { ...current, gridSize: 16 })).toThrow();
  });
});

const pulse: TerrainPreset = {
  id: "validation-diagnostic-pulse",
  create(config) {
    const s = createTerrainState(config.gridSize, config.metresPerCell, { x: 4, y: 7 });
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const i = y * 8 + x;
        s.layers.bedrockM[i] = 10 + (7 - y) * 0.1;
        s.layers.hardness[i] = 1;
        s.layers.waterM[i] = 0.1;
        s.layers.suspendedSedimentM[i] = y === 2 ? 0.05 : 0;
      }
    return s;
  },
};
function reachStock(layers: ReferenceLayers): number {
  let sum = 0;
  for (let i = 4 * 8; i < 7 * 8; i++) sum += (layers.sedimentM[i]! + layers.suspendedSedimentM[i]!) * 100;
  return sum;
}
describe("exact limited reach sediment transfers", () => {
  it.each(["dry", "wet", "front"] as const)(
    "preserves the shared CPU–GPU water fixture: %s",
    async (kind) => {
      const preset = waterComparisonPreset(kind);
      const plain = createCpuSolver(WATER_COMPARISON_CONFIG, preset);
      const observed = createCpuSolver(WATER_COMPARISON_CONFIG, preset, {
        sedimentReach: { firstRow: 4, lastRowExclusive: 7 },
      });
      plain.step(100);
      observed.step(100);
      expect(await observed.snapshot()).toEqual(await plain.snapshot());
      expect(await observed.hash()).toBe(await plain.hash());
    },
  );

  it("closes reach stocks, survives scratch reuse and leaves numerical state identical", async () => {
    const config = {
      gridSize: 8,
      metresPerCell: 10,
      rainMmPerHr: 0,
      erosionRatePerS: 0,
      thermalRatePerS: 0.15,
      hardnessRange: [0, 1] as const,
    };
    const observed = createCpuSolver(config, pulse, { sedimentReach: { firstRow: 4, lastRowExclusive: 7 } });
    const plain = createCpuSolver(config, pulse);
    const initial = reachStock(observed.referenceLayers());
    observed.step(500);
    plain.step(500);
    const diagnostic = observed.sedimentReachBudget()!;
    expect(diagnostic.incomingM3).toBeGreaterThan(0);
    expect(reachStock(observed.referenceLayers()) - initial).toBeCloseTo(
      diagnostic.incomingM3 - diagnostic.outgoingM3,
      10,
    );
    expect(await observed.hash()).toBe(await plain.hash());
    expect(await observed.budget()).toEqual(await plain.budget());
    expect(diagnostic.acceptedSteps).toBe(500);
    observed.reset(pulse, 1);
    expect(observed.sedimentReachBudget()).toMatchObject({ incomingM3: 0, outgoingM3: 0, acceptedSteps: 0 });
  });
  it("records no rejected-step transfer and rejects invalid row ranges", () => {
    expect(() =>
      createCpuSolver({ gridSize: 8 }, pulse, { sedimentReach: { firstRow: 4, lastRowExclusive: 9 } }),
    ).toThrow();
    const deep: TerrainPreset = {
      id: "deep-reject",
      create(config) {
        const s = pulse.create(config);
        s.layers.waterM.fill(100000);
        return s;
      },
    };
    const solver = createCpuSolver({ gridSize: 8 }, deep, {
      sedimentReach: { firstRow: 4, lastRowExclusive: 7 },
    });
    expect(() => solver.step()).toThrow();
    expect(solver.sedimentReachBudget()).toMatchObject({ incomingM3: 0, outgoingM3: 0, acceptedSteps: 0 });
  });
});
