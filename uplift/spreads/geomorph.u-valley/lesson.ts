/**
 * <!-- expert-review -->
 * The editorial pieces of "From V to U" that are not running prose: lesson and figure numbers (data, so the
 * shell composes "Lesson 1" and "Fig. 1"; text never carries them), key words, the optional prediction and
 * its answer evidence, the unscored margin challenge, the caption, Fig. 1 label words, rock names and help,
 * bound margin-note templates and text-alternative templates. Every claim is registered in claims.ts; the
 * page text never types a number the model computes or configures.
 */
import type { KeyWord, Level, LevelText, PageSpec, PredictSpec } from "@hachure/runtime";
import type { RockId } from "@hachure/glacier";

const both = (text: string): LevelText => ({ hs: text, uni: text });

/** Structural numbering, composed by the shell ("Lesson" + number, "Fig." + number). Not model values. */
export const LESSON_NUMBER = 1;
export const FIGURE_NUMBER = 1;

export const title = both("From V to U");

export const runningHeads = {
  /** Left page, after "Lesson <number> · ". */
  text: both("Glaciers"),
  /** Right page. */
  figure: both("Glaciers shape valleys"),
} as const;

export const keyWords = [
  {
    term: both("glacier"),
    definition: {
      hs: "a large mass of ice that flows slowly downhill",
      uni: "ice flowing under its own weight, by deformation and by sliding over its bed",
    },
  },
  {
    term: both("V-shaped valley"),
    definition: {
      hs: "a narrow valley with sloping sides, cut by a river",
      uni: "a river-cut cross-section: straight walls meeting at a narrow floor",
    },
  },
  {
    term: both("U-shaped valley"),
    definition: {
      hs: "a valley with a flat floor and steep sides, shaped by ice",
      uni: "a glacial trough: flat floor and steep lower walls, a power-law cross-profile",
    },
  },
  {
    term: both("glacial erosion"),
    definition: {
      hs: "rock worn away by ice sliding over it",
      uni: "bed lowering by abrasion and quarrying, here a power of basal sliding speed",
    },
  },
  {
    term: both("rock type"),
    definition: {
      hs: "what the rock is made of, and how easily it wears away",
      uni: "here, the bed's erodibility and the steepest wall the rock mass holds",
    },
  },
] as const satisfies readonly KeyWord[];

/**
 * Optional prediction. Index 0 (shale) is backed by the registered verdict R4-deeper (floor lowering
 * shale > sandstone > granite at every matched time and seed) and R1-rate. It never gates play, the flap or
 * navigation.
 */
export const predict = {
  question: {
    hs: "After the same model time, which valley will the ice have worn deeper?",
    uni: "At matched model time, which rock shows the greater floor lowering under the ice?",
  },
  options: [
    { hs: "Soft shale", uni: "Shale (soft)" },
    { hs: "Hard granite", uni: "Granite (hard)" },
    { hs: "Both the same", uni: "No difference" },
  ],
  answer: 0,
  answerEvidence: "docs/review/glacial/model/summary.json#R4-deeper",
} as const satisfies PredictSpec;

/**
 * Optional margin challenge: an unscored invitation (no stamp, no check). It extends the same idea: within
 * one run the valley is a U under the ice and stays a V where the ice never reached (owner decision 6).
 */
export const challenge = {
  hs: "Try this: slide the front face past the end of the glacier. Where does the U turn back into a V?",
  uni: "Try this: slide the cut from under the ice to below the snout. Where does b stop changing, and why?",
} as const satisfies LevelText;

/** Fig. 1. The caption follows "Fig. <number>". */
export const figure = {
  caption: both(
    "A mountain valley with a glacier. The front of the block is a cross-section; the dashed line is the valley before the ice.",
  ),
  /** The page's single limitation line (guardrail: at most one). Fuller limits live in the sources. */
  limitation: both("Simplified model; time is compressed."),
  /**
   * Leader-line label words for the textbook drawing (D-W5-R1 item 7): words only, no numbers. 5K draws
   * them on `glacialDrawingSvg()` at the named feature.
   */
  labels: [
    { feature: "valley-head", text: both("valley head") },
    { feature: "glacier", text: both("glacier") },
    { feature: "snout", text: both("snout") },
    { feature: "u-valley", text: both("U-shaped valley") },
    { feature: "v-valley", text: both("V-shaped valley") },
    { feature: "valley-floor", text: both("valley floor") },
  ],
  /** Text alternative of the drawing (static figure and first frame of the transition). */
  drawingAlternative: both(
    "Line drawing of a block of mountains cut open at the front. A glacier fills the upper valley from the valley head down to its snout. Under the glacier the valley has a flat floor and steep sides, like a U. Below the snout a river runs on through a narrower V-shaped valley. The front of the block shows the rock in section.",
  ),
} as const;

