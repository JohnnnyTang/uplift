/**
 * Lateral-drag shape factor (attempt A2 in docs/science/glacial/feasibility.md).
 *
 * The plain shallow-ice approximation sets the basal shear stress of a column to ρ·g·H·|∇s|, so stress,
 * sliding and erosion all peak at the deepest point of a valley and a V only deepens (Seddik et al. 2009).
 * In a real cross-section the walls carry part of the driving stress through lateral shear, and the bed in
 * a concave corner is shielded: Nye (1965) and Harbor et al. (1988) find low stress in the bottom of a V and
 * maxima on the lower walls.
 *
 * We estimate that redistribution with the geometric "area method" for boundary shear stress in a channel
 * cross-section (Khodashenas & Paquier 1999): each bed point carries the driving force of the ice nearest
 * to it, so its stress is ρ·g·|∇s|·d, where d is the length of its normal strip — from the bed along the
 * bed normal to whichever comes first: the ice surface, or the perpendicular bisector to another bed point
 * (the edge of the region of ice nearest to it). The cross-section is taken across the local flow direction.
 * The shape factor is f = d / H, clamped to [0, 1]: lateral drag only ever reduces the SIA stress, and on
 * a wide flat bed under a flat surface f = 1 and plain SIA is recovered.
 *
 * A cell's bed is two half-segments (towards each across-flow neighbour); f is the mean of their strips, so
 * the bottom cell of a V, whose half-segments face each other, is shielded. <!-- expert-review -->
 */

export interface ShapeFactorInput {
  readonly nx: number;
  readonly ny: number;
  readonly dx: number;
  readonly bed: Float64Array;
  readonly surface: Float64Array;
  readonly ice: Float64Array;
  readonly minIce: number;
  readonly searchCells: number;
}

function bilinear(field: Float64Array, nx: number, ny: number, x: number, y: number): number {
  const xc = Math.min(Math.max(x, 0), nx - 1);
  const yc = Math.min(Math.max(y, 0), ny - 1);
  const i0 = Math.min(Math.floor(xc), nx - 2);
  const j0 = Math.min(Math.floor(yc), ny - 2);
  const fx = xc - i0;
  const fy = yc - j0;
  const k = j0 * nx + i0;
  const a = field[k]! + (field[k + 1]! - field[k]!) * fx;
  const b = field[k + nx]! + (field[k + nx + 1]! - field[k + nx]!) * fx;
  return a + (b - a) * fy;
}

/**
 * Strip length from origin (to, zo) on a half-segment of bed slope `sigma`, along its upward normal, within
 * the across-flow profile (tb: positions, zb: bed, zs: surface; m = 0 at index `centre`).
 */
function stripLength(
  to: number,
  zo: number,
  sigma: number,
  tb: Float64Array,
  zb: Float64Array,
  zs: Float64Array,
  count: number,
  dx: number,
  centre: number,
): number {
  const norm = 1 / Math.sqrt(1 + sigma * sigma);
  const nt = -sigma * norm;
  const nz = norm;
  // 1. Distance to the perpendicular bisector with each profile vertex: |o − r|² / (2 n·(r − o)).
  let dVor = Number.POSITIVE_INFINITY;
  for (let m = 0; m < count; m++) {
    const rt = tb[m]! - to;
    const rz = zb[m]! - zo;
    const proj = nt * rt + nz * rz;
    if (proj <= 1e-9) continue;
    const d = (rt * rt + rz * rz) / (2 * proj);
    if (d < dVor) dVor = d;
  }
  // 2. Distance to the ice surface along the ray, walking the profile segments in the ray's direction.
  let dSurf: number;
  if (Math.abs(nt) < 1e-9) {
    // Vertical normal: the surface directly above the origin.
    const u = (to - tb[0]!) / dx;
    const m0 = Math.min(Math.max(Math.floor(u), 0), count - 2);
    const f = u - m0;
    const s = zs[m0]! + (zs[m0 + 1]! - zs[m0]!) * f;
    dSurf = Math.max(0, s - zo);
  } else {
    dSurf = Number.POSITIVE_INFINITY;
    const dir = nt > 0 ? 1 : -1;
    // Start at the segment containing `to`.
    let m = to >= 0 ? centre : centre - 1;
    let tauPrev = 0;
    let gPrev = zo - (zs[m]! + ((zs[m + 1]! - zs[m]!) * (to - tb[m]!)) / dx);
    if (gPrev >= 0) dSurf = 0;
    while (dSurf === Number.POSITIVE_INFINITY) {
      // Ray parameter at the far end of the current segment in the ray direction.
      const tEnd = dir > 0 ? tb[m + 1]! : tb[m]!;
      const tau = (tEnd - to) / nt;
      const zRay = zo + tau * nz;
      const g = zRay - (dir > 0 ? zs[m + 1]! : zs[m]!);
      if (g >= 0) {
        dSurf = tauPrev + ((tau - tauPrev) * -gPrev) / (g - gPrev);
        break;
      }
      tauPrev = tau;
      gPrev = g;
      m += dir;
      if (m < 0 || m >= count - 1) {
        dSurf = tau; // Left the profile window without reaching the surface: cap at the window.
        break;
      }
    }
  }
  return Math.max(0, Math.min(dVor, dSurf));
}

