/**
 * The glacial scene (session 5K production scene, on the 5H book stage approved at R1): the lesson spread on
 * a desk, the book tilted in 3D, Fig. 1 as a textbook line drawing that transitions into the naturally
 * coloured diorama standing on the right page, playing session 5G's recorded glacier runs (one per rock).
 * Flat fallback on phones, reduced motion and large zoom.
 *
 * 5K adds: dressing read from model state (`@hachure/ink/glacial`), the front face as a live cross-section
 * with the dashed starting V and a kept run's dotted ghost, an enlarged section lens, margin notes averaged
 * over three columns, the overdeepening note slot, and direct gestures that mirror page controls (specimen
 * onto the block → the rock command; drag the front face → the front-face slider; drag the scene → the R2
 * view sliders). `mountGlacialScene` takes typed options, so 5M can mount it in the default book;
 * `mountGlacialStageReview` reads the review route's URL into those options.
 *
 * Route: `?review=glacial-stage`. Options for review captures: `&mode=flat|tilted`, `&motion=reduce`,
 * `&backend=webgl2|webgpu`, `&cut=0..1` (or `&column=<grid column>`), `&rock=<model rock id>`,
 * `&kept=<rock>[,<rock>]`, `&frame=<index>`, `&static=1` (drawing only, as without WebGL), `&fixture=1`
 * (the authored fixture instead of the recorded runs).
 *
 * Page copy here is draft layout copy; session 5L writes the lesson. Numbers on the page are bound to the
 * recorded run (the model's own section probe), the snapshot or the stage config, never typed.
 */
import "./review.css";
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
import { GLACIAL_DRAWING_DESCRIPTION, type GlacialDrawingLabel, glacialDrawingSvg } from "./drawing";
import { type ReviewRun, type ReviewSection, combinedRange, fixtureRun, loadReviewRuns } from "./runs";
import { type RockCommand, type RunsState, createLocalRockCommand } from "./commands";
import { degrees, describeProfile, overdeepeningNote, km, metres } from "./notes";

/** Vertical scale of the scene (unit: none). Bound into the caption. */
const RELIEF_SCALE = 1;
/**
 * Vertical scale of the enlarged front face (unit: none). Bound into its label. Exaggerated so the floor and
 * lower walls read at page size; the shape exponent b of a power-law profile does not change with it.
 */
const LENS_VERTICAL_SCALE: number = 2;
/** Book tilt (unit: degrees). */
// A lower sight line exposes the valley walls; readers can raise or rotate the view.
const TILT_DEG = 48;
/** How long each recorded snapshot shows while a run plays (unit: milliseconds). Presentation only. */
const PLAY_FRAME_MS = 650;
/** Rock run shown first (a model rock id); the middle of the soft → hard set. */
const DEFAULT_ROCK = "sandstone";
/**
 * The review route's default front face, a grid column along the valley read against the capture manifest
 * (D-W5-R1 item 4: i = 51 at the last snapshot, every rock). A display choice, never a claim: the
 * registered section stays i = 74. In the book this value comes from the spread config (5L; wired by 5M).
 */
export const REVIEW_DEFAULT_CUT_COLUMN = 51;

export interface MountedReview {
  dispose(): Promise<void>;
}

