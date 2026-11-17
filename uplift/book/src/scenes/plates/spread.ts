/**
 * _Where plates meet_ as a reader scene (session 7D, D-W7-7D): the production scene behind the reader's
 * `ReaderSceneController`, so the book shell pages, settles and resumes it like lesson 1.
 *
 * The authored-sequence source lives here, not in the scene: turning the page pauses it (`pauseAndSettle`)
 * and disposes the scene's DOM and WebGL; turning back mounts a fresh scene on the same source with the
 * boundary, stage and ghosts as left, and play resumes only if it was playing (no catch-up). `reset()` clears
 * to no boundary chosen and clears the ghosts. Level changes words only. There is no model time.
 */
import {
  BindingEngine,
  type Level,
  type Probe,
  type ReaderPresentation,
  type ReaderSceneController,
  type ReaderSceneStatus,
  type SceneReadiness,
} from "@hachure/runtime";
import { PLATES_DEFAULT_PROBES, platesProbeValues } from "./bindings";
import { type PlatesSceneCopy, PLATES_PLACEHOLDER_COPY } from "./copy";
import type { MountedPlatesScene, PlatesPagePresentation } from "./scene";
import { type PlatesSequence, asBoundary, createPlatesSequence } from "./sequence";

export interface PlatesSpreadOptions {
  readonly level: Level;
  /** Page number of the left page (the right page follows). */
  readonly folio: number;
  /** 7E's words (default: the marked placeholder). */
  readonly copy?: PlatesSceneCopy;
  /** The spread's probes (7E). The scene serves `plates-scene` and `plates-config` (D-W7-7D). */
  readonly probes?: readonly Probe[];
  /** `?mode=flat|tilted`, as lesson 1. */
  readonly mode?: "flat" | "tilted" | "auto";
  /** `?motion=reduce`, as lesson 1. */
  readonly reducedMotion?: boolean;
  /** Drawing only (tests; as without WebGL). */
  readonly staticOnly?: boolean;
  readonly backend?: "auto" | "webgl2" | "webgpu";
}

export function createPlatesSpreadScene(options: PlatesSpreadOptions): ReaderSceneController {
  const copy = options.copy ?? PLATES_PLACEHOLDER_COPY;
  const probes = options.probes ?? PLATES_DEFAULT_PROBES;
  let level = options.level;
  let sequence: PlatesSequence | null = null;
  let mounted: MountedPlatesScene | null = null;
  let readiness: SceneReadiness = { kind: "loading" };
  let attached = false;
  let seen = false;
  let disposed = false;
  let page: PlatesPagePresentation = { prediction: null, flapOpen: false };
  const listeners = new Set<(status: ReaderSceneStatus) => void>();
  // The shell's copy of the bound values (its own text subscribes here); the scene keeps its own engine.
  const bindings = new BindingEngine({ probes, controls: [] });
  const ensureSequence = () => {
    sequence ??= createPlatesSequence({
      reducedMotion: options.reducedMotion === true || matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    return sequence;
  };
  const publish = () => {
    const s = ensureSequence();
    const st = s.source.state();
    const ghosts = s.source.ghosts().flatMap((g) => (asBoundary(g.key) ? [asBoundary(g.key)!] : []));
    bindings.update({
      probe: platesProbeValues(probes, s.relief.config, copy, level, {
        boundary: asBoundary(st.key),
        stage: st.stage,
        ghosts,
      }),
    });
  };
  const status = (): ReaderSceneStatus => ({
    readiness,
    gesture: "idle",
    activity: sequence?.source.state().playing ? "playing" : "paused",
    attached,
  });
  const emit = () => {
    const s = status();
    for (const listener of listeners) listener(s);
  };
  let lastActivity = "paused";
  const changed = () => {
    publish();
    const activity = status().activity;
    if (activity !== lastActivity) {
      lastActivity = activity;
      emit();
    }
  };

  const controller: ReaderSceneController = {
    scope: { kind: "static-geometry" },
    bindings,
    readiness: () => readiness,
    status,
    subscribe(listener) {
      listeners.add(listener);
      listener(status());
      return () => listeners.delete(listener);
    },
    async mount(container, mountOptions) {
      if (disposed) throw new Error("The plates spread is disposed");
      if (attached) return;
      const s = ensureSequence();
      const { mountPlatesScene } = await import("./scene");
      const root = document.createElement("div");
      root.className = "reader-stage-root";
      container.replaceChildren(root);
      let staticReason: string | null = null;
      mounted = await mountPlatesScene(root, {
        sequence: s,
        copy,
        probes,
        level,
        folios: [options.folio, options.folio + 1],
        embedded: true,
        quickTransition: seen,
        deferEntrance: mountOptions?.deferEntrance === true,
        presentation: page,
        onPresentation: (next) => {
          page = next;
        },
        onChange: changed,
        onStatic: (reason) => {
          staticReason = reason;
          // 3D stopped after mounting: say so now (the shell words it as this spread's "drawing only").
          if (attached) {
            readiness = { kind: "fallback", reason };
            emit();
          }
        },
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.reducedMotion ? { reducedMotion: true } : {}),
        ...(options.staticOnly ? { staticOnly: true } : {}),
        ...(options.backend ? { backend: options.backend } : {}),
      });
      // The drawing with the enlarged front face is a complete page; the static view reports "fallback" with
      // its reason, which the book words as "Drawing only" for this spread (its entry's `fallbackStatus`,
      // D-W7-7F): this lesson has no recorded runs. The desk carries data-static="true" for tests.
      readiness = staticReason ? { kind: "fallback", reason: staticReason } : { kind: "ready" };
      attached = true;
      seen = true;
      publish();
      emit();
    },
    presentation: (): ReaderPresentation => ({
      level,
      prediction:
        copy.predict === null
          ? { kind: "absent" }
          : page.prediction === null
            ? { kind: "unanswered" }
            : { kind: "answered", optionIndex: page.prediction },
      explanationOpen: page.flapOpen,
      liftFraction: 1,
      selection: { kind: "none" },
    }),
    present(state) {
      if (disposed) throw new Error("The plates spread is disposed");
      page = {
        prediction: state.prediction.kind === "answered" ? state.prediction.optionIndex : null,
        flapOpen: state.explanationOpen,
      };
      if (state.level !== level) {
        level = state.level;
        mounted?.setLevel(level);
        publish();
      }
    },
    returnToDrawing: async (options) => {
      await mounted?.returnToDrawing(options);
    },
    startEntrance: () => mounted?.startEntrance(),
    async pauseAndSettle() {
      await sequence?.source.pauseAndSettle();
      emit();
    },
    detach() {
      const m = mounted;
      mounted = null;
      attached = false;
      void m?.dispose();
      emit();
    },
    resume() {
      sequence?.source.resume();
      emit();
    },
    async reset() {
      page = { prediction: null, flapOpen: false };
      const s = sequence?.source;
      if (s) {
        const departed = s.state().departed;
        if (departed) s.resume();
        s.dispatch({ kind: "reset" });
        if (departed) await s.pauseAndSettle();
      }
      publish();
      emit();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await mounted?.dispose();
      mounted = null;
      attached = false;
      sequence?.source.dispose();
      readiness = { kind: "disposed" };
      emit();
      listeners.clear();
    },
  };
  return controller;
}
