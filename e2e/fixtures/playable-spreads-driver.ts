import { createTerrainState, createCpuSolver, type TerrainPreset } from "../../hachure/terrain/src/index";
import { createWaterInitial, WATER_CONFIG, SOURCE } from "../../uplift/book/src/scenes/geometry";
import type { WaterSceneDriver } from "../../uplift/book/src/scenes/water-driver";
/** Real solver but test-only adapter: never imported by production scenes. */
export async function realCpuFixtureDriver(): Promise<WaterSceneDriver> {
  const initial = createWaterInitial();
  const preset: TerrainPreset = {
    id: initial.id,
    create: () => {
      const s = createTerrainState(initial.gridSize, initial.metresPerCell, initial.outlet);
      s.layers.bedrockM.set(initial.bedrockM);
      s.layers.hardness.set(initial.hardness);
      return s;
    },
  };
  const solver = createCpuSolver(WATER_CONFIG, preset);
  await solver.applyTool(SOURCE);
  Object.assign(window, { playableModel: { snapshot: () => solver.snapshot(), hash: () => solver.hash() } });
  return {
    snapshot: () => solver.snapshot(),
    place: (op) => solver.applyTool(op),
    advance: async (n) => {
      solver.step(n);
      if (new URLSearchParams(location.search).has("lag"))
        await new Promise((resolve) => setTimeout(resolve, 25));
    },
    reset: async () => {
      solver.reset(preset, solver.config.seed);
      await solver.applyTool(SOURCE);
    },
    settle: async () => {},
    dispose: () => solver.dispose(),
  };
}
