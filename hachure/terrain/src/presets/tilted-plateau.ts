/**
 * The `tilted-plateau` preset: Demo 1's starting landscape.
 *
 * An initial tilted catchment, not a scripted valley. Any valley must be carved later by the solver. The
 * geometry is the common protocol of docs/science/validation-spec.md (an expert-review draft):
 *
 *   ground z = baseElevationM + (L − y)·tan(slopeDeg) + crossCurvaturePerM·(x − L/2)²
 *
 * where x, y are cell-centre metres (x east, y south) and L = gridSize × metresPerCell. A uniform loose
 * layer `looseThicknessM` sits on bedrock `z − looseThicknessM`, plus seeded zero-mean noise bounded by
 * `noiseAmplitudeM` on the bedrock. Hardness is uniform, optionally with east–west hard bands (AC3b). The
 * outlet is the centre cell of the south edge, and a clean-water spring is declared near the north edge.
 *
 * **Grid-size independence.** Every feature is a continuous function of position as a fraction of L: the
 * surface is evaluated at cell centres, and the noise is bilinear on a lattice with a fixed number of
 * intervals per side (not per cell). So the same L and seed give the same landscape at any grid size. For
 * example 128² at 10 m and 256² at 5 m are two samplings of one 1280 m landscape, and each 2×2 block of the
 * fine grid averages to its coarse cell to within the curvature term. The preset id does not depend on the
 * grid.
 */
import {
  type Cell,
  type SpringOp,
  type TerrainState,
  cellAt,
  cellIndex,
  createTerrainState,
} from "../contract/index";
import { createRng, deriveSeed } from "../rng/index";
import type { PresetConfig, PresetLayout, PresetWithLayout } from "./layout";

export const TILTED_PLATEAU_ID = "tilted-plateau";

/** A band of uniform hardness across the whole width, between two north–south positions. */
export interface HardBand {
  /** Northern edge as a fraction of the domain length L, inclusive (unit: none, in [0, 1)). */
  readonly fromYFraction: number;
  /** Southern edge as a fraction of L, exclusive (unit: none, in (0, 1]). */
  readonly toYFraction: number;
  /** Hardness inside the band (unit: none). Clamped to the config's `hardnessRange`. */
  readonly hardness: number;
}

/** The typed preset definition (docs/science/parameters.md: "Slope is a preset parameter"). */
export interface TiltedPlateauOptions {
  /** Downslope angle of the plane, falling to the south (unit: degrees). Reader range 1–10. */
  readonly slopeDeg: number;
  /** Ground elevation at the south edge on the centre line (unit: metres). */
  readonly baseElevationM: number;
  /** Cross-valley curvature: ground rises by this times (x − L/2)² (unit: per metre). */
  readonly crossCurvaturePerM: number;
  /** Initial loose-sediment thickness everywhere (unit: metres). */
  readonly looseThicknessM: number;
  /** Default rock hardness (unit: none). Clamped to the config's `hardnessRange`. */
  readonly hardness: number;
  /** Bound on the seeded zero-mean bedrock perturbation (unit: metres). */
  readonly noiseAmplitudeM: number;
  /** Discharge of the declared river-source spring (unit: cubic metres per second). */
  readonly sourceFlowM3PerS: number;
  /** Optional hard bands, applied in order (a later band wins where two overlap). */
  readonly hardBands: readonly HardBand[];
}

/**
 * Defaults from the common protocol in docs/science/validation-spec.md and the preset hardness and slope in
 * docs/science/parameters.md. Both are expert-review drafts; these are engineering values, not measurements.
 */
export const DEFAULT_TILTED_PLATEAU_OPTIONS: TiltedPlateauOptions = Object.freeze({
  slopeDeg: 5,
  baseElevationM: 150,
  crossCurvaturePerM: 0.0002,
  looseThicknessM: 1,
  hardness: 0.2,
  noiseAmplitudeM: 0.01,
  sourceFlowM3PerS: 0.1,
  hardBands: Object.freeze([]) as readonly HardBand[],
});

/** Reader range for the preset slope (docs/science/parameters.md, "Preset downslope angle"). */
export const TILTED_PLATEAU_SLOPE_LIMITS_DEG = Object.freeze({ min: 1, max: 10 });

