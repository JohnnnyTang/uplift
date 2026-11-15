/**
 * Session 7C review build for the owner's 7R look review. ILLUSTRATION — authored shapes, NOT a simulation
 * (D-L2-1). Not the production scene (7D) and not lesson copy (7E): a book page on the desk with the real
 * block (the 7B stage: `ValleyDiorama` with its crust band) showing the three boundary relief generators.
 *
 * Open in dev at `/src/scenes/plates/relief/review/`. Query parameters (all view-only):
 * `boundary=convergent|divergent|transform` (absent: the starting landscape), `stage=0..1`,
 * `viewed=<boundary>,…` (boundaries viewed before, drawn as ghost profiles), `cut=0..1` (front face position),
 * `mode=tilted|flat`, `backend=webgl2|webgpu`, `tilt=`, `orbit=`, `zoom=` (camera), `trees=0..1` (tree
 * density), `hachure=0..1` (slope hachure strength), `ridge=<m>` (a labelled look probe of 7A row 10),
 * `crust=0` (a look probe: no crust band, so the bent layers fill the front face), `tile=<m>`
 * (wall pattern tile).
 */
import { createAuthoredSequence, driveSequence } from "@hachure/runtime";
import {
  type LandscapeSnapshot,
  type LithologyLook,
  createBookBinding,
  createBookStage,
  createValleyDiorama,
} from "@hachure/ink/stage";
import { sceneState } from "@hachure/ink/transition";
import {
  PLATES_RELIEF_CONFIG,
  PLATE_BOUNDARIES,
  type PlateBoundary,
  createPlatesRelief,
  platesSceneScales,
} from "../index";

const params = new URLSearchParams(location.search);
const num = (key: string, fallback: number) => {
  const v = Number(params.get(key));
  return params.has(key) && Number.isFinite(v) ? v : fallback;
};
/**
 * Look probe for 7R, never the default: `ridge=<metres>` replaces the starting ridge relief (7A row 10, an
 * ARTISTIC CHOICE) so the owner can judge whether stronger ridges make the transform offset read. The page
 * then says it is a probe. Every other value is the 7A table.
 */
const ridgeProbeM = params.has("ridge") ? num("ridge", PLATES_RELIEF_CONFIG.start.ridgeReliefM) : null;
const relief = createPlatesRelief(
  ridgeProbeM === null
    ? PLATES_RELIEF_CONFIG
    : { ...PLATES_RELIEF_CONFIG, start: { ...PLATES_RELIEF_CONFIG.start, ridgeReliefM: ridgeProbeM } },
);
/** Fraction of eligible cells with a tree (unit: none). Review look only; 7D owns the dressing. */
const REVIEW_TREE_DENSITY = 0.05;
const config = relief.config;
const scales = platesSceneScales(config);

/** Natural colours of the starting rock stack (the 7A storyboard's), with textbook patterns. */
const LAYER_LOOKS: Record<string, Omit<LithologyLook, "id" | "key">> = {
  sandstone: { name: "Sandstone", colour: "#E2C48C", markColour: "#7A6340", pattern: "stipple" },
  shale: { name: "Shale", colour: "#9AA4A8", markColour: "#3F4648", pattern: "dashes" },
  limestone: { name: "Limestone", colour: "#DCD6C2", markColour: "#6E6A58", pattern: "brick" },
  "crystalline crust": {
    name: "Crystalline crust",
    colour: "#CFAAA0",
    markColour: "#6E5A55",
    pattern: "crosses",
  },
};
const LITHOLOGIES: readonly LithologyLook[] = [...config.start.layers, config.start.basement].map((l) => ({
  id: l.rockId,
  key: l.key.replace(/\s+/g, "-"),
  ...LAYER_LOOKS[l.key]!,
}));

/** Review words (draft, from the 7A storyboard; 7E writes the lesson copy). */
const BOUNDARY_WORDS: Record<
  PlateBoundary,
  { name: string; glyph: string; motion: string; example: string }
