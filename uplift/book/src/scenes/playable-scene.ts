import { cellAt } from "@hachure/terrain";
import {
  attachSourcePlacement,
  wetSampleMarks,
  createProjection,
  terrainFrameFromHeightfield,
  extractContours,
  toSvg,
  projectToViewport,
  sampleSurface,
  type Heightfield,
} from "@hachure/ink";
import { createInkView, type InkView, type InkBackendRequest } from "@hachure/ink/view";
import {
  BindingEngine,
  type Level,
  type ReaderSceneController,
  type ReaderPresentation,
  type ReaderSceneStatus,
} from "@hachure/runtime";
import { GEOMETRY_PROBES } from "./content";
import { createWaterInitial, DISPLAY, SOURCE, RESPONSE_STEPS } from "./geometry";
import type { WaterSceneDriver } from "./water-driver";
import "./scene.css";
export interface PlayableSceneOptions {
  readonly level?: Level;
  readonly flat?: boolean;
  readonly inkBackend?: InkBackendRequest;
  readonly createWaterDriver?: () => Promise<WaterSceneDriver | null>;
}
/** The water lesson's scene adapter; all geometric selection and gesture transforms live in Ink. */
export function createPlayableScene(options: PlayableSceneOptions = {}): ReaderSceneController {
  const initial = createWaterInitial();
  let field: Heightfield = {
    gridSize: initial.gridSize,
    metresPerCell: initial.metresPerCell,
    heightsM: initial.bedrockM,
  };
  let depths: Float32Array | undefined,
    driver: WaterSceneDriver | null = null,
    view: InkView | null = null;
  let state: ReaderPresentation = {
    level: options.level ?? "hs",
    prediction: { kind: "unanswered" },
    explanationOpen: false,
    liftFraction: 0,
    selection: { kind: "source", id: SOURCE.id, ...SOURCE.at },
  };
  const defaults = structuredClone(state),
    bindings = new BindingEngine({ probes: GEOMETRY_PROBES, controls: [] });
  let status: ReaderSceneStatus = {
    readiness: { kind: "loading" },
    gesture: "idle",
    activity: "paused",
    attached: false,
  };
  const listeners = new Set<(s: ReaderSceneStatus) => void>();
  const emit = () => listeners.forEach((f) => f({ ...status }));
  let root: HTMLElement | null = null,
    canvas: HTMLCanvasElement | null = null,
    overlay: SVGSVGElement | null = null,
    fallback: HTMLElement | null = null,
    caption: HTMLElement | null = null,
    legend: HTMLElement | null = null,
    sourceButton: HTMLButtonElement | null = null;
  let observer: ResizeObserver | null = null,
    release: (() => void) | null = null,
    accepting = false,
    disposed = false,
    initialized = false;
  let pending: Promise<void> = Promise.resolve();
  let generation = 0;
  let remainingSteps = 0;
  let acceptedSource = { ...SOURCE.at };
  let placementNotice = "";
  let mounting: Promise<void> | null = null;
  let disposing = false;
  const alive = () => {
    if (disposed || disposing) throw new Error("Scene is disposed");
  };
  const enqueue = (work: () => Promise<void>) => {
    const result = pending.then(work);
    pending = result.catch(() => undefined);
    return result;
  };
  const projection = () =>
    view?.projection() ??
    createProjection(
      terrainFrameFromHeightfield(field),
      { azimuthDeg: 0, elevationDeg: 48, zoom: 1.05 },
      { widthPx: canvas?.clientWidth || 480, heightPx: canvas?.clientHeight || 420 },
      DISPLAY.reliefScale,
    );
  function paint() {
    const p = projection(),
      fraction = status.readiness.kind === "fallback" ? 0 : state.liftFraction;
    const wet = depths
      ? wetSampleMarks(field, depths, DISPLAY.wetThresholdM, p, fraction)
      : { path: "", wetCells: 0, leftCells: 0, rightCells: 0 };
    bindings.update({
      probe: {
        wetCells: wet.wetCells,
        sourceX: acceptedSource.xM,
        sourceY: acceptedSource.yM,
        threshold: DISPLAY.wetThresholdM,
        fullDepth: DISPLAY.waterFullAtM,
        width: field.gridSize * field.metresPerCell,
      },
    });
    if (!root || !overlay) return;
    const flat = status.readiness.kind === "fallback" || status.readiness.kind === "loading";
    fallback!.hidden = !flat;
    canvas!.hidden = flat;
    if (flat)
      fallback!.innerHTML = toSvg(view?.contours ?? extractContours(field, DISPLAY.contourIntervalM), {
        projection: p,
        title: "Static contour map of the prepared terrain. Live water unavailable.",
      });
    overlay.setAttribute("viewBox", `0 0 ${p.viewport.widthPx} ${p.viewport.heightPx}`);
    overlay.querySelector("[data-wet]")!.setAttribute("d", flat ? "" : wet.path);
    const xy = projectToViewport(
      p,
      acceptedSource.xM,
      acceptedSource.yM,
      sampleSurface(field, acceptedSource.xM, acceptedSource.yM),
      fraction,
    );
    const ring = overlay.querySelector("[data-ring]")!;
    ring.setAttribute("cx", String(xy[0]));
    ring.setAttribute("cy", String(xy[1]));
    const hint = overlay.querySelector("[data-hint]")!;
    hint.setAttribute("x", String(xy[0] + 16));
    hint.setAttribute("y", String(xy[1] - 14));
    hint.textContent = "spring";
    sourceButton!.disabled = flat || status.activity === "settling";
    caption!.textContent = flat
      ? `Flat diagram. ${status.readiness.kind === "fallback" ? status.readiness.reason : "Preparing the illustration."} No live water process is running.`
      : bindings.render("Earlier water remains after moving. Ink dots show where this surface is wet.");
    if (state.level === "uni" && !flat)
      caption!.textContent = bindings.render(
        "Spring at {{probe.sourceX}}, {{probe.sourceY}}. {{probe.wetCells}} wet cells. Earlier water remains after moving.",
      );
    if (!flat && placementNotice) caption!.textContent += " " + placementNotice;
    legend!.textContent = bindings.render(
      "Blue = water depth; ink dots = cells at least {{probe.threshold}} deep. Full blue at {{probe.fullDepth}}. Model width {{probe.width}}.",
    );
  }
  async function pull() {
    if (!driver) return;
    const snap = await driver.snapshot();
    depths = snap.layers.waterM;
    field = {
      gridSize: snap.gridSize,
      metresPerCell: snap.metresPerCell,
      heightsM: Float32Array.from(snap.layers.bedrockM!, (h, i) => h + (snap.layers.sedimentM?.[i] ?? 0)),
    };
    view?.setState(snap);
    paint();
  }
  async function response(token: number) {
    if (!driver) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    status = { ...status, activity: "playing" };
    emit();
    while (remainingSteps > 0 && token === generation) {
      const steps = Math.min(250, remainingSteps);
      await driver.advance(steps);
      remainingSteps -= steps;
      if (!reduced) {
        await pull();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    await pull();
    status = { ...status, activity: "paused" };
    paint();
    emit();
  }
  function place(xM: number, yM: number) {
    if (!accepting || status.readiness.kind !== "ready" || !driver) return Promise.resolve();
    const at = {
      xM: Math.min((field.gridSize - 1.5) * field.metresPerCell, Math.max(1.5 * field.metresPerCell, xM)),
      yM: Math.min((field.gridSize - 1.5) * field.metresPerCell, Math.max(1.5 * field.metresPerCell, yM)),
    };
    if (!cellAt(field.gridSize, field.metresPerCell, at)) return Promise.resolve();
    const limited = at.xM !== xM || at.yM !== yM;
    const token = ++generation;
    return enqueue(async () => {
      const result = await driver!.place({ ...SOURCE, at });
      if (result.applied) {
        acceptedSource = { ...at };
        placementNotice =
          limited || result.clamped.length ? "The spring was limited to the drawable surface." : "";
        remainingSteps = RESPONSE_STEPS;
        state = { ...state, liftFraction: 1, selection: { kind: "source", id: SOURCE.id, ...at } };
        view?.setExaggeration(1);
        paint();
        await response(token);
      } else {
        caption!.textContent = "Source placement was rejected; the previous spring is retained.";
      }
    }).catch(fail);
  }
  function fail(error: unknown) {
    generation++;
    accepting = false;
    status = {
      ...status,
      activity: "paused",
      gesture: "idle",
      readiness: { kind: "fallback", reason: error instanceof Error ? error.message : String(error) },
    };
    view?.dispose();
    view = null;
    paint();
    emit();
  }
  const controller: ReaderSceneController = {
    scope: { kind: "live-process", time: "uncalibrated" },
    bindings,
    readiness: () => status.readiness,
    status: () => ({ ...status }),
    subscribe(f) {
      listeners.add(f);
      f({ ...status });
      return () => {
        listeners.delete(f);
      };
    },
    presentation: () => structuredClone(state),
    present(next) {
      alive();
      if (!Number.isFinite(next.liftFraction) || next.liftFraction < 0 || next.liftFraction > 1)
        throw new RangeError("Invalid lift");
      state = structuredClone(next);
      view?.setExaggeration(state.liftFraction);
      paint();
      emit();
    },
    mount(container) {
      const run = async () => {
        alive();
        if (status.attached) throw new Error("Already attached");
        root = document.createElement("section");
        root.className = "playable-scene";
        root.innerHTML = `<div class="playable-drawing"><canvas aria-label="Place a spring on the prepared surface"></canvas><div class="playable-flat"></div><svg class="playable-overlay" aria-hidden="true"><path data-wet class="wet-marks"/><circle data-ring r="10" class="scene-ring"/><text data-hint class="scene-hint"/></svg></div><div class="playable-controls"><button type="button" class="source-keyboard">Move spring with arrow keys</button></div><p class="scene-caption" role="status" aria-live="polite"></p><p class="scene-legend"></p>`;
        container.append(root);
        canvas = root.querySelector("canvas");
        overlay = root.querySelector("svg");
        fallback = root.querySelector(".playable-flat");
        caption = root.querySelector(".scene-caption");
        legend = root.querySelector(".scene-legend");
        sourceButton = root.querySelector("button");
        status = { ...status, attached: true };
        accepting = true;
        paint();
        const gesture = (active: boolean) => {
          status = { ...status, gesture: active ? "source" : "idle" };
          emit();
        };
        release = attachSourcePlacement({
          canvas: canvas!,
          marker: overlay!.querySelector("[data-ring]")!,
          keyboard: sourceButton!,
          geometry: () => ({ field, projection: projection(), liftFraction: state.liftFraction }),
          source: () => acceptedSource,
          place: (x, y) => {
            void place(x, y);
          },
          gesture,
        });
        observer = new ResizeObserver(() => {
          view?.resize();
          paint();
        });
        observer.observe(root.querySelector(".playable-drawing")!);
        try {
          if (options.flat) {
            fail("This device is showing the static map.");
            return;
          }
          if (!initialized) {
            driver = (await options.createWaterDriver?.()) ?? null;
            if (disposing || disposed) {
              driver?.dispose();
              driver = null;
              return;
            }
            if (!driver) {
              fail("Live water is unavailable on this device.");
              return;
            }
            await pull();
          }
          initialized = true;
          view = createInkView({
            contourIntervalM: DISPLAY.contourIntervalM,
            reliefScale: DISPLAY.reliefScale,
            backend: options.inkBackend ?? "auto",
            camera: { azimuthDeg: 0, elevationDeg: 48, zoom: 1.05 },
            layers: { hachures: true, sediment: false, water: true },
            channels: {
              water: {
                visibleFromM: DISPLAY.wetThresholdM,
                fullAtM: DISPLAY.waterFullAtM,
                maxOpacity: DISPLAY.waterOpacity,
              },
            },
            onContextLost: fail,
          });
          view.setState({ heightfield: field, ...(depths ? { waterM: depths } : {}) });
          await view.mount(canvas!);
          if (disposing || disposed) {
            view.dispose();
            view = null;
            return;
          }
          view.setExaggeration(state.liftFraction);
          status = { ...status, readiness: { kind: "ready" } };
          paint();
          await view.renderNow();
          emit();
        } catch (error) {
          if (!disposing && !disposed) fail(error);
        }
      };
      mounting = run();
      return mounting.finally(() => {
        mounting = null;
      });
    },
    async pauseAndSettle() {
      accepting = false;
      generation++;
      status = { ...status, activity: "settling", gesture: "idle" };
      emit();
      await mounting;
      await pending;
      await driver?.settle();
      status = { ...status, activity: "paused" };
      paint();
      emit();
    },
    detach() {
      alive();
      if (accepting || status.activity !== "paused") throw new Error("Settle before detach");
      release?.();
      observer?.disconnect();
      view?.dispose();
      view = null;
      root?.remove();
      root = null;
      status = { ...status, attached: false };
      emit();
    },
    resume() {
      alive();
      if (status.attached && status.readiness.kind === "ready") {
        accepting = true;
        if (remainingSteps > 0) {
          const token = ++generation;
          void enqueue(() => response(token)).catch(fail);
        }
      }
    },
    async reset() {
      alive();
      await controller.pauseAndSettle();
      remainingSteps = 0;
      await driver?.reset();
      acceptedSource = { ...SOURCE.at };
      placementNotice = "";
      state = { ...structuredClone(defaults), level: state.level };
      if (driver) await pull();
      view?.setExaggeration(0);
      accepting = status.attached && status.readiness.kind === "ready";
      paint();
      emit();
    },
    async dispose() {
      if (disposed || disposing) return;
      disposing = true;
      await mounting;
      await controller.pauseAndSettle();
      disposing = false;
      if (status.attached) controller.detach();
      driver?.dispose();
      disposed = true;
      status = { ...status, readiness: { kind: "disposed" } };
      emit();
      listeners.clear();
    },
  };
  return controller;
}
