/**
 * ILLUSTRATION — authored relief, NOT a simulation (owner exception D-L2-1, lesson 2 only).
 *
 * The pointwise formulas of session 7A (`docs/science/plates/parameters.md`, "Formulas"), in real metres:
 * `x` across the boundary (the boundary is `x = 0`, +x to the right as seen from the front), `z` along it
 * (− at the back, + towards the reader). Every landform here is drawn from a formula: nothing flows, moves
 * material or forms. The 7A storyboard (`docs/review/plates/brief/storyboard.mjs`) sketches the same
 * formulas with the same noise, so the review build and the approved storyboard agree.
 *
 * Every boundary term carries the factor `e = ease(stage)`, so stage 0 is the starting landscape for every
 * boundary, bit for bit, and every field is continuous in the stage.
 */
import type { PlateBoundary, PlatesReliefConfig } from "./config";

// ---------------------------------------------------------------------------------------------------------
// Seeded noise (no Math.random): integer hash → smooth value noise → three octaves. Same as 7A's sketch.
// ---------------------------------------------------------------------------------------------------------

/** Integer hash to [0, 1). Deterministic. */
export function hash01(x: number, y: number, seed: number): number {
  let h =
    (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `t²(3 − 2t)` with `t` clamped to [0, 1]. */
export function smoothstep(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  const v = (i: number, j: number) => hash01(x0 + i, y0 + j, seed) * 2 - 1;
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/** Fractal value noise (unit: none, about −0.7 to 0.7). */
export function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, seed) * 0.6 +
    valueNoise(x * 2, y * 2, seed + 1) * 0.3 +
    valueNoise(x * 4, y * 4, seed + 2) * 0.1
  );
}

/** The fbm's nominal half-range: dividing by it maps the noise to about [−1, 1]. */
const FBM_HALF_RANGE = 0.7;
/** Seed offsets keep the surface texture and the peak noise independent (7A's sketch uses the same). */
const MEANDER_PHASE_KEY = 11;
const PEAK_NOISE_SEED_OFFSET = 101;

// ---------------------------------------------------------------------------------------------------------
// The authored field
// ---------------------------------------------------------------------------------------------------------

/** One cell of the field, in real metres. */
export interface CellField {
  /** Surface (bed) elevation (unit: metres above sea level). */
  readonly bedM: number;
  /** Moho depth (unit: metres below sea level, positive down). */
  readonly mohoDepthM: number;
  /** Vertical displacement of the rock-layer stack relative to the start (unit: metres). */
  readonly layerOffsetM: number;
}

/** What a boundary does to one column across the block (everything here depends on `x` only). */
export interface ColumnProfile {
  /**
   * Smooth vertical change of surface and layers (unit: metres): convergent `E(x)` (the surface adds the
   * peak noise on top), divergent `Δ(x)`, transform 0. Also the layer offset.
   */
  readonly liftM: number;
  /** Moho depth (unit: metres below sea level). */
  readonly mohoDepthM: number;
  /** Along-boundary displacement (unit: metres; + towards the reader). Transform only; else 0. */
  readonly shiftM: number;
}

