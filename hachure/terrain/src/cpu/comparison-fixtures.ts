/** Shared water-only CPU/GPU fixtures; numerical test geometries, never reader science. */
import { createTerrainState, type TerrainConfig, type TerrainPreset } from "../contract/index";

export const WATER_COMPARISON_CONFIG: Partial<TerrainConfig> = Object.freeze({
  gridSize: 8,
  metresPerCell: 10,
  dtSimSeconds: 0.05,
  rainMmPerHr: 10,
  manningNSPerMOneThird: 0.035,
  capacityCoefficient: 0,
  erosionRatePerS: 0,
  depositionRatePerS: 0,
  thermalRatePerS: 0,
  evaporationFractionPerStep: 0,
});

/** Dry onset, wet flow, and a newly wet receiver exercise the corrected donor-area convention. */
export function waterComparisonPreset(kind: "dry" | "wet" | "front"): TerrainPreset {
  return {
    id: `water-comparison-${kind}`,
    create({ gridSize: n, metresPerCell: l }) {
      const state = createTerrainState(n, l, { x: Math.floor(n / 2), y: n - 1 });
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          state.layers.bedrockM[i] = 150 + (n - y) * l * 0.05;
          state.layers.waterM[i] = kind === "wet" ? 0.02 : kind === "front" && y === 2 ? 0.01 : 0;
        }
      return state;
    },
  };
}
