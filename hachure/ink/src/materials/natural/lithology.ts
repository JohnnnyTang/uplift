/**
 * Textbook lithology patterns: the non-colour cue that tells rock types apart (GV6). The conventions follow
 * the USGS/FGDC geologic map symbolisation standard in spirit (brick for limestone, crosses for granite,
 * short dashes for shale, stipple for sandstone, wavy lines for schist), drawn as simple ink marks.
 *
 * A pattern is a list of marks in a unit tile (0–1 on both axes, y down, tiling seamlessly). The same tile
 * renders to a 2D canvas (the 3D block's side texture) and to an SVG `<pattern>` (page swatches and the
 * specimen tray), so the page and the scene show the identical mark.
 *
 * Source: Federal Geographic Data Committee (2006), _FGDC Digital Cartographic Standard for Geologic Map
 * Symbolization_, FGDC-STD-013-2006, section 37 (lithologic patterns).
 */
import { NATURAL_TOKENS } from "./palette";

export type LithologyPatternKind = "brick" | "crosses" | "dashes" | "stipple" | "wavy";

/** One mark: a polyline (`points` = x0, y0, x1, y1, …) or a dot (`dot` = x, y, radius). Tile units. */
export type PatternMark =
  | { readonly kind: "line"; readonly points: readonly number[] }
  | { readonly kind: "dot"; readonly x: number; readonly y: number; readonly r: number };

export interface LithologyLook {
  /** Matches the model's rock id. */
  readonly id: number;
  /** Stable key for DOM ids and tests. */
  readonly key: string;
  /** Reader-facing name. Supplied by the model's rock table; the default set is provisional. */
  readonly name: string;
  /** Lit rock colour (sRGB hex). */
  readonly colour: string;
  /** Pattern mark colour (sRGB hex); darker than `colour`. */
  readonly markColour: string;
  readonly pattern: LithologyPatternKind;
}

/**
 * Provisional look set for development and the R1 review. The rock set, names and number of types are a
 * 5G model decision; R1 approves the look. Replace these entries, do not add model meaning to them.
 */
export const PROVISIONAL_LITHOLOGIES: readonly LithologyLook[] = Object.freeze([
  {
    id: 0,
    key: "granite",
    name: "Granite",
    colour: "#C7B9AE",
    markColour: "#6E5A55",
    pattern: "crosses",
  },
  {
    id: 1,
    key: "limestone",
    name: "Limestone",
    colour: "#D6D0B4",
    markColour: "#77704F",
    pattern: "brick",
  },
  {
    id: 2,
    key: "shale",
    name: "Shale",
    colour: "#8E9597",
    markColour: "#3F4648",
    pattern: "dashes",
  },
]);

/** Fixed, hand-placed positions so the tile is identical on every run (no randomness). */
const CROSS_SITES: readonly (readonly [number, number])[] = [
  [0.12, 0.18],
  [0.58, 0.1],
  [0.36, 0.42],
  [0.84, 0.38],
  [0.1, 0.7],
  [0.62, 0.66],
  [0.34, 0.9],
  [0.86, 0.88],
];
const STIPPLE_SITES: readonly (readonly [number, number])[] = [
  [0.08, 0.1],
  [0.41, 0.06],
  [0.73, 0.16],
  [0.22, 0.34],
  [0.56, 0.3],
  [0.9, 0.44],
  [0.1, 0.58],
  [0.44, 0.55],
  [0.7, 0.7],
  [0.28, 0.8],
  [0.6, 0.92],
  [0.92, 0.84],
];

