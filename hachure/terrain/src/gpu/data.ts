import { TerrainConfigError, isEdgeCell, type TerrainConfig, type TerrainState } from "../contract/index";
import { validateCpuSolverConfig } from "../cpu/index";

/** This stage is deliberately water-only; it must not masquerade as the full TerrainSolver. */
export function validateWaterStage(config: TerrainConfig, state: TerrainState, fullProcesses = false): void {
  const issues = validateCpuSolverConfig(config);
  if (issues.length) throw new TerrainConfigError(issues);
  if (state.gridSize !== config.gridSize || state.metresPerCell !== config.metresPerCell)
    throw new RangeError("Initial water state and config must use the same grid");
  if (!isEdgeCell(state.gridSize, state.outlet)) throw new RangeError("Outlet must be an edge cell");
  for (const key of [
    "capacityCoefficient",
    "erosionRatePerS",
    "depositionRatePerS",
    "thermalRatePerS",
    "evaporationFractionPerStep",
  ] as const) {
    if (!fullProcesses && config[key] !== 0)
      throw new RangeError(`GPU water stage does not implement ${key}; set it to zero until session 4A`);
  }
  for (const [name, layer] of Object.entries(state.layers)) {
    if (layer.length !== config.gridSize ** 2) throw new RangeError(`Invalid ${name} layer length`);
    for (const value of layer) {
      if (
        !Number.isFinite(value) ||
        (name !== "bedrockM" && name !== "velocityXMPerS" && name !== "velocityYMPerS" && value < 0)
      )
        throw new RangeError(`Invalid initial ${name}`);
    }
  }
}

export interface SplitElevation {
  readonly datumM: number;
  /** vec4 per cell: initial relative bedrock, initial sediment, hardness, source rate (m/s). */
  readonly base: Float32Array;
}
export function splitElevation(state: TerrainState, sourceRateMPerS?: Float32Array): SplitElevation {
  const cells = state.gridSize ** 2;
  if (sourceRateMPerS && sourceRateMPerS.length !== cells)
    throw new RangeError("Source rate must match grid");
  let datumM = Infinity;
  for (const value of state.layers.bedrockM) datumM = Math.min(datumM, value);
  const base = new Float32Array(cells * 4);
  for (let i = 0; i < cells; i++) {
    const source = sourceRateMPerS?.[i] ?? 0;
    if (!(Number.isFinite(source) && source >= 0))
      throw new RangeError("Source rate must be finite and non-negative");
    base.set(
      [state.layers.bedrockM[i] - datumM, state.layers.sedimentM[i], state.layers.hardness[i], source],
      i * 4,
    );
  }
  return { datumM, base };
}
