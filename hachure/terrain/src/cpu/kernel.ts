/**
 * The CPU reference kernel: one fixed hydraulic step, in the stage order of `docs/science/model.md`:
 *
 *   1 rain and sources → 2 virtual pipes and water balance → 3 velocity → 4 capacity, erosion and
 *   deposition → 5 conservative flux-form sediment transport → 6 thermal slumping → 7 evaporation and
 *   stranded sediment.
 *
 * Rules this file keeps (model.md, "State, units and boundaries"):
 * - Authoritative state is float64 (see `CpuBuffers`); the contract's float32 layers are a mirror.
 * - Every stage reads input buffers and writes separate output buffers; neighbours are gathered in a fixed
 *   order, never updated in place. Each face exchange is stored once and used by both sides.
 * - The step is computed into "next" buffers and committed only if every value is finite and every stock is
 *   non-negative, so a rejected step leaves the state untouched.
 * - No allocation, no randomness, no DOM: the kernel can run in a Worker.
 */
import {
  DRY_DEPTH_M,
  MM_PER_HR_TO_M_PER_S,
  REFERENCE_CAPACITY_THICKNESS_M,
  REFERENCE_SPEED_M_PER_S,
} from "./constants";

/** Outlet face directions, in flux-layer order. */
export const FACE_WEST = 0;
export const FACE_EAST = 1;
export const FACE_NORTH = 2;
export const FACE_SOUTH = 3;
export type Face = typeof FACE_WEST | typeof FACE_EAST | typeof FACE_NORTH | typeof FACE_SOUTH;

/**
 * The declared outlet face of an edge cell. Corner outlets choose south, east, north, west in that
 * priority order (model.md).
 */
export function outletFace(gridSize: number, x: number, y: number): Face {
  if (y === gridSize - 1) return FACE_SOUTH;
  if (x === gridSize - 1) return FACE_EAST;
  if (y === 0) return FACE_NORTH;
  if (x === 0) return FACE_WEST;
  throw new RangeError(`outlet (${x}, ${y}) is not on the grid edge`);
}

/** Per-step parameters, copied from the config before each step (plain numbers, no allocation). */
export interface KernelParams {
  dtSimSeconds: number;
  rainMmPerHr: number;
  gravityMPerS2: number;
  pipeAreaM2: number;
  capacityCoefficient: number;
  erosionRatePerS: number;
  depositionRatePerS: number;
  talusAngleDeg: number;
  thermalRatePerS: number;
  evaporationFractionPerStep: number;
}

/**
 * What one step did. Preallocated and overwritten by every step; volumes in cubic metres.
 * Counters are actual transfers this step; `suspendedM3` is the stock at the end of the step.
 */
export class StepLedger {
  rainedWaterM3 = 0;
  sourcedWaterM3 = 0;
  evaporatedWaterM3 = 0;
  outflowedWaterM3 = 0;
  erodedM3 = 0;
  depositedM3 = 0;
  exportedSedimentM3 = 0;
  suspendedM3 = 0;
  /** Largest wave Courant number `dt[(|u|+√(gh))/l + (|v|+√(gh))/l]` this step (unit: none). */
  maxWaveCourant = 0;
  /** Cell index of `maxWaveCourant`, or −1. */
  maxWaveCourantIndex = -1;
  /** Largest donor transport number `dt Σq / (a max(hR, dryDepth))` this step (unit: none). */
  maxTransportCourant = 0;
  /** First cell whose result was non-finite or a negative stock, or −1 when the step is valid. */
  invalidIndex = -1;
  /** Which layer failed at `invalidIndex` (empty when valid). */
  invalidLayer = "";

  reset(): void {
    this.rainedWaterM3 = 0;
    this.sourcedWaterM3 = 0;
    this.evaporatedWaterM3 = 0;
    this.outflowedWaterM3 = 0;
    this.erodedM3 = 0;
    this.depositedM3 = 0;
    this.exportedSedimentM3 = 0;
    this.suspendedM3 = 0;
    this.maxWaveCourant = 0;
    this.maxWaveCourantIndex = -1;
    this.maxTransportCourant = 0;
    this.invalidIndex = -1;
    this.invalidLayer = "";
  }
}

/**
 * Float64 working buffers. `b, s, m, h, qW…qS, u, v` are the committed state; the `n*` buffers receive
 * the next state and are swapped in on commit; the rest are per-step scratch.
 */
