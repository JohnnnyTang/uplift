/**
 * The glacial scene (session 5K production scene, on the 5H book stage approved at R1; joined to the live
 * runtime and the 5L lesson by session 5M): the lesson spread on a desk, the book tilted in 3D, Fig. 1 as a
 * textbook line drawing that transitions into the naturally coloured diorama standing on the right page.
 * Flat fallback on phones, reduced motion and large zoom.
 *
 * What is shown comes from a `GlacialSceneSource` (source.ts): in the book, the live glacier runtime (5J); on
 * the review route, 5G2's recorded runs. The scene draws the shown snapshot and the compared run's ghost and
 * sends every reader action on runs and time to the source. Dressing is read from model state
 * (`@hachure/ink/glacial`); the front face is a live cross-section with the dashed starting V, a kept run's
 * dotted ghost and an enlarged lens; margin notes average three columns; direct gestures mirror page controls
 * (specimen onto the block → the rock command; drag the front face → the front-face slider; drag the scene →
 * the R2 view sliders).
 *
 * Words are session 5L's (`@uplift/spreads`, geomorph.u-valley), rendered through the spread's declared
 * probes: every number on the page is a binding fed from the shown snapshot, the compared snapshot or the
 * model config, never typed.
 *
 * Route: `?review=glacial-stage`. Options for review captures: `&mode=flat|tilted`, `&motion=reduce`,
 * `&backend=webgl2|webgpu`, `&cut=0..1` (or `&column=<grid column>`), `&rock=<model rock id>`,
 * `&kept=<rock>[,<rock>]`, `&frame=<index>`, `&static=1` (drawing only, as without WebGL), `&fixture=1`
 * (the authored fixture instead of the recorded runs), `&level=uni`.
 */
import "./review.css";
import { BindingEngine, type BoundValue, type Level, createDisplayFormula } from "@hachure/runtime";
import { ROCK_TYPES, isRockId } from "@hachure/glacier";
import {
  U_VALLEY_VIEW,
  noteSpanM,
  roundForNote,
  uValleyDeeperText,
  uValleyLesson as L,
  uValleyPage,
  uValleyProbes,
  uValleySpread,
  uValleyTeacherNotes,
} from "@uplift/spreads";
import { createViewControls } from "./view-controls";
import { createReadingPanel } from "./reading-panel";
import type { LithologyLook, ValleyDiorama } from "@hachure/ink/stage";
import {
  type AttachedGesture,
  GLACIAL_DRESSING_RULES,
  attachCutDrag,
  attachSpecimenDrag,
  blockScreenGeometry,
  sectionLensSvg,
} from "@hachure/ink/glacial";
import type { TransitionRun, TransitionState } from "@hachure/ink/transition";
import {
  GLACIAL_DRAWING_DESCRIPTION,
  type GlacialDrawingFeature,
  type GlacialDrawingLabel,
  glacialDrawingSvg,
} from "./drawing";
import { combinedRange, fixtureRun, loadReviewRuns, type ReviewRun, type ReviewSection } from "./runs";
import { type RockCommand, createLocalRockCommand } from "./commands";
import { km, shapeWords } from "./notes";
import { type GlacialSceneSource, type SceneGhost, type SceneShown, createRecordedSource } from "./source";

/** Vertical scale of the scene (unit: none). Bound into the caption. */
const RELIEF_SCALE = 1;
/**
 * Vertical scale of the enlarged front face (unit: none). Bound into its label. Exaggerated so the floor and
 * lower walls read at page size; the shape exponent b of a power-law profile does not change with it.
 */
const LENS_VERTICAL_SCALE: number = 2;
/** Book tilt (unit: degrees). Frozen at 48° (D-W5-R2; D-W5-R1a item 3). */
// A lower sight line exposes the valley walls; readers can raise or rotate the view.
const TILT_DEG = 48;
/** Rock run shown first on the review route (a model rock id); the middle of the soft → hard set. */
const DEFAULT_ROCK = "sandstone";
/**
 * The default front face, from the spread config (D-W5-R1 item 4: i = 51, every rock). A display choice,
 * never a claim: the registered section stays i = 74.
 */
export const REVIEW_DEFAULT_CUT_COLUMN = U_VALLEY_VIEW.defaultFrontFace.gridColumn;

/** 5L's Fig. 1 label features, in the drawing's feature names. */
const LABEL_FEATURES: Readonly<Record<string, GlacialDrawingFeature>> = {
  "valley-head": "valleyHead",
  glacier: "glacier",
  snout: "snout",
  "u-valley": "uValley",
  "v-valley": "vValley",
  "valley-floor": "valleyFloor",
};

export interface MountedReview {
  dispose(): Promise<void>;
}

export interface MountedGlacialScene extends MountedReview {
  /** Changes words, visible controls and overlays only; never the source or a run. */
  setLevel(level: Level): void;
}

/** Reader choices on the left page, retained across page turns by the book. */
export interface GlacialPagePresentation {
  readonly prediction: number | null;
  readonly flapOpen: boolean;
}

export interface GlacialSceneContext {
  readonly looks: readonly LithologyLook[];
  lookIdFor(rockKey: string): number;
}

