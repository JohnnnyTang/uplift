/**
 * The crust band's look (session 7B, D-W7-7B): the crust and the mantle below it, seen in section on the
 * block's front face and in the section lens. Natural colours with a textbook pattern each, so the two read
 * apart without colour: small "v" ticks for the crust (the usual crystalline-basement mark) and sparse open
 * rings for the mantle. A solid ink line marks the crust base.
 *
 * A pattern is a list of marks in a unit tile (0–1 on both axes, y down, tiling seamlessly). The same tile
 * renders to a 2D canvas (the 3D face texture) and to an SVG `<pattern>` (the section lens), so the page and
 * the scene show the identical mark. Fixed, hand-placed marks: no randomness. Pure: no three.js, so the
 * section lens can use it without loading the 3D scene.
 */

/** One layer's look: fill colour and pattern mark colour (sRGB hex; marks darker than the fill). */
export interface CrustLayerLook {
  readonly colour: string;
  readonly markColour: string;
}

export interface CrustBandLook {
  readonly crust: CrustLayerLook;
  readonly mantle: CrustLayerLook;
  /** The crust-base line (sRGB hex). */
  readonly baseLine: string;
}

/**
 * Default look: a warm, pale granitic buff for continental crust over a darker olive for the mantle
 * (peridotite). The lightness step (about 15 L*) and the patterns carry the distinction for readers who do
 * not see the hue difference; the ink line at the crust base carries it in monochrome.
 */
export const CRUST_BAND_LOOK: CrustBandLook = Object.freeze({
  crust: Object.freeze({ colour: "#D9BCA4", markColour: "#7E5B49" }),
  mantle: Object.freeze({ colour: "#9AA27C", markColour: "#3B4430" }),
  baseLine: "#292B2C",
});

export type CrustLayer = "crust" | "mantle";

/** A polyline (`points` = x0, y0, x1, y1, …) or an open ring (centre and radius). Tile units. */
export type CrustMark =
  | { readonly kind: "line"; readonly points: readonly number[] }
  | { readonly kind: "ring"; readonly x: number; readonly y: number; readonly r: number };

/** Staggered "v" ticks; sites on the tile edge are repeated on the opposite edge so the tile wraps. */
const V_SITES: readonly (readonly [number, number])[] = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0, 0.75],
  [0.5, 0.75],
  [1, 0.75],
];
const RING_SITES: readonly (readonly [number, number])[] = [
  [0.22, 0.3],
  [0.72, 0.18],
  [0.47, 0.72],
  [0.9, 0.62],
];

/** The marks of one layer's pattern tile. */
export function crustPatternMarks(layer: CrustLayer): CrustMark[] {
  if (layer === "crust") {
    const w = 0.08;
    const h = 0.07;
    return V_SITES.map(([x, y]) => ({ kind: "line", points: [x - w, y - h, x, y + h, x + w, y - h] }));
  }
  return RING_SITES.map(([x, y]) => ({ kind: "ring", x, y, r: 0.06 }));
}

/** Minimal 2D context surface used to paint a tile (a CanvasRenderingContext2D satisfies it). */
export interface CrustPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
}

/** Paints one tile of a layer's pattern at `sizePx`. Seamless when repeated. */
export function paintCrustTile(
  ctx: CrustPainter,
  layer: CrustLayer,
  look: CrustLayerLook,
  sizePx: number,
  markWidthPx = sizePx / 28,
): void {
  const n = sizePx;
  ctx.fillStyle = look.colour;
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = look.markColour;
  ctx.lineWidth = markWidthPx;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const mark of crustPatternMarks(layer)) {
    ctx.beginPath();
    if (mark.kind === "ring") {
      ctx.moveTo((mark.x + mark.r) * n, mark.y * n);
      ctx.arc(mark.x * n, mark.y * n, mark.r * n, 0, Math.PI * 2);
    } else {
      const p = mark.points;
      ctx.moveTo(p[0]! * n, p[1]! * n);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i]! * n, p[i + 1]! * n);
    }
    ctx.stroke();
  }
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/**
 * An SVG `<pattern>` element (as markup) for one layer, `sizePx` user units per tile. Use it inside
 * `<defs>` and fill with `url(#id)`.
 */
export function crustPatternSvg(layer: CrustLayer, look: CrustLayerLook, id: string, sizePx = 14): string {
  const n = sizePx;
  const w = (n / 14).toFixed(2);
  const stroke = `fill="none" stroke="${look.markColour}" stroke-width="${w}"`;
  const marks = crustPatternMarks(layer)
    .map((mark) => {
      if (mark.kind === "ring")
        return `<circle cx="${fmt(mark.x * n)}" cy="${fmt(mark.y * n)}" r="${fmt(mark.r * n)}" ${stroke}/>`;
      const pts: string[] = [];
      for (let i = 0; i < mark.points.length; i += 2)
        pts.push(`${fmt(mark.points[i]! * n)},${fmt(mark.points[i + 1]! * n)}`);
      return `<polyline points="${pts.join(" ")}" ${stroke} stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<pattern id="${id}" width="${n}" height="${n}" patternUnits="userSpaceOnUse"><rect width="${n}" height="${n}" fill="${look.colour}"/>${marks}</pattern>`;
}