/** The pointwise formulas bound to one config. */
export interface PlatesField {
  /** Moho depth under the lowland, flat (unit: metres below sea level): `D0` (row 15, DERIVED). */
  readonly normalMohoDepthM: number;
  /** Rift fault lines `|x| = e_i`, outermost first (unit: metres from the boundary). Row 27. */
  readonly riftFaultsM: readonly number[];
  /** Smooth part of the start: the lowland and its tilt (unit: metres). Rows 7, 8. */
  startSmoothM(xM: number): number;
  /** The shared starting landscape (unit: metres). Rows 7–13. */
  startM(xM: number, zM: number): number;
  /** Undeformed base of start layer `i` (0 = top) (unit: metres). Row 14. */
  layerBaseM(i: number, xM: number): number;
  /** Smooth uplift envelope of the range, `E(x)` (unit: metres). Rows 19–22. */
  rangeEnvelopeM(xM: number, stage: number): number;
  /** Smooth surface change of the rift, `Δ(x)` (unit: metres). Rows 25–31. */
  riftChangeM(xM: number, stage: number): number;
  /** Rise of the Moho under the rift (unit: metres). Rows 32, 33. */
  riftMohoRiseM(xM: number, stage: number): number;
  /** Along-boundary displacement of each side, right-lateral (unit: metres; + towards the reader). Rows 34–36. */
  transformShiftM(xM: number, stage: number): number;
  /** Peak-and-saddle noise of the range (unit: none, in [−1, 1]). Row 23, 24. Independent of the stage. */
  peakNoise(xM: number, zM: number): number;
  /** The parts of a boundary that depend only on `x` and the stage. */
  column(boundary: PlateBoundary, stage: number, xM: number): ColumnProfile;
  /** One cell of a boundary at a stage: the reference formula the grid must match bit for bit. */
  cell(boundary: PlateBoundary, stage: number, xM: number, zM: number): CellField;
  /** Ridge- and noise-free surface (unit: metres), for the crust-geometry table. */
  smoothSurfaceM(boundary: PlateBoundary, stage: number, xM: number): number;
}

/** Row 5: the stage is "early → late", linear. Clamped to [0, 1]. */
export const ease = (stage: number): number => clamp(stage, 0, 1);

