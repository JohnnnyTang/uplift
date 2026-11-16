/**
 * <!-- expert-review -->
 * The editorial pieces of "Where plates meet" that are not running prose: lesson and figure numbers (data,
 * so the shell composes "Lesson 2" and "Fig. 2"; text never carries them), the title, key words, the
 * optional prediction, the boundary names, glyphs and help, the stage words, the words around the controls,
 * the caption, the one label line, Fig. 2 label words, text-alternative templates and the disclosure
 * ("What this illustration shows and leaves out").
 *
 * The scene is an illustration (D-L2-1): no text here says or implies that a landform forms, is computed or
 * is simulated in the scene, and none carries a time. Every number is a binding (bindings.ts); every claim
 * is registered in claims.ts, named per text group in `textClaims`.
 */
import type { KeyWord, LevelText, PageSpec, PredictSpec } from "@hachure/runtime";

const both = (text: string): LevelText => ({ hs: text, uni: text });

/** Structural numbering, composed by the shell ("Lesson" + number, "Fig." + number). Not scene values. */
export const LESSON_NUMBER = 2;
export const FIGURE_NUMBER = 2;

/** Final title (the plan's working title, kept: short, concrete and parallel to "From V to U"). */
export const title = both("Where plates meet");

export const runningHeads = {
  /** Left page, after "Lesson <number> · ". */
  text: both("Plate tectonics"),
  /** Right page. */
  figure: both("Plate boundaries shape the land"),
} as const;

export const keyWords = [
  {
    term: both("plate"),
    definition: {
      hs: "one of the huge pieces of Earth's outer shell, moving slowly",
      uni: "a large piece of the lithosphere, moving slowly relative to its neighbours",
    },
  },
  {
    term: both("plate boundary"),
    definition: {
      hs: "the place where two plates meet",
      uni: "where two plates meet: in reality a zone of many faults, not one line",
    },
  },
  {
    term: both("convergent"),
    definition: {
      hs: "a boundary where plates move towards each other",
      uni: "plates moving together; between continents, collision thickens the crust",
    },
  },
  {
    term: both("divergent"),
    definition: {
      hs: "a boundary where plates move apart",
      uni: "plates moving apart; a stretched continent breaks into a faulted rift valley",
    },
  },
  {
    term: both("transform"),
    definition: {
      hs: "a boundary where plates slide past each other",
      uni: "plates sliding past each other; crust is neither made nor destroyed",
    },
  },
  {
    term: both("crust"),
    definition: {
      hs: "the outermost layer of rock, thickest under high mountains",
      uni: "the outermost rock layer, above the denser mantle; its base is the Moho",
    },
  },
] as const satisfies readonly KeyWord[];

/**
 * Optional prediction about the real Earth, answered under the flap. Index 0 is backed by the cited claims
 * PC6 (school) and PC9 (university) in 7A's register, and the front face shows the thicker crust. It never
 * gates play, the flap or navigation.
 */
export const predict = {
  question: {
    hs: "When two continents push together, what happens to the crust under the mountains?",
    uni: "Under a high collision range, how deep does the crust's root reach?",
  },
  options: [
    { hs: "It gets thicker", uni: "Several times the range's height" },
    { hs: "It gets thinner", uni: "About the range's height" },
    { hs: "It stays the same", uni: "No deeper: a flat base" },
  ],
  answer: 0,
  answerEvidence: "docs/science/plates/claims.md#PC6 (school), #PC9 (university)",
} as const satisfies PredictSpec;

export type BoundaryId = "convergent" | "divergent" | "transform";

/**
 * The three boundaries in picker order (the same order as 7C's `PLATE_BOUNDARIES`). `glyph` is the arrow
 * pair drawn on the picker, the ghost labels and the plate arrows; `glyphLabel` is its spoken form. The host
 * serves `name` as `{{probe.boundaryName}}`. Patterns and colours that back up the glyphs are 7D's.
 */
