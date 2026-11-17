import { translate, getLanguage, onLanguageChange, refreshLanguage } from "../../i18n";
import { writeText, textNode, writeMarkup, writeAttribute } from "../../i18n";
/**
 * Lesson 2's production scene, _Where plates meet_ (session 7D): the spread on lesson 1's tilted book stage,
 * Fig. 2 as a textbook line drawing (the static fallback) that transitions into the naturally coloured block,
 * and the reader loop of D-L2-1 decision 8 — pick a boundary, play or scrub its stage of formation, compare
 * with the boundaries already viewed as labelled ghost profiles on the front face.
 *
 * ILLUSTRATION: every shape is authored (7C's `relief(boundary, stage)`, D-L2-1); nothing forms, is computed
 * or is simulated in the scene, and the page never says so. There is no model time, no run and no year: the
 * scrubber shows only "early → late".
 *
 * One command per reader choice: the page picker and the plate-arrow gesture on the block (pointer or
 * keyboard) both send `choose` to the authored-sequence source; play, pause, scrub, step and reset are its
 * other commands. Camera, cut position, level and ghost display are view-only. Dressing reads the field
 * (`dressing.ts`); no relief logic lives in the dressing or in a shader.
 */
import "../glacial/review.css";
import "./plates.css";
import {
  BindingEngine,
  type BoundValue,
  type Level,
  type Probe,
  createDisplayFormula,
} from "@hachure/runtime";
import type { LandscapeSnapshot, LithologyLook, ValleyDiorama } from "@hachure/ink/stage";
import type { TransitionRun, TransitionState } from "@hachure/ink/transition";
import type { AttachedBlockArrows, BlockDirection } from "@hachure/ink/plates";
import type * as GlacialInk from "@hachure/ink/glacial";
import { createReadingPanel } from "../glacial/reading-panel";
import { createViewControls } from "../glacial/view-controls";
import { BOOK_FIT, mountStudyDesk } from "../glacial/desk";
import { PLATES_DEFAULT_PROBES, platesProbeValues, scaleBarKm } from "./bindings";
import { type LevelText, type PlatesSceneCopy, PLATES_PLACEHOLDER_COPY } from "./copy";
import { platesDressingRules } from "./dressing";
import { type PlateArrowMotion, type PlatesDrawingLabel, platesDrawingSvg } from "./drawing";
import { PLATE_BOUNDARIES, type PlateBoundary } from "./relief/index";
import {
  type PlatesSequence,
  STAGE_STEPS,
  asBoundary,
  createPlatesSequence,
  quantiseStage,
} from "./sequence";
import { boundaryGlyphSvg, ghostSampleSvg } from "./scene-glyphs";
import { GHOST_PATTERN_WORDS, cutWords, describeScene, stageWord } from "./words";

/**
 * Book tilt (unit: degrees): lesson 1's 48°, so turning the page between the lessons never moves the camera
 * (owner, 2026-11-15, D-W7-7F; 7D had 42°). The higher view of the block comes from the block's tip below.
 */
export const PLATES_TILT_DEG = 48;
/**
 * The block's tip towards the reader on the page (unit: degrees), about its front edge: a higher default view
 * of the block, so the transform offset reads without turning it, while the book keeps lesson 1's tilt
 * (owner, 2026-11-15, D-W7-7G item 2). On the tilted book "View height" is the book's own tilt (the camera is
 * matched to the paper), so the higher view comes from the block. View-only.
 */
export const PLATES_BLOCK_PITCH_DEG = 12;
/** Fraction of eligible low, gentle cells with a tree (unit: none). Sparse, so ridges and streams read. */
const TREE_DENSITY = 0.03;
/**
 * No trees within this many cells of the boundary (unit: cells, 1 km each): the owner's requirement that the
 * transform offset reads at page size (2026-11-15). The strip is a look choice, not a claim.
 */
const TREE_CLEAR_HALF_WIDTH_CELLS = 16;
/** Trees only on ground gentler than this (unit: degrees, true slope). */
const MAX_TREE_SLOPE_DEG = 9;
/**
 * Resting strength of the slope hachures once colour is in (unit: none). Lesson 1 rests at 0.22; 7D had
 * 0.45, softened for the owner's 2026-11-15 look note (D-W7-7F).
 */
const RESTING_HACHURE = 0.34;
/** The front face on opening, as a fraction along the boundary from the back (unit: none). */
const DEFAULT_CUT = 1;

/** Leader labels of Fig. 2 when the copy names none (words only). */
const DEFAULT_DRAWING_LABELS: NonNullable<PlatesSceneCopy["figure"]["labels"]> = [
  { feature: "plate-boundary", text: { hs: "plate boundary", uni: "plate boundary" } },
  { feature: "crust", text: { hs: "crust", uni: "crust" } },
  { feature: "mantle", text: { hs: "mantle", uni: "mantle" } },
];

/** Plate motions shown by the arrows for each boundary (drawing and on-block arrows alike). */
const MOTION: Readonly<Record<PlateBoundary, PlateArrowMotion>> = {
  convergent: "towards",
  divergent: "apart",
  transform: "along",
};

/** Natural colours of the starting rock stack (the 7A storyboard's, as in 7C's review build). */
const LAYER_LOOKS: Readonly<Record<string, Omit<LithologyLook, "id" | "key">>> = {
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

export interface MountedPlatesScene {
  /** Changes words, visible controls and overlays only; never the sequence. */
  setLevel(level: Level): void;
  returnToDrawing(options: { readonly reducedMotion: boolean; readonly signal: AbortSignal }): Promise<void>;
  startEntrance(): void;
  dispose(): Promise<void>;
}

/** Reader choices on the left page, kept by the book across page turns. */
export interface PlatesPagePresentation {
  readonly prediction: number | null;
  readonly flapOpen: boolean;
}

export interface PlatesSceneOptions {
  /** The authored sequence. The book keeps one across page turns; default: a new one owned by the scene. */
  readonly sequence?: PlatesSequence;
  readonly copy?: PlatesSceneCopy;
  readonly probes?: readonly Probe[];
  readonly level?: Level;
  readonly folios?: readonly [number, number];
  readonly mode?: "flat" | "tilted" | "auto";
  readonly reducedMotion?: boolean;
  readonly backend?: "auto" | "webgl2" | "webgpu";
  /** Drawing only, as without WebGL. */
  readonly staticOnly?: boolean;
  /** Mounted inside the book shell (no document title). */
  readonly embedded?: boolean;
  /** Play the transition as a short crossfade (returning to an already-seen spread). */
  readonly deferEntrance?: boolean;
  readonly quickTransition?: boolean;
  readonly presentation?: PlatesPagePresentation;
  readonly onPresentation?: (p: PlatesPagePresentation) => void;
  /** Called when what the scene shows changes (boundary, stage, playing), for the controller's status. */
  readonly onChange?: () => void;
  /** Called when the scene shows the drawing only (no 3D here, or 3D stopped), with the reason in words. */
  readonly onStatic?: (reason: string) => void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) writeText(node, text);
  return node;
};

