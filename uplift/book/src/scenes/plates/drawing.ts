/**
 * Fig. 2, the textbook line drawing of lesson 2 (session 7D): a block diagram of two continental plates
 * meeting along a boundary that runs from the back of the block to the front, each plate carrying an arrow.
 * It reads on its own (the static fallback when 3D is unavailable) and is the first frame of the drawing →
 * ink → colour transition. ILLUSTRATION: drawn from the authored starting landscape, never a model output.
 *
 * Drawn deterministically from a snapshot of the starting landscape: profile lines across the boundary with
 * hidden-line removal (the floating-horizon method of block diagrams), the streams of the valleys that cross
 * the boundary, the front face with its rock layers, crust band and mantle, a dashed plate boundary, and one
 * arrow per plate. An illustrator may replace it with a hand-drawn SVG; only `platesDrawingSvg()` is used.
 *
 * Reference style: physiographic block diagrams (A. N. Strahler; USGS _This Dynamic Earth_ figures).
 */
import type { BlockGrid, LandscapeSnapshot } from "@hachure/ink/stage";
import { drainage, streamPaths } from "./dressing";

const INK = "#292B2C";
const PAPER = "#FAF8F2";
/** Viewing direction: from the front, a little to the right, from above (unit: degrees). */
const AZIMUTH_DEG = 22;
const ELEVATION_DEG = 34;
/** Drawing scale (unit: SVG units per block metre, vertical scale applied first). */
const SCALE = 0.0056;

interface P2 {
  x: number;
  y: number;
}

/** How each plate's arrow points: towards, away from or along the boundary; `null` a neutral double arrow. */
export type PlateArrowMotion = "towards" | "apart" | "along" | null;

export interface PlatesDrawingLabel {
  readonly feature: "boundary" | "plate" | "crust" | "mantle";
  readonly text: string;
}

