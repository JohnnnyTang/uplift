/**
 * Line charts of section measures over model time (Node only, static SVG for the review docs).
 * Rock identity: validated categorical slots (dataviz reference palette: orange, aqua, violet; all-pairs
 * CVD ΔE ≥ 9.2) plus a dash pattern and a direct label, so identity never rests on colour alone.
 */
import { INK, INK_MUTED, PAPER } from "./figures";

export const ROCK_STYLE: Record<string, { colour: string; dash: string; label: string }> = {
  shale: { colour: "#eb6834", dash: "", label: "shale" },
  sandstone: { colour: "#1baf7a", dash: "6 3", label: "sandstone" },
  granite: { colour: "#6250d6", dash: "2 2.5", label: "granite" },
};

export interface ChartSeries {
  readonly rock: string;
  /** Mean across seeds. */
  readonly points: readonly (readonly [number, number])[];
  /** Min and max across seeds at each time (same x as points). */
  readonly band?: readonly (readonly [number, number, number])[];
}

export function lineChartSvg(options: {
  readonly title: string;
  readonly unit: string;
  readonly series: readonly ChartSeries[];
  readonly xMax: number;
  readonly width?: number;
  readonly height?: number;
}): string {
  const W = options.width ?? 300;
  const H = options.height ?? 190;
  const pad = { l: 40, r: 70, t: 26, b: 28 };
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const s of options.series) {
    for (const [, y] of s.points) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    for (const [, lo, hi] of s.band ?? []) {
      yMin = Math.min(yMin, lo);
      yMax = Math.max(yMax, hi);
    }
  }
  const niceStep = (span: number) => {
    const raw = span / 4;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!;
  };
  const step = niceStep(Math.max(1e-6, yMax - yMin));
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;
  const X = (x: number) => pad.l + (x / options.xMax) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + ((yMax - y) / (yMax - yMin)) * (H - pad.t - pad.b);
  const grid: string[] = [];
  for (let y = yMin; y <= yMax + 1e-9; y += step) {
    grid.push(
      `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="#e4e1da" stroke-width="1"/><text x="${pad.l - 5}" y="${Y(y) + 3.5}" text-anchor="end" fill="${INK_MUTED}">${Number(y.toFixed(2))}</text>`,
    );
  }
  for (let x = 0; x <= options.xMax; x += options.xMax / 3) {
    grid.push(
      `<text x="${X(x)}" y="${H - 12}" text-anchor="middle" fill="${INK_MUTED}">${Math.round(x)}</text>`,
    );
  }
  const marks: string[] = [];
  // Direct labels at the line ends, nudged apart when they would collide.
  const labels = options.series
    .map((s) => ({ s, y: Y(s.points[s.points.length - 1]![1]) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i]!.y = Math.max(labels[i]!.y, labels[i - 1]!.y + 11);
  for (const s of options.series) {
    const st = ROCK_STYLE[s.rock] ?? { colour: INK, dash: "", label: s.rock };
    if (s.band && s.band.length) {
      const top = s.band.map(([x, , hi]) => `${X(x).toFixed(1)},${Y(hi).toFixed(1)}`);
      const bot = s.band.map(([x, lo]) => `${X(x).toFixed(1)},${Y(lo).toFixed(1)}`).reverse();
      marks.push(
        `<polygon points="${top.join(" ")} ${bot.join(" ")}" fill="${st.colour}" fill-opacity="0.14" stroke="none"/>`,
      );
    }
    const pts = s.points.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
    marks.push(
      `<polyline points="${pts}" fill="none" stroke="${st.colour}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="${st.dash}"><title>${st.label}</title></polyline>`,
    );
  }
  for (const { s, y } of labels) {
    const st = ROCK_STYLE[s.rock] ?? { colour: INK, dash: "", label: s.rock };
    const last = s.points[s.points.length - 1]!;
    marks.push(
      `<line x1="${X(last[0]) + 3}" x2="${X(last[0]) + 12}" y1="${y}" y2="${y}" stroke="${st.colour}" stroke-width="2" stroke-dasharray="${st.dash}"/><text x="${X(last[0]) + 15}" y="${y + 3.5}" fill="${INK}">${st.label}</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="${INK}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<text x="${pad.l}" y="15" font-size="11.5">${options.title} <tspan fill="${INK_MUTED}">(${options.unit})</tspan></text>
${grid.join("")}
<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(yMin)}" y2="${Y(yMin)}" stroke="${INK_MUTED}"/>
${marks.join("")}
<text x="${W - pad.r}" y="${H - 1}" text-anchor="end" fill="${INK_MUTED}">model years</text>
</svg>`;
}
