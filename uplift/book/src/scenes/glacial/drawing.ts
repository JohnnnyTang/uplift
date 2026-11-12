/**
 * Fig. 1, the authored textbook line drawing: a block diagram of a mountain valley with a glacier. It reads
 * on its own (it is the static fallback when 3D is unavailable) and is the first frame of the drawing →
 * ink → colour transition.
 *
 * The drawing is generated deterministically from the authored landform (`authoredValley("glaciated")`),
 * not from model output: cross-valley profile lines drawn with hidden-line removal (the classic
 * "floating horizon" method of block diagrams), so the profiles themselves show the valley turning from a
 * V below the snout to a U under the ice. An illustrator can replace it with a hand-drawn SVG of the same
 * shape: only `glacialDrawingSvg()` is consumed.
 *
 * Reference style: physiographic block diagrams (e.g. A. N. Strahler's textbook figures; W. M. Davis).
 */
import { FIXTURE_DRESSING, FIXTURE_GRID, authoredValley } from "./fixture";

const INK = "#292B2C";
/** Viewing direction of the drawing: from the front, a little to the right, from above (unit: degrees). */
const AZIMUTH_DEG = 22;
const ELEVATION_DEG = 38;
/** Drawing scale (unit: SVG units per metre). */
const SCALE = 0.105;

interface P2 {
  x: number;
  y: number;
}

export interface GlacialDrawingOptions {
  /** id prefix for `<title>`/`<desc>`, so several drawings can share a page. */
  readonly idPrefix?: string;
  /**
   * Leader-line word labels (D-W5-R1 item 7; words only, no numbers). `true` (default) draws
   * {@link GLACIAL_DRAWING_LABELS}; `false` none; a list draws those words at those features (session 5L
   * owns the words).
   */
  readonly labels?: boolean | readonly GlacialDrawingLabel[];
}

/** Features of the drawing a label can point at. */
export type GlacialDrawingFeature =
  "valleyHead" | "valleyFloor" | "vValley" | "uValley" | "cirque" | "glacier" | "snout" | "river";

export interface GlacialDrawingLabel {
  readonly feature: GlacialDrawingFeature;
  readonly text: string;
}

/**
 * The default labels (D-W5-R1 item 7), with 5L's words (PR #34): valley head, glacier, snout, U-shaped
 * valley, V-shaped valley, valley floor. 5M passes them from the spread; these stay in step until then.
 * <!-- expert-review -->
 */
export const GLACIAL_DRAWING_LABELS: readonly GlacialDrawingLabel[] = Object.freeze([
  { feature: "valleyHead", text: "valley head" },
  { feature: "glacier", text: "glacier" },
  { feature: "snout", text: "snout" },
  { feature: "uValley", text: "U-shaped valley" },
  { feature: "vValley", text: "V-shaped valley" },
  { feature: "valleyFloor", text: "valley floor" },
]);

/** Accessible description of the drawing (also used by the figure's text alternative). */
export const GLACIAL_DRAWING_DESCRIPTION =
  "Line drawing of a block of mountains cut open at the front. A glacier fills the upper valley from a " +
  "bowl-shaped cirque below the peaks down to its snout. Under the glacier the valley is a broad U with " +
  "steep sides. Below the snout a meltwater river runs on through a narrower V-shaped valley with " +
  "conifers on its lower slopes. The front face shows the rock in section.";

