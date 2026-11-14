/**
 * Session 6A: summarises every raw repetition in docs/perf/results/raw into docs/perf/results/summary.json and
 * prints the Markdown tables used in docs/perf/README.md.
 *
 *   node docs/perf/summarize.mjs [--include-headless]
 *
 * Statistics are over all samples of a metric for one backend (repetitions pooled): n, median, p90 (nearest
 * rank) and max. Headless repetitions are excluded unless asked for, and are then labelled.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";

const RAW = fileURLToPath(new URL("./results/raw/", import.meta.url));
const includeHeadless = process.argv.includes("--include-headless");
/**
 * Window interruptions (the browser window minimised by someone else, logged and undone by measure.mjs's
 * watchdog) throttle Chrome to about one frame per second. Every sample and measurement window that overlaps
 * one is dropped here and counted in `dropped`; so is everything after a guard that could not restore the
 * display rate. Repetitions whose journey failed keep the steps completed before the failure.
 */
const runs = readdirSync(RAW)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(RAW, f), "utf8")) }))
  .filter((r) => includeHeadless || !r.headless);
/** Known concurrent load on the machine (results/external-load.json), treated like window interruptions. */
const external = existsSync(new URL("./results/external-load.json", import.meta.url))
  ? JSON.parse(readFileSync(new URL("./results/external-load.json", import.meta.url), "utf8")).intervals
  : [];
const dropped = [];
for (const r of runs) {
  const hits = (a, b) => [...(r.interruptions ?? []), ...external].some((i) => a <= i.to && b >= i.from);
  const drop = (what) => dropped.push({ file: r.file, what });
  const badWindow = (w) => w && w.origin !== undefined && hits(w.origin + w.t0, w.origin + w.t1);
  const badSample = (s) =>
    s &&
    s.origin !== undefined &&
    s.inputAt !== undefined &&
    hits(s.origin + s.inputAt, s.origin + s.inputAt + s.visibleMs);
  for (const [name, list] of Object.entries(r.samples))
    r.samples[name] = list.filter((s) => {
      const bad = badSample(s) || badWindow(s.departWindow) || badWindow(s.returnWindow);
      if (bad) drop(`sample ${name}`);
      return !bad;
    });
  for (const [name, w] of Object.entries(r.steps)) {
    const startupBad = w?.interactiveMs !== undefined && hits(w.origin, w.origin + w.interactiveMs + 1500);
    if (startupBad || badWindow(w) || badSample(w)) {
      drop(`step ${name}`);
      delete r.steps[name];
    }
  }
  if ((r.steps.startupCold?.transitionWindow?.fps ?? 60) < 50) {
    drop("step startupCold (transition below 50 fps without a logged interruption: kept, flagged)");
  }
}
const excluded = runs
  .filter((r) => r.errors.length || (r.guards ?? []).some((g) => g.throttled))
  .map((r) => ({
    file: r.file,
    throttledGuards: (r.guards ?? []).filter((g) => g.throttled),
    errors: r.errors,
  }));

const stat = (values) => {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (p) => v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
  const r = (x) => Math.round(x * 10) / 10;
  return { n: v.length, median: r(at(50)), p90: r(at(90)), max: r(v.at(-1)) };
};
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

