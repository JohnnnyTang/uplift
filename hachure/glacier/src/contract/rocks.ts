/**
 * Rock types: the reader's one condition in "From V to U".
 *
 * A rock type applies to a whole run (owner decision 5): it is fixed in the run's config and never changes
 * under a moving glacier. Each type sets two relative properties of the bed:
 *
 * - `relativeErodibility` scales the glacial erosion rate (Hallet 1979; Harbor 1992 used erodibility as the
 *   resistance term). Unitless, relative to sandstone = 1.
 * - `criticalWallSlopeDeg` is the steepest wall the rock mass holds before it fails onto the slope below
 *   (threshold hillslope; rock-mass strength controls glacial trough wall form, Augustinus 1992, 1995).
 *
 * The values are TEACHING CHOICES with a documented ordering, not measured constants. Their source basis and
 * limits are in docs/science/glacial/rock-types.md. <!-- expert-review -->
 */

/** Stable rock identifiers. Presentation (colour, lithology pattern, display name) belongs to Ink and the book. */
export const ROCK_IDS = ["shale", "sandstone", "granite"] as const;
export type RockId = (typeof ROCK_IDS)[number];

export interface RockType {
  readonly id: RockId;
  /** Plain-language name for page text and alternatives. Final wording is a 5L/R1 decision. */
  readonly plainName: string;
  /** Relative hardness class in plain words. */
  readonly hardness: "soft" | "medium" | "hard";
  /** Glacial erosion multiplier (unit: none; sandstone = 1). */
  readonly relativeErodibility: number;
  /** Steepest stable wall slope of the rock mass (unit: degrees from horizontal). */
  readonly criticalWallSlopeDeg: number;
  /** One-line source basis; the full note is docs/science/glacial/rock-types.md. */
  readonly sourceBasis: string;
}

export const ROCK_TYPES: Readonly<Record<RockId, RockType>> = Object.freeze({
  shale: Object.freeze({
    id: "shale",
    plainName: "shale",
    hardness: "soft",
    relativeErodibility: 2,
    criticalWallSlopeDeg: 34,
    sourceBasis:
      "Weak, closely jointed rock mass: low rock-mass strength, gentle stable slopes (Selby 1980; Augustinus 1992).",
  }),
  sandstone: Object.freeze({
    id: "sandstone",
    plainName: "sandstone",
    hardness: "medium",
    relativeErodibility: 1,
    criticalWallSlopeDeg: 42,
    sourceBasis: "Moderately strong, bedded rock mass: intermediate strength and slopes (Selby 1980).",
  }),
  granite: Object.freeze({
    id: "granite",
    plainName: "granite",
    hardness: "hard",
    relativeErodibility: 0.4,
    criticalWallSlopeDeg: 55,
    sourceBasis:
      "Massive, widely jointed crystalline rock: high rock-mass strength, steep stable walls (Selby 1980; Augustinus 1992, 1995).",
  }),
});

export function isRockId(value: unknown): value is RockId {
  return typeof value === "string" && (ROCK_IDS as readonly string[]).includes(value);
}