export const boundaries = [
  {
    id: "convergent",
    name: both("Convergent"),
    glyph: "→ ←",
    glyphLabel: both("arrows pointing towards each other"),
    motion: both("The plates move towards each other."),
    help: {
      hs: "Two continents collide. Neither sinks: the crust crumples and is pushed up into mountains, with a deep root below.",
      uni: "Continental collision: light crust resists sinking, so it buckles and thickens into a high range above a deep root.",
    },
    example: both("Shapes drawn from the Himalaya and Tibet."),
  },
  {
    id: "divergent",
    name: both("Divergent"),
    glyph: "← →",
    glyphLabel: both("arrows pointing away from each other"),
    motion: both("The plates move apart."),
    help: {
      hs: "A continent is stretched. The crust cracks along faults, and blocks of land drop down between them into a rift valley.",
      uni: "Continental rifting: stretched crust breaks along normal faults, blocks drop into a rift valley, and the crust beneath it is thinner.",
    },
    example: both("Shapes drawn from the East African Rift."),
  },
  {
    id: "transform",
    name: both("Transform"),
    glyph: "⇅",
    glyphLabel: both("arrows pointing opposite ways along the boundary"),
    motion: both("The plates slide past each other."),
    help: {
      hs: "The land is not raised or lowered, only moved sideways, so ridges and streams that cross the boundary are offset.",
      uni: "Crust is neither made nor destroyed: the sides slide past each other, offsetting the ridges and streams that cross the boundary.",
    },
    example: both("Shapes drawn from the San Andreas Fault at Wallace Creek."),
  },
] as const satisfies readonly {
  id: BoundaryId;
  name: LevelText;
  glyph: string;
  glyphLabel: LevelText;
  motion: LevelText;
  help: LevelText;
  example: LevelText;
}[];

export type StageWord = "start" | "early" | "middle" | "late";

/** Words for the stage, served as `{{probe.stageLabel}}`. The scrubber itself shows only early and late. */
export const stageWords: Readonly<Record<StageWord, LevelText>> = {
  start: both("starting"),
  early: both("early"),
  middle: both("middle"),
  late: both("late"),
};

/**
 * The stage word for a stage in [0, 1] (unitless; 0 = the shared starting landscape, 1 = late). Thirds of
 * the sequence: an ordering of shapes, never a time.
 */
export function stageWordFor(stage: number): StageWord {
  if (!Number.isFinite(stage)) throw new RangeError("stage must be a finite number in [0, 1]");
  if (stage <= 0) return "start";
  if (stage < 1 / 3) return "early";
  if (stage < 2 / 3) return "middle";
  return "late";
}

/** Words around the boundary picker, the stage scrubber and the view controls. No "run", no time. */
export const controlsCopy = {
  boundaryLegend: both("Plate boundary"),
  boundaryHelp: both("Drag a plate's arrow on the block, or choose a boundary here."),
  startAgainNote: both("Each choice begins again from the same starting landscape."),
  stageLegend: both("Stage"),
  stageEarly: both("early"),
  stageLate: both("late"),
  /** The scrubber's spoken value (`aria-valuetext`). */
  stageValue: both("{{probe.stageLabel}} stage"),
  play: both("Play"),
  pause: both("Pause"),
  /** Beside Play while a boundary is chosen and still at the start. */
  playInvite: both("Press Play to go from early to late, or drag the stage."),
  chooseInvite: both("Choose a boundary to begin."),
  reset: both("Start again"),
  resetHelp: both("Back to the starting landscape, with no boundary chosen and no ghost outlines."),
  ghostLegend: both("Ghost outlines: boundaries you viewed before, at the same stage."),
  frontFace: both("Front face"),
  frontFaceHelp: both("Slide the front face along the boundary."),
  turnHelp: both("Turn the block"),
  disclosureHeading: both("What this illustration shows and leaves out"),
  showsHeading: both("This illustration shows"),
  ignoresHeading: both("It leaves out or simplifies"),
  // Added in 7F (D-W7-7F, owner item 4), following the conventions above: the words 7D's scene needs that
  // 7E had not written. View words only; no claim beyond PD1 (the scene is a drawing) and PD8 (view-only).
  /** The flap's summary line, as lesson 1's. */
  flapSummary: both("Lift the flap for the answer"),
  /** Spoken stage value and picker state before any boundary is chosen. */
  noBoundary: both("No boundary chosen"),
  /** Plays the drawing → block transition again (a view action; the boundary and stage stay). */
  replay: both("Replay the drawing"),
  /** Accessible names of the two arrow handles on the block. */
  leftPlateArrow: both("Left plate's arrow"),
  rightPlateArrow: both("Right plate's arrow"),
  /** How to use the handles, by pointer and keyboard (their description). */
  arrowHelp: both("Drag a plate's arrow towards, away from or along the boundary, or use the arrow keys."),
} as const;