const METRICS = [
  ["Cold start: first contentful paint (ms)", (r) => [get(r, "steps.startupCold.fcpMs")]],
  ["Cold start: readable drawing painted (ms)", (r) => [get(r, "steps.startupCold.drawingVisibleMs")]],
  ["Cold start: largest contentful paint (ms)", (r) => [get(r, "steps.startupCold.lcpMs")]],
  ["Cold start: 3D stage and live run ready (ms)", (r) => [get(r, "steps.startupCold.stageReadyMs")]],
  ["Cold start: first usable interaction (ms)", (r) => [get(r, "steps.startupCold.interactiveMs")]],
  [
    "Cold start: longest frame before usable (ms)",
    (r) => [get(r, "steps.startupCold.startupWindow.frameMs.max")],
  ],
  ["Transition: duration (ms)", (r) => [get(r, "steps.startupCold.transitionMs")]],
  ["Transition: frames per second", (r) => [get(r, "steps.startupCold.transitionWindow.fps")]],
  ["Transition: p95 frame interval (ms)", (r) => [get(r, "steps.startupCold.transitionWindow.frameMs.p95")]],
  ["Transition: longest frame (ms)", (r) => [get(r, "steps.startupCold.transitionWindow.frameMs.max")]],
  ["Transition: frames over 50 ms", (r) => [get(r, "steps.startupCold.transitionWindow.over50")]],
  ["Warm start: readable drawing painted (ms)", (r) => [get(r, "steps.startupWarm.drawingVisibleMs")]],
  ["Warm start: first usable interaction (ms)", (r) => [get(r, "steps.startupWarm.interactiveMs")]],
  [
    "Warm start: longest transition frame (ms)",
    (r) => [get(r, "steps.startupWarm.transitionWindow.frameMs.max")],
  ],
  [
    "First interaction (rock, page selector): visible response (ms)",
    (r) => [get(r, "steps.firstInteraction.visibleMs")],
  ],
  [
    "Rock by page selector, before advance: visible response (ms)",
    (r) => (r.samples.rockSelectReplace ?? []).map((s) => s.visibleMs),
  ],
  [
    "Rock by specimen drop, before advance: visible response (ms)",
    (r) => (r.samples.rockDropReplace ?? []).map((s) => s.visibleMs),
  ],
  [
    "Rock by specimen drop, new run (kept run): visible response (ms)",
    (r) => (r.samples.rockDropNewRun ?? []).map((s) => s.visibleMs),
  ],
  [
    "Rock by page selector, new run (kept run): visible response (ms)",
    (r) => (r.samples.rockSelectNewRun ?? []).map((s) => s.visibleMs),
  ],
  ["Front face (keyboard): visible response (ms)", (r) => (r.samples.cutKey ?? []).map((s) => s.visibleMs)],
  ["Camera orbit drag: frames per second", (r) => [get(r, "steps.orbitDrag.fps")]],
  ["Camera orbit drag: longest frame (ms)", (r) => [get(r, "steps.orbitDrag.frameMs.max")]],
  ["Play: button to playing state (ms)", (r) => (r.samples.playStart ?? []).map((s) => s.visibleMs)],
  ["Play: button to first advanced landform (ms)", (r) => [get(r, "steps.firstAdvanceVisibleMs")]],
  ["Playback 1x: frames per second", (r) => [get(r, "steps.play1x.fps")]],
  ["Playback 1x: p95 frame interval (ms)", (r) => [get(r, "steps.play1x.frameMs.p95")]],
  ["Playback 1x: longest frame (ms)", (r) => [get(r, "steps.play1x.frameMs.max")]],
  ["Playback 1x: frames over 50 ms per 10 s", (r) => [get(r, "steps.play1x.over50")]],
  ["Playback 1x: model years per second", (r) => [get(r, "steps.play1x.valuePerS")]],
  ["Playback 1x: landform updates per second", (r) => [get(r, "steps.play1x.updatesPerS")]],
  ["Playback 1x: main thread busy (%)", (r) => [get(r, "steps.play1x.mainThreadBusyPct")]],
  ["Playback 1x: renderer CPU (% of one core)", (r) => [get(r, "steps.play1x.cpuPctByProcessType.renderer")]],
  ["Playback 1x: GPU process CPU (% of one core)", (r) => [get(r, "steps.play1x.cpuPctByProcessType.GPU")]],
  ["Playback 4x: frames per second", (r) => [get(r, "steps.playMax.fps")]],
  ["Playback 4x: p95 frame interval (ms)", (r) => [get(r, "steps.playMax.frameMs.p95")]],
  ["Playback 4x: longest frame (ms)", (r) => [get(r, "steps.playMax.frameMs.max")]],
  ["Playback 4x: model years per second", (r) => [get(r, "steps.playMax.valuePerS")]],
  [
    "Playback 4x: renderer CPU (% of one core)",
    (r) => [get(r, "steps.playMax.cpuPctByProcessType.renderer")],
  ],
  ["Scrub (keyboard step): visible response (ms)", (r) => (r.samples.scrubKey ?? []).map((s) => s.visibleMs)],
  [
    "Scrub with kept run (matched time): visible response (ms)",
    (r) => (r.samples.scrubCompare ?? []).map((s) => s.visibleMs),
  ],
  ["Scrub pointer sweep: frames per second", (r) => [get(r, "steps.scrubSweep.fps")]],
  ["Scrub pointer sweep: longest frame (ms)", (r) => [get(r, "steps.scrubSweep.frameMs.max")]],
  [
    "Back to latest moment: visible response (ms)",
    (r) => (r.samples.backToLive ?? []).map((s) => s.visibleMs),
  ],
  [
    "Comparison on/off (kept run): visible response (ms)",
    (r) => (r.samples.compareToggle ?? []).map((s) => s.visibleMs),
  ],
  [
    "Research, first departure while playing: research page visible (ms)",
    (r) => (r.samples.navFirst ?? []).map((s) => s.departVisibleMs),
  ],
  [
    "Research, first departure: terrain backend ready (ms)",
    (r) => (r.samples.navFirst ?? []).map((s) => s.researchReadyMs),
  ],
  [
    "Research, first return: lesson usable (ms)",
    (r) => (r.samples.navFirst ?? []).map((s) => s.returnVisibleMs),
  ],
  [
    "Research, repeat departure: research page visible (ms)",
    (r) => (r.samples.navRepeat ?? []).map((s) => s.departVisibleMs),
  ],
  [
    "Research, repeat return: lesson usable (ms)",
    (r) => (r.samples.navRepeat ?? []).map((s) => s.returnVisibleMs),
  ],
  [
    "Navigation legs: longest frame (ms)",
    (r) =>
      [...(r.samples.navFirst ?? []), ...(r.samples.navRepeat ?? [])].flatMap((s) => [
        s.departWindow?.frameMs?.max,
        s.returnWindow?.frameMs?.max,
      ]),
  ],
  ["Research terrain playing: frames per second", (r) => [get(r, "steps.researchPlay.fps")]],
  ["Research terrain playing: p95 frame interval (ms)", (r) => [get(r, "steps.researchPlay.frameMs.p95")]],
  ["Research terrain playing: longest frame (ms)", (r) => [get(r, "steps.researchPlay.frameMs.max")]],
  ["Research terrain playing: solver steps per second", (r) => [get(r, "steps.researchPlay.valuePerS")]],
  [
    "Research terrain: ms per step (last batch)",
    (r) => {
      const b = get(r, "steps.researchPlay.batch");
      return b && b.batchSteps ? [b.batchMs / b.batchSteps] : [];
    },
  ],
  ["Idle (scene at rest): main thread busy (%)", (r) => [get(r, "steps.idle.mainThreadBusyPct")]],
  ["Leave the page while playing (wall ms, diagnostic)", (r) => [get(r, "steps.leavePageWallMs")]],
];

