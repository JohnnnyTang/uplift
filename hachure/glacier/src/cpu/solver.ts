/**
 * CPU reference glacier solver (session 5G).
 *
 * One fixed step does, in order (docs/science/glacial/model.md §2–§6):
 *   1. lateral-drag shape factor f (every `shapeFactorIntervalSteps` steps; f = 1 when disabled);
 *   2. ice flux on cell edges, q = −D ∇s, shallow-ice deformation plus Weertman sliding with τ = f ρ g H |∇s|;
 *   3. a donor-cell outflow limiter, so ice thickness never goes negative and ice is conserved;
 *   4. the snowline mass balance;
 *   5. the border frame: ice entering it leaves the model (counted), no mass balance, never eroded;
 *   6. cell velocities (stress from the edge-mean thickness, see updateVelocitiesFromGradients); erosion
 *      ė = speedup · ε_ref · erodibility · (u_b / u_ref)^l under ice;
 *   7. wall failure: slopes steeper than the rock's critical slope relax, conserving rock volume.
 *
 * Every pass reads the previous state and writes a new one (Jacobi order), so the GPU port (5I) can use the
 * same order. No randomness after the authored start.
 */
import {
  GLEN_EXPONENT,
  type GlacierConfig,
  maxStableDiffusivityM2PerYear,
  resolveGlacierConfig,
} from "../contract/config";
import { ROCK_TYPES } from "../contract/rocks";
import { hashGlacierState } from "../contract/hash";
import {
  type GlacierProbes,
  type SectionMeasure,
  type SectionOptions,
  measureSection,
  probesFromFields,
} from "../contract/probes";
import type { GlacierDiagnostics, GlacierSnapshot, GlacierSolver, IceBudget } from "../contract/state";
import { createVValleyBed } from "../presets/v-valley";
import { type ShapeFactorScratch, computeShapeFactor, createShapeFactorScratch } from "./shape-factor";

/**
 * Width of the fixed frame along the grid border (unit: cells). Ice entering it leaves the model (it would
 * flow into neighbouring valleys), no snow falls on it and its rock is never eroded, so the open boundary
 * cannot dig a runaway pit against the ice-free edge (docs/science/glacial/feasibility.md, A2b). A closed
 * border was tried and rejected (A2d): ice piled up against it and carved trenches along the edge.
 */
export const FRAME_CELLS = 3;

export interface CpuGlacierInit {
  /** Starting bed (row-major `j * nx + i`); defaults to the authored V-valley preset. */
  readonly bedM?: ArrayLike<number>;
  /** Starting ice thickness; defaults to ice-free. */
  readonly iceThicknessM?: ArrayLike<number>;
}

export interface CpuGlacierSolver extends GlacierSolver {
  /** Float64 views of the live fields, for tests and diagnostics. Do not mutate. */
  readonly fields: {
    readonly bedM: Float64Array;
    readonly initialBedM: Float64Array;
    readonly iceThicknessM: Float64Array;
    readonly shapeFactor: Float64Array;
    readonly slidingSpeedMPerYear: Float64Array;
  };
}

export function createCpuGlacier(
  overrides: Partial<GlacierConfig> = {},
  init: CpuGlacierInit = {},
): CpuGlacierSolver {
  const config = resolveGlacierConfig(overrides);
  return new CpuGlacier(config, init);
}

class CpuGlacier implements CpuGlacierSolver {
  readonly config: GlacierConfig;
  private stepCount = 0;
  private readonly nx: number;
  private readonly ny: number;
  private readonly n: number;
  private readonly dx: number;

  private readonly bed: Float64Array;
  private readonly bed0: Float64Array;
  private readonly ice: Float64Array;
  private readonly surface: Float64Array;
  private readonly f: Float64Array;
  private readonly gx: Float64Array;
  private readonly gy: Float64Array;
  private readonly qx: Float64Array; // x-edges: (nx − 1) × ny, index j * (nx − 1) + i between i and i + 1
  private readonly qy: Float64Array; // y-edges: nx × (ny − 1), index j * nx + i between j and j + 1
  private readonly ratio: Float64Array;
  private readonly ub: Float64Array;
  private readonly vx: Float64Array;
  private readonly vy: Float64Array;
  private readonly dBed: Float64Array;
  private readonly scratch: ShapeFactorScratch;
  /** 1 in the fixed frame along the grid border: ice-free and never eroded. */
  private readonly frame: Uint8Array;

  private readonly initialIceM3: number;
  private smbM3 = 0;
  private edgeOutM3 = 0;
  private cappedEdgeSteps = 0;
  private iceEdgeSteps = 0;
  private limitedCellSteps = 0;
  private maxSliding = 0;

