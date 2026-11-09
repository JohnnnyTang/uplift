import {
  heightfieldFromFunction,
  projectToViewport,
  sampleSurface,
  toSvg,
  pickHeightfield,
  rayFromViewport,
} from "@hachure/ink";
import { createInkView, INK_VIEW_LAYERS } from "@hachure/ink/view";
import {
  createCpuSolver,
  createTerrainState,
  type TerrainPreset,
  type TerrainConfig,
  type StateSnapshot,
} from "@hachure/terrain";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("terrain");
const overlay = document.getElementById("overlay") as unknown as SVGSVGElement;
const handle = document.getElementById("handle") as unknown as SVGCircleElement;
const wetMarks = document.getElementById("wet") as unknown as SVGPathElement;
const selected = document.getElementById("selected") as unknown as SVGPathElement;
const slider = $<HTMLInputElement>("lift");
const DISPLAY = { contourIntervalM: 0.5, reliefScale: 3 };
const CONFIG: Partial<TerrainConfig> = {
  gridSize: 32,
  metresPerCell: 2,
  seed: 5,
  rainMmPerHr: 0,
  dtSimSeconds: 0.02,
  pipeAreaM2: 1,
  capacityCoefficient: 0,
  erosionRatePerS: 0,
  depositionRatePerS: 0,
  thermalRatePerS: 0,
  evaporationFractionPerStep: 0,
};
const SOURCE = { flowM3PerS: 0.4, batchSteps: 250, initial: { xM: 17, yM: 9 } };
const hill = heightfieldFromFunction(32, 2, (x, y) => 8 * Math.exp(-((x - 32) ** 2 + (y - 32) ** 2) / 450));
const preset: TerrainPreset = {
  id: "5a-prepared-twin-channel",
  create({ gridSize: n, metresPerCell: m }) {
    const s = createTerrainState(n, m, { x: 8, y: n - 1 });
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const xm = (x + 0.5) * m,
          ym = (y + 0.5) * m;
        s.layers.bedrockM[y * n + x] = (64 - ym) * 0.04 + Math.min((xm - 17) ** 2, (xm - 47) ** 2) * 0.006;
      }
    return s;
  },
};
const solver = createCpuSolver(CONFIG, preset);
const view = createInkView({
  ...DISPLAY,
  backend: "webgl2",
  camera: { azimuthDeg: 0, elevationDeg: 48, zoom: 1.05 },
  layers: { hachures: false, sediment: false, water: false },
  channels: { water: { visibleFromM: 0.002, fullAtM: 0.025, maxOpacity: 0.7 } },
});
let mode: "contour" | "water" = "contour";
let source = { ...SOURCE.initial };
let latest: StateSnapshot | null = null;
let busy = false;
const trial = {
  ready: false,
  error: "",
  view,
  solver,
  stats: () => ({
    mode,
    step: solver.stepCount,
    source,
    config: solver.config,
    sourceConfig: SOURCE,
    diagnostics: solver.diagnostics(),
    water: waterStats(),
    contourCount: view.contours?.lines.length,
    verticalExaggeration: view.verticalExaggeration,
  }),
  point: (x: number, y: number) => project(x, y, sampleSurface(view.heightfield!, x, y)),
  switchMode,
  advance,
  moveSource,
};
(globalThis as unknown as { __trial: typeof trial }).__trial = trial;
function waterStats() {
  if (!latest?.layers.waterM) return null;
  const w = latest.layers.waterM;
  let wet = 0,
    south = 0,
    left = 0,
    right = 0;
  for (let i = 0; i < w.length; i++) {
    if (w[i] >= 0.002) {
      wet++;
      south = Math.max(south, Math.floor(i / 32));
    }
    if (i % 32 < 16) left += w[i] * 4;
    else right += w[i] * 4;
  }
  return { wetCells: wet, southernmostWetRow: south, leftM3: left, rightM3: right };
}
function project(x: number, y: number, h: number) {
  const p = view.projection()!;
  return projectToViewport(p, x, y, h, view.exaggeration);
}
function paint() {
  const p = view.projection();
  if (!p || !view.contours || !view.heightfield) return;
  overlay.setAttribute("viewBox", "0 0 " + p.viewport.widthPx + " " + p.viewport.heightPx);
  $("flat").innerHTML = toSvg(view.contours, {
    projection: p,
    title: "Contour diagram; unchanged geometry during lift",
  });
  $("flat").style.display = view.exaggeration === 0 && mode === "contour" ? "block" : "none";
  let wetPath = "";
  if (mode === "water" && latest?.layers.waterM) {
    const w = latest.layers.waterM;
    for (let i = 0; i < w.length; i++)
      if (w[i] >= 0.002) {
        const x = ((i % 32) + 0.5) * 2,
          y = (Math.floor(i / 32) + 0.5) * 2;
        const [px, py] = project(x, y, view.heightfield.heightsM[i]);
        wetPath += "M" + px + "," + py + "h0.1 ";
      }
  }
  wetMarks.setAttribute("d", wetPath);
  let point: readonly number[];
  if (mode === "contour") {
    const line = view.contours.lines.find((l) => l.levelM === 4) ?? view.contours.lines[0];
    const pts = [];
    for (let i = 0; i < line.pointsM.length; i += 2) {
      const [x, y] = project(line.pointsM[i], line.pointsM[i + 1], line.levelM);
      pts.push((i ? "L" : "M") + x + "," + y);
    }
    selected.setAttribute("d", pts.join(" ") + (line.closed ? "Z" : ""));
    point = project(line.pointsM[0], line.pointsM[1], line.levelM);
    $("status").textContent =
      "Selected contour: " +
      line.levelM +
      " m. Vertical view scale ×" +
      view.verticalExaggeration.toFixed(2) +
      ". Terrain values unchanged.";
  } else {
    selected.setAttribute("d", "");
    point = project(source.xM, source.yM, sampleSurface(view.heightfield, source.xM, source.yM));
    const w = waterStats();
    $("status").textContent =
      "Spring at " +
      source.xM.toFixed(1) +
      ", " +
      source.yM.toFixed(1) +
      " model m. " +
      (w ? w.wetCells + " cells show water; furthest wet row " + w.southernmostWetRow + ". " : "") +
      "Model steps: " +
      solver.stepCount +
      ".";
  }
  handle.setAttribute("cx", String(point[0]));
  handle.setAttribute("cy", String(point[1]));
  $("caption").textContent =
    mode === "contour"
      ? "Dashed heavy line: the same selected contour. Lift is presentation only."
      : "Blue: water depth. Ink dots: wet sample cells. Ring: source location. Previous water persists after moving.";
  $("legend").textContent =
    mode === "contour"
      ? "Contour interval " +
        DISPLAY.contourIntervalM +
        " m; full vertical exaggeration ×" +
        DISPLAY.reliefScale +
        "."
      : "Water-depth encoding: visible from " +
        view.legend()[0].visibleFromM +
        " m; full colour at " +
        view.legend()[0].fullAtM +
        " m.";
}
function lift(t: number) {
  view.setExaggeration(t);
  slider.value = String(t);
  paint();
}
async function pull() {
  latest = await solver.snapshot({ layers: INK_VIEW_LAYERS });
  view.setState(latest);
  paint();
  await view.renderNow();
}
async function moveSource(x: number, y: number) {
  source = { xM: Math.min(61, Math.max(3, x)), yM: Math.min(61, Math.max(3, y)) };
  const result = await solver.applyTool({
    kind: "spring",
    id: "reader-spring",
    at: source,
    flowM3PerS: SOURCE.flowM3PerS,
  });
  if (!result.applied || result.clamped.length)
    throw new Error("Source rejected/clamped " + JSON.stringify(result));
  paint();
}
async function advance() {
  if (busy || mode !== "water") return;
  busy = true;
  $<HTMLButtonElement>("advance").disabled = true;
  try {
    solver.step(SOURCE.batchSteps);
    await pull();
  } finally {
    busy = false;
    $<HTMLButtonElement>("advance").disabled = false;
  }
}
async function switchMode(next: "contour" | "water") {
  mode = next;
  document.body.classList.toggle("water", mode === "water");
  $("title").textContent = mode === "contour" ? "Lift a map" : "Where will the water go?";
  $("invite").textContent =
    mode === "contour"
      ? "Drag the ring upward. Watch the same contour rise."
      : "Move the spring. Advance the model and follow the wet surface.";
  $("scope").textContent =
    mode === "contour"
      ? "Static geometry; lift changes the view only."
      : "Process model; uncalibrated time. Fixed terrain, no erosion.";
  view.setLayers({ water: mode === "water" });
  if (mode === "contour") {
    view.setState({ heightfield: hill });
    lift(0);
  } else {
    await moveSource(source.xM, source.yM);
    await pull();
    lift(1);
  }
  paint();
}
slider.addEventListener("input", () => lift(Number(slider.value)));
$("water").addEventListener("click", () => void switchMode("water"));
$("contour").addEventListener("click", () => void switchMode("contour"));
$("advance").addEventListener("click", () => void advance());
$("reset").addEventListener("click", () => {
  solver.reset(preset, solver.config.seed);
  latest = null;
  source = { ...SOURCE.initial };
  void switchMode(mode);
});
$("source").addEventListener("keydown", (e) => {
  const d: Record<string, number[]> = {
    ArrowLeft: [-2, 0],
    ArrowRight: [2, 0],
    ArrowUp: [0, -2],
    ArrowDown: [0, 2],
  };
  if (d[e.key]) {
    e.preventDefault();
    void moveSource(source.xM + d[e.key][0], source.yM + d[e.key][1]);
  }
});
canvas.addEventListener("click", (e) => {
  if (mode !== "water") return;
  const r = canvas.getBoundingClientRect(),
    p = view.projection()!;
  const hit = pickHeightfield(
    view.heightfield!,
    p,
    view.exaggeration,
    rayFromViewport(p, e.clientX - r.left, e.clientY - r.top),
  );
  if (hit) void moveSource(hit.xM, hit.yM);
});
let drag: { y: number; t: number } | null = null;
handle.addEventListener("pointerdown", (e) => {
  if (mode !== "contour") return;
  drag = { y: e.clientY, t: view.exaggeration };
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener("pointermove", (e) => {
  if (drag) lift(Math.min(1, Math.max(0, drag.t + (drag.y - e.clientY) / 160)));
});
handle.addEventListener("pointerup", () => {
  drag = null;
});
handle.addEventListener("pointercancel", () => {
  drag = null;
});
new ResizeObserver(() => {
  view.resize();
  paint();
}).observe(canvas);
window.addEventListener("pagehide", () => {
  view.dispose();
  solver.dispose();
});
async function main() {
  view.setState({ heightfield: hill });
  await view.mount(canvas);
  await switchMode("contour");
  await view.renderNow();
  trial.ready = true;
}
void main().catch((e: unknown) => {
  trial.error = String(e);
  $("status").textContent = trial.error;
});