const memoryRows = (r, prefix) => r.memory.filter((m) => m.label.startsWith(prefix));
const MEMORY = [
  ["JS heap after startup (MB)", (r) => [r.memory.find((m) => m.label === "after startup")?.jsHeapUsedMB]],
  ["JS heap after last repeated run (MB)", (r) => [memoryRows(r, "after run").at(-1)?.jsHeapUsedMB]],
  [
    "JS heap, max over repeated runs (MB)",
    (r) => [Math.max(...memoryRows(r, "after run").map((m) => m.jsHeapUsedMB))],
  ],
  ["Kept runs after last repeated run", (r) => [memoryRows(r, "after run").at(-1)?.kept]],
  [
    "Renderer private memory after startup (MB)",
    (r) => [r.memory.find((m) => m.label === "after startup")?.process.rendererLargest.privateMB],
  ],
  [
    "Renderer private memory after last repeated run (MB)",
    (r) => [memoryRows(r, "after run").at(-1)?.process.rendererLargest.privateMB],
  ],
  [
    "GPU process private memory after startup (MB)",
    (r) => [r.memory.find((m) => m.label === "after startup")?.process.gpuProcess.privateMB],
  ],
  [
    "GPU process private memory after last repeated run (MB)",
    (r) => [memoryRows(r, "after run").at(-1)?.process.gpuProcess.privateMB],
  ],
  [
    "JS heap after first navigation cycle (MB)",
    (r) => [memoryRows(r, "after navigation").at(0)?.jsHeapUsedMB],
  ],
  [
    "JS heap after last navigation cycle (MB)",
    (r) => [memoryRows(r, "after navigation").at(-1)?.jsHeapUsedMB],
  ],
  ["DOM nodes after first navigation cycle", (r) => [memoryRows(r, "after navigation").at(0)?.domNodes]],
  ["DOM nodes after last navigation cycle", (r) => [memoryRows(r, "after navigation").at(-1)?.domNodes]],
  [
    "Renderer private memory after last navigation cycle (MB)",
    (r) => [memoryRows(r, "after navigation").at(-1)?.process.rendererLargest.privateMB],
  ],
  [
    "GPU process private memory after last navigation cycle (MB)",
    (r) => [memoryRows(r, "after navigation").at(-1)?.process.gpuProcess.privateMB],
  ],
];

