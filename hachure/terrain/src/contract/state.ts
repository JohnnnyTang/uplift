/**
 * TerrainState: the grid layout shared by every solver, the renderer and the probes.
 *
 * Struct of arrays: one `Float32Array` per layer, all views into one `ArrayBuffer`, so the whole state can
 * be transferred to a Worker or uploaded to the GPU in one piece.
 *
 * Grid convention: row-major, `index = y × gridSize + x`. `x` grows east (columns), `y` grows south (rows).
 * Cell `(x, y)` covers metres `[x·m, (x+1)·m) × [y·m, (y+1)·m)` where `m = metresPerCell`; its centre is
 * at `((x + ½)·m, (y + ½)·m)`.
 */

/** Layer names, in buffer order. Each name ends with its unit. */
export const TERRAIN_LAYERS = [
  /** Bedrock surface elevation above datum (unit: metres). */
  "bedrockM",
  /** Thickness of loose sediment on top of bedrock (unit: metres). */
  "sedimentM",
  /** Rock hardness (unit: none; 0 = fully erodible, 1 = not erodible). */
  "hardness",
  /** Surface water depth (unit: metres). */
  "waterM",
  /** Virtual-pipe outflow to the west neighbour (x − 1) (unit: cubic metres per second). */
  "fluxWestM3PerS",
  /** Virtual-pipe outflow to the east neighbour (x + 1) (unit: cubic metres per second). */
  "fluxEastM3PerS",
  /** Virtual-pipe outflow to the north neighbour (y − 1) (unit: cubic metres per second). */
  "fluxNorthM3PerS",
  /** Virtual-pipe outflow to the south neighbour (y + 1) (unit: cubic metres per second). */
  "fluxSouthM3PerS",
  /** Depth-averaged water velocity, east component (unit: metres per second). */
  "velocityXMPerS",
  /** Depth-averaged water velocity, south component (unit: metres per second). */
  "velocityYMPerS",
  /** Sediment held in suspension, as an equivalent settled thickness (unit: metres). */
  "suspendedSedimentM",
] as const;

export type LayerName = (typeof TERRAIN_LAYERS)[number];

/** Unit of each layer, for labels, legends and overlays. */
export const LAYER_UNITS: Readonly<Record<LayerName, string>> = Object.freeze({
  bedrockM: "m",
  sedimentM: "m",
  hardness: "1",
  waterM: "m",
  fluxWestM3PerS: "m³/s",
  fluxEastM3PerS: "m³/s",
  fluxNorthM3PerS: "m³/s",
  fluxSouthM3PerS: "m³/s",
  velocityXMPerS: "m/s",
  velocityYMPerS: "m/s",
  suspendedSedimentM: "m",
});

/** A grid cell by integer column and row. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** A point on the terrain in metres from the north-west corner of cell (0, 0). */
export interface PointM {
  readonly xM: number;
  readonly yM: number;
}

export type TerrainLayers = Readonly<Record<LayerName, Float32Array>>;

export interface TerrainState {
  /** Cells per side (unit: cells). */
  readonly gridSize: number;
  /** Cell size (unit: metres). */
  readonly metresPerCell: number;
  /** The single outlet cell, on the grid edge. Every other boundary is closed. */
  readonly outlet: Cell;
  /** The buffer every layer views into. */
  readonly buffer: ArrayBuffer;
  readonly layers: TerrainLayers;
}

/** Allocates a zeroed state. */
export function createTerrainState(gridSize: number, metresPerCell: number, outlet: Cell): TerrainState {
  if (!Number.isInteger(gridSize) || gridSize < 2) throw new RangeError(`gridSize must be an integer ≥ 2`);
  if (!isEdgeCell(gridSize, outlet))
    throw new RangeError(`outlet (${outlet.x}, ${outlet.y}) is not on the grid edge`);
  const cells = gridSize * gridSize;
  const buffer = new ArrayBuffer(cells * TERRAIN_LAYERS.length * Float32Array.BYTES_PER_ELEMENT);
  const layers = {} as Record<LayerName, Float32Array>;
  TERRAIN_LAYERS.forEach((name, i) => {
    layers[name] = new Float32Array(buffer, i * cells * Float32Array.BYTES_PER_ELEMENT, cells);
  });
  return {
    gridSize,
    metresPerCell,
    outlet: { x: outlet.x, y: outlet.y },
    buffer,
    layers: Object.freeze(layers),
  };
}

