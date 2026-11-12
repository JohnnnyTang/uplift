/**
 * The live glacier runtime (session 5J `GlacialHost`) as the glacial scene's source (session 5M). The scene
 * reads `viewFrame()` for what is shown and `comparison()` for the ghost; every reader action on runs and time
 * is one `host.dispatch(command)`. The page rock selector and the specimen dropped on the block both call
 * `chooseRock`, which sends `{ kind: "choose-rock", rockId }` (GV1).
 *
 * Measures (margin notes, lens, text alternative, graphs) come from the model's section probes on the same
 * snapshot the scene draws, so page, figure and notes refer to the same run and time (GV5).
 */
import type { GlacialHost, GlacialHostState, RecordedRun } from "@hachure/runtime/glacial";
import { ROCK_IDS, type GlacierSnapshot, type RockId, isRockId } from "@hachure/glacier";
import {
  CAPTURE_ORIENTATION,
  type FrameMeasures,
  TREELINE_BELOW_SNOWLINE_M,
  createFrameMeasures,
  toLandscapeSnapshot,
} from "../scenes/glacial/runs";
import type { GlacialSceneSource, SceneRunRef, SceneSeriesPoint } from "../scenes/glacial/source";
import type { LandscapeSnapshot } from "@hachure/ink/stage";

/**
 * Headroom above the starting valley's highest surface for the block's vertical frame (unit: metres). Display
 * only: the recorded 300-year runs reach about 48 m above it (thickest ice near the head). The frame grows if
 * a run ever exceeds it.
 */
export const FRAME_ICE_HEADROOM_M = 60;

