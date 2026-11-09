/** <!-- expert-review --> Frozen before execution; preregistration.md defines scope and gates. */
import { DEFAULT_TERRAIN_CONFIG, type TerrainConfig } from "@hachure/terrain";
export const CHALLENGE_PROTOCOL = {
  id: "s1-w4-model-step-slope-break-v1",
  seeds: [1, 17, 101],
  arms: ["uniform", "hard-band"],
  gridSize: 128,
  metresPerCell: 10,
  dtSimSeconds: 0.05,
  warmupSteps: 2000,
  horizonSteps: 22000,
  observationIntervalSteps: 200,
  sustainModelSteps: 2000,
  maxDisplacementCells: 2,
  fromBandRow: 72,
  toBandRowExclusive: 76,
  firstEligibleRow: 64,
  bandHardness: 0.9,
  uniformHardness: 0.2,
} as const;
export function challengeConfig(seed: number): TerrainConfig {
  return {
    ...DEFAULT_TERRAIN_CONFIG,
    gridSize: CHALLENGE_PROTOCOL.gridSize,
    metresPerCell: CHALLENGE_PROTOCOL.metresPerCell,
    dtSimSeconds: CHALLENGE_PROTOCOL.dtSimSeconds,
    seed,
    rainMmPerHr: 50,
    capacityCoefficient: 0.1,
    erosionRatePerS: 1,
  };
}
