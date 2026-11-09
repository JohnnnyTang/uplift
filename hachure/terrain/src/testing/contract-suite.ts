/**
 * The TerrainSolver contract suite. Every backend runs it from its own test file:
 *
 *   describeTerrainSolverContract("cpu", createCpuSolver, tiltedPlateauPreset);
 *
 * It checks the interface's promises (shapes, ordering, determinism, reset, clamps, budgets closing), not
 * the science. Science is checked by the qualitative and validation tests (sessions 2A, 3B).
 */
import { describe, expect, it } from "vitest";
import {
  type BudgetCounters,
  type StateSnapshot,
  type TerrainConfig,
  type TerrainPreset,
  type TerrainSolver,
  type TerrainSolverFactory,
  type ToolOp,
  BUDGET_KEYS,
  SolverDisposedError,
  TERRAIN_LAYERS,
  TerrainConfigError,
  isEdgeCell,
  resolveTerrainConfig,
  simYearsPerStep,
} from "../contract/index";

export interface ContractSuiteOptions {
  /** Config overrides for every solver the suite creates. Defaults to a small, fast grid. */
  readonly config?: Partial<TerrainConfig>;
  /** Steps for the budget-closure runs. */
  readonly budgetSteps?: number;
  /** Relative tolerance for budget closure (AC4 uses 1%). */
  readonly budgetTolerance?: number;
}

const DEFAULT_OPTIONS = { budgetSteps: 200, budgetTolerance: 0.01 } as const;

function volumeM3(snapshot: StateSnapshot, layer: "bedrockM" | "sedimentM" | "waterM"): number {
  const values = snapshot.layers[layer]!;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i]!;
  return sum * snapshot.metresPerCell * snapshot.metresPerCell;
}

/** Centre of the grid in metres. */
function centre(config: TerrainConfig): { xM: number; yM: number } {
  const half = (config.gridSize * config.metresPerCell) / 2;
  return { xM: half, yM: half };
}

/** A small, deterministic op log used by the determinism and budget tests. */
function opLog(config: TerrainConfig): ToolOp[] {
  const c = centre(config);
  const r = config.metresPerCell * 3;
  return [
    { kind: "raise", at: c, radiusM: r, heightM: config.brushMaxHeightM / 2 },
    { kind: "harden", at: { xM: c.xM, yM: c.yM / 2 }, radiusM: r, hardness: config.hardnessRange[1] },
    { kind: "dig", at: { xM: c.xM / 2, yM: c.yM }, radiusM: r, depthM: config.brushMaxDepthM / 2 },
    { kind: "spring", id: "s1", at: { xM: c.xM, yM: config.metresPerCell * 2 }, flowM3PerS: 1 },
    { kind: "smooth", at: c, radiusM: r, strength: 0.5 },
  ];
}

async function runScript(solver: TerrainSolver): Promise<void> {
  const ops = opLog(solver.config);
  for (const op of ops) {
    solver.step(5);
    await solver.applyTool(op);
  }
  solver.step(10);
}