/** Paragraphs from copy markdown: blank-line paragraphs, **bold** and _italic_ runs. */
function paragraphs(text: string, render: (t: string) => string): HTMLElement[] {
  return translate(text)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const p = el("p");
      for (const [k, part] of render(block).split(/\*\*/).entries()) {
        if (k % 2) {
          p.append(el("b", undefined, part));
          continue;
        }
        for (const [j, bit] of part.split(/(?<![\w])_(?=\S)|(?<=\S)_(?![\w])/).entries())
          p.append(j % 2 ? el("i", undefined, bit) : textNode(bit));
      }
      return p;
    });
}

export async function mountPlatesScene(
  root: HTMLElement,
  o: PlatesSceneOptions = {},
): Promise<MountedPlatesScene> {
  const copy = o.copy ?? PLATES_PLACEHOLDER_COPY;
  const probes = o.probes ?? PLATES_DEFAULT_PROBES;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => o.reducedMotion === true || motionQuery.matches;
  const ownsSequence = !o.sequence;
  const sequence = o.sequence ?? createPlatesSequence({ reducedMotion: reducedMotion() });
  const { source, relief } = sequence;
  source.dispatch({ kind: "set-reduced-motion", reduced: reducedMotion() });
  const config = relief.config;
  const frame = relief.elevationFrame();
  const reliefScale = config.display.surfaceVerticalExaggeration;
  const scaleKm = scaleBarKm(config);
  let level: Level = o.level ?? "hs";
  let presentation: PlatesPagePresentation = o.presentation ?? { prediction: null, flapOpen: false };
  let cut = DEFAULT_CUT;
  const t = (x: LevelText) => translate(x[level]);
  const [folioText, folioFigure] = o.folios ?? [4, 5];
  const bindings = new BindingEngine({ probes, controls: [] });
  const bound = (template: string) => {
    try {
      return bindings.render(translate(template));
    } catch {
      return template.replace(/\{\{[^}]*\}\}/g, "—");
    }
  };

  root.replaceChildren();
  root.classList.add("gs-review", "ps-scene");
  if (!o.embedded) document.title = `${t(copy.title)} · scene`;

  // ---- DOM: desk, book, spread. Painted before three.js loads; the drawing is the static fallback. ----
  const desk = el("div", "gs-desk ps-desk");
  const book = el("div", "gs-book");
  const boards = el("div", "gs-boards");
  boards.setAttribute("aria-hidden", "true");
  const spread = el("article", "gs-spread");
  spread.setAttribute("aria-labelledby", "ps-title");

  const textPage = el("section", "gs-page gs-page-text");
  const textHead = el("p", "gs-running-head");
  const column = el("div", "gs-text-column ps-text-column");
  const lesson = el("div", "gs-lesson");
  // expert-review: the lesson words are 7E's (passed in as `copy`); the placeholder says so on the page.
  lesson.append(document.createComment(" expert-review "));
  const lessonNumber = el("p", "gs-lesson-number");
  const h1 = el("h1");
  h1.id = "ps-title";
  h1.tabIndex = -1;
  const introduction = el("div", "gs-introduction");
  const body = el("div", "gs-body");
  introduction.append(lessonNumber, h1, body);
  const keywords = el("dl", "gs-keywords");
  const question = el("fieldset", "gs-predict");
  const flap = el("details", "gs-flap");
  const flapSummary = el("summary");
  const flapAnswer = el("div", "gs-flap-answer");
  flap.append(flapSummary, flapAnswer);
  const labelLine = el("p", "ps-label-line");
  const deeperTriggers = el("div", "gs-deeper-triggers");
  lesson.append(introduction, keywords, question, flap, labelLine, deeperTriggers);
  column.append(lesson);
  textPage.append(textHead, column, el("p", "gs-folio", String(folioText)));

  const figurePage = el("section", "gs-page gs-page-figure");
  const figureHead = el("p", "gs-running-head");
  const figure = el("figure", "gs-figure");
  figure.setAttribute("aria-labelledby", "ps-fig-caption");
  const frameEl = el("div", "gs-frame");
  const drawing = el("div", "gs-drawing");
  const lens = el("div", "ps-lens");
  lens.hidden = true;
  frameEl.append(drawing);
  const caption = el("figcaption");
  caption.id = "ps-fig-caption";
  const captionText = el("span");
  const scaleLine = el("span", "gs-scale");
  caption.append(captionText, scaleLine);
  const ghostKey = el("div", "ps-ghost-key");
  ghostKey.hidden = true;
  // The ghost key sits right under the block's front face, on the page: each boundary already viewed, with its
  // dash sample, glyph and name; a leader line ties each entry to its profile (D-W7-7G, owner item 1).
  figure.append(frameEl, ghostKey, caption, lens);

  const picker = el("fieldset", "ps-picker");
  const pickerLegend = el("legend");
  picker.append(pickerLegend);
  const pickerInputs = new Map<PlateBoundary, HTMLInputElement>();
  for (const b of PLATE_BOUNDARIES) {
    const option = el("label", "ps-choice");
    option.dataset.boundary = b;
    const input = el("input");
    input.type = "radio";
    input.name = "ps-boundary";
    input.value = b;
    const words = el("span", "ps-choice-words");
    const help = el("span", "ps-choice-help");
    help.id = `ps-help-${b}`;
    input.setAttribute("aria-describedby", help.id);
    words.append(el("span", "ps-choice-name"), help);
    option.append(input);
    option.insertAdjacentHTML("beforeend", boundaryGlyphSvg(b));
    option.append(words);
    picker.append(option);
    pickerInputs.set(b, input);
  }
  const invite = el("p", "ps-invite");
  invite.id = "ps-invite";

  const stageRow = el("fieldset", "gs-timeline ps-stage");
  const stageLegend = el("legend");
  const playButton = el("button", "gs-play");
  playButton.type = "button";
  const stageInput = el("input");
  stageInput.type = "range";
  stageInput.min = "0";
  stageInput.max = "1";
  stageInput.id = "ps-stage";
  const ruler = el("div", "gs-ruler");
  const rulerEnds = el("div", "gs-ruler-ends");
  rulerEnds.setAttribute("aria-hidden", "true");
  const earlyEnd = el("span");
  const lateEnd = el("span");
  rulerEnds.append(earlyEnd, lateEnd);
  ruler.append(stageInput, rulerEnds);
  const stageOutput = el("output", "gs-time-now");
  stageOutput.htmlFor.add("ps-stage");
  stageRow.append(stageLegend, playButton, ruler, stageOutput);
  // One tick per reduced-motion stop: early, ¼, middle, ¾, late.
  stageRow.style.setProperty("--gs-ticks", "4");

  const controls = el("div", "gs-controls");
  const replay = el("button");
  replay.type = "button";
  const cutLabel = el("label");
  const cutName = el("span");
  const cutInput = el("input");
  cutInput.type = "range";
  cutInput.max = "1";
  cutLabel.append(cutName, cutInput);
  const resetButton = el("button", "gs-reset");
  resetButton.type = "button";
  controls.append(cutLabel, resetButton, replay);
  const arrowHelp = el("p", "gs-sr");
  arrowHelp.id = "ps-arrow-help";
  const status = el("p", "gs-sr");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  figurePage.append(
    figureHead,
    figure,
    picker,
    invite,
    stageRow,
    controls,
    arrowHelp,
    status,
    el("p", "gs-folio", String(folioFigure)),
  );
  spread.append(textPage, figurePage);
  book.append(boards, spread);
  desk.append(book);
  const sketch = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sketch.setAttribute("width", "0");
  sketch.setAttribute("height", "0");
  sketch.setAttribute("aria-hidden", "true");
  sketch.style.position = "absolute";
  writeMarkup(
    sketch,
    '<filter id="ps-sketch" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>',
  );
  desk.append(sketch);
  root.append(desk);

  // The deeper level and the sources stay off the paper; their reading copies open in the upright panel.
  const offPaper = el("div");
  offPaper.hidden = true;
  const deeper = el("div", "gs-deeper");
  const sourcesRegion = el("div", "gs-sources");
  offPaper.append(deeper, sourcesRegion);
  root.append(offPaper);
  const reading = createReadingPanel(root);
  const readingRegion = (node: HTMLElement, title: string) => {
    const region = el("div", "gs-reading-region");
    node.replaceWith(region);
    region.append(node);
    reading.add(node, title);
  };
  readingRegion(introduction, "Lesson");
  readingRegion(keywords, "Key words");
  readingRegion(flap, "Question and explanation");
  const deeperTrigger = el("span");
  const sourcesTrigger = el("span");
  deeperTriggers.append(deeperTrigger, sourcesTrigger);
  reading.add(deeper, "Deeper level", deeperTrigger);
  reading.add(sourcesRegion, "What this shows and ignores, sources and teacher notes", sourcesTrigger);
  desk.dataset.stageMode = "flat";

  // ---- State read from the source ----
  const shownBoundary = () => asBoundary(source.state().key);
  const ghostBoundaries = (): PlateBoundary[] =>
    source.ghosts().flatMap((g) => {
      const b = asBoundary(g.key);
      return b ? [b] : [];
    });

  // ---- Words (level-dependent; the sequence never changes here) ----
  const drawingLabels = (): PlatesDrawingLabel[] =>
    (copy.figure.labels ?? DEFAULT_DRAWING_LABELS).map((l) => ({ feature: l.feature, text: t(l.text) }));
  let drawnMotion: string | undefined;
  const renderDrawing = () => {
    const b = shownBoundary();
    const motion = b ? MOTION[b] : null;
    const key = `${motion}|${level}`;
    if (key === drawnMotion) return;
    drawnMotion = key;
    writeMarkup(
      drawing,
      platesDrawingSvg({
        snapshot: sequence.start,
        frame,
        reliefScale,
        strataM: config.start.layers.reduce<number[]>(
          (acc, l) => [...acc, (acc.at(-1) ?? config.start.lowlandElevationM) - l.thicknessM],
          [],
        ),
        arrows: motion,
        labels: drawingLabels(),
        scaleBar: { cells: (scaleKm * 1000) / config.grid.metresPerCell, label: `${scaleKm} km` },
        idPrefix: "ps-fig",
        title: `Fig. ${copy.figure.number}: ${t(copy.figure.caption)}`,
        description: t(copy.figure.drawingAlternative),
      }),
    );
  };
  const renderSources = () => {
    // A list may be longer at one level than the other; empty entries are skipped.
    const shows = el("ul");
    for (const s of copy.showsIgnores.shows) if (t(s)) shows.append(el("li", undefined, bound(t(s))));
    const ignores = el("ul");
    for (const s of copy.showsIgnores.ignores) if (t(s)) ignores.append(el("li", undefined, bound(t(s))));
    const sources = el("ul", "gs-source-list");
    for (const s of copy.sources) {
      const li = el("li");
      if (s.url) {
        const a = el("a", undefined, s.citation);
        a.href = s.url;
        li.append(a);
      } else writeText(li, s.citation);
      sources.append(li);
    }
    sourcesRegion.replaceChildren(
      el("h3", undefined, "This illustration shows"),
      shows,
      el("h3", undefined, "It leaves out or simplifies"),
      ignores,
      el("h3", undefined, "Teacher notes"),
      ...paragraphs(translate(copy.teacherNotes).replace(/^#.*$/gm, ""), (x) => x),
      el("h3", undefined, "Sources"),
      sources,
    );
  };
  const renderArrowLabels = () => {
    for (const [id, words] of [
      ["left", copy.controls.leftPlateArrow],
      ["right", copy.controls.rightPlateArrow],
    ] as const) {
      const handle = root.querySelector('button[data-handle="' + id + '"]');
      if (handle) writeAttribute(handle, "aria-label", words[level]);
    }
  };
  const renderWords = () => {
    renderArrowLabels();
    writeText(textHead, `Lesson ${copy.lessonNumber} · ${t(copy.runningHeads.text)}`);
    writeText(figureHead, t(copy.runningHeads.figure));
    writeText(lessonNumber, `Lesson ${copy.lessonNumber}`);
    writeText(h1, t(copy.title));
    body.replaceChildren(...paragraphs(t(copy.body), bound));
    keywords.replaceChildren();
    for (const k of copy.keyWords)
      keywords.append(el("dt", undefined, t(k.term)), el("dd", undefined, t(k.definition)));
    question.replaceChildren();
    question.hidden = !copy.predict;
    if (copy.predict) {
      question.append(el("legend", undefined, t(copy.predict.question)));
      copy.predict.options.forEach((option, index) => {
        const label = el("label");
        const input = el("input");
        input.type = "radio";
        input.name = "ps-prediction";
        input.value = String(index);
        input.checked = presentation.prediction === index;
        label.append(input, el("span", undefined, t(option)));
        question.append(label);
      });
    }
    writeText(flapSummary, t(copy.flap.summary));
    flapAnswer.replaceChildren(...paragraphs(t(copy.flap.answer), bound));
    flap.open = presentation.flapOpen;
    writeText(labelLine, t(copy.labelLine));
    captionText.replaceChildren(
      el("span", "gs-fig-number", `Fig. ${copy.figure.number}`),
      t(copy.figure.caption),
    );
    writeText(scaleLine, bound(t(copy.figure.scale)));
    writeText(pickerLegend, t(copy.controls.pickerLegend));
    for (const [b, input] of pickerInputs) {
      const option = input.parentElement!;
      writeText(option.querySelector(".ps-choice-name")!, t(copy.boundaries[b].name));
      writeText(option.querySelector(".ps-choice-help")!, t(copy.boundaries[b].help));
      writeAttribute(option, "title", t(copy.boundaries[b].help));
    }
    writeText(invite, t(copy.controls.invite));
    writeText(stageLegend, t(copy.controls.stageLegend));
    writeText(earlyEnd, t(copy.controls.early));
    writeText(lateEnd, t(copy.controls.late));
    writeText(replay, t(copy.controls.replay));
    writeText(cutName, t(copy.controls.frontFace));
    writeText(resetButton, t(copy.controls.reset));
    writeText(arrowHelp, t(copy.controls.arrowHelp));
    deeperTrigger.hidden = level !== "uni";
    const equations = el("div", "gs-equations");
    if (level === "uni") for (const tex of copy.equations ?? []) equations.append(createDisplayFormula(tex));
    deeper.replaceChildren(...(level === "uni" ? [...paragraphs(copy.deeper, bound), equations] : []));
    drawnMotion = undefined;
    renderDrawing();
    renderSources();
  };
  question.addEventListener("change", (event) => {
    presentation = { ...presentation, prediction: Number((event.target as HTMLInputElement).value) };
    o.onPresentation?.(presentation);
  });
  flap.addEventListener("toggle", () => {
    if (flap.open === presentation.flapOpen) return;
    presentation = { ...presentation, flapOpen: flap.open };
    o.onPresentation?.(presentation);
  });

  // ---- Bound values and page state (re-read on every source change) ----
  const publish = () => {
    const values: Record<string, BoundValue> = platesProbeValues(probes, config, copy, level, {
      boundary: shownBoundary(),
      stage: source.state().stage,
      ghosts: ghostBoundaries(),
    });
    bindings.update({ probe: values });
  };
  let diorama: ValleyDiorama | null = null;
  let arrows: AttachedBlockArrows | null = null;
  const sync = () => {
    const st = source.state();
    const b = shownBoundary();
    const ghosts = ghostBoundaries();
    publish();
    for (const [k, input] of pickerInputs) input.checked = k === b;
    stageInput.step = String(st.reducedMotion ? 1 / (st.stops.length - 1) : 1 / STAGE_STEPS);
    stageInput.value = String(st.stage);
    stageInput.disabled = !b;
    const word = t(copy.controls[stageWord(st.stage)]);
    writeAttribute(stageInput, "aria-valuetext", b ? `${word} stage` : t(copy.controls.noBoundary));
    writeAttribute(
      stageInput,
      "aria-label",
      `${t(copy.controls.stageLegend)}, ${t(copy.controls.early)} to ${t(copy.controls.late)}`,
    );
    writeText(stageOutput, b ? word : "");
    writeText(playButton, st.playing ? t(copy.controls.pause) : t(copy.controls.play));
    playButton.setAttribute("aria-pressed", String(st.playing));
    playButton.disabled = !b;
    invite.hidden = b !== null;
    writeText(scaleLine, bound(t(copy.figure.scale)));
    // Ghost key: one line per ghost, in the diorama's drawing order, with its glyph and dash sample.
    const keyId = ghosts.join(",") + `|${level}|${getLanguage()}`;
    if (ghostKey.dataset.key !== keyId) {
      ghostKey.dataset.key = keyId;
      ghostKey.replaceChildren();
      if (ghosts.length) {
        ghostKey.append(el("span", "ps-ghost-key-title", t(copy.controls.ghostsLegend)));
        ghosts.forEach((g, i) => {
          const item = el("span", "ps-ghost-item");
          item.dataset.boundary = g;
          item.insertAdjacentHTML("beforeend", ghostSampleSvg(i));
          item.insertAdjacentHTML("beforeend", boundaryGlyphSvg(g));
          // The pattern words are for listeners; the sample beside the name shows the pattern to the eye.
          item.append(
            el("span", undefined, t(copy.boundaries[g].name)),
            el("span", "ps-ghost-pattern", ` (${GHOST_PATTERN_WORDS[i]})`),
          );
          ghostKey.append(item);
        });
      }
    }
    ghostKey.hidden = ghosts.length === 0 || !diorama;
    for (const id of ["left", "right"])
      arrows?.setDirection(id, b ? directionFor(b, id as "left" | "right") : null);
    renderDrawing();
    desk.dataset.boundary = b ?? "none";
    desk.dataset.stage = String(st.stage);
    desk.dataset.stageWord = stageWord(st.stage);
    desk.dataset.playing = String(st.playing);
    desk.dataset.ghosts = ghosts.join(",");
    desk.dataset.viewed = st.viewed.join(",");
    desk.dataset.reducedMotion = String(st.reducedMotion);
    if (!diorama) renderLens();
  };
  const announce = () => {
    writeText(
      status,
      describeScene({
        boundary: shownBoundary(),
        stage: source.state().stage,
        cutFraction: cut,
        ghosts: ghostBoundaries(),
        copy,
        level,
        render: bound,
      }),
    );
  };

  // The enlarged front face, shown only in the static fallback (the block's front face shows it otherwise).
  let lensModule: typeof GlacialInk | null = null;
  const renderLens = () => {
    if (!lensModule || lens.hidden) return;
    const snap = source.frame();
    const row = Math.min(snap.rows - 1, Math.max(2, Math.round(cut * (snap.rows - 1))));
    const pick = (s: LandscapeSnapshot, f: ArrayLike<number> | undefined) =>
      f ? Array.from({ length: s.columns }, (_, c) => f[row * s.columns + c]!) : undefined;
    const acrossM = Array.from({ length: snap.columns }, (_, c) => c * snap.metresPerCell);
    const ghosts = source.ghosts();
    writeMarkup(
      lens,
      lensModule.sectionLensSvg(
        {
          acrossM,
          bedM: pick(snap, snap.bedM)!,
          startBedM: pick(sequence.start, sequence.start.bedM)!,
          crustBaseM: pick(snap, snap.crustBaseM),
          coverBaseM: pick(snap, snap.coverBaseM),
          startCrustBaseM: pick(sequence.start, sequence.start.crustBaseM),
          ghosts: ghosts.map((g) => ({
            bedM: pick(g.frame, g.frame.bedM)!,
            crustBaseM: pick(g.frame, g.frame.crustBaseM),
            label: t(copy.boundaries[asBoundary(g.key)!].name),
          })),
          look: { id: 10, key: "sandstone", ...LAYER_LOOKS.sandstone! },
        },
        {
          idPrefix: "ps-lens",
          verticalScale: reliefScale,
          title: `${t(copy.controls.frontFace)}, ${t(copy.controls.stageLegend).toLowerCase()}`,
          words: { start: "start", cover: "rock layers", crust: "crust", mantle: "mantle" },
        },
      ),
    );
  };

  renderWords();
  sync();
  announce();

  // ---- Commands: the page picker, play/pause, scrub, reset ----
  const choose = (b: PlateBoundary) => {
    source.dispatch({ kind: "choose", key: b });
    announce();
  };
  for (const [b, input] of pickerInputs)
    input.addEventListener("change", () => {
      if (input.checked) choose(b);
    });
  playButton.onclick = () => {
    source.dispatch({ kind: source.state().playing ? "pause" : "play" });
    announce();
  };
  stageInput.addEventListener("input", () =>
    source.dispatch({ kind: "set-stage", stage: Number(stageInput.value) }),
  );
  stageInput.addEventListener("change", () => announce());
  resetButton.onclick = () => {
    source.dispatch({ kind: "reset" });
    announce();
  };
  let unsubscribe = source.subscribe(() => undefined);
  let lastPlaying = source.state().playing;
  // The reader's motion setting can change while the page is open; the stage then steps, or plays, to match (7G).
  const onMotion = () => source.dispatch({ kind: "set-reduced-motion", reduced: reducedMotion() });
  motionQuery.addEventListener("change", onMotion);

  // ---- Static fallback when 3D is off or unavailable ----
  // The study desk under the book (6G): decoration, the same desk as lesson 1.
  const studyDesk = mountStudyDesk(book);
  const stageModule = o.staticOnly ? null : await import("@hachure/ink/stage").catch(() => null);
  const binding = stageModule?.createBookBinding(book);
  let disposed = false;
  let unsubscribeLanguage = () => {};
  const disposeAll = async () => {
    unsubscribeLanguage();
    if (disposed) return;
    disposed = true;
    motionQuery.removeEventListener("change", onMotion);
    binding?.dispose();
    studyDesk.dispose();
    reading.dispose();
    unsubscribe();
    if (ownsSequence) source.dispose();
    root.replaceChildren();
    root.classList.remove("gs-review", "ps-scene");
  };
  unsubscribeLanguage = onLanguageChange(() => {
    presentation = { ...presentation, flapOpen: flap.open };
    o.onPresentation?.(presentation);
    renderWords();
    sync();
    announce();
    refreshLanguage(root);
  });
  refreshLanguage(root);
  let depart = async (_options: { readonly reducedMotion: boolean; readonly signal: AbortSignal }) => {};
  let enter = () => {};
  const handle = (dispose: () => Promise<void>): MountedPlatesScene => ({
    returnToDrawing: (options) => depart(options),
    startEntrance: () => enter(),
    dispose,
    setLevel(next) {
      if (next === level) return;
      level = next;
      renderWords();
      sync();
      announce();
    },
  });
  const showStatic = async (why: string, short: string) => {
    o.onStatic?.(short);
    drawing.style.opacity = "1";
    drawing.style.filter = "";
    controls.hidden = true;
    desk.dataset.static = "true";
    desk.dataset.ready = "true";
    diorama = null;
    lensModule = await import("@hachure/ink/glacial").catch(() => null);
    lens.hidden = !lensModule;
    renderLens();
    const note = el("p", "gs-limit ps-static-note", why);
    figure.after(note);
  };
  const subscribeStatic = () => {
    unsubscribe();
    unsubscribe = source.subscribe(() => {
      sync();
      const playing = source.state().playing;
      if (playing !== lastPlaying) announce();
      lastPlaying = playing;
      o.onChange?.();
    });
  };
  if (!stageModule) {
    await showStatic(
      "Drawing only. The enlarged front face below shows the boundary chosen, at the stage shown.",
      "3D is off here",
    );
    subscribeStatic();
    const stopStatic = (await import("@hachure/runtime")).driveSequence(source);
    return handle(async () => {
      stopStatic();
      await disposeAll();
    });
  }

  // ---- The 3D stage ----
  const [transition, platesInk] = await Promise.all([
    import("@hachure/ink/transition"),
    import("@hachure/ink/plates"),
  ]);
  const { createBookStage, createValleyDiorama } = stageModule;
  const lithologies: LithologyLook[] = [...config.start.layers, config.start.basement].map((l) => ({
    id: l.rockId,
    key: l.key.replace(/\s+/g, "-"),
    ...LAYER_LOOKS[l.key]!,
  }));
  let traceColumn: number | null = null;
  const dio = createValleyDiorama({
    lithologies,
    reliefScale,
    // One bedding band per start layer, so the layers (and their offset) read at page size (7C's choice).
    patternTileM: config.start.layers[0]!.thicknessM,
    dressing: {
      snowlineM: config.dressing.snowlineM,
      treelineM: config.dressing.treelineM,
      treeDensity: TREE_DENSITY,
      maxTreeSlopeDeg: MAX_TREE_SLOPE_DEG,
    },
    rules: platesDressingRules({
      reliefScale,
      faultTraceColumn: () => traceColumn,
      clearColumn: (config.grid.columns - 1) / 2,
      treeClearHalfWidthCells: TREE_CLEAR_HALF_WIDTH_CELLS,
    }),
  });
  diorama = dio;
  dio.setElevationRange(frame);
  const bookStage = createBookStage({
    host: desk,
    book,
    anchor: frameEl,
    diorama: dio,
    tiltDeg: PLATES_TILT_DEG,
    pitchDeg: PLATES_BLOCK_PITCH_DEG,
    // D-W6-6G: the same fit as lesson 1, so the book keeps its size at the turn.
    fit: BOOK_FIT,
    mode: o.mode ?? "auto",
    backend: o.backend ?? "auto",
    onContextLost: () => {
      source.dispatch({ kind: "pause" });
      bookStage.dispose();
      void showStatic(
        "3D stopped on this device; the drawing and the enlarged front face show the same scene.",
        "3D stopped on this device",
      );
    },
  });
  const turbulence = desk.querySelector("feDisplacementMap")!;
  let transitionDone = false;
  let lastTransitionState: TransitionState = transition.DRAWING_STATE;
  const applyState = (s: TransitionState) => {
    lastTransitionState = { ...s };
    bookStage.applyTransition(s);
    drawing.style.opacity = String(s.drawingOpacity);
    turbulence.setAttribute("scale", (s.drawingRoughness * 9).toFixed(2));
    drawing.style.filter = s.drawingRoughness > 0.01 && s.drawingOpacity > 0.01 ? "url(#ps-sketch)" : "";
    overlay.style.opacity = String(s.colour);
    desk.dataset.transitionPhase = s.phase;
  };
  const overlay = el("div", "ps-overlay");
  overlay.setAttribute("aria-hidden", "false");
  root.append(overlay);
  let running: TransitionRun | null = null;
  const play = (quick = false) => {
    running?.cancel();
    transitionDone = false;
    desk.dataset.transition = "running";
    running = transition.runTransition(applyState, {
      reducedMotion: quick || reducedMotion(),
      restingHachure: RESTING_HACHURE,
    });
    // The entrance never makes the reader wait: the first press of a key or pointer ends it (D-W6-6H).
    transition.skipOnInput(running);
    void running.done.then((completed) => {
      if (!completed) return;
      transitionDone = true;
      desk.dataset.transition = "done";
      announce();
    });
  };
  try {
    await bookStage.mount();
  } catch (error) {
    bookStage.dispose();
    dio.dispose();
    overlay.remove();
    await showStatic(
      `3D is not available here (${error instanceof Error ? error.message : String(error)}); the drawing and the enlarged front face show the same scene.`,
      "3D is not available here",
    );
    subscribeStatic();
    const stopStatic = (await import("@hachure/runtime")).driveSequence(source);
    return handle(async () => {
      stopStatic();
      await disposeAll();
    });
  }
  desk.dataset.backend = bookStage.backend ?? "";
  desk.dataset.mode = bookStage.mode;

  // The front-face slider moves one grid row per step.
  const along = () => source.frame().rows;
  {
    const cells = along() - 1;
    cutInput.step = String(1 / cells);
    cutInput.min = String(Math.round(0.12 * cells) / cells);
    cutInput.value = String(cut);
  }
  const cutRow = () => Math.min(along() - 1, Math.max(2, Math.round(cut * (along() - 1))));
  const describeCut = () => writeAttribute(cutInput, "aria-valuetext", cutWords(cut));
  describeCut();
  dio.setCut(cut);
  applyState(transition.DRAWING_STATE);

  // ---- Drawing the source's frame: coalesced to one rebuild per animation frame ----
  let shownFrame: LandscapeSnapshot | null = null;
  let shownGhosts = "";
  let pending = 0;
  // Frames are memoised per quantised stage (sequence.ts), so identity tells whether anything changed.
  const frameIds = new WeakMap<LandscapeSnapshot, number>();
  let nextFrameId = 0;
  const frameId = (f: LandscapeSnapshot) => {
    let id = frameIds.get(f);
    if (id === undefined) frameIds.set(f, (id = nextFrameId++));
    return id;
  };
  /** Time spent redrawing the block per animation frame (unit: ms), the last 240 draws (perf note). */
  const drawTimes: number[] = [];
  const draw = () => {
    pending = 0;
    const began = performance.now();
    const f = source.frame();
    const ghostFrames = source.ghosts().map((g) => g.frame);
    traceColumn = shownBoundary() === "transform" ? (f.columns - 1) / 2 : null;
    let changed = false;
    if (f !== shownFrame) {
      shownFrame = f;
      dio.setSnapshot(f, sequence.start);
      changed = true;
    }
    const gk = ghostFrames.map(frameId).join(",");
    if (gk !== shownGhosts) {
      shownGhosts = gk;
      dio.setGhosts(ghostFrames);
      changed = true;
    }
    placeOverlay(true);
    if (changed) {
      drawTimes.push(performance.now() - began);
      if (drawTimes.length > 240) drawTimes.shift();
    }
    // While playing, generate the next frames (shown and ghosts) in idle time, so the next draw only
    // rebuilds the block.
    const st = source.state();
    if (st.playing && !prefetching) {
      prefetching = true;
      const next = quantiseStage(st.stage) + 1 / STAGE_STEPS;
      const keys = [st.key, ...source.ghosts().map((g) => g.key)].flatMap((k) =>
        asBoundary(k) ? [asBoundary(k)!] : [],
      );
      idle(() => {
        prefetching = false;
        for (const k of keys) sequence.prefetch(k, next);
      });
    }
  };
  let prefetching = false;
  const idle = (fn: () => void) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 60 }) : setTimeout(fn, 0);
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(draw);
  };
  traceColumn = shownBoundary() === "transform" ? (source.frame().columns - 1) / 2 : null;
  shownFrame = source.frame();
  dio.setSnapshot(shownFrame, sequence.start);
  dio.setGhosts(source.ghosts().map((g) => g.frame));
  await bookStage.renderNow();
  unsubscribe();
  unsubscribe = source.subscribe(() => {
    sync();
    schedule();
    const playing = source.state().playing;
    if (playing !== lastPlaying) announce();
    lastPlaying = playing;
    o.onChange?.();
  });
  const stopDrive = (await import("@hachure/runtime")).driveSequence(source);

  // ---- On-block gestures: plate arrows (→ `choose`) and the front-face drag (→ the cut slider) ----
  const fp = () => dio.footprint();
  /** Block-local Y of an elevation on the shown block (the stage's own frame, from its footprint). */
  const blockY = (hM: number) => {
    const p = fp();
    return p ? p.heightM - (frame.maxM - hM) * reliefScale : 0;
  };
  const anchorFor = (side: "left" | "right") => (): readonly [number, number, number] | null => {
    const p = fp();
    const snap = shownFrame;
    if (!p || !snap || !transitionDone) return null;
    const c = Math.round((side === "left" ? 0.24 : 0.76) * (snap.columns - 1));
    const r = Math.round(cutRow() * 0.55);
    const h = snap.bedM[r * snap.columns + c]!;
    return [
      (c - (snap.columns - 1) / 2) * snap.metresPerCell,
      blockY(h + 350),
      (r - (snap.rows - 1) / 2) * snap.metresPerCell,
    ];
  };
  function directionFor(b: PlateBoundary, side: "left" | "right"): BlockDirection {
    if (b === "transform") return { axis: "along", sign: side === "right" ? 1 : -1 };
    const towards = side === "left" ? 1 : -1;
    return { axis: "across", sign: (b === "convergent" ? towards : -towards) as 1 | -1 };
  }
  /** The boundary a plate's arrow asks for: towards the boundary, away from it, or along it. */
  const boundaryFor = (side: "left" | "right", d: BlockDirection): PlateBoundary => {
    if (d.axis === "along") return "transform";
    const towards = side === "left" ? d.sign > 0 : d.sign < 0;
    return towards ? "convergent" : "divergent";
  };
  let dragging = false;
  arrows = platesInk.attachBlockArrows({
    stage: bookStage,
    diorama: dio,
    layer: overlay,
    handles: [
      { id: "left", label: t(copy.controls.leftPlateArrow), anchor: anchorFor("left") },
      { id: "right", label: t(copy.controls.rightPlateArrow), anchor: anchorFor("right") },
    ],
    describedBy: arrowHelp.id,
    arrowFraction: 0.3,
    enabled: () => transitionDone,
    onDragChange: (d) => {
      dragging = d;
      desk.classList.toggle("ps-dragging-arrow", d);
    },
    onGesture: (id, d) => choose(boundaryFor(id as "left" | "right", d)),
  });
  renderArrowLabels();
  const cutDragModule = await import("@hachure/ink/glacial");
  const setCut = (fraction: number, speak: boolean) => {
    cut = fraction;
    cutInput.value = String(cut);
    dio.setCut(cut);
    describeCut();
    placeOverlay(true);
    if (speak) announce();
  };
  cutInput.oninput = () => setCut(Number(cutInput.value), false);
  cutInput.onchange = () => announce();
  const cutDrag = cutDragModule.attachCutDrag({
    stage: bookStage,
    diorama: dio,
    surface: desk,
    rows: along,
    minFraction: () => Number(cutInput.min),
    enabled: () => transitionDone,
    onCut: (fraction) => {
      if (fraction !== cut) setCut(fraction, false);
    },
    onDragEnd: () => announce(),
  });
  const viewControls = createViewControls(bookStage, stageModule.BOOK_VIEW_LIMITS, root, desk, {
    claimsPointer: (event) => dragging || arrows!.claims(event) || cutDrag.claims(event),
  });
  const hint = root.querySelector(".gs-view-hint");
  if (hint)
    writeText(
      hint,
      "Drag a plate's arrow to choose how the plates move · Drag the scene to turn · Drag the front face to move it",
    );
  replay.onclick = () => play();

  // ---- Ghost leaders: a fine ink line from each ghost profile on the front face to its entry in the ghost key,
  // which sits on the page under the face, so the labels never cover the face or leave the page (D-W7-7G). ----
  const leaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  leaderSvg.setAttribute("class", "ps-ghost-leaders");
  leaderSvg.setAttribute("aria-hidden", "true");
  overlay.append(leaderSvg);
  const placeGhostLeaders = () => {
    const p = fp();
    const snap = shownFrame;
    const ghosts = source.ghosts();
    if (!p || !snap || !transitionDone || !ghosts.length || ghostKey.hidden) {
      leaderSvg.replaceChildren();
      return;
    }
    const r = cutRow();
    const at = overlay.getBoundingClientRect();
    const f = (v: number) => v.toFixed(1);
    let paths = "";
    ghosts.forEach((g, i) => {
      const b = asBoundary(g.key);
      const sample = b && ghostKey.querySelector(`.ps-ghost-item[data-boundary="${b}"] .ps-ghost-sample`);
      if (!b || !sample) return;
      // The leader ends on the profile where it clearly differs from the shown one (at least 60 % of its
      // largest difference), at the point nearest its key entry, so leaders stay short and steep; where the
      // profiles coincide, it ends along the right of the face.
      const box = sample.getBoundingClientRect();
      const keyX = box.left + box.width / 2;
      const diff = (col: number) =>
        Math.abs(g.frame.bedM[r * snap.columns + col]! - snap.bedM[r * snap.columns + col]!);
      let gap = 0;
      for (let col = 4; col < snap.columns - 4; col += 2) gap = Math.max(gap, diff(col));
      const cols: number[] = [];
      if (gap >= 80) {
        for (let col = 4; col < snap.columns - 4; col += 2) if (diff(col) >= gap * 0.6) cols.push(col);
      } else cols.push(Math.round((0.6 + 0.12 * i) * (snap.columns - 1)));
      const z = (r - (snap.rows - 1) / 2) * snap.metresPerCell;
      const pts = bookStage.projectBlockPoints(
        cols.map((col) => [
          (col - (snap.columns - 1) / 2) * snap.metresPerCell,
          blockY(g.frame.bedM[r * snap.columns + col]!),
          z,
        ]),
      );
      let pt: { x: number; y: number } | null = null;
      for (const q of pts) if (q && (!pt || Math.abs(q.x - keyX) < Math.abs(pt.x - keyX))) pt = q;
      if (!pt) return;
      const [ax, ay] = [pt.x - at.left, pt.y - at.top];
      const [bx, by] = [box.left + box.width / 2 - at.left, box.top - at.top];
      const d = `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
      paths +=
        `<g data-boundary="${b}"><path class="ps-leader-halo" d="${d}"/><path class="ps-leader" d="${d}"/>` +
        `<circle class="ps-leader-dot" cx="${f(ax)}" cy="${f(ay)}" r="2.6"/></g>`;
    });
    writeMarkup(leaderSvg, paths);
  };
  // ---- The scale bar along the block's front edge (its label is the bound `scaleBarLabel`) ----
  const scaleSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  scaleSvg.setAttribute("class", "ps-scale-bar");
  scaleSvg.setAttribute("aria-hidden", "true");
  overlay.append(scaleSvg);
  const placeScaleBar = () => {
    const p = fp();
    if (!p || !transitionDone) {
      scaleSvg.replaceChildren();
      return;
    }
    const x0 = -p.widthM / 2;
    const [a, b] = bookStage.projectBlockPoints([
      [x0, 0, p.frontZ],
      [x0 + scaleKm * 1000, 0, p.frontZ],
    ]);
    if (!a || !b) return;
    const at = overlay.getBoundingClientRect();
    const f = (v: number) => v.toFixed(1);
    const [ax, ay, bx, by] = [a.x - at.left, a.y - at.top + 12, b.x - at.left, b.y - at.top + 12];
    writeMarkup(
      scaleSvg,
      `<path d="M${f(ax)} ${f(ay - 5)}V${f(ay)}L${f(bx)} ${f(by)}V${f(by - 5)}"/>` +
        `<text x="${f(bx + 6)}" y="${f(by + 4)}">${scaleKm} km</text>`,
    );
  };
  let overlayKey = "";
  const placeOverlay = (force = false) => {
    const r = bookStage.canvas.getBoundingClientRect();
    const v = bookStage.view;
    const key = `${r.left.toFixed(0)},${r.top.toFixed(0)},${r.width.toFixed(0)},${r.height.toFixed(0)},${v.tiltDeg},${v.orbitDeg},${v.zoom},${bookStage.mode},${transitionDone},${cut},${source.state().frameSerial},${level},${ghostKey.dataset.key ?? ""},${ghostKey.hidden}`;
    if (!force && key === overlayKey) return;
    overlayKey = key;
    // Keep the overlay to the desk's visible box, so handles never sit over the reader's chrome.
    const d = desk.getBoundingClientRect();
    overlay.style.clipPath = `inset(${Math.max(0, d.top)}px ${Math.max(0, innerWidth - d.right)}px ${Math.max(0, innerHeight - d.bottom)}px ${Math.max(0, d.left)}px)`;
    arrows?.update();
    placeGhostLeaders();
    placeScaleBar();
  };
  let overlayFrame = 0;
  const overlayLoop = () => {
    placeOverlay();
    overlayFrame = requestAnimationFrame(overlayLoop);
  };
  overlayFrame = requestAnimationFrame(overlayLoop);

  // Automation hooks (browser tests and capture scripts), as lesson 1's.
  Object.defineProperty(desk, "blockScreenGeometry", {
    configurable: true,
    value: () => cutDragModule.blockScreenGeometry(bookStage, dio),
  });
  // Freezes the entrance at a time after its start (unit: milliseconds); "Replay the drawing" plays again.
  Object.defineProperty(desk, "seekEntrance", {
    configurable: true,
    value: (elapsedMs: number) => {
      running?.cancel();
      applyState(
        transition.transitionStateAt(elapsedMs, {
          ...transition.DEFAULT_TRANSITION_TIMING,
          restingHachure: RESTING_HACHURE,
        }),
      );
    },
  });
  Object.defineProperty(desk, "plateArrowTargets", { configurable: true, value: () => arrows!.targets() });
  Object.defineProperty(desk, "drawTimings", {
    configurable: true,
    value: () => ({ drawMs: [...drawTimes], framesGenerated: sequence.generated() }),
  });
  desk.dataset.ready = "true";
  sync();
  enter = () => play(o.quickTransition === true);
  depart = async (options) => {
    running?.cancel();
    transitionDone = false;
    desk.dataset.transition = "returning";
    running = transition.runReturnToDrawing(applyState, lastTransitionState, {
      ...options,
      reducedMotion: options.reducedMotion || reducedMotion(),
    });
    await running.done;
    desk.dataset.transition = "flat";
  };
  if (o.deferEntrance) {
    applyState(transition.DRAWING_STATE);
    desk.dataset.transition = "flat";
  } else enter();

  return handle(async () => {
    cancelAnimationFrame(overlayFrame);
    if (pending) cancelAnimationFrame(pending);
    stopDrive();
    arrows?.dispose();
    cutDrag.dispose();
    viewControls.dispose();
    running?.cancel();
    overlay.remove();
    bookStage.dispose();
    dio.dispose();
    await disposeAll();
  });
}
