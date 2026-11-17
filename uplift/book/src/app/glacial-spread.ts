/**
 * "From V to U" as a reader scene (session 5M): the 5K production scene, the 5L lesson and the 5J live runtime,
 * joined behind the reader's `ReaderSceneController`, so the book shell pages, settles and resumes it like any
 * other spread.
 *
 * The scene owns the whole tilted spread (both pages). The `GlacialHost` and its runs live in the controller,
 * not in the scene: turning the page settles the host and disposes the scene's DOM and WebGL; turning back
 * mounts a fresh scene on the same host, with every run, kept run and comparison as they were (§4 "Leave /
 * return": no hidden advance or catch-up). The reading level changes words, controls and overlays only.
 */
import {
  BindingEngine,
  type Level,
  type ReaderPresentation,
  type ReaderSceneController,
  type ReaderSceneStatus,
  type SceneReadiness,
} from "@hachure/runtime";
import {
  GlacialHost,
  GlacialWorkerTransport,
  type GlacialBackendPreference,
  type GlacialTransport,
  driveGlacialHost,
} from "@hachure/runtime/glacial";
import { U_VALLEY_VIEW, uValleyProbes } from "@uplift/spreads";
import type { GlacialPagePresentation, MountedGlacialScene } from "../scenes/glacial/review";
import type { GlacialSceneSource } from "../scenes/glacial/source";
import { createLiveSource } from "./glacial-live-source";

export interface GlacialSpreadOptions {
  readonly level: Level;
  /** Page number of the left page (the right page follows). */
  readonly folio: number;
  /** `?glacier=cpu|webgpu` forces a backend (diagnostics and browser tests); default auto (WebGPU where it passes). */
  readonly prefer?: GlacialBackendPreference;
  readonly createTransport?: () => GlacialTransport;
  /** `?mode=flat|tilted`, `?motion=reduce` (review and tests). */
  readonly mode?: "flat" | "tilted" | "auto";
  readonly reducedMotion?: boolean;
}

const defaultTransport = () =>
  new GlacialWorkerTransport(new Worker(new URL("./glacial.worker.ts", import.meta.url), { type: "module" }));

