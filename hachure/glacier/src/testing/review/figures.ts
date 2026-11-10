/**
 * Review figures (Node only): plain plan-view rasters and cross-section SVGs, ink on paper with one
 * quantity colour each (ice thickness in blue; glacial lowering in ochre), every colour with a legend.
 */
import { encodePng } from "./png";

export const PAPER = "#fbfaf7";
export const INK = "#22262b";
export const INK_MUTED = "#6b6f75";
export const ICE_FILL = "#cfe1f2";
export const ICE_LINE = "#3f7cb8";
export const ROCK_FILL = "#e9e4da";

const PAPER_RGB = [251, 250, 247] as const;
const ICE_RGB = [63, 124, 184] as const;
const OCHRE_RGB = [176, 112, 32] as const;

export interface PlanFields {
  readonly nx: number;
  readonly ny: number;
  readonly metresPerCell: number;
  readonly bedM: ArrayLike<number>;
  readonly iceThicknessM: ArrayLike<number>;
  readonly initialBedM: ArrayLike<number>;
}

/**
 * Plan view: hillshaded bed (grey), 100 m ink contours of the ice-free surface, ice thickness as a blue
 * wash (0 → `iceScaleM`), and, where ice-free, glacial lowering as an ochre wash (0 → `lowerScaleM`).
 * The valley head (i = nx − 1) is drawn on the right. `scale` pixels per cell.
 */
export function planPng(
  f: PlanFields,
  options: { scale?: number; iceScaleM?: number; lowerScaleM?: number } = {},
) {
  const s = options.scale ?? 4;
  const iceScale = options.iceScaleM ?? 400;
  const lowerScale = options.lowerScaleM ?? 300;
  const { nx, ny, metresPerCell: dx } = f;
  const w = nx * s;
  const h = ny * s;
  const rgb = new Uint8Array(w * h * 3);
  const surf = (i: number, j: number) => {
    const ii = Math.min(Math.max(i, 0), nx - 1);
    const jj = Math.min(Math.max(j, 0), ny - 1);
    const k = jj * nx + ii;
    return f.bedM[k]! + f.iceThicknessM[k]!;
  };
  // Light from the upper left (north-west in the drawing).
  const lx = -0.6;
  const ly = -0.6;
  const lz = 0.53;
  for (let py = 0; py < h; py++) {
    // Draw j = ny − 1 at the top so the picture reads like the block seen from the front.
    const j = ny - 1 - Math.floor(py / s);
    for (let px = 0; px < w; px++) {
      const i = Math.floor(px / s);
      const k = j * nx + i;
      const zx = (surf(i + 1, j) - surf(i - 1, j)) / (2 * dx);
      const zy = (surf(i, j + 1) - surf(i, j - 1)) / (2 * dx);
      const nlen = Math.hypot(zx, -zy, 1);
      // Screen y is flipped relative to j, so the y slope changes sign.
      const shade = Math.max(0, (-zx * lx + zy * ly + lz) / nlen);
      let r = PAPER_RGB[0] * (0.55 + 0.45 * shade);
      let g = PAPER_RGB[1] * (0.55 + 0.45 * shade);
      let b = PAPER_RGB[2] * (0.55 + 0.45 * shade);
      const ice = f.iceThicknessM[k]!;
      if (ice > 0.5) {
        const a = 0.25 + 0.6 * Math.min(1, ice / iceScale);
        r = r * (1 - a) + ICE_RGB[0] * a;
        g = g * (1 - a) + ICE_RGB[1] * a;
        b = b * (1 - a) + ICE_RGB[2] * a;
      } else {
        const lowered = f.initialBedM[k]! - f.bedM[k]!;
        if (lowered > 1) {
          const a = 0.15 + 0.6 * Math.min(1, lowered / lowerScale);
          r = r * (1 - a) + OCHRE_RGB[0] * a;
          g = g * (1 - a) + OCHRE_RGB[1] * a;
          b = b * (1 - a) + OCHRE_RGB[2] * a;
        }
      }
      // 100 m contours on the surface, drawn at cell edges.
      const z0 = Math.floor(surf(i, j) / 100);
      const edgeX = px % s === s - 1 && i < nx - 1 && Math.floor(surf(i + 1, j) / 100) !== z0;
      const edgeY = py % s === s - 1 && j > 0 && Math.floor(surf(i, j - 1) / 100) !== z0;
      if (edgeX || edgeY) {
        r = r * 0.45 + 34 * 0.55;
        g = g * 0.45 + 38 * 0.55;
        b = b * 0.45 + 43 * 0.55;
      }
      const o = (py * w + px) * 3;
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
    }
  }
  return encodePng(w, h, rgb);
}

