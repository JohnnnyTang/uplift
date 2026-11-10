/**
 * The glacial book-stage review build (session 5H, for the R1 owner review): the lesson spread on a desk,
 * the book tilted in 3D, Fig. 1 as a textbook line drawing that transitions into the naturally coloured
 * diorama standing on the right page, playing session 5G's recorded glacier runs (one per rock). Flat
 * fallback on phones, reduced motion and large zoom.
 *
 * Route: `?review=glacial-stage`. Options for review captures: `&mode=flat|tilted`, `&motion=reduce`,
 * `&backend=webgl2|webgpu`, `&cut=0..1`, `&rock=<model rock id>`, `&frame=<index>`, `&static=1` (drawing
 * only, as without WebGL), `&fixture=1` (the authored fixture instead of the recorded runs).
 *
 * Page copy here is draft layout copy for R1; session 5L writes the lesson. Numbers on the page are bound
 * to the recorded run (the model's own section probe), the snapshot or the stage config, never typed.
 */
import "./review.css";
import type { LithologyLook, ValleyDiorama } from "@hachure/ink/stage";
import type { TransitionRun, TransitionState } from "@hachure/ink/transition";
import { GLACIAL_DRAWING_DESCRIPTION, glacialDrawingSvg } from "./drawing";
import { type ReviewRun, type ReviewSection, combinedRange, fixtureRun, loadReviewRuns } from "./runs";

/** Vertical scale of the scene (unit: none). Bound into the caption. */
const RELIEF_SCALE = 1;
/** Book tilt (unit: degrees). */
const TILT_DEG = 46;
/** How long each recorded snapshot shows while a run plays (unit: milliseconds). Presentation only. */
const PLAY_FRAME_MS = 650;
/** Rock run shown first (a model rock id); the middle of the soft → hard set. */
const DEFAULT_ROCK = "sandstone";

