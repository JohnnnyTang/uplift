/** <!-- expert-review --> Preregistered engineering experiment definitions, validation-spec.md. */
import type { TerrainConfig, TerrainPreset } from "../contract/index";
import { resolveTerrainConfig } from "../contract/index";
import { createTiltedPlateauPreset } from "../presets/index";

export const VALIDATION_PROTOCOL = Object.freeze({
  id: "s1-w3-validation-v1",
  seeds: [1, 17, 101] as const,
  gridSize: 128,
  metresPerCell: 10,
  dtSimSeconds: 0.05,
  sampleIntervalSteps: 200,
  warmupSteps: 2_000,
  landscapeSteps: 22_000,
  transportSteps: 10_000,
  incisionMinimumM: 0.1,
  incisionRelativeMargin: 0.05,
  widthMinimumCells: 0.5,
  widthRelativeMargin: 0.05,
  hardBandWidthRatio: 0.9,
  depositionFractionOfInitial: 0.05,
  calibrationTargetMPerYear: 0.00005,
  calibrationTargetRangeMPerYear: [0.00001, 0.0001] as const,
});

export type ValidationArm = "rain-low" | "rain-high" | "uniform" | "hard-band" | "slope-low" | "slope-high";
export const VALIDATION_ARMS: readonly ValidationArm[] = [
  "rain-low",
  "rain-high",
  "uniform",
  "hard-band",
  "slope-low",
  "slope-high",
];

export function validationConfig(seed: number, arm: ValidationArm): TerrainConfig {
  const p = VALIDATION_PROTOCOL;
  return resolveTerrainConfig({
    gridSize: p.gridSize,
    metresPerCell: p.metresPerCell,
    dtSimSeconds: p.dtSimSeconds,
    seed,
    rainMmPerHr: arm === "rain-low" ? 5 : arm === "rain-high" ? 20 : 10,
    ...(arm.startsWith("slope-") ? { erosionRatePerS: 0, thermalRatePerS: 0 } : {}),
  });
}

/** AC3c starts from the actual preset and changes only the downstream slope and initial pulse. */
export function validationPreset(arm: ValidationArm): TerrainPreset {
  const base = createTiltedPlateauPreset(
    arm === "hard-band"
      ? { hardBands: [{ fromYFraction: 72 / 128, toYFraction: 76 / 128, hardness: 0.8 }] }
      : {},
  );
  if (!arm.startsWith("slope-")) return base;
  const slopeDeg = arm === "slope-low" ? 1 : 5;
  return {
    id: `validation-transport-${slopeDeg}`,
    create(config) {
      const state = base.create(config);
      const n = config.gridSize,
        l = config.metresPerCell;
      const junctionYM = (63.5 / 128) * n * l;
      const slopeChange = Math.tan((5 * Math.PI) / 180) - Math.tan((slopeDeg * Math.PI) / 180);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          const yM = (y + 0.5) * l;
          if (yM > junctionYM) state.layers.bedrockM[i] += (yM - junctionYM) * slopeChange;
          if (x >= (56 / 128) * n && x < (72 / 128) * n && y >= (24 / 128) * n && y < (32 / 128) * n) {
            state.layers.waterM[i] = 0.5;
            state.layers.suspendedSedimentM[i] = 0.1;
          }
        }
      return state;
    },
  };
}
