/**
 * The authored starting state: one V-shaped river valley, the same for every run (wave plan §3).
 *
 * A straight valley runs along grid x. Its floor rises from the downstream edge (i = 0) to a headwall at
 * the valley end; its sides are planar V walls capped by ridges that rise toward the head. In the
 * registered start (`v-valley/2`, session 5G2) the valley ends inside the grid and the walls, the crest
 * and the outer flank wrap round its end, so the head is a basin enclosed by higher ground on three sides
 * and the ground above the snowline drains into the valley rather than to the grid border. The 5G start
 * (`v-valley/1`, open head running to the grid edge) is kept as {@link OPEN_HEAD_V_VALLEY} for the record.
 * Every slope is gentler than the softest rock's critical wall slope, so no rock fails at the start and
 * the start is the same V for every rock. A small seeded roughness breaks perfect symmetry.
 *
 * This is an authored teaching landscape, labelled as the starting point; it is not a real place.
 */
import { createRng } from "@hachure/terrain";
import type { GlacierConfig } from "../contract/config";

export interface VValleyOptions {
  /** Valley floor elevation at the downstream edge (unit: metres). */
  readonly floorAtMouthM: number;
  /** Floor rise from mouth to the foot of the headwall (unit: metres). */
  readonly floorRiseM: number;
  /** Exponent of the concave-up long profile (unit: none). */
  readonly longProfileExponent: number;
  /** Extra rise of the headwall over the last `headwallFraction` of the valley (unit: metres). */
  readonly headwallRiseM: number;
  /** Fraction of the valley length occupied by the headwall (unit: none). */
  readonly headwallFraction: number;
  /** Slope of the V walls (unit: degrees). Must stay below every rock's critical slope. */
  readonly wallSlopeDeg: number;
  /** Ridge-crest elevation at the mouth (unit: metres). */
  readonly ridgeAtMouthM: number;
  /** Ridge-crest rise from mouth to head (unit: metres). */
  readonly ridgeRiseM: number;
  /** Exponent of the ridge-crest profile: >1 keeps the lower ridges low and the head high (unit: none). */
  readonly ridgeProfileExponent: number;
  /** Rounding of the wall-to-ridge corner (unit: metres). */
  readonly ridgeRoundingM: number;
  /** Slope of the outer flanks beyond the ridge crests, falling towards the grid edges (unit: degrees). */
  readonly outerFlankSlopeDeg: number;
  /** Amplitude of the seeded, smoothed bed roughness (unit: metres). */
  readonly roughnessM: number;
  /**
   * Length of the valley from the mouth (i = 0) to the valley end (unit: metres). 0: the valley runs to
   * the grid edge, an open head (the session 5G start). Positive: beyond the valley end the floor, the
   * V walls, the crest and the outer flank continue radially around the end of the axis, so the head is
   * an amphitheatre enclosed by higher ground on three sides (session 5G2).
   */
  readonly valleyLengthM: number;
  /**
   * Lowest level of the outer flanks, as a fraction of the way from the valley floor up to the crest
   * (unit: none). 0.5 keeps outer plateaus halfway up (the 5G start); 0 lets the flanks fall to the level
   * of the valley floor beside them.
   */
  readonly outerFlankFloorFraction: number;
}

/**
 * The session 5G start (`v-valley/1`): the valley runs to the grid edge (128 × 96 cells, 40 m) and the
 * outer flanks keep plateaus above the snowline. Kept so the 5G registered runs stay reproducible; its
 * glacier leaked through the open border in soft rock (docs/science/glacial/feasibility.md).
 */
export const OPEN_HEAD_V_VALLEY: VValleyOptions = Object.freeze({
  floorAtMouthM: 1300,
  floorRiseM: 150,
  longProfileExponent: 1,
  headwallRiseM: 400,
  headwallFraction: 0.32,
  wallSlopeDeg: 26,
  ridgeAtMouthM: 1550,
  ridgeRiseM: 1000,
  ridgeProfileExponent: 2.5,
  ridgeRoundingM: 80,
  outerFlankSlopeDeg: 8,
  roughnessM: 2,
  valleyLengthM: 0,
  outerFlankFloorFraction: 0.5,
});

/**
 * The registered start (`v-valley/2`, session 5G2), on the 160 × 64 reference grid: the same valley
 * floor and V walls as `v-valley/1` over the first 5080 m (so the registered sections keep their start
 * shape), ending in a head basin enclosed by a crest 200 m lower than before (so it fits the grid);
 * steeper outer flanks without plateaus, so the ground outside the crest carries only thin, cold-based
 * ice. Teaching choices, chosen in pilots recorded in docs/science/glacial/feasibility.md.
 */