/** Deep copy (a new buffer). */
export function cloneTerrainState(state: TerrainState): TerrainState {
  const copy = createTerrainState(state.gridSize, state.metresPerCell, state.outlet);
  new Uint8Array(copy.buffer).set(new Uint8Array(state.buffer));
  return copy;
}

/** Row-major index of cell `(x, y)`. No bounds check; see `inBounds`. */
export function cellIndex(gridSize: number, x: number, y: number): number {
  return y * gridSize + x;
}

/** Column of a row-major index. */
export function cellX(gridSize: number, index: number): number {
  return index % gridSize;
}

/** Row of a row-major index. */
export function cellY(gridSize: number, index: number): number {
  return Math.floor(index / gridSize);
}

export function inBounds(gridSize: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

export function isEdgeCell(gridSize: number, cell: Cell): boolean {
  return (
    inBounds(gridSize, cell.x, cell.y) &&
    (cell.x === 0 || cell.y === 0 || cell.x === gridSize - 1 || cell.y === gridSize - 1)
  );
}

/** The cell containing a point, or `undefined` if the point is off the grid. */
export function cellAt(gridSize: number, metresPerCell: number, point: PointM): Cell | undefined {
  const x = Math.floor(point.xM / metresPerCell);
  const y = Math.floor(point.yM / metresPerCell);
  return inBounds(gridSize, x, y) ? { x, y } : undefined;
}

/** Ground surface elevation, bedrock plus sediment (unit: metres). */
export function groundElevationM(layers: TerrainLayers, index: number): number {
  return layers.bedrockM[index]! + layers.sedimentM[index]!;
}

/**
 * Budget counters: running totals since the last reset, all volumes in cubic metres. Kept in float64 on the
 * CPU. GPU solvers must build them with order-independent reductions (tension T5).
 *
 * Sediment closes as: Δ(rock + sediment volume on the grid) + suspendedM3 + exportedSedimentM3
 *                     = toolNetM3 (+ the suspended volume at reset, which is normally zero).
 * Water closes as:    Δ(water volume on the grid) = rainedWaterM3 + sourcedWaterM3 − evaporatedWaterM3
 *                     − outflowedWaterM3.
 */
export interface BudgetCounters {
  /** Bedrock and sediment picked up by flow (unit: cubic metres). */
  readonly erodedM3: number;
  /** Material dropped by flow or stranded by evaporation (unit: cubic metres). */
  readonly depositedM3: number;
  /** Material currently held in suspension on the grid; a stock, not a total (unit: cubic metres). */
  readonly suspendedM3: number;
  /** Sediment carried out through the outlet (unit: cubic metres). */
  readonly exportedSedimentM3: number;
  /** Net rock and sediment added by reader tools; dig counts negative (unit: cubic metres). */
  readonly toolNetM3: number;
  /** Water added by rain (unit: cubic metres). */
  readonly rainedWaterM3: number;
  /** Water added by rain sources and springs (unit: cubic metres). */
  readonly sourcedWaterM3: number;
  /** Water removed by evaporation (unit: cubic metres). */
  readonly evaporatedWaterM3: number;
  /** Water carried out through the outlet (unit: cubic metres). */
  readonly outflowedWaterM3: number;
}

export const BUDGET_KEYS = [
  "erodedM3",
  "depositedM3",
  "suspendedM3",
  "exportedSedimentM3",
  "toolNetM3",
  "rainedWaterM3",
  "sourcedWaterM3",
  "evaporatedWaterM3",
  "outflowedWaterM3",
] as const satisfies readonly (keyof BudgetCounters)[];

export function zeroBudget(): BudgetCounters {
  return {
    erodedM3: 0,
    depositedM3: 0,
    suspendedM3: 0,
    exportedSedimentM3: 0,
    toolNetM3: 0,
    rainedWaterM3: 0,
    sourcedWaterM3: 0,
    evaporatedWaterM3: 0,
    outflowedWaterM3: 0,
  };
}

/** Sum of a layer times cell area (unit: cubic metres, for a layer in metres). Fixed summation order. */
export function layerVolumeM3(
  state: Pick<TerrainState, "metresPerCell" | "layers">,
  layer: LayerName,
): number {
  const values = state.layers[layer];
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i]!;
  return sum * state.metresPerCell * state.metresPerCell;
}
