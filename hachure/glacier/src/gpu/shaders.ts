/**
 * WGSL for the GPU glacier (session 5I): the frozen 5G/5G2 model, pass for pass, as compute kernels.
 *
 * Same order as the CPU reference (`../cpu/solver.ts`, docs/science/glacial/model.md §2–§6):
 *   shapeRaw + shapeSmooth (every `shapeFactorIntervalSteps` steps) → rates (gradients, edge-mean cell stress,
 *   sliding, surface velocity: the D-W5-5G2 discretisation) → flux (edge fluxes, stability cap) → ratio
 *   (outflow limiter) → transport (limited divergence, snowline balance, frame outflow, erosion) → walls
 *   (wall failure, gathered per cell) → commit (bed += wall change, non-finite flag).
 *
 * Every kernel has one writer per output word and reads only words no other invocation of the same dispatch
 * writes, so a run is deterministic on one device. Each dispatch in a compute pass is its own
 * synchronisation scope, so a kernel sees the previous kernel's writes.
 *
 * Precision (docs/review/glacial/gpu/tolerances.md): bed and ice are two float32 lanes (hi + lo) relative to
 * the run's local datum, updated with error-free two-sum; surface and bed differences subtract lane by lane.
 * Rates are float32. Constants are computed in Float64 on the host exactly as the CPU computes them and
 * rounded once to float32 literals. <!-- expert-review -->
 */
import { GLEN_EXPONENT, type GlacierConfig, maxStableDiffusivityM2PerYear } from "../contract/config";
import { ROCK_TYPES } from "../contract/rocks";
import { FRAME_CELLS } from "../cpu/solver";

export const WORKGROUP_SIZE = 64;

/** Kernel entry points, in the order a full step dispatches them. */
export const KERNELS = [
  "shapeRaw",
  "shapeSmooth",
  "rates",
  "flux",
  "ratio",
  "transport",
  "walls",
  "commit",
] as const;
export type KernelName = (typeof KERNELS)[number];

/** Storage buffers (binding order). Each holds one vec4 per cell. */
export const BUFFERS = ["state", "rates", "flux", "aux", "ledger", "counts", "status"] as const;
export type BufferName = (typeof BUFFERS)[number];

/** Float64 constants exactly as the CPU solver derives them. */
export function glacierConstants(config: GlacierConfig, datumM: number) {
  const rock = ROCK_TYPES[config.rockId];
  const rhoG = config.iceDensityKgPerM3 * config.gravityMPerS2;
  const wallTan = Math.tan((rock.criticalWallSlopeDeg * Math.PI) / 180);
  const failFraction = Math.min(0.2, config.wallFailureRatePerYear * config.dtYears);
  const limitAxis = wallTan * config.metresPerCell;
  return {
    rhoG,
    cDef: ((2 * config.glenRateFactorPerPa3PerYear) / (GLEN_EXPONENT + 2)) * Math.pow(rhoG, GLEN_EXPONENT),
    cSlide: config.slidingMPerYearAtReferenceStress,
    dCap: maxStableDiffusivityM2PerYear(config),
    surfDef: (2 * config.glenRateFactorPerPa3PerYear) / (GLEN_EXPONENT + 1),
    erosionPerStep:
      config.erosionSpeedup *
      config.erosionMPerYearAtReferenceSliding *
      rock.relativeErodibility *
      config.dtYears,
    failFraction,
    wallFrac: 0.25 * failFraction,
    limitAxis,
    limitDiag: limitAxis * Math.SQRT2,
    k1: config.dtYears / config.metresPerCell,
    snowlineAboveDatumM: config.snowlineAltitudeM - datumM,
  };
}

/** Float32 literal of a Float64 value (WGSL rounds the abstract literal to nearest, as Math.fround does). */
function f(x: number): string {
  if (!Number.isFinite(x)) throw new RangeError(`non-finite shader constant ${x}`);
  return `${x.toExponential(16)}f`;
}

function powCode(base: string, exponent: number): string {
  if (exponent === 2) return `(${base} * ${base})`;
  if (exponent === 3) return `(${base} * ${base} * ${base})`;
  return `pow(${base}, ${f(exponent)})`;
}