export interface GlacialSceneOptions {
  /** Front face on opening, as a grid column along the valley axis (from the spread config). */
  readonly defaultCutColumn?: number | undefined;
  /** Front face on opening as a fraction of the valley from the head (review captures); wins over the column. */
  readonly cutFraction?: number | undefined;
  /** Model rock id of the run shown first (recorded source). Default sandstone. */
  readonly rock?: string | undefined;
  /** Rocks whose runs start as kept runs, newest first (recorded source, review captures). */
  readonly kept?: readonly string[] | undefined;
  /** Recorded snapshot shown first (recorded source). Default the last. */
  readonly frame?: number | undefined;
  readonly mode?: "flat" | "tilted" | "auto" | undefined;
  /** Force reduced motion (otherwise the media query decides). */
  readonly reducedMotion?: boolean | undefined;
  readonly backend?: "auto" | "webgl2" | "webgpu" | undefined;
  /** Drawing only, as without WebGL. */
  readonly staticOnly?: boolean | undefined;
  /** The authored fixture instead of the recorded runs. */
  readonly fixture?: boolean | undefined;
  /** Fig. 1 label words. Default: the spread's (5L). */
  readonly drawingLabels?: readonly GlacialDrawingLabel[] | undefined;
  /** The rock command of the recorded source. Default: the local stand-in over recorded runs. */
  readonly createRockCommand?:
    ((runs: readonly ReviewRun[], initial: ReviewRun, kept: readonly ReviewRun[]) => RockCommand) | undefined;
  /** The source of what is shown (the book passes the live runtime, 5M). Default: the recorded runs. */
  readonly createSource?: ((context: GlacialSceneContext) => Promise<GlacialSceneSource>) | undefined;
  /** Disposes the source with the scene. Default true; the book keeps its live source across page turns. */
  readonly ownsSource?: boolean | undefined;
  readonly level?: Level | undefined;
  /** Page numbers of the two pages, from the book. Default the review build's. */
  readonly folios?: readonly [number, number] | undefined;
  /** Mounted inside the book shell (no document title). */
  readonly embedded?: boolean | undefined;
  /** Play the drawing → scene transition as a short crossfade (returning to an already-seen spread). */
  readonly quickTransition?: boolean | undefined;
  readonly presentation?: GlacialPagePresentation | undefined;
  readonly onPresentation?: ((presentation: GlacialPagePresentation) => void) | undefined;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Reader paragraphs from 5L's markdown: blank-line paragraphs, **bold** runs. */
function paragraphs(text: string, render: (t: string) => string): HTMLElement[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const p = el("p");
      for (const [k, part] of render(block).split(/\*\*/).entries())
        p.append(k % 2 ? el("b", undefined, part) : document.createTextNode(part));
      return p;
    });
}

/** An irregular rock chip outline, filled with the rock's lithology pattern (from the shared tile). */
function specimenSvg(look: LithologyLook, patternSvg: string): string {
  const id = `gs-litho-${look.key}`;
  return `<svg viewBox="0 0 38 30" aria-hidden="true"><defs>${patternSvg}</defs><path d="M4 18 L8 7 L19 3 L31 6 L35 16 L29 26 L14 27 Z" fill="url(#${id})"/><path class="gs-chip-outline" d="M4 18 L8 7 L19 3 L31 6 L35 16 L29 26 L14 27 Z"/></svg>`;
}

/** SVG displacement filter used to make the drawing's lines go sketchy during the transition. */
function sketchFilter(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="gs-sketch" x="-5%" y="-5%" width="110%" height="110%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/>' +
    '<feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
  return svg;
}

/** Dash patterns that tell runs apart without colour in the deeper-level graphs (live run first). */
const SERIES_DASHES = ["", "6 3", "1.5 3"];

/**
 * A small line graph of one section measure over model time, one line per run, each labelled at its end with
 * its rock and drawn with its own dash pattern (non-colour cue). Axis ends are read from the data.
 */
function seriesGraph(
  title: string,
  unit: string,
  lines: readonly { readonly label: string; readonly points: readonly [number, number][] }[],
): HTMLElement {
  const figure = el("figure", "gs-graph");
  figure.append(el("figcaption", undefined, title));
  const all = lines.flatMap((l) => l.points);
  if (all.length < 2) {
    figure.append(el("p", undefined, "Play a run to draw this graph."));
    return figure;
  }
  const W = 260;
  const H = 120;
  const left = 34;
  const right = 78;
  const top = 8;
  const bottom = 22;
  const xMax = Math.max(...all.map((p) => p[0]), 1);
  const yMin = Math.min(0, ...all.map((p) => p[1]));
  const yMax = Math.max(...all.map((p) => p[1]), yMin + 1);
  const x = (v: number) => left + (v / xMax) * (W - left - right);
  const y = (v: number) => H - bottom - ((v - yMin) / (yMax - yMin)) * (H - top - bottom);
  const round = (v: number) => String(Math.round(v));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}, ${unit}, against model time">`;
  svg += `<path class="gs-graph-axis" d="M${left} ${top}V${H - bottom}H${W - right}"/>`;
  svg += `<text x="${left - 4}" y="${y(yMax) + 4}" text-anchor="end">${round(yMax)}</text>`;
  svg += `<text x="${left - 4}" y="${y(yMin) + 4}" text-anchor="end">${round(yMin)}</text>`;
  svg += `<text x="${left}" y="${H - 6}">0</text>`;
  svg += `<text x="${W - right}" y="${H - 6}" text-anchor="end">${round(xMax)} model years</text>`;
  svg += `<text x="2" y="${top + 6}">${unit}</text>`;
  lines.forEach((line, k) => {
    if (!line.points.length) return;
    const d = line.points
      .map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`)
      .join("");
    const dash = SERIES_DASHES[k % SERIES_DASHES.length];
    svg += `<path class="gs-graph-line" d="${d}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
    const end = line.points.at(-1)!;
    svg += `<text x="${x(end[0]) + 4}" y="${y(end[1]) + 4 + k * 9}">${line.label}</text>`;
  });
  svg += "</svg>";
  const holder = el("div");
  holder.innerHTML = svg;
  figure.append(holder);
  return figure;
}

/** Reads the review route's URL into scene options. */
export function reviewOptionsFromSearch(search: string): GlacialSceneOptions {
  const params = new URLSearchParams(search);
  const num = (key: string) => (params.has(key) ? Number(params.get(key)) : undefined);
  const mode = params.get("mode");
  const backend = params.get("backend");
  const reduce = params.get("motion") === "reduce";
  return {
    defaultCutColumn: num("column") ?? REVIEW_DEFAULT_CUT_COLUMN,
    cutFraction: num("cut"),
    rock: params.get("rock") ?? undefined,
    kept: params.get("kept")?.split(",").filter(Boolean),
    frame: num("frame"),
    mode: mode === "flat" || mode === "tilted" ? mode : reduce ? "flat" : "auto",
    reducedMotion: reduce || undefined,
    backend: backend === "webgl2" || backend === "webgpu" ? backend : "auto",
    staticOnly: params.get("static") === "1",
    fixture: params.get("fixture") === "1",
    level: params.get("level") === "uni" ? "uni" : "hs",
  };
}

export function mountGlacialStageReview(root: HTMLElement, search: string): Promise<MountedReview> {
  return mountGlacialScene(root, reviewOptionsFromSearch(search));
}