export class CpuBuffers {
  readonly n: number;
  readonly cells: number;
  /** Cell side (unit: m) and area (unit: m²). */
  readonly l: number;
  readonly area: number;
  readonly outletIndex: number;
  readonly outletFace: Face;
  /** Fixed receiving water surface at the outlet face: the outlet's initial ground elevation (unit: m). */
  readonly outletBaseLevelM: number;
  /** Rock hardness, read from the contract layer (unit: none). Tools write it; the step never does. */
  readonly hardness: Float32Array;
  /** Extra water input from springs and rain sources (unit: m/s of depth). */
  readonly sourceRateMPerS: Float64Array;

  // Committed state.
  b: Float64Array;
  s: Float64Array;
  m: Float64Array;
  h: Float64Array;
  qW: Float64Array;
  qE: Float64Array;
  qN: Float64Array;
  qS: Float64Array;
  u: Float64Array;
  v: Float64Array;
  // Next state.
  nb: Float64Array;
  ns: Float64Array;
  nm: Float64Array;
  nh: Float64Array;
  nqW: Float64Array;
  nqE: Float64Array;
  nqN: Float64Array;
  nqS: Float64Array;
  nu: Float64Array;
  nv: Float64Array;
  // Scratch.
  readonly z: Float64Array;
  readonly hR: Float64Array;
  readonly hW: Float64Array;
  readonly sE: Float64Array;
  readonly mE: Float64Array;
  readonly mT: Float64Array;
  readonly fW: Float64Array;
  readonly fE: Float64Array;
  readonly fN: Float64Array;
  readonly fS: Float64Array;
  /** 1 where the donor limiter scaled a cell's outgoing transfers this stage (water, sediment, slump). */
  readonly limited: Uint8Array;

  constructor(
    gridSize: number,
    metresPerCell: number,
    outletIndex: number,
    face: Face,
    outletBaseLevelM: number,
    hardness: Float32Array,
  ) {
    const cells = gridSize * gridSize;
    this.n = gridSize;
    this.cells = cells;
    this.l = metresPerCell;
    this.area = metresPerCell * metresPerCell;
    this.outletIndex = outletIndex;
    this.outletFace = face;
    this.outletBaseLevelM = outletBaseLevelM;
    this.hardness = hardness;
    this.sourceRateMPerS = new Float64Array(cells);
    const f = () => new Float64Array(cells);
    this.b = f();
    this.s = f();
    this.m = f();
    this.h = f();
    this.qW = f();
    this.qE = f();
    this.qN = f();
    this.qS = f();
    this.u = f();
    this.v = f();
    this.nb = f();
    this.ns = f();
    this.nm = f();
    this.nh = f();
    this.nqW = f();
    this.nqE = f();
    this.nqN = f();
    this.nqS = f();
    this.nu = f();
    this.nv = f();
    this.z = f();
    this.hR = f();
    this.hW = f();
    this.sE = f();
    this.mE = f();
    this.mT = f();
    this.fW = f();
    this.fE = f();
    this.fN = f();
    this.fS = f();
    this.limited = new Uint8Array(cells);
  }

  /** Makes the next state current. Swaps references only: no copy, no allocation. */
  commit(): void {
    let t = this.b;
    this.b = this.nb;
    this.nb = t;
    t = this.s;
    this.s = this.ns;
    this.ns = t;
    t = this.m;
    this.m = this.nm;
    this.nm = t;
    t = this.h;
    this.h = this.nh;
    this.nh = t;
    t = this.qW;
    this.qW = this.nqW;
    this.nqW = t;
    t = this.qE;
    this.qE = this.nqE;
    this.nqE = t;
    t = this.qN;
    this.qN = this.nqN;
    this.nqN = t;
    t = this.qS;
    this.qS = this.nqS;
    this.nqS = t;
    t = this.u;
    this.u = this.nu;
    this.nu = t;
    t = this.v;
    this.v = this.nv;
    this.nv = t;
  }
}

/**
 * Computes one step from the committed buffers into the next buffers and fills `ledger`. Does not commit:
 * the caller commits only when `ledger.invalidIndex === -1` and the guards pass.
 */
