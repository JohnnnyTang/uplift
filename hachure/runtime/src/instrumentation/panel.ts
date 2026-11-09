import { button, el } from "../widgets/controls";
import type { LearningLog } from "./log";

export type LearningDownload = (json: string) => void;
export function downloadLearningJson(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = el("a");
  try {
    link.href = url;
    link.download = "uplift-anonymous-events.json";
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
export function tryLearningExport(log: LearningLog, download: LearningDownload): boolean {
  try {
    download(log.exportJson());
    return true;
  } catch {
    return false;
  }
}

/**
 * <!-- expert-review --> Optional checks repeat the supported gross-erosion question.
 * Source: docs/science/validation/rain-comparison/README.md (all matched recorded seeds).
 * They do not measure learning gains. Controls never call a simulation API.
 */
export function createLearningPanel(log: LearningLog, download: LearningDownload = downloadLearningJson) {
  const root = el("details", undefined, "learning-log");
  root.append(el("summary", "Optional anonymous classroom log"));
  root.append(
    el(
      "p",
      "Off by default. Starting records only lesson choices, model settings and model steps in this page's memory. No names, free text, accounts, device IDs, clock times or network sharing. You choose whether to download the JSON file. Reloading discards it. Stop pauses collection. Clear erases retained entries and check answers while keeping collection on or off. Completing the lesson does not prove learning gains.",
    ),
  );
  const status = el("p");
  status.setAttribute("role", "status");
  const start = button("Start local collection", () => {
    log.start();
  });
  const stop = button("Stop local collection", () => {
    log.stop();
  });
  const clear = button("Clear local log", () => {
    log.clear();
  });
  const exportButton = button("Export anonymous JSON", () => {
    status.textContent = tryLearningExport(log, download)
      ? "Anonymous JSON download requested. You decide whether to share it."
      : "Download unavailable. Your local log is retained; the lesson still works.";
  });
  root.append(start, stop, clear, exportButton, status);
  const checks: HTMLFieldSetElement[] = [];
  const inputs: HTMLInputElement[] = [];
  for (const phase of ["pre", "post"] as const) {
    const field = el("fieldset");
    field.append(el("legend", `Optional ${phase === "pre" ? "before" : "after"} check`));
    field.append(
      el("p", "For the recorded matched runs, which rainfall lifts more material from the surface?"),
    );
    for (const [index, text] of ["Lighter rain", "Heavier rain", "The same amount"].entries()) {
      const label = el("label"),
        input = el("input");
      input.type = "radio";
      input.name = `learning-${phase}`;
      input.value = String(index);
      input.addEventListener("change", () => {
        const recorded = log.record({ kind: "learning-check", phase, answer: index as 0 | 1 | 2 });
        if (recorded)
          status.textContent = "Check saved locally. This answer is not a measured learning gain.";
      });
      label.append(input, text);
      field.append(label);
      inputs.push(input);
    }
    root.append(field);
    checks.push(field);
  }
  let wasEmpty = true;
  function update() {
    start.disabled = log.enabled;
    stop.disabled = !log.enabled;
    clear.disabled = log.size === 0;
    exportButton.disabled = log.size === 0;
    for (const field of checks) field.disabled = !log.enabled;
    if (log.size === 0 && !wasEmpty) for (const input of inputs) input.checked = false;
    wasEmpty = log.size === 0;
    status.textContent = `${log.enabled ? "Collecting locally" : "Collection off"}. ${log.size} of ${log.capacity} events retained; ${log.droppedEvents} older events omitted.`;
    root.dataset.collecting = String(log.enabled);
    root.dataset.events = String(log.size);
  }
  const unsubscribe = log.subscribe(update);
  update();
  return { root, dispose: unsubscribe };
}
