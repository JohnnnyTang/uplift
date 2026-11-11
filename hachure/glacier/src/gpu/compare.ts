/**
 * CPU/GPU comparison measures and the tolerances declared in docs/review/glacial/gpu/tolerances.md
 * (session 5I). Pure functions; used by the browser comparison suite and unit-tested in Node.
 * The numbers here must match the declared file; they were fixed before the registered run.
 */
import { ROCK_IDS } from "../contract/rocks";
import type { ArmResult, SectionRecord } from "../testing/evaluate";
import { PROTOCOL_CRITERIA, PROTOCOL_MATCHED_YEARS, PROTOCOL_SEEDS } from "../testing/protocol";

/** |GPU − CPU| ≤ max(abs, rel · |CPU|). */
export interface Bound {
  readonly abs?: number;
  readonly rel?: number;
}

export const GPU_GLACIER_TOLERANCES = Object.freeze({
  /** G1: registered section measures (start and matched times, every section, every rock arm). */
  sections: {
    floorWidthM: { abs: 2.5 },
    floorElevationM: { abs: 2.5 },
    depthM: { abs: 2.5 },
    maxWallSlopeDeg: { abs: 1 },
    wallSlopeDeg: { abs: 1 },
    shapeExponent: { abs: 0.1 },
    erodedAreaM2: { abs: 500, rel: 0.025 },
  } satisfies Partial<Record<keyof SectionRecord, Bound>>,
  /** G3: probes. */
  probes: {
    iceVolumeM3: { rel: 0.01 },
    iceAreaM2: { rel: 0.01, abs: 2 * 40 * 40 },
    erodedVolumeM3: { rel: 0.025, abs: 1e5 },
    maxSlidingSpeedMPerYear: { rel: 0.05, abs: 1 },
    maxSurfaceSpeedMPerYear: { rel: 0.05, abs: 1 },
    snoutXM: { abs: 40 },
  } satisfies Record<string, Bound>,
  /** G4: budget. */
  budget: {
    surfaceMassBalanceM3: { rel: 0.01 },
    edgeOutflowM3: { rel: 0.025, abs: 1e6 },
  } satisfies Record<string, Bound>,
  /** G4: GPU closure |residual| ≤ closureRel · (|smb| + |edge|) + closureAbsM3. */
  closureRel: 1e-5,
  closureAbsM3: 1,
  /** G5: fields (RMS and 99th percentile of |GPU − CPU| over all cells). */
  fields: {
    bedM: { rms: 0.5, p99: 2.5 },
    iceThicknessM: { rms: 1, p99: 5 },
    surfaceSpeedMPerYear: { rms: 2, p99: 10 },
  },
  /** G7: the early interval uses G5 scaled by this factor. */
  earlyFactor: 0.1,
  earlyYears: 20,
  /** G6: largest bed difference along a registered section row (unit: metres). */
  sectionProfileM: 2.5,
  /** G2: T2 is borderline when the largest ice seen at the below-snout section is under this (unit: m). */
  t2BorderlineIceM: 1,
});

export interface Check {
  readonly gpu: number;
  readonly cpu: number;
  readonly diff: number;
  readonly bound: number;
  readonly pass: boolean;
}

export function check(gpu: number, cpu: number, bound: Bound): Check {
  const limit = Math.max(bound.abs ?? 0, (bound.rel ?? 0) * Math.abs(cpu));
  if (Number.isNaN(gpu) || Number.isNaN(cpu)) {
    return { gpu, cpu, diff: Number.NaN, bound: limit, pass: Number.isNaN(gpu) && Number.isNaN(cpu) };
  }
  const diff = Math.abs(gpu - cpu);
  return { gpu, cpu, diff, bound: limit, pass: diff <= limit };
}

/** Checks every bounded key present in both records. */
export function checkRecord(
  gpu: Readonly<Record<string, number>>,
  cpu: Readonly<Record<string, number>>,
  bounds: Readonly<Record<string, Bound>>,
): Record<string, Check> {
  const out: Record<string, Check> = {};
  // A value JSON-serialised as null (NaN) reads as NaN; NaN on one side only fails.
  for (const [key, bound] of Object.entries(bounds))
    out[key] = check(gpu[key] ?? Number.NaN, cpu[key] ?? Number.NaN, bound);
  return out;
}

