/**
 * Probes: the numbers the page binds to (frozen contract, session 5G).
 *
 * Section measures are pure functions of a bed (and ice) field, so the runtime and the scene compute them
 * from recorded snapshots at any cut position, and the page and the acceptance protocol use one definition.
 * Definitions are registered in docs/science/glacial/acceptance-protocol.md.
 */

export interface GridShape {
  readonly nx: number;
  readonly ny: number;
  readonly metresPerCell: number;
}

/** Measures of one across-valley section (grid column i). All lengths in metres, angles in degrees. */
export interface SectionMeasure {
  /** Grid column measured (unit: cells). */
  readonly i: number;
  /** Distance of the section from the downstream edge (unit: metres). */
  readonly sectionXM: number;
  /** Lowest bed elevation in the section, the valley floor (unit: metres). */
  readonly floorElevationM: number;
  /** Across-valley position of the floor centre (unit: metres from the j = 0 edge). */
  readonly floorCentreYM: number;
  /**
   * Valley depth: the lower of the two rims (highest bed on each side of the floor) minus the floor
   * (unit: metres).
   */
  readonly depthM: number;
  /** Width of the valley floor: the continuous bed within `floorBandM` of the lowest point (unit: metres). */
  readonly floorWidthM: number;
  /** Valley width at half depth (unit: metres). */
  readonly halfDepthWidthM: number;
  /** Mean slope of the lower walls, between 10 % and 60 % of depth, both sides (unit: degrees). */
  readonly wallSlopeDeg: number;
  /** Steepest cell-to-cell wall slope in the section (unit: degrees). */
  readonly maxWallSlopeDeg: number;
  /**
   * Cross-profile shape exponent b from a least-squares fit of (z − floor) = a·|y − centre|^b over the
   * lower section, 5 % to 60 % of depth, where a glacier works (Svensson 1959; Harbor 1992): about 1 for a
   * V, about 2 or more for a U (unit: none).
   */
  readonly shapeExponent: number;
  /** Depth over width at the rims, the form ratio (unit: none). */
  readonly formRatio: number;
  /** Thickest ice in the section; 0 when ice-free (unit: metres). */
  readonly maxIceThicknessM: number;
}

export interface SectionOptions {
  /** Height above the lowest point that still counts as floor (unit: metres). Default 25. */
  readonly floorBandM?: number;
}

export const DEFAULT_FLOOR_BAND_M = 25;
/** Depth fractions bounding the lower-wall slope measure. */
export const WALL_BAND = [0.1, 0.6] as const;
/** Depth fractions bounding the shape-exponent fit. */
export const SHAPE_BAND = [0.05, 0.6] as const;

const RAD_TO_DEG = 180 / Math.PI;

/** Interpolated crossing of `level` between samples a (at k) and b (at k + step). Returns a fractional index. */
function crossing(level: number, a: number, b: number, k: number, step: number): number {
  if (b === a) return k;
  return k + (step * (level - a)) / (b - a);
}

/**
 * Measures the across-valley section at column `i` of a row-major (`j * nx + i`) bed field.
 * Pure; never touches solver state.
 */