/** Fig. 2. The caption follows "Fig. <number>". */
export const figure = {
  caption: {
    hs: "Two continental plates meet along a boundary from back to front. The front face is a cut through the rock layers and the crust.",
    uni: "Two continental plates meet along a boundary from back to front. The front face is a section through the layered rock, the crust and the mantle.",
  },
  /** The page's one label line (guardrail: exactly one). Fuller limits live in the disclosure and sources. */
  label: both("Illustration: shapes drawn from real examples"),
  /** Scale beside the figure: both factors bound to the illustration's config (claim PC20). */
  scaleNote: both("Not to scale: heights ×{{probe.reliefScale}}, crust depths ×{{probe.crustScale}}."),
  /** Leader-line label words for the textbook drawing: words only, no numbers. 7D places them. */
  labels: [
    { feature: "plate", text: both("plate") },
    { feature: "plate-boundary", text: both("plate boundary") },
    { feature: "rock-layers", text: both("rock layers") },
    { feature: "crust", text: both("crust") },
    { feature: "mantle", text: both("mantle") },
  ],
  /** Text alternative of the drawing (static figure and the first frame of the transition). */
  drawingAlternative: both(
    "Line drawing of a block of land cut open at the front. A straight boundary crosses the block from back to front, splitting it into two plates, each with an arrow. Low ridges and stream valleys cross the boundary. The front face shows flat rock layers over a band of crust of even thickness, with the mantle beneath.",
  ),
} as const;

/**
 * Text alternatives for the key visual change, spoken through a polite live region by the scene (7D). The
 * host picks the template for the view state and fills the bindings. Descriptions say what the drawing
 * shows at a stage ("higher at later stages"), never that something forms.
 */
export const textAlternatives = {
  sceneReady: both(
    "The drawing is now a 3D block standing on the page, showing the starting landscape, the same for every boundary.",
  ),
  start: both(
    "The starting landscape: rolling lowland with low ridges and stream valleys crossing the boundary. On the front face, flat rock layers lie over a band of crust of even thickness, with the mantle beneath.",
  ),
  boundary: {
    convergent: both(
      "{{probe.boundaryName}} boundary, {{probe.stageLabel}} stage. The plates move towards each other. A mountain range stands along the boundary, higher and wider at later stages, with snow on its highest ground at the end. On the front face the rock layers bend up under the range, and the crust beneath it is thicker: a deep root.",
    ),
    divergent: both(
      "{{probe.boundaryName}} boundary, {{probe.stageLabel}} stage. The plates move apart. A rift valley lies along the boundary between stepped fault scarps, with slightly raised shoulders, deeper at later stages. On the front face the rock layers drop at each fault, and the crust beneath the rift is thinner.",
    ),
    transform: both(
      "{{probe.boundaryName}} boundary, {{probe.stageLabel}} stage. The plates slide past each other. The ridges and stream valleys that cross the boundary are offset sideways, more at later stages: looking across the boundary, the far side has moved to the right. The land is not raised or lowered, and the crust is unchanged.",
    ),
  },
  ghosts: both("Ghost outlines on the front face show {{probe.ghostNames}} at the same stage."),
  scale: both(
    "Not to scale: heights are drawn ×{{probe.reliefScale}} and crust depths ×{{probe.crustScale}}. Scale bar: {{probe.scaleBar}}.",
  ),
  staticFallback: both(
    "The 3D block is not available here; the drawing shows the starting landscape and the two plates.",
  ),
} as const;

/** "This illustration shows": the first half of the disclosure. */
export const shows = {
  hs: [
    "The three kinds of plate boundary between two continents, and the typical shape each makes: a mountain range where plates collide, a rift valley where they pull apart, and sideways offsets where they slide past each other.",
    "The crust on the front face: thicker under the range, thinner under the rift, unchanged at the transform.",
    "Each shape from early to late, which you can play, pause and scrub.",
  ],
  uni: [
    "A continental collision range, a continental rift and a transform offset, each from the same starting landscape, with their typical shapes drawn from cited real examples.",
    "The crust on the front face: a root under the range in the Airy proportion, thinner crust under the rift, no change at the transform.",
    "Each shape from early to late, and ghost outlines of boundaries viewed before at the same stage.",
  ],
} as const satisfies Readonly<Record<"hs" | "uni", readonly string[]>>;