export function createGlacialSpreadScene(options: GlacialSpreadOptions): ReaderSceneController {
  let level = options.level;
  let host: GlacialHost | null = null;
  let hostReady: Promise<GlacialHost> | null = null;
  let source: GlacialSceneSource | null = null;
  let mounted: MountedGlacialScene | null = null;
  let stopDrive: (() => void) | null = null;
  let unsubscribeHost: (() => void) | null = null;
  let unsubscribeFallback: (() => void) | null = null;
  let startupFailure: string | null = null;
  let recordingsFailure: string | null = null;
  let staticReason: string | null = null;
  let fallbackSuspended = false;
  let fallbackPlayIntent = false;
  let readiness: SceneReadiness = { kind: "loading" };
  let attached = false;
  let seen = false;
  let disposed = false;
  let page: GlacialPagePresentation = { prediction: null, flapOpen: false };
  const listeners = new Set<(status: ReaderSceneStatus) => void>();
  const bindings = new BindingEngine({ probes: uValleyProbes, controls: [] });

  const status = (): ReaderSceneStatus => {
    const activity = host?.state().activity;
    return {
      readiness,
      gesture: "idle",
      activity:
        activity === "playing" || (!host && source?.timeline().playing)
          ? "playing"
          : activity === "settling"
            ? "settling"
            : "paused",
      attached,
    };
  };
  const emit = () => {
    const s = status();
    for (const listener of listeners) listener(s);
  };
  const ensureHost = () => {
    hostReady ??= (async () => {
      const h = new GlacialHost({
        transport: (options.createTransport ?? defaultTransport)(),
        prefer: options.prefer ?? "auto",
      });
      try {
        await h.initialize();
      } catch (error) {
        await h.dispose();
        throw error;
      }
      host = h;
      unsubscribeHost = h.subscribe(() => emit());
      return h;
    })();
    return hostReady;
  };

  const updateReadiness = () => {
    if (staticReason) readiness = { kind: "fallback", reason: `Drawing only: ${staticReason}` };
    else if (source?.kind === "fixture")
      readiness = {
        kind: "fallback",
        reason: `Illustration preview only: no live model or recorded runs are available.${recordingsFailure ? ` Recorded runs could not load (${recordingsFailure}).` : ""}`,
      };
    else if (source?.kind === "recorded")
      readiness = {
        kind: "fallback",
        reason: `Showing recorded runs: the live model could not start (${startupFailure ?? "unavailable"}); no live simulation is running.`,
      };
    else readiness = { kind: "ready" };
  };

  const presentation = (): ReaderPresentation => ({
    level,
    prediction:
      page.prediction === null ? { kind: "unanswered" } : { kind: "answered", optionIndex: page.prediction },
    explanationOpen: page.flapOpen,
    liftFraction: 1,
    selection: { kind: "none" },
  });

  const controller: ReaderSceneController = {
    scope: { kind: "live-process", time: "uncalibrated" },
    bindings,
    readiness: () => readiness,
    status,
    subscribe(listener) {
      listeners.add(listener);
      listener(status());
      return () => listeners.delete(listener);
    },
    async mount(container, mountOptions) {
      if (disposed) throw new Error("The glacial spread is disposed");
      if (attached) return;
      const { mountGlacialScene } = await import("../scenes/glacial/review");
      const root = document.createElement("div");
      root.className = "reader-stage-root";
      container.replaceChildren(root);
      staticReason = null;
      const common = {
        embedded: true,
        level,
        folios: [options.folio, options.folio + 1] as const,
        defaultCutColumn: U_VALLEY_VIEW.defaultFrontFace.gridColumn,
        quickTransition: seen,
        deferEntrance: mountOptions?.deferEntrance === true,
        presentation: page,
        onPresentation: (next: GlacialPagePresentation) => {
          page = next;
        },
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.reducedMotion ? { reducedMotion: true } : {}),
      };
      mounted = await mountGlacialScene(root, {
        ...common,
        ownsSource: false,
        createSource: async (context) => {
          if (source) return source;
          try {
            const h = await ensureHost();
            return createLiveSource(h, context.lookIdFor);
          } catch (error) {
            // Load the fallback in this same mount, without abandoning a half-built scene.
            startupFailure = error instanceof Error ? error.message : String(error);
            return null;
          }
        },
        onSource: (next, loadError) => {
          if (source !== next) {
            unsubscribeFallback?.();
            source = next;
            unsubscribeFallback = next.kind === "live" ? null : next.subscribe(emit);
          }
          if (loadError) recordingsFailure = loadError;
        },
        onStatic: (reason) => {
          staticReason = reason;
          updateReadiness();
          if (attached) emit();
        },
      });
      updateReadiness();
      if (host && !staticReason) stopDrive = driveGlacialHost(host);
      attached = true;
      seen = true;
      emit();
    },
    presentation,
    present(state) {
      if (disposed) throw new Error("The glacial spread is disposed");
      page = {
        prediction: state.prediction.kind === "answered" ? state.prediction.optionIndex : null,
        flapOpen: state.explanationOpen,
      };
      if (state.level !== level) {
        level = state.level;
        mounted?.setLevel(level);
      }
    },
    returnToDrawing: async (options) => {
      await mounted?.returnToDrawing(options);
    },
    startEntrance: () => mounted?.startEntrance(),
    async pauseAndSettle() {
      if (host) await host.pauseAndSettle();
      else if (source) {
        if (!fallbackSuspended) {
          fallbackPlayIntent = source.timeline().playing;
          fallbackSuspended = true;
        }
        await source.pause();
      }
      emit();
    },
    detach() {
      stopDrive?.();
      stopDrive = null;
      const m = mounted;
      mounted = null;
      attached = false;
      void m?.dispose();
      emit();
    },
    resume() {
      if (!staticReason) {
        host?.resume();
        if (fallbackSuspended && fallbackPlayIntent) void source?.play();
      }
      fallbackSuspended = false;
      fallbackPlayIntent = false;
      emit();
    },
    async reset() {
      page = { prediction: null, flapOpen: false };
      if (host) {
        await host.pauseAndSettle();
        host.resume();
        await host.dispatch({ kind: "pause" });
        await host.dispatch({ kind: "reset", confirmed: true });
      } else {
        fallbackPlayIntent = false;
        await source?.reset(true);
      }
      emit();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      stopDrive?.();
      await mounted?.dispose();
      mounted = null;
      attached = false;
      unsubscribeFallback?.();
      source?.dispose();
      unsubscribeHost?.();
      const h = host ?? (hostReady ? await hostReady.catch(() => null) : null);
      await h?.dispose();
      readiness = { kind: "disposed" };
      emit();
      listeners.clear();
    },
  };
  return controller;
}