export function computeStep(buf: CpuBuffers, p: KernelParams, ledger: StepLedger): void {
  ledger.reset();
  const { n, cells, l, area } = buf;
  const dt = p.dtSimSeconds;
  const { b, s, m, h, hR, hW, z, limited, hardness } = buf;
  const src = buf.sourceRateMPerS;
  const outlet = buf.outletIndex;
  const oFace = buf.outletFace;

  // ── 1. Rain and sources ────────────────────────────────────────────────────────────────────────────
  // hR = h + dt (rain/3 600 000 + Qsource/a). Rain is effective surface input; infiltration is omitted.
  const rainDepth = dt * p.rainMmPerHr * MM_PER_HR_TO_M_PER_S;
  let sourced = 0;
  for (let i = 0; i < cells; i++) {
    const srcDepth = dt * src[i]!;
    hR[i] = h[i]! + rainDepth + srcDepth;
    sourced += srcDepth;
    z[i] = b[i]! + s[i]!;
  }
  ledger.rainedWaterM3 = rainDepth * cells * area;
  ledger.sourcedWaterM3 = sourced * area;

  // ── 2. Virtual pipes and water balance ─────────────────────────────────────────────────────────────
  // q* = max(0, qOld + dt A g (H_i − H_j)/l); k = min(1, a hR / (dt Σq*)); q = k q*.
  const { qW, qE, qN, qS, nqW, nqE, nqN, nqS } = buf;
  const pipe = (dt * p.pipeAreaM2 * p.gravityMPerS2) / l;
  const base = buf.outletBaseLevelM;
  let maxTransport = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const Hi = z[i]! + hR[i]!;
      let w = 0;
      let e = 0;
      let no = 0;
      let so = 0;
      if (x > 0) w = Math.max(0, qW[i]! + pipe * (Hi - z[i - 1]! - hR[i - 1]!));
      else if (i === outlet && oFace === FACE_WEST) w = Math.max(0, qW[i]! + pipe * (Hi - base));
      if (x < n - 1) e = Math.max(0, qE[i]! + pipe * (Hi - z[i + 1]! - hR[i + 1]!));
      else if (i === outlet && oFace === FACE_EAST) e = Math.max(0, qE[i]! + pipe * (Hi - base));
      if (y > 0) no = Math.max(0, qN[i]! + pipe * (Hi - z[i - n]! - hR[i - n]!));
      else if (i === outlet && oFace === FACE_NORTH) no = Math.max(0, qN[i]! + pipe * (Hi - base));
      if (y < n - 1) so = Math.max(0, qS[i]! + pipe * (Hi - z[i + n]! - hR[i + n]!));
      else if (i === outlet && oFace === FACE_SOUTH) so = Math.max(0, qS[i]! + pipe * (Hi - base));
      const sum = w + e + no + so;
      let k = 1;
      if (sum > 0) {
        const cap = (area * hR[i]!) / (dt * sum);
        if (cap < 1) k = cap;
      }
      limited[i] = k < 1 ? 1 : 0;
      nqW[i] = k * w;
      nqE[i] = k * e;
      nqN[i] = k * no;
      nqS[i] = k * so;
      const transport = (dt * k * sum) / (area * Math.max(hR[i]!, DRY_DEPTH_M));
      if (transport > maxTransport) maxTransport = transport;
    }
  }
  ledger.maxTransportCourant = maxTransport;

  // Gather: hW = hR + dt/a (Σ inflow − Σ outflow). A fully limited donor passes on exactly its stock.
  const dtA = dt / area;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const out = nqW[i]! + nqE[i]! + nqN[i]! + nqS[i]!;
      const own = limited[i] === 1 ? 0 : Math.max(0, hR[i]! - dtA * out);
      let inflow = 0;
      if (x > 0) inflow += nqE[i - 1]!;
      if (x < n - 1) inflow += nqW[i + 1]!;
      if (y > 0) inflow += nqS[i - n]!;
      if (y < n - 1) inflow += nqN[i + n]!;
      hW[i] = own + dtA * inflow;
    }
  }
  const outletQ =
    oFace === FACE_WEST
      ? nqW[outlet]!
      : oFace === FACE_EAST
        ? nqE[outlet]!
        : oFace === FACE_NORTH
          ? nqN[outlet]!
          : nqS[outlet]!;
  ledger.outflowedWaterM3 = dt * outletQ;

  // ── 3. Velocity ────────────────────────────────────────────────────────────────────────────────────
  // u = (Jw + Je) / (2 l hMean), hMean = (hR + hW)/2; zero for hMean ≤ dryDepth.
  const { nu, nv } = buf;
  const g = p.gravityMPerS2;
  let maxWave = 0;
  let maxWaveIndex = -1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const hMean = 0.5 * (hR[i]! + hW[i]!);
      if (hMean <= DRY_DEPTH_M) {
        nu[i] = 0;
        nv[i] = 0;
        continue;
      }
      const jw = (x > 0 ? nqE[i - 1]! : 0) - nqW[i]!;
      const je = nqE[i]! - (x < n - 1 ? nqW[i + 1]! : 0);
      const jn = (y > 0 ? nqS[i - n]! : 0) - nqN[i]!;
      const js = nqS[i]! - (y < n - 1 ? nqN[i + n]! : 0);
      const denom = 2 * l * hMean;
      const ui = (jw + je) / denom;
      const vi = (jn + js) / denom;
      nu[i] = ui;
      nv[i] = vi;
      const c = Math.sqrt(g * Math.max(hR[i]!, hW[i]!));
      const wave = (dt * (Math.abs(ui) + c + Math.abs(vi) + c)) / l;
      if (wave > maxWave) {
        maxWave = wave;
        maxWaveIndex = i;
      }
    }
  }
  ledger.maxWaveCourant = maxWave;
  ledger.maxWaveCourantIndex = maxWaveIndex;

  // ── 4. Capacity, erosion and deposition ────────────────────────────────────────────────────────────
  // C = Kc × (1 m) × sinθ × |u|/(1 m/s), from the pre-erosion ground slope. Loose sediment goes first;
  // exposed bedrock erodes at (1 − hardness) of the remaining demand.
  const { nb, sE, mE } = buf;
  const erodeFrac = Math.min(1, p.erosionRatePerS * dt);
  const depositFrac = Math.min(1, p.depositionRatePerS * dt);
  const capScale = (p.capacityCoefficient * REFERENCE_CAPACITY_THICKNESS_M) / REFERENCE_SPEED_M_PER_S;
  const inv2l = 1 / (2 * l);
  const invl = 1 / l;
  let eroded = 0;
  let deposited = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const bi = b[i]!;
      const si = s[i]!;
      const mi = m[i]!;
      let capacity = 0;
      if (hW[i]! > DRY_DEPTH_M) {
        // Centred differences inside, one-sided at walls.
        const dzdx =
          x === 0
            ? (z[i + 1]! - z[i]!) * invl
            : x === n - 1
              ? (z[i]! - z[i - 1]!) * invl
              : (z[i + 1]! - z[i - 1]!) * inv2l;
        const dzdy =
          y === 0
            ? (z[i + n]! - z[i]!) * invl
            : y === n - 1
              ? (z[i]! - z[i - n]!) * invl
              : (z[i + n]! - z[i - n]!) * inv2l;
        const p2 = dzdx * dzdx + dzdy * dzdy;
        const sinTheta = Math.sqrt(p2 / (1 + p2));
        const speed = Math.sqrt(nu[i]! * nu[i]! + nv[i]! * nv[i]!);
        capacity = capScale * sinTheta * speed;
      }
      if (capacity > mi) {
        const demand = erodeFrac * (capacity - mi);
        const eLoose = Math.min(si, demand);
        const eRock = (1 - hardness[i]!) * (demand - eLoose);
        mE[i] = mi + eLoose + eRock;
        sE[i] = si - eLoose;
        nb[i] = bi - eRock;
        eroded += eLoose + eRock;
      } else if (mi > capacity) {
        const d = depositFrac * (mi - capacity);
        mE[i] = mi - d;
        sE[i] = si + d;
        nb[i] = bi;
        deposited += d;
      } else {
        mE[i] = mi;
        sE[i] = si;
        nb[i] = bi;
      }
    }
  }

  // ── 5. Conservative flux-form sediment transport ───────────────────────────────────────────────────
  // c = mE / max(hR, hW, dryDepth); F* = q c; β = min(1, a mE / (dt ΣF*)); mT = mE + dt/a (ΣF_in − ΣF_out).
  const { fW, fE, fN, fS, mT } = buf;
  for (let i = 0; i < cells; i++) {
    const mi = mE[i]!;
    if (mi <= 0) {
      fW[i] = 0;
      fE[i] = 0;
      fN[i] = 0;
      fS[i] = 0;
      limited[i] = 0;
      continue;
    }
    const conc = mi / Math.max(hR[i]!, hW[i]!, DRY_DEPTH_M);
    const w = nqW[i]! * conc;
    const e = nqE[i]! * conc;
    const no = nqN[i]! * conc;
    const so = nqS[i]! * conc;
    const sum = w + e + no + so;
    let beta = 1;
    if (sum > 0) {
      const cap = (area * mi) / (dt * sum);
      if (cap < 1) beta = cap;
    }
    limited[i] = beta < 1 ? 1 : 0;
    fW[i] = beta * w;
    fE[i] = beta * e;
    fN[i] = beta * no;
    fS[i] = beta * so;
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const out = fW[i]! + fE[i]! + fN[i]! + fS[i]!;
      const own = limited[i] === 1 ? 0 : Math.max(0, mE[i]! - dtA * out);
      let inflow = 0;
      if (x > 0) inflow += fE[i - 1]!;
      if (x < n - 1) inflow += fW[i + 1]!;
      if (y > 0) inflow += fS[i - n]!;
      if (y < n - 1) inflow += fN[i + n]!;
      mT[i] = own + dtA * inflow;
    }
  }
  const outletF =
    oFace === FACE_WEST
      ? fW[outlet]!
      : oFace === FACE_EAST
        ? fE[outlet]!
        : oFace === FACE_NORTH
          ? fN[outlet]!
          : fS[outlet]!;
  ledger.exportedSedimentM3 = dt * outletF;

  // ── 6. Thermal slumping of loose material ──────────────────────────────────────────────────────────
  // e_ij = max(0, z_i − z_j − l tan(talus)); t* = rate dt e / 2; outgoing transfers scaled to ≤ s_i.
  // The slump transfers reuse the sediment face buffers (stage 5 is finished with them).
  const ns = buf.ns;
  if (p.thermalRatePerS > 0) {
    for (let i = 0; i < cells; i++) z[i] = nb[i]! + sE[i]!;
    const threshold = l * Math.tan((p.talusAngleDeg * Math.PI) / 180);
    const rate = 0.5 * p.thermalRatePerS * dt;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const si = sE[i]!;
        if (si <= 0) {
          fW[i] = 0;
          fE[i] = 0;
          fN[i] = 0;
          fS[i] = 0;
          limited[i] = 0;
          continue;
        }
        const zi = z[i]!;
        const w = x > 0 ? Math.max(0, zi - z[i - 1]! - threshold) * rate : 0;
        const e = x < n - 1 ? Math.max(0, zi - z[i + 1]! - threshold) * rate : 0;
        const no = y > 0 ? Math.max(0, zi - z[i - n]! - threshold) * rate : 0;
        const so = y < n - 1 ? Math.max(0, zi - z[i + n]! - threshold) * rate : 0;
        const sum = w + e + no + so;
        let scale = 1;
        if (sum > si) scale = si / sum;
        limited[i] = scale < 1 ? 1 : 0;
        fW[i] = scale * w;
        fE[i] = scale * e;
        fN[i] = scale * no;
        fS[i] = scale * so;
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const out = fW[i]! + fE[i]! + fN[i]! + fS[i]!;
        const own = limited[i] === 1 ? 0 : Math.max(0, sE[i]! - out);
        let inflow = 0;
        if (x > 0) inflow += fE[i - 1]!;
        if (x < n - 1) inflow += fW[i + 1]!;
        if (y > 0) inflow += fS[i - n]!;
        if (y < n - 1) inflow += fN[i + n]!;
        ns[i] = own + inflow;
      }
    }
  } else {
    for (let i = 0; i < cells; i++) ns[i] = sE[i]!;
  }

  // ── 7. Evaporation and stranded sediment ───────────────────────────────────────────────────────────
  // hNew = (1 − f) hW. A cell left at or below dry depth deposits all its suspended stock.
  const { nm, nh } = buf;
  const keep = 1 - p.evaporationFractionPerStep;
  let evaporated = 0;
  let suspended = 0;
  let invalid = -1;
  let invalidLayer = "";
  for (let i = 0; i < cells; i++) {
    const wi = hW[i]!;
    const hNew = keep * wi;
    evaporated += wi - hNew;
    nh[i] = hNew;
    const mi = mT[i]!;
    if (hNew <= DRY_DEPTH_M) {
      nm[i] = 0;
      if (mi > 0) {
        ns[i] = ns[i]! + mi;
        deposited += mi;
      }
    } else {
      nm[i] = mi;
      suspended += mi;
    }
    if (invalid === -1) {
      if (!(nh[i]! >= 0) || nh[i] === Infinity) {
        invalid = i;
        invalidLayer = "waterM";
      } else if (!(ns[i]! >= 0) || ns[i] === Infinity) {
        invalid = i;
        invalidLayer = "sedimentM";
      } else if (!(nm[i]! >= 0) || nm[i] === Infinity) {
        invalid = i;
        invalidLayer = "suspendedSedimentM";
      } else if (!Number.isFinite(nb[i]!)) {
        invalid = i;
        invalidLayer = "bedrockM";
      } else if (
        !Number.isFinite(nu[i]! + nv[i]!) ||
        !Number.isFinite(nqW[i]! + nqE[i]! + nqN[i]! + nqS[i]!)
      ) {
        invalid = i;
        invalidLayer = "flux/velocity";
      }
    }
  }
  ledger.evaporatedWaterM3 = evaporated * area;
  ledger.erodedM3 = eroded * area;
  ledger.depositedM3 = deposited * area;
  ledger.suspendedM3 = suspended * area;
  ledger.invalidIndex = invalid;
  ledger.invalidLayer = invalidLayer;
}