export interface FieldDifference {
  readonly rms: number;
  readonly p99: number;
  readonly max: number;
  /** Cell of the largest difference (index `j * nx + i`). */
  readonly maxIndex: number;
}

export function fieldDifference(gpu: ArrayLike<number>, cpu: ArrayLike<number>): FieldDifference {
  if (gpu.length !== cpu.length) throw new RangeError("field lengths differ");
  const n = gpu.length;
  const d = new Float64Array(n);
  let sum = 0;
  let max = -1;
  let maxIndex = 0;
  for (let k = 0; k < n; k++) {
    const v = Math.abs(gpu[k]! - cpu[k]!);
    const x = Number.isNaN(v) ? Number.POSITIVE_INFINITY : v;
    d[k] = x;
    sum += x * x;
    if (x > max) {
      max = x;
      maxIndex = k;
    }
  }
  d.sort();
  const p99 = n ? d[Math.min(n - 1, Math.ceil(0.99 * n) - 1)]! : 0;
  return { rms: n ? Math.sqrt(sum / n) : 0, p99, max: Math.max(0, max), maxIndex };
}

export function speedField(vx: ArrayLike<number>, vy: ArrayLike<number>): Float64Array {
  return Float64Array.from({ length: vx.length }, (_, k) => Math.hypot(vx[k]!, vy[k]!));
}

/** Field gate: RMS and p99 within the bound (scaled for the early interval). */
export function fieldPass(diff: FieldDifference, bound: { rms: number; p99: number }, scale = 1): boolean {
  return diff.rms <= bound.rms * scale && diff.p99 <= bound.p99 * scale;
}

// ── G2: verdict margins and the borderline rule ──────────────────────────────────────────────────────

interface Condition {
  /** Satisfied when margin ≥ 0 (value − threshold, signed so that larger is better). */
  readonly margin: number;
  /** Declared tolerance band for this input; 0 when no bound was declared (never borderline). */
  readonly band: number;
}

/**
 * Could the verdict flip with every input moved within its band? For an all-of verdict: a pass can flip if
 * any condition is within its band; a fail can flip only if every failing condition is within its band.
 */
export function isBorderline(conditions: readonly Condition[]): boolean {
  const pass = conditions.every((c) => c.margin >= 0);
  if (pass) return conditions.some((c) => c.margin < c.band);
  return conditions.filter((c) => c.margin < 0).every((c) => -c.margin <= c.band);
}

function at(arm: ArmResult, years: number) {
  return arm.series.reduce((best, s) =>
    Math.abs(s.modelYears - years) < Math.abs(best.modelYears - years) ? s : best,
  );
}

function atErodedArea(
  arm: ArmResult,
  area: number,
  pick: (s: ArmResult["series"][number]) => number,
): number {
  const s = arm.series;
  for (let i = 1; i < s.length; i++) {
    const a0 = s[i - 1]!.sections.underIce!.erodedAreaM2;
    const a1 = s[i]!.sections.underIce!.erodedAreaM2;
    if (a1 >= area && a1 > a0) {
      const w = (area - a0) / (a1 - a0);
      return pick(s[i - 1]!) + w * (pick(s[i]!) - pick(s[i - 1]!));
    }
  }
  return Number.NaN;
}

/**
 * For each registered verdict id, whether its CPU result is borderline under the declared bands
 * (tolerances.md G2). Mirrors the conditions of `evaluateProtocol`.
 */
