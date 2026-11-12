/**
 * Bound words for the glacial scene (session 5K): margin-note numbers, the overdeepening note slot and the text
 * alternative that describes the current profile. Every number comes from the model's section reading
 * (`ReviewSection`, averaged over three columns) or the run; nothing is typed. Session 5L owns the final
 * lesson words; the phrases here are draft layout copy.
 *
 * <!-- expert-review -->
 * Shape words read the registered shape exponent b (acceptance protocol: V ≈ 1, U ≈ 2 or more; Svensson 1959;
 * Harbor 1992) against the midpoint of those two anchors. The overdeepening sentence is 5L's (source to
 * verify, 5L: Cook & Swift 2012, Earth-Science Reviews 115).
 */
import type { ReviewOverdeepening, ReviewSection } from "./runs";

/** Display rounding of a model length: to 10 m (the grid is coarser than that). */
export const metres = (m: number) => `${Math.round(m / 10) * 10} m`;
export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
export const degrees = (d: number) => `${Math.round(d)}°`;

/** Midpoint of the protocol's shape anchors (V ≈ 1, U ≈ 2; unit: none). */
export const SHAPE_MIDPOINT = (1 + 2) / 2;

/** "closer to a U" / "closer to a V", from the model's shape fit; null when it could not be fitted. */
export function shapeWords(b: number): string | null {
  if (!Number.isFinite(b)) return null;
  return b >= SHAPE_MIDPOINT ? "closer to a U than a V" : "closer to a V than a U";
}

/**
 * The overdeepening note (D-W5-R1 item 5): shown only when the model says the floor under the front face is
 * worn below the floor further down the valley (`measureOverdeepening` on the three-column floor), never by
 * column. Words: session 5L's (PR #34), expert-review; 5M takes them from the spread.
 */
export const OVERDEEPENING_NOTE =
  "The ice has worn the floor here lower than the floor further down: a basin, called an overdeepening.";

export function overdeepeningNote(o: ReviewOverdeepening | null): string | null {
  return o?.overdeepened ? OVERDEEPENING_NOTE : null;
}

export interface ProfileDescriptionInput {
  /** Where the front face is: "4.3 km down the valley". */
  readonly where: string;
  readonly throughIce: boolean;
  readonly iceShown: boolean;
  readonly rockName: string;
  /** "300 model years", or null for timeless frames. */
  readonly when: string | null;
  readonly section: ReviewSection | null;
  readonly kept: {
    readonly rockName: string;
    readonly when: string;
    readonly section: ReviewSection | null;
  } | null;
  readonly overdeepening: string | null;
}

/** The live text alternative of Fig. 1: what the front face shows now, in words, with bound numbers. */
export function describeProfile(d: ProfileDescriptionInput): string {
  const parts: string[] = [];
  parts.push(
    `The front face of the block, ${d.where}, is cut ${d.throughIce ? "through the glacier" : "below the glacier's snout"}` +
      (d.iceShown ? "." : "; the ice is hidden to show the rock under it."),
  );
  const s = d.section;
  if (s) {
    const shape = shapeWords(s.shapeExponent);
    if (shape)
      parts.push(
        `In ${d.rockName.toLowerCase()}${d.when ? `, after ${d.when}` : ""}, its cross-section is ${shape} (shape ${s.shapeExponent.toFixed(1)}; a V is about 1, a U about 2).`,
      );
    parts.push(
      `The floor is ${metres(s.floorWidthM)} wide and ${metres(s.depthM)} deep, lowered ${metres(s.floorLoweredM)} below the dashed starting V; the steepest wall is ${Math.round(s.steepestWallDeg)} degrees.`,
    );
  }
  if (d.kept?.section)
    parts.push(
      `The dotted line is the kept ${d.kept.rockName.toLowerCase()} run at ${d.kept.when}: floor lowered ${metres(d.kept.section.floorLoweredM)}, steepest wall ${Math.round(d.kept.section.steepestWallDeg)} degrees.`,
    );
  if (d.overdeepening) parts.push(d.overdeepening);
  return parts.join(" ");
}
