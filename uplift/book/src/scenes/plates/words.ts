/**
 * The scene's own words (session 7D): stage words and the live text alternative that describes the current
 * boundary, stage and front-face profile, and the ghost profiles drawn beside it. Draft wording from the 7A
 * claim register (PC3, PC6, PC10, PC14, PC16) and 7C's review words; 7E may replace them.
 * <!-- expert-review -->
 *
 * Every sentence says what the illustration shows, never that anything forms, is computed or is simulated
 * (D-L2-1, NT1), and none carries a figure (NT5).
 */
import type { LevelText, PlatesSceneCopy } from "./copy";
import type { PlateBoundary } from "./relief/index";

export type StageWord = "early" | "middle" | "late";

/** Early below a third of the way, late from two thirds (the reduced-motion stops 0, ¼ | ½ | ¾, 1). */
export function stageWord(stage: number): StageWord {
  return stage < 1 / 3 ? "early" : stage < 2 / 3 ? "middle" : "late";
}

/** Where the front face stands along the boundary (cut fraction from the back of the block). */
export function cutWords(fraction: number): string {
  return fraction > 0.85
    ? "at the front of the block"
    : fraction > 0.4
      ? "about halfway along the block"
      : "near the back of the block";
}

const START =
  "The starting landscape, the same for every boundary: rolling lowland with low ridges and stream valleys " +
  "that cross the boundary. On the front face, flat rock layers lie over a band of crust of even thickness, " +
  "with the mantle below.";

/** The front-face and surface sentence for one boundary at one stage (> 0). */
function boundarySentence(boundary: PlateBoundary, word: StageWord): string {
  const late = word === "late";
  const early = word === "early";
  switch (boundary) {
    case "convergent":
      return (
        `${early ? "A low range is rising" : late ? "A high mountain range stands" : "A mountain range is rising"} along the boundary` +
        `${late ? ", with snow on its highest ground" : ""}. ` +
        `On the front face the rock layers bend up under the range and the crust thickens into a ${early ? "shallow" : "deep"} root, ` +
        "reaching much deeper than the range stands high."
      );
    case "divergent":
      return (
        `The land ${early ? "begins to sink" : late ? "has sunk" : "is sinking"} into a rift valley between stepped fault scarps, ` +
        `and the shoulders on either side rise a little${late ? "; lakes lie on the rift floor" : ""}. ` +
        "On the front face the rock layers drop down at each fault and the crust thins beneath the rift."
      );
    case "transform":
      return (
        `The ridges and streams that cross the boundary are ${early ? "slightly" : late ? "clearly" : ""} offset sideways along a straight fault: ` +
        "looking across the boundary, the far side has moved to the right. The land is not raised or lowered, " +
        "and on the front face the rock layers and the crust are unchanged."
      ).replace("  ", " ");
  }
}

/** How a ghost profile compares with the shown one, in a few words. */
function comparison(shown: PlateBoundary | null, ghost: PlateBoundary): string {
  const shape: Record<PlateBoundary, string> = {
    convergent: "rises into a range with a deep root",
    divergent: "sinks into a rift over thinner crust",
    transform: "keeps the starting height and crust",
  };
  return shown === ghost ? "" : shape[ghost];
}

export interface DescribeInput {
  readonly boundary: PlateBoundary | null;
  readonly stage: number;
  readonly cutFraction: number;
  /** Ghost boundaries in drawing order (index 0 dotted, 1 dash-dot, 2 dash-dot-dot). */
  readonly ghosts: readonly PlateBoundary[];
  readonly copy: PlatesSceneCopy;
  readonly level: "hs" | "uni";
}

/** Names of the ghost patterns, in the diorama's order (MAX_GHOSTS = 3). */
export const GHOST_PATTERN_WORDS = ["dotted", "dash-dot", "dash-dot-dot"] as const;

/** The live text alternative of the block (the key visual change), in plain sentences. */
export function describeScene(i: DescribeInput): string {
  const t = (x: LevelText) => x[i.level];
  const parts: string[] = [];
  const word = stageWord(i.stage);
  if (!i.boundary) parts.push(`${t(i.copy.controls.noBoundary)}. ${START}`);
  else {
    const b = i.copy.boundaries[i.boundary];
    parts.push(`${t(b.name)} boundary, ${t(i.copy.controls[word])} stage. ${t(b.help)}`);
    parts.push(i.stage === 0 ? START : boundarySentence(i.boundary, word));
  }
  parts.push(`The front face stands ${cutWords(i.cutFraction)}.`);
  if (i.ghosts.length && i.stage === 0) {
    parts.push(
      "At the start the profiles of the boundaries already viewed match this one: every boundary starts the same.",
    );
    return parts.join(" ");
  }
  i.ghosts.forEach((g, k) => {
    const what = comparison(i.boundary, g);
    if (!what) return;
    parts.push(
      `The ${GHOST_PATTERN_WORDS[k] ?? "dotted"} line on the front face is the ${t(i.copy.boundaries[g].name).toLowerCase()} profile at the same stage: there the land ${what}.`,
    );
  });
  return parts.join(" ");
}
