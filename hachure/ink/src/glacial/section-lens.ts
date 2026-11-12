/**
 * The section lens (session 5K): the block's front face drawn again, enlarged, as a 2D textbook section,
 * so the change from V to U is legible at page size. It draws exactly the profiles it is given (the
 * model's bed and ice at the cut, the authored starting bed and optionally a kept run's bed); it computes
 * no landform and invents no number. The one number it prints, the scale bar's length, is derived from
 * the profile's own metres.
 *
 * Pure: returns SVG markup; no DOM, no three.js. Deterministic.
 */
import { type LithologyLook, lithologyPatternSvg, mixHex } from "../materials/natural/lithology";
import { NATURAL_TOKENS } from "../materials/natural/palette";

export interface SectionLensProfile {
  /** Across-valley positions, increasing left to right as seen from the front face (unit: metres). */
  readonly acrossM: ArrayLike<number>;
  /** Bed elevation at each position (unit: metres). */
  readonly bedM: ArrayLike<number>;
  /** Ice thickness at each position (unit: metres). Absent: no ice. */
  readonly iceM?: ArrayLike<number> | undefined;
  /** The starting bed at the same positions, drawn dashed (unit: metres). */
  readonly startBedM: ArrayLike<number>;
  /** A kept run's bed at the same positions, drawn dotted with a label (unit: metres). */
  readonly ghost?: { readonly bedM: ArrayLike<number>; readonly label: string } | null;
  /** The rock of the run shown, for its colour and lithology pattern. */
  readonly look: LithologyLook;
}

export interface SectionLensWords {
  /** Label of the dashed starting profile. */
  readonly start: string;
  /** Label of the ice in section; omitted when empty. */
  readonly ice?: string;
}

export interface SectionLensOptions {
  /** Drawing width (unit: CSS pixels of the viewBox). Default 320. */
  readonly widthPx?: number;
  /**
   * Vertical exaggeration (unit: none; 1 = true scale). The caller binds the value it passes into any
   * caption. Default 1.
   */
  readonly verticalScale?: number;
  /** Prefix for ids inside the SVG (patterns, clip paths). */
  readonly idPrefix?: string;
  /** Short accessible name of the drawing. */
  readonly title?: string;
  readonly words: SectionLensWords;
  /** Ice thinner than this is not drawn (unit: metres). Default 1. */
  readonly iceThresholdM?: number;
}

export interface SectionLensWindow {
  /** Index range of the samples drawn (inclusive). */
  readonly first: number;
  readonly last: number;
  /** Elevation range drawn (unit: metres). */
  readonly bottomM: number;
  readonly topM: number;
}

/**
 * The part of the section worth enlarging: across, the starting valley between its rims; up, to the lower rim
 * or the valley glacier's surface, whichever is higher; down, a little below the lowest bed shown.
 */
export function sectionLensWindow(p: SectionLensProfile, iceThresholdM = 1): SectionLensWindow {
  const n = p.acrossM.length;
  let lowStart = 0;
  for (let k = 1; k < n; k++) if (p.startBedM[k]! < p.startBedM[lowStart]!) lowStart = k;
  let first = lowStart;
  for (let k = lowStart; k >= 0; k--) if (p.startBedM[k]! > p.startBedM[first]!) first = k;
  let last = lowStart;
  for (let k = lowStart; k < n; k++) if (p.startBedM[k]! > p.startBedM[last]!) last = k;
  let topM = Math.min(p.startBedM[first]!, p.startBedM[last]!);
  // The valley glacier only: ice connected to the valley bottom (thin ice on the ridges does not count).
  let lowNow = 0;
  for (let k = 1; k < n; k++) if (p.bedM[k]! < p.bedM[lowNow]!) lowNow = k;
  const iceAt = (k: number) => (p.iceM && p.iceM[k]! > iceThresholdM ? p.iceM[k]! : 0);
  for (const dir of [-1, 1])
    for (let k = lowNow; k >= 0 && k < n && iceAt(k) > 0; k += dir)
      topM = Math.max(topM, p.bedM[k]! + iceAt(k));
  topM += 20;
  first = Math.max(0, first - 1);
  last = Math.min(n - 1, last + 1);
  let bottomM = Infinity;
  for (let k = first; k <= last; k++)
    bottomM = Math.min(bottomM, p.bedM[k]!, p.startBedM[k]!, p.ghost ? p.ghost.bedM[k]! : Infinity);
  return { first, last, bottomM: bottomM - Math.max(20, (topM - bottomM) * 0.12), topM };
}

/** A round scale-bar length near a quarter of `spanM` (1, 2 or 5 × a power of ten; unit: metres). */
export function scaleBarLengthM(spanM: number): number {
  const target = spanM / 4;
  const p = 10 ** Math.floor(Math.log10(target));
  for (const m of [5, 2, 1]) if (m * p <= target) return m * p;
  return p;
}