export function createLiveSource(
  host: GlacialHost,
  lookIdFor: (rockKey: string) => number,
): GlacialSceneSource {
  const listeners = new Set<() => void>();
  const starts = new Map<string, { glacier: GlacierSnapshot; landscape: LandscapeSnapshot }>();
  const measured = new Map<string, FrameMeasures>();
  const recorded = new Map<string, { glacier: GlacierSnapshot; measures: FrameMeasures }>();
  const state = (): GlacialHostState => host.state();
  const startOf = (run: RecordedRun) => {
    let s = starts.get(run.id);
    if (!s) {
      const glacier = run.snapshot(0);
      s = { glacier, landscape: toLandscapeSnapshot(glacier, lookIdFor(run.rockId)) };
      starts.set(run.id, s);
    }
    return s;
  };
  const measuresFor = (key: string, g: GlacierSnapshot, run: RecordedRun) => {
    let m = measured.get(key);
    if (!m) {
      if (measured.size > 8) measured.delete(measured.keys().next().value!);
      m = createFrameMeasures(g, startOf(run).glacier);
      measured.set(key, m);
    }
    return m;
  };
  const refOf = (run: { id: string; rockId: RockId; ordinal: number; backend: string }): SceneRunRef => ({
    id: run.id,
    rockKey: run.rockId,
    rockId: lookIdFor(run.rockId),
    ordinal: run.ordinal,
    backend: run.backend,
  });
  const liveRun = () => {
    const live = state().live;
    if (!live) throw new Error("The glacier runtime has no live run");
    return host.run(live.id)!;
  };

  // The block's vertical frame: from the authored start (identical for every rock and run).
  const first = startOf(liveRun()).glacier;
  let minM = Infinity;
  let maxM = -Infinity;
  for (let k = 0; k < first.bedM.length; k++) {
    minM = Math.min(minM, first.bedM[k]!);
    maxM = Math.max(maxM, first.bedM[k]! + first.iceThicknessM[k]!);
  }
  const elevationRangeM = { minM, maxM: maxM + FRAME_ICE_HEADROOM_M };
  const snowlineM = host.model.snowlineAltitudeM;

  const dispatchQuiet = async (command: Parameters<GlacialHost["dispatch"]>[0]) => {
    await host.dispatch(command);
  };

  const source: GlacialSceneSource = {
    kind: "live",
    provenance: "Live run of the glacier model",
    orientation: CAPTURE_ORIENTATION,
    dressing: { snowlineM, treelineM: snowlineM - TREELINE_BELOW_SNOWLINE_M },
    elevationRangeM,
    rocks: ROCK_IDS,
    shown() {
      const frame = host.viewFrame();
      if (!frame) throw new Error("The glacier runtime has no frame to show");
      const run = host.run(frame.runId)!;
      const key = `${frame.kind}:${frame.runId}:${frame.step}`;
      const snapshot = toLandscapeSnapshot(frame.snapshot, lookIdFor(frame.rockId));
      return {
        key,
        run: refOf(run),
        label: frame.label,
        modelYears: frame.modelYears,
        past: frame.kind === "recorded",
        snapshot,
        start: startOf(run).landscape,
        ...measuresFor(key, frame.snapshot, run),
      };
    },
    ghost() {
      const c = host.comparison();
      if (!c || c.status === "unmatched") return null;
      const run = host.run(c.runId)!;
      const key = `ghost:${c.runId}:${c.index}`;
      const g = c.snapshot();
      return {
        key,
        run: refOf(run),
        label: c.label,
        modelYears: c.modelYears,
        snapshot: toLandscapeSnapshot(g, lookIdFor(run.rockId)),
        ...measuresFor(key, g, run),
      };
    },
    ghostNote() {
      const c = host.comparison();
      return c && c.status === "unmatched" ? c.label : null;
    },
    kept: () =>
      [...state().kept].reverse().map((k) => refOf({ ...k, backend: k.backend, ordinal: k.ordinal })),
    comparedId: () => state().compareRunId,
    timeline() {
      const s = state();
      const live = s.live!;
      const times = [...live.recordedYears];
      if (live.modelYears > (times.at(-1) ?? -1)) times.push(live.modelYears);
      const view = s.view;
      let index = times.length - 1;
      if (view.kind === "recorded" && view.runId === live.id) {
        const k = times.indexOf(view.modelYears);
        if (k >= 0) index = k;
      }
      return {
        times,
        index,
        atLive: view.kind === "live",
        playing: s.activity === "playing",
        busy: s.activity === "busy" || s.activity === "settling",
        status: live.status,
      };
    },
    notice() {
      const n = state().notice;
      if (!n) return null;
      if (n.kind === "evicted")
        return {
          kind: "dropped",
          run: refOf({ id: n.runId, rockId: n.rockId, ordinal: n.ordinal, backend: n.backend }),
        };
      return { kind: "halted", message: n.failure.message };
    },
    offersCpuRestart: () => state().offer !== null,
    backend() {
      const s = state();
      return s.backend ? { backend: s.backend, fallbackReason: s.fallbackReason } : null;
    },
    series(i) {
      const runs = host.runs();
      return runs.map((run) => {
        const points: SceneSeriesPoint[] = [];
        for (let k = 0; k < run.count; k++) {
          const key = `${run.id}:${k}`;
          let r = recorded.get(key);
          if (!r) {
            const glacier = run.snapshot(k);
            r = { glacier, measures: createFrameMeasures(glacier, startOf(run).glacier) };
            recorded.set(key, r);
          }
          points.push({ modelYears: run.times[k]!, section: r.measures.section(i) });
        }
        return { run: refOf(run), points };
      });
    },
    async chooseRock(rockKey) {
      if (!isRockId(rockKey)) return;
      await dispatchQuiet({ kind: "choose-rock", rockId: rockKey });
    },
    play: () => dispatchQuiet({ kind: "play" }),
    pause: () => dispatchQuiet({ kind: "pause" }),
    step: () => dispatchQuiet({ kind: "step" }),
    setSpeed: (speed) => dispatchQuiet({ kind: "set-speed", speed }),
    speed: () => state().speed,
    async scrubTo(index) {
      const t = source.timeline();
      const years = t.times[Math.min(t.times.length - 1, Math.max(0, index))]!;
      await dispatchQuiet({ kind: "scrub", modelYears: years });
    },
    returnToLive: () => dispatchQuiet({ kind: "return-to-live" }),
    compare: (runId) => dispatchQuiet({ kind: "compare", runId }),
    restartOnCpu: () => dispatchQuiet({ kind: "restart-on-cpu" }),
    async reset(confirmed) {
      const result = await host.dispatch({ kind: "reset", confirmed });
      if (result.kind === "confirm-required") return "confirm";
      starts.clear();
      measured.clear();
      recorded.clear();
      return "done";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      unsubscribe();
    },
  };
  // Drop cached decodes of runs the host no longer holds.
  const unsubscribe = host.subscribe(() => {
    const held = new Set(host.runs().map((r) => r.id));
    for (const id of [...starts.keys()]) if (!held.has(id)) starts.delete(id);
    for (const key of [...recorded.keys()]) if (!held.has(key.split(":")[0]!)) recorded.delete(key);
    listeners.forEach((l) => l());
  });
  return source;
}