/**
 * River source position as fractions of L. At the reference 128² grid this is the centre cell of row 8
 * (validation-spec.md, "Common protocol"); at other grid sizes it is the same point in metres.
 */
const SOURCE_X_FRACTION = 0.5;
const SOURCE_Y_FRACTION = 8.5 / 128;

/** Noise lattice intervals per side. Fixed, so the noise is the same field at every grid size. */
const NOISE_LATTICE_INTERVALS = 128;

/** The `tilted-plateau` preset, with the options it was built from. */
export interface TiltedPlateauPreset extends PresetWithLayout {
  readonly id: typeof TILTED_PLATEAU_ID;
  readonly options: TiltedPlateauOptions;
}

function finite(name: string, value: number, min = -Infinity, max = Infinity): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`tilted-plateau: ${name} = ${value} must be finite and in [${min}, ${max}]`);
  }
}

function validateOptions(o: TiltedPlateauOptions): void {
  finite("slopeDeg", o.slopeDeg, TILTED_PLATEAU_SLOPE_LIMITS_DEG.min, TILTED_PLATEAU_SLOPE_LIMITS_DEG.max);
  finite("baseElevationM", o.baseElevationM);
  finite("crossCurvaturePerM", o.crossCurvaturePerM, 0);
  finite("looseThicknessM", o.looseThicknessM, 0);
  finite("hardness", o.hardness, 0, 1);
  finite("noiseAmplitudeM", o.noiseAmplitudeM, 0);
  finite("sourceFlowM3PerS", o.sourceFlowM3PerS, 0);
  o.hardBands.forEach((band, k) => {
    finite(`hardBands[${k}].fromYFraction`, band.fromYFraction, 0, 1);
    finite(`hardBands[${k}].toYFraction`, band.toYFraction, 0, 1);
    finite(`hardBands[${k}].hardness`, band.hardness, 0, 1);
    if (!(band.fromYFraction < band.toYFraction)) {
      throw new RangeError(`tilted-plateau: hardBands[${k}] needs fromYFraction < toYFraction`);
    }
  });
}

function validateConfig(config: PresetConfig): void {
  const { gridSize, metresPerCell, seed, hardnessRange } = config;
  if (!Number.isInteger(gridSize) || gridSize < 2) {
    throw new RangeError(`tilted-plateau: gridSize must be an integer ≥ 2, got ${gridSize}`);
  }
  finite("metresPerCell", metresPerCell, Number.MIN_VALUE);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError(`tilted-plateau: seed must be an unsigned 32-bit integer, got ${seed}`);
  }
  const [lo, hi] = hardnessRange;
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi <= 1 && lo <= hi)) {
    throw new RangeError("tilted-plateau: hardnessRange must satisfy 0 ≤ min ≤ max ≤ 1");
  }
}

/**
 * Seeded lattice values for the bedrock perturbation: zero mean over the lattice nodes, and scaled so the
 * largest magnitude is exactly `amplitudeM`. Bilinear interpolation never leaves that bound.
 */
function noiseLattice(seed: number, amplitudeM: number): Float64Array {
  const side = NOISE_LATTICE_INTERVALS + 1;
  const values = new Float64Array(side * side);
  if (amplitudeM === 0) return values;
  const rng = createRng(deriveSeed(seed, `${TILTED_PLATEAU_ID}/noise`));
  let sum = 0;
  for (let k = 0; k < values.length; k++) {
    values[k] = rng.nextRange(-1, 1);
    sum += values[k]!;
  }
  const mean = sum / values.length;
  let maxAbs = 0;
  for (let k = 0; k < values.length; k++) {
    values[k] = values[k]! - mean;
    maxAbs = Math.max(maxAbs, Math.abs(values[k]!));
  }
  const scale = maxAbs > 0 ? amplitudeM / maxAbs : 0;
  for (let k = 0; k < values.length; k++) values[k] = values[k]! * scale;
  return values;
}

