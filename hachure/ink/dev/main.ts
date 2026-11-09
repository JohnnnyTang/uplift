/**
 * Dev page for @hachure/ink, driven by the FAKE solver (a scripted fixture, never science).
 *
 * URL parameters (all optional):
 *   backend=auto|webgpu|webgl2   renderer backend (default auto)
 *   grid=256                      grid size
 *   steps=800                     fake solver steps taken before the first frame
 *   e=0..1                        start with the canvas showing at this exaggeration
 *   overlays=0|1                  hachures and water/sediment overlays (default 1 when e is given)
 *   show=svg|canvas               show only the flat SVG or only the canvas (for the crossfade check)
 */
import { type LiftState, legendSwatchSvg, runLift, toSvg } from "@hachure/ink";
import { type InkBackendRequest, type InkView, INK_VIEW_LAYERS, createInkView } from "@hachure/ink/view";
import type { StateSnapshot } from "@hachure/terrain";
import { createFakeSolver } from "@hachure/terrain/testing";

type StateSnapshotLike = StateSnapshot;

const params = new URLSearchParams(location.search);
const gridSize = Number(params.get("grid") ?? 256);
const preSteps = Number(params.get("steps") ?? 800);
const backend = (params.get("backend") ?? "auto") as InkBackendRequest;
const startE = params.has("e") ? Math.min(1, Math.max(0, Number(params.get("e")))) : null;
const show = params.get("show");

/** Display settings for this page (not science): contour interval, index spacing, relief scale. */
const DISPLAY = {
  contourIntervalM: 4,
  indexEvery: 5,
  reliefScale: 3,
  camera: { azimuthDeg: 30, elevationDeg: 40, zoom: 1 },
};
/** Fake-solver settings chosen so its scripted water is visible. Fixture values, not science. */
const FIXTURE = { gridSize, metresPerCell: 10, rainMmPerHr: 200, dtSimSeconds: 10 };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("terrain");
const flat = $<HTMLDivElement>("flat");
const slider = $<HTMLInputElement>("exaggeration");
const sliderValue = $<HTMLOutputElement>("exaggeration-value");
const status = $<HTMLParagraphElement>("status");
const playButton = $<HTMLButtonElement>("play");
const fixtureSediment = $<HTMLInputElement>("fixture-sediment");

interface DevGlobal {
  ready: boolean;
  error?: string;
  backend?: string | null;
  stats?: unknown;
  timings?: Record<string, number>;
  view?: InkView;
  step?: () => number;
}
const dev: DevGlobal = { ready: false };
(globalThis as unknown as { __ink: DevGlobal }).__ink = dev;

const solver = createFakeSolver(FIXTURE);
const t0 = performance.now();
solver.step(preSteps);
const preStepMs = performance.now() - t0;

const view = createInkView({
  contourIntervalM: DISPLAY.contourIntervalM,
  indexEvery: DISPLAY.indexEvery,
  reliefScale: DISPLAY.reliefScale,
  camera: DISPLAY.camera,
  backend,
  layers: { hachures: false, water: false, sediment: false },
  // The fake solver keeps its water in a narrow, shallow band; a shallower full-colour depth shows it.
  channels: { water: { visibleFromM: 0.002, fullAtM: 0.05 } },
  onContextLost: (message) => {
    canvas.style.opacity = "0";
    flat.style.opacity = "1";
    status.textContent = `${message}. The flat contour drawing is shown instead.`;
  },
});

dev.view = view;
dev.step = () => solver.stepCount;

/**
 * Renderer test pattern for the sediment channel. The fake solver never produces sediment, so without
 * this the ochre channel could not be inspected. It is derived from the fixture's water and grows
 * downstream. It is a fixture and never shown to readers.
 */
function withFixtureSediment(snapshot: StateSnapshotLike): StateSnapshotLike {
  if (!fixtureSediment.checked) return snapshot;
  const water = snapshot.layers.waterM;
  if (!water) return snapshot;
  const n = snapshot.gridSize;
  const sediment = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const downstream = (y / (n - 1)) ** 2;
    for (let x = 0; x < n; x++) sediment[y * n + x] = water[y * n + x]! * 0.05 * downstream;
  }
  return { ...snapshot, layers: { ...snapshot.layers, suspendedSedimentM: sediment } };
}

let latest: StateSnapshotLike | null = null;

async function pullState(): Promise<void> {
  const snapshot = await solver.snapshot({ layers: INK_VIEW_LAYERS });
  latest = snapshot;
  view.setState(withFixtureSediment(snapshot));
  if (Number(flat.style.opacity || "1") > 0) paintFlat();
  updateReadout();
}

function paintFlat(): void {
  const projection = view.projection();
  const contours = view.contours;
  if (!projection || !contours) return;
  flat.innerHTML = toSvg(contours, {
    projection,
    title: "Flat contour drawing of the fake solver's tilted plane (test fixture)",
  });
}

function setExaggeration(e: number): void {
  view.setExaggeration(e);
  slider.value = String(e);
  sliderValue.textContent = `${view.exaggeration.toFixed(2)} (×${view.verticalExaggeration.toFixed(2)} vertical)`;
  status.textContent =
    view.exaggeration === 0
      ? `Flat drawing: contours every ${DISPLAY.contourIntervalM} m.`
      : `Relief lifted: vertical scale ×${view.verticalExaggeration.toFixed(2)}. No terrain values changed.`;
}