/** The marks of one pattern tile. Lines crossing the tile edge are repeated so the tile wraps. */
export function patternMarks(kind: LithologyPatternKind): PatternMark[] {
  const line = (...points: number[]): PatternMark => ({ kind: "line", points });
  switch (kind) {
    case "brick":
      // Two courses of bricks; the second course offset by half a brick.
      return [
        line(0, 0, 1, 0),
        line(0, 0.5, 1, 0.5),
        line(0, 1, 1, 1),
        line(0.5, 0, 0.5, 0.5),
        line(0, 0.5, 0, 1),
        line(1, 0.5, 1, 1),
      ];
    case "crosses": {
      const s = 0.085;
      return CROSS_SITES.flatMap(([x, y]) => [line(x - s, y, x + s, y), line(x, y - s, x, y + s)]);
    }
    case "dashes":
      return [
        line(0.05, 0.2, 0.4, 0.2),
        line(0.6, 0.2, 0.95, 0.2),
        line(-0.15, 0.45, 0.2, 0.45),
        line(0.35, 0.45, 0.7, 0.45),
        line(0.85, 0.45, 1.2, 0.45),
        line(0.05, 0.7, 0.4, 0.7),
        line(0.6, 0.7, 0.95, 0.7),
        line(-0.15, 0.95, 0.2, 0.95),
        line(0.35, 0.95, 0.7, 0.95),
        line(0.85, 0.95, 1.2, 0.95),
      ];
    case "stipple":
      return STIPPLE_SITES.map(([x, y]) => ({ kind: "dot", x, y, r: 0.025 }));
    case "wavy": {
      const wave = (y: number) => {
        const points: number[] = [];
        for (let i = 0; i <= 16; i++) {
          const x = i / 16;
          points.push(x, y + 0.06 * Math.sin(x * Math.PI * 2));
        }
        return line(...points);
      };
      return [wave(0.25), wave(0.75)];
    }
  }
}

/** Minimal 2D context surface used to paint a tile (a CanvasRenderingContext2D satisfies it). */
export interface PatternPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
  fill(): void;
}

export interface TileOptions {
  /** Tile edge (unit: pixels). */
  readonly sizePx: number;
  /** Mark stroke width (unit: pixels). Default sizePx / 40. */
  readonly markWidthPx?: number;
  /** Bedding bands: alternate lighter and darker horizontal bands across the tile. Default false. */
  readonly bedding?: boolean;
}

/** Paints one tile of a rock's pattern at `sizePx`. Seamless when repeated. */
export function paintLithologyTile(ctx: PatternPainter, look: LithologyLook, options: TileOptions): void {
  const n = options.sizePx;
  ctx.fillStyle = look.colour;
  ctx.fillRect(0, 0, n, n);
  if (options.bedding) {
    // A slightly darker band in the lower half of each tile: reads as bedding without a gradient.
    ctx.fillStyle = mixHex(look.colour, look.markColour, 0.12);
    ctx.fillRect(0, n * 0.5, n, n * 0.5);
  }
  ctx.strokeStyle = look.markColour;
  ctx.fillStyle = look.markColour;
  ctx.lineWidth = options.markWidthPx ?? n / 40;
  ctx.lineCap = "round";
  for (const mark of patternMarks(look.pattern)) {
    ctx.beginPath();
    if (mark.kind === "dot") {
      ctx.arc(mark.x * n, mark.y * n, mark.r * n, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const p = mark.points;
    ctx.moveTo(p[0]! * n, p[1]! * n);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i]! * n, p[i + 1]! * n);
    ctx.stroke();
  }
}

/**
 * An SVG `<pattern>` element (as markup) for a rock, `sizePx` user units per tile. Use it inside `<defs>`
 * and fill with `url(#id)`.
 */
export function lithologyPatternSvg(look: LithologyLook, id: string, sizePx = 14): string {
  const n = sizePx;
  const w = (n / 14).toFixed(2);
  const marks = patternMarks(look.pattern)
    .map((mark) => {
      if (mark.kind === "dot")
        return `<circle cx="${fmt(mark.x * n)}" cy="${fmt(mark.y * n)}" r="${fmt(mark.r * n * 1.4)}" fill="${look.markColour}"/>`;
      const pts: string[] = [];
      for (let i = 0; i < mark.points.length; i += 2)
        pts.push(`${fmt(mark.points[i]! * n)},${fmt(mark.points[i + 1]! * n)}`);
      return `<polyline points="${pts.join(" ")}" fill="none" stroke="${look.markColour}" stroke-width="${w}" stroke-linecap="round"/>`;
    })
    .join("");
  return `<pattern id="${id}" width="${n}" height="${n}" patternUnits="userSpaceOnUse"><rect width="${n}" height="${n}" fill="${look.colour}"/>${marks}</pattern>`;
}

/** Looks up a rock's look by id; falls back to the first entry so the scene always draws something. */
export function lithologyById(set: readonly LithologyLook[], id: number): LithologyLook {
  return set.find((look) => look.id === id) ?? set[0]!;
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** Mixes two sRGB hex colours (unit: none, t = 0 gives `a`). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Soil colour used in the thin band at the top of the block sides. */
export const SOIL_COLOUR = NATURAL_TOKENS.soil;
