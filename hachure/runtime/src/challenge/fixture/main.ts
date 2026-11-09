import { createChallengeWidget } from "../widget";
import { ChallengeProgress } from "../progress";
import type { ChallengeSpec, Level } from "../../schema/spread";
const params = new URLSearchParams(location.search);
const both = (text: string) => ({ hs: text, uni: text });
const check = {
  kind: "probe-threshold" as const,
  probe: "value",
  threshold: 2,
  comparator: ">=" as const,
  sustainSimYears: 0,
};
const spec: ChallengeSpec = {
  prompt: both("Test the supplied fixture observation."),
  check: params.has("pending")
    ? {
        kind: "any",
        checks: [check, { kind: "pending", reason: "Scientific evidence remains unavailable." }],
      }
    : check,
  stamp: { id: "fixture", label: both("Software fixture completed") },
};
const storage = params.has("blocked-storage")
  ? {
      getItem() {
        throw new Error("fixture-denied");
      },
      setItem() {
        throw new Error("fixture-quota");
      },
    }
  : localStorage;
const widget = createChallengeWidget({
  spreadId: "test.fixture",
  definitionId: "software-fixture-v1",
  spec,
  predictionOptions: [both("Fixture option alpha"), both("Fixture option beta")],
  observationIntervalSteps: 1,
  progress: new ChallengeProgress(storage),
});
document.querySelector("#fixture")!.append(widget.root);
let prediction: number | null = null,
  explained = false,
  step = 0,
  generation = 0,
  observedValue = 0;
const level = document.querySelector<HTMLSelectElement>("#fixture-level")!;
function update(value = observedValue) {
  observedValue = value;
  widget.update(
    { runId: `fixture-${generation}`, step, simYears: 0, probes: { value } },
    { level: level.value as Level, prediction, explained },
  );
}
document.querySelector("#commit")!.addEventListener("click", () => {
  prediction = 1;
  update();
});
document.querySelector("#explain")!.addEventListener("click", () => {
  explained = true;
  update();
});
document.querySelector("#observe")!.addEventListener("click", () => {
  step++;
  update(3);
});
document.querySelector("#reset")!.addEventListener("click", () => {
  step = 0;
  generation++;
  observedValue = 0;
  prediction = null;
  explained = false;
  widget.reset();
  update();
});
level.addEventListener("change", () => update());
update();
