/**
 * ILLUSTRATION — authored relief, NOT a simulation (owner exception D-L2-1, lesson 2 only).
 *
 * `relief(boundary, stage)`: one boundary's authored formation sequence over the shared, seeded starting
 * landscape, as a gridded snapshot for the book stage (D-L2-1, decision 9). Pure and deterministic: the same
 * config (seed), boundary and stage give an identical field. There is no model time, no run and no year.
 *
 * Grid and orientation (7A, "Mapping onto the LandscapeSnapshot"): `columns` across the boundary, `rows`
 * along it with row 0 at the back, row-major (`index = row * columns + column`). Under the stage's default
 * orientation the boundary runs from the back of the block to the front and the front face cuts across it.
 */
import {
  PLATES_RELIEF_CONFIG,
  type PlateBoundary,
  type PlatesReliefConfig,
  platesSceneScales,
} from "./config";
import { type PlatesField, platesField } from "./field";

/**
 * One frame of the sequence. Structurally a `LandscapeSnapshot` (`@hachure/ink/stage`, with D-W7-7B's
 * `crustBaseM` and its follow-up `layerOffsetM`), with no `modelTimeYr`: an authored, timeless state.
 */
export interface PlatesReliefSnapshot {
  readonly columns: number;
  readonly rows: number;
  /** Horizontal cell size (unit: metres). */
  readonly metresPerCell: number;
  /** Surface elevation per cell (unit: metres, real). The stage applies `reliefScale`. */
  readonly bedM: Float32Array;
  /** Without erosion the surface is always the top layer: one id for the whole grid. */
  readonly rockId: number;
  /**
   * Crust base per cell in scene metres: `−mohoDepth × crustSceneFactor` (D-W7-7A, decision 3). After the
   * stage's `reliefScale` the Moho lands at the compressed crust depth. `bedM − crustBaseM` is a display
   * value, not a real thickness.
   */
  readonly crustBaseM: Float32Array;
  /**
   * Vertical displacement of the rock-layer stack relative to the start, per cell (unit: metres, real, same
   * grid as `bedM`): strata at undeformed elevation h are drawn at h + layerOffsetM. Convergent `E(x)`,
   * divergent `Δ(x)`, transform 0.
   */
  readonly layerOffsetM: Float32Array;
}

/**
 * The block's fixed elevation frame, the same for every boundary and stage, so ghosts compare (7A row 4).
 * Every field of every boundary lies inside it (the extremes are at stages 0 and 1, by monotonicity), so the
 * stage never re-frames the block when the boundary or stage changes. Hand it to `setElevationRange`.
 */
export interface PlatesElevationFrame {
  /** Deepest crust base over every boundary at stages 0 and 1 (unit: scene metres). */
  readonly minM: number;
  /** Highest bed over every boundary at stages 0 and 1 (unit: metres). */
  readonly maxM: number;
}

export interface PlatesRelief {
  readonly config: PlatesReliefConfig;
  readonly field: PlatesField;
  /** The shared starting landscape: every boundary at stage 0. */
  start(): PlatesReliefSnapshot;
  /** One boundary at a stage ∈ [0, 1] (clamped; NaN is refused). A new snapshot each call. */
  relief(boundary: PlateBoundary, stage: number): PlatesReliefSnapshot;
  /** `(stage) → snapshot` for one boundary, for the authored-sequence source. */
  generator(boundary: PlateBoundary): (stage: number) => PlatesReliefSnapshot;
  /** Fixed frame for `setElevationRange` (computed once, lazily). */
  elevationFrame(): PlatesElevationFrame;
}

export function createPlatesRelief(config: PlatesReliefConfig = PLATES_RELIEF_CONFIG): PlatesRelief {
  const { columns, rows, metresPerCell } = config.grid;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 3 || rows < 3)
    throw new RangeError("The relief grid must be at least 3 × 3 whole cells");
  if (!(metresPerCell > 0)) throw new RangeError("metresPerCell must be positive");

  const field = platesField(config);
  const { crustSceneFactor } = platesSceneScales(config);
  const rockId = config.start.layers[0]?.rockId ?? config.start.basement.rockId;
  // Cell centres in metres from the block's middle: the boundary `x = 0` runs down the middle of the block.
  const xs = Float64Array.from({ length: columns }, (_, c) => (c - (columns - 1) / 2) * metresPerCell);
  const zs = Float64Array.from({ length: rows }, (_, r) => (r - (rows - 1) / 2) * metresPerCell);

  const n = columns * rows;
  // Stage-independent parts, cached once (a play frame then costs one pass over the grid). The values are
  // the very same expressions as `field.cell`, so the grid matches the reference formula bit for bit.
  let startGrid: Float64Array | null = null;
  let noiseGrid: Float64Array | null = null;
  const cached = (fn: (x: number, z: number) => number) => {
    const out = new Float64Array(n);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) out[r * columns + c] = fn(xs[c]!, zs[r]!);
    return out;
  };
  const peakFraction = config.convergent.peakNoiseFraction;

  const relief = (boundary: PlateBoundary, stage: number): PlatesReliefSnapshot => {
    if (Number.isNaN(stage)) throw new RangeError("stage must be a number in [0, 1]");
    const bedM = new Float32Array(n);
    const crustBaseM = new Float32Array(n);
    const layerOffsetM = new Float32Array(n);
    startGrid ??= cached(field.startM);
    const start = startGrid;
    if (boundary === "convergent") noiseGrid ??= cached(field.peakNoise);
    const noise = noiseGrid;
    for (let c = 0; c < columns; c++) {
      const x = xs[c]!;
      const p = field.column(boundary, stage, x);
      const crustBase = -p.mohoDepthM * crustSceneFactor;
      for (let r = 0; r < rows; r++) {
        const k = r * columns + c;
        if (boundary === "convergent") bedM[k] = start[k]! + p.liftM * (1 + peakFraction * noise![k]!);
        else if (boundary === "divergent") bedM[k] = start[k]! + p.liftM;
        else bedM[k] = p.shiftM === 0 ? start[k]! : field.startM(x, zs[r]! - p.shiftM);
        crustBaseM[k] = crustBase;
        layerOffsetM[k] = p.liftM;
      }
    }
    return { columns, rows, metresPerCell, bedM, rockId, crustBaseM, layerOffsetM };
  };

  let frame: PlatesElevationFrame | null = null;
  const elevationFrame = (): PlatesElevationFrame => {
    if (!frame) {
      let minM = Infinity;
      let maxM = -Infinity;
      for (const b of ["convergent", "divergent", "transform"] as const)
        for (const s of [0, 1]) {
          const snap = relief(b, s);
          for (let k = 0; k < snap.bedM.length; k++) {
            minM = Math.min(minM, snap.bedM[k]!, snap.crustBaseM[k]!);
            maxM = Math.max(maxM, snap.bedM[k]!);
          }
        }
      frame = Object.freeze({ minM, maxM });
    }
    return frame;
  };

  return {
    config,
    field,
    start: () => relief("convergent", 0),
    relief,
    generator: (boundary) => (stage) => relief(boundary, stage),
    elevationFrame,
  };
}

let shared: PlatesRelief | null = null;

/** `relief(boundary, stage)` on the 7A table (the lesson's one config). */
export function relief(boundary: PlateBoundary, stage: number): PlatesReliefSnapshot {
  shared ??= createPlatesRelief();
  return shared.relief(boundary, stage);
}

/** The shared starting landscape on the 7A table. */
export function startingLandscape(): PlatesReliefSnapshot {
  shared ??= createPlatesRelief();
  return shared.start();
}
