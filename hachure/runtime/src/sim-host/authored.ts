import { createTerrainState, cellAt, type TerrainConfig, type TerrainPreset } from "@hachure/terrain";
import type { AuthoredTerrainInitial } from "../reader/contracts";

/** Validate before allocating a backend; clone so later resets cannot be changed by the caller. */
export function cloneAuthoredInitial(
  initial: AuthoredTerrainInitial,
  config: TerrainConfig,
): AuthoredTerrainInitial {
  if (
    !initial.id.trim() ||
    initial.gridSize !== config.gridSize ||
    initial.metresPerCell !== config.metresPerCell
  )
    throw new RangeError("Authored terrain must match the configured domain");
  if (!Number.isInteger(initial.outlet.x) || !Number.isInteger(initial.outlet.y))
    throw new RangeError("Authored outlet must be a grid cell");
  createTerrainState(config.gridSize, config.metresPerCell, initial.outlet);
  const count = config.gridSize ** 2;
  for (const key of ["bedrockM", "sedimentM", "hardness"] as const) {
    const values = initial[key];
    if (values.length !== count) throw new RangeError(`Invalid authored ${key} length`);
    for (const value of values) {
      if (
        !Number.isFinite(value) ||
        (key === "sedimentM" && value < 0) ||
        (key === "hardness" && (value < config.hardnessRange[0] || value > config.hardnessRange[1]))
      )
        throw new RangeError(`Invalid authored ${key} value`);
    }
  }
  const ids = new Set<string>();
  for (const source of initial.sources) {
    if (!source.id.trim() || ids.has(source.id)) throw new RangeError("Authored sources require unique ids");
    ids.add(source.id);
    if (!cellAt(config.gridSize, config.metresPerCell, source.at))
      throw new RangeError("Authored source is off-grid");
    const rates = source.kind === "spring" ? [source.flowM3PerS] : [source.rainMmPerHr, source.radiusM];
    if (rates.some((value) => !Number.isFinite(value) || value < 0))
      throw new RangeError("Invalid authored source");
  }
  return structuredClone(initial);
}

export function authoredPreset(initial: AuthoredTerrainInitial): TerrainPreset {
  return {
    id: initial.id,
    create(config) {
      const state = createTerrainState(config.gridSize, config.metresPerCell, initial.outlet);
      state.layers.bedrockM.set(initial.bedrockM);
      state.layers.sedimentM.set(initial.sedimentM);
      state.layers.hardness.set(initial.hardness);
      return state;
    },
  };
}