/**
 * Fills `out` with the shape factor f ∈ [0, 1] for every cell (1 where ice-free or flow direction is
 * undefined). Allocation-free after `scratch` is created with `createShapeFactorScratch`.
 */
export function computeShapeFactor(
  input: ShapeFactorInput,
  out: Float64Array,
  scratch: ShapeFactorScratch,
): void {
  const { nx, ny, dx, bed, surface, ice, minIce, searchCells: M } = input;
  const count = 2 * M + 1;
  const { tb, zb, zs, raw } = scratch;
  for (let m = 0; m < count; m++) tb[m] = (m - M) * dx;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const h = ice[k]!;
      if (h < minIce || i === 0 || j === 0 || i === nx - 1 || j === ny - 1) {
        raw[k] = 1;
        continue;
      }
      // Across-flow direction: perpendicular to the surface gradient (fall back to the bed gradient).
      let gx = (surface[k + 1]! - surface[k - 1]!) * 0.5;
      let gy = (surface[k + nx]! - surface[k - nx]!) * 0.5;
      let g = Math.sqrt(gx * gx + gy * gy);
      if (g < 1e-6 * dx) {
        gx = (bed[k + 1]! - bed[k - 1]!) * 0.5;
        gy = (bed[k + nx]! - bed[k - nx]!) * 0.5;
        g = Math.sqrt(gx * gx + gy * gy);
        if (g < 1e-6 * dx) {
          raw[k] = 1;
          continue;
        }
      }
      const tx = -gy / g;
      const ty = gx / g;
      for (let m = 0; m < count; m++) {
        const off = m - M;
        const x = i + off * tx;
        const y = j + off * ty;
        zb[m] = bilinear(bed, nx, ny, x, y);
        // Outside the grid the surface is taken at the bed, so rays stop at the window edge.
        zs[m] = Math.max(bilinear(surface, nx, ny, x, y), zb[m]!);
      }
      const z0 = bed[k]!;
      zb[M] = z0;
      const zl = zb[M - 1]!;
      const zr = zb[M + 1]!;
      const sigmaL = (z0 - zl) / dx;
      const sigmaR = (zr - z0) / dx;
      const dL = stripLength(-dx / 4, z0 + (zl - z0) / 4, sigmaL, tb, zb, zs, count, dx, M);
      const dR = stripLength(dx / 4, z0 + (zr - z0) / 4, sigmaR, tb, zb, zs, count, dx, M);
      const f = (0.5 * (dL + dR)) / h;
      raw[k] = f > 1 ? 1 : f < 0 ? 0 : f;
    }
  }
  // Stress is shared between neighbouring columns over about one to four ice thicknesses (Kamb &
  // Echelmeyer 1986), so f is averaged once over the 3 × 3 ice-covered neighbourhood. This also removes
  // grid-scale noise. (Two passes over-smoothed the axis shielding and weakened the trough; feasibility.md.)
  smoothIce(raw, out, ice, nx, ny, minIce);
}

export interface ShapeFactorScratch {
  readonly tb: Float64Array;
  readonly zb: Float64Array;
  readonly zs: Float64Array;
  /** Unsmoothed shape factor, one value per cell. */
  readonly raw: Float64Array;
}

export function createShapeFactorScratch(searchCells: number, cells: number): ShapeFactorScratch {
  const count = 2 * searchCells + 1;
  return {
    tb: new Float64Array(count),
    zb: new Float64Array(count),
    zs: new Float64Array(count),
    raw: new Float64Array(cells),
  };
}

/** One 3 × 3 average of `src` over ice-covered cells into `dst` (1 where ice-free). */
function smoothIce(
  src: Float64Array,
  dst: Float64Array,
  ice: Float64Array,
  nx: number,
  ny: number,
  minIce: number,
): void {
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (ice[k]! < minIce) {
        dst[k] = 1;
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= nx) continue;
          const kk = jj * nx + ii;
          if (ice[kk]! < minIce) continue;
          sum += src[kk]!;
          count++;
        }
      }
      dst[k] = sum / count;
    }
  }
}
