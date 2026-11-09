import type { Level, PredictSpec } from "../schema/spread";
import { button, el } from "./controls";
/** Scoring belongs to the runtime: this widget records a committed choice only. */
export function createPredict(
  id: string,
  definition: PredictSpec | undefined,
  level: Level,
  onCommit: (index: number) => void,
) {
  if (!definition) {
    const root = el("fieldset", undefined, "widget-predict");
    root.hidden = true;
    return {
      root,
      update(_level: Level) {},
      reset() {},
      get committed(): number | undefined {
        return undefined;
      },
    };
  }
  const spec = definition;
  if (spec.options.length < 2 || spec.options.length > 4)
    throw new RangeError("Predict needs two to four options");
  const root = el("fieldset", undefined, "widget-predict");
  const legend = el("legend", spec.question[level]);
  const unscored =
    spec.answer === null
      ? " No option is marked correct; matched model validation is pending or inconclusive."
      : "";
  const status = el(
    "p",
    "Optional: make a prediction, or explore and reveal the explanation." + unscored,
    "widget-status",
  );
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
    status.tabIndex = -1;
    status.focus();
  });
  commit.disabled = true;
  choices.forEach(({ input }) => input.addEventListener("change", () => (commit.disabled = false)));
  root.append(legend, ...choices.map(({ label }) => label), commit, status);
  function update(next: Level) {
    level = next;
    legend.textContent = spec.question[level];
    choices.forEach(({ text }, index) => (text.textContent = spec.options[index]![level]));
    if (committed !== undefined)
      status.textContent = `You predicted: ${spec.options[committed]![level]}. You can keep exploring.${unscored}`;
  }
  function reset() {
    committed = undefined;
    choices.forEach(({ input }) => {
      input.checked = false;
      input.disabled = false;
    });
    commit.disabled = true;
    status.textContent = "Optional: make a prediction, or explore and reveal the explanation." + unscored;
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
  reveal.disabled = false;
  root.append(reveal, panel);
  return {
    root,
    reveal,
    panel,
    reset() {
      if (panel.contains(document.activeElement)) reveal.focus();
      panel.hidden = true;
      reveal.disabled = false;
      reveal.textContent = "Reveal explanation";
      reveal.setAttribute("aria-expanded", "false");
    },
  };
}