/** Bilinear sample of the lattice at fractional position (u, v) in [0, 1]². */
function sampleLattice(lattice: Float64Array, u: number, v: number): number {
  const n = NOISE_LATTICE_INTERVALS;
  const gx = u * n;
  const gy = v * n;
  const ix = Math.min(n - 1, Math.max(0, Math.floor(gx)));
  const iy = Math.min(n - 1, Math.max(0, Math.floor(gy)));
  const fx = gx - ix;
  const fy = gy - iy;
  const side = n + 1;
  const v00 = lattice[iy * side + ix]!;
  const v10 = lattice[iy * side + ix + 1]!;
  const v01 = lattice[(iy + 1) * side + ix]!;
  const v11 = lattice[(iy + 1) * side + ix + 1]!;
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function outletOf(gridSize: number): Cell {
  return { x: Math.floor(gridSize / 2), y: gridSize - 1 };
}

function build(options: TiltedPlateauOptions, config: PresetConfig): TerrainState {
  validateConfig(config);
  const { gridSize: n, metresPerCell: m, seed, hardnessRange } = config;
  const state = createTerrainState(n, m, outletOf(n));
  const { bedrockM, sedimentM, hardness } = state.layers;
  const L = n * m;
  const tanSlope = Math.tan((options.slopeDeg * Math.PI) / 180);
  const lattice = noiseLattice(seed, options.noiseAmplitudeM);
  const [hLo, hHi] = hardnessRange;
  const defaultHardness = clamp(options.hardness, hLo, hHi);

  for (let y = 0; y < n; y++) {
    const yM = (y + 0.5) * m;
    const v = yM / L;
    let rowHardness = defaultHardness;
    for (const band of options.hardBands) {
      if (v >= band.fromYFraction && v < band.toYFraction) rowHardness = clamp(band.hardness, hLo, hHi);
    }
    for (let x = 0; x < n; x++) {
      const xM = (x + 0.5) * m;
      const dx = xM - L / 2;
      const groundM = options.baseElevationM + (L - yM) * tanSlope + options.crossCurvaturePerM * dx * dx;
      const i = cellIndex(n, x, y);
      bedrockM[i] = groundM - options.looseThicknessM + sampleLattice(lattice, xM / L, v);
      sedimentM[i] = options.looseThicknessM;
      hardness[i] = rowHardness;
    }
  }
  return state;
}

function layoutOf(options: TiltedPlateauOptions, config: PresetConfig): PresetLayout {
  // Build the state so the base level is the stored float32 ground at the outlet, bit for bit.
  const state = build(options, config);
  const { gridSize: n, metresPerCell: m } = config;
  const L = n * m;
  const at = { xM: SOURCE_X_FRACTION * L, yM: SOURCE_Y_FRACTION * L };
  const sourceCell = cellAt(n, m, at)!;
  const o = cellIndex(n, state.outlet.x, state.outlet.y);
  const source: SpringOp = {
    kind: "spring",
    id: `${TILTED_PLATEAU_ID}/source`,
    at,
    flowM3PerS: options.sourceFlowM3PerS,
  };
  return {
    outlet: { ...state.outlet },
    outletFace: "south",
    baseLevelM: state.layers.bedrockM[o]! + state.layers.sedimentM[o]!,
    source,
    sourceCell,
  };
}

/**
 * Builds a `tilted-plateau` preset. Missing options take the defaults. Throws `RangeError` for options out
 * of range (the slope must stay within `TILTED_PLATEAU_SLOPE_LIMITS_DEG`).
 */
export function createTiltedPlateauPreset(
  overrides: Partial<TiltedPlateauOptions> = {},
): TiltedPlateauPreset {
  const options: TiltedPlateauOptions = Object.freeze({
    ...DEFAULT_TILTED_PLATEAU_OPTIONS,
    ...overrides,
    hardBands: Object.freeze(
      (overrides.hardBands ?? DEFAULT_TILTED_PLATEAU_OPTIONS.hardBands).map((b) => Object.freeze({ ...b })),
    ),
  });
  validateOptions(options);
  return Object.freeze({
    id: TILTED_PLATEAU_ID,
    options,
    create: (config: PresetConfig) => build(options, config),
    layout: (config: PresetConfig) => layoutOf(options, config),
  });
}

/** The default `tilted-plateau` preset. */
export const tiltedPlateauPreset: TiltedPlateauPreset = createTiltedPlateauPreset();