/** Rock names and help (D-W5-R1 item 2). Order: soft → hard. */
export const rocks = [
  {
    id: "shale",
    name: both("Shale"),
    hardness: both("soft"),
    help: {
      hs: "Soft rock made of mud, in thin layers. It wears away easily, and its walls slump to gentle slopes.",
      uni: "Weak, closely jointed rock mass. In this model: the highest erodibility and the gentlest stable wall.",
    },
  },
  {
    id: "sandstone",
    name: both("Sandstone"),
    hardness: both("medium"),
    help: {
      hs: "Sand grains cemented together. Medium hard: it wears more slowly than shale.",
      uni: "Moderately strong, bedded rock mass. In this model: intermediate erodibility and wall slope.",
    },
  },
  {
    id: "granite",
    name: both("Granite"),
    hardness: both("hard"),
    help: {
      hs: "Hard rock made of interlocking crystals, with few cracks. It wears slowly and stands in steep walls.",
      uni: "Massive, widely jointed crystalline rock. In this model: the lowest erodibility and the steepest stable wall.",
    },
  },
] as const satisfies readonly {
  id: RockId;
  name: LevelText;
  hardness: LevelText;
  help: LevelText;
}[];

/** Words around the rock tray and the timeline. Comparison is always a separate run (owner decision 6). */
export const controlsCopy = {
  rockLegend: both("Rock"),
  rockHelp: both("Drag a rock onto the block, or choose one here."),
  newRun: both("Each rock starts a separate run from the same starting valley. Earlier runs are kept."),
  droppedRun: both("The oldest kept run was removed to make room for the new one."),
  timeLegend: both("Time"),
  /** Shown beside Play while the live run is still at its start (5M2: the opening invites Play). */
  playInvite: both("Press Play and watch the ice reshape the valley."),
  timeUnit: both("model years"),
  earlier: both("Earlier moment · {{probe.modelTime}}"),
  backToLive: both("Back to the latest moment"),
  underIce: both("See under the ice"),
  frontFace: both("Front face"),
  ghost: both("{{probe.keptRockName}} run, {{probe.keptModelTime}}"),
} as const;

/** When a margin note shows. Each condition is computed from model state or view state by the host. */
export type NoteCondition =
  "always" | "past-view" | "face-under-ice" | "face-below-snout" | "kept-run" | "overdeepened";

export interface MarginNoteTemplate {
  readonly id: string;
  readonly when: NoteCondition;
  readonly levels: readonly Level[];
  readonly text: LevelText;
}

const ALL: readonly Level[] = ["hs", "uni"];

/**
 * Bound margin-note templates (handwritten notes beside the text). Values come from the averaged section
 * (bindings.ts, `glacier-section`), rounded for display; the deeper level says so (D-W5-R1 item 9). The
 * margin stays short enough for the short-laptop tilted layout at the deeper level with a kept run shown.
 */
export const marginNotes: readonly MarginNoteTemplate[] = [
  { id: "time", when: "always", levels: ALL, text: both("{{probe.modelTime}} in {{probe.rockName}}") },
  { id: "earlier", when: "past-view", levels: ALL, text: both("an earlier moment of this run") },
  {
    id: "face-ice",
    when: "face-under-ice",
    levels: ALL,
    text: both("front face {{probe.faceDistance}} down the valley, under {{probe.iceThickness}} of ice"),
  },
  {
    id: "face-snout",
    when: "face-below-snout",
    levels: ALL,
    text: both("front face {{probe.faceDistance}} down the valley, below the snout"),
  },
  {
    id: "floor",
    when: "always",
    levels: ALL,
    text: both("floor {{probe.floorWidth}} wide, valley {{probe.valleyDepth}} deep"),
  },
  {
    id: "lowered",
    when: "always",
    levels: ALL,
    text: both("floor lowered {{probe.floorLowered}} since the start"),
  },
  { id: "wall", when: "always", levels: ALL, text: both("steepest wall {{probe.steepestWall}}") },
  { id: "shape", when: "always", levels: ["uni"], text: both("shape b = {{probe.shapeExponent}}") },
  {
    id: "compare",
    when: "kept-run",
    levels: ALL,
    text: {
      hs: "a separate run with another rock, {{probe.keptRockName}}, at {{probe.keptModelTime}}: lowered {{probe.keptFloorLowered}}, wall {{probe.keptSteepestWall}}",
      uni: "a separate run with another rock, {{probe.keptRockName}}, at {{probe.keptModelTime}}: lowered {{probe.keptFloorLowered}}, wall {{probe.keptSteepestWall}}, b = {{probe.keptShapeExponent}}",
    },
  },
  {
    id: "overdeepened",
    when: "overdeepened",
    levels: ALL,
    text: {
      hs: "The ice has worn the floor here lower than the floor further down: a basin, called an overdeepening.",
      uni: "Overdeepened: the floor rises {{probe.adverseRise}} down-valley from here, an adverse slope ice and meltwater must climb. Valley glaciers carve such basins; their depth here is not calibrated.",
    },
  },
];