export function platesField(config: PlatesReliefConfig): PlatesField {
  const S = config.start;
  const C = config.crust;
  const G = config.convergent;
  const R = config.divergent;
  const T = config.transform;
  const seed = config.seed;

  if (R.scarpDropFractions.length !== R.scarpsPerSide)
    throw new RangeError("divergent.scarpDropFractions needs one entry per scarp");
  if (T.sense !== "right-lateral") throw new RangeError("Only a right-lateral transform is authored");

  const normalMohoDepthM = C.normalThicknessM - S.lowlandElevationM; // row 15, DERIVED D0
  const meanderPhase = 2 * Math.PI * hash01(MEANDER_PHASE_KEY, 0, seed);

  const startSmoothM = (x: number) => S.lowlandElevationM - (S.regionalTiltMPerKm * x) / 1000;
  const meander = (x: number) =>
    S.ridgeMeanderAmplitudeM * Math.sin((2 * Math.PI * x) / S.ridgeMeanderWavelengthM + meanderPhase);

  const startM = (x: number, z: number) => {
    const u = (z + meander(x)) / S.ridgeSpacingM;
    const ridge = 0.5 * S.ridgeReliefM * Math.cos(2 * Math.PI * u);
    const d = Math.abs(u - Math.floor(u) - 0.5) * S.ridgeSpacingM; // distance to the trough line
    const channel = -S.streamChannelDepthM * smoothstep(1 - d / (S.streamChannelWidthM / 2));
    const noise =
      S.surfaceNoiseAmplitudeM *
      (fbm(x / S.surfaceNoiseWavelengthM, z / S.surfaceNoiseWavelengthM, seed) / FBM_HALF_RANGE);
    return startSmoothM(x) + ridge + channel + noise;
  };

  const layerTops = [0];
  for (const l of S.layers) layerTops.push(layerTops[layerTops.length - 1]! + l.thicknessM);
  const layerBaseM = (i: number, x: number) =>
    startSmoothM(x) - S.ridgeReliefM / 2 - layerTops[clamp(i, 0, S.layers.length - 1) + 1]!;

  const rangeEnvelopeM = (x: number, stage: number) => {
    const e = ease(stage);
    const k = G.rangeWidthAtStageZeroFraction + (1 - G.rangeWidthAtStageZeroFraction) * e;
    const p = smoothstep((G.rangeWidthM * k * 0.5 - Math.abs(x)) / (G.rangeFlankWidthM * k));
    return e * (G.rangeCrestElevationM - S.lowlandElevationM) * p;
  };

  const outer = R.riftWidthM / 2;
  const inner = R.riftFloorWidthM / 2;
  const riftFaultsM = Object.freeze(
    Array.from(
      { length: R.scarpsPerSide },
      (_, i) => outer + ((inner - outer) * i) / Math.max(1, R.scarpsPerSide - 1),
    ),
  );
  const scarp = (edge: number, a: number) => smoothstep((edge - a) / R.scarpFaceWidthM + 0.5);

  const riftChangeM = (x: number, stage: number) => {
    const a = Math.abs(x);
    let drop = 0;
    for (let i = 0; i < riftFaultsM.length; i++)
      drop += R.floorDropM * R.scarpDropFractions[i]! * scarp(riftFaultsM[i]!, a);
    const shoulder =
      R.shoulderHeightM *
      Math.exp(-Math.max(0, a - riftFaultsM[0]!) / R.shoulderDecayM) *
      (1 - scarp(riftFaultsM[0]!, a));
    return ease(stage) * (shoulder - drop);
  };

  // Row 32: Moho rise at the axis at stage 1 = D0 − (crust at axis − floor elevation) (DERIVED, 8,800 m).
  const axisRiseM = normalMohoDepthM - (R.crustThicknessAtAxisM - (S.lowlandElevationM - R.floorDropM));
  const riftMohoRiseM = (x: number, stage: number) => {
    const a = Math.abs(x);
    if (a >= R.thinningHalfWidthM) return 0;
    return ease(stage) * axisRiseM * Math.cos((Math.PI * a) / (2 * R.thinningHalfWidthM)) ** 2;
  };

  const transformShiftM = (x: number, stage: number) =>
    0.5 * ease(stage) * T.offsetM * Math.tanh(x / T.faultZoneHalfWidthM);

  const peakNoise = (x: number, z: number) =>
    clamp(
      fbm(x / G.peakNoiseWavelengthM, z / G.peakNoiseWavelengthM, seed + PEAK_NOISE_SEED_OFFSET) /
        FBM_HALF_RANGE,
      -1,
      1,
    );

  // `+ 0` turns a −0 (a zero factor times a negative profile) into +0, so stage 0 is identical bit for bit.
  const column = (boundary: PlateBoundary, stage: number, x: number): ColumnProfile => {
    switch (boundary) {
      case "convergent": {
        const E = rangeEnvelopeM(x, stage);
        // The root sits under the smooth envelope only; the peak noise never touches it (row 23).
        return { liftM: E + 0, mohoDepthM: normalMohoDepthM + C.airyRootPerMetreOfUplift * E, shiftM: 0 };
      }
      case "divergent": {
        const d = riftChangeM(x, stage);
        return { liftM: d + 0, mohoDepthM: normalMohoDepthM - riftMohoRiseM(x, stage), shiftM: 0 };
      }
      case "transform":
        return { liftM: 0, mohoDepthM: normalMohoDepthM, shiftM: transformShiftM(x, stage) + 0 };
    }
  };

  const cell = (boundary: PlateBoundary, stage: number, x: number, z: number): CellField => {
    const p = column(boundary, stage, x);
    switch (boundary) {
      case "convergent":
        return {
          bedM: startM(x, z) + p.liftM * (1 + G.peakNoiseFraction * peakNoise(x, z)),
          mohoDepthM: p.mohoDepthM,
          layerOffsetM: p.liftM,
        };
      case "divergent":
        return { bedM: startM(x, z) + p.liftM, mohoDepthM: p.mohoDepthM, layerOffsetM: p.liftM };
      case "transform":
        // Relief only moves sideways; the fault trace is ink (7D), never cut into the relief (D-W7-7A, 6).
        return { bedM: startM(x, z - p.shiftM), mohoDepthM: p.mohoDepthM, layerOffsetM: 0 };
    }
  };

  const smoothSurfaceM = (boundary: PlateBoundary, stage: number, x: number) => {
    if (boundary === "convergent") return startSmoothM(x) + rangeEnvelopeM(x, stage);
    if (boundary === "divergent") return startSmoothM(x) + riftChangeM(x, stage);
    return startSmoothM(x);
  };

  return {
    normalMohoDepthM,
    riftFaultsM,
    startSmoothM,
    startM,
    layerBaseM,
    rangeEnvelopeM,
    riftChangeM,
    riftMohoRiseM,
    transformShiftM,
    peakNoise,
    column,
    cell,
    smoothSurfaceM,
  };
}