/** The SVG markup of Fig. 1. Deterministic. */
export function glacialDrawingSvg(options: GlacialDrawingOptions = {}): string {
  const id = options.idPrefix ?? "glacial-fig";
  const valley = authoredValley("glaciated");
  const { columns, rows, metresPerCell } = FIXTURE_GRID;
  const halfW = ((columns - 1) * metresPerCell) / 2;
  const halfL = ((rows - 1) * metresPerCell) / 2;
  const phi = (AZIMUTH_DEG * Math.PI) / 180;
  const eps = (ELEVATION_DEG * Math.PI) / 180;
  // Base of the block: below the lowest point of the start valley.
  let minM = Infinity;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c += 4)
      minM = Math.min(minM, valley.bedM((c - (columns - 1) / 2) * metresPerCell, r / (rows - 1)));
  const baseM = minM - 420;
  const project = (xM: number, hM: number, u: number): P2 => {
    const Z = -halfL + u * 2 * halfL; // head at the back (−), front towards the viewer (+)
    const X = xM;
    const Y = hM - baseM;
    const sx = X * Math.cos(phi) - Z * Math.sin(phi);
    const d = X * Math.sin(phi) + Z * Math.cos(phi);
    const up = Y * Math.cos(eps) - d * Math.sin(eps);
    return { x: sx * SCALE, y: -up * SCALE };
  };
  const surface = (xM: number, u: number) => valley.bedM(xM, u) + valley.iceM(xM, u);

  // Screen bounds from the block's corners and the highest ground.
  const pts: P2[] = [];
  for (const u of [0, 1])
    for (const xM of [-halfW, halfW]) {
      pts.push(project(xM, baseM, u), project(xM, surface(xM, u) + 900, u));
    }
  const minX = Math.min(...pts.map((p) => p.x)) - 140;
  const maxX = Math.max(...pts.map((p) => p.x)) + 140;
  const minY = Math.min(...pts.map((p) => p.y)) - 10;
  const maxY = Math.max(...pts.map((p) => p.y)) + 16;
  const W = Math.ceil(maxX - minX);
  const H = Math.ceil(maxY - minY);
  const T = (p: P2): P2 => ({ x: p.x - minX, y: p.y - minY });

  const horizon = new Float64Array(W + 2).fill(Infinity);
  const paths: string[] = [];
  const poly = (points: P2[], cls: string) => {
    if (points.length < 2) return;
    paths.push(
      `<path class="${cls}" d="M${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}"/>`,
    );
  };
  const visibleAt = (p: P2) => {
    const i = Math.round(p.x);
    return i >= 0 && i < horizon.length && p.y < horizon[i]! - 0.4;
  };

  // Front face and right face first: their top edges start the horizon.
  const frontTop: P2[] = [];
  for (let c = 0; c < columns; c++) {
    const xM = (c - (columns - 1) / 2) * metresPerCell;
    frontTop.push(T(project(xM, surface(xM, 1), 1)));
  }
  const fl = T(project(-halfW, baseM, 1));
  const fr = T(project(halfW, baseM, 1));
  const br = T(project(halfW, baseM, 0));
  const rightTop: P2[] = [];
  for (let r = rows - 1; r >= 0; r--)
    rightTop.push(T(project(halfW, surface(halfW, r / (rows - 1)), r / (rows - 1))));
  poly([fl, ...frontTop, fr, fl], "edge");
  poly([fr, ...rightTop, br, fr], "edge");

  // Bedding lines on the faces: horizontal strata, clipped under the ground line.
  const strata: string[] = [];
  for (let k = 1; k <= 5; k++) {
    const hM = baseM + k * 260;
    const face = (
      from: number,
      to: number,
      at: (t: number) => [number, number],
      top: (t: number) => number,
    ) => {
      let run: P2[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = from + ((to - from) * i) / 60;
        const [xM, u] = at(t);
        if (hM < top(t) - 20) run.push(T(project(xM, hM, u)));
        else if (run.length) {
          strata.push(pathOf(run));
          run = [];
        }
      }
      if (run.length) strata.push(pathOf(run));
    };
    face(
      -halfW,
      halfW,
      (x) => [x, 1],
      (x) => valley.bedM(x, 1),
    );
    face(
      1,
      0,
      (u) => [halfW, u],
      (u) => valley.bedM(halfW, u),
    );
  }
  paths.push(`<g class="strata">${strata.join("")}</g>`);

  // Cross-valley profiles, front to back, with hidden-line removal.
  const samples = columns * 3;
  const ice: P2[][] = [];
  const marginsL: P2[] = [];
  const marginsR: P2[] = [];
  const trees: P2[] = [];
  const river: P2[] = [];
  const FLOW_FRACTIONS = [-0.62, -0.31, 0, 0.31, 0.62];
  const flowLines: P2[][][] = FLOW_FRACTIONS.map(() => [[]]);
  let profileIndex = 0;
  for (let r = rows - 1; r >= 0; r -= 3, profileIndex++) {
    const u = r / (rows - 1);
    const pts2: { p: P2; iced: boolean; snow: boolean; xM: number }[] = [];
    for (let s = 0; s <= samples; s++) {
      const xM = -halfW + (2 * halfW * s) / samples;
      const iceM = valley.iceM(xM, u);
      const hM = valley.bedM(xM, u) + iceM;
      pts2.push({
        p: T(project(xM, hM, u)),
        iced: iceM > 3,
        snow: hM > FIXTURE_DRESSING.snowlineM + 120,
        xM,
      });
    }
    let run: P2[] = [];
    let runClass = "";
    const flush = () => {
      if (run.length > 1) {
        if (runClass === "ice") ice.push(run);
        else poly(run, runClass);
      }
      run = [];
    };
    let wasIced = false;
    for (const { p, iced, snow, xM } of pts2) {
      // Sparser lines on snowfields and on the glacier: they read as white, like a textbook figure.
      const draw = iced ? false : snow ? profileIndex % 3 === 0 : true;
      const cls = iced ? "ice" : snow ? "snow" : "land";
      const vis = visibleAt(p);
      if (vis && iced !== wasIced) (xM < valley.centreM(u) ? marginsL : marginsR).push(p);
      wasIced = iced;
      if (vis && draw) {
        if (cls !== runClass) flush();
        runClass = cls;
        run.push(p);
      } else flush();
    }
    flush();
    // Longitudinal flow lines on the glacier: fixed fractions of its width at this profile.
    const icedXs = pts2.filter((q) => q.iced).map((q) => q.xM);
    if (icedXs.length > 2) {
      const lo = Math.min(...icedXs);
      const hi = Math.max(...icedXs);
      FLOW_FRACTIONS.forEach((f, i) => {
        const xM = (lo + hi) / 2 + ((hi - lo) / 2) * f;
        const p = T(project(xM, surface(xM, u) + 2, u));
        const line = flowLines[i]!;
        if (visibleAt(p)) line.at(-1)!.push(p);
        else if (line.at(-1)!.length) line.push([]);
      });
    } else for (const line of flowLines) if (line.at(-1)!.length) line.push([]);
    // Conifers on gentle ice-free slopes below the treeline; the river below the snout.
    for (let s = 0; s <= samples; s += 5) {
      const { p, iced, xM } = pts2[s]!;
      const h = valley.bedM(xM, u);
      const slope = Math.abs(valley.bedM(xM + 50, u) - valley.bedM(xM - 50, u)) / 100;
      const jitter = ((s * 7919 + r * 104729) % 97) / 97;
      if (!iced && h < FIXTURE_DRESSING.treelineM && slope < 0.55 && jitter < 0.42 && visibleAt(p))
        trees.push(p);
    }
    const c = valley.centreM(u);
    if (valley.iceM(c, u) <= 0) {
      const p = T(project(c, valley.bedM(c, u) + 4, u));
      if (visibleAt(p)) river.push(p);
    }
    for (const { p } of pts2) {
      const i = Math.round(p.x);
      if (i >= 0 && i < horizon.length) horizon[i] = Math.min(horizon[i]!, p.y);
    }
    // Fill the 1-unit gaps between samples so the horizon has no holes.
    for (let s = 1; s < pts2.length; s++) {
      const a = pts2[s - 1]!.p;
      const b = pts2[s]!.p;
      for (let x = Math.ceil(Math.min(a.x, b.x)); x <= Math.floor(Math.max(a.x, b.x)); x++) {
        const t = (x - a.x) / (b.x - a.x || 1);
        if (x >= 0 && x < horizon.length) horizon[x] = Math.min(horizon[x]!, a.y + (b.y - a.y) * t);
      }
    }
  }
  for (const run of ice) poly(run, "ice");
  for (const line of flowLines) for (const run of line) poly(run.reverse(), "ice");
  poly(marginsL.reverse(), "margin");
  poly(marginsR.reverse(), "margin");
  poly(river.reverse(), "river");
  const treeMarks = trees
    .map((p) => `M${(p.x - 3.4).toFixed(1)} ${(p.y + 0.6).toFixed(1)}l3.4 -9.6l3.4 9.6zm3.4 0v2.8`)
    .join("");
  paths.push(`<path class="tree" d="${treeMarks}"/>`);

  // Flow arrows on the glacier, down the centre line.
  const arrows: string[] = [];
  for (const u of [0.22, 0.4]) {
    const c = valley.centreM(u);
    const a = T(project(c, surface(c, u) + 4, u));
    const b = T(project(valley.centreM(u + 0.07), surface(valley.centreM(u + 0.07), u + 0.07) + 4, u + 0.07));
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = (s: number) =>
      `${(b.x - 5 * Math.cos(ang + s)).toFixed(1)} ${(b.y - 5 * Math.sin(ang + s)).toFixed(1)}`;
    arrows.push(
      `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}M${head(0.5)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}L${head(-0.5)}`,
    );
  }
  paths.push(`<path class="flow" d="${arrows.join("")}"/>`);

  const labels: string[] = [];
  const wanted =
    options.labels === false
      ? []
      : options.labels === true || options.labels === undefined
        ? GLACIAL_DRAWING_LABELS
        : options.labels;
  if (wanted.length) {
    const label = (text: string, xM: number, u: number, dx: number, dy: number, anchor = "start") => {
      const p = T(project(xM, surface(xM, u), u));
      const tx = p.x + dx;
      const ty = p.y + dy;
      labels.push(
        `<path class="leader" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${tx.toFixed(1)} ${(ty - 3).toFixed(1)}"/>` +
          `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${text}</text>`,
      );
    };
    // Anchor point and text offset per feature (SVG units), placed clear of the block's lines.
    const at: Record<GlacialDrawingFeature, (text: string) => void> = {
      valleyHead: (t) => label(t, valley.centreM(0.04), 0.04, -50, -95, "end"),
      cirque: (t) => label(t, valley.centreM(0.06), 0.06, -40, -60, "end"),
      glacier: (t) => label(t, valley.centreM(0.34) + 250, 0.34, 120, -60),
      snout: (t) => label(t, valley.centreM(0.6), 0.6, 150, -20),
      valleyFloor: (t) => label(t, valley.centreM(0.86), 0.86, -210, 55, "end"),
      river: (t) => label(t, valley.centreM(0.86), 0.86, -120, 40, "end"),
      uValley: (t) => label(t, valley.centreM(0.3) - 900, 0.3, -60, -70, "end"),
      vValley: (t) => label(t, valley.centreM(0.97) + 700, 0.97, 90, -80),
    };
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    for (const l of wanted) at[l.feature](esc(l.text));
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-title ${id}-desc" class="glacial-drawing">`,
    `<title id="${id}-title">Fig. 1 · A mountain valley with a glacier</title>`,
    `<desc id="${id}-desc">${GLACIAL_DRAWING_DESCRIPTION}</desc>`,
    `<style>`,
    `.glacial-drawing path{fill:none;stroke:${INK};stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}`,
    `.glacial-drawing .edge{stroke-width:1.4}.glacial-drawing .land{stroke-width:.6}`,
    `.glacial-drawing .snow{stroke-width:.5}.glacial-drawing .ice{stroke-width:.6;stroke-dasharray:4 3}`,
    `.glacial-drawing .margin{stroke-width:1.1}.glacial-drawing .river{stroke-width:1.5}`,
    `.glacial-drawing .strata path{stroke-width:.5;stroke-dasharray:5 3}.glacial-drawing .tree{stroke-width:.7;fill:#fff0}`,
    `.glacial-drawing .flow{stroke-width:1}.glacial-drawing .leader{stroke-width:.6}`,
    `.glacial-drawing text{font:italic 25px Georgia,serif;fill:${INK};stroke:#FAF8F2;stroke-width:6px;paint-order:stroke;stroke-linejoin:round}`,
    `</style>`,
    `<g class="glacial-drawing-lines">${paths.join("")}</g>`,
    `<g class="glacial-drawing-labels">${labels.join("")}</g>`,
    `</svg>`,
  ].join("");
}

function pathOf(points: P2[]): string {
  return `<path d="M${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}"/>`;
}
