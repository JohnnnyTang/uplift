import type {
  ReaderGesture,
  ReaderModelScope,
  ReaderPresentation,
  ReaderSceneController,
  ReaderSceneStatus,
  SceneReadiness,
} from "@hachure/runtime";
import { BindingEngine, type BindingDefinitions, type BindingSample } from "@hachure/runtime";

/** Wiring fixture only: counters below are not a solver, clock, water route or science evidence. */
export interface SceneFixtureOptions {
  readonly scope: ReaderModelScope;
  readonly presentation: ReaderPresentation;
  readonly bindingDefinitions?: BindingDefinitions;
  readonly initialBindings?: BindingSample;
  /** Optional DOM fixture supplied by shell tests; detached DOM never owns the model. */
  readonly attach?: (container: HTMLElement) => void;
  readonly detach?: () => void;
}

export function createSceneFixture(options: SceneFixtureOptions) {
  const bindings = new BindingEngine(options.bindingDefinitions ?? { probes: [], controls: [] });
  if (options.initialBindings) bindings.update(options.initialBindings);
  const defaults = structuredClone(options.presentation);
  // Keep this exact object across navigation; it deliberately isn't a visible snapshot.
  const model = { mutations: 0, sourceId: "authored-source" };
  let presentation = structuredClone(defaults);
  let readiness: SceneReadiness = { kind: "loading" };
  let gesture: ReaderGesture = "idle";
  let activity: ReaderSceneStatus["activity"] = "paused";
  let attached = false;
  let accepting = false;
  let playIntent = false;
  let pending: Promise<void> = Promise.resolve();
  let settling: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  const listeners = new Set<(status: ReaderSceneStatus) => void>();
  const calls: string[] = [];
  const status = (): ReaderSceneStatus => ({ readiness: { ...readiness }, gesture, activity, attached });
  const emit = () => listeners.forEach((listener) => listener(status()));
  const alive = () => {
    if (disposing || readiness.kind === "disposed") throw new Error("Fixture is disposed");
  };
  const ready = () => {
    alive();
    if (!attached || readiness.kind !== "ready") throw new Error("Fixture is not attached and ready");
  };
  const pauseAndSettle = (): Promise<void> => {
    if (settling) return settling;
    accepting = false;
    gesture = "idle";
    activity = "settling";
    calls.push("settle-start");
    emit();
    settling = pending.then(() => {
      activity = "paused";
      calls.push("settled");
      settling = undefined;
      emit();
    });
    return settling;
  };

  const controller: ReaderSceneController = {
    scope: options.scope,
    bindings,
    readiness: () => ({ ...readiness }),
    status,
    subscribe(listener) {
      listeners.add(listener);
      listener(status());
      return () => {
        listeners.delete(listener);
      };
    },
    async mount(container) {
      alive();
      if (settling || attached) throw new Error("Settle/detach before mounting");
      options.attach?.(container);
      attached = true;
      accepting = true;
      if (readiness.kind === "loading") readiness = { kind: "ready" };
      calls.push("mount");
      emit();
    },
    presentation: () => structuredClone(presentation),
    present(state) {
      alive();
      if (!Number.isFinite(state.liftFraction) || state.liftFraction < 0 || state.liftFraction > 1)
        throw new Error("Lift fraction must be in range");
      presentation = structuredClone(state);
      emit();
    },
    pauseAndSettle,
    detach() {
      alive();
      if (settling || accepting || activity !== "paused") throw new Error("Settle before detaching");
      options.detach?.();
      attached = false;
      calls.push("detach");
      emit();
    },
    resume() {
      alive();
      if (
        options.scope.kind === "static-geometry" ||
        readiness.kind === "fallback" ||
        readiness.kind === "error"
      )
        return;
      ready();
      if (settling) throw new Error("Settle before resuming");
      accepting = true;
      activity = playIntent ? "playing" : "paused";
      calls.push("resume");
      emit();
    },
    async reset() {
      alive();
      await pauseAndSettle();
      alive();
      model.mutations = 0;
      model.sourceId = "authored-source";
      presentation = {
        ...structuredClone(defaults),
        level: presentation.level,
        explanationOpen: false,
        prediction: { kind: defaults.prediction.kind === "absent" ? "absent" : "unanswered" },
      };
      playIntent = false;
      accepting = attached && readiness.kind === "ready";
      calls.push("reset");
      emit();
    },
    dispose() {
      if (disposing) return disposing;
      disposing = pauseAndSettle().then(() => {
        if (attached) options.detach?.();
        attached = false;
        readiness = { kind: "disposed" };
        calls.push("dispose");
        emit();
        listeners.clear();
      });
      return disposing;
    },
  };

  return {
    controller,
    /** Fixture driver; production code must use actual host/tool operations. */
    model,
    calls,
    publishBindings: (sample: BindingSample) => bindings.update(sample),
    setPlaying(playing: boolean) {
      ready();
      if (!accepting || options.scope.kind === "static-geometry") throw new Error("Playback unavailable");
      playIntent = playing;
      activity = playing ? "playing" : "paused";
      emit();
    },
    setGesture(value: ReaderGesture) {
      ready();
      if (!accepting) throw new Error("Fixture is departing");
      gesture = value;
      emit();
    },
    /** Hold an accepted mutation to exercise departure/configuration races deterministically. */
    mutate(work: () => Promise<void>): Promise<void> {
      ready();
      if (!accepting) throw new Error("Fixture is departing");
      const accepted = pending.then(async () => {
        await work();
        model.mutations += 1;
        calls.push("mutation");
      });
      pending = accepted.catch(() => {
        /* Failed work is reported to its caller, but the queue still drains. */
      });
      return accepted;
    },
    fail(reason: string, fallback = true) {
      alive();
      readiness = { kind: fallback ? "fallback" : "error", reason };
      accepting = false;
      playIntent = false;
      activity = "paused";
      gesture = "idle";
      emit();
    },
  };
}