export function borderlineVerdicts(arms: Record<string, ArmResult>): Record<string, boolean> {
  const T = GPU_GLACIER_TOLERANCES.sections;
  const C = PROTOCOL_CRITERIA;
  const out: Record<string, boolean> = {};
  const horizon = Math.max(...PROTOCOL_MATCHED_YEARS);
  const rockArms = ROCK_IDS.flatMap((rock) =>
    PROTOCOL_SEEDS.map((seed) => ({ rock, seed, arm: arms[`${rock}-s${seed}`] })),
  ).filter(
    (x): x is { rock: (typeof ROCK_IDS)[number]; seed: (typeof PROTOCOL_SEEDS)[number]; arm: ArmResult } =>
      Boolean(x.arm),
  );
  for (const { rock, seed, arm } of rockArms) {
    const s0 = arm.series[0]!.sections.underIce!;
    const s1 = at(arm, horizon).sections.underIce!;
    out[`T1-${rock}-s${seed}`] = isBorderline([
      { margin: s1.floorWidthM - s0.floorWidthM - C.troughMinFloorWideningM, band: T.floorWidthM.abs },
      { margin: s1.shapeExponent - s0.shapeExponent - C.troughMinShapeIncrease, band: T.shapeExponent.abs },
      { margin: s0.floorElevationM - s1.floorElevationM - C.troughMinLoweringM, band: T.floorElevationM.abs },
      {
        margin: s1.maxWallSlopeDeg - s0.maxWallSlopeDeg - C.troughMinWallSteepeningDeg,
        band: T.maxWallSlopeDeg.abs,
      },
    ]);
    const maxIceBelow = Math.max(...arm.series.map((s) => s.sections.belowSnout!.maxIceThicknessM));
    out[`T2-${rock}-s${seed}`] = maxIceBelow > 0 && maxIceBelow < GPU_GLACIER_TOLERANCES.t2BorderlineIceM;
  }
  const value = (a: ArmResult, t: number, key: keyof SectionRecord | "floorLoweringM") =>
    key === "floorLoweringM"
      ? a.series[0]!.sections.underIce!.floorElevationM - at(a, t).sections.underIce!.floorElevationM
      : (at(a, t).sections.underIce![key] as number);
  const order = (
    id: string,
    key: keyof SectionRecord | "floorLoweringM",
    sign: 1 | -1,
    minGap: number,
    band: number,
  ) => {
    const conditions: Condition[] = [];
    for (const seed of PROTOCOL_SEEDS) {
      for (const t of PROTOCOL_MATCHED_YEARS) {
        const v = ROCK_IDS.map((r) => {
          const a = arms[`${r}-s${seed}`];
          return a ? value(a, t, key) : Number.NaN;
        });
        if (v.some(Number.isNaN)) continue;
        conditions.push({ margin: sign * (v[0]! - v[1]!) - minGap, band: 2 * band });
        conditions.push({ margin: sign * (v[1]! - v[2]!) - minGap, band: 2 * band });
      }
    }
    out[id] = isBorderline(conditions);
  };
  const erodedBand = (a: number) => Math.max(T.erodedAreaM2.abs, T.erodedAreaM2.rel * Math.abs(a));
  {
    // R1 band depends on magnitude: use the larger arm's bound for each step.
    const conditions: Condition[] = [];
    for (const seed of PROTOCOL_SEEDS) {
      for (const t of PROTOCOL_MATCHED_YEARS) {
        const v = ROCK_IDS.map((r) => {
          const a = arms[`${r}-s${seed}`];
          return a ? value(a, t, "erodedAreaM2") : Number.NaN;
        });
        if (v.some(Number.isNaN)) continue;
        conditions.push({
          margin: v[0]! - v[1]! - C.rockMinErodedAreaGapM2,
          band: erodedBand(v[0]!) + erodedBand(v[1]!),
        });
        conditions.push({
          margin: v[1]! - v[2]! - C.rockMinErodedAreaGapM2,
          band: erodedBand(v[1]!) + erodedBand(v[2]!),
        });
      }
    }
    out["R1-rate"] = isBorderline(conditions);
  }
  order("R2-wider", "floorWidthM", 1, C.rockMinWidthGapM, T.floorWidthM.abs);
  order("R3-steeper", "maxWallSlopeDeg", -1, C.rockMinWallGapDeg, T.maxWallSlopeDeg.abs);
  order("R4-deeper", "floorLoweringM", 1, C.rockMinDepthGapM, T.floorElevationM.abs);

  // Matched erosion (S1, E-*): the reference area is granite's smallest horizon eroded area.
  const ref = Math.min(
    ...PROTOCOL_SEEDS.map((s) => {
      const a = arms[`granite-s${s}`];
      return a ? at(a, horizon).sections.underIce!.erodedAreaM2 : Number.POSITIVE_INFINITY;
    }),
  );
  const m = (arm: ArmResult) => {
    const start = arm.series[0]!.sections.underIce!;
    const u = (k: keyof SectionRecord) => atErodedArea(arm, ref, (e) => e.sections.underIce![k] as number);
    return {
      modelYears: atErodedArea(arm, ref, (e) => e.modelYears),
      wall: u("maxWallSlopeDeg"),
      width: u("floorWidthM"),
      lowering: start.floorElevationM - u("floorElevationM"),
      widening: u("floorWidthM") - start.floorWidthM,
      shapeIncrease: u("shapeExponent") - start.shapeExponent,
      steepening: u("maxWallSlopeDeg") - start.maxWallSlopeDeg,
    };
  };
  const matched = Object.fromEntries(rockArms.map(({ rock, seed, arm }) => [`${rock}-s${seed}`, m(arm)]));
  {
    const g = PROTOCOL_SEEDS.map((s) => matched[`granite-s${s}`]?.wall ?? Number.NaN).filter(Number.isFinite);
    const sh = PROTOCOL_SEEDS.map((s) => matched[`shale-s${s}`]?.wall ?? Number.NaN).filter(Number.isFinite);
    if (g.length && sh.length)
      out["S1-shape"] = isBorderline([
        { margin: Math.min(...g) - Math.max(...sh) - C.shapeMinWallGapDeg, band: 2 * T.maxWallSlopeDeg.abs },
      ]);
  }
  for (const { rock, seed } of rockArms) {
    const x = matched[`${rock}-s${seed}`]!;
    out[`E-T1-${rock}-s${seed}`] = isBorderline([
      { margin: x.widening - C.troughMinFloorWideningM, band: T.floorWidthM.abs },
      { margin: x.shapeIncrease - C.troughMinShapeIncrease, band: T.shapeExponent.abs },
      { margin: x.lowering - C.troughMinLoweringM, band: T.floorElevationM.abs },
      { margin: x.steepening - C.troughMinWallSteepeningDeg, band: T.maxWallSlopeDeg.abs },
    ]);
  }
  const orderAtArea = (
    id: string,
    key: keyof ReturnType<typeof m>,
    sign: 1 | -1,
    minGap: number,
    band: number,
  ) => {
    const conditions: Condition[] = [];
    for (const seed of PROTOCOL_SEEDS) {
      const v = ROCK_IDS.map((r) => matched[`${r}-s${seed}`]?.[key] ?? Number.NaN);
      if (v.some(Number.isNaN)) continue;
      conditions.push({ margin: sign * (v[0]! - v[1]!) - minGap, band: 2 * band });
      conditions.push({ margin: sign * (v[1]! - v[2]!) - minGap, band: 2 * band });
    }
    out[id] = isBorderline(conditions);
  };
  // No bound was declared for the matched-erosion time, so E-R1 has no borderline band (strict).
  orderAtArea("E-R1-rate", "modelYears", -1, 20, 0);
  orderAtArea("E-R2-wider", "width", 1, C.rockMinWidthGapM, T.floorWidthM.abs);
  orderAtArea("E-R3-steeper", "wall", -1, C.rockMinWallGapDeg, T.maxWallSlopeDeg.abs);
  orderAtArea("E-R4-deeper", "lowering", 1, C.rockMinDepthGapM, T.floorElevationM.abs);
  // K1, K2 and N1 are exact or GPU-internal checks: never borderline.
  out["K1-no-ice"] = false;
  out["K2-no-erosion"] = false;
  out["N1-half-step"] = false;
  return out;
}