const backends = [...new Set(runs.map((r) => r.backend))];
const summary = {
  generatedAt: new Date().toISOString(),
  files: runs.map((r) => r.file),
  repetitionsWithIssues: excluded,
  dropped,
  shas: [...new Set(runs.map((r) => r.sha))],
  backends: {},
};
for (const b of backends) {
  const rs = runs.filter((r) => r.backend === b);
  const pool = (fn) => stat(rs.flatMap((r) => fn(r)));
  summary.backends[b] = {
    reps: rs.length,
    repsWithErrors: rs.filter((r) => r.errors.length).map((r) => ({ file: r.file, errors: r.errors })),
    glacierSolver: [...new Set(rs.map((r) => r.glacierSolver))],
    stageRenderer: [...new Set(rs.map((r) => r.device?.stageRenderer))],
    research: [...new Set(rs.map((r) => JSON.stringify(r.research ?? null)))].map((x) => JSON.parse(x)),
    chrome: [...new Set(rs.map((r) => r.chrome))],
    viewport: [...new Set(rs.map((r) => JSON.stringify(r.steps.startupCold?.viewport ?? null)))],
    allStateKept: rs.every((r) =>
      [...(r.samples.navFirst ?? []), ...(r.samples.navRepeat ?? [])].every(
        (l) => l.state.sameRun && l.state.sameRock && l.state.sameGhost && l.state.noHiddenAdvance,
      ),
    ),
    thermalC: rs.map((r) => ({
      start: Object.values(r.thermalStart ?? {}).map((t) => t.celsius),
      end: Object.values(r.thermalEnd ?? {}).map((t) => t.celsius),
    })),
    metrics: Object.fromEntries(METRICS.map(([name, fn]) => [name, pool(fn)])),
    memory: Object.fromEntries(MEMORY.map(([name, fn]) => [name, pool(fn)])),
  };
}
writeFileSync(
  fileURLToPath(new URL("./results/summary.json", import.meta.url)),
  JSON.stringify(summary, null, 1) + "\n",
);

const cell = (s) => (s ? `${s.median} / ${s.p90} / ${s.max} (n ${s.n})` : "n/a");
const table = (rows, key) => {
  const head = `| Measure | ${backends.map((b) => `${b}: median / p90 / max`).join(" | ")} |`;
  const sep = `| --- | ${backends.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    ([name]) => `| ${name} | ${backends.map((b) => cell(summary.backends[b][key][name])).join(" | ")} |`,
  );
  return [head, sep, ...body].join("\n");
};
console.log(table(METRICS, "metrics"));
console.log();
console.log(table(MEMORY, "memory"));
console.log(`
repetitions with errors or throttled guards: ${JSON.stringify(excluded.map((x) => [x.file, x.throttledGuards.length, x.errors.length]))}; dropped samples/windows: ${dropped.length}`);
for (const b of backends)
  console.log(
    `\n${b}: reps ${summary.backends[b].reps}, solver ${summary.backends[b].glacierSolver}, stage ${summary.backends[b].stageRenderer}, research ${JSON.stringify(summary.backends[b].research)}, state kept ${summary.backends[b].allStateKept}, errors ${summary.backends[b].repsWithErrors.length}`,
  );