> = {
  convergent: {
    name: "Convergent",
    glyph: "→ ←",
    motion: "The plates move towards each other.",
    example: "the Himalaya and Tibet",
  },
  divergent: {
    name: "Divergent",
    glyph: "← →",
    motion: "The plates move apart.",
    example: "the East African Rift",
  },
  transform: {
    name: "Transform",
    glyph: "⇅",
    motion: "The plates slide past each other.",
    example: "the San Andreas Fault at Wallace Creek",
  },
};
const STAGE_WORDS = ["early", "middle", "late"] as const;
const stageWord = (s: number) => (s < 0.25 ? STAGE_WORDS[0] : s < 0.75 ? STAGE_WORDS[1] : STAGE_WORDS[2]);

/** What the block shows, in words (the text alternative for the key visual change). */
function describeScene(boundary: PlateBoundary | null, stage: number): string {
  if (!boundary || stage === 0)
    return (
      "The starting landscape, the same for every boundary: rolling lowland with ridges and stream valleys " +
      "running across the boundary. On the front face, flat rock layers over a crust band of even thickness, " +
      "with the mantle beneath."
    );
  const when = stageWord(stage);
  const w = BOUNDARY_WORDS[boundary];
  if (boundary === "convergent")
    return `${w.motion} ${when === "late" ? "A high range stands" : "A range is rising"} along the boundary${
      when === "late" ? ", with snow on its highest ground" : ""
    }. On the front face the rock layers bend up with it and the crust thickens into a root beneath it.`;
  if (boundary === "divergent")
    return `${w.motion} The land ${when === "late" ? "has sunk" : "is sinking"} into a rift valley between stepped fault scarps, and the shoulders rise slightly. On the front face the layers drop at each fault and the crust thins beneath the rift.`;
  return `${w.motion} The ridges and stream valleys that cross the boundary are ${
    when === "late" ? "clearly" : "slightly"
  } offset sideways: looking across the boundary, the far side has moved to the right. The relief and the crust do not change.`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const asBoundary = (v: string | null): PlateBoundary | null =>
  PLATE_BOUNDARIES.includes(v as PlateBoundary) ? (v as PlateBoundary) : null;

async function main(root: HTMLElement): Promise<void> {
  root.replaceChildren();

  // ---- The desk and the open book (painted before three.js loads) ----
  const desk = el("div", "pr-desk");
  const book = el("div", "pr-book");
  const boards = el("div", "pr-boards");
  boards.setAttribute("aria-hidden", "true");
  const spread = el("article", "pr-spread");
  spread.setAttribute("aria-labelledby", "pr-title");

  const textPage = el("section", "pr-page pr-page-text");
  textPage.append(el("p", "pr-running-head", "Lesson 2, working title Where plates meet"));
  const h1 = el("h1", undefined, "Boundary relief");
  h1.id = "pr-title";
  const purpose = el(
    "p",
    "pr-purpose",
    "Review build for the owner's look review (7R). The page words are placeholders; the block is the real stage.",
  );
  const label = el("p", "pr-label", "Illustration: shapes drawn from real examples");
  const now = el("p", "pr-now");
  now.setAttribute("role", "status");
  now.setAttribute("aria-live", "polite");
  const example = el("p", "pr-example");
  // Both display scales are bound to the scene config (D-W7-7A, decision 2), never typed.
  const scaleLine = el(
    "p",
    "pr-scale",
    `Heights and rock layers are drawn ×${scales.reliefScale}; crust depths are compressed to ×${config.display.crustVerticalExaggeration}. Both are artistic choices.`,
  );
  textPage.append(h1, purpose, label, now, example, scaleLine, el("p", "pr-folio", "42"));
  if (params.get("crust") === "0")
    purpose.textContent +=
      " Look probe: the crust band is left off, so the front face shows the rock layers.";
  if (ridgeProbeM !== null)
    purpose.textContent += ` Look probe: the starting ridges are drawn ${ridgeProbeM} m high instead of the 7A table's ${PLATES_RELIEF_CONFIG.start.ridgeReliefM} m.`;

  const figurePage = el("section", "pr-page pr-page-figure");
  figurePage.append(el("p", "pr-running-head", "Where plates meet"));
  const figure = el("figure", "pr-figure");
  figure.setAttribute("aria-labelledby", "pr-caption");
  const frame = el("div", "pr-frame");
  const fallback = el("p", "pr-fallback", "Opening the block…");
  frame.append(fallback);
  const caption = el("figcaption");
  caption.id = "pr-caption";
  caption.innerHTML =
    "<b>Fig. 2</b> Two continental plates meet along a boundary that runs from the back of the block to the front.";
  figure.append(frame, caption);

  // Boundary picker: arrow glyphs back up the names (no colour cue needed).
  const picker = el("fieldset", "pr-picker");
  picker.append(el("legend", undefined, "Boundary"));
  const pickerInputs = new Map<PlateBoundary, HTMLInputElement>();
  for (const b of PLATE_BOUNDARIES) {
    const option = el("label", "pr-choice");
    const input = el("input");
    input.type = "radio";
    input.name = "pr-boundary";
    input.value = b;
    const glyph = el("span", "pr-glyph", BOUNDARY_WORDS[b].glyph);
    glyph.setAttribute("aria-hidden", "true");
    option.append(input, glyph, el("span", undefined, BOUNDARY_WORDS[b].name));
    picker.append(option);
    pickerInputs.set(b, input);
  }

  const stageRow = el("fieldset", "pr-stage");
  stageRow.append(el("legend", undefined, "Stage of formation"));
  const play = el("button", "pr-play", "Play");
  play.type = "button";
  const stageInput = el("input");
  stageInput.type = "range";
  stageInput.min = "0";
  stageInput.max = "1";
  stageInput.step = "0.01";
  stageInput.setAttribute("aria-label", "Stage of formation, early to late");
  const ends = el("span", "pr-ends");
  ends.setAttribute("aria-hidden", "true");
  ends.append(el("span", undefined, "early"), el("span", undefined, "late"));
  const ruler = el("div", "pr-ruler");
  ruler.append(stageInput, ends);
  stageRow.append(play, ruler);

  const viewRow = el("div", "pr-view");
  const cutLabel = el("label");
  const cutInput = el("input");
  cutInput.type = "range";
  cutInput.min = "0.12";
  cutInput.max = "1";
  cutInput.step = "0.01";
  cutInput.value = String(Math.min(1, Math.max(0.12, num("cut", 1))));
  cutLabel.append(el("span", undefined, "Front face"), cutInput);
  const ghostLabel = el("label");
  const ghostInput = el("input");
  ghostInput.type = "checkbox";
  ghostInput.checked = params.get("ghosts") !== "0";
  ghostLabel.append(ghostInput, el("span", undefined, "Profiles of boundaries already viewed"));
  const reset = el("button", undefined, "Reset");
  reset.type = "button";
  viewRow.append(cutLabel, ghostLabel, reset);

  figurePage.append(figure, picker, stageRow, viewRow, el("p", "pr-folio", "43"));
  spread.append(textPage, figurePage);
  book.append(boards, spread);
  desk.append(book);
  root.append(desk);

  // ---- The authored sequence (7B source): one generator per boundary, no model time ----
  // Look probe `crust=0`: leave the crust band off, so the whole front face shows the rock layers that
  // layerOffsetM bends. With the band on, the layers show above it, down to the cover base (D-W7-7R2).
  const withCrust = params.get("crust") !== "0";
  const shown = (s: LandscapeSnapshot): LandscapeSnapshot => {
    if (withCrust) return s;
    const { crustBaseM: _omit, coverBaseM: _cover, ...rest } = s;
    return rest;
  };
  const start = shown(relief.start());
  const source = createAuthoredSequence<LandscapeSnapshot>({
    sequences: PLATE_BOUNDARIES.map((b) => ({
      key: b,
      generate: (stage: number) => shown(relief.relief(b, stage)),
    })),
    start: () => start,
    stagePerViewSecond: 1 / 12,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  const viewed = (params.get("viewed") ?? "").split(",").map(asBoundary);
  for (const b of viewed) if (b) source.dispatch({ kind: "choose", key: b });
  const first = asBoundary(params.get("boundary"));
  if (first) {
    source.dispatch({ kind: "choose", key: first });
    source.dispatch({ kind: "set-stage", stage: num("stage", 0) });
  }

  const dio = createValleyDiorama({
    lithologies: LITHOLOGIES,
    reliefScale: scales.reliefScale,
    // One bedding band per start layer (row 14), so the layer offset has visible lines to move. The default
    // tile (220 m) is far below a pixel on a 160 km block and the walls read as plain colour.
    patternTileM: num("tile", config.start.layers[0]!.thicknessM),
    // Snowline and treeline from the config (rows 37, 38). Sparse trees: on a 1 km grid the default forest
    // hides the ridges and valleys that the transform offsets (a look choice for 7R; dressing is 7D's).
    dressing: {
      snowlineM: config.dressing.snowlineM,
      treelineM: config.dressing.treelineM,
      treeDensity: num("trees", REVIEW_TREE_DENSITY),
    },
    // Streams by steepest descent are 7D's dressing; the lesson-1 meltwater river rule does not apply here.
    rules: { river: () => [] },
  });
  // One fixed frame for every boundary and stage, so the block never resizes and ghosts compare.
  dio.setElevationRange(relief.elevationFrame());

  const sync = () => {
    const st = source.state();
    const boundary = asBoundary(st.key);
    for (const [b, input] of pickerInputs) input.checked = b === boundary;
    stageInput.value = String(st.stage);
    stageInput.disabled = !boundary;
    stageInput.setAttribute(
      "aria-valuetext",
      boundary ? `${stageWord(st.stage)} stage` : "no boundary chosen",
    );
    play.disabled = !boundary;
    play.textContent = st.playing ? "Pause" : "Play";
    now.textContent = `${boundary ? `${BOUNDARY_WORDS[boundary].name} boundary, ${stageWord(st.stage)} stage. ` : ""}${describeScene(boundary, st.stage)}`;
    example.textContent = boundary ? `Shapes drawn from ${BOUNDARY_WORDS[boundary].example}.` : "";
    desk.dataset.boundary = boundary ?? "start";
    desk.dataset.stage = String(st.stage);
    desk.dataset.frameSerial = String(st.frameSerial);
  };

  let shownSerial = -1;
  const draw = () => {
    const st = source.state();
    if (st.frameSerial === shownSerial) return;
    shownSerial = st.frameSerial;
    dio.setSnapshot(source.frame(), start);
    dio.setGhosts(ghostInput.checked ? source.ghosts().map((g) => g.frame) : []);
  };

  // ---- Controls: commands to the source, or view-only ----
  for (const [b, input] of pickerInputs)
    input.addEventListener("change", () => input.checked && source.dispatch({ kind: "choose", key: b }));
  stageInput.addEventListener("input", () =>
    source.dispatch({ kind: "set-stage", stage: Number(stageInput.value) }),
  );
  play.addEventListener("click", () => source.dispatch({ kind: source.state().playing ? "pause" : "play" }));
  reset.addEventListener("click", () => source.dispatch({ kind: "reset" }));
  cutInput.addEventListener("input", () => dio.setCut(Number(cutInput.value)));
  ghostInput.addEventListener("change", () => {
    shownSerial = -1;
    draw();
  });
  sync();

  const stage = createBookStage({
    host: desk,
    book,
    anchor: frame,
    diorama: dio,
    mode: params.get("mode") === "flat" ? "flat" : params.get("mode") === "tilted" ? "tilted" : "auto",
    backend:
      params.get("backend") === "webgpu" ? "webgpu" : params.get("backend") === "webgl2" ? "webgl2" : "auto",
    onContextLost: (message) => {
      fallback.textContent = `The 3D block stopped (${message}).`;
      fallback.hidden = false;
    },
  });
  const binding = createBookBinding(book);
  try {
    await stage.mount();
  } catch (error) {
    fallback.textContent = `3D is not available here (${error instanceof Error ? error.message : String(error)}).`;
    binding.dispose();
    return;
  }
  fallback.hidden = true;
  stage.setView({
    tiltDeg: num("tilt", stage.view.tiltDeg),
    orbitDeg: num("orbit", 0),
    zoom: num("zoom", 1),
  });
  stage.applyTransition(sceneState());
  // View-only look probe for 7R: the strength of the ink slope hachures once colour is in.
  if (params.has("hachure")) dio.setReveal({ rise: 1, ink: 1, colour: 1, hachure: num("hachure", 0.22) });
  dio.setCut(Number(cutInput.value));
  draw();
  await stage.renderNow();
  source.subscribe(() => {
    sync();
    draw();
  });
  driveSequence(source);
  desk.dataset.backend = stage.backend ?? "";
  desk.dataset.mode = stage.mode;
  desk.dataset.ready = "true";
}

void main(document.getElementById("pr-root")!);