  // Precomputed constants.
  private readonly cDef: number;
  private readonly cSlide: number;
  private readonly rhoG: number;
  private readonly dCap: number;
  private readonly erosionPerStep: number;
  private readonly wallTan: number;
  private readonly failFraction: number;

  constructor(config: GlacierConfig, init: CpuGlacierInit) {
    this.config = config;
    this.nx = config.nx;
    this.ny = config.ny;
    this.n = config.nx * config.ny;
    this.dx = config.metresPerCell;
    const n = this.n;
    const bed = init.bedM ? Float64Array.from(init.bedM) : createVValleyBed(config);
    if (bed.length !== n) throw new Error(`bed has ${bed.length} cells, expected ${n}`);
    this.bed = bed;
    this.bed0 = Float64Array.from(bed);
    this.ice = init.iceThicknessM ? Float64Array.from(init.iceThicknessM) : new Float64Array(n);
    if (this.ice.length !== n) throw new Error(`ice has ${this.ice.length} cells, expected ${n}`);
    this.surface = new Float64Array(n);
    this.f = new Float64Array(n).fill(1);
    this.gx = new Float64Array(n);
    this.gy = new Float64Array(n);
    this.qx = new Float64Array((this.nx - 1) * this.ny);
    this.qy = new Float64Array(this.nx * (this.ny - 1));
    this.ratio = new Float64Array(n);
    this.ub = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.dBed = new Float64Array(n);
    this.frame = new Uint8Array(n);
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const d = Math.min(i, j, this.nx - 1 - i, this.ny - 1 - j);
        if (d < FRAME_CELLS) this.frame[j * this.nx + i] = 1;
      }
    }
    this.scratch = createShapeFactorScratch(config.lateralDragSearchCells, this.n);

    const nGlen = GLEN_EXPONENT;
    this.rhoG = config.iceDensityKgPerM3 * config.gravityMPerS2;
    this.cDef = ((2 * config.glenRateFactorPerPa3PerYear) / (nGlen + 2)) * Math.pow(this.rhoG, nGlen);
    this.cSlide = config.slidingMPerYearAtReferenceStress;
    this.dCap = maxStableDiffusivityM2PerYear(config);
    const rock = ROCK_TYPES[config.rockId];
    this.erosionPerStep =
      config.erosionSpeedup *
      config.erosionMPerYearAtReferenceSliding *
      rock.relativeErodibility *
      config.dtYears;
    this.wallTan = Math.tan((rock.criticalWallSlopeDeg * Math.PI) / 180);
    this.failFraction = Math.min(0.2, config.wallFailureRatePerYear * config.dtYears);
    let v0 = 0;
    for (let k = 0; k < n; k++) v0 += this.ice[k]!;
    this.initialIceM3 = v0 * this.dx * this.dx;
    this.updateSurface();
    this.updateVelocities();
  }

  get step(): number {
    return this.stepCount;
  }

  get modelYears(): number {
    return this.stepCount * this.config.dtYears;
  }

  get fields() {
    return {
      bedM: this.bed,
      initialBedM: this.bed0,
      iceThicknessM: this.ice,
      shapeFactor: this.f,
      slidingSpeedMPerYear: this.ub,
    };
  }

  advance(steps: number): void {
    if (!Number.isInteger(steps) || steps < 0) throw new RangeError(`steps must be a non-negative integer`);
    for (let s = 0; s < steps; s++) this.stepOnce();
    // Fail loudly rather than hand non-finite state to a reader.
    for (let k = 0; k < this.n; k++) {
      if (!Number.isFinite(this.bed[k]!) || !Number.isFinite(this.ice[k]!)) {
        throw new Error(`glacier state became non-finite at step ${this.stepCount} (cell ${k})`);
      }
    }
  }

  advanceYears(years: number): void {
    this.advance(Math.round(years / this.config.dtYears));
  }

  private updateSurface(): void {
    const { bed, ice, surface, n } = this;
    for (let k = 0; k < n; k++) surface[k] = bed[k]! + ice[k]!;
  }

  /** Centred surface gradients (one-sided at the edges). */
  private updateGradients(): void {
    const { nx, ny, dx, surface, gx, gy } = this;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const il = i > 0 ? k - 1 : k;
        const ir = i < nx - 1 ? k + 1 : k;
        const jd = j > 0 ? k - nx : k;
        const ju = j < ny - 1 ? k + nx : k;
        gx[k] = (surface[ir]! - surface[il]!) / (dx * (ir - il));
        gy[k] = (surface[ju]! - surface[jd]!) / (dx * ((ju - jd) / nx));
      }
    }
  }

  /**
   * Fraction of the bed that is warm-based and slides (unit: none): 0 below slidingOnsetIceThicknessM,
   * 1 above fullSlidingIceThicknessM, linear between. Thin ice is frozen to its bed and neither slides nor
   * erodes, which protects ridges and confines erosion to the trough ("selective linear erosion",
   * Sugden 1978; thermal regime, Cuffey & Paterson 2010 ch. 9).
   */
  private warmBased(h: number): number {
    const c = this.config;
    if (h <= c.slidingOnsetIceThicknessM) return 0;
    if (h >= c.fullSlidingIceThicknessM) return 1;
    return (h - c.slidingOnsetIceThicknessM) / (c.fullSlidingIceThicknessM - c.slidingOnsetIceThicknessM);
  }

  /** Edge diffusivity D = H (ū_def + u_b) / |∇s| for edge thickness h, shape factor fm and slope² s2. */
  private diffusivity(h: number, fm: number, s2: number): number {
    const m = this.config.slidingStressExponent;
    const fh = fm * h;
    // ū_def / |∇s| = cDef (f H)³ H |∇s|²  ;  u_b / |∇s| = cSlide (ρ g f H / τ_ref)^m |∇s|^(m−1)
    const def = this.cDef * fh * fh * fh * h * s2;
    // Sliding: u_b = cSlide · (min(τ, τ_max) / τ_ref)^m, expressed per unit |∇s| for the diffusion form.
    const slope = Math.sqrt(s2);
    if (slope === 0) return h * def;
    const tau = Math.min(this.rhoG * fh * slope, this.config.maxSlidingStressPa);
    const r = tau / this.config.referenceBasalStressPa;
    const slide =
      (this.warmBased(h) * this.cSlide * (m === 2 ? r * r : m === 3 ? r * r * r : Math.pow(r, m))) / slope;
    return h * (def + slide);
  }

  private stepOnce(): void {
    const c = this.config;
    const { nx, ny, n, dx, bed, ice, surface, f, gx, gy, qx, qy, ratio } = this;
    const dt = c.dtYears;
    const minIce = c.minIceThicknessM;

    if (c.iceEnabled) {
      // 1. Shape factor.
      if (c.lateralDragEnabled && this.stepCount % c.shapeFactorIntervalSteps === 0) {
        computeShapeFactor(
          { nx, ny, dx, bed, surface, ice, minIce, searchCells: c.lateralDragSearchCells },
          f,
          this.scratch,
        );
      }
      // 2. Rates from the step-start state: gradients, cell velocities (used by erosion), edge fluxes.
      this.updateGradients();
      this.updateVelocitiesFromGradients();
      const dCap = this.dCap;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = j * nx + i;
          const b = a + 1;
          const h = 0.5 * (ice[a]! + ice[b]!);
          const e = j * (nx - 1) + i;
          if (h <= 0) {
            qx[e] = 0;
            continue;
          }
          const sx = (surface[b]! - surface[a]!) / dx;
          const sy = 0.5 * (gy[a]! + gy[b]!);
          let d = this.diffusivity(h, 0.5 * (f[a]! + f[b]!), sx * sx + sy * sy);
          this.iceEdgeSteps++;
          if (d > dCap) {
            d = dCap;
            this.cappedEdgeSteps++;
          }
          qx[e] = -d * sx;
        }
      }
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx; i++) {
          const a = j * nx + i;
          const b = a + nx;
          const h = 0.5 * (ice[a]! + ice[b]!);
          if (h <= 0) {
            qy[a] = 0;
            continue;
          }
          const sy = (surface[b]! - surface[a]!) / dx;
          const sx = 0.5 * (gx[a]! + gx[b]!);
          let d = this.diffusivity(h, 0.5 * (f[a]! + f[b]!), sx * sx + sy * sy);
          this.iceEdgeSteps++;
          if (d > dCap) {
            d = dCap;
            this.cappedEdgeSteps++;
          }
          qy[a] = -d * sy;
        }
      }
      // 3. Outflow limiter: scale each cell's outgoing fluxes so it never exports more than it holds.
      const k1 = dt / dx;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          let out = 0;
          if (i < nx - 1) out += Math.max(0, qx[j * (nx - 1) + i]!);
          if (i > 0) out += Math.max(0, -qx[j * (nx - 1) + i - 1]!);
          if (j < ny - 1) out += Math.max(0, qy[k]!);
          if (j > 0) out += Math.max(0, -qy[k - nx]!);
          out *= k1;
          const h = ice[k]!;
          if (out > h) {
            ratio[k] = out > 0 ? h / out : 0;
            this.limitedCellSteps++;
          } else ratio[k] = 1;
        }
      }
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const e = j * (nx - 1) + i;
          const q = qx[e]!;
          qx[e] = q * (q > 0 ? ratio[j * nx + i]! : ratio[j * nx + i + 1]!);
        }
      }
      for (let k = 0; k < nx * (ny - 1); k++) {
        const q = qy[k]!;
        qy[k] = q * (q > 0 ? ratio[k]! : ratio[k + nx]!);
      }
      // 4. Transport plus snowline mass balance.
      const ela = c.snowlineAltitudeM;
      const grad = c.massBalanceGradientPerYear;
      const accMax = c.maxAccumulationMPerYear;
      let smb = 0;
      const onStart = c.massBalanceAltitude === "starting-bed";
      const bed0 = this.bed0;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          let div = 0;
          if (i < nx - 1) div += qx[j * (nx - 1) + i]!;
          if (i > 0) div -= qx[j * (nx - 1) + i - 1]!;
          if (j < ny - 1) div += qy[k]!;
          if (j > 0) div -= qy[k - nx]!;
          const transported = Math.max(0, ice[k]! - k1 * div);
          const z = onStart ? bed0[k]! : surface[k]!;
          const balance = this.frame[k] === 1 ? 0 : Math.min(grad * (z - ela), accMax) * dt;
          const next = Math.max(0, transported + balance);
          smb += next - transported;
          ice[k] = next;
        }
      }
      this.smbM3 += smb * dx * dx;
      // 5. The frame (outer FRAME_CELLS cells) stays ice-free: ice reaching it leaves the model.
      let edge = 0;
      const frame = this.frame;
      for (let k = 0; k < n; k++) {
        if (frame[k] === 1) {
          edge += ice[k]!;
          ice[k] = 0;
        }
      }
      this.edgeOutM3 += edge * dx * dx;
    }

    // 6. Erosion from the step-start sliding speed, where the step-start ice was at least minIce thick.
    if (c.erosionEnabled && c.iceEnabled) {
      const l = c.erosionSlidingExponent;
      const uRef = c.referenceSlidingMPerYear;
      const base = this.erosionPerStep;
      const ub = this.ub;
      const frame = this.frame;
      for (let k = 0; k < n; k++) {
        const r = ub[k]! / uRef;
        if (r === 0 || frame[k] === 1) continue;
        bed[k]! -= base * (l === 2 ? r * r : Math.pow(r, l));
      }
    }
    // 7. Wall failure (volume-conserving relaxation towards the rock's critical slope).
    if (this.failFraction > 0) this.relaxWalls();
    this.updateSurface();
    this.stepCount++;
  }

  /**
   * Wall failure on the 8-neighbour stencil (diagonals use their √2 distance, so failed walls are not
   * grid-aligned). Each over-steep pair moves a fraction of its excess height from the higher to the lower
   * cell. Rock landing on ice-covered ground is carried away by the glacier instead of building up on the
   * bed (rockfall onto a glacier travels with the ice; Benn & Evans 2010, ch. 11). Rock landing on
   * ice-free ground stays there as talus, conserving volume. Jacobi order.
   */
  private relaxWalls(): void {
    const { nx, ny, dx, bed, dBed, ice } = this;
    const minIce = this.config.minIceThicknessM;
    const limitAxis = this.wallTan * dx;
    const limitDiag = limitAxis * Math.SQRT2;
    const frac = 0.25 * this.failFraction;
    dBed.fill(0);
    let any = false;
    const pair = (a: number, b: number, limit: number) => {
      const d = bed[a]! - bed[b]!;
      const ex = (d < 0 ? -d : d) - limit;
      if (ex > 0) {
        const m = frac * ex;
        const hi = d > 0 ? a : b;
        const lo = d > 0 ? b : a;
        dBed[hi]! -= m;
        if (ice[lo]! < minIce) dBed[lo]! += m;
        any = true;
      }
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (i < nx - 1) pair(k, k + 1, limitAxis);
        if (j < ny - 1) {
          pair(k, k + nx, limitAxis);
          if (i < nx - 1) pair(k, k + nx + 1, limitDiag);
          if (i > 0) pair(k, k + nx - 1, limitDiag);
        }
      }
    }
    if (any) for (let k = 0; k < this.n; k++) bed[k]! += dBed[k]!;
  }

  /** Recomputes gradients and velocities from the current state (view-only callers). */
  private updateVelocities(): void {
    this.updateGradients();
    this.updateVelocitiesFromGradients();
  }

  /** Cell sliding speed and surface velocity from the current ice and gradients; ub = 0 below minIce. */
  private updateVelocitiesFromGradients(): void {
    const c = this.config;
    const { nx, ny, ice, f, ub, vx, vy, gx, gy } = this;
    const m = c.slidingStressExponent;
    const surfDef = (2 * c.glenRateFactorPerPa3PerYear) / (GLEN_EXPONENT + 1);
    let maxUb = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const h = ice[k]!;
        if (h <= 0) {
          ub[k] = 0;
          vx[k] = 0;
          vy[k] = 0;
          continue;
        }
        const gxk = gx[k]!;
        const gyk = gy[k]!;
        const slope = Math.sqrt(gxk * gxk + gyk * gyk);
        // Cell stress as the mean of the stresses on its edges, where the flux is computed: each gradient
        // component is weighted by the mean thickness of the two edges it spans, (2H + H_left + H_right)/4.
        // A centred gradient with the cell's own H cannot see an odd/even surface mode, so an odd/even bed
        // ripple fed itself (thicker ice over a low cell slid and eroded faster): a grid-scale artefact
        // found in session 5G2 (docs/science/glacial/feasibility.md, "2Δx ripple").
        const hx = 0.25 * (2 * h + ice[i > 0 ? k - 1 : k]! + ice[i < nx - 1 ? k + 1 : k]!);
        const hy = 0.25 * (2 * h + ice[j > 0 ? k - nx : k]! + ice[j < ny - 1 ? k + nx : k]!);
        const tx = hx * gxk;
        const ty = hy * gyk;
        const hEdge = slope > 0 ? Math.sqrt(tx * tx + ty * ty) / slope : 0.5 * (hx + hy);
        const tau = this.rhoG * f[k]! * hEdge * slope;
        const r = Math.min(tau, c.maxSlidingStressPa) / c.referenceBasalStressPa;
        const slide =
          this.warmBased(hEdge) * this.cSlide * (m === 2 ? r * r : m === 3 ? r * r * r : Math.pow(r, m));
        const speed = slide + surfDef * tau * tau * tau * h;
        const covered = h >= c.minIceThicknessM;
        ub[k] = covered ? slide : 0;
        if (covered && slide > maxUb) maxUb = slide;
        if (slope > 0) {
          vx[k] = (-speed * gx[k]!) / slope;
          vy[k] = (-speed * gy[k]!) / slope;
        } else {
          vx[k] = 0;
          vy[k] = 0;
        }
      }
    }
    this.maxSliding = maxUb;
  }

  snapshot(): GlacierSnapshot {
    this.updateVelocities();
    return {
      nx: this.nx,
      ny: this.ny,
      metresPerCell: this.dx,
      rockId: this.config.rockId,
      step: this.stepCount,
      modelYears: this.modelYears,
      bedM: Float32Array.from(this.bed),
      iceThicknessM: Float32Array.from(this.ice),
      surfaceVelocityXMPerYear: Float32Array.from(this.vx),
      surfaceVelocityYMPerYear: Float32Array.from(this.vy),
    };
  }

  probes(): GlacierProbes {
    this.updateVelocities();
    return probesFromFields(
      { nx: this.nx, ny: this.ny, metresPerCell: this.dx },
      {
        bedM: this.bed,
        initialBedM: this.bed0,
        iceThicknessM: this.ice,
        surfaceVelocityXMPerYear: this.vx,
        surfaceVelocityYMPerYear: this.vy,
      },
      this.stepCount,
      this.modelYears,
      this.config.minIceThicknessM,
      this.maxSliding,
    );
  }

  section(i: number, options?: SectionOptions): SectionMeasure {
    return measureSection(
      this.bed,
      this.ice,
      { nx: this.nx, ny: this.ny, metresPerCell: this.dx },
      i,
      options,
    );
  }

  budget(): IceBudget {
    let vol = 0;
    for (let k = 0; k < this.n; k++) vol += this.ice[k]!;
    vol *= this.dx * this.dx;
    return {
      surfaceMassBalanceM3: this.smbM3,
      edgeOutflowM3: this.edgeOutM3,
      residualM3: vol - (this.initialIceM3 + this.smbM3 - this.edgeOutM3),
    };
  }

  diagnostics(): GlacierDiagnostics {
    return {
      cappedEdgeSteps: this.cappedEdgeSteps,
      iceEdgeSteps: this.iceEdgeSteps,
      limitedCellSteps: this.limitedCellSteps,
    };
  }

  hash(): string {
    return hashGlacierState(this.stepCount, [this.bed, this.ice]);
  }
}