export interface SectionCurve {
  readonly label: string;
  readonly bedM: ArrayLike<number>;
  readonly iceThicknessM?: ArrayLike<number>;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * One cross-section panel: starting V dashed, current bed solid ink over a rock fill, ice in section.
 * `bed`, `ice` and `initial` are one row of `ny` samples across the valley.
 */
export function sectionSvg(options: {
  readonly title: string;
  readonly dx: number;
  readonly initial: ArrayLike<number>;
  readonly bed: ArrayLike<number>;
  readonly ice?: ArrayLike<number>;
  readonly ghost?: ArrayLike<number>;
  readonly ghostLabel?: string;
  readonly zMin: number;
  readonly zMax: number;
  readonly width?: number;
  readonly height?: number;
  readonly caption?: string;
}): string {
  const W = options.width ?? 360;
  const H = options.height ?? 220;
  const pad = { l: 44, r: 10, t: 26, b: 34 };
  const n = options.bed.length;
  const span = (n - 1) * options.dx;
  const X = (j: number) => pad.l + ((j * options.dx) / span) * (W - pad.l - pad.r);
  const Y = (z: number) => pad.t + ((options.zMax - z) / (options.zMax - options.zMin)) * (H - pad.t - pad.b);
  const line = (z: ArrayLike<number>) =>
    Array.from({ length: n }, (_, j) => `${X(j).toFixed(1)},${Y(z[j]!).toFixed(1)}`).join(" ");
  const bottom = Y(options.zMin);
  const rock = `M${X(0)},${bottom} L${line(options.bed).replace(/ /g, " L")} L${X(n - 1)},${bottom} Z`;
  let ice = "";
  if (options.ice) {
    const top = Array.from(
      { length: n },
      (_, j) => `${X(j).toFixed(1)},${Y(options.bed[j]! + options.ice![j]!).toFixed(1)}`,
    );
    const base = Array.from(
      { length: n },
      (_, j) => `${X(j).toFixed(1)},${Y(options.bed[j]!).toFixed(1)}`,
    ).reverse();
    ice = `<path d="M${top.join(" L")} L${base.join(" L")} Z" fill="${ICE_FILL}" stroke="none"/>`;
    const surfTop = Array.from({ length: n }, (_, j) =>
      options.ice![j]! > 0.5
        ? `${X(j).toFixed(1)},${Y(options.bed[j]! + options.ice![j]!).toFixed(1)}`
        : null,
    );
    // Ice surface line only over ice-covered samples.
    let seg: string[] = [];
    const segs: string[] = [];
    for (const p of surfTop) {
      if (p) seg.push(p);
      else if (seg.length) {
        segs.push(seg.join(" "));
        seg = [];
      }
    }
    if (seg.length) segs.push(seg.join(" "));
    ice += segs
      .map((p) => `<polyline points="${p}" fill="none" stroke="${ICE_LINE}" stroke-width="1.2"/>`)
      .join("");
  }
  const ticks: string[] = [];
  const step = (options.zMax - options.zMin) / 4;
  for (let t = 0; t <= 4; t++) {
    const z = options.zMin + t * step;
    ticks.push(
      `<line x1="${pad.l - 4}" x2="${pad.l}" y1="${Y(z)}" y2="${Y(z)}" stroke="${INK_MUTED}"/><text x="${pad.l - 6}" y="${Y(z) + 3.5}" text-anchor="end">${Math.round(z)}</text>`,
    );
  }
  const ghost = options.ghost
    ? `<polyline points="${line(options.ghost)}" fill="none" stroke="${INK_MUTED}" stroke-width="1" stroke-dasharray="1 2.5"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif" font-size="10" fill="${INK}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<text x="${pad.l}" y="15" font-size="11.5">${esc(options.title)}</text>
<path d="${rock}" fill="${ROCK_FILL}" stroke="none"/>
${ice}
${ghost}
<polyline points="${line(options.initial)}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="4 3"/>
<polyline points="${line(options.bed)}" fill="none" stroke="${INK}" stroke-width="1.6"/>
${ticks.join("")}
<text x="${pad.l}" y="${H - 18}" fill="${INK_MUTED}">0</text><text x="${W - pad.r}" y="${H - 18}" text-anchor="end" fill="${INK_MUTED}">${(span / 1000).toFixed(1)} km across</text>
${options.caption ? `<text x="${pad.l}" y="${H - 5}" fill="${INK_MUTED}">${esc(options.caption)}</text>` : ""}
</svg>`;
}