export function measureSection(
  bed: ArrayLike<number>,
  ice: ArrayLike<number> | undefined,
  grid: GridShape,
  i: number,
  options: SectionOptions = {},
): SectionMeasure {
  const { nx, ny, metresPerCell: dx } = grid;
  if (!Number.isInteger(i) || i < 0 || i >= nx)
    throw new RangeError(`section column ${i} outside [0, ${nx - 1}]`);
  const band = options.floorBandM ?? DEFAULT_FLOOR_BAND_M;
  const z = new Float64Array(ny);
  let maxIce = 0;
  for (let j = 0; j < ny; j++) {
    z[j] = bed[j * nx + i]!;
    if (ice) maxIce = Math.max(maxIce, ice[j * nx + i]!);
  }
  // Thalweg (first lowest sample; ties resolved toward the lower index for determinism).
  let jMin = 0;
  for (let j = 1; j < ny; j++) if (z[j]! < z[jMin]!) jMin = j;
  const floor = z[jMin]!;
  // Floor: continuous run within the band of the lowest point, with interpolated ends.
  let jl = jMin;
  while (jl > 0 && z[jl - 1]! <= floor + band) jl--;
  let jr = jMin;
  while (jr < ny - 1 && z[jr + 1]! <= floor + band) jr++;
  const floorL = jl > 0 ? crossing(floor + band, z[jl]!, z[jl - 1]!, jl, -1) : 0;
  const floorR = jr < ny - 1 ? crossing(floor + band, z[jr]!, z[jr + 1]!, jr, 1) : ny - 1;
  const floorWidthM = (floorR - floorL) * dx;
  const centre = (floorL + floorR) / 2;
  // Rims: highest bed on each side.
  let rimL = -Infinity;
  let jRimL = 0;
  for (let j = 0; j <= jMin; j++)
    if (z[j]! > rimL) {
      rimL = z[j]!;
      jRimL = j;
    }
  let rimR = -Infinity;
  let jRimR = ny - 1;
  for (let j = ny - 1; j >= jMin; j--)
    if (z[j]! > rimR) {
      rimR = z[j]!;
      jRimR = j;
    }
  const depthM = Math.max(0, Math.min(rimL, rimR) - floor);
  // Width at a given height above the floor: walk outward from the thalweg to the first crossing.
  const widthAt = (h: number): number => {
    const level = floor + h;
    let a = jMin;
    while (a > 0 && z[a - 1]! < level) a--;
    let b = jMin;
    while (b < ny - 1 && z[b + 1]! < level) b++;
    const l = a > 0 ? crossing(level, z[a]!, z[a - 1]!, a, -1) : 0;
    const r = b < ny - 1 ? crossing(level, z[b]!, z[b + 1]!, b, 1) : ny - 1;
    return (r - l) * dx;
  };
  const halfDepthWidthM = depthM > 0 ? widthAt(depthM / 2) : 0;
  // Lower-wall slopes within 10–60 % of depth (cell-to-cell, both sides), and the steepest wall step.
  let slopeSum = 0;
  let slopeCount = 0;
  let maxSlope = 0;
  const lo = floor + WALL_BAND[0] * depthM;
  const hi = floor + WALL_BAND[1] * depthM;
  for (let j = jRimL; j < jRimR; j++) {
    const s = Math.abs(z[j + 1]! - z[j]!) / dx;
    maxSlope = Math.max(maxSlope, s);
    const mid = 0.5 * (z[j + 1]! + z[j]!);
    if (mid >= lo && mid <= hi) {
      slopeSum += Math.atan(s);
      slopeCount++;
    }
  }
  const wallSlopeDeg = slopeCount > 0 ? (slopeSum / slopeCount) * RAD_TO_DEG : 0;
  // Shape exponent: log-log least squares over samples between 5 % and 60 % of depth.
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let n = 0;
  for (let j = jRimL; j <= jRimR; j++) {
    const h = z[j]! - floor;
    const y = Math.abs(j - centre) * dx;
    if (h < SHAPE_BAND[0] * depthM || h > SHAPE_BAND[1] * depthM || y < dx * 0.5) continue;
    const lx = Math.log(y);
    const ly = Math.log(h);
    sx += lx;
    sy += ly;
    sxx += lx * lx;
    sxy += lx * ly;
    n++;
  }
  const denom = n * sxx - sx * sx;
  const shapeExponent = n >= 3 && denom > 0 ? (n * sxy - sx * sy) / denom : Number.NaN;
  const rimWidthM = (jRimR - jRimL) * dx;
  return {
    i,
    sectionXM: i * dx,
    floorElevationM: floor,
    floorCentreYM: centre * dx,
    depthM,
    floorWidthM,
    halfDepthWidthM,
    wallSlopeDeg,
    maxWallSlopeDeg: Math.atan(maxSlope) * RAD_TO_DEG,
    shapeExponent,
    formRatio: rimWidthM > 0 ? depthM / rimWidthM : 0,
    maxIceThicknessM: maxIce,
  };
}

/** Whole-run probes. Volumes in cubic metres, speeds in metres per year. */
export interface GlacierProbes {
  readonly step: number;
  readonly modelYears: number;
  /** Total ice volume (unit: cubic metres). */
  readonly iceVolumeM3: number;
  /** Area covered by ice at least `minIceThicknessM` thick (unit: square metres). */
  readonly iceAreaM2: number;
  /** Net rock volume removed by glacial erosion since the start (unit: cubic metres). */
  readonly erodedVolumeM3: number;
  /** Fastest basal sliding speed (unit: metres per year). */
  readonly maxSlidingSpeedMPerYear: number;
  /** Fastest ice surface speed (unit: metres per year). */
  readonly maxSurfaceSpeedMPerYear: number;
  /**
   * Downstream-most ice-covered column along the valley axis band, the snout (unit: metres from the
   * downstream edge); NaN when there is no ice.
   */
  readonly snoutXM: number;
}

/**
 * Probes computable from a snapshot plus the run's starting bed (sliding speed is not recorded in a
 * snapshot, so it is taken as an argument; pass NaN when unknown).
 */
export function probesFromFields(
  grid: GridShape,
  fields: {
    readonly bedM: ArrayLike<number>;
    readonly initialBedM: ArrayLike<number>;
    readonly iceThicknessM: ArrayLike<number>;
    readonly surfaceVelocityXMPerYear: ArrayLike<number>;
    readonly surfaceVelocityYMPerYear: ArrayLike<number>;
  },
  step: number,
  modelYears: number,
  minIceThicknessM: number,
  maxSlidingSpeedMPerYear: number,
): GlacierProbes {
  const { nx, ny, metresPerCell: dx } = grid;
  const area = dx * dx;
  let vol = 0;
  let iceCells = 0;
  let eroded = 0;
  let maxSurf = 0;
  let snout = Number.POSITIVE_INFINITY;
  const jLo = Math.floor(ny * 0.25);
  const jHi = Math.ceil(ny * 0.75);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const h = fields.iceThicknessM[k]!;
      vol += h;
      eroded += fields.initialBedM[k]! - fields.bedM[k]!;
      if (h >= minIceThicknessM) {
        iceCells++;
        if (j >= jLo && j < jHi && i < snout) snout = i;
      }
      const vx = fields.surfaceVelocityXMPerYear[k]!;
      const vy = fields.surfaceVelocityYMPerYear[k]!;
      maxSurf = Math.max(maxSurf, Math.hypot(vx, vy));
    }
  }
  return {
    step,
    modelYears,
    iceVolumeM3: vol * area,
    iceAreaM2: iceCells * area,
    erodedVolumeM3: eroded * area,
    maxSlidingSpeedMPerYear,
    maxSurfaceSpeedMPerYear: maxSurf,
    snoutXM: Number.isFinite(snout) ? snout * dx : Number.NaN,
  };
}