function applyLift(state: LiftState): void {
  view.applyLiftState(state);
  canvas.style.opacity = String(state.canvasOpacity);
  flat.style.opacity = String(state.flatOpacity);
  setExaggeration(state.exaggeration);
  syncLayerBoxes();
}

function syncLayerBoxes(): void {
  for (const id of ["contours", "hachures", "water", "sediment"] as const) {
    $<HTMLInputElement>(`layer-${id}`).checked = view.layers[id];
  }
}

function updateReadout(): void {
  const s = view.stats;
  const rows: [string, string][] = [
    ["Backend", view.backend ?? "not mounted"],
    ["Grid", `${s.gridSize} × ${s.gridSize}`],
    ["Fake solver step", String(latest?.step ?? 0)],
    ["Contour interval", `${DISPLAY.contourIntervalM} m (index every ${DISPLAY.indexEvery})`],
    ["Vertical scale at full lift", `×${DISPLAY.reliefScale}`],
    ["Contour lines / segments", `${s.contourLines} / ${s.contourSegments}`],
    ["Hachures", String(s.hachures)],
    ["Last state update (CPU)", `${s.lastUpdateMs.toFixed(1)} ms`],
  ];
  $("readout").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

function renderLegend(): void {
  $("legend").innerHTML = view
    .legend()
    .map(
      (t) =>
        `<li>${legendSwatchSvg(t, 18)}<span>${t.label}: drawn from ${t.visibleFromM} ${t.unit}, full at ${t.fullAtM} ${t.unit}${t.pattern === "stripes" ? " (striped)" : ""}</span></li>`,
    )
    .join("");
}

let playing = false;
let lastPull = 0;
function tick(now: number): void {
  if (!playing) return;
  solver.step(2);
  if (now - lastPull > 200) {
    lastPull = now;
    void pullState();
  }
  requestAnimationFrame(tick);
}

function setPlaying(on: boolean): void {
  playing = on;
  playButton.setAttribute("aria-pressed", String(on));
  playButton.textContent = on ? "Pause fake solver" : "Run fake solver";
  if (on) requestAnimationFrame(tick);
}

async function main(): Promise<void> {
  await pullState(); // computes contours before the renderer exists: the SVG paints first (T8)
  flat.style.opacity = "1";
  const mountStart = performance.now();
  await view.mount(canvas);
  const mountMs = performance.now() - mountStart;
  paintFlat(); // the projection now uses the canvas size
  renderLegend();
  if (startE !== null) {
    const overlays = params.get("overlays") !== "0";
    view.setLayers({ hachures: overlays, water: overlays, sediment: overlays });
    canvas.style.opacity = "1";
    flat.style.opacity = "0";
    setExaggeration(startE);
    syncLayerBoxes();
  } else {
    setExaggeration(0);
  }
  if (show === "svg") {
    canvas.style.visibility = "hidden";
    flat.style.opacity = "1";
  } else if (show === "canvas") {
    flat.style.visibility = "hidden";
    canvas.style.opacity = "1";
  }
  const renderStart = performance.now();
  await view.renderNow();
  const firstRenderMs = performance.now() - renderStart;
  updateReadout();
  dev.backend = view.backend;
  dev.stats = view.stats;
  dev.timings = { preStepMs, mountMs, firstRenderMs };
  // Two more frames so the compositor has the finished image before a screenshot.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  dev.ready = true;
}

slider.addEventListener("input", () => {
  if (Number(canvas.style.opacity) < 1) {
    canvas.style.opacity = "1";
    flat.style.opacity = "0";
  }
  setExaggeration(Number(slider.value));
});

let run: { cancel(): void } | null = null;
$("lift").addEventListener("click", () => {
  run?.cancel();
  const wasPlaying = playing;
  setPlaying(false);
  paintFlat();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const current = runLift({ apply: applyLift }, { reducedMotion });
  run = current;
  void current.done.then((completed) => {
    if (completed && wasPlaying) setPlaying(true);
  });
});

$("flatten").addEventListener("click", () => {
  run?.cancel();
  applyLift({ phase: "flat", canvasOpacity: 0, flatOpacity: 1, exaggeration: 0, overlays: false });
  paintFlat();
});

playButton.addEventListener("click", () => setPlaying(!playing));

for (const id of ["contours", "hachures", "water", "sediment"] as const) {
  $<HTMLInputElement>(`layer-${id}`).addEventListener("change", (event) => {
    view.setLayers({ [id]: (event.target as HTMLInputElement).checked });
  });
}
fixtureSediment.addEventListener("change", () => {
  if (latest) view.setState(withFixtureSediment(latest));
});
for (const id of ["azimuth", "elevation"] as const) {
  $<HTMLInputElement>(id).addEventListener("input", () => {
    view.setCamera({
      azimuthDeg: Number($<HTMLInputElement>("azimuth").value),
      elevationDeg: Number($<HTMLInputElement>("elevation").value),
    });
    paintFlat();
  });
}

main().catch((error: unknown) => {
  dev.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  status.textContent = `The 3D view could not start (${dev.error}). The flat contour drawing remains.`;
  console.error(error);
});
