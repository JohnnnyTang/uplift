/**
 * The glacial book-stage review build (session 5H, for the R1 owner review): the lesson spread on a desk,
 * the book tilted in 3D, Fig. 1 as a textbook line drawing that transitions into the naturally coloured
 * diorama standing on the right page. Flat fallback on phones, reduced motion and large zoom.
 *
 * Route: `?review=glacial-stage`. Options for review captures: `&mode=flat|tilted`, `&motion=reduce`,
 * `&backend=webgl2|webgpu`, `&cut=0..1`, `&frame=<index>`, `&static=1` (drawing only, as without WebGL).
 *
 * Page copy here is draft layout copy for R1; session 5L writes the lesson. Numbers on the page are bound
 * to the snapshot, the run or the stage config, never typed.
 */
import "./review.css";
import type { BookStage, LithologyLook, ValleyDiorama } from "@hachure/ink/stage";
import type { TransitionRun, TransitionState } from "@hachure/ink/transition";
import { GLACIAL_DRAWING_DESCRIPTION, glacialDrawingSvg } from "./drawing";
import { type ReviewRun, reviewRuns } from "./runs";

/** Vertical scale of the scene (unit: none). Bound into the caption. */
const RELIEF_SCALE = 1;
/** Book tilt (unit: degrees). */
const TILT_DEG = 46;

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