export async function mountGlacialScene(
  root: HTMLElement,
  o: GlacialSceneOptions,
): Promise<MountedGlacialScene> {
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => o.reducedMotion === true || motionQuery.matches;
  let cut = Number.isFinite(o.cutFraction) ? Math.min(1, Math.max(0, o.cutFraction!)) : 1;
  let level: Level = o.level ?? "hs";
  let presentation: GlacialPagePresentation = o.presentation ?? { prediction: null, flapOpen: false };
  const t = (text: { readonly hs: string; readonly uni: string }) => text[level];
  const [folioText, folioFigure] = o.folios ?? [2, 3];
  const bindings = new BindingEngine({ probes: uValleyProbes, controls: [] });
  const bound = (template: string) => bindings.render(template);

  root.replaceChildren();
  root.classList.add("gs-review");
  if (!o.embedded) document.title = "From V to U · review build";

  // ---- DOM: desk, book, spread. Painted before three.js loads; the drawing is the static fallback. ----
  const desk = el("div", "gs-desk");
  const book = el("div", "gs-book");
  const boards = el("div", "gs-boards");
  boards.setAttribute("aria-hidden", "true");
  const spread = el("article", "gs-spread");
  spread.setAttribute("aria-labelledby", "gs-title");

  const textPage = el("section", "gs-page gs-page-text");
  const textHead = el("p", "gs-running-head");
  textPage.append(textHead);
  const column = el("div", "gs-text-column");
  const lesson = el("div", "gs-lesson");
  // expert-review: 5L's lesson words (uplift/spreads/geomorph.u-valley), claims registered in claims.ts.
  lesson.append(document.createComment(" expert-review "));
  const lessonNumber = el("p", "gs-lesson-number");
  const h1 = el("h1");
  h1.id = "gs-title";
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
  const deeperTriggers = el("div", "gs-deeper-triggers");
  lesson.append(introduction, keywords, question, flap, deeperTriggers);
  const margin = el("aside", "gs-margin");
  margin.setAttribute("aria-label", "Margin notes");
  const challenge = el("p", "gs-challenge");
  const marginColumn = el("div", "gs-margin-column");
  marginColumn.append(margin, challenge);
  column.append(lesson, marginColumn);
  textPage.append(column, el("p", "gs-folio", String(folioText)));

  const figurePage = el("section", "gs-page gs-page-figure");
  const figureHead = el("p", "gs-running-head");
  figurePage.append(figureHead);
  const figure = el("figure", "gs-figure");
  figure.setAttribute("aria-labelledby", "gs-fig-caption");
  const frame = el("div", "gs-frame");
  const drawing = el("div", "gs-drawing");
  const drawingLabels = (): readonly GlacialDrawingLabel[] =>
    o.drawingLabels ??
    L.figure.labels.flatMap((l) =>
      LABEL_FEATURES[l.feature] ? [{ feature: LABEL_FEATURES[l.feature]!, text: t(l.text) }] : [],
    );
  frame.append(drawing);
  // The front face, enlarged: the same section as the block's cut face, drawn in 2D at legible size.
  const lens = el("div", "gs-lens");
  lens.hidden = true;
  const lensTitle = el("p", "gs-lens-title");
  const lensDrawing = el("div", "gs-lens-drawing");
  lens.append(lensTitle, lensDrawing);
  const caption = el("figcaption");
  caption.id = "gs-fig-caption";
  const captionText = el("span");
  const scale = el("span", "gs-scale");
  caption.append(captionText, scale);
  const figureFoot = el("div", "gs-fig-foot");
  figureFoot.append(caption, lens);
  figure.append(frame, figureFoot);

  const tray = el("fieldset", "gs-tray");
  const trayLegend = el("legend");
  tray.append(trayLegend);
  const trayNote = el("p", "gs-limit gs-tray-note");

  // Time ruler: one tick per recorded snapshot of the live run.
  const timeline = el("fieldset", "gs-timeline");
  const timeLegend = el("legend");
  timeline.append(timeLegend);
  const playButton = el("button", "gs-play");
  playButton.type = "button";
  const stepButton = el("button", "gs-step", "Step");
  stepButton.type = "button";
  const timeInput = el("input");
  timeInput.type = "range";
  timeInput.min = "0";
  timeInput.step = "1";
  timeInput.id = "gs-time";
  timeInput.setAttribute("aria-label", "Recorded time");
  const ruler = el("div", "gs-ruler");
  const rulerEnds = el("div", "gs-ruler-ends");
  rulerEnds.setAttribute("aria-hidden", "true");
  ruler.append(timeInput, rulerEnds);
  const timeOutput = el("output", "gs-time-now");
  timeOutput.htmlFor.add("gs-time");
  const liveButton = el("button", "gs-back-to-live");
  liveButton.type = "button";
  const speedLabel = el("label", "gs-speed");
  const speedInput = el("input");
  speedInput.type = "range";
  const speedControl = uValleySpread.controls.find((c) => c.kind === "speed");
  if (speedControl?.kind === "speed") {
    speedInput.min = String(speedControl.min);
    speedInput.max = String(speedControl.max);
    speedInput.step = String(speedControl.step);
    speedInput.value = String(speedControl.default);
  }
  speedLabel.append(el("span", undefined, "Speed"), speedInput);
  // The live run opens paused at its start (D-W5-5M2); this line invites Play until the run moves.
  const playInvite = el("p", "gs-play-invite");
  playInvite.id = "gs-play-invite";
  timeline.append(playButton, stepButton, ruler, timeOutput, liveButton, speedLabel, playInvite);

  const controls = el("div", "gs-controls");
  const replay = el("button", undefined, "Replay the drawing");
  replay.type = "button";
  const cutLabel = el("label");
  const cutName = el("span");
  const cutInput = el("input");
  cutInput.type = "range";
  cutInput.min = "0.12";
  cutInput.max = "1";
  cutInput.step = "0.01";
  cutInput.value = String(cut);
  cutLabel.append(cutName, cutInput);
  const iceLabel = el("label");
  const iceInput = el("input");
  iceInput.type = "checkbox";
  const iceName = el("span");
  iceLabel.append(iceInput, iceName);
  const resetButton = el("button", "gs-reset");
  resetButton.type = "button";
  controls.append(replay, cutLabel, iceLabel, resetButton);
  const confirmRow = el("p", "gs-confirm");
  confirmRow.hidden = true;
  const compare = el("fieldset", "gs-compare");
  compare.hidden = true;
  const notice = el("p", "gs-notice");
  notice.hidden = true;
  const limit = el("p", "gs-limit");
  const provenance = el("span", "gs-provenance");
  limit.append(provenance);
  const status = el("p", "gs-sr");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  figurePage.append(
    figure,
    tray,
    trayNote,
    timeline,
    compare,
    controls,
    confirmRow,
    notice,
    limit,
    status,
    el("p", "gs-folio", String(folioFigure)),
  );

  spread.append(textPage, figurePage);
  book.append(boards, spread);
  desk.append(book, sketchFilter());
  root.append(desk);

  // The deeper level and the sources stay off the paper; their reading copies open in the upright panel.
  const offPaper = el("div");
  offPaper.hidden = true;
  const deeper = el("div", "gs-deeper");
  const sourcesRegion = el("div", "gs-sources");
  offPaper.append(deeper, sourcesRegion);
  root.append(offPaper);

  const reading = createReadingPanel(root);
  // Upright reading copies keep the original lesson and live notes on the paper.
  const readingRegion = (source: HTMLElement, title: string) => {
    const region = el("div", "gs-reading-region");
    source.replaceWith(region);
    region.append(source);
    reading.add(source, title);
  };
  readingRegion(introduction, "Lesson");
  readingRegion(keywords, "Key words");
  readingRegion(flap, "Question and explanation");
  readingRegion(margin, "Live notes");
  const deeperTrigger = el("span");
  const sourcesTrigger = el("span");
  deeperTriggers.append(deeperTrigger, sourcesTrigger);
  reading.add(deeper, "Deeper level", deeperTrigger);
  reading.add(sourcesRegion, "Sources, limits and teacher notes", sourcesTrigger);
  desk.dataset.stageMode = "flat";
  timeline.hidden = true;

  // ---- Level-dependent words (5L). The model and the runs never change here. ----
  function renderSources() {
    const list = el("ul");
    for (const item of uValleyPage.ignores[level]) list.append(el("li", undefined, item));
    const sources = el("ul", "gs-source-list");
    for (const s of uValleySpread.sources) {
      const li = el("li");
      const href = s.url ?? (s.doi ? `https://doi.org/${s.doi}` : undefined);
      if (href) {
        const a = el("a", undefined, s.citation);
        a.href = href;
        li.append(a);
      } else li.textContent = s.citation;
      sources.append(li);
    }
    sourcesRegion.replaceChildren(
      el("h3", undefined, "What this model ignores"),
      list,
      el("h3", undefined, "Teacher notes"),
      ...paragraphs(uValleyTeacherNotes.replace(/^#.*$/gm, ""), (x) => x),
      el("h3", undefined, "Sources"),
      sources,
    );
  }
  const renderWords = () => {
    textHead.textContent = `Lesson ${L.LESSON_NUMBER} · ${t(L.runningHeads.text)}`;
    figureHead.textContent = t(L.runningHeads.figure);
    lessonNumber.textContent = `Lesson ${L.LESSON_NUMBER}`;
    h1.textContent = t(L.title);
    body.replaceChildren(...paragraphs(t(uValleyPage.body), bound));
    keywords.replaceChildren();
    for (const k of L.keyWords)
      keywords.append(el("dt", undefined, t(k.term)), el("dd", undefined, t(k.definition)));
    question.replaceChildren(el("legend", undefined, t(L.predict.question)));
    L.predict.options.forEach((option, index) => {
      const label = el("label");
      const input = el("input");
      input.type = "radio";
      input.name = "gs-prediction";
      input.value = String(index);
      input.checked = presentation.prediction === index;
      label.append(input, el("span", undefined, t(option)));
      question.append(label);
    });
    flapSummary.textContent = "Lift the flap for the answer";
    flapAnswer.replaceChildren(...paragraphs(t(uValleyPage.flap), bound));
    flap.open = presentation.flapOpen;
    challenge.textContent = t(L.challenge);
    captionText.replaceChildren(el("span", "gs-fig-number", `Fig. ${L.FIGURE_NUMBER}`), t(L.figure.caption));
    drawing.innerHTML = glacialDrawingSvg({ idPrefix: "gs-fig", labels: drawingLabels() });
    trayLegend.textContent = t(L.controlsCopy.rockLegend);
    timeLegend.textContent = t(L.controlsCopy.timeLegend);
    playInvite.textContent = t(L.controlsCopy.playInvite);
    liveButton.textContent = t(L.controlsCopy.backToLive);
    cutName.textContent = t(L.controlsCopy.frontFace);
    iceName.textContent = t(L.controlsCopy.underIce);
    resetButton.textContent = uValleySpread.controls.find((c) => c.id === "reset")?.label[level] ?? "";
    stepButton.hidden = level !== "uni";
    deeperTrigger.hidden = level !== "uni";
    for (const label of tray.querySelectorAll<HTMLElement>(".gs-specimen")) {
      const rock = L.rocks.find((r) => r.id === label.dataset.rock);
      if (!rock) continue;
      label.querySelector(".gs-rock-name")!.textContent = t(rock.name);
      label.querySelector(".gs-rock-hardness")!.textContent = t(rock.hardness);
      label.title = t(rock.help);
    }
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

  // ---- three.js loads only now, after the page and its drawing have painted. ----
  const lithologyModule = await import("@hachure/ink/stage").catch(() => null);
  const binding = lithologyModule?.createBookBinding(book);
  const looks: readonly LithologyLook[] = lithologyModule?.PROVISIONAL_LITHOLOGIES ?? [];
  const lookIdFor = (rockKey: string) => {
    const look = looks.find((l) => l.key === rockKey);
    if (!look) throw new Error(`no lithology look for rock "${rockKey}"`);
    return look.id;
  };
  let source: GlacialSceneSource;
  let loadError: string | null = null;
  if (o.createSource && lithologyModule) source = await o.createSource({ looks, lookIdFor });
  else {
    const loaded =
      o.fixture || !lithologyModule ? { runs: [fixtureRun()], error: null } : await loadReviewRuns(lookIdFor);
    loadError = loaded.error;
    const runs = loaded.runs;
    const requestedRock = o.rock ?? DEFAULT_ROCK;
    const initialRun: ReviewRun = runs.find((r) => r.rockKey === requestedRock) ?? runs[0]!;
    const keptRuns = (o.kept ?? []).flatMap((k) => runs.filter((r) => r.rockKey === k && r !== initialRun));
    const command = (o.createRockCommand ?? createLocalRockCommand)(runs, initialRun, keptRuns);
    source = createRecordedSource(runs, command, { frame: o.frame, combinedRange: combinedRange(runs) });
  }
  const ownsSource = o.ownsSource ?? true;
  const measured = source.kind !== "fixture";

  // The front-face slider moves one grid cell per step, so each arrow key press shows the next section.
  const along = () => {
    const s = source.shown().snapshot;
    return source.orientation.valleyAxis === "columns" ? s.columns : s.rows;
  };
  {
    const cells = along() - 1;
    cutInput.step = String(1 / cells);
    cutInput.min = String(Math.round(0.12 * cells) / cells);
    if (!Number.isFinite(o.cutFraction) && o.defaultCutColumn !== undefined && measured && lithologyModule) {
      // The grid column counted along the valley, turned into the block row from the head (same mapping).
      const row = lithologyModule.valleyGridIndex(source.orientation, cells + 1, o.defaultCutColumn);
      cut = row / cells;
    }
    cut = Math.max(Number(cutInput.min), Math.round(cut * cells) / cells);
    cutInput.value = String(cut);
  }
  /** Block row of the front face, as the diorama clamps it (`clampCutRow`). */
  const cutRow = () => Math.min(along() - 1, Math.max(2, Math.round(cut * (along() - 1))));
  /** Grid index along the valley under the front face. */
  const cutColumn = () =>
    lithologyModule ? lithologyModule.valleyGridIndex(source.orientation, along(), cutRow()) : cutRow();

  for (const look of looks) {
    if (measured && !source.rocks.includes(look.key)) continue;
    const label = el("label", "gs-specimen");
    label.dataset.rock = look.key;
    if (measured) label.dataset.gesture = "specimen";
    const input = el("input");
    input.type = "radio";
    input.name = "gs-rock";
    input.value = String(look.id);
    label.innerHTML = specimenSvg(
      look,
      lithologyModule!.lithologyPatternSvg(look, `gs-litho-${look.key}`, 9),
    );
    label.prepend(input);
    const words = el("span", "gs-rock-words");
    words.append(el("span", "gs-rock-name", look.name), el("span", "gs-rock-hardness"));
    label.append(words);
    tray.append(label);
  }
  renderWords();

  // ---- Bound values: every number the page shows is a probe of the spread (5L bindings.ts). ----
  let diorama: ValleyDiorama | null = null;
  let pendingRock: string | null = null;
  const lookFor = (rockId: number) => looks.find((l) => l.id === rockId);
  const rockName = (rockKey: string, rockId: number) =>
    (L.rocks.find((r) => r.id === rockKey)?.name[level] ?? lookFor(rockId)?.name ?? rockKey).toLowerCase();
  const publish = (shown: SceneShown, ghost: SceneGhost | null) => {
    const col = cutColumn();
    const values: Record<string, BoundValue> = {};
    const s = shown.section(col);
    if (shown.modelYears !== null) values.modelTime = shown.modelYears;
    values.rockName = rockName(shown.run.rockKey, shown.run.rockId);
    values.faceDistance = (cutRow() * shown.snapshot.metresPerCell) / 1000;
    if (s) {
      values.floorWidth = roundForNote(s.floorWidthM);
      values.valleyDepth = roundForNote(s.depthM);
      values.floorLowered = roundForNote(s.floorLoweredM);
      values.steepestWall = Math.round(s.steepestWallDeg);
      values.iceThickness = roundForNote(s.iceThicknessM);
      if (Number.isFinite(s.shapeExponent)) values.shapeExponent = s.shapeExponent;
    }
    const basin = shown.overdeepening(col);
    // One overdeepening probe, 5K's (D-W5-R1a item 1): the floor rise carved since the start.
    if (basin) values.adverseRise = roundForNote(Math.max(0, basin.carvedRiseM));
    const ks: ReviewSection | null = ghost ? ghost.section(col) : null;
    if (ghost) {
      values.keptRockName = rockName(ghost.run.rockKey, ghost.run.rockId);
      values.keptModelTime = ghost.modelYears;
    }
    if (ks) {
      values.keptFloorWidth = roundForNote(ks.floorWidthM);
      values.keptValleyDepth = roundForNote(ks.depthM);
      values.keptFloorLowered = roundForNote(ks.floorLoweredM);
      values.keptSteepestWall = Math.round(ks.steepestWallDeg);
      if (Number.isFinite(ks.shapeExponent)) values.keptShapeExponent = ks.shapeExponent;
    }
    values.sectionSpan = noteSpanM(shown.snapshot.metresPerCell);
    values.noteRounding = U_VALLEY_VIEW.marginNotes.roundToM;
    values.overdeepenedThreshold = U_VALLEY_VIEW.overdeepenedNote.minAdverseRiseM;
    const backend = source.backend();
    if (backend)
      values.backend = backend.fallbackReason
        ? `${backend.backend} (${backend.fallbackReason})`
        : backend.backend;
    const config = source.modelConfig();
    if (config) {
      for (const probe of uValleyProbes) {
        const v =
          probe.request.kind === "glacier-config"
            ? config.model[probe.field ?? ""]
            : probe.request.kind === "glacier-run" && probe.field === "snapshotIntervalYears"
              ? config.snapshotIntervalYears
              : undefined;
        if (typeof v === "number" && Number.isFinite(v)) values[probe.id] = v;
      }
    }
    if (isRockId(shown.run.rockKey)) {
      const rock = ROCK_TYPES[shown.run.rockKey];
      values.rockErodibility = rock.relativeErodibility;
      values.rockCriticalWall = rock.criticalWallSlopeDeg;
    }
    bindings.update({ probe: values });
    return { section: s, keptSection: ks, overdeepened: basin?.overdeepened === true };
  };

  // ---- Deeper level (university): bound parameters, equations, run graphs. ----
  let deeperKey = "";
  const renderDeeper = (force: boolean) => {
    if (level !== "uni" || !measured) {
      if (deeperKey) deeper.replaceChildren();
      deeperKey = "";
      return;
    }
    const col = cutColumn();
    const runs = source.series(col);
    const key = `${col}|${runs.map((r) => `${r.run.id}:${r.points.length}`).join(",")}|${bound(uValleyDeeperText)}`;
    if (!force && key === deeperKey) return;
    deeperKey = key;
    const lines = (pick: (s: ReviewSection) => number) =>
      runs.map((r) => ({
        label: `${rockName(r.run.rockKey, r.run.rockId)}${r.run.ordinal !== null ? ` ${r.run.ordinal}` : ""}`,
        points: r.points.flatMap((p) =>
          p.section ? [[p.modelYears, pick(p.section)] as [number, number]] : [],
        ),
      }));
    const graphs = el("div", "gs-graphs");
    graphs.append(
      seriesGraph(
        "Floor lowered under the front face",
        "m",
        lines((s) => s.floorLoweredM),
      ),
      seriesGraph(
        "Valley depth",
        "m",
        lines((s) => s.depthM),
      ),
      seriesGraph(
        "Floor width",
        "m",
        lines((s) => s.floorWidthM),
      ),
      seriesGraph(
        "Steepest wall",
        "degrees",
        lines((s) => s.steepestWallDeg),
      ),
    );
    const equations = el("div", "gs-equations");
    for (const tex of uValleyPage.equations) equations.append(createDisplayFormula(tex));
    deeper.replaceChildren(...paragraphs(uValleyDeeperText, bound), equations, graphs);
  };

  // ---- Bound text ----
  const describe = () => {
    const d = diorama?.describe();
    const shown = source.shown();
    const ghost = source.ghost();
    const col = cutColumn();
    const facts = publish(shown, ghost);
    const throughIce = d ? d.frontFaceCutsIce : (facts.section?.iceThicknessM ?? 0) > 0;
    const conditions = {
      always: true,
      "past-view": shown.past,
      "face-under-ice": throughIce,
      "face-below-snout": !throughIce,
      "kept-run": !!facts.keptSection,
      overdeepened: facts.overdeepened,
    } as const;
    const notes: HTMLElement[] = [];
    if (!measured) notes.push(el("p", undefined, "authored fixture: no model time"));
    else
      for (const n of L.marginNotes) {
        if (!n.levels.includes(level) || !conditions[n.when]) continue;
        if (!facts.section && ["floor", "lowered", "wall", "shape", "face-ice"].includes(n.id)) continue;
        const p = el("p", undefined, bound(t(n.text)));
        p.dataset.note = n.id;
        if (n.id === "compare") {
          p.className = "gs-note-kept";
          p.prepend(el("span", "gs-ghost-key", "···· "));
        }
        // expert-review: D-W5-R1a item 1; the words are 5L's.
        if (n.id === "overdeepened") p.className = "gs-note-overdeepened";
        notes.push(p);
      }
    const ghostNote = source.ghostNote();
    if (ghostNote) notes.push(el("p", "gs-note-kept", ghostNote));
    margin.replaceChildren(...notes);
    scale.textContent = RELIEF_SCALE === 1 ? "True vertical scale" : `Vertical scale ×${RELIEF_SCALE}`;
    // The page's single limitation line (guardrail): the spread's own words, once.
    provenance.textContent =
      source.kind === "fixture"
        ? `${source.provenance}. ${shown.label}.${loadError ? ` Recorded runs did not load: ${loadError}.` : ""}`
        : `${source.provenance}, ${rockName(shown.run.rockKey, shown.run.rockId)}. ${t(L.figure.limitation)}`;
    trayNote.textContent = !measured
      ? "Rock look preview. In the lesson a rock choice starts a new run from the same starting valley."
      : `${t(L.controlsCopy.rockHelp)} ${t(L.controlsCopy.newRun)}`;
    // While a rock command is in flight the reader's choice stays checked (the run follows when it starts).
    for (const input of tray.querySelectorAll<HTMLInputElement>("input[name=gs-rock]"))
      input.checked = pendingRock
        ? looks.find((l) => l.id === Number(input.value))?.key === pendingRock
        : Number(input.value) === shown.run.rockId;
    // The enlarged front face (measured runs only).
    const profile = shown.profile(col);
    const look = lookFor(shown.run.rockId);
    lens.hidden = !profile || !look;
    if (profile && look) {
      const ghostProfile = ghost ? ghost.profile(col) : null;
      lensTitle.textContent = `Front face, enlarged · ${LENS_VERTICAL_SCALE === 1 ? "true scale" : `vertical ×${LENS_VERTICAL_SCALE}`}`;
      lensDrawing.innerHTML = sectionLensSvg(
        {
          acrossM: profile.acrossM,
          bedM: profile.bedM,
          iceM: d && !d.iceShown ? undefined : profile.iceM,
          startBedM: profile.startBedM,
          ghost:
            ghost && ghostProfile ? { bedM: ghostProfile.bedM, label: bound(t(L.controlsCopy.ghost)) } : null,
          look,
        },
        {
          idPrefix: "gs-lens",
          verticalScale: LENS_VERTICAL_SCALE,
          words: { start: "starting V", ice: "ice" },
        },
      );
    }
    desk.dataset.cutColumn = String(col);
    desk.dataset.liveRock = shown.run.rockKey;
    desk.dataset.ghost = ghost ? ghost.run.rockKey : "";
    desk.dataset.overdeepened = facts.overdeepened ? "true" : "false";
    desk.dataset.view = shown.past ? "past" : "live";
    desk.dataset.modelYears = String(shown.modelYears ?? "");
    desk.dataset.runId = shown.run.id;
    // Timeline.
    const tl = source.timeline();
    timeline.hidden = !measured || !diorama;
    timeInput.max = String(Math.max(0, tl.times.length - 1));
    timeInput.value = String(tl.index);
    timeInput.disabled = tl.times.length < 2;
    timeInput.setAttribute("aria-valuetext", shown.label);
    timeline.style.setProperty("--gs-ticks", String(Math.max(1, tl.times.length - 1)));
    rulerEnds.replaceChildren(
      el("span", undefined, String(tl.times[0] ?? "")),
      el("span", undefined, String(tl.times.at(-1) ?? "")),
    );
    timeOutput.textContent =
      shown.past && source.kind === "live" ? bound(t(L.controlsCopy.earlier)) : shown.label;
    liveButton.hidden = tl.atLive || source.kind !== "live";
    desk.dataset.playing = String(tl.playing);
    desk.dataset.runStatus = tl.status;
    playButton.textContent = tl.playing ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", String(tl.playing));
    playButton.disabled = source.kind === "live" && tl.status !== "active" && tl.atLive;
    playButton.title =
      source.kind === "live" && tl.status === "complete"
        ? "This run is complete. Choose another rock or start again."
        : "";
    stepButton.disabled = playButton.disabled;
    const invite =
      source.kind === "live" && tl.atLive && !tl.playing && tl.status === "active" && !shown.modelYears;
    playInvite.hidden = !invite;
    playButton.dataset.invite = String(invite);
    if (invite) playButton.setAttribute("aria-describedby", playInvite.id);
    else playButton.removeAttribute("aria-describedby");
    speedLabel.hidden = source.kind !== "live";
    speedInput.value = String(source.speed());
    speedInput.setAttribute("aria-valuetext", `${source.speed()} times`);
    iceInput.disabled = !d || d.iceReachFraction === 0;
    if (iceInput.disabled && iceInput.checked) {
      iceInput.checked = false;
      diorama?.setIceVisible(true);
    }
    cutInput.value = String(cut);
    const where = km(cutRow() * shown.snapshot.metresPerCell);
    cutInput.setAttribute(
      "aria-valuetext",
      `${where} down the valley, ${throughIce ? "through the ice" : "below the snout"}`,
    );
    // Compare chooser and notices.
    const kept = source.kept();
    compare.hidden = !kept.length;
    const comparedId = source.comparedId();
    const wanted = ["none", ...kept.map((k) => k.id)].join(",");
    if (compare.dataset.runs !== wanted) {
      compare.dataset.runs = wanted;
      compare.replaceChildren(el("legend", undefined, "Ghost line"));
      for (const k of [...kept, null]) {
        const label = el("label");
        const input = el("input");
        input.type = "radio";
        input.name = "gs-compare";
        input.value = k?.id ?? "";
        const name = k
          ? `${rockName(k.rockKey, k.rockId)}${k.ordinal !== null ? `, run ${k.ordinal}` : ""}`
          : "none";
        label.append(input, el("span", undefined, name));
        compare.append(label);
      }
    }
    for (const input of compare.querySelectorAll<HTMLInputElement>("input"))
      input.checked = input.value === (comparedId ?? "");
    const n = source.notice();
    notice.hidden = !n;
    notice.replaceChildren();
    if (n?.kind === "dropped") notice.textContent = t(L.controlsCopy.droppedRun);
    if (n?.kind === "halted") {
      notice.append(n.message, " ");
      if (source.offersCpuRestart()) {
        const restart = el("button", undefined, "Start a new run on the CPU");
        restart.type = "button";
        restart.onclick = () => void source.restartOnCpu();
        notice.append(restart);
      }
    }
    renderDeeper(false);
  };

  const announce = () => {
    const d = diorama?.describe();
    if (!d) return;
    const shown = source.shown();
    const ghost = source.ghost();
    const col = cutColumn();
    const s = shown.section(col);
    const parts: string[] = [];
    // expert-review: 5L's text-alternative templates; the shape sentence reads the registered shape fit.
    parts.push(bound(t(L.textAlternatives.sceneReady)));
    parts.push(bound(t(d.iceReachFraction > 0 ? L.textAlternatives.glacier : L.textAlternatives.noIce)));
    parts.push(
      `The front face of the block stands ${km(d.cutAlongIndex * shown.snapshot.metresPerCell)} down the valley.`,
    );
    if (!d.iceShown) parts.push(bound(t(L.textAlternatives.iceHidden)));
    if (d.frontFaceCutsIce && s) parts.push(bound(t(L.textAlternatives.profileUnderIce)));
    else if (!d.frontFaceCutsIce) parts.push(bound(t(L.textAlternatives.profileBelowSnout)));
    const shape = s ? shapeWords(s.shapeExponent) : null;
    if (shape && s)
      parts.push(
        `Its cross-section is ${shape} (shape ${s.shapeExponent.toFixed(1)}; a V is about 1, a U about 2).`,
      );
    if (ghost && ghost.section(col)) parts.push(bound(t(L.textAlternatives.compare)));
    if (shown.past) parts.push(bound(t(L.textAlternatives.earlier)));
    if (shown.overdeepening(col)?.overdeepened) parts.push(bound(t(L.textAlternatives.overdeepened)));
    status.textContent = parts.join(" ");
  };
  describe();

  // ---- Static fallback when 3D is off or unavailable ----
  const staticOnly = o.staticOnly || !lithologyModule;
  let unsubscribe = () => {};
  const disposeAll = async () => {
    binding?.dispose();
    reading.dispose();
    unsubscribe();
    if (ownsSource) source.dispose();
    root.replaceChildren();
    root.classList.remove("gs-review");
  };
  const showStatic = (why: string) => {
    drawing.style.opacity = "1";
    drawing.style.filter = "";
    controls.hidden = true;
    timeline.hidden = true;
    tray.disabled = true;
    trayNote.textContent = why;
    desk.dataset.static = "true";
    status.textContent = `Fig. ${L.FIGURE_NUMBER}: ${t(L.figure.drawingAlternative) || GLACIAL_DRAWING_DESCRIPTION}`;
  };
  const handle = (dispose: () => Promise<void>): MountedGlacialScene => ({
    dispose,
    setLevel(next) {
      if (next === level) return;
      level = next;
      renderWords();
      describe();
      renderDeeper(true);
      announce();
    },
  });
  if (staticOnly) {
    showStatic(
      lithologyModule
        ? "Drawing only (static view). The enlarged front face shows the run."
        : t(L.textAlternatives.staticFallback),
    );
    return handle(disposeAll);
  }

  // ---- The 3D stage ----
  const [stageModule, transition] = await Promise.all([
    import("@hachure/ink/stage"),
    import("@hachure/ink/transition"),
  ]);
  const { createBookStage, createValleyDiorama } = stageModule;
  // Every run shares one grid orientation and one snowline (the model config); the block's vertical frame
  // covers all runs, so switching rock or time never resizes it.
  const dio = createValleyDiorama({
    reliefScale: RELIEF_SCALE,
    dressing: source.dressing,
    orientation: source.orientation,
    rules: GLACIAL_DRESSING_RULES,
  });
  diorama = dio;
  dio.setElevationRange(source.elevationRangeM);
  const bookStage = createBookStage({
    host: desk,
    book,
    anchor: frame,
    diorama: dio,
    tiltDeg: TILT_DEG,
    mode: o.mode ?? "auto",
    backend: o.backend ?? "auto",
    onContextLost: () => {
      void source.pause().catch(() => undefined);
      bookStage.dispose();
      showStatic(t(L.textAlternatives.staticFallback));
    },
  });
  const turbulence = desk.querySelector("feDisplacementMap")!;
  let transitionDone = false;
  const applyState = (s: TransitionState) => {
    bookStage.applyTransition(s);
    drawing.style.opacity = String(s.drawingOpacity);
    turbulence.setAttribute("scale", (s.drawingRoughness * 9).toFixed(2));
    drawing.style.filter = s.drawingRoughness > 0.01 && s.drawingOpacity > 0.01 ? "url(#gs-sketch)" : "";
    // The lens joins the scene when the colour arrives; the drawing alone stays uncluttered.
    lens.style.opacity = String(s.colour);
  };
  let running: TransitionRun | null = null;
  const play = (quick = false) => {
    running?.cancel();
    transitionDone = false;
    desk.dataset.transition = "running";
    running = transition.runTransition(applyState, { reducedMotion: quick || reducedMotion() });
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
    showStatic(
      `3D is not available here (${error instanceof Error ? error.message : String(error)}); the drawing shows the same valley.`,
    );
    return handle(disposeAll);
  }
  desk.dataset.backend = bookStage.backend ?? "";
  dio.setCut(cut);
  applyState(transition.DRAWING_STATE);
  let shownKey = "";
  let ghostKey = "";
  const showNow = () => {
    const shown = source.shown();
    const ghost = source.ghost();
    if (shown.key !== shownKey) {
      shownKey = shown.key;
      dio.setSnapshot(shown.snapshot, shown.start);
    }
    const gk = ghost?.key ?? "";
    if (gk !== ghostKey) {
      ghostKey = gk;
      dio.setGhost(ghost?.snapshot ?? null);
    }
  };
  showNow();
  describe();
  await bookStage.renderNow();

  // ---- The source drives the figure: every published change redraws it. ----
  let lastPlaying = source.timeline().playing;
  let lastRun = source.shown().run.id;
  let lastPast = source.shown().past;
  unsubscribe = source.subscribe(() => {
    showNow();
    describe();
    const shown = source.shown();
    const playing = source.timeline().playing;
    // Speak when a run starts or stops, or a moment is chosen; not on every frame while playing.
    if (playing !== lastPlaying || shown.run.id !== lastRun || shown.past !== lastPast) announce();
    lastPlaying = playing;
    lastRun = shown.run.id;
    lastPast = shown.past;
  });

  // ---- Controls (all view-only, except the commands sent to the source) ----
  const setCut = (fraction: number, speak: boolean) => {
    cut = fraction;
    dio.setCut(cut);
    describe();
    if (speak) announce();
  };
  const act = (work: Promise<unknown>) =>
    void work.catch((error: unknown) => {
      status.textContent = `That did not work: ${error instanceof Error ? error.message : String(error)}`;
    });
  replay.onclick = () => play();
  playButton.onclick = () => act(source.timeline().playing ? source.pause() : source.play());
  stepButton.onclick = () => act(source.step());
  liveButton.onclick = () => act(source.returnToLive().then(() => playButton.focus()));
  speedInput.oninput = () => act(source.setSpeed(Number(speedInput.value)));
  timeInput.oninput = () => act(source.scrubTo(Number(timeInput.value)));
  cutInput.oninput = () => setCut(Number(cutInput.value), true);
  iceInput.onchange = () => {
    dio.setIceVisible(!iceInput.checked);
    describe();
    announce();
  };
  const chooseRock = (rockKey: string) => {
    pendingRock = rockKey;
    act(
      source.chooseRock(rockKey).finally(() => {
        pendingRock = null;
        describe();
      }),
    );
  };
  tray.onchange = (event) => {
    const id = Number((event.target as HTMLInputElement).value);
    const look = looks.find((l) => l.id === id);
    if (look && measured) chooseRock(look.key);
    else {
      dio.setRockLook(id);
      announce();
    }
  };
  compare.onchange = (event) => act(source.compare((event.target as HTMLInputElement).value || null));
  const hideConfirm = () => {
    confirmRow.hidden = true;
    confirmRow.replaceChildren();
  };
  resetButton.onclick = () =>
    act(
      source.reset(false).then((result) => {
        if (result === "done") {
          status.textContent = "Back to the starting valley.";
          return;
        }
        const yes = el("button", undefined, "Remove them and start again");
        yes.type = "button";
        const no = el("button", undefined, "Keep my runs");
        no.type = "button";
        const count = source.kept().length;
        confirmRow.replaceChildren(
          `Starting again removes ${count === 1 ? "the kept run" : `all ${count} kept runs`}. `,
          yes,
          " ",
          no,
        );
        confirmRow.hidden = false;
        yes.focus();
        yes.onclick = () =>
          act(
            source.reset(true).then(() => {
              hideConfirm();
              resetButton.focus();
              status.textContent = "Back to the starting valley.";
            }),
          );
        no.onclick = () => {
          hideConfirm();
          resetButton.focus();
        };
      }),
    );

  // ---- Direct gestures, each the pointer twin of a control above ----
  const cutDrag: AttachedGesture = attachCutDrag({
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
    claimsPointer: (event) => cutDrag.claims(event),
  });
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.classList.add("gs-drop-overlay");
  overlay.setAttribute("aria-hidden", "true");
  root.append(overlay);
  const specimenDrag = measured
    ? attachSpecimenDrag({
        stage: bookStage,
        diorama: dio,
        specimens: () => Array.from(tray.querySelectorAll<HTMLElement>(".gs-specimen")),
        overlay,
        onDrop: chooseRock,
        reducedMotion,
        enabled: () => transitionDone && !tray.disabled,
      })
    : null;

  // Automation hook (browser tests and capture scripts): where the block is on screen, in client pixels.
  Object.defineProperty(desk, "blockScreenGeometry", {
    configurable: true,
    value: () => blockScreenGeometry(bookStage, dio),
  });
  desk.dataset.ready = "true";
  desk.dataset.source = source.kind;
  play(o.quickTransition === true);

  return handle(async () => {
    cutDrag.dispose();
    specimenDrag?.dispose();
    overlay.remove();
    viewControls.dispose();
    running?.cancel();
    bookStage.dispose();
    dio.dispose();
    await disposeAll();
  });
}