export interface MountedReview {
  dispose(): Promise<void>;
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

/** Display rounding of a model length: to 10 m (the grid is coarser than that). */
const metres = (m: number) => `${Math.round(m / 10) * 10} m`;
const km = (m: number) => `${(m / 1000).toFixed(1)} km`;

export async function mountGlacialStageReview(root: HTMLElement, search: string): Promise<MountedReview> {
  const params = new URLSearchParams(search);
  const forcedMode = params.get("mode");
  const reduceParam = params.get("motion") === "reduce";
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => reduceParam || motionQuery.matches;
  let cut = Math.min(1, Math.max(0, Number(params.get("cut") ?? 1)));

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
  drawing.innerHTML = glacialDrawingSvg({ idPrefix: "gs-fig" });
  frame.append(drawing);
  const caption = el("figcaption");
  caption.id = "gs-fig-caption";
  const captionText = el("span");
  captionText.append(
    el("span", "gs-fig-number", "Fig. 1"),
    "A mountain valley with a glacier. The front of the block is a cross-section; the dashed line is the valley before the ice.",
  );
  const scale = el("span", "gs-scale");
  caption.append(captionText, scale);
  figure.append(frame, caption);

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
  desk.dataset.stageMode = "flat";
  timeline.hidden = true;

  // three.js loads only now, after the page and its drawing have painted.
  const lithologyModule = await import("@hachure/ink/stage").catch(() => null);
  const looks: readonly LithologyLook[] = lithologyModule?.PROVISIONAL_LITHOLOGIES ?? [];
  const lookIdFor = (rockKey: string) => {
    const look = looks.find((l) => l.key === rockKey);
    if (!look) throw new Error(`no lithology look for rock "${rockKey}"`);
    return look.id;
  };
  const loaded =
    params.get("fixture") === "1" || !lithologyModule
      ? { runs: [fixtureRun()], error: null }
      : await loadReviewRuns(lookIdFor);
  const runs = loaded.runs;
  const requestedRock = params.get("rock") ?? DEFAULT_ROCK;
  let run: ReviewRun = runs.find((r) => r.rockKey === requestedRock) ?? runs[0]!;
  const lastFrame = () => run.frames.length - 1;
  let frameIndex = Math.min(lastFrame(), Math.max(0, Number(params.get("frame") ?? lastFrame())));

  // The front-face slider moves one grid cell per step, so each arrow key press shows the next section.
  {
    const s = run.frames[0]!.snapshot;
    const cells = (run.orientation.valleyAxis === "columns" ? s.columns : s.rows) - 1;
    cutInput.step = String(1 / cells);
    cutInput.min = String(Math.round(0.12 * cells) / cells);
    cut = Math.max(Number(cutInput.min), Math.round(cut * cells) / cells);
    cutInput.value = String(cut);
  }

  const recorded = !run.isFixture;
  for (const look of looks) {
    if (recorded && !runs.some((r) => r.rockId === look.id)) continue;
    const label = el("label", "gs-specimen");
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
  let valleyGridIndex: ((alongFromHead: number) => number) | null = null;
  let playing = false;
  const sectionNow = (): ReviewSection | null => {
    const d = diorama?.describe();
    if (!d || !valleyGridIndex) return null;
    return run.section(frameIndex, valleyGridIndex(d.cutAlongIndex));
  };
  const lookName = () => looks.find((l) => l.id === run.rockId)?.name ?? run.rockKey;
  const note = (...parts: (string | Node)[]) => {
    const p = el("p");
    p.append(...parts);
    return p;
  };
  const describe = () => {
    const d = diorama?.describe();
    const snap = current().snapshot;
    const s = sectionNow();
    const notes: HTMLElement[] = [];
    if (run.isFixture) notes.push(el("p", undefined, "authored fixture: no model time"));
    else
      notes.push(
        note(el("b", undefined, current().label), ` in ${lookName().toLowerCase()}`),
        note(`erosion sped up ×${run.erosionSpeedup}`),
      );
    if (d)
      notes.push(
        note(
          "front face ",
          el("b", undefined, km(d.cutAlongIndex * snap.metresPerCell)),
          ` down the valley, ${d.frontFaceCutsIce ? "through the ice" : "below the snout"}`,
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
        note("steepest wall ", el("b", undefined, `${Math.round(s.steepestWallDeg)}°`)),
      );
    else if (run.isFixture) notes.push(el("p", undefined, "floor width and depth: from a model run only"));
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
      : "Each rock is its own recorded run from the same starting valley.";
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
    if (d)
      cutInput.setAttribute(
        "aria-valuetext",
        `${km(d.cutAlongIndex * snap.metresPerCell)} down the valley, ${d.frontFaceCutsIce ? "through the ice" : "below the snout"}`,
      );
  };
  const announce = () => {
    const d = diorama?.describe();
    if (!d) return;
    const s = sectionNow();
    const when = run.isFixture ? "" : `, after ${current().label}`;
    status.textContent =
      `Fig. 1 is now a 3D block of the valley standing on the page, in ${d.rockName.toLowerCase()}${when}. ` +
      (d.iceReachFraction > 0
        ? `A glacier fills the valley from the head down to its snout, ${Math.round(d.iceReachFraction * 100)} percent of the way along. `
        : "There is no ice in this view. ") +
      `The front face is ${d.frontFaceCutsIce ? "cut through the glacier" : "cut below the glacier's snout"}` +
      (d.iceShown ? "." : "; the ice is hidden to show the rock under it.") +
      (s
        ? ` There the floor is ${metres(s.floorWidthM)} wide and ${metres(s.depthM)} deep, lowered ${metres(s.floorLoweredM)} below the dashed starting V; the steepest wall is ${Math.round(s.steepestWallDeg)} degrees.`
        : "");
  };
  describe();

  // ---- Static fallback when 3D is off or unavailable ----
  const staticOnly = params.get("static") === "1" || !lithologyModule;
  const showStatic = (why: string) => {
    drawing.style.opacity = "1";
    drawing.style.filter = "";
    controls.hidden = true;
    timeline.hidden = true;
    tray.disabled = true;
    trayNote.textContent = why;
    status.textContent = `Fig. 1: ${GLACIAL_DRAWING_DESCRIPTION}`;
  };
  if (staticOnly) {
    showStatic(
      lithologyModule
        ? "Drawing only (static view)."
        : "The 3D figure could not load; the drawing shows the same valley.",
    );
    return { dispose: async () => root.replaceChildren() };
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
  });
  diorama = dio;
  dio.setElevationRange(combinedRange(runs));
  valleyGridIndex = (alongFromHead) => {
    const s = current().snapshot;
    const along = run.orientation.valleyAxis === "columns" ? s.columns : s.rows;
    return stageModule.valleyGridIndex(run.orientation, along, alongFromHead);
  };
  const mode = forcedMode === "flat" || forcedMode === "tilted" ? forcedMode : reduceParam ? "flat" : "auto";
  const backendParam = params.get("backend");
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
    mode,
    backend: backendParam === "webgl2" || backendParam === "webgpu" ? backendParam : "auto",
    onContextLost: () => {
      stop();
      bookStage.dispose();
      showStatic("The 3D figure stopped; the drawing shows the same valley.");
    },
  });
  const turbulence = desk.querySelector("feDisplacementMap")!;
  const applyState = (s: TransitionState) => {
    bookStage.applyTransition(s);
    drawing.style.opacity = String(s.drawingOpacity);
    turbulence.setAttribute("scale", (s.drawingRoughness * 9).toFixed(2));
    drawing.style.filter = s.drawingRoughness > 0.01 && s.drawingOpacity > 0.01 ? "url(#gs-sketch)" : "";
  };
  let running: TransitionRun | null = null;
  const play = () => {
    running?.cancel();
    running = transition.runTransition(applyState, { reducedMotion: reducedMotion() });
    void running.done.then((completed) => {
      if (completed) announce();
    });
  };