export interface GlacialSceneOptions {
  /** Front face on opening, as a grid column along the valley axis (from the spread config). */
  readonly defaultCutColumn?: number | undefined;
  /** Front face on opening as a fraction of the valley from the head (review captures); wins over the column. */
  readonly cutFraction?: number | undefined;
  /** Model rock id of the run shown first. Default sandstone. */
  readonly rock?: string | undefined;
  /** Rocks whose runs start as kept runs, newest first (review captures). */
  readonly kept?: readonly string[] | undefined;
  /** Recorded snapshot shown first. Default the last. */
  readonly frame?: number | undefined;
  readonly mode?: "flat" | "tilted" | "auto" | undefined;
  /** Force reduced motion (otherwise the media query decides). */
  readonly reducedMotion?: boolean | undefined;
  readonly backend?: "auto" | "webgl2" | "webgpu" | undefined;
  /** Drawing only, as without WebGL. */
  readonly staticOnly?: boolean | undefined;
  /** The authored fixture instead of the recorded runs. */
  readonly fixture?: boolean | undefined;
  /** Fig. 1 label words (5L). Default: the R1 set. */
  readonly drawingLabels?: readonly GlacialDrawingLabel[] | undefined;
  /**
   * The rock command. Default: the local stand-in over recorded runs. 5M passes the runtime command here; the
   * page selector and the specimen gesture both call it.
   */
  readonly createRockCommand?:
    ((runs: readonly ReviewRun[], initial: ReviewRun, kept: readonly ReviewRun[]) => RockCommand) | undefined;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

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
  };
}

export function mountGlacialStageReview(root: HTMLElement, search: string): Promise<MountedReview> {
  return mountGlacialScene(root, reviewOptionsFromSearch(search));
}