/** Two-lane (hi + lo) float32 arithmetic shared by the solver and the on-device precision test. */
export const DF_WGSL = /* wgsl */ `
// Error-free two-sum (Knuth): s + err == a + b exactly.
fn twoSum(a: f32, b: f32) -> vec2<f32> {
  let s = a + b;
  let bb = s - a;
  let err = (a - (s - bb)) + (b - bb);
  return vec2<f32>(s, err);
}
// Two-lane value x.x + x.y plus a float32 increment, renormalised so |lo| <= ulp(hi) / 2.
fn dfAdd(x: vec2<f32>, d: f32) -> vec2<f32> {
  let t = twoSum(x.x, d);
  let lo = x.y + t.y;
  let hi = t.x + lo;
  return vec2<f32>(hi, lo - (hi - t.x));
}
fn isFiniteF(x: f32) -> bool {
  return (bitcast<u32>(x) & 0x7f800000u) != 0x7f800000u;
}
`;

export interface ShaderOptions {
  /** Diagnostic fault injection for the fallback tests: appends invalid WGSL. Never set in product code. */
  readonly invalid?: boolean;
  /** Diagnostic fault injection for the device-check tests: doubles erosion. Never set in product code. */
  readonly skewErosion?: boolean;
}

export function glacierWgsl(config: GlacierConfig, datumM: number, options: ShaderOptions = {}): string {
  const c = glacierConstants(config, datumM);
  const M = config.lateralDragSearchCells;
  const m = config.slidingStressExponent;
  const l = config.erosionSlidingExponent;
  const surfaceBalance = config.massBalanceAltitude === "ice-surface";
  const erosion = config.erosionEnabled && config.iceEnabled;
  const code = /* wgsl */ `
const NX: u32 = ${config.nx}u;
const NY: u32 = ${config.ny}u;
const N: u32 = ${config.nx * config.ny}u;
const FRAME: u32 = ${FRAME_CELLS}u;
const DX: f32 = ${f(config.metresPerCell)};
const DT: f32 = ${f(config.dtYears)};
const K1: f32 = ${f(c.k1)};
const RHO_G: f32 = ${f(c.rhoG)};
const C_DEF: f32 = ${f(c.cDef)};
const C_SLIDE: f32 = ${f(c.cSlide)};
const D_CAP: f32 = ${f(c.dCap)};
const SURF_DEF: f32 = ${f(c.surfDef)};
const TAU_MAX: f32 = ${f(config.maxSlidingStressPa)};
const TAU_REF: f32 = ${f(config.referenceBasalStressPa)};
const ONSET: f32 = ${f(config.slidingOnsetIceThicknessM)};
const FULL: f32 = ${f(config.fullSlidingIceThicknessM)};
const RAMP: f32 = ${f(config.fullSlidingIceThicknessM - config.slidingOnsetIceThicknessM)};
const MIN_ICE: f32 = ${f(config.minIceThicknessM)};
const ELA_REL: f32 = ${f(c.snowlineAboveDatumM)};
const MB_GRAD: f32 = ${f(config.massBalanceGradientPerYear)};
const ACC_MAX: f32 = ${f(config.maxAccumulationMPerYear)};
const U_REF: f32 = ${f(config.referenceSlidingMPerYear)};
const EROSION_PER_STEP: f32 = ${f(options.skewErosion ? 2 * c.erosionPerStep : c.erosionPerStep)};
const WALL_FRAC: f32 = ${f(c.wallFrac)};
const LIMIT_AXIS: f32 = ${f(c.limitAxis)};
const LIMIT_DIAG: f32 = ${f(c.limitDiag)};
const M: i32 = ${M};
const COUNT: i32 = ${2 * M + 1};
const BIG: f32 = 3.0e38f;

// state: bedHi, bedLo, iceHi, iceLo (metres; bed relative to the run's local datum)
@group(0) @binding(0) var<storage, read_write> state: array<vec4<f32>>;
// rates: gx, gy (surface gradient), ub (sliding speed for erosion, m/yr), ratio (outflow limiter)
@group(0) @binding(1) var<storage, read_write> rates: array<vec4<f32>>;
// flux: qx (edge i→i+1), qy (edge j→j+1) in m²/yr, f (shape factor), fRaw (unsmoothed)
@group(0) @binding(2) var<storage, read_write> flux: array<vec4<f32>>;
// aux: vx, vy (surface velocity, m/yr), dBed (wall failure change, m), balance per step on the starting bed (m)
@group(0) @binding(3) var<storage, read_write> aux: array<vec4<f32>>;
// ledger: applied mass balance hi/lo, edge outflow hi/lo (metres of ice in this cell, cumulative)
@group(0) @binding(4) var<storage, read_write> ledger: array<vec4<f32>>;
// counts: capped edge-steps, ice edge-steps (edges owned by this cell), limited cell-steps, unused
@group(0) @binding(5) var<storage, read_write> counts: array<vec4<u32>>;
// status[0]: 1 once any lane became non-finite
@group(0) @binding(6) var<storage, read_write> status: array<atomic<u32>, 4>;

var<private> zb: array<f32, ${2 * M + 1}>;
var<private> zs: array<f32, ${2 * M + 1}>;

${DF_WGSL}
fn bedOf(k: u32) -> f32 { let s = state[k]; return s.x + s.y; }
fn iceOf(k: u32) -> f32 { let s = state[k]; return s.z + s.w; }
fn surfOf(k: u32) -> f32 { let s = state[k]; return (s.x + s.z) + (s.y + s.w); }
// surface[b] - surface[a], lane by lane
fn dSurf(b: u32, a: u32) -> f32 {
  let p = state[b];
  let q = state[a];
  return ((p.x - q.x) + (p.z - q.z)) + ((p.y - q.y) + (p.w - q.w));
}
fn dBedOf(b: u32, a: u32) -> f32 {
  let p = state[b];
  let q = state[a];
  return (p.x - q.x) + (p.y - q.y);
}
fn inFrame(i: u32, j: u32) -> bool {
  return min(min(i, j), min(NX - 1u - i, NY - 1u - j)) < FRAME;
}
fn warmBased(h: f32) -> f32 {
  if (h <= ONSET) { return 0.0; }
  if (h >= FULL) { return 1.0; }
  return (h - ONSET) / RAMP;
}
fn slideAt(r: f32) -> f32 { return ${powCode("r", m)}; }

// Edge diffusivity D = H (u_def + u_b) / |grad s| (CpuGlacier.diffusivity).
fn diffusivity(h: f32, fm: f32, s2: f32) -> f32 {
  let fh = fm * h;
  let def = C_DEF * fh * fh * fh * h * s2;
  let slope = sqrt(s2);
  if (slope == 0.0) { return h * def; }
  let tau = min(RHO_G * fh * slope, TAU_MAX);
  let r = tau / TAU_REF;
  let slide = (warmBased(h) * C_SLIDE * slideAt(r)) / slope;
  return h * (def + slide);
}

// ── Shape factor (cpu/shape-factor.ts) ───────────────────────────────────────────────────────────────
fn tbOf(m: i32) -> f32 { return f32(m - M) * DX; }
fn bilinear(x: f32, y: f32, surface: bool) -> f32 {
  let xc = min(max(x, 0.0), f32(NX - 1u));
  let yc = min(max(y, 0.0), f32(NY - 1u));
  let i0 = min(i32(floor(xc)), i32(NX) - 2);
  let j0 = min(i32(floor(yc)), i32(NY) - 2);
  let fx = xc - f32(i0);
  let fy = yc - f32(j0);
  let k = u32(j0) * NX + u32(i0);
  var v00: f32; var v10: f32; var v01: f32; var v11: f32;
  if (surface) {
    v00 = surfOf(k); v10 = surfOf(k + 1u); v01 = surfOf(k + NX); v11 = surfOf(k + NX + 1u);
  } else {
    v00 = bedOf(k); v10 = bedOf(k + 1u); v01 = bedOf(k + NX); v11 = bedOf(k + NX + 1u);
  }
  let a = v00 + (v10 - v00) * fx;
  let b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}
fn stripLength(to: f32, zo: f32, sigma: f32) -> f32 {
  let norm = 1.0 / sqrt(1.0 + sigma * sigma);
  let nt = -sigma * norm;
  let nz = norm;
  var dVor = BIG;
  for (var m = 0; m < COUNT; m = m + 1) {
    let rt = tbOf(m) - to;
    let rz = zb[m] - zo;
    let proj = nt * rt + nz * rz;
    if (proj <= 1e-9) { continue; }
    let d = (rt * rt + rz * rz) / (2.0 * proj);
    if (d < dVor) { dVor = d; }
  }
  var dS = BIG;
  if (abs(nt) < 1e-9) {
    let u = (to - tbOf(0)) / DX;
    let m0 = min(max(i32(floor(u)), 0), COUNT - 2);
    let fr = u - f32(m0);
    let s = zs[m0] + (zs[m0 + 1] - zs[m0]) * fr;
    dS = max(0.0, s - zo);
  } else {
    var dir = -1;
    if (nt > 0.0) { dir = 1; }
    var m = M - 1;
    if (to >= 0.0) { m = M; }
    var tauPrev = 0.0;
    var gPrev = zo - (zs[m] + ((zs[m + 1] - zs[m]) * (to - tbOf(m))) / DX);
    var done = false;
    if (gPrev >= 0.0) { dS = 0.0; done = true; }
    loop {
      if (done) { break; }
      var tEnd = tbOf(m);
      var zEnd = zs[m];
      if (dir > 0) { tEnd = tbOf(m + 1); zEnd = zs[m + 1]; }
      let tau = (tEnd - to) / nt;
      let zRay = zo + tau * nz;
      let g = zRay - zEnd;
      if (g >= 0.0) {
        dS = tauPrev + ((tau - tauPrev) * -gPrev) / (g - gPrev);
        break;
      }
      tauPrev = tau;
      gPrev = g;
      m = m + dir;
      if (m < 0 || m >= COUNT - 1) {
        dS = tau;
        break;
      }
    }
  }
  return max(0.0, min(dVor, dS));
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn shapeRaw(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  let h = iceOf(k);
  if (h < MIN_ICE || i == 0u || j == 0u || i == NX - 1u || j == NY - 1u) {
    flux[k].w = 1.0;
    return;
  }
  var gx = dSurf(k + 1u, k - 1u) * 0.5;
  var gy = dSurf(k + NX, k - NX) * 0.5;
  var g = sqrt(gx * gx + gy * gy);
  if (g < 1e-6 * DX) {
    gx = dBedOf(k + 1u, k - 1u) * 0.5;
    gy = dBedOf(k + NX, k - NX) * 0.5;
    g = sqrt(gx * gx + gy * gy);
    if (g < 1e-6 * DX) {
      flux[k].w = 1.0;
      return;
    }
  }
  let tx = -gy / g;
  let ty = gx / g;
  for (var m = 0; m < COUNT; m = m + 1) {
    let off = f32(m - M);
    let x = f32(i) + off * tx;
    let y = f32(j) + off * ty;
    zb[m] = bilinear(x, y, false);
    zs[m] = max(bilinear(x, y, true), zb[m]);
  }
  let z0 = bedOf(k);
  zb[M] = z0;
  let zl = zb[M - 1];
  let zr = zb[M + 1];
  let sigmaL = (z0 - zl) / DX;
  let sigmaR = (zr - z0) / DX;
  let dL = stripLength(-DX / 4.0, z0 + (zl - z0) / 4.0, sigmaL);
  let dR = stripLength(DX / 4.0, z0 + (zr - z0) / 4.0, sigmaR);
  let fv = (0.5 * (dL + dR)) / h;
  var out = fv;
  if (fv > 1.0) { out = 1.0; } else if (fv < 0.0) { out = 0.0; }
  flux[k].w = out;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn shapeSmooth(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = i32(k % NX);
  let j = i32(k / NX);
  if (iceOf(k) < MIN_ICE) {
    flux[k].z = 1.0;
    return;
  }
  var sum = 0.0;
  var count = 0;
  for (var dj = -1; dj <= 1; dj = dj + 1) {
    let jj = j + dj;
    if (jj < 0 || jj >= i32(NY)) { continue; }
    for (var di = -1; di <= 1; di = di + 1) {
      let ii = i + di;
      if (ii < 0 || ii >= i32(NX)) { continue; }
      let kk = u32(jj) * NX + u32(ii);
      if (iceOf(kk) < MIN_ICE) { continue; }
      sum = sum + flux[kk].w;
      count = count + 1;
    }
  }
  flux[k].z = sum / f32(count);
}

// ── Rates: centred gradients, edge-mean cell stress (D-W5-5G2), sliding and surface velocity ─────────
@compute @workgroup_size(${WORKGROUP_SIZE})
fn rates_(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  let il = select(k, k - 1u, i > 0u);
  let ir = select(k, k + 1u, i < NX - 1u);
  let jd = select(k, k - NX, j > 0u);
  let ju = select(k, k + NX, j < NY - 1u);
  let gxk = dSurf(ir, il) / (DX * f32(ir - il));
  let gyk = dSurf(ju, jd) / (DX * f32((ju - jd) / NX));
  rates[k].x = gxk;
  rates[k].y = gyk;
  let h = iceOf(k);
  if (h <= 0.0) {
    rates[k].z = 0.0;
    aux[k].x = 0.0;
    aux[k].y = 0.0;
    return;
  }
  let slope = sqrt(gxk * gxk + gyk * gyk);
  let hx = 0.25 * (2.0 * h + iceOf(il) + iceOf(ir));
  let hy = 0.25 * (2.0 * h + iceOf(jd) + iceOf(ju));
  let tx = hx * gxk;
  let ty = hy * gyk;
  var hEdge = 0.5 * (hx + hy);
  if (slope > 0.0) { hEdge = sqrt(tx * tx + ty * ty) / slope; }
  let tau = RHO_G * flux[k].z * hEdge * slope;
  let r = min(tau, TAU_MAX) / TAU_REF;
  let slide = warmBased(hEdge) * C_SLIDE * slideAt(r);
  let speed = slide + SURF_DEF * tau * tau * tau * h;
  rates[k].z = select(0.0, slide, h >= MIN_ICE);
  if (slope > 0.0) {
    aux[k].x = (-speed * gxk) / slope;
    aux[k].y = (-speed * gyk) / slope;
  } else {
    aux[k].x = 0.0;
    aux[k].y = 0.0;
  }
}

// ── Edge fluxes q = -D grad s with the explicit-stability cap; this cell owns its +x and +y edges ─────
@compute @workgroup_size(${WORKGROUP_SIZE})
fn flux_(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  var qx = 0.0;
  var qy = 0.0;
  var capped = 0u;
  var edges = 0u;
  let ha = iceOf(k);
  let fa = flux[k].z;
  if (i < NX - 1u) {
    let b = k + 1u;
    let h = 0.5 * (ha + iceOf(b));
    if (h > 0.0) {
      let sx = dSurf(b, k) / DX;
      let sy = 0.5 * (rates[k].y + rates[b].y);
      var d = diffusivity(h, 0.5 * (fa + flux[b].z), sx * sx + sy * sy);
      edges = edges + 1u;
      if (d > D_CAP) { d = D_CAP; capped = capped + 1u; }
      qx = -d * sx;
    }
  }
  if (j < NY - 1u) {
    let b = k + NX;
    let h = 0.5 * (ha + iceOf(b));
    if (h > 0.0) {
      let sy = dSurf(b, k) / DX;
      let sx = 0.5 * (rates[k].x + rates[b].x);
      var d = diffusivity(h, 0.5 * (fa + flux[b].z), sx * sx + sy * sy);
      edges = edges + 1u;
      if (d > D_CAP) { d = D_CAP; capped = capped + 1u; }
      qy = -d * sy;
    }
  }
  flux[k].x = qx;
  flux[k].y = qy;
  counts[k].x = counts[k].x + capped;
  counts[k].y = counts[k].y + edges;
}

// ── Outflow limiter: a cell never exports more ice than it holds ────────────────────────────────────
@compute @workgroup_size(${WORKGROUP_SIZE})
fn ratio(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  var out = 0.0;
  if (i < NX - 1u) { out = out + max(0.0, flux[k].x); }
  if (i > 0u) { out = out + max(0.0, -flux[k - 1u].x); }
  if (j < NY - 1u) { out = out + max(0.0, flux[k].y); }
  if (j > 0u) { out = out + max(0.0, -flux[k - NX].y); }
  out = out * K1;
  let h = iceOf(k);
  var r = 1.0;
  if (out > h) {
    r = select(0.0, h / out, out > 0.0);
    counts[k].z = counts[k].z + 1u;
  }
  rates[k].w = r;
}

fn limited(q: f32, ra: f32, rb: f32) -> f32 { return q * select(rb, ra, q > 0.0); }

// ── Transport, snowline balance, frame outflow and erosion (own cell only) ──────────────────────────
@compute @workgroup_size(${WORKGROUP_SIZE})
fn transport(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  var div = 0.0;
  let rk = rates[k].w;
  if (i < NX - 1u) { div = div + limited(flux[k].x, rk, rates[k + 1u].w); }
  if (i > 0u) { div = div - limited(flux[k - 1u].x, rates[k - 1u].w, rk); }
  if (j < NY - 1u) { div = div + limited(flux[k].y, rk, rates[k + NX].w); }
  if (j > 0u) { div = div - limited(flux[k - NX].y, rates[k - NX].w, rk); }
  let s = state[k];
  var t = dfAdd(vec2<f32>(s.z, s.w), -(K1 * div));
  if (t.x + t.y < 0.0) { t = vec2<f32>(0.0, 0.0); }
  let frame = inFrame(i, j);
  var balance = 0.0;
  if (!frame) {
    ${
      surfaceBalance
        ? "balance = min(MB_GRAD * (((s.x + s.z) + (s.y + s.w)) - ELA_REL), ACC_MAX) * DT;"
        : "balance = aux[k].w;"
    }
  }
  var next = dfAdd(t, balance);
  if (next.x + next.y < 0.0) { next = vec2<f32>(0.0, 0.0); }
  var led = ledger[k];
  let smb = dfAdd(led.xy, (next.x - t.x) + (next.y - t.y));
  led.x = smb.x;
  led.y = smb.y;
  if (frame) {
    let edge = dfAdd(led.zw, next.x + next.y);
    led.z = edge.x;
    led.w = edge.y;
    next = vec2<f32>(0.0, 0.0);
  }
  ledger[k] = led;
  var bed = vec2<f32>(s.x, s.y);
  ${
    erosion
      ? `let r = rates[k].z / U_REF;
  if (r != 0.0 && !frame) { bed = dfAdd(bed, -(EROSION_PER_STEP * ${powCode("r", l)})); }`
      : ""
  }
  state[k] = vec4<f32>(bed.x, bed.y, next.x, next.y);
}

// ── Wall failure, gathered: this cell's net change from its eight neighbour pairs ───────────────────
fn wallPair(c: vec4<f32>, nb: u32, limit: f32, coldHere: bool) -> f32 {
  let p = state[nb];
  let diff = (c.x - p.x) + (c.y - p.y);
  let ex = abs(diff) - limit;
  if (ex > 0.0) {
    let m = WALL_FRAC * ex;
    if (diff > 0.0) { return -m; }
    if (coldHere) { return m; }
  }
  return 0.0;
}
@compute @workgroup_size(${WORKGROUP_SIZE})
fn walls(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let i = k % NX;
  let j = k / NX;
  let c = state[k];
  let cold = (c.z + c.w) < MIN_ICE;
  var d = 0.0;
  let e = i < NX - 1u;
  let w = i > 0u;
  let up = j < NY - 1u;
  let dn = j > 0u;
  if (e) { d = d + wallPair(c, k + 1u, LIMIT_AXIS, cold); }
  if (w) { d = d + wallPair(c, k - 1u, LIMIT_AXIS, cold); }
  if (up) { d = d + wallPair(c, k + NX, LIMIT_AXIS, cold); }
  if (dn) { d = d + wallPair(c, k - NX, LIMIT_AXIS, cold); }
  if (up && e) { d = d + wallPair(c, k + NX + 1u, LIMIT_DIAG, cold); }
  if (dn && w) { d = d + wallPair(c, k - NX - 1u, LIMIT_DIAG, cold); }
  if (up && w) { d = d + wallPair(c, k + NX - 1u, LIMIT_DIAG, cold); }
  if (dn && e) { d = d + wallPair(c, k - NX + 1u, LIMIT_DIAG, cold); }
  aux[k].z = d;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn commit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= N) { return; }
  let s = state[k];
  let bed = dfAdd(vec2<f32>(s.x, s.y), aux[k].z);
  state[k].x = bed.x;
  state[k].y = bed.y;
  if (!(isFiniteF(bed.x) && isFiniteF(bed.y) && isFiniteF(s.z) && isFiniteF(s.w))) {
    atomicMax(&status[0], 1u);
  }
}
${options.invalid ? "fn broken( { this is not WGSL }" : ""}
`;
  return code;
}

/** WGSL entry-point name of each kernel (`rates` and `flux` collide with buffer names in WGSL). */
export const ENTRY_POINTS: Readonly<Record<KernelName, string>> = {
  shapeRaw: "shapeRaw",
  shapeSmooth: "shapeSmooth",
  rates: "rates_",
  flux: "flux_",
  ratio: "ratio",
  transport: "transport",
  walls: "walls",
  commit: "commit",
};
