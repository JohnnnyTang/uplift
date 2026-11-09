import {
  createProjection,
  createBrushCursorOverlay,
  pickHeightfield,
  rayFromViewport,
  projectToViewport,
  extractContours,
  heightfieldFromSnapshot,
  terrainFrameFromHeightfield,
  toSvg,
  runLift,
  FLAT_STATE,
  legendTokens,
  legendSwatchSvg,
  type LiftRun,
  type TerrainFrame,
} from "@hachure/ink";
import type { InkView } from "@hachure/ink/view";
import {
  BindingEngine,
  createDebugOverlay,
  BOOK_PALETTE,
  SimHost,
  WorkerTransport,
  createFlatTerrainSample,
  createFlatTerrainTransport,
  selectTerrainBackend,
  type TerrainBackend,
  createSpreadLifecycle,
  publishTerrainSample,
  createPredict,
  createToolPalette,
  type BrushCursorState,
  createFlap,
  createTierBadge,
  createTimeScale,
  createScaleBar,
  createIgnores,
  createKeyWords,
  createSlider,
  createPlayback,
  createDisplayFormula,
  createPairedReplay,
  createChallengeWidget,
  committedExplanation,
  createUniversityLayer,
  universityDefaults,
  createVisualDescription,
  el,
  formatBoundNumber,
  type HostSample,
  type Level,
  type Spread,
} from "@hachure/runtime";
import {
  DEFAULT_TERRAIN_CONFIG,
  V_VALLEY_SCIENCE_STATUS,
  RAIN_COMPARISON,
  hashSnapshot,
} from "@hachure/terrain";
import { inkCamera, LESSON_VIEW } from "./view-config";
import "../book.css";
import "./lesson.css";