export async function mountGlacialStageReview(root: HTMLElement, search: string): Promise<MountedReview> {
  const params = new URLSearchParams(search);
  const forcedMode = params.get("mode");
  const reduceParam = params.get("motion") === "reduce";
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => reduceParam || motionQuery.matches;
  const runs = reviewRuns();
  const run: ReviewRun = runs[0]!;
  let frameIndex = Math.min(
    run.frames.length - 1,
    Math.max(0, Number(params.get("frame") ?? run.frames.length - 1)),
  );
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
  // "U-shaped valleys, fjords and hanging valleys"; NPS Yosemite geology.
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
      "When a glacier fills the valley, the ice slides over the rock and wears it away. Under the ice the valley grows wider and deeper, into a U.",
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
      "Below the snout there is no ice sliding over the bed, so the glacier does not widen it there: the river's V remains.",
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
    "A mountain valley with a glacier. The front of the block is a cross-section.",
  );
  const scale = el("span", "gs-scale");
  caption.append(captionText, scale);
  figure.append(frame, caption);

  const tray = el("fieldset", "gs-tray");
  tray.append(el("legend", undefined, "Rock"));
  const trayNote = el("p", "gs-limit");

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
  figurePage.append(figure, tray, trayNote, controls, limit, status, el("p", "gs-folio", "3"));

  spread.append(textPage, figurePage);
  book.append(boards, spread);
  desk.append(book, sketchFilter());
  root.append(desk);
  desk.dataset.stageMode = "flat";

  // three.js loads only now, after the page and its drawing have painted.
  const lithologyModule = await import("@hachure/ink/stage").catch(() => null);
  const looks: readonly LithologyLook[] = lithologyModule?.PROVISIONAL_LITHOLOGIES ?? [];
  for (const look of looks) {
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
  const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
  let diorama: ValleyDiorama | null = null;
  let stage: BookStage | null = null;
  const describe = () => {
    const d = diorama?.describe();
    const snap = current().snapshot;
    const valleyLengthM = (snap.rows - 1) * snap.metresPerCell;
    const cutM = (d ? d.cutFraction : cut) * valleyLengthM;
    margin.replaceChildren(
      el("p", undefined, run.isFixture ? "authored fixture: no model time" : current().label),
      (() => {
        const p = el("p");
        p.append(
          "front face ",
          el("b", undefined, km(cutM)),
          ` down the valley, ${d?.frontFaceCutsIce ? "through the ice" : "below the snout"}`,
        );
        return p;
      })(),
      el("p", undefined, run.isFixture ? "floor width and depth: from the model (5G)" : ""),
    );
    scale.textContent = RELIEF_SCALE === 1 ? "True vertical scale" : `Vertical scale ×${RELIEF_SCALE}`;
    provenance.textContent = run.isFixture
      ? `${run.provenance}. ${current().label}.`
      : "Simplified model; time is compressed.";
    frameButton.textContent =
      run.frames.length > 1 ? `Show: ${run.frames[(frameIndex + 1) % run.frames.length]!.label}` : "";
    frameButton.hidden = run.frames.length < 2;
    trayNote.textContent = run.isFixture
      ? "Rock look preview. In the lesson a rock choice starts a new run from the same starting valley."
      : "";
    iceInput.disabled = !d || d.iceReachFraction === 0;
  };
  const announce = () => {
    const d = diorama?.describe();
    if (!d) return;
    status.textContent =
      `Fig. 1 is now a 3D block of the valley standing on the page, in ${d.rockName.toLowerCase()}. ` +
      (d.iceReachFraction > 0
        ? `A glacier fills the valley from the head down to its snout, ${Math.round(d.iceReachFraction * 100)} percent of the way along. `
        : "There is no ice in this view. ") +
      `The front face is ${d.frontFaceCutsIce ? "cut through the glacier" : "cut below the glacier's snout"}` +
      (d.iceShown ? "." : "; the ice is hidden to show the rock under it.");
  };
  describe();

  // ---- Static fallback when 3D is off or unavailable ----
  const staticOnly = params.get("static") === "1" || !lithologyModule;
  const showStatic = (why: string) => {
    drawing.style.opacity = "1";
    drawing.style.filter = "";
    controls.hidden = true;
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
  const [{ createBookStage, createValleyDiorama }, transition] = await Promise.all([
    import("@hachure/ink/stage"),
    import("@hachure/ink/transition"),
  ]);
  diorama = createValleyDiorama({
    reliefScale: RELIEF_SCALE,
    dressing: run.dressing,
  });
  const mode = forcedMode === "flat" || forcedMode === "tilted" ? forcedMode : reduceParam ? "flat" : "auto";
  const backendParam = params.get("backend");
  stage = createBookStage({
    host: desk,
    book,
    anchor: frame,
    diorama,
    tiltDeg: TILT_DEG,
    mode,
    backend: backendParam === "webgl2" || backendParam === "webgpu" ? backendParam : "auto",
    onContextLost: () => {
      stage?.dispose();
      showStatic("The 3D figure stopped; the drawing shows the same valley.");
    },
  });
  const turbulence = desk.querySelector("feDisplacementMap")!;
  const applyState = (s: TransitionState) => {
    stage!.applyTransition(s);
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
    await stage.mount();
  } catch (error) {
    stage.dispose();
    showStatic(
      `3D is not available here (${error instanceof Error ? error.message : String(error)}); the drawing shows the same valley.`,
    );
    return { dispose: async () => root.replaceChildren() };
  }
  desk.dataset.backend = stage.backend ?? "";
  diorama.setCut(cut);
  applyState(transition.DRAWING_STATE);
  diorama.setSnapshot(current().snapshot, run.start);
  describe();
  await stage.renderNow();

  // ---- Controls (all view-only) ----
  replay.onclick = () => play();
  cutInput.oninput = () => {
    cut = Number(cutInput.value);
    diorama!.setCut(cut);
    describe();
    announce();
  };
  iceInput.onchange = () => {
    diorama!.setIceVisible(!iceInput.checked);
    announce();
  };
  frameButton.onclick = () => {
    frameIndex = (frameIndex + 1) % run.frames.length;
    diorama!.setSnapshot(current().snapshot, run.start);
    describe();
    announce();
  };
  tray.onchange = (event) => {
    const id = Number((event.target as HTMLInputElement).value);
    diorama!.setRockLook(id);
    announce();
  };
  desk.dataset.ready = "true";
  play();

  return {
    async dispose() {
      running?.cancel();
      stage?.dispose();
      diorama?.dispose();
      root.replaceChildren();
      root.classList.remove("gs-review");
    },
  };
}
