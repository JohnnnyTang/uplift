/**
 * Small ink glyphs of lesson 2 (session 7D): the boundary glyphs of the picker, the ghost key and the ghost
 * labels (the non-colour cue that tells boundaries apart), and samples of the ghost lines' dash patterns.
 */
import type { PlateBoundary } from "./relief/index";

/** The picker glyph: a dashed boundary seen from above, with each plate's arrow (the non-colour cue). */
export function boundaryGlyphSvg(boundary: PlateBoundary): string {
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const h = (s: number) =>
      `${(x2 - 5 * Math.cos(ang + s)).toFixed(1)} ${(y2 - 5 * Math.sin(ang + s)).toFixed(1)}`;
    return `<path d="M${x1} ${y1}L${x2} ${y2}"/><path class="ps-glyph-head" d="M${x2} ${y2}L${h(0.55)}L${h(-0.55)}Z"/>`;
  };
  const body =
    boundary === "convergent"
      ? arrow(3, 14, 14, 14) + arrow(33, 14, 22, 14)
      : boundary === "divergent"
        ? arrow(14, 14, 3, 14) + arrow(22, 14, 33, 14)
        : arrow(9, 22, 9, 6) + arrow(27, 6, 27, 22);
  return `<svg class="ps-glyph" viewBox="0 0 36 28" aria-hidden="true"><path class="ps-glyph-boundary" d="M18 2V26"/>${body}</svg>`;
}

/** A sample of a ghost line's dash pattern, matching the diorama's (index 0 dotted, then dash-dot, dash-dot-dot). */
export function ghostSampleSvg(index: number): string {
  const dashes = ["1.2 2.6", "6 2.4 1.2 2.4", "6 2 1.2 2 1.2 2"][index] ?? "1.2 2.6";
  return `<svg class="ps-ghost-sample" viewBox="0 0 34 8" aria-hidden="true"><path class="ps-ghost-halo" d="M2 4H32"/><path class="ps-ghost-line" d="M2 4H32" stroke-dasharray="${dashes}"/></svg>`;
}
