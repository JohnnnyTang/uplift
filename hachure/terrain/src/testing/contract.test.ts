import { describe, expect, it } from "vitest";
import { createFakeSolver, describeTerrainSolverContract, fakeTiltedPlanePreset } from "./index";

describeTerrainSolverContract(
  "fake",
  (config, preset) => createFakeSolver(config, preset),
  fakeTiltedPlanePreset,
);

describe("fake solver fixture", () => {
  it("identifies itself as a fake", () => {
    expect(createFakeSolver({ gridSize: 16 }).backend).toBe("fake");
  });

  it("gives different states for different seeds", async () => {
    const a = createFakeSolver({ gridSize: 16, seed: 1 });
    const b = createFakeSolver({ gridSize: 16, seed: 2 });
    expect(await a.hash()).not.toBe(await b.hash());
  });

  it("deepens a channel down the centre line", async () => {
    const soft = createFakeSolver({ gridSize: 32 });
    const before = (await soft.snapshot()).layers.bedrockM!;
    soft.step(100);
    const after = (await soft.snapshot()).layers.bedrockM!;
    const mid = 16 * 32 + 16;
    const edge = 16 * 32 + 1;
    expect(before[mid]! - after[mid]!).toBeGreaterThan(before[edge]! - after[edge]!);
  });
});