export const DEFAULT_V_VALLEY: VValleyOptions = Object.freeze({
  ...OPEN_HEAD_V_VALLEY,
  ridgeRiseM: 800,
  outerFlankSlopeDeg: 14,
  valleyLengthM: 5080,
  outerFlankFloorFraction: 0.25,
});

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Smooth minimum of a and b with rounding width k (metres). */
function softMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** Builds the starting bed (Float64, row-major `j * nx + i`). Deterministic in `config.seed`. */
export function createVValleyBed(
  config: Pick<GlacierConfig, "nx" | "ny" | "metresPerCell" | "seed">,
  options: VValleyOptions = DEFAULT_V_VALLEY,
): Float64Array {
  const { nx, ny, metresPerCell: dx } = config;
  const bed = new Float64Array(nx * ny);
  const tanWall = Math.tan((options.wallSlopeDeg * Math.PI) / 180);
  const yAxis = ((ny - 1) / 2) * dx;
  const hw = options.headwallFraction;
  const tanOuter = Math.tan((options.outerFlankSlopeDeg * Math.PI) / 180);
  // Valley end (grid x, metres). Beyond it, distances are measured radially from the end of the axis.
  const open = options.valleyLengthM <= 0;
  const xEnd = open ? (nx - 1) * dx : options.valleyLengthM;
  const fOuter = options.outerFlankFloorFraction;
  for (let i = 0; i < nx; i++) {
    // Position along the valley: 0 at the mouth, 1 at the valley end.
    const xi = open ? i / (nx - 1) : Math.min(i * dx, xEnd) / xEnd;
    const beyond = open ? 0 : Math.max(0, i * dx - xEnd);
    const floor =
      options.floorAtMouthM +
      options.floorRiseM * Math.pow(Math.min(xi / (1 - hw), 1), options.longProfileExponent) +
      options.headwallRiseM * smoothstep(1 - hw, 1, xi);
    const ridge = options.ridgeAtMouthM + options.ridgeRiseM * Math.pow(xi, options.ridgeProfileExponent);
    const crestOffset = (ridge - floor) / tanWall;
    // (1 − f)·floor + f·ridge; at f = 0.5 this is bitwise 0.5 · (floor + ridge), the 5G start.
    const outerFloor = (1 - fOuter) * floor + fOuter * ridge;
    for (let j = 0; j < ny; j++) {
      const across = Math.abs(j * dx - yAxis);
      const r = beyond > 0 ? Math.hypot(beyond, across) : across;
      const v = floor + tanWall * r;
      // Beyond the crest the outer flank falls away, so ridges are crests, not snow-collecting plateaus.
      // …but never below `outerFloor`, so the valley floor stays the lowest ground.
      const outer = Math.max(ridge - tanOuter * Math.max(0, r - crestOffset), outerFloor);
      bed[j * nx + i] = softMin(v, outer, options.ridgeRoundingM);
    }
  }
  if (options.roughnessM > 0) {
    // White noise smoothed by two 3×3 box passes: a gentle, seeded texture of about ±roughnessM.
    const rng = createRng(config.seed);
    let noise = new Float64Array(nx * ny);
    for (let k = 0; k < noise.length; k++) noise[k] = rng.nextRange(-1, 1);
    for (let pass = 0; pass < 2; pass++) {
      const out = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          let sum = 0;
          let n = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const jj = j + dj;
            if (jj < 0 || jj >= ny) continue;
            for (let di = -1; di <= 1; di++) {
              const ii = i + di;
              if (ii < 0 || ii >= nx) continue;
              sum += noise[jj * nx + ii]!;
              n++;
            }
          }
          out[j * nx + i] = sum / n;
        }
      }
      noise = out;
    }
    // Two box passes shrink the amplitude by roughly 3×; rescale to the requested amplitude.
    for (let k = 0; k < bed.length; k++) bed[k]! += noise[k]! * options.roughnessM * 3;
  }
  return bed;
}

/** Steepest cell-to-cell slope of a bed (unit: degrees). Used to check the start against rock limits. */
export function maxCellSlopeDeg(bed: ArrayLike<number>, nx: number, ny: number, dx: number): number {
  let max = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (i + 1 < nx) max = Math.max(max, Math.abs(bed[k + 1]! - bed[k]!));
      if (j + 1 < ny) max = Math.max(max, Math.abs(bed[k + nx]! - bed[k]!));
    }
  }
  return (Math.atan(max / dx) * 180) / Math.PI;
}
