/**
 * Glacial runtime fixture (session 5J): the runs/time/comparison runtime behind plain controls. Not a lesson,
 * not the scene (5K) and not the book (5M). Every number shown is read from host state.
 *
 * URL: `?prefer=auto|cpu|webgpu` (default cpu), `&transport=worker|main`, `&fault=skew-erosion|invalid-shader`
 * (diagnostic GPU fault), `&fakeGpuFailAt=<step>` (labelled CPU-as-"WebGPU" test fake that fails mid-run),
 * `&runs=production` (the production recording defaults: 20-year interval, 300-year horizon).
 */
import {
  GlacialHost,
  GlacialWorkerTransport,
  driveGlacialHost,
  type GlacialCommand,
  type GlacialHostState,
  type GlacialTransport,
} from "../../hachure/runtime/src/glacial-host/index";
import type { RockId } from "../../hachure/glacier/src/index";
import { InProcessGlacialTransport } from "../../hachure/runtime/src/glacial-host/worker";
import { ReaderLifecycle, type Level } from "../../hachure/runtime/src/index";

const params = new URLSearchParams(location.search);
const prefer = (params.get("prefer") ?? "cpu") as "auto" | "cpu" | "webgpu";
const fault = params.get("fault") as "skew-erosion" | "invalid-shader" | null;
const fakeGpuFailAt = params.has("fakeGpuFailAt") ? Number(params.get("fakeGpuFailAt")) : null;
const production = params.get("runs") === "production";

/** Reference grid (160 × 64, the production default); short recording interval and horizon keep CPU runs brief. */
const FIXTURE_RUNS = {
  snapshotIntervalYears: 0.25,
  horizonYears: 2,
  modelYearsPerRealSecond: 1,
  maxBatchModelYears: 0.1,
  frameIntervalSeconds: 0.2,
};

function createTransport(): GlacialTransport {
  if (params.get("transport") === "main") return new InProcessGlacialTransport();
  const worker = new Worker(new URL("./glacial-runtime.worker.ts", import.meta.url), { type: "module" });
  worker.postMessage({ fixtureSetup: { fakeGpuFailAt } });
  return new GlacialWorkerTransport(worker);
}

const host = new GlacialHost({
  transport: createTransport(),
  ...(production ? {} : { runConfig: FIXTURE_RUNS }),
  prefer,
  ...(fault ? { diagnostics: { gpuForceFault: fault } } : {}),
});
const reader = new ReaderLifecycle({ level: "hs" });
const commands: GlacialCommand[] = [];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The one rock command. The page selector and the specimen drop both call this. */
function chooseRock(rockId: RockId) {
  return send({ kind: "choose-rock", rockId });
}
function send(command: GlacialCommand) {
  commands.push(structuredClone(command));
  $("error").textContent = "";
  return host.dispatch(command).catch((error: unknown) => {
    // Shown, not thrown: a rejected command (for example after leaving) leaves every run as it was.
    $("error").textContent = error instanceof Error ? error.message : String(error);
    return null;
  });
}

// Page selector.
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="rock"]'))
  input.addEventListener("change", () => void chooseRock(input.value as RockId));
// Specimen gesture (stand-in for the 3D block drop of 5K): drag a specimen onto the block.
for (const specimen of document.querySelectorAll<HTMLElement>(".specimen"))
  specimen.addEventListener("dragstart", (event) =>
    event.dataTransfer?.setData("text/plain", specimen.dataset.rock!),
  );
const block = $("block");
block.addEventListener("dragover", (event) => event.preventDefault());
block.addEventListener("drop", (event) => {
  event.preventDefault();
  const rock = event.dataTransfer?.getData("text/plain");
  if (rock) void chooseRock(rock as RockId);
});

$("play").addEventListener("click", () => void send({ kind: "play" }));
$("pause").addEventListener("click", () => void send({ kind: "pause" }));
$("step").addEventListener("click", () => void send({ kind: "step" }));
$<HTMLSelectElement>("speed").addEventListener(
  "change",
  (e) => void send({ kind: "set-speed", speed: Number((e.target as HTMLSelectElement).value) }),
);
const timeline = $<HTMLInputElement>("timeline");
timeline.max = String(host.plan.config.horizonYears);
timeline.step = String(host.plan.config.snapshotIntervalYears);
timeline.addEventListener("input", () => void send({ kind: "scrub", modelYears: Number(timeline.value) }));
$("live").addEventListener("click", () => void send({ kind: "return-to-live" }));
const compare = $<HTMLSelectElement>("compare");
compare.addEventListener("change", () => void send({ kind: "compare", runId: compare.value || null }));
$("reset").addEventListener("click", () => {
  void send({ kind: "reset" }).then((result) => {
    if (result?.kind === "confirm-required") {
      $("reset-confirm").hidden = false;
      $("reset-yes").focus();
    }
  });
});
$("reset-yes").addEventListener("click", () => {
  $("reset-confirm").hidden = true;
  void send({ kind: "reset", confirmed: true }).then(() => $("reset").focus());
});
$("reset-no").addEventListener("click", () => {
  $("reset-confirm").hidden = true;
  $("reset").focus();
});
$("restart-cpu").addEventListener("click", () => void send({ kind: "restart-on-cpu" }));
$("dismiss").addEventListener("click", () => void send({ kind: "dismiss-notice" }));
$<HTMLSelectElement>("level").addEventListener("change", (e) => {
  reader.present({ ...reader.presentation(), level: (e.target as HTMLSelectElement).value as Level });
  render(host.state());
});
$("leave").addEventListener("click", () => void host.pauseAndSettle().then(() => render(host.state())));
$("return").addEventListener("click", () => host.resume());

