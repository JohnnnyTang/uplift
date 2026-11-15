/**
 * The words lesson 2's scene renders (D-W7-7D). Session 7E writes the lesson copy in
 * `uplift/spreads/tectonics.plate-boundaries/` and session 7F passes it in; until then the scene shows the
 * placeholder below, which says on the page that it is a placeholder. Every text has a school (`hs`) and a
 * university (`uni`) version; the level toggle swaps words only, never the scene.
 *
 * Page and model agree: no copy types a figure. Bindings such as `{{probe.surfaceExaggeration}}` render
 * through the spread's probes, which the scene serves from its config (D-W7-7D, "Bindings served").
 */
import type { PlateBoundary } from "./relief/index";

/** Features of Fig. 2 a leader label can point at. */
export type PlatesDrawingFeature = "plate" | "plate-boundary" | "rock-layers" | "crust" | "mantle";

export interface LevelText {
  readonly hs: string;
  readonly uni: string;
}

export interface PlatesSceneCopy {
  /** Shown as "Lesson N". */
  readonly lessonNumber: number;
  readonly title: LevelText;
  readonly runningHeads: { readonly text: LevelText; readonly figure: LevelText };
  /** Blank-line paragraphs; `**bold**` runs; bindings allowed. */
  readonly body: LevelText;
  readonly keyWords: readonly { readonly term: LevelText; readonly definition: LevelText }[];
  /** The optional prediction; null for none. */
  readonly predict: { readonly question: LevelText; readonly options: readonly LevelText[] } | null;
  readonly flap: { readonly summary: LevelText; readonly answer: LevelText };
  /** The page's one label line (guardrail): "Illustration: shapes drawn from real examples". */
  readonly labelLine: LevelText;
  readonly figure: {
    readonly number: number;
    readonly caption: LevelText;
    /** Text alternative of the flat drawing (Fig. 2), the static fallback. */
    readonly drawingAlternative: LevelText;
    /** Scale line under the figure; bindings for the two display scales. */
    readonly scale: LevelText;
    /** Leader-line words on the drawing (words only); default: plate boundary, crust, mantle. */
    readonly labels?: readonly { readonly feature: PlatesDrawingFeature; readonly text: LevelText }[];
  };
  readonly boundaries: Readonly<
    Record<
      PlateBoundary,
      {
        readonly name: LevelText;
        /** One line: how the plates move, shown as the option's help and in the text alternative. */
        readonly help: LevelText;
      }
    >
  >;
  readonly controls: {
    readonly pickerLegend: LevelText;
    readonly noBoundary: LevelText;
    /** The stage word at the shared starting landscape (stage 0). */
    readonly start: LevelText;
    readonly stageLegend: LevelText;
    readonly early: LevelText;
    readonly middle: LevelText;
    readonly late: LevelText;
    readonly play: LevelText;
    readonly pause: LevelText;
    readonly frontFace: LevelText;
    readonly reset: LevelText;
    readonly replay: LevelText;
    /** Names of the two on-block arrow handles. */
    readonly leftPlateArrow: LevelText;
    readonly rightPlateArrow: LevelText;
    /** How to use the arrows, by pointer and by keyboard (the handles' description). */
    readonly arrowHelp: LevelText;
    /** Before a boundary is chosen: invites the first gesture. */
    readonly invite: LevelText;
    /** Heading of the ghost key. */
    readonly ghostsLegend: LevelText;
  };
  /**
   * Text-alternative templates (7E), rendered through the bindings: the starting landscape, and one per
   * boundary after the start. Absent: the scene's own draft sentences (`words.ts`). The front-face position
   * and the ghost lines are always described by the scene.
   */
  readonly textAlternatives?: {
    readonly start: LevelText;
    readonly boundary: Readonly<Record<PlateBoundary, LevelText>>;
  };
  /** "What this shows / ignores" (fuller limits behind the one label line). */
  readonly showsIgnores: { readonly shows: readonly LevelText[]; readonly ignores: readonly LevelText[] };
  /** University level only; bindings allowed. */
  readonly deeper: string;
  readonly teacherNotes: string;
  readonly sources: readonly { readonly citation: string; readonly url?: string }[];
}

