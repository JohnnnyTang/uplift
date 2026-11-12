import { heightfieldFromFunction } from "@hachure/ink";
import type { AuthoredTerrainInitial } from "@hachure/runtime";
import type { TerrainConfig } from "@hachure/terrain";
export const DISPLAY = Object.freeze({
  contourIntervalM: 0.5,
  reliefScale: 3,
  wetThresholdM: 0.002,
  waterFullAtM: 0.025,
  waterOpacity: 0.7,
});
export const WATER_CONFIG: Partial<TerrainConfig> = Object.freeze({
  gridSize: 32,
  metresPerCell: 2,
  seed: 5,
  rainMmPerHr: 0,
  dtSimSeconds: 0.02,
  pipeAreaM2: 1,
  capacityCoefficient: 0,
  erosionRatePerS: 0,
  depositionRatePerS: 0,
  thermalRatePerS: 0,
  evaporationFractionPerStep: 0,
});
export const SOURCE = Object.freeze({
  kind: "spring" as const,
  id: "reader-spring",
  at: { xM: 17, yM: 9 },
  flowM3PerS: 0.4,
});
export const RESPONSE_STEPS = 2000;
export const createContourHill = () =>
  heightfieldFromFunction(32, 2, (x, y) => 8 * Math.exp(-((x - 32) ** 2 + (y - 32) ** 2) / 450));
/** Authored test surface, not a simulated landform or real catchment. Fresh arrays per consumer. */
export function createWaterInitial(slope = 0.04): AuthoredTerrainInitial {
  const gridSize = WATER_CONFIG.gridSize!,
    metresPerCell = WATER_CONFIG.metresPerCell!;
  const bedrockM = new Float32Array(gridSize * gridSize);
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < gridSize; x++) {
      const xm = (x + 0.5) * metresPerCell,
        ym = (y + 0.5) * metresPerCell;
      bedrockM[y * gridSize + x] = (64 - ym) * slope + Math.min((xm - 17) ** 2, (xm - 47) ** 2) * 0.006;
    }
  return {
    id: `prepared-twin-channel-${slope}`,
    gridSize,
    metresPerCell,
    outlet: { x: 8, y: gridSize - 1 },
    bedrockM,
    sedimentM: new Float32Array(bedrockM.length),
    hardness: new Float32Array(bedrockM.length).fill(0.5),
    sources: [structuredClone(SOURCE)],
  };
}
