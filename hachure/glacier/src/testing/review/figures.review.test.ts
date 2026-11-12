/**
 * Builds the review figures from arm results written by run-arm.review.test.ts (gated).
 *
 *   GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/figures.review.test.ts
 *
 * Writes into docs/review/glacial/model/: section panels per registered section, metric charts and
 * summary.json (the registered comparison table).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { it } from "vitest";
import { ROCK_IDS } from "../../contract/rocks";
import { PROTOCOL_MATCHED_YEARS, PROTOCOL_SECTIONS, PROTOCOL_SEEDS } from "../protocol";
import { type ChartSeries, lineChartSvg } from "./charts";
import { INK, PAPER, sectionSvg } from "./figures";
import { evaluateProtocol, type ArmResult } from "../evaluate";

const RUN = process.env.GLACIER_REVIEW === "1";
const ROOT = resolve(process.env.GLACIER_DOCS ?? "docs/review/glacial/model");
const RUNS = join(ROOT, "runs");

function load(id: string): ArmResult | undefined {
  const file = join(RUNS, `${id}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ArmResult) : undefined;
}

it.runIf(RUN)("build review figures", () => {
  const available = readdirSync(RUNS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
  const arms = Object.fromEntries(available.map((id) => [id, load(id)!]));
  const dx = Object.values(arms)[0]!.grid.metresPerCell;

  // 1. Section panels: rows = rock (seed 1) plus controls/attempts, columns = start and matched times.
  const rowsToDraw = [
    ...ROCK_IDS.map((r) => `${r}-s1`),
    "attempt-5g-open-head-shale",
    "attempt-a0-plain-sia",
    "attempt-a2a-surface-balance",
    "control-no-erosion",
  ].filter((id) => arms[id]);
  for (const section of Object.keys(PROTOCOL_SECTIONS)) {
    const panels: string[] = [];
    let zMin = Number.POSITIVE_INFINITY;
    let zMax = Number.NEGATIVE_INFINITY;
    for (const id of rowsToDraw) {
      const r = arms[id]!.rows[section]!;
      for (const v of r.initial) zMax = Math.max(zMax, v);
      for (const t of Object.values(r.at))
        for (let j = 0; j < t.bed.length; j++) {
          zMin = Math.min(zMin, t.bed[j]!);
          zMax = Math.max(zMax, t.bed[j]! + t.ice[j]!);
        }
    }
    zMin = Math.floor(zMin / 100) * 100;
    zMax = Math.ceil(zMax / 100) * 100;
    const cols = [0, ...PROTOCOL_MATCHED_YEARS];
    const PW = 300;
    const PH = 190;
    rowsToDraw.forEach((id, ri) => {
      const r = arms[id]!.rows[section]!;
      cols.forEach((t, ci) => {
        const at = r.at[String(t)];
        if (!at) return;
        const svg = sectionSvg({
          title: `${arms[id]!.arm.id} · ${t} model years`,
          dx,
          initial: r.initial,
          bed: at.bed,
          ice: at.ice,
          zMin,
          zMax,
          width: PW,
          height: PH,
        });
        panels.push(
          `<g transform="translate(${ci * PW},${ri * PH})">${svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`,
        );
      });
    });
    const W = cols.length * PW;
    const H = rowsToDraw.length * PH + 40;
    const legend = `<g transform="translate(10,${H - 26})" font-size="11">
<line x1="0" x2="26" y1="6" y2="6" stroke="${INK}" stroke-width="1" stroke-dasharray="4 3"/><text x="32" y="10">starting V</text>
<line x1="110" x2="136" y1="6" y2="6" stroke="${INK}" stroke-width="1.6"/><text x="142" y="10">bed now</text>
<rect x="210" y="0" width="22" height="12" fill="#cfe1f2" stroke="#3f7cb8"/><text x="238" y="10">ice in section</text>
<rect x="330" y="0" width="22" height="12" fill="#e9e4da"/><text x="358" y="10">rock</text>
<text x="430" y="10" fill="#6b6f75">Section at column ${PROTOCOL_SECTIONS[section as keyof typeof PROTOCOL_SECTIONS]} (${((PROTOCOL_SECTIONS[section as keyof typeof PROTOCOL_SECTIONS] * dx) / 1000).toFixed(2)} km from the mouth); vertical scale = horizontal</text>
</g>`;
    writeFileSync(
      join(ROOT, `sections-${section}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, serif" font-size="10"><rect width="${W}" height="${H}" fill="${PAPER}"/>${panels.join("")}${legend}</svg>\n`,
    );
  }

  // 2. Metric charts at the under-ice section: mean of seeds with a min–max band.
  // The four registered trough measures (T1, R2–R4): floor width, floor lowering, steepest wall, b.
  type Entry = ArmResult["series"][number];
  const metrics: [(e: Entry, first: Entry) => number, string, string][] = [
    [(e) => e.sections.underIce!.floorWidthM, "Valley floor width", "m"],
    [
      (e, first) => first.sections.underIce!.floorElevationM - e.sections.underIce!.floorElevationM,
      "Floor lowered since the start",
      "m",
    ],
    [(e) => e.sections.underIce!.maxWallSlopeDeg, "Steepest lower wall", "degrees"],
    [(e) => e.sections.underIce!.shapeExponent, "Shape exponent b (V ≈ 1, U ≈ 2)", "unitless"],
  ];
  const charts: string[] = [];
  for (const [pick, title, unit] of metrics) {
    const series: ChartSeries[] = [];
    for (const rock of ROCK_IDS) {
      const runs = PROTOCOL_SEEDS.map((s) => arms[`${rock}-s${s}`]).filter(Boolean) as ArmResult[];
      if (!runs.length) continue;
      const n = Math.min(...runs.map((r) => r.series.length));
      const points: [number, number][] = [];
      const band: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const vals = runs.map((r) => pick(r.series[i]!, r.series[0]!));
        const x = runs[0]!.series[i]!.modelYears;
        points.push([x, vals.reduce((a, b) => a + b, 0) / vals.length]);
        band.push([x, Math.min(...vals), Math.max(...vals)]);
      }
      series.push({ rock, points, band: runs.length > 1 ? band : [] });
    }
    const xMax = series[0]?.points[series[0].points.length - 1]?.[0] ?? 600;
    charts.push(lineChartSvg({ title, unit, series, xMax }));
  }
  const CW = 300;
  const CH = 190;
  writeFileSync(
    join(ROOT, "metrics-under-ice.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW * 2} ${CH * 2}" width="${CW * 2}" height="${CH * 2}">${charts
      .map(
        (c, i) =>
          `<g transform="translate(${(i % 2) * CW},${Math.floor(i / 2) * CH})">${c.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`,
      )
      .join("")}</svg>\n`,
  );

  // 3. Registered evaluation.
  const summary = evaluateProtocol(arms);
  writeFileSync(join(ROOT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stderr.write(JSON.stringify(summary.verdicts, null, 2) + "\n");
});