const both = (text: string): LevelText => ({ hs: text, uni: text });

/**
 * Placeholder words, so the scene can be built and tested before 7E's copy lands. Drafted from the 7A claim
 * register (`docs/science/plates/claims.md`, PC2, PC3, PC10, PC14); 7E replaces every line.
 * <!-- expert-review -->
 */
export const PLATES_PLACEHOLDER_COPY: PlatesSceneCopy = Object.freeze({
  lessonNumber: 2,
  title: both("Where plates meet"),
  runningHeads: { text: both("Where plates meet"), figure: both("Plate boundaries") },
  body: both(
    "_Placeholder words until the lesson copy lands (session 7E)._\n\n" +
      "Earth's outer shell is broken into plates that move slowly. Where two plates meet is a **plate boundary**.\n\n" +
      "Choose how the two plates move, then play the stages from early to late.",
  ),
  keyWords: [
    { term: both("plate boundary"), definition: both("Where two plates meet.") },
    { term: both("convergent"), definition: both("The plates move towards each other.") },
    { term: both("divergent"), definition: both("The plates move apart.") },
    { term: both("transform"), definition: both("The plates slide past each other.") },
    { term: both("crust"), definition: both("The rocky outer layer, drawn as a band on the front face.") },
  ],
  predict: null,
  flap: {
    summary: both("Lift the flap"),
    answer: both("Placeholder: the explanation is written by session 7E."),
  },
  labelLine: both("Illustration: shapes drawn from real examples"),
  figure: {
    number: 2,
    caption: both(
      "Two continental plates meet along a boundary that runs from the back of the block to the front.",
    ),
    drawingAlternative: both(
      "Line drawing of a block of land cut open at the front. A dashed boundary runs from the back of the block " +
        "to the front, with one plate on each side and an arrow on each plate. Low ridges and stream valleys cross " +
        "the boundary. The front face shows flat rock layers over a band of crust of even thickness.",
    ),
    scale: both(
      "Heights and rock layers ×{{probe.surfaceVerticalExaggeration}}; crust depths ×{{probe.crustVerticalExaggeration}}",
    ),
  },
  boundaries: {
    convergent: { name: both("Convergent"), help: both("The plates move towards each other.") },
    divergent: { name: both("Divergent"), help: both("The plates move apart.") },
    transform: { name: both("Transform"), help: both("The plates slide past each other.") },
  },
  controls: {
    pickerLegend: both("How the plates move"),
    noBoundary: both("No boundary chosen"),
    start: both("starting"),
    stageLegend: both("Stage"),
    early: both("early"),
    middle: both("middle"),
    late: both("late"),
    play: both("Play"),
    pause: both("Pause"),
    frontFace: both("Front face"),
    reset: both("Start again"),
    replay: both("Replay the drawing"),
    leftPlateArrow: both("Left plate's arrow"),
    rightPlateArrow: both("Right plate's arrow"),
    arrowHelp: both(
      "Drag a plate's arrow towards the boundary, away from it or along it. With the arrow focused, use the arrow keys.",
    ),
    invite: both("Drag a plate's arrow on the block, or choose below."),
    ghostsLegend: both("Viewed before, at this stage:"),
  },
  showsIgnores: {
    shows: [both("Placeholder: what the illustration shows (session 7E).")],
    ignores: [
      both(
        "The shapes are drawn, not simulated. Nothing forms in the scene, and the stage slider is not a clock.",
      ),
    ],
  },
  deeper: "Placeholder: the university level is written by session 7E.",
  teacherNotes: "Placeholder: teacher notes are written by session 7E.",
  sources: [
    {
      citation:
        "Kious, W. J. & Tilling, R. I. (1996). This Dynamic Earth: The Story of Plate Tectonics. USGS.",
      url: "https://pubs.usgs.gov/gip/dynamic/dynamic.html",
    },
  ],
});