/**
 * Text alternatives for the key visual change (spoken through a polite live region by the scene, 5K).
 * Templates: the host picks the variant that matches the view state and fills the bindings.
 */
export const textAlternatives = {
  sceneReady: both(
    "The figure is now a 3D block of the valley standing on the page, cut into {{probe.rockName}}, after {{probe.modelTime}}.",
  ),
  glacier: both("A glacier fills the valley from the valley head down to its snout."),
  noIce: both("There is no ice in this view."),
  iceHidden: both("The ice is hidden to show the rock under it."),
  profileUnderIce: both(
    "The front face cuts through the glacier. There the valley floor is {{probe.floorWidth}} wide and lowered {{probe.floorLowered}} below the dashed starting V; the steepest wall is {{probe.steepestWall}}.",
  ),
  profileBelowSnout: both(
    "The front face cuts the valley below the glacier's snout, where the river's V is unchanged.",
  ),
  compare: both(
    "The ghost line is a separate run with another rock, {{probe.keptRockName}}, at {{probe.keptModelTime}}: its floor is lowered {{probe.keptFloorLowered}} and its steepest wall is {{probe.keptSteepestWall}}.",
  ),
  earlier: both("You are looking at an earlier moment of this run, {{probe.modelTime}}."),
  overdeepened: both(
    "At the front face the floor lies lower than the valley floor further down: an overdeepened basin.",
  ),
  staticFallback: both("The 3D figure is not available here; the drawing shows the same valley."),
} as const;

/** "What this model ignores" (required disclosure); the page itself shows only `figure.limitation`. */
export const ignores = {
  hs: [
    "A simplified process model, not a forecast for a real valley. Time is compressed: model years are not real years.",
    "One rock for the whole valley, one steady snowline, no climate change.",
    "No rivers cutting below the glacier, no weathering, no rising or sinking of the land.",
  ],
  uni: [
    "Shallow-ice flow with a geometric lateral-drag estimate, not a higher-order stress solution; all ice is temperate, and thin ice is frozen to its bed by a simple thickness ramp.",
    "Mass balance from a fixed snowline on the starting bed: the feedback by which a deepening valley lowers and shrinks its glacier is omitted, so every rock gets the same ice.",
    "Erosion is a power of sliding speed scaled by rock erodibility; abrasion and quarrying are not separated, and subglacial water, sediment cover and meltwater incision are omitted.",
    "Rock walls fail at a fixed steepest slope per rock; bedding and joint orientation and variation of rock within a run are omitted.",
    "Not calibrated against a real valley: magnitudes are indicative, erosion is time-compressed, and overdeepened basins have an uncalibrated depth.",
  ],
} as const satisfies PageSpec["ignores"];

/** University-level display equations (TeX). Live parameter values are bound in deeper.uni.md. */
export const equations = [
  String.raw`\frac{\partial H}{\partial t} = -\nabla\cdot\mathbf{q} + \dot{m},\qquad \mathbf{q} = -D\,\nabla s,\qquad s = b + H`,
  String.raw`\tau = f\,\rho g H\,\lvert\nabla s\rvert,\qquad \bar{u}_{\mathrm{def}} = \frac{2A}{n+2}\,\tau^{n} H`,
  String.raw`u_b = u_{\mathrm{ref}}\left(\frac{\min(\tau,\tau_{\max})}{\tau_{\mathrm{ref}}}\right)^{m}`,
  String.raw`\dot{e} = S\,\varepsilon_{\mathrm{ref}}\,K_{\mathrm{rock}}\left(\frac{u_b}{u_{\mathrm{ref}}}\right)^{l}`,
  String.raw`\dot{m} = \min\!\big(\beta\,(z - z_{\mathrm{ELA}}),\ \dot{m}_{\max}\big)`,
  String.raw`z - z_{\mathrm{floor}} = a\,\lvert y - y_c\rvert^{\,b}`,
] as const;