export async function mountGlacialScene(root: HTMLElement, o: GlacialSceneOptions): Promise<MountedReview> {
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => o.reducedMotion === true || motionQuery.matches;
  let cut = Number.isFinite(o.cutFraction) ? Math.min(1, Math.max(0, o.cutFraction!)) : 1;

  root.replaceChildren();
  root.classList.add("gs-review");
  document.title = "From V to U · review build";

  // ---- DOM: desk, book, spread. Painted before three.js loads; the drawing is the static fallback. ----
  const desk = el("div", "gs-desk");
  const book = el("div", "gs-book");
  const boards = el("div", "gs-boards");
  boards.setAttribute("aria-hidden", "true");
  const spread = el("article", "gs-spread");
  spread.setAttribute("aria-labelledby", "gs-title");

  const textPage = el("section", "gs-page gs-page-text");
  textPage.append(el("p", "gs-running-head", "Lesson 1 · Glaciers"));
  const column = el("div", "gs-text-column");
  const lesson = el("div", "gs-lesson");
  // expert-review: draft layout copy for R1 (5L writes and sources the lesson). Topic sources: NPS,
  // "U-shaped valleys, fjords and hanging valleys"; NPS Yosemite geology. The rock sentence states only
  // what 5G's registered comparison supports (D-W5-5G item 8; docs/science/glacial/feasibility.md):
  // softer rock is lowered faster and deeper, harder rock keeps steeper walls. It does not claim a wider
  // floor in softer rock; the recorded runs do not order floor width by rock.
  lesson.append(document.createComment(" expert-review "));
  lesson.append(el("p", "gs-lesson-number", "Lesson 1"));
  const h1 = el("h1", undefined, "From V to U");
  h1.id = "gs-title";
  h1.tabIndex = -1;
  lesson.append(h1);
  lesson.append(
    el("p", undefined, "A river cuts a narrow valley shaped like a V."),
    el(
      "p",
      undefined,
      "When a glacier fills the valley, the ice slides over the rock and wears it away. Under the ice the valley is lowered and its lower walls are cut back, towards a U.",
    ),
    el(
      "p",
      undefined,
      "The rock matters. Soft rock wears away faster and deeper; hard rock wears slowly and keeps steeper walls.",
    ),
    el("p", undefined, "Choose the rock the valley is cut into, then watch what the ice does."),
  );
  const keywords = el("dl", "gs-keywords");
  for (const [term, meaning] of [
    ["glacier", "a large mass of ice that flows slowly downhill"],
    ["V-shaped valley", "a narrow valley cut by a river"],
    ["U-shaped valley", "a broad valley with steep sides, shaped by ice"],
    ["glacial erosion", "rock worn away by moving ice"],
    ["rock type", "what the rock is made of, and how hard it is"],
  ] as const)
    keywords.append(el("dt", undefined, term), el("dd", undefined, meaning));
  lesson.append(keywords);
  const flap = el("details", "gs-flap");
  const flapSummary = el(
    "summary",
    undefined,
    "Will the valley below the snout change shape too? Lift the flap.",
  );
  flap.append(
    flapSummary,
    el(
      "p",
      undefined,
      "Below the snout there is no ice sliding over the bed, so the glacier does not wear it away there: the river's V remains.",
    ),
  );
  lesson.append(flap);
  const margin = el("aside", "gs-margin");
  margin.setAttribute("aria-label", "Margin notes");
  column.append(lesson, margin);
  textPage.append(column, el("p", "gs-folio", "2"));

  const figurePage = el("section", "gs-page gs-page-figure");
  figurePage.append(el("p", "gs-running-head", "Glaciers shape valleys"));
  const figure = el("figure", "gs-figure");
  figure.setAttribute("aria-labelledby", "gs-fig-caption");
  const frame = el("div", "gs-frame");
  const drawing = el("div", "gs-drawing");
  drawing.innerHTML = glacialDrawingSvg({ idPrefix: "gs-fig", labels: o.drawingLabels ?? true });
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
  captionText.append(
    el("span", "gs-fig-number", "Fig. 1"),
    "A mountain valley with a glacier. The front of the block is a cross-section; the dashed line is the valley before the ice.",
  );
  const scale = el("span", "gs-scale");
  caption.append(captionText, scale);
  const figureFoot = el("div", "gs-fig-foot");
  figureFoot.append(caption, lens);
  figure.append(frame, figureFoot);

  const tray = el("fieldset", "gs-tray");
  tray.append(el("legend", undefined, "Rock"));
  const trayNote = el("p", "gs-limit");

  // Time ruler: one tick per recorded snapshot, read from the run.
  const timeline = el("fieldset", "gs-timeline");
  timeline.append(el("legend", undefined, "Time"));
  const playButton = el("button", "gs-play");
  playButton.type = "button";
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
  timeline.append(playButton, ruler, timeOutput);

  const controls = el("div", "gs-controls");
  const replay = el("button", undefined, "Replay the drawing");
  replay.type = "button";
  const cutLabel = el("label");
  const cutInput = el("input");
  cutInput.type = "range";
  cutInput.min = "0.12";
  cutInput.max = "1";
  cutInput.step = "0.01";
  cutInput.value = String(cut);
  cutLabel.append("Front face", cutInput);
  const iceLabel = el("label");
  const iceInput = el("input");
  iceInput.type = "checkbox";
  iceLabel.append(iceInput, "See under the ice");
  const frameButton = el("button");
  frameButton.type = "button";
  controls.append(replay, cutLabel, iceLabel, frameButton);
  const limit = el("p", "gs-limit");
  const provenance = el("span", "gs-provenance");
  limit.append(provenance);
  const status = el("p", "gs-sr");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  figurePage.append(figure, tray, trayNote, timeline, controls, limit, status, el("p", "gs-folio", "3"));

  spread.append(textPage, figurePage);
  book.append(boards, spread);
  desk.append(book, sketchFilter());
  root.append(desk);
  const reading = createReadingPanel(root);
  // Upright reading copies keep the original lesson and live notes on the paper.
  const introduction = el("div", "gs-introduction");
  introduction.append(...Array.from(lesson.children).filter((child) => child !== keywords && child !== flap));
  lesson.prepend(introduction);
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
  desk.dataset.stageMode = "flat";
  timeline.hidden = true;

  // three.js loads only now, after the page and its drawing have painted.
  const lithologyModule = await import("@hachure/ink/stage").catch(() => null);
  const binding = lithologyModule?.createBookBinding(book);
  const looks: readonly LithologyLook[] = lithologyModule?.PROVISIONAL_LITHOLOGIES ?? [];
  const lookIdFor = (rockKey: string) => {
    const look = looks.find((l) => l.key === rockKey);
    if (!look) throw new Error(`no lithology look for rock "${rockKey}"`);
    return look.id;
  };
  const loaded =
    o.fixture || !lithologyModule ? { runs: [fixtureRun()], error: null } : await loadReviewRuns(lookIdFor);
  const runs = loaded.runs;
  const requestedRock = o.rock ?? DEFAULT_ROCK;
  const initialRun: ReviewRun = runs.find((r) => r.rockKey === requestedRock) ?? runs[0]!;
  const keptRuns = (o.kept ?? []).flatMap((k) => runs.filter((r) => r.rockKey === k && r !== initialRun));
  // The one rock command: the page selector and the specimen dropped on the block both call it.
  const command = (o.createRockCommand ?? createLocalRockCommand)(runs, initialRun, keptRuns);
  let run: ReviewRun = command.state.live;
  const lastFrame = () => run.frames.length - 1;
  let frameIndex = Math.min(lastFrame(), Math.max(0, o.frame ?? lastFrame()));

  // The front-face slider moves one grid cell per step, so each arrow key press shows the next section.
  const along = () => {
    const s = run.frames[0]!.snapshot;
    return run.orientation.valleyAxis === "columns" ? s.columns : s.rows;
  };
  {
    const cells = along() - 1;
    cutInput.step = String(1 / cells);
    cutInput.min = String(Math.round(0.12 * cells) / cells);
    if (
      !Number.isFinite(o.cutFraction) &&
      o.defaultCutColumn !== undefined &&
      !run.isFixture &&
      lithologyModule
    ) {
      // The grid column counted along the valley, turned into the block row from the head (same mapping).
      const row = lithologyModule.valleyGridIndex(run.orientation, cells + 1, o.defaultCutColumn);
      cut = row / cells;
    }
    cut = Math.max(Number(cutInput.min), Math.round(cut * cells) / cells);
    cutInput.value = String(cut);
  }
  /** Block row of the front face, as the diorama clamps it (`clampCutRow`). */
  const cutRow = () => Math.min(along() - 1, Math.max(2, Math.round(cut * (along() - 1))));
  /** Grid index along the valley under the front face. */
  const cutColumn = () =>
    lithologyModule ? lithologyModule.valleyGridIndex(run.orientation, along(), cutRow()) : cutRow();

  const recorded = !run.isFixture;
  for (const look of looks) {
    if (recorded && !runs.some((r) => r.rockId === look.id)) continue;
    const label = el("label", "gs-specimen");
    label.dataset.rock = runs.find((r) => r.rockId === look.id)?.rockKey ?? look.key;
    if (recorded) label.dataset.gesture = "specimen";
    const input = el("input");
    input.type = "radio";
    input.name = "gs-rock";
    input.value = String(look.id);
    input.checked = look.id === run.rockId;
    label.innerHTML = specimenSvg(
      look,
      lithologyModule!.lithologyPatternSvg(look, `gs-litho-${look.key}`, 9),
    );
    label.prepend(input);
    label.append(el("span", undefined, look.name));
    tray.append(label);
  }

  // ---- Bound text ----
  const current = () => run.frames[frameIndex]!;
  let diorama: ValleyDiorama | null = null;
  let playing = false;
  const sectionNow = (): ReviewSection | null => run.section(frameIndex, cutColumn());
  const lookFor = (r: ReviewRun) => looks.find((l) => l.id === r.rockId);
  const lookName = (r: ReviewRun = run) => lookFor(r)?.name ?? r.rockKey;
  /** The kept run compared on the front face (the newest), at the recorded time nearest the current one. */
  const comparison = () => {
    const kept = command.state.kept[0];
    if (!kept || run.isFixture) return null;
    const years = current().modelYears ?? 0;
    let k = 0;
    kept.frames.forEach((f, i) => {
      if (Math.abs((f.modelYears ?? 0) - years) < Math.abs((kept.frames[k]!.modelYears ?? 0) - years)) k = i;
    });
    return { run: kept, frameIndex: k, frame: kept.frames[k]! };
  };
  const note = (...parts: (string | Node)[]) => {
    const p = el("p");
    p.append(...parts);
    return p;
  };
  const describe = () => {
    const d = diorama?.describe();
    const snap = current().snapshot;
    const s = sectionNow();
    const col = cutColumn();
    const cmp = comparison();
    const throughIce = d ? d.frontFaceCutsIce : (s?.iceThicknessM ?? 0) > 0;
    const where = km(cutRow() * snap.metresPerCell);
    const notes: HTMLElement[] = [];
    if (run.isFixture) notes.push(el("p", undefined, "authored fixture: no model time"));
    else
      notes.push(
        note(el("b", undefined, current().label), ` in ${lookName().toLowerCase()}`),
        note(`erosion sped up ×${run.erosionSpeedup}`),
      );
    notes.push(
      note(
        "front face ",
        el("b", undefined, where),
        ` down the valley, ${throughIce ? "through the ice" : "below the snout"}`,
      ),
    );
    if (s)
      notes.push(
        note(
          "floor ",
          el("b", undefined, metres(s.floorWidthM)),
          " wide, ",
          el("b", undefined, metres(s.depthM)),
          " deep",
        ),
        note("floor lowered ", el("b", undefined, metres(s.floorLoweredM)), " since the start"),
        note("steepest wall ", el("b", undefined, degrees(s.steepestWallDeg))),
      );
    else if (run.isFixture) notes.push(el("p", undefined, "floor width and depth: from a model run only"));
    const keptSection = cmp ? cmp.run.section(cmp.frameIndex, col) : null;
    if (cmp && keptSection) {
      const kept = note(
        el("span", "gs-ghost-key", "····"),
        " kept ",
        el("b", undefined, lookName(cmp.run).toLowerCase()),
        ` run, ${cmp.frame.label}: lowered `,
        el("b", undefined, metres(keptSection.floorLoweredM)),
        ", steepest wall ",
        el("b", undefined, degrees(keptSection.steepestWallDeg)),
      );
      kept.className = "gs-note-kept";
      notes.push(kept);
    }
    const basin = overdeepeningNote(run.overdeepening(frameIndex, col));
    if (basin) {
      // expert-review: D-W5-R1 item 5; the words are 5L's.
      const p = note(basin);
      p.className = "gs-note-overdeepened";
      notes.push(p);
    }
    if (command.state.dropped)
      notes.push(note(`The oldest kept run (${lookName(command.state.dropped).toLowerCase()}) was dropped.`));
    margin.replaceChildren(...notes);
    scale.textContent = RELIEF_SCALE === 1 ? "True vertical scale" : `Vertical scale ×${RELIEF_SCALE}`;
    provenance.textContent = run.isFixture
      ? `${run.provenance}. ${current().label}.${loaded.error ? ` Recorded runs did not load: ${loaded.error}.` : ""}`
      : `${run.provenance}, ${lookName().toLowerCase()}. Simplified model; time is compressed.`;
    frameButton.textContent =
      run.isFixture && run.frames.length > 1
        ? `Show: ${run.frames[(frameIndex + 1) % run.frames.length]!.label}`
        : "";
    frameButton.hidden = !run.isFixture || run.frames.length < 2;
    trayNote.textContent = run.isFixture
      ? "Rock look preview. In the lesson a rock choice starts a new run from the same starting valley."
      : "Pick a rock here or drag it onto the block. Each rock is its own recorded run from the same starting valley.";
    // The enlarged front face (recorded runs only).
    const profile = run.profile(frameIndex, col);
    const look = lookFor(run);
    lens.hidden = !profile || !look;
    if (profile && look) {
      const ghostProfile = cmp ? cmp.run.profile(cmp.frameIndex, col) : null;
      lensTitle.textContent = `Front face, enlarged · ${LENS_VERTICAL_SCALE === 1 ? "true scale" : `vertical ×${LENS_VERTICAL_SCALE}`}`;
      lensDrawing.innerHTML = sectionLensSvg(
        {
          acrossM: profile.acrossM,
          bedM: profile.bedM,
          iceM: d && !d.iceShown ? undefined : profile.iceM,
          startBedM: profile.startBedM,
          ghost:
            cmp && ghostProfile
              ? { bedM: ghostProfile.bedM, label: `${lookName(cmp.run).toLowerCase()} run` }
              : null,
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
    desk.dataset.liveRock = run.rockKey;
    desk.dataset.ghost = cmp ? cmp.run.rockKey : "";
    desk.dataset.overdeepened = basin ? "true" : "false";
    // Timeline (recorded runs only).
    timeline.hidden = run.isFixture || !diorama;
    timeInput.max = String(lastFrame());
    timeInput.value = String(frameIndex);
    timeInput.setAttribute("aria-valuetext", current().label);
    timeline.style.setProperty("--gs-ticks", String(Math.max(1, lastFrame())));
    rulerEnds.replaceChildren(
      el("span", undefined, String(run.frames[0]!.modelYears ?? "")),
      el("span", undefined, String(run.frames[lastFrame()]!.modelYears ?? "")),
    );
    timeOutput.textContent = current().label;
    playButton.textContent = playing ? "Pause" : "Play";
    playButton.title = playing ? "" : frameIndex === lastFrame() ? "Plays the run again from the start" : "";
    playButton.setAttribute("aria-pressed", String(playing));
    iceInput.disabled = !d || d.iceReachFraction === 0;
    cutInput.value = String(cut);
    cutInput.setAttribute(
      "aria-valuetext",
      `${where} down the valley, ${throughIce ? "through the ice" : "below the snout"}`,
    );
  };
  const announce = () => {
    const d = diorama?.describe();
    if (!d) return;
    const cmp = comparison();
    const col = cutColumn();
    const opening =
      `Fig. 1 is now a 3D block of the valley standing on the page, in ${d.rockName.toLowerCase()}${run.isFixture ? "" : `, after ${current().label}`}. ` +
      (d.iceReachFraction > 0
        ? `A glacier fills the valley from the head down to its snout, ${Math.round(d.iceReachFraction * 100)} percent of the way along. `
        : "There is no ice in this view. ");
    status.textContent =
      opening +
      describeProfile({
        where: `${km(d.cutAlongIndex * current().snapshot.metresPerCell)} down the valley`,
        throughIce: d.frontFaceCutsIce,
        iceShown: d.iceShown,
        rockName: d.rockName,
        when: run.isFixture ? null : current().label,
        section: sectionNow(),
        kept: cmp
          ? {
              rockName: lookName(cmp.run),
              when: cmp.frame.label,
              section: cmp.run.section(cmp.frameIndex, col),
            }
          : null,
        overdeepening: overdeepeningNote(run.overdeepening(frameIndex, col)),
      });
  };
  describe();

  // ---- Static fallback when 3D is off or unavailable ----
  const staticOnly = o.staticOnly || !lithologyModule;
  const showStatic = (why: string) => {
    drawing.style.opacity = "1";
    drawing.style.filter = "";
    controls.hidden = true;
    timeline.hidden = true;
    tray.disabled = true;
    trayNote.textContent = why;
    desk.dataset.static = "true";
    status.textContent = `Fig. 1: ${GLACIAL_DRAWING_DESCRIPTION}`;
  };
  if (staticOnly) {
    showStatic(
      lithologyModule
        ? "Drawing only (static view). The enlarged front face shows the recorded run."
        : "The 3D figure could not load; the drawing shows the same valley.",
    );
    return {
      dispose: async () => {
        binding?.dispose();
        reading.dispose();
        root.replaceChildren();
      },
    };
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
    dressing: run.dressing,
    orientation: run.orientation,
    rules: GLACIAL_DRESSING_RULES,
  });
  diorama = dio;
  dio.setElevationRange(combinedRange(runs));
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    playing = false;
    desk.dataset.playing = "false";
    describe();
  };
  const bookStage = createBookStage({
    host: desk,
    book,
    anchor: frame,
    diorama: dio,
    tiltDeg: TILT_DEG,
    mode: o.mode ?? "auto",
    backend: o.backend ?? "auto",
    onContextLost: () => {
      stop();
      bookStage.dispose();
      showStatic("The 3D figure stopped; the drawing shows the same valley.");
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
  const play = () => {
    running?.cancel();
    transitionDone = false;
    running = transition.runTransition(applyState, { reducedMotion: reducedMotion() });
    void running.done.then((completed) => {
      if (!completed) return;
      transitionDone = true;
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
    return {
      dispose: async () => {
        binding?.dispose();
        reading.dispose();
        root.replaceChildren();
      },
    };
  }
  desk.dataset.backend = bookStage.backend ?? "";
  dio.setCut(cut);
  applyState(transition.DRAWING_STATE);
  dio.setSnapshot(current().snapshot, run.start);
  const showGhost = () => dio.setGhost(comparison()?.frame.snapshot ?? null);
  showGhost();
  describe();
  await bookStage.renderNow();

  // ---- Playback of the recorded run (view-only: it shows recorded snapshots, it does not simulate) ----
  const showFrame = (k: number, speak = true) => {
    frameIndex = Math.min(lastFrame(), Math.max(0, k));
    dio.setSnapshot(current().snapshot, run.start);
    showGhost();
    describe();
    if (speak) announce();
  };
  const start = () => {
    if (frameIndex >= lastFrame()) showFrame(0, false);
    playing = true;
    desk.dataset.playing = "true";
    describe();
    timer = setInterval(() => {
      if (frameIndex >= lastFrame()) {
        stop();
        announce();
        return;
      }
      showFrame(frameIndex + 1, false);
    }, PLAY_FRAME_MS);
  };

  // ---- The rock command, from the selector or the specimen gesture ----
  const applyRuns = (state: RunsState) => {
    const years = current().modelYears;
    run = state.live;
    for (const input of tray.querySelectorAll<HTMLInputElement>("input[name=gs-rock]"))
      input.checked = Number(input.value) === run.rockId;
    // A rock choice shows that rock's run at the same model time (local stand-in; see commands.ts).
    const k = run.frames.findIndex((f) => f.modelYears === years);
    showFrame(k >= 0 ? k : Math.min(frameIndex, lastFrame()));
  };
  const chooseRock = (rockKey: string) => {
    const state = command.chooseRock(rockKey);
    if (state) applyRuns(state);
  };

  // ---- Controls (all view-only, except the rock command) ----
  const setCut = (fraction: number, speak: boolean) => {
    cut = fraction;
    dio.setCut(cut);
    showGhost();
    describe();
    if (speak) announce();
  };
  replay.onclick = () => play();
  playButton.onclick = () => {
    if (!playing) return start();
    stop();
    announce();
  };
  timeInput.oninput = () => {
    if (playing) stop();
    showFrame(Number(timeInput.value));
  };
  cutInput.oninput = () => setCut(Number(cutInput.value), true);
  iceInput.onchange = () => {
    dio.setIceVisible(!iceInput.checked);
    describe();
    announce();
  };
  frameButton.onclick = () => showFrame((frameIndex + 1) % run.frames.length);
  tray.onchange = (event) => {
    const id = Number((event.target as HTMLInputElement).value);
    const next = runs.find((r) => r.rockId === id);
    if (next && !next.isFixture) chooseRock(next.rockKey);
    else {
      dio.setRockLook(id);
      announce();
    }
  };

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
  const specimenDrag = recorded
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
  desk.dataset.source = run.isFixture ? "fixture" : "recorded";
  play();

  return {
    async dispose() {
      cutDrag.dispose();
      specimenDrag?.dispose();
      overlay.remove();
      viewControls.dispose();
      binding?.dispose();
      reading.dispose();
      stop();
      running?.cancel();
      bookStage.dispose();
      dio.dispose();
      root.replaceChildren();
      root.classList.remove("gs-review");
    },
  };
}