export function describeTerrainSolverContract(
  label: string,
  factory: TerrainSolverFactory,
  preset: TerrainPreset,
  options: ContractSuiteOptions = {},
): void {
  const config = resolveTerrainConfig({ gridSize: 32, ...options.config });
  const budgetSteps = options.budgetSteps ?? DEFAULT_OPTIONS.budgetSteps;
  const tolerance = options.budgetTolerance ?? DEFAULT_OPTIONS.budgetTolerance;
  const create = async () => await factory(config, preset);
  const cells = config.gridSize * config.gridSize;

  describe(`TerrainSolver contract: ${label}`, () => {
    it("starts reset: step 0, zero budget, every layer present, finite and grid-sized", async () => {
      const solver = await create();
      expect(solver.stepCount).toBe(0);
      expect(solver.config.gridSize).toBe(config.gridSize);
      const snap = await solver.snapshot();
      expect(snap.step).toBe(0);
      expect(snap.simYears).toBe(0);
      expect(snap.gridSize).toBe(config.gridSize);
      expect(snap.metresPerCell).toBe(config.metresPerCell);
      expect(isEdgeCell(snap.gridSize, snap.outlet)).toBe(true);
      for (const name of TERRAIN_LAYERS) {
        const layer = snap.layers[name];
        expect(layer, name).toBeInstanceOf(Float32Array);
        expect(layer!.length, name).toBe(cells);
        expect(layer!.every(Number.isFinite), name).toBe(true);
      }
      for (const key of BUDGET_KEYS) expect(snap.budget[key], key).toBe(0);
      solver.dispose();
    });

    it("step(n) advances the step count and simulated time", async () => {
      const solver = await create();
      solver.step();
      solver.step(4);
      expect(solver.stepCount).toBe(5);
      const snap = await solver.snapshot();
      expect(snap.step).toBe(5);
      expect(snap.simYears).toBeCloseTo(5 * simYearsPerStep(config), 12);
      solver.dispose();
    });

    it("step(0) is a no-op and invalid step counts throw", async () => {
      const solver = await create();
      const before = await solver.hash();
      solver.step(0);
      expect(await solver.hash()).toBe(before);
      expect(() => solver.step(-1)).toThrow(RangeError);
      expect(() => solver.step(1.5)).toThrow(RangeError);
      solver.dispose();
    });

    it("hash is stable without stepping and changes when the state changes", async () => {
      const solver = await create();
      const h0 = await solver.hash();
      expect(h0).toMatch(/^[0-9a-f]{16}$/);
      expect(await solver.hash()).toBe(h0);
      solver.step(3);
      expect(await solver.hash()).not.toBe(h0);
      solver.dispose();
    });

    it("is deterministic: same config, preset, seed and op log give the same hash and budget", async () => {
      const a = await create();
      const b = await create();
      await runScript(a);
      await runScript(b);
      expect(await a.hash()).toBe(await b.hash());
      expect(await a.budget()).toEqual(await b.budget());
      a.dispose();
      b.dispose();
    });

    it("reset restores the initial state, step count and budget", async () => {
      const solver = await create();
      const h0 = await solver.hash();
      await runScript(solver);
      solver.reset(preset, config.seed);
      expect(solver.stepCount).toBe(0);
      expect(await solver.hash()).toBe(h0);
      for (const key of BUDGET_KEYS) expect((await solver.budget())[key], key).toBe(0);
      // Sources are removed by reset: stepping again matches a fresh solver.
      const fresh = await create();
      solver.step(10);
      fresh.step(10);
      expect(await solver.hash()).toBe(await fresh.hash());
      solver.dispose();
      fresh.dispose();
    });

    it("snapshots are copies, and can be limited to some layers", async () => {
      const solver = await create();
      const snap = await solver.snapshot();
      const h0 = await solver.hash();
      snap.layers.bedrockM!.fill(-1);
      expect(await solver.hash()).toBe(h0);
      const partial = await solver.snapshot({ layers: ["waterM"] });
      expect(Object.keys(partial.layers)).toEqual(["waterM"]);
      solver.dispose();
    });

    it("configure changes tunable parameters without resetting, and rejects invalid values", async () => {
      const solver = await create();
      solver.step(2);
      solver.configure({ rainMmPerHr: config.rainMmPerHr * 2 });
      expect(solver.config.rainMmPerHr).toBe(config.rainMmPerHr * 2);
      expect(solver.stepCount).toBe(2);
      expect(() => solver.configure({ rainMmPerHr: -1 })).toThrow(TerrainConfigError);
      expect(solver.config.rainMmPerHr).toBe(config.rainMmPerHr * 2);
      solver.dispose();
    });

    it("tools report the clamps that engaged", async () => {
      const solver = await create();
      const c = centre(config);
      const r = config.metresPerCell * 3;

      const beforeRaise = await solver.snapshot();
      const ok = await solver.applyTool({
        kind: "raise",
        at: c,
        radiusM: r,
        heightM: config.brushMaxHeightM / 10,
      });
      expect(ok.applied).toBe(true);
      expect(ok.clamped).toEqual([]);
      expect(ok.volumeChangeM3).toBeGreaterThan(0);
      const afterRaise = await solver.snapshot();
      expect(afterRaise.layers.bedrockM).toEqual(beforeRaise.layers.bedrockM);
      expect(volumeM3(afterRaise, "sedimentM")).toBeGreaterThan(volumeM3(beforeRaise, "sedimentM"));

      const deep = await solver.applyTool({
        kind: "dig",
        at: c,
        radiusM: r,
        depthM: config.brushMaxDepthM * 10,
      });
      expect(deep.clamped).toContain("depth");
      expect(deep.volumeChangeM3).toBeLessThan(0);

      const wide = await solver.applyTool({
        kind: "raise",
        at: c,
        radiusM: config.brushMaxRadiusM * 2,
        heightM: config.brushMaxHeightM / 10,
      });
      expect(wide.clamped).toContain("radius");

      const hard = await solver.applyTool({ kind: "harden", at: c, radiusM: r, hardness: 2 });
      expect(hard.clamped).toContain("hardness");

      const off = await solver.applyTool({ kind: "dig", at: { xM: -1e6, yM: -1e6 }, radiusM: r, depthM: 1 });
      expect(off.applied).toBe(false);
      expect(off.clamped).toContain("off-grid");

      const budget = await solver.budget();
      expect(budget.toolNetM3).toBeCloseTo(ok.volumeChangeM3 + deep.volumeChangeM3 + wide.volumeChangeM3, 3);
      solver.dispose();
    });

    it("budget counters are finite, and running totals never go negative", async () => {
      const solver = await create();
      await runScript(solver);
      const budget: BudgetCounters = await solver.budget();
      for (const key of BUDGET_KEYS) {
        expect(Number.isFinite(budget[key]), key).toBe(true);
        if (key !== "toolNetM3") expect(budget[key], key).toBeGreaterThanOrEqual(0);
      }
      solver.dispose();
    });

    it(`sediment budget closes within ${tolerance * 100}% (AC4)`, async () => {
      const solver = await create();
      const s0 = await solver.snapshot();
      await runScript(solver);
      solver.step(budgetSteps);
      const s1 = await solver.snapshot();
      const b = s1.budget;
      const solidChange =
        volumeM3(s1, "bedrockM") +
        volumeM3(s1, "sedimentM") -
        volumeM3(s0, "bedrockM") -
        volumeM3(s0, "sedimentM");
      const residual = solidChange + b.suspendedM3 + b.exportedSedimentM3 - b.toolNetM3;
      const moved = b.erodedM3 + b.depositedM3 + Math.abs(b.toolNetM3);
      expect(Math.abs(residual)).toBeLessThanOrEqual(tolerance * Math.max(moved, 1e-9));
      solver.dispose();
    });

    it(`water budget closes within ${tolerance * 100}%`, async () => {
      const solver = await create();
      const s0 = await solver.snapshot();
      await runScript(solver);
      solver.step(budgetSteps);
      const s1 = await solver.snapshot();
      const b = s1.budget;
      const stored = volumeM3(s1, "waterM") - volumeM3(s0, "waterM");
      const residual =
        stored - (b.rainedWaterM3 + b.sourcedWaterM3 - b.evaporatedWaterM3 - b.outflowedWaterM3);
      const throughput = b.rainedWaterM3 + b.sourcedWaterM3;
      expect(throughput).toBeGreaterThan(0);
      expect(Math.abs(residual)).toBeLessThanOrEqual(tolerance * throughput);
      solver.dispose();
    });

    it("every call after dispose throws", async () => {
      const solver = await create();
      solver.dispose();
      expect(() => solver.step()).toThrow(SolverDisposedError);
      expect(() => solver.configure({})).toThrow(SolverDisposedError);
      expect(() => solver.reset(preset, 1)).toThrow(SolverDisposedError);
      await expect(solver.snapshot()).rejects.toThrow(SolverDisposedError);
      await expect(solver.budget()).rejects.toThrow(SolverDisposedError);
      await expect(solver.hash()).rejects.toThrow(SolverDisposedError);
      await expect(solver.applyTool({ kind: "remove-source", id: "x" })).rejects.toThrow(SolverDisposedError);
    });
  });
}