/** "It leaves out or simplifies": the required disclosure; the page itself shows only `figure.label`. */
export const ignores = {
  hs: [
    "The shapes are authored: drawn from real examples (the Himalaya and Tibet, the East African Rift, the San Andreas at Wallace Creek). They do not form in the scene, and the stage slider is not a clock.",
    "No erosion. Real mountains are cut by rivers and glaciers, and real rifts fill with sediment and lakes. Here the land is only raised, lowered or moved.",
    "Not to scale: heights and rock layers are drawn ×{{probe.reliefScale}}, crust depths ×{{probe.crustScale}}. The range is narrower than the Himalaya, and the sideways offset is much larger than Wallace Creek's.",
    "Simple shapes: real rifts are usually lopsided, with one main fault, and real plate boundaries are zones of many faults, not one line.",
    "Continents only. Volcanoes, earthquakes, oceans and one plate sinking under another are left out on purpose.",
    "The rock layers are made up: generic layers in natural colours, not a map of real rocks.",
  ],
  uni: [
    "The shapes are authored from cited examples; they do not form in the scene. The stage orders the shapes from early to late; it is not a clock.",
    "No erosion, sediment or rift lakes: the land is only raised, lowered or moved sideways.",
    "Not to scale: heights and rock layers ×{{probe.reliefScale}}; crust depths ×{{probe.crustScale}}, one factor for every crust depth, so their proportions survive. The range is much narrower than the Himalaya; the offset is far larger than Wallace Creek's and far smaller than the San Andreas's total.",
    "The root follows Airy isostasy directly beneath the range. Real ranges are also held up by the bending strength of the plate, which spreads their support more widely.",
    "Beneath real rifts, hot, low-density mantle also matters (the upper mantle under the Kenya Rift is unusually slow for seismic waves); the drawing does not show it.",
    "The crust is one band with a sharp base, the Moho: upper and lower crust and the mantle part of the plate are not told apart.",
    "The rift's steps are symmetric, where real basins are often lopsided half-grabens; the transform is a narrow zone, where the real San Andreas is in places tens of kilometres wide.",
    "Continental settings only: ocean ridges, trenches, subduction, volcanoes and earthquakes are left out on purpose.",
    "Figures in the text are cited real-world values, not measurements of the drawing; the generic rock layers are not a map of real rocks.",
  ],
} as const satisfies PageSpec["ignores"];

/** University-level display equation (TeX): Airy isostasy. Its values are bound in deeper.uni.md. */
export const equations = [String.raw`r = \frac{\rho_c}{\rho_m - \rho_c}\,h`] as const;

/**
 * Claims behind each text group above (the markdown files carry theirs in review comments). Checked by the
 * lesson test against claims.ts; the human register is docs/science/plates/lesson/README.md.
 */
export const textClaims: Readonly<Record<string, readonly string[]>> = {
  title: ["PC2"],
  runningHeads: ["PC1", "PC2"],
  keyWords: ["PC1", "PC2", "PC3", "PC6", "PC7", "PC10", "PC14"],
  predict: ["PC6", "PC9"],
  "boundaries.convergent": ["PC2", "PC3", "PC6", "PD1"],
  "boundaries.divergent": ["PC2", "PC10", "PC13", "PD1"],
  "boundaries.transform": ["PC2", "PC14", "PC16", "PD1"],
  stageWords: ["PD2"],
  controlsCopy: ["PD1", "PD2", "PD7", "PD8"],
  figure: ["PD1", "PC20", "PC6"],
  "textAlternatives.start": ["PD7"],
  "textAlternatives.convergent": ["PC3", "PC6", "PD7"],
  "textAlternatives.divergent": ["PC10", "PC12", "PC13", "PD7"],
  "textAlternatives.transform": ["PC14", "PC16", "PC17", "PD7"],
  "textAlternatives.views": ["PD1", "PD8", "PC20"],
  shows: ["PC2", "PC3", "PC6", "PC9", "PC10", "PC13", "PC14", "PD2", "PD7", "PD8"],
  "ignores.hs": ["PD1", "PD2", "PD3", "PD4", "PD5", "PD6", "PC20", "PC12"],
  "ignores.uni": ["PD1", "PD2", "PD3", "PD4", "PD5", "PD6", "PC20", "PC9", "PC12", "PC15", "PC21", "PC22"],
  equations: ["PC9"],
};

/**
 * Every reader text above, grouped by `textClaims` key (the equations are not prose). Used by the lesson
 * test and by the sentence register (register.ts).
 */
export const textGroups: Readonly<Record<string, unknown>> = {
  title,
  runningHeads,
  keyWords,
  predict: { question: predict.question, options: predict.options },
  ...Object.fromEntries(boundaries.map((b) => [`boundaries.${b.id}`, b])),
  stageWords,
  controlsCopy,
  figure,
  "textAlternatives.start": textAlternatives.start,
  ...Object.fromEntries(
    Object.entries(textAlternatives.boundary).map(([id, t]) => [`textAlternatives.${id}`, t]),
  ),
  "textAlternatives.views": {
    sceneReady: textAlternatives.sceneReady,
    ghosts: textAlternatives.ghosts,
    scale: textAlternatives.scale,
    staticFallback: textAlternatives.staticFallback,
  },
  shows,
  "ignores.hs": { hs: ignores.hs, uni: [] },
  "ignores.uni": { hs: [], uni: ignores.uni },
};
