/**
 * Section readings for the page (session 5K, D-W5-R1 items 5 and 9). Additive helpers beside the frozen
 * `measureSection`: neither changes it, and the registered protocol keeps the single-column measure.
 *
 * - `measureSectionAveraged`: the section measured at several neighbouring columns and averaged, so margin
 *   notes do not jump when the front face moves by one cell (the floor-band measure can catch or miss a
 *   bench from one column to the next; D-5H-R1 c).
 * - `measureOverdeepening`: whether the valley floor at a section lies below the floor somewhere down-valley
 *   (an adverse bed slope down-valley from the section), read from the bed alone, never from a column list.
 *
 * Both are pure functions of the fields; they never touch solver state.
 */
import { type GridShape, type SectionOptions, measureSection } from "./probes";

/** Columns either side of the section that the page's averaged reading includes (unit: cells). */
export const PAGE_SECTION_HALF_WIDTH_COLUMNS = 1;

/** The section measures the page binds to, averaged over neighbouring columns. */
export interface AveragedSectionMeasure {
  /** Centre column (unit: cells). */
  readonly i: number;
  /** Columns actually averaged, in order (clamped to the grid; unit: cells). */
  readonly columns: readonly number[];
  /** Length of valley the reading covers: columns × cell size (unit: metres). */
  readonly spanM: number;
  /** Mean valley-floor elevation (unit: metres). */
  readonly floorElevationM: number;
  /** Mean floor width (unit: metres). */
  readonly floorWidthM: number;
  /** Mean rim-to-floor depth (unit: metres). */
  readonly depthM: number;
  /** Mean of the steepest wall slope of each column (unit: degrees). */
  readonly maxWallSlopeDeg: number;
  /** Mean lower-wall slope (unit: degrees). */
  readonly wallSlopeDeg: number;
  /**
   * Mean shape exponent b over the columns where the fit exists (V ≈ 1, U ≈ 2 or more; unit: none); NaN
   * when no column could be fitted.
   */
  readonly shapeExponent: number;
  /** Mean of the thickest ice in each column; 0 when ice-free (unit: metres). */
  readonly maxIceThicknessM: number;
}

export interface AveragedSectionOptions extends SectionOptions {
  /** Columns either side of `i` (unit: cells). Default {@link PAGE_SECTION_HALF_WIDTH_COLUMNS}. */
  readonly halfWidthColumns?: number;
}

/**
 * `measureSection` at columns `i − h … i + h` (clamped to the grid), averaged. With `h = 1` on the 40 m grid
 * the reading covers 120 m of valley.
 */
export function measureSectionAveraged(
  bed: ArrayLike<number>,
  ice: ArrayLike<number> | undefined,
  grid: GridShape,
  i: number,
  options: AveragedSectionOptions = {},
): AveragedSectionMeasure {
  if (!Number.isInteger(i) || i < 0 || i >= grid.nx)
    throw new RangeError(`section column ${i} outside [0, ${grid.nx - 1}]`);
  const h = options.halfWidthColumns ?? PAGE_SECTION_HALF_WIDTH_COLUMNS;
  if (!Number.isInteger(h) || h < 0) throw new RangeError(`halfWidthColumns must be a whole number ≥ 0`);
  const columns: number[] = [];
  for (let c = Math.max(0, i - h); c <= Math.min(grid.nx - 1, i + h); c++) columns.push(c);
  const sections = columns.map((c) => measureSection(bed, ice, grid, c, options));
  const mean = (pick: (s: (typeof sections)[number]) => number) =>
    sections.reduce((sum, s) => sum + pick(s), 0) / sections.length;
  const fitted = sections.filter((s) => Number.isFinite(s.shapeExponent));
  return {
    i,
    columns,
    spanM: columns.length * grid.metresPerCell,
    floorElevationM: mean((s) => s.floorElevationM),
    floorWidthM: mean((s) => s.floorWidthM),
    depthM: mean((s) => s.depthM),
    maxWallSlopeDeg: mean((s) => s.maxWallSlopeDeg),
    wallSlopeDeg: mean((s) => s.wallSlopeDeg),
    shapeExponent: fitted.length
      ? fitted.reduce((sum, s) => sum + s.shapeExponent, 0) / fitted.length
      : Number.NaN,
    maxIceThicknessM: mean((s) => s.maxIceThicknessM),
  };
}

/**
 * Rise of the averaged valley floor down-valley from a section, carved since the start, that counts as an
 * overdeepening for the page (unit: metres). Aligned with 5L's note condition (`adverseRiseDownValleyM` ≥ 5 m
 * on the three-column floor). Averaging over three columns removes the ±10 m single-column alternation left
 * on the axis in the head basin (D-W5-5G2). A display threshold, not a geomorphic constant.
 */