function runText(run: GlacialHostState["kept"][number]) {
  return `run ${run.ordinal} · ${run.rockId} · ${run.backend}${run.status === "active" ? "" : ` · ${run.status}`}`;
}

/** What the page shows, as data, for the tests. Arrays of hashes stand for the recorded runs. */
function snapshotOf(state: GlacialHostState) {
  const view = host.viewFrame();
  const comparison = host.comparison();
  const summary = (run: GlacialHostState["kept"][number]) => ({
    id: run.id,
    ordinal: run.ordinal,
    rockId: run.rockId,
    backend: run.backend,
    fallbackReason: run.fallbackReason,
    status: run.status,
    step: run.step,
    hashes: run.recordedHashes,
    recordedBytes: run.recordedBytes,
    clampedValues: run.clampedValues,
  });
  return {
    readiness: state.readiness,
    error: state.error,
    activity: state.activity,
    departed: state.departed,
    speed: state.speed,
    rockId: state.rockId,
    backend: state.backend,
    fallbackReason: state.fallbackReason,
    live: state.live ? summary(state.live) : null,
    kept: state.kept.map(summary),
    view: state.view,
    viewLabel: view?.label ?? null,
    viewStep: view?.step ?? null,
    compareRunId: state.compareRunId,
    comparison: comparison ? { status: comparison.status, label: comparison.label } : null,
    notice: state.notice,
    offer: state.offer,
    memoryBytes: state.memoryBytes,
    memoryBudgetBytes: state.memoryBudgetBytes,
  };
}

function render(state: GlacialHostState) {
  const level = reader.presentation().level;
  const view = host.viewFrame();
  $("view-label").textContent = view ? `${view.label} · ${runText(state.live!)}` : "loading";
  if (view) timeline.value = String(view.modelYears);
  $("play").toggleAttribute("disabled", state.activity === "playing" || state.live?.status !== "active");
  $("pause").toggleAttribute("disabled", state.activity !== "playing");
  $("live").hidden = state.view.kind === "live";
  if (state.activity !== "busy")
    for (const input of document.querySelectorAll<HTMLInputElement>('input[name="rock"]'))
      input.checked = input.value === state.rockId;
  const options = [["", "nothing"], ...state.kept.map((r) => [r.id, runText(r)])];
  if (
    compare.options.length !== options.length ||
    [...compare.options].some((o, k) => o.value !== options[k]![0])
  ) {
    compare.replaceChildren(...options.map(([value, text]) => new Option(text, value)));
  }
  compare.value = state.compareRunId ?? "";
  const comparison = host.comparison();
  $("compare-label").textContent = comparison ? comparison.label : "";
  $("kept").textContent = state.kept.length ? `Kept: ${state.kept.map(runText).join("; ")}` : "No kept runs";
  const notice = state.notice;
  $("notice").textContent = !notice
    ? ""
    : notice.kind === "evicted"
      ? `Run ${notice.ordinal} (${notice.rockId}) was dropped to make room; up to two earlier runs are kept.`
      : `Run ${notice.ordinal} stopped: ${notice.failure.message}`;
  $("dismiss").hidden = !notice;
  $("offer").hidden = !state.offer;
  // Backend and fallback reason belong to the deeper level / diagnostics.
  $("diagnostics").hidden = level !== "uni";
  $("diagnostics").textContent =
    `Backend: ${state.backend ?? "none"}${state.fallbackReason ? ` (${state.fallbackReason})` : ""}`;
  $<HTMLOutputElement>("state").value = JSON.stringify({ ...snapshotOf(state), level });
  document.body.dataset.ready = state.readiness;
}

host.subscribe(render);
driveGlacialHost(host);
(window as unknown as { glacialFixture: unknown }).glacialFixture = {
  host,
  commands,
  reader,
  snapshot: () => snapshotOf(host.state()),
};
host.initialize().catch((error: unknown) => {
  $("error").textContent = error instanceof Error ? error.message : String(error);
});
