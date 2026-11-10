/**
 * Evaluates the registered protocol (docs/science/glacial/acceptance-protocol.md) on arm results.
 * Pure: takes the parsed run JSONs, returns measures and verdicts. Used by the review builder and by the
 * fixture tests (on the captured runs).
 */
import { ROCK_IDS, type RockId } from "../contract/rocks";
import { PROTOCOL_CRITERIA, PROTOCOL_MATCHED_YEARS, PROTOCOL_SEEDS } from "./protocol";

export interface SectionRecord {
  readonly floorElevationM: number;
  readonly depthM: number;
  readonly floorWidthM: number;
  readonly halfDepthWidthM: number;
  readonly wallSlopeDeg: number;
  readonly maxWallSlopeDeg: number;
  readonly shapeExponent: number;
  readonly formRatio: number;
  readonly maxIceThicknessM: number;
  readonly erodedAreaM2: number;
  readonly sectionXM: number;
}

export interface ArmResult {
  readonly arm: { readonly id: string; readonly kind: string };
  readonly grid: { readonly nx: number; readonly ny: number; readonly metresPerCell: number };
  readonly msPerModelYear: number;
  readonly finalHash: string;
  readonly series: readonly {
    readonly modelYears: number;
    readonly probes: Record<string, number>;
    readonly budget: Record<string, number>;
    readonly sections: Record<string, SectionRecord>;
  }[];
  readonly rows: Record<string, { initial: number[]; at: Record<string, { bed: number[]; ice: number[] }> }>;
}

function at(arm: ArmResult, years: number) {
  return arm.series.reduce((best, s) =>
    Math.abs(s.modelYears - years) < Math.abs(best.modelYears - years) ? s : best,
  );
}

/** Linear interpolation of a section measure at the time the section's eroded area reaches `area`. */
function atErodedArea(arm: ArmResult, area: number, key: keyof SectionRecord): number {
  const s = arm.series;
  for (let i = 1; i < s.length; i++) {
    const a0 = s[i - 1]!.sections.underIce!.erodedAreaM2;
    const a1 = s[i]!.sections.underIce!.erodedAreaM2;
    if (a1 >= area && a1 > a0) {
      const w = (area - a0) / (a1 - a0);
      const v0 = s[i - 1]!.sections.underIce![key] as number;
      const v1 = s[i]!.sections.underIce![key] as number;
      return v0 + w * (v1 - v0);
    }
  }
  return Number.NaN;
}

export interface Verdict {
  readonly id: string;
  readonly claim: string;
  readonly pass: boolean;
  readonly detail: string;
}