/** The book wires public engine primitives; authored spread files remain declarative data. */
export async function mountLesson(root: HTMLElement, spread: Spread, teacherNotes: string) {
  for (const [key, value] of Object.entries(BOOK_PALETTE)) root.style.setProperty(`--${key}`, value);
  const initialConfig = { ...DEFAULT_TERRAIN_CONFIG, ...spread.scene.params, seed: spread.scene.seed };
  const calibration = {
    status: V_VALLEY_SCIENCE_STATUS.calibration.status,
    recordId: V_VALLEY_SCIENCE_STATUS.recordId,
  };
  const initialSample = await createFlatTerrainSample(initialConfig, calibration);
  let selectedBackend: TerrainBackend = "flat";
  let backendReady = false;
  let host = new SimHost(createFlatTerrainTransport(initialSample), spread.scene.stepsPerRealSecond);
  const bindings = new BindingEngine({
    controls: spread.controls,
    probes: spread.probes,
    durationIds: Object.keys(spread.scene.durations ?? {}),
  });
  const lifecycle = createSpreadLifecycle({
    keyControlId: "rain",
    predictOptionCount: spread.page.predict.options.length,
  });
  let level: Level = "hs",
    disposed = false,
    frame = 0,
    lastTime = performance.now(),
    drawAt = -Infinity,
    runGeneration = 0,
    liftGeneration = 0;
  let view: InkView | undefined, viewFrame: TerrainFrame | undefined, lift: LiftRun | undefined;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let viewError = "";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const skip = el("a", "Skip to the spread", "skip-link");
  skip.href = "#spread";
  const header = el("header", undefined, "book-header");
  const label = el("label", "Reading level");
  label.htmlFor = "reading-level";
  const levels = el("select");
  levels.id = "reading-level";
  for (const [value, text] of [
    ["hs", "High school"],
    ["uni", "University"],
  ]) {
    const option = el("option", text);
    option.value = value;
    levels.append(option);
  }
  header.append(el("p", "Uplift", "book-brand"), label, levels);
  const notice = el(
    "p",
    "Research draft · Compare the tested rain relationship. Scientific explanations await expert review; landscape years and the waterfall challenge remain unavailable.",
    "fixture-notice",
  );
  const validationLink = el("a", "Read the validation results");
  validationLink.href = `https://github.com/JohnnnyTang/uplift/blob/main/${RAIN_COMPARISON.evidencePath}`;
  notice.append(" ", validationLink);
  const book = el("article", undefined, "book");
  book.id = "spread";
  book.tabIndex = -1;
  book.setAttribute("aria-labelledby", "spread-title");
  const left = el("section", undefined, "page page-left"),
    right = el("section", undefined, "page page-right");
  left.setAttribute("aria-label", "Question and explanation");
  right.setAttribute("aria-label", "Terrain and test controls");
  const title = el("h1");
  title.id = "spread-title";
  const body = el("div", undefined, "reading-text");
  const flap = createFlap("explanation", "");
  const ignores = createIgnores([]),
    keywords = createKeyWords(spread.page.keyWords, level);
  const equations = el("section");
  equations.append(el("h2", "Comparative theory"));
  for (const equation of spread.page.equations ?? []) equations.append(createDisplayFormula(equation));
  const predict = createPredict("prediction", spread.page.predict, level, (choice) => {
    lifecycle.commitPrediction(choice);
    comparison.unlock();
    comparison.root.tabIndex = -1;
    comparison.root.focus();
    void liftAndRun();
  });
  predict.root.disabled = true;
  let comparisonAtEnd = false;
  const feedback = el("p", undefined, "comparison-feedback widget-status");
  feedback.setAttribute("role", "status");
  // <!-- expert-review --> Bound recorded gross erosion; sources: Comparison and Model.
  const comparison = createPairedReplay({
    id: "rain-comparison",
    data: RAIN_COMPARISON,
    title: "Material lifted from the surface",
    labels: ["Lighter rain", "Heavier rain"],
    inputUnit: "mm/h",
    valueUnit: "model m³",
    description:
      "Recorded controlled experiment. Identical exposed-rock terrain and spring; only rainfall changes. Each lift counts, including material moved again after settling.",
    onEndpoint(atEnd) {
      comparisonAtEnd = atEnd;
      updateComparisonFeedback();
    },
  });
  function updateComparisonFeedback() {
    const choice = predict.committed;
    const text =
      comparisonAtEnd && choice !== undefined && spread.page.predict.answer !== null
        ? `You predicted: ${spread.page.predict.options[choice]![level]}. ${choice === spread.page.predict.answer ? "Your prediction matches this comparison." : "This comparison supports heavier rain."} Heavier rain lifted more material over the same model time. This does not establish a deeper valley.`
        : "";
    if (feedback.textContent !== text) feedback.textContent = text;
    flap.reveal.disabled = !comparisonAtEnd;
  }
  const time = createTimeScale("Loading model…");
  const figure = el("figure"),
    stage = el("div", undefined, "terrain-stage"),
    flat = el("div", undefined, "terrain-flat");
  const canvas = el("canvas");
  canvas.setAttribute("aria-label", "Live process-model terrain");
  canvas.style.opacity = "0";
  stage.append(flat, canvas);
  const brushOverlay = createBrushCursorOverlay();
  stage.append(brushOverlay.root);
  const caption = el(
    "figcaption",
    "Contours show the starting surface; commit a prediction to lift the drawing.",
  );
  const scale = createScaleBar("", 0.25),
    legend = el("ul", undefined, "widget-legend");
  legend.setAttribute("aria-label", "Colour and quantity legend");
  for (const token of legendTokens(LESSON_VIEW.channels)) {
    const item = el("li"),
      swatch = el("span");
    swatch.innerHTML = legendSwatchSvg(token);
    item.append(
      swatch,
      el(
        "span",
        `${token.label}: ${formatBoundNumber(token.visibleFromM, token.unit)}–${formatBoundNumber(token.fullAtM, token.unit)} (${token.pattern === "solid" ? "blue" : "ochre stripes"})`,
      ),
    );
    legend.append(item);
  }
  const relief = el(
    "p",
    `Vertical relief: ${formatBoundNumber(LESSON_VIEW.reliefScale, "×")}. Contour interval: ${formatBoundNumber(LESSON_VIEW.contourIntervalM, "m")}.`,
    "supporting-text",
  );
  figure.append(stage, caption, scale.root, relief, legend);
  const visualText = createVisualDescription("Model initializing…");
  const errorText = el("p", undefined, "widget-status");
  errorText.setAttribute("role", "alert");
  const controls = el("section", undefined, "test-controls");
  controls.setAttribute("aria-label", "Test the landscape");
  const rainSpec = spread.controls.find((control) => control.kind === "slider" && control.id === "rain");
  if (!rainSpec || rainSpec.kind !== "slider") throw new Error("The valley spread needs a rain control");
  const rainDefault = rainSpec.default;
  const university = createUniversityLayer({
    id: "valley-university",
    defaults: { ...DEFAULT_TERRAIN_CONFIG, ...spread.scene.params },
    configure: (patch) => host.configure(patch),
    onError: showError,
  });
  equations.append(university.theory);
  const rain = createSlider({ ...rainSpec, label: rainSpec.label[level] }, rainSpec.default, (value) => {
    void host.configure({ rainMmPerHr: value }).catch(showError);
  });
  rain.input.disabled = true;
  const speed = createSlider(
    { id: "speed", label: "Playback speed", min: 0.25, max: 4, step: 0.25, unit: "×" },
    1,
    (value) => {
      host.setSpeed(value);
      updateText();
    },
  );
  speed.input.disabled = true;
  const playback = createPlayback(
    () => {
      host.play();
      updateText();
    },
    () => {
      host.pause();
      void host.refresh().catch(showError);
      updateText();
    },
    () => {
      void reset().catch(showError);
    },
  );
  playback.reset.disabled = true;
  let paletteConfigKey = "";
  const palette = createToolPalette({
    id: "valley-tools",
    config: DEFAULT_TERRAIN_CONFIG,
    applyTool: (op) => host.applyTool(op),
    onCursorChange: (cursor) => refreshCursor(cursor),
  });
  palette.setEnabled(false);
  controls.append(playback.root, rain.root, speed.root, palette.root);
  canvas.addEventListener("pointerdown", (event) => {
    if (!view?.heightfield || !lifecycle.isControlEnabled("rain")) return;
    const projection = view.projection();
    if (!projection) return;
    const bounds = canvas.getBoundingClientRect();
    const ray = rayFromViewport(projection, event.clientX - bounds.left, event.clientY - bounds.top);
    const hit = pickHeightfield(view.heightfield, projection, view.exaggeration, ray);
    if (hit) {
      palette.setPosition(hit);
      void palette.apply();
    }
  });
  const notes = el("details");
  const noteText = el("div", undefined, "teacher-note");
  notes.append(el("summary", "Teacher note and sources"), noteText);
  const citations = el("ul");
  for (const source of spread.sources) {
    const item = el("li");
    if (source.url) {
      const link = el("a", source.citation);
      link.href = source.url;
      item.append(link);
    } else item.textContent = source.citation;
    citations.append(item);
  }
  notes.append(citations);
  const challenge = createChallengeWidget({
    spreadId: spread.id,
    definitionId: spread.id + ":" + JSON.stringify(spread.challenge.check),
    spec: spread.challenge,
    predictionOptions: spread.page.predict.options,
    observationIntervalSteps: 1,
    onAward: () => {
      if (lifecycle.state === "explained") lifecycle.challenge();
    },
  });
  left.append(
    title,
    body,
    predict.root,
    feedback,
    flap.root,
    challenge.root,
    equations,
    keywords.root,
    notes,
  );
  right.append(
    createTierBadge(spread.tier),
    comparison.root,
    el("h2", "Free exploration"),
    el(
      "p",
      "A separate live landscape with loose cover. These controls do not change the recorded comparison.",
      "supporting-text",
    ),
    time.root,
    figure,
    visualText.root,
    errorText,
    controls,
    university.root,
    university.hiddenNotice,
    ignores.root,
  );
  book.append(left, right);
  root.replaceChildren(skip, header, notice, book);

  const debug = new URLSearchParams(location.search).has("debug")
    ? createDebugOverlay(root, () => ({
        gridSize: host.sample?.snapshot.gridSize,
        seed: host.sample?.config.seed,
        backend: selectedBackend,
        renderer: view?.backend ?? "flat",
        batchSteps: host.timings.lastBatchSteps,
        batchMs: host.timings.lastBatchMs,
      }))
    : undefined;

  function refreshCursor(cursor: BrushCursorState = palette.state()) {
    const projection = view?.projection();
    brushOverlay.setVisible(cursor.enabled && !!view && lifecycle.isControlEnabled("rain"));
    if (view?.heightfield && projection)
      brushOverlay.update(view.heightfield, projection, view.exaggeration, cursor.at, cursor.radiusM);
  }
  function showError(error: unknown) {
    host.pause();
    errorText.textContent = error instanceof Error ? error.message : String(error);
    updateText();
  }
  function renderFlat(sample: HostSample) {
    const hf = heightfieldFromSnapshot(sample.snapshot);
    viewFrame ??= terrainFrameFromHeightfield(hf);
    const projection = createProjection(
      viewFrame,
      inkCamera(spread.scene.camera),
      { widthPx: stage.clientWidth || 480, heightPx: stage.clientHeight || 360 },
      LESSON_VIEW.reliefScale,
    );
    flat.innerHTML = toSvg(extractContours(hf, LESSON_VIEW.contourIntervalM), {
      projection,
      title: "Contours of the simulated landscape",
      description: "Each ink line joins equal ground elevations in the same state used by the raised view.",
    });
  }
  function updateText() {
    const sample = host.sample;
    if (sample) publishTerrainSample(bindings, sample, spread.scene, host.speed, !host.playing);
    title.textContent = spread.title[level];
    body.textContent = bindings.render(spread.page.body[level]);
    noteText.textContent = bindings.render(teacherNotes.replace(/<!--.*?-->/gs, "").trim());
    flap.panel.textContent = committedExplanation(
      spread.page.predict.options,
      lifecycle.prediction,
      level,
      bindings.render(spread.page.flap[level]),
    );
    challenge.update(
      sample
        ? {
            runId: spread.id + ":" + runGeneration,
            step: sample.snapshot.step,
            simYears: sample.snapshot.simYears,
            ...(sample.calibration.status === "approved" ? { calibration: sample.calibration } : {}),
            probes: sample.probes,
          }
        : undefined,
      {
        level,
        prediction: lifecycle.prediction,
        explained: lifecycle.state === "explained" || lifecycle.state === "challenged",
      },
    );
    predict.update(level);
    updateComparisonFeedback();
    const question = predict.root.querySelector("legend");
    if (question) question.textContent = bindings.render(spread.page.predict.question[level]);
    ignores.update(spread.page.ignores[level].map((text) => bindings.render(text)));
    keywords.update(level);
    equations.hidden = level !== "uni";
    time.update(bindings.render("{{scene.timeScale}}"));
    const liveEnabled = backendReady && selectedBackend !== "flat" && lifecycle.isControlEnabled("rain");
    university.update(sample, level, liveEnabled);
    playback.update(host.playing, !liveEnabled);
    palette.setEnabled(liveEnabled);
    if (sample) {
      visualText.update(
        `Fixed-section incision since reset: ${bindings.render("{{probe.incisionDepth}}")}. Sediment exported: ${bindings.render("{{probe.sedimentOut}}")}. ${sample.paths.current.complete ? "The current channel reaches the outlet." : "The current channel is incomplete; full-reach claims are unavailable."}`,
        !host.playing,
      );
      const barM = (sample.snapshot.gridSize * sample.snapshot.metresPerCell) / 4;
      const projection =
        view?.projection() ??
        (viewFrame
          ? createProjection(
              viewFrame,
              inkCamera(spread.scene.camera),
              { widthPx: stage.clientWidth || 480, heightPx: stage.clientHeight || 350 },
              LESSON_VIEW.reliefScale,
            )
          : undefined);
      const start = projection ? projectToViewport(projection, 0, 0, 0, 0) : [0, 0];
      const end = projection ? projectToViewport(projection, barM, 0, 0, 0) : [stage.clientWidth / 4, 0];
      const fraction = Math.min(
        1,
        Math.max(0.01, Math.hypot(end[0]! - start[0]!, end[1]! - start[1]!) / (stage.clientWidth || 480)),
      );
      scale.update(`${formatBoundNumber(barM, "m")} · east–west terrain distance`, fraction);
    }
  }
  function renderSample(sample: HostSample) {
    const configKey = JSON.stringify(sample.config);
    if (configKey !== paletteConfigKey) {
      paletteConfigKey = configKey;
      palette.refreshConfig(sample.config);
    }
    book.dataset.backend = selectedBackend;
    book.dataset.grid = String(sample.snapshot.gridSize);
    book.dataset.backendReady = String(backendReady);
    book.dataset.step = String(sample.snapshot.step);
    book.dataset.stateHash = hashSnapshot(sample.snapshot);
    updateText();
    if (sample.snapshot.step === 0 || performance.now() - drawAt >= 250) drawLatest();
    else if (renderTimer === undefined)
      renderTimer = setTimeout(
        () => {
          renderTimer = undefined;
          drawLatest();
        },
        Math.max(0, 250 - (performance.now() - drawAt)),
      );
    book.dataset.workerMs = String(host.timings.processingMs);
    book.dataset.transferSchedulingMs = String(host.timings.transportAndSchedulingMs);
    book.dataset.snapshotMs = String(sample.snapshotMs);
    book.dataset.batchSteps = String(host.timings.lastBatchSteps);
    book.dataset.batchMs = String(host.timings.lastBatchMs);
  }
  function drawLatest() {
    if (disposed || !host.sample) return;
    const sample = host.sample;
    drawAt = performance.now();
    if (view) {
      view.setState(sample.snapshot);
      book.dataset.viewUpdateMs = String(view.stats.lastUpdateMs);
    }
    if (!view || lifecycle.state === "predicting") renderFlat(sample);
    book.dataset.viewStep = String(sample.snapshot.step);
    refreshCursor();
  }
  async function prepareView() {
    try {
      const { createInkView } = await import("@hachure/ink/view");
      if (disposed || !host.sample || !viewFrame) return;
      const candidate = createInkView({
        ...LESSON_VIEW,
        backend: selectedBackend === "webgpu" ? "webgpu" : "webgl2",
        frame: viewFrame,
        camera: inkCamera(spread.scene.camera),
        onContextLost: (message) => {
          viewError = message;
          view?.dispose();
          view = undefined;
          flat.style.opacity = "1";
          canvas.style.opacity = "0";
          if (host.sample) renderFlat(host.sample);
          caption.textContent = "Graphics unavailable; the live contour drawing remains available.";
        },
      });
      candidate.setState(host.sample.snapshot);
      candidate.applyLiftState(FLAT_STATE);
      await candidate.mount(canvas);
      await candidate.renderNow();
      if (disposed) {
        candidate.dispose();
        return;
      }
      view = candidate;
    } catch (error) {
      viewError = error instanceof Error ? error.message : String(error);
    }
  }
  async function liftAndRun() {
    const generation = ++liftGeneration;
    await viewPromise;
    if (disposed || generation !== liftGeneration || lifecycle.state !== "lifting") return;
    if (view) {
      lift = runLift(
        {
          apply(state) {
            view?.applyLiftState(state);
            refreshCursor();
            flat.style.opacity = String(state.flatOpacity);
            canvas.style.opacity = String(state.canvasOpacity);
          },
        },
        reducedMotion.matches ? { crossfadeMs: 200, liftMs: 0 } : {},
      );
      if (!(await lift.done) || generation !== liftGeneration) return;
    }
    lifecycle.completeLift();
    rain.input.disabled = selectedBackend === "flat";
    speed.input.disabled = selectedBackend === "flat";
    flap.reveal.disabled = !comparisonAtEnd;
    caption.textContent = view
      ? "The same contours now follow the raised surface. Blue is water; ochre stripes are sediment in transport."
      : selectedBackend === "flat"
        ? "This device is showing the starting contour drawing. The recorded comparison remains available."
        : `Live contour fallback. ${viewError}`;
    if (!reducedMotion.matches && selectedBackend !== "flat") host.play();
    updateText();
  }
  async function reset() {
    liftGeneration++;
    lift?.cancel();
    host.pause();
    runGeneration++;
    challenge.reset();
    lifecycle.reset();
    lifecycle.beginPrediction();
    predict.reset();
    comparison.reset();
    flap.reset();
    rain.input.disabled = true;
    speed.input.disabled = true;
    await host.reset();
    if (selectedBackend !== "flat") {
      await host.configure({
        rainMmPerHr: rainDefault,
        ...universityDefaults({ ...DEFAULT_TERRAIN_CONFIG, ...spread.scene.params }),
      });
    }
    rain.update(rainDefault);
    speed.update(1);
    view?.applyLiftState(FLAT_STATE);
    canvas.style.opacity = "0";
    flat.style.opacity = "1";
    if (host.sample) renderFlat(host.sample);
    errorText.textContent = "";
    updateText();
    predict.root.tabIndex = -1;
    predict.root.focus();
  }
  levels.addEventListener("change", () => {
    level = levels.value as Level;
    updateText();
  });
  flap.reveal.addEventListener("click", () => {
    if (lifecycle.state === "interactive") lifecycle.explain();
    updateText();
  });
  const motionChanged = () => {
    if (reducedMotion.matches) {
      host.pause();
      if (lifecycle.state === "lifting") {
        lift?.cancel();
        void liftAndRun();
      }
      updateText();
    }
  };
  reducedMotion.addEventListener("change", motionChanged);
  const resize = new ResizeObserver(() => {
    refreshCursor();
    if (host.sample && (!view || lifecycle.state === "predicting")) renderFlat(host.sample);
  });
  resize.observe(stage);
  host.subscribe(renderSample);
  host.onError(showError);
  lifecycle.beginPrediction();
  await host.initialize(initialSample.config, calibration);
  // Paint the process-derived flat diagram before device creation and shader compilation.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const selected = await selectTerrainBackend({
    config: initialConfig,
    calibration,
    search: location.search,
    createWorkerTransport: () =>
      new WorkerTransport(new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" })),
  });
  host.dispose();
  selectedBackend = selected.backend;
  backendReady = true;
  host = new SimHost(
    selected.transport ?? createFlatTerrainTransport(selected.initialSample),
    spread.scene.stepsPerRealSecond,
  );
  viewFrame = undefined;
  host.subscribe(renderSample);
  host.onError(showError);
  book.dataset.backendFailures = JSON.stringify(selected.failures);
  await host.initialize(selected.config, calibration);
  const viewPromise = selectedBackend === "flat" ? Promise.resolve() : prepareView();
  playback.reset.disabled = false;
  predict.root.disabled = false;
  function tick(now: number) {
    debug?.frame(now);
    host.advance(Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!disposed) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return {
    host,
    lifecycle,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      if (renderTimer !== undefined) clearTimeout(renderTimer);
      lift?.cancel();
      resize.disconnect();
      reducedMotion.removeEventListener("change", motionChanged);
      palette.dispose();
      brushOverlay.dispose();
      host.dispose();
      comparison.dispose();
      debug?.dispose();
      view?.dispose();
    },
  };
}