  try {
    await bookStage.mount();
  } catch (error) {
    bookStage.dispose();
    showStatic(
      `3D is not available here (${error instanceof Error ? error.message : String(error)}); the drawing shows the same valley.`,
    );
    return { dispose: async () => root.replaceChildren() };
  }
  desk.dataset.backend = bookStage.backend ?? "";
  dio.setCut(cut);
  applyState(transition.DRAWING_STATE);
  dio.setSnapshot(current().snapshot, run.start);
  describe();
  await bookStage.renderNow();

  // ---- Playback of the recorded run (view-only: it shows recorded snapshots, it does not simulate) ----
  const showFrame = (k: number, speak = true) => {
    frameIndex = Math.min(lastFrame(), Math.max(0, k));
    dio.setSnapshot(current().snapshot, run.start);
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

  // ---- Controls (all view-only) ----
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
  cutInput.oninput = () => {
    cut = Number(cutInput.value);
    dio.setCut(cut);
    describe();
    announce();
  };
  iceInput.onchange = () => {
    dio.setIceVisible(!iceInput.checked);
    announce();
  };
  frameButton.onclick = () => showFrame((frameIndex + 1) % run.frames.length);
  tray.onchange = (event) => {
    const id = Number((event.target as HTMLInputElement).value);
    const next = runs.find((r) => r.rockId === id);
    if (next && !next.isFixture) {
      // A rock choice switches to that rock's own recorded run, at the same model time.
      const years = current().modelYears;
      run = next;
      const k = run.frames.findIndex((f) => f.modelYears === years);
      showFrame(k >= 0 ? k : Math.min(frameIndex, lastFrame()));
    } else {
      dio.setRockLook(id);
      announce();
    }
  };
  desk.dataset.ready = "true";
  desk.dataset.source = run.isFixture ? "fixture" : "recorded";
  play();

  return {
    async dispose() {
      stop();
      running?.cancel();
      bookStage.dispose();
      dio.dispose();
      root.replaceChildren();
      root.classList.remove("gs-review");
    },
  };
}