export function evaluateProtocol(arms: Record<string, ArmResult>) {
  const C = PROTOCOL_CRITERIA;
  const verdicts: Verdict[] = [];
  const rockArms = ROCK_IDS.flatMap((rock) =>
    PROTOCOL_SEEDS.map((seed) => ({ rock, seed, arm: arms[`${rock}-s${seed}`] })).filter((x) => x.arm),
  ) as { rock: RockId; seed: number; arm: ArmResult }[];
  const horizon = Math.max(...PROTOCOL_MATCHED_YEARS);

  // Table: under-ice and below-snout measures at matched times.
  const table = rockArms.map(({ rock, seed, arm }) => ({
    rock,
    seed,
    msPerModelYear: arm.msPerModelYear,
    start: arm.series[0]!.sections,
    matched: Object.fromEntries(PROTOCOL_MATCHED_YEARS.map((t) => [t, at(arm, t).sections])),
  }));

  // T1: a trough forms from the V under the ice, in every rock arm.
  for (const { rock, seed, arm } of rockArms) {
    const s0 = arm.series[0]!.sections.underIce!;
    const s1 = at(arm, horizon).sections.underIce!;
    const dWidth = s1.floorWidthM - s0.floorWidthM;
    const dB = s1.shapeExponent - s0.shapeExponent;
    const dWall = s1.maxWallSlopeDeg - s0.maxWallSlopeDeg;
    const lower = s0.floorElevationM - s1.floorElevationM;
    const pass =
      dWidth >= C.troughMinFloorWideningM &&
      dB >= C.troughMinShapeIncrease &&
      lower >= C.troughMinLoweringM &&
      dWall >= C.troughMinWallSteepeningDeg;
    verdicts.push({
      id: `T1-${rock}-s${seed}`,
      claim:
        "Under the ice the V becomes a trough: wider floor, higher shape exponent, lower floor, steeper walls",
      pass,
      detail: `floor width ${s0.floorWidthM.toFixed(0)}→${s1.floorWidthM.toFixed(0)} m (+${dWidth.toFixed(0)}, need ≥ ${C.troughMinFloorWideningM}); b ${s0.shapeExponent.toFixed(2)}→${s1.shapeExponent.toFixed(2)} (need +${C.troughMinShapeIncrease}); floor lowered ${lower.toFixed(0)} m (need ≥ ${C.troughMinLoweringM}); steepest wall ${s0.maxWallSlopeDeg.toFixed(1)}→${s1.maxWallSlopeDeg.toFixed(1)}° (need +${C.troughMinWallSteepeningDeg})`,
    });
    // T2: below the snout the V is unchanged.
    const b0 = arm.series[0]!.sections.belowSnout!;
    const b1 = at(arm, horizon).sections.belowSnout!;
    const reached = arm.series.some((s) => s.sections.belowSnout!.maxIceThicknessM > 0);
    const bPass =
      !reached &&
      Math.abs(b1.floorElevationM - b0.floorElevationM) <= C.belowSnoutMaxChangeM &&
      Math.abs(b1.floorWidthM - b0.floorWidthM) <= C.belowSnoutMaxChangeM &&
      Math.abs(b1.shapeExponent - b0.shapeExponent) <= 0.02;
    verdicts.push({
      id: `T2-${rock}-s${seed}`,
      claim: "Below the snout the valley stays the starting V (the ice never reaches it)",
      pass: bPass,
      detail: `ice reached: ${reached}; floor Δ ${(b1.floorElevationM - b0.floorElevationM).toFixed(2)} m; width Δ ${(b1.floorWidthM - b0.floorWidthM).toFixed(2)} m; b Δ ${(b1.shapeExponent - b0.shapeExponent).toFixed(3)}`,
    });
  }

  // R1–R3: rock ordering at every matched time and seed.
  const value = (a: ArmResult, t: number, key: keyof SectionRecord | "floorLoweringM") =>
    key === "floorLoweringM"
      ? a.series[0]!.sections.underIce!.floorElevationM - at(a, t).sections.underIce!.floorElevationM
      : (at(a, t).sections.underIce![key] as number);
  const order = (
    key: keyof SectionRecord | "floorLoweringM",
    sign: 1 | -1,
    minGap: number,
    id: string,
    claim: string,
  ) => {
    const fails: string[] = [];
    let worst = Number.POSITIVE_INFINITY;
    for (const seed of PROTOCOL_SEEDS) {
      for (const t of PROTOCOL_MATCHED_YEARS) {
        const v = ROCK_IDS.map((r) => {
          const a = arms[`${r}-s${seed}`];
          return a ? value(a, t, key) : Number.NaN;
        });
        if (v.some(Number.isNaN)) continue;
        // sign 1: shale > sandstone > granite ; sign −1: shale < sandstone < granite
        const g1 = sign * (v[0]! - v[1]!);
        const g2 = sign * (v[1]! - v[2]!);
        worst = Math.min(worst, g1, g2);
        if (g1 < minGap || g2 < minGap)
          fails.push(`s${seed} t${t}: ${v.map((x) => x.toFixed(1)).join(" / ")}`);
      }
    }
    verdicts.push({
      id,
      claim,
      pass: fails.length === 0 && Number.isFinite(worst),
      detail: `smallest step between neighbouring rocks ${worst.toFixed(2)} (need ≥ ${minGap})${fails.length ? `; fails ${fails.join("; ")}` : ""}`,
    });
  };
  order(
    "erodedAreaM2",
    1,
    C.rockMinErodedAreaGapM2,
    "R1-rate",
    "Softer rock is eroded faster: section eroded area shale > sandstone > granite",
  );
  order(
    "floorWidthM",
    1,
    C.rockMinWidthGapM,
    "R2-wider",
    "Softer rock gives a wider valley floor: shale > sandstone > granite",
  );
  order(
    "maxWallSlopeDeg",
    -1,
    C.rockMinWallGapDeg,
    "R3-steeper",
    "Harder rock keeps steeper walls: steepest wall granite > sandstone > shale",
  );
  order(
    "floorLoweringM",
    1,
    C.rockMinDepthGapM,
    "R4-deeper",
    "Softer rock is cut deeper: floor lowering shale > sandstone > granite",
  );

  // S1: rate versus shape. Compare wall slope when each rock's section has lost the same rock area.
  const ref = Math.min(
    ...PROTOCOL_SEEDS.map((s) => {
      const a = arms[`granite-s${s}`];
      return a ? at(a, horizon).sections.underIce!.erodedAreaM2 : Number.POSITIVE_INFINITY;
    }),
  );
  const matchedArea: Record<string, Record<string, number>> = {};
  for (const { rock, seed, arm } of rockArms) {
    matchedArea[`${rock}-s${seed}`] = {
      wallSlopeDeg: atErodedArea(arm, ref, "maxWallSlopeDeg"),
      floorWidthM: atErodedArea(arm, ref, "floorWidthM"),
      shapeExponent: atErodedArea(arm, ref, "shapeExponent"),
    };
  }
  const wallAt = (rock: RockId) =>
    PROTOCOL_SEEDS.map((s) => matchedArea[`${rock}-s${s}`]?.wallSlopeDeg ?? Number.NaN).filter(
      Number.isFinite,
    );
  const gWall = wallAt("granite");
  const sWall = wallAt("shale");
  const shapeGap = Math.min(...gWall) - Math.max(...sWall);
  verdicts.push({
    id: "S1-shape",
    claim:
      "Rock changes the shape, not only the rate: at equal eroded area, the steepest granite wall is steeper than the steepest shale wall",
    pass: shapeGap >= C.shapeMinWallGapDeg,
    detail: `matched eroded area ${ref.toFixed(0)} m²; granite walls ${gWall.map((x) => x.toFixed(1)).join("/")}°, shale walls ${sWall.map((x) => x.toFixed(1)).join("/")}°; gap ${shapeGap.toFixed(1)}° (need ≥ ${C.shapeMinWallGapDeg})`,
  });

  // Controls.
  const noIce = arms["control-no-ice"];
  if (noIce) {
    const last = noIce.series[noIce.series.length - 1]!;
    verdicts.push({
      id: "K1-no-ice",
      claim: "Control: without ice nothing erodes",
      pass: last.probes.erodedVolumeM3 === 0 && last.probes.iceVolumeM3 === 0,
      detail: `eroded ${last.probes.erodedVolumeM3} m³, ice ${last.probes.iceVolumeM3} m³`,
    });
  }
  const noErosion = arms["control-no-erosion"];
  if (noErosion) {
    const last = noErosion.series[noErosion.series.length - 1]!;
    const s0 = noErosion.series[0]!.sections.underIce!;
    const s1 = last.sections.underIce!;
    verdicts.push({
      id: "K2-no-erosion",
      claim: "Control: ice that does not erode leaves the V unchanged",
      pass:
        last.probes.erodedVolumeM3 === 0 && s1.floorWidthM === s0.floorWidthM && last.probes.iceVolumeM3 > 0,
      detail: `eroded ${last.probes.erodedVolumeM3} m³; floor width ${s0.floorWidthM}→${s1.floorWidthM} m; ice ${(last.probes.iceVolumeM3 / 1e9).toFixed(3)} km³`,
    });
  }
  // Numerical check: halving the step changes the registered measures by less than the rock gaps.
  const half = arms["check-half-step"];
  const ref1 = arms["sandstone-s1"];
  if (half && ref1) {
    const a = at(ref1, horizon).sections.underIce!;
    const b = at(half, horizon).sections.underIce!;
    const d = {
      floorWidthM: Math.abs(a.floorWidthM - b.floorWidthM),
      depthM: Math.abs(a.floorElevationM - b.floorElevationM),
      wallSlopeDeg: Math.abs(a.maxWallSlopeDeg - b.maxWallSlopeDeg),
      erodedAreaM2: Math.abs(a.erodedAreaM2 - b.erodedAreaM2) / Math.max(1, a.erodedAreaM2),
    };
    verdicts.push({
      id: "N1-half-step",
      claim: "Halving the time step changes registered measures by less than the registered rock gaps",
      pass:
        d.floorWidthM < C.rockMinWidthGapM &&
        d.wallSlopeDeg < C.rockMinWallGapDeg &&
        d.depthM < C.rockMinDepthGapM &&
        d.erodedAreaM2 < 0.05,
      detail: `|Δ| floor width ${d.floorWidthM.toFixed(1)} m, floor elevation ${d.depthM.toFixed(1)} m, steepest wall ${d.wallSlopeDeg.toFixed(2)}°, eroded area ${(d.erodedAreaM2 * 100).toFixed(1)} %`,
    });
  }
  // Attempts are recorded, not judged against the claim; report their trough measures.
  const attempts = Object.values(arms)
    .filter((a) => a.arm.kind === "attempt")
    .map((a) => {
      const s0 = a.series[0]!.sections.underIce!;
      const s1 = at(a, horizon).sections.underIce!;
      return { id: a.arm.id, start: s0, horizon: s1, finalIceVolumeM3: at(a, horizon).probes.iceVolumeM3 };
    });
  return {
    horizonYears: horizon,
    criteria: C,
    verdicts,
    table,
    matchedEroded: { areaM2: ref, measures: matchedArea },
    attempts,
  };
}