const f1 = (v: number) => v.toFixed(1);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** SVG markup of the lens. */
export function sectionLensSvg(p: SectionLensProfile, options: SectionLensOptions): string {
  const n = p.acrossM.length;
  if (n < 3 || p.bedM.length !== n || p.startBedM.length !== n)
    throw new RangeError("profile arrays must match");
  const id = options.idPrefix ?? "section-lens";
  const threshold = options.iceThresholdM ?? 1;
  const vs = options.verticalScale ?? 1;
  const win = sectionLensWindow(p, threshold);
  const x0 = p.acrossM[win.first]!;
  const spanM = p.acrossM[win.last]! - x0;
  const W = options.widthPx ?? 320;
  const pad = { l: 6, r: 6, t: 8, b: 26 };
  const scale = (W - pad.l - pad.r) / spanM; // px per metre across
  const H = Math.ceil(pad.t + pad.b + (win.topM - win.bottomM) * scale * vs);
  const X = (m: number) => pad.l + (m - x0) * scale;
  const Y = (z: number) => pad.t + (win.topM - z) * scale * vs;
  const bottomY = Y(win.bottomM);
  const range = Array.from({ length: win.last - win.first + 1 }, (_, k) => win.first + k);
  const line = (z: ArrayLike<number>) =>
    range.map((k) => `${f1(X(p.acrossM[k]!))} ${f1(Y(z[k]!))}`).join("L");

  const rockFill = mixHex(p.look.colour, NATURAL_TOKENS.paper, 0.15);
  const patternId = `${id}-litho-${p.look.key}`;
  const parts: string[] = [];
  parts.push(
    `<defs>${lithologyPatternSvg(p.look, patternId, 12)}` +
      `<clipPath id="${id}-clip"><rect x="${pad.l}" y="${pad.t}" width="${f1(W - pad.l - pad.r)}" height="${f1(bottomY - pad.t)}"/></clipPath></defs>`,
  );
  const body: string[] = [];
  // Rock in section, under the current bed.
  const rock = `M${f1(X(x0))} ${f1(bottomY)}L${line(p.bedM)}L${f1(X(p.acrossM[win.last]!))} ${f1(bottomY)}Z`;
  body.push(`<path class="lens-rock" d="${rock}" fill="${rockFill}"/>`);
  body.push(`<path class="lens-rock-pattern" d="${rock}" fill="url(#${patternId})"/>`);
  // Ice in section: one polygon per run of iced samples.
  let iceTop = -1;
  let iceTopY = Infinity;
  if (p.iceM) {
    let runK: number[] = [];
    const flush = () => {
      if (runK.length >= 2) {
        const top = runK.map((k) => `${f1(X(p.acrossM[k]!))} ${f1(Y(p.bedM[k]! + p.iceM![k]!))}`).join("L");
        const base = runK
          .slice()
          .reverse()
          .map((k) => `${f1(X(p.acrossM[k]!))} ${f1(Y(p.bedM[k]!))}`)
          .join("L");
        body.push(`<path class="lens-ice" d="M${top}L${base}Z" fill="${NATURAL_TOKENS.iceSection}"/>`);
        body.push(`<path class="lens-ice-top" d="M${top}"/>`);
      }
      runK = [];
    };
    for (const k of range) {
      if (p.iceM[k]! > threshold) {
        runK.push(k);
        const y = Y(p.bedM[k]! + p.iceM[k]!);
        if (y < iceTopY) {
          iceTopY = y;
          iceTop = k;
        }
      } else flush();
    }
    flush();
  }
  // Profiles: the current bed (solid), the start (dashed), the kept run (dotted over a paper halo).
  body.push(`<path class="lens-bed" d="M${line(p.bedM)}"/>`);
  body.push(`<path class="lens-start" d="M${line(p.startBedM)}"/>`);
  if (p.ghost) {
    body.push(`<path class="lens-ghost-halo" d="M${line(p.ghost.bedM)}"/>`);
    body.push(`<path class="lens-ghost" d="M${line(p.ghost.bedM)}"/>`);
  }
  parts.push(`<g clip-path="url(#${id}-clip)">${body.join("")}</g>`);
  parts.push(
    `<rect class="lens-frame" x="${pad.l}" y="${pad.t}" width="${f1(W - pad.l - pad.r)}" height="${f1(bottomY - pad.t)}"/>`,
  );

  // Labels with short leaders: the start on the left wall, the kept run on the right, the ice at its top.
  const labels: string[] = [];
  const at = (k: number, z: ArrayLike<number>) => ({ x: X(p.acrossM[k]!), y: Y(z[k]!) });
  // The start label points where the starting V lies furthest above today's bed, on the left half.
  const mid = Math.round((win.first + win.last) / 2);
  let leftK = win.first + Math.round((win.last - win.first) * 0.3);
  let gap = 2;
  for (let k = win.first; k <= mid; k++)
    if (p.startBedM[k]! - p.bedM[k]! > gap) {
      gap = p.startBedM[k]! - p.bedM[k]!;
      leftK = k;
    }
  const s = at(leftK, p.startBedM);
  // Text on whichever side has room, kept inside the frame.
  const side = s.x < W * 0.4 ? 1 : -1;
  const ty = Math.max(pad.t + 12, s.y - 18);
  labels.push(
    `<path class="lens-leader" d="M${f1(s.x)} ${f1(s.y)}L${f1(s.x + 12 * side)} ${f1(ty + 2)}"/>` +
      `<text x="${f1(s.x + 14 * side)}" y="${f1(ty)}" text-anchor="${side > 0 ? "start" : "end"}">${esc(options.words.start)}</text>`,
  );
  if (p.ghost) {
    const rightK = win.first + Math.round((win.last - win.first) * 0.68);
    const g = at(rightK, p.ghost.bedM);
    labels.push(
      `<path class="lens-leader" d="M${f1(g.x)} ${f1(g.y)}L${f1(g.x + 10)} ${f1(Math.min(bottomY - 4, g.y + 14))}"/>` +
        `<text class="lens-ghost-label" x="${f1(g.x + 12)}" y="${f1(Math.min(bottomY - 2, g.y + 18))}">${esc(p.ghost.label)}</text>`,
    );
  }
  if (options.words.ice && iceTop >= 0)
    labels.push(
      `<text class="lens-ice-label" x="${f1(X(p.acrossM[iceTop]!))}" y="${f1(iceTopY + 13)}" text-anchor="middle">${esc(options.words.ice)}</text>`,
    );
  // Scale bar, length from the profile's own metres.
  const bar = scaleBarLengthM(spanM);
  const by = bottomY + 14;
  labels.push(
    `<path class="lens-bar" d="M${pad.l} ${f1(by - 4)}V${f1(by)}H${f1(pad.l + bar * scale)}V${f1(by - 4)}"/>` +
      `<text class="lens-bar-label" x="${f1(pad.l + bar * scale + 5)}" y="${f1(by + 1)}">${bar} m</text>`,
  );
  parts.push(`<g class="lens-labels">${labels.join("")}</g>`);

  const ink = NATURAL_TOKENS.ink;
  const style =
    `.section-lens path{fill:none;stroke-linejoin:round;stroke-linecap:round}` +
    `.section-lens .lens-rock,.section-lens .lens-rock-pattern,.section-lens .lens-ice{stroke:none}` +
    `.section-lens .lens-rock,.section-lens .lens-ice{fill-opacity:1}` +
    `.section-lens .lens-rock{fill:${rockFill}}.section-lens .lens-rock-pattern{fill:url(#${patternId})}` +
    `.section-lens .lens-ice{fill:${NATURAL_TOKENS.iceSection}}` +
    `.section-lens .lens-ice-top{stroke:${NATURAL_TOKENS.iceShade};stroke-width:1.2}` +
    `.section-lens .lens-bed{stroke:${ink};stroke-width:1.8}` +
    `.section-lens .lens-start{stroke:${ink};stroke-width:1.3;stroke-dasharray:6 4}` +
    `.section-lens .lens-ghost-halo{stroke:${NATURAL_TOKENS.ghostHalo};stroke-width:5}` +
    `.section-lens .lens-ghost{stroke:${NATURAL_TOKENS.ghost};stroke-width:2;stroke-dasharray:0.1 4.2}` +
    `.section-lens .lens-frame{fill:none;stroke:${ink};stroke-width:1}` +
    `.section-lens .lens-leader,.section-lens .lens-bar{stroke:${ink};stroke-width:.8}` +
    `.section-lens text{font:italic 12px Georgia,serif;fill:${ink};stroke:${NATURAL_TOKENS.paper};stroke-width:3px;paint-order:stroke;stroke-linejoin:round}` +
    `.section-lens .lens-ghost-label{fill:${NATURAL_TOKENS.ghost}}` +
    `.section-lens .lens-bar-label{font-style:normal;font-size:11px}`;
  const title = options.title ? `<title id="${id}-title">${esc(options.title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="section-lens" viewBox="0 0 ${W} ${H}" ` +
    (options.title ? `role="img" aria-labelledby="${id}-title"` : `aria-hidden="true"`) +
    `>${title}<style>${style}</style>${parts.join("")}</svg>`
  );
}
