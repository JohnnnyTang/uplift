/**
 * The flat page drawing: contours as SVG, projected with the shared projection at zero exaggeration. The
 * 3D view at zero exaggeration draws the same lines on the same pixels, so the page can crossfade from
 * this SVG to the canvas without a jump (T8, D-1C).
 */
import { type ContourSet, DRAW_MIN_SPACING_CELLS, drawnPoints } from "./contours";
import { INK_TOKENS } from "./palette";
import type { Projection } from "./projection";
import { projectToViewport } from "./projection";

export interface SvgOptions {
  /** The shared projection; the SVG uses its viewport as its size. */
  readonly projection: Projection;
  /** Accessible name of the drawing. The page supplies it as level text; no numbers belong here. */
  readonly title?: string;
  /** Longer text alternative, also supplied by the page. */
  readonly description?: string;
  /** Draw the edge of the sampled area (the map neatline). Default true. */
  readonly boundary?: boolean;
  /** Decimal places for coordinates (unit: CSS pixels). Default 2. */
  readonly decimals?: number;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Path data for a polyline in terrain metres, projected flat. */
function pathData(pointsM: Float64Array, closed: boolean, projection: Projection, decimals: number): string {
  let d = "";
  for (let i = 0; i < pointsM.length; i += 2) {
    const [px, py] = projectToViewport(projection, pointsM[i]!, pointsM[i + 1]!, 0, 0);
    d += `${i === 0 ? "M" : "L"}${px.toFixed(decimals)} ${py.toFixed(decimals)}`;
  }
  return closed ? `${d}Z` : d;
}

/** The sampled area's edge, as a closed ring in terrain metres. */
export function boundaryRingM(gridSize: number, metresPerCell: number): Float64Array {
  const lo = 0.5 * metresPerCell;
  const hi = (gridSize - 0.5) * metresPerCell;
  return Float64Array.from([lo, lo, hi, lo, hi, hi, lo, hi]);
}

/**
 * Renders a contour set as a standalone SVG string. Ordinary and index contours are separate groups with
 * the stroke widths from `INK_TOKENS`. No hachures and no quantity colour: the flat drawing is the
 * handoff state, and the page shows the legend separately.
 */
export function toSvg(contours: ContourSet, options: SvgOptions): string {
  const { projection } = options;
  const decimals = options.decimals ?? 2;
  const { widthPx, heightPx } = projection.viewport;
  if (
    projection.frame.gridSize !== contours.gridSize ||
    projection.frame.metresPerCell !== contours.metresPerCell
  ) {
    throw new Error("projection frame and contours come from different grids");
  }
  const minSpacingM = DRAW_MIN_SPACING_CELLS * contours.metresPerCell;
  const ordinary: string[] = [];
  const index: string[] = [];
  for (const line of contours.lines) {
    (line.index ? index : ordinary).push(
      `<path d="${pathData(drawnPoints(line, minSpacingM), line.closed, projection, decimals)}"/>`,
    );
  }
  const title = options.title ?? "Contour drawing";
  const head = `<title>${escapeXml(title)}</title>${
    options.description ? `<desc>${escapeXml(options.description)}</desc>` : ""
  }`;
  const parts: string[] = [];
  parts.push(
    `<g class="contours" stroke-width="${INK_TOKENS.contourWidthPx}">${ordinary.join("")}</g>`,
    `<g class="index-contours" stroke-width="${INK_TOKENS.indexContourWidthPx}">${index.join("")}</g>`,
  );
  if (options.boundary ?? true) {
    const ring = boundaryRingM(contours.gridSize, contours.metresPerCell);
    parts.push(
      `<path class="boundary" stroke-width="${INK_TOKENS.indexContourWidthPx}" d="${pathData(ring, true, projection, decimals)}"/>`,
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" ` +
    `height="${heightPx}" role="img" aria-label="${escapeXml(title)}">${head}` +
    `<g fill="none" stroke="${INK_TOKENS.ink}" stroke-linejoin="round" stroke-linecap="round">` +
    `${parts.join("")}</g></svg>`
  );
}
