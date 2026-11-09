import type { Level, PredictSpec } from "../schema/spread";
import { button, el } from "./controls";
/** Scoring belongs to the runtime: this widget records a committed choice only. */
export function createPredict(
  id: string,
  spec: PredictSpec,
  level: Level,
  onCommit: (index: number) => void,
) {
  if (spec.options.length < 2 || spec.options.length > 4)
    throw new RangeError("Predict needs two to four options");
  const root = el("fieldset", undefined, "widget-predict");
  const legend = el("legend", spec.question[level]);
  const status = el("p", "Choose an answer, then commit to unlock the test.", "widget-status");
  status.setAttribute("role", "status");
  const choices = spec.options.map((option, index) => {
    const label = el("label"),
      input = el("input"),
      text = el("span", option[level]);
    input.type = "radio";
    input.name = id;
    input.value = String(index);
    label.append(input, text);
    return { label, input, text };
  });
  let committed: number | undefined;
  const commit = button("Commit prediction", () => {
    const index = choices.findIndex(({ input }) => input.checked);
    if (index < 0 || committed !== undefined) return;
    committed = index;
    choices.forEach(({ input }) => (input.disabled = true));
    commit.disabled = true;
    update(level);
    onCommit(index);
  });
  commit.disabled = true;
  choices.forEach(({ input }) => input.addEventListener("change", () => (commit.disabled = false)));
  root.append(legend, ...choices.map(({ label }) => label), commit, status);
  function update(next: Level) {
    level = next;
    legend.textContent = spec.question[level];
    choices.forEach(({ text }, index) => (text.textContent = spec.options[index]![level]));
    if (committed !== undefined)
      status.textContent = `You predicted: ${spec.options[committed]![level]}. The test is unlocked.`;
  }
  function reset() {
    committed = undefined;
    choices.forEach(({ input }) => {
      input.checked = false;
      input.disabled = false;
    });
    commit.disabled = true;
    status.textContent = "Choose an answer, then commit to unlock the test.";
  }
  return {
    root,
    update,
    reset,
    get committed() {
      return committed;
    },
  };
}
export function createFlap(id: string, text: string) {
  const root = el("section", undefined, "widget-flap"),
    panel = el("div", text);
  panel.id = id;
  panel.hidden = true;
  const reveal = button("Reveal explanation", () => {
    panel.hidden = !panel.hidden;
    reveal.setAttribute("aria-expanded", String(!panel.hidden));
    reveal.textContent = panel.hidden ? "Reveal explanation" : "Close explanation";
  });
  reveal.setAttribute("aria-controls", id);
  reveal.setAttribute("aria-expanded", "false");
  reveal.disabled = true;
  root.append(reveal, panel);
  return {
    root,
    reveal,
    panel,
    reset() {
      panel.hidden = true;
      reveal.disabled = true;
      reveal.textContent = "Reveal explanation";
      reveal.setAttribute("aria-expanded", "false");
    },
  };
}