export interface PlatesDrawingOptions {
  /** The starting landscape (bed, crust base; `coverBaseM` when present). */
  readonly snapshot: LandscapeSnapshot;
  /** The block's fixed elevation frame (the same one the 3D block uses). */
  readonly frame: { readonly minM: number; readonly maxM: number };
  /** The stage's vertical exaggeration (unit: none). */
  readonly reliefScale: number;
  /** Undeformed rock-layer boundaries drawn on the front face (unit: metres, elevations). */
  readonly strataM: readonly number[];
  readonly arrows?: PlateArrowMotion;
  readonly labels?: readonly PlatesDrawingLabel[];
  /** id prefix for `<title>`/`<desc>`. */
  readonly idPrefix?: string;
  readonly title?: string;
  readonly description?: string;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const f1 = (v: number) => v.toFixed(1);
/**
 * An optional per-cell field read structurally, so the drawing works with or without later additions to
 * the snapshot (for example D-W7-7R's cover base, which the engine may not carry yet).
 */
function optionalField(s: LandscapeSnapshot, name: string): ArrayLike<number> | undefined {
  const v = (s as unknown as Record<string, unknown>)[name];
  return v && typeof v === "object" && "length" in v ? (v as ArrayLike<number>) : undefined;
}
const pathOf = (points: readonly P2[]) => `M${points.map((p) => `${f1(p.x)} ${f1(p.y)}`).join("L")}`;

/** The SVG markup of Fig. 2. Deterministic: the same options give the same string. */
export function platesDrawingSvg(o: PlatesDrawingOptions): string {
  const id = o.idPrefix ?? "plates-fig";
  const s = o.snapshot;
  const { columns, rows, metresPerCell: m } = s;
  const halfW = ((columns - 1) * m) / 2;
  const halfL = ((rows - 1) * m) / 2;
  const baseM = o.frame.minM - Math.max(1, (o.frame.maxM - o.frame.minM) * 0.2);
  const phi = (AZIMUTH_DEG * Math.PI) / 180;
  const eps = (ELEVATION_DEG * Math.PI) / 180;
  const bed = (c: number, r: number) => s.bedM[r * columns + c]!;
  const crust = (c: number, r: number) => Math.min(bed(c, r), s.crustBaseM?.[r * columns + c] ?? -Infinity);
  /** Column c (0 … columns − 1), row r (0 = back), elevation h in metres. */
  const project = (c: number, r: number, hM: number): P2 => {
    const X = c * m - halfW;
    const Z = r * m - halfL;
    const Y = (hM - baseM) * o.reliefScale;
    const sx = X * Math.cos(phi) - Z * Math.sin(phi);
    const d = X * Math.sin(phi) + Z * Math.cos(phi);
    const up = Y * Math.cos(eps) - d * Math.sin(eps);
    return { x: sx * SCALE, y: -up * SCALE };
  };
  const last = rows - 1;
  const right = columns - 1;
  const corners = [project(0, last, baseM), project(right, last, baseM), project(right, 0, baseM)];
  let top = Infinity;
  for (let r = 0; r < rows; r += 4)
    for (let c = 0; c < columns; c += 4) top = Math.min(top, project(c, r, bed(c, r)).y);
  const minX = Math.min(...corners.map((p) => p.x), project(0, 0, bed(0, 0)).x) - 30;
  const maxX = Math.max(...corners.map((p) => p.x)) + 190;
  const minY = top - 70;
  const maxY = Math.max(...corners.map((p) => p.y)) + 14;
  const W = Math.ceil(maxX - minX);
  const H = Math.ceil(maxY - minY);
  const T = (p: P2): P2 => ({ x: p.x - minX, y: p.y - minY });
  const P = (c: number, r: number, h: number) => T(project(c, r, h));

  const lines: string[] = [];
  const add = (cls: string, d: string) => d && lines.push(`<path class="${cls}" d="${d}"/>`);

  // ---- Faces: the front face (to the base) and the right face. ----
  const frontTop = Array.from({ length: columns }, (_, c) => P(c, last, bed(c, last)));
  const rightTop = Array.from({ length: rows }, (_, k) => P(right, last - k, bed(right, last - k)));
  const fl = P(0, last, baseM);
  const fr = P(right, last, baseM);
  const br = P(right, 0, baseM);
  add("edge", `${pathOf([fl, ...frontTop, fr])}Z`);
  add("edge", `${pathOf([fr, ...rightTop, br])}Z`);

  // Rock layers on both faces, below the ground line.
  const strata: string[] = [];
  const faceLine = (
    at: (t: number) => [number, number],
    n: number,
    hM: (c: number, r: number) => number,
    below: (c: number, r: number) => number,
  ) => {
    let run: P2[] = [];
    for (let t = 0; t < n; t++) {
      const [c, r] = at(t);
      const h = hM(c, r);
      if (h < below(c, r) - 60) run.push(P(c, r, h));
      else if (run.length) {
        if (run.length > 1) strata.push(pathOf(run));
        run = [];
      }
    }
    if (run.length > 1) strata.push(pathOf(run));
  };
  const cover = optionalField(s, "coverBaseM");
  const coverBase = (c: number, r: number) => cover?.[r * columns + c];
  for (const h of o.strataM) {
    faceLine(
      (c) => [c, last],
      columns,
      () => h,
      bed,
    );
    faceLine(
      (k) => [right, last - k],
      rows,
      () => h,
      bed,
    );
  }
  lines.push(`<g class="strata">${strata.map((d) => `<path d="${d}"/>`).join("")}</g>`);

  // Crust base (solid) and its band pattern; the mantle below with sparse rings.
  if (s.crustBaseM) {
    const base = Array.from({ length: columns }, (_, c) => P(c, last, crust(c, last)));
    const side = Array.from({ length: rows }, (_, k) => P(right, last - k, crust(right, last - k)));
    add("moho", pathOf(base));
    add("moho", pathOf(side));
    if (cover) {
      add(
        "cover",
        pathOf(
          Array.from({ length: columns }, (_, c) =>
            P(c, last, Math.min(bed(c, last), coverBase(c, last) ?? bed(c, last))),
          ),
        ),
      );
    }
    const ticks: string[] = [];
    const rings: string[] = [];
    for (let c = 6; c < columns - 4; c += 9) {
      const topH = coverBase(c, last) ?? bed(c, last);
      const crustH = crust(c, last);
      for (let k = 1; k <= 3; k++) {
        const h = topH + ((crustH - topH) * k) / 4 + ((c * 37) % 5) * 60;
        const p = P(c + (k % 2) * 4, last, h);
        ticks.push(`M${f1(p.x - 6)} ${f1(p.y - 5)}L${f1(p.x)} ${f1(p.y + 4)}L${f1(p.x + 6)} ${f1(p.y - 5)}`);
      }
      for (let k = 1; k <= 2; k++) {
        const h = crustH + ((baseM - crustH) * k) / 3;
        const p = P(c + 4 + (k % 2) * 3, last, h);
        rings.push(`M${f1(p.x + 5)} ${f1(p.y)}a5 5 0 1 0 -10 0a5 5 0 1 0 10 0`);
      }
    }
    add("tick", ticks.join(""));
    add("ring", rings.join(""));
  }

  // ---- Profiles across the boundary, front to back, with hidden-line removal; streams on the way. ----
  const horizon = new Float64Array(W + 2).fill(Infinity);
  const visible = (p: P2) => {
    const i = Math.round(p.x);
    return i >= 0 && i < horizon.length && p.y < horizon[i]! - 0.4;
  };
  const raise = (pts: readonly P2[]) => {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1]!;
      const b = pts[k]!;
      for (let x = Math.ceil(Math.min(a.x, b.x)); x <= Math.floor(Math.max(a.x, b.x)); x++) {
        const t = (x - a.x) / (b.x - a.x || 1);
        if (x >= 0 && x < horizon.length) horizon[x] = Math.min(horizon[x]!, a.y + (b.y - a.y) * t);
      }
    }
  };
  raise(frontTop);
  raise(rightTop);
  // Streams of the starting landscape, by row, so each piece is tested against the horizon in front of it.
  const grid: BlockGrid = {
    across: columns,
    along: rows,
    metresPerCell: m,
    bedM: Float32Array.from(s.bedM),
    iceM: new Float32Array(columns * rows),
    rockId: new Uint8Array(columns * rows),
    velocity: null,
    modelTimeYr: null,
  };
  const streams = streamPaths(grid, drainage(grid), 140, last);
  const streamPieces = new Map<number, [P2, P2][]>();
  const sample = (a: number, l: number) => {
    const c = Math.min(right, Math.max(0, Math.round(a)));
    const r = Math.min(last, Math.max(0, Math.round(l)));
    return bed(c, r);
  };
  for (const path of streams)
    for (let k = 0; k + 3 < path.length; k += 2) {
      const [a0, l0, a1, l1] = [path[k]!, path[k + 1]!, path[k + 2]!, path[k + 3]!];
      const row = Math.round(Math.max(l0, l1));
      const piece: [P2, P2] = [
        T(project(a0, l0, sample(a0, l0) + 30)),
        T(project(a1, l1, sample(a1, l1) + 30)),
      ];
      if (!streamPieces.has(row)) streamPieces.set(row, []);
      streamPieces.get(row)!.push(piece);
    }
  const streamD: string[] = [];
  const PROFILE_EVERY = 5;
  for (let r = last; r >= 0; r--) {
    for (const [a, b] of streamPieces.get(r) ?? [])
      if (visible(a) && visible(b)) streamD.push(`M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`);
    const pts = Array.from({ length: columns }, (_, c) => P(c, r, bed(c, r)));
    if ((last - r) % PROFILE_EVERY === 0 && r !== last) {
      let run: P2[] = [];
      for (const p of pts) {
        if (visible(p)) run.push(p);
        else if (run.length) {
          if (run.length > 1) add("land", pathOf(run));
          run = [];
        }
      }
      if (run.length > 1) add("land", pathOf(run));
    }
    raise(pts);
  }
  add("stream", streamD.join(""));

  // ---- The plate boundary: dashed, down the middle of the top and the front face. ----
  const mid = (columns - 1) / 2;
  const cMid = Math.round(mid);
  const boundaryTop: P2[] = [];
  for (let r = 0; r <= last; r++) boundaryTop.push(P(mid, r, bed(cMid, r) + 40));
  add("boundary", pathOf(boundaryTop));
  add("boundary", pathOf([P(mid, last, bed(cMid, last)), P(mid, last, crust(cMid, last))]));

  // ---- One arrow per plate, standing on its plate. ----
  const arrow = (c: number, r: number, dc: number, dr: number, double: boolean) => {
    const h = (cc: number, rr: number) => bed(Math.round(cc), Math.round(rr)) + 200;
    const a = P(c - dc, r - dr, h(c - dc, r - dr));
    const b = P(c + dc, r + dr, h(c + dc, r + dr));
    const head = (from: P2, to: P2) => {
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const L = 30;
      const w = 0.42;
      return `M${f1(to.x)} ${f1(to.y)}L${f1(to.x - L * Math.cos(ang - w))} ${f1(to.y - L * Math.sin(ang - w))}L${f1(to.x - L * Math.cos(ang + w))} ${f1(to.y - L * Math.sin(ang + w))}Z`;
    };
    const shaft = `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
    const heads = head(a, b) + (double ? head(b, a) : "");
    return `<g class="plate-arrow${double ? " neutral" : ""}"><path class="halo" d="${shaft}${heads}"/><path class="shaft" d="${shaft}"/><path class="head" d="${heads}"/></g>`;
  };
  const arrowRow = Math.round(last * 0.62);
  const left = Math.round(columns * 0.24);
  const rightC = Math.round(columns * 0.76);
  const span = columns * 0.1;
  const motion = o.arrows ?? null;
  const arrowsSvg =
    motion === null
      ? arrow(left, arrowRow, span, 0, true) + arrow(rightC, arrowRow, span, 0, true)
      : motion === "towards"
        ? arrow(left, arrowRow, span, 0, false) + arrow(rightC, arrowRow, -span, 0, false)
        : motion === "apart"
          ? arrow(left, arrowRow, -span, 0, false) + arrow(rightC, arrowRow, span, 0, false)
          : arrow(left, arrowRow, 0, -span, false) + arrow(rightC, arrowRow, 0, span, false);

  // ---- Leader labels (words only). ----
  const labels: string[] = [];
  const label = (text: string, p: P2, dx: number, dy: number, anchor = "start") =>
    labels.push(
      `<path class="leader" d="M${f1(p.x)} ${f1(p.y)}L${f1(p.x + dx)} ${f1(p.y + dy - 4)}"/>` +
        `<text x="${f1(p.x + dx)}" y="${f1(p.y + dy)}" text-anchor="${anchor}">${esc(text)}</text>`,
    );
  for (const l of o.labels ?? []) {
    if (l.feature === "boundary") label(l.text, P(mid, 6, bed(cMid, 6) + 40), -20, -42, "end");
    if (l.feature === "plate") label(l.text, P(left, 22, bed(left, 22)), -10, -38, "end");
    if (l.feature === "crust") {
      const c = right;
      const h = ((coverBase(c, last) ?? bed(c, last)) + crust(c, last)) / 2;
      label(l.text, P(c, last - 6, h), 22, 4);
    }
    if (l.feature === "mantle") label(l.text, P(right, last - 6, (crust(right, last) + baseM) / 2), 22, 4);
  }

  const title = o.title ?? "Fig. 2 · Two plates meeting along a boundary";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title${o.description ? ` ${id}-desc` : ""}" class="plates-drawing">`,
    `<title id="${id}-title">${esc(title)}</title>`,
    o.description ? `<desc id="${id}-desc">${esc(o.description)}</desc>` : "",
    `<style>`,
    `.plates-drawing path{fill:none;stroke:${INK};stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}`,
    `.plates-drawing .edge{stroke-width:1.4}.plates-drawing .land{stroke-width:.6}`,
    `.plates-drawing .strata path{stroke-width:.5;stroke-dasharray:5 3}.plates-drawing .cover{stroke-width:.7}`,
    `.plates-drawing .moho{stroke-width:1.1}.plates-drawing .tick,.plates-drawing .ring{stroke-width:.6}`,
    `.plates-drawing .stream{stroke-width:1.3}.plates-drawing .boundary{stroke-width:1.2;stroke-dasharray:7 5}`,
    `.plates-drawing .plate-arrow .halo{stroke:${PAPER};stroke-width:10}`,
    `.plates-drawing .plate-arrow .shaft{stroke-width:3.6}.plates-drawing .plate-arrow .head{fill:${INK};stroke-width:1}`,
    `.plates-drawing .plate-arrow.neutral .head{fill:${PAPER}}`,
    `.plates-drawing .leader{stroke-width:.6}`,
    `.plates-drawing text{font:italic 36px Georgia,serif;fill:${INK};stroke:${PAPER};stroke-width:8px;paint-order:stroke;stroke-linejoin:round}`,
    `</style>`,
    `<g class="plates-drawing-lines">${lines.join("")}</g>`,
    `<g class="plates-drawing-arrows">${arrowsSvg}</g>`,
    `<g class="plates-drawing-labels">${labels.join("")}</g>`,
    `</svg>`,
  ].join("");
}
