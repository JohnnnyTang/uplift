/**
 * AC2: the same seed and the same tool and input log give a bitwise-identical `hash()` after N steps.
 */
import { describe, expect, it } from "vitest";
import type { TerrainConfig, ToolOp } from "../contract/index";
import { type CpuTerrainSolver, createCpuSolver } from "./index";
import { catchmentFixture } from "./test-fixtures";

const CONFIG: Partial<TerrainConfig> = { gridSize: 48, seed: 17 };
const STEPS_BETWEEN_OPS = 60;
const preset = catchmentFixture();

function opLog(n: number, l: number): ToolOp[] {
  const mid = (n * l) / 2;
  return [
    { kind: "spring", id: "spring", at: { xM: mid + l / 2, yM: 8.5 * l }, flowM3PerS: 0.1 },
    { kind: "harden", at: { xM: mid, yM: mid }, radiusM: 4 * l, hardness: 0.8 },
    { kind: "raise", at: { xM: mid / 2, yM: mid }, radiusM: 3 * l, heightM: 2 },
    { kind: "dig", at: { xM: mid, yM: 1.5 * mid }, radiusM: 3 * l, depthM: 1.5 },
    { kind: "rain-source", id: "storm", at: { xM: mid, yM: mid / 2 }, radiusM: 5 * l, rainMmPerHr: 30 },
    { kind: "smooth", at: { xM: mid, yM: mid }, radiusM: 4 * l, strength: 0.7 },
    { kind: "remove-source", id: "storm" },
  ];
}

/** Runs the op log with steps in between. `chunk` splits each run of steps into step(chunk) calls. */
async function run(
  solver: CpuTerrainSolver,
  options: { chunk?: number; peek?: boolean } = {},
): Promise<void> {
  const chunk = options.chunk ?? STEPS_BETWEEN_OPS;
  for (const op of opLog(solver.config.gridSize, solver.config.metresPerCell)) {
    for (let done = 0; done < STEPS_BETWEEN_OPS; done += chunk) {
      solver.step(Math.min(chunk, STEPS_BETWEEN_OPS - done));
      if (options.peek) {
        // View operations must never change the model (AC8 relies on this).
        await solver.snapshot({ layers: ["waterM"] });
        await solver.hash();
        await solver.budget();
        solver.diagnostics();
        solver.referenceLayers();
      }
    }
    await solver.applyTool(op);
  }
  solver.step(STEPS_BETWEEN_OPS);
}

describe("CPU solver determinism (AC2)", () => {
  it("same seed, config and op log give a bitwise-identical hash, budget and float64 state", async () => {
    const a = createCpuSolver(CONFIG, preset);
    const b = createCpuSolver(CONFIG, preset);
    await run(a);
    await run(b);
    expect(a.stepCount).toBe(STEPS_BETWEEN_OPS * 8);
    expect(await a.hash()).toBe(await b.hash());
    expect(await a.budget()).toEqual(await b.budget());
    const ra = a.referenceLayers();
    const rb = b.referenceLayers();
    for (const key of ["bedrockM", "sedimentM", "suspendedSedimentM", "waterM"] as const) {
      expect(sameBytes(ra[key], rb[key]), key).toBe(true);
    }
    // The run did something: water moved and material was exchanged.
    const budget = await a.budget();
    expect(budget.erodedM3).toBeGreaterThan(0);
    expect(budget.sourcedWaterM3).toBeGreaterThan(0);
  });

  it("is independent of how steps are batched and of interleaved reads", async () => {
    const whole = createCpuSolver(CONFIG, preset);
    const single = createCpuSolver(CONFIG, preset);
    await run(whole);
    await run(single, { chunk: 1, peek: true });
    expect(await single.hash()).toBe(await whole.hash());
    expect(await single.budget()).toEqual(await whole.budget());
  });

  it("replays bitwise after reset", async () => {
    const solver = createCpuSolver(CONFIG, preset);
    await run(solver);
    const first = await solver.hash();
    const firstBudget = await solver.budget();
    solver.reset(preset, CONFIG.seed!);
    await run(solver);
    expect(await solver.hash()).toBe(first);
    expect(await solver.budget()).toEqual(firstBudget);
  });

  it("different seeds give different states", async () => {
    const a = createCpuSolver(CONFIG, preset);
    const b = createCpuSolver({ ...CONFIG, seed: 101 }, preset);
    expect(await a.hash()).not.toBe(await b.hash());
  });

  it("morphAccelerationFactor changes the clock only, never the state", async () => {
    const plain = createCpuSolver(CONFIG, preset);
    const fast = createCpuSolver({ ...CONFIG, morphAccelerationFactor: 1e6 }, preset);
    await run(plain);
    await run(fast);
    expect(await fast.hash()).toBe(await plain.hash());
    expect(await fast.budget()).toEqual(await plain.budget());
    const slowSnap = await plain.snapshot({ layers: [] });
    const fastSnap = await fast.snapshot({ layers: [] });
    expect(fastSnap.simYears / slowSnap.simYears).toBeCloseTo(1e6, 6);
  });
});

function sameBytes(a: Float64Array, b: Float64Array): boolean {
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