export const OVERDEEPENING_MIN_RISE_M = 5;

export interface OverdeepeningOptions {
  /** The run's starting bed (same grid). Without it the start's rise is taken as 0. */
  readonly initialBed?: ArrayLike<number>;
  /** Default {@link OVERDEEPENING_MIN_RISE_M} (unit: metres). */
  readonly minRiseM?: number;
  /** Columns either side averaged into each floor (unit: cells). Default {@link PAGE_SECTION_HALF_WIDTH_COLUMNS}. */
  readonly halfWidthColumns?: number;
}

export interface OverdeepeningMeasure {
  /** Section column (unit: cells). */
  readonly i: number;
  /**
   * Valley floor at the section: the lowest bed of each column, averaged over the section's columns as in
   * `measureSectionAveraged` (unit: metres).
   */
  readonly floorElevationM: number;
  /**
   * Height the floor must rise, somewhere down-valley, for water to leave the section along the valley:
   * the highest averaged floor between the section and the mouth (i = 0), minus this floor; 0 when the floor
   * falls all the way to the mouth (unit: metres).
   */
  readonly adverseRiseDownValleyM: number;
  /** Column of that highest floor down-valley, the basin's lip (unit: cells); `i` when there is none. */
  readonly lipColumn: number;
  /**
   * The same rise on the run's starting bed (unit: metres); 0 without `initialBed`. Beyond the divide at
   * the valley head the authored ground already falls away from the valley; subtracting the start's rise
   * keeps that relief from counting as a basin carved by the ice.
   */
  readonly startAdverseRiseM: number;
  /** Rise carved since the start, `adverseRiseDownValleyM − startAdverseRiseM` (unit: metres). */
  readonly carvedRiseM: number;
  /** True when `carvedRiseM` reaches the threshold. */
  readonly overdeepened: boolean;
}

/** Averaged floor of the section at `i`, and the highest averaged floor between it and the mouth. */
function adverseRise(
  bed: ArrayLike<number>,
  grid: GridShape,
  i: number,
  h: number,
): { floor: number; lip: number; lipColumn: number } {
  const { nx, ny } = grid;
  const columnFloor = new Float64Array(i + h + 1 > nx ? nx : i + h + 1);
  for (let c = 0; c < columnFloor.length; c++) {
    let z = Infinity;
    for (let j = 0; j < ny; j++) z = Math.min(z, bed[j * nx + c]!);
    columnFloor[c] = z;
  }
  const floorAt = (c: number) => {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, c - h); k <= Math.min(nx - 1, c + h); k++) {
      sum += columnFloor[k]!;
      count++;
    }
    return sum / count;
  };
  const floor = floorAt(i);
  let lip = floor;
  let lipColumn = i;
  for (let c = i - 1; c >= 0; c--) {
    const z = floorAt(c);
    if (z > lip) {
      lip = z;
      lipColumn = c;
    }
  }
  return { floor, lip, lipColumn };
}

/**
 * Whether the section at column `i` sits in an overdeepening carved by the ice: its (averaged) floor lies
 * below the floor of some section down-valley (towards i = 0, the mouth), so the bed slopes up in the
 * direction of ice flow, by more than it did on the starting bed. A long-profile reading of the bed only;
 * ice is ignored.
 */
export function measureOverdeepening(
  bed: ArrayLike<number>,
  grid: GridShape,
  i: number,
  options: OverdeepeningOptions = {},
): OverdeepeningMeasure {
  if (!Number.isInteger(i) || i < 0 || i >= grid.nx)
    throw new RangeError(`section column ${i} outside [0, ${grid.nx - 1}]`);
  const h = options.halfWidthColumns ?? PAGE_SECTION_HALF_WIDTH_COLUMNS;
  if (!Number.isInteger(h) || h < 0) throw new RangeError("halfWidthColumns must be a whole number ≥ 0");
  const now = adverseRise(bed, grid, i, h);
  const start = options.initialBed ? adverseRise(options.initialBed, grid, i, h) : null;
  const adverseRiseDownValleyM = now.lip - now.floor;
  const startAdverseRiseM = start ? start.lip - start.floor : 0;
  const carvedRiseM = adverseRiseDownValleyM - startAdverseRiseM;
  return {
    i,
    floorElevationM: now.floor,
    adverseRiseDownValleyM,
    lipColumn: now.lipColumn,
    startAdverseRiseM,
    carvedRiseM,
    overdeepened: carvedRiseM >= (options.minRiseM ?? OVERDEEPENING_MIN_RISE_M),
  };
}
