/**
 * Steps per second of the CPU reference solver at 64² and 128² (brief 2A; AC1 fallback tier).
 *
 *   pnpm exec vitest bench --run hachure/terrain/src/cpu
 *
 * Each benchmark iteration is one `step()`, so the reported hz (ops/s) is steps per second. The catchment
 * is pre-run with a spring so water, erosion and transport are active (a dry grid would flatter the numbers).
 */
import { test } from "vitest";
import { createCpuSolver } from "./index";
import { catchmentFixture } from "./test-fixtures";

async function wetSolver(gridSize: number) {
  const solver = createCpuSolver({ gridSize }, catchmentFixture());
  const l = solver.config.metresPerCell;
  await solver.applyTool({
    kind: "spring",
    id: "spring",
    at: { xM: (gridSize / 2 + 0.5) * l, yM: 8.5 * l },
    flowM3PerS: 0.1,
  });
  solver.step(2000);
  return solver;
}

for (const gridSize of [64, 128]) {
  test(`CPU solver ${gridSize}²`, { timeout: 600_000 }, async ({ bench }) => {
    const solver = await wetSolver(gridSize);
    await bench(`step() at ${gridSize}²`, () => solver.step()).run({ time: 3000, warmupTime: 500 });
  });
}
