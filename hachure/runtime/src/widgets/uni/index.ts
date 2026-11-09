import { CPU_ADMISSIBLE_RANGES, type TerrainConfig, type TunableConfig } from "@hachure/terrain";
import { formatBoundNumber } from "../../bindings/format";
import type { Level } from "../../schema/index";
import type { HostSample } from "../../sim-host/protocol";
import { button, createSlider, el } from "../controls";
import {
  changedUniversityParameters,
  formatUniversityNumber,
  universityDefaults,
  universitySample,
} from "./data";
import "./uni.css";
export { universityDefaults } from "./data";
const parameterLabels = {
  capacityCoefficient: "Capacity coefficient",
  erosionRatePerS: "Erosion relaxation rate",
  depositionRatePerS: "Deposition relaxation rate",
};
const parameterSteps = { capacityCoefficient: 0.001, erosionRatePerS: 0.01, depositionRatePerS: 0.01 };
const parameterUnits = { capacityCoefficient: "1", erosionRatePerS: "s⁻¹", depositionRatePerS: "s⁻¹" };
export interface UniversityLayerOptions {
  readonly id: string;
  readonly defaults: TerrainConfig;
  readonly configure: (patch: Partial<TunableConfig>) => Promise<unknown>;
  readonly onError: (error: unknown) => void;
}
/** View-only update; configure is called solely by explicit reader input. */
export function createUniversityLayer(options: UniversityLayerOptions) {
  const root = el("section", undefined, "university-layer");
  root.setAttribute("aria-label", "University measurements and parameters");
  root.hidden = true;
  const figure = el("figure", undefined, "university-profile");
  figure.append(el("h2", "Live long profile"));
  const chart = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chart.setAttribute("viewBox", "0 0 480 230");
  chart.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(chart.namespaceURI, "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  const axes = document.createElementNS(chart.namespaceURI, "path");
  axes.setAttribute("d", "M 12 12 V 210 H 468");
  axes.setAttribute("fill", "none");
  axes.setAttribute("stroke", "currentColor");
  chart.append(axes, line);
  const scale = el("p", undefined, "supporting-text university-profile-scale");
  const description = el("figcaption");
  figure.append(chart, scale, description);
  const budget = el("section", undefined, "university-budget");
  budget.append(el("h2", "Live sediment budget"));
  const ledger = el("dl");
  const budgetFields = [
    ["erodedM3", "Eroded · cumulative"],
    ["suspendedM3", "In transport · current stock"],
    ["depositedM3", "Deposited · cumulative"],
    ["exportedSedimentM3", "Exported · cumulative"],
    ["toolNetM3", "Reader tools · net addition"],
  ] as const;
  const outputs = budgetFields.map(([key, label]) => {
    const value = el("dd");
    value.dataset.budget = key;
    ledger.append(el("dt", label), value);
    return { key, value };
  });
  // <!-- expert-review --> docs/science/model.md, Conserved quantities; S08 and FV.
  budget.append(
    ledger,
    el(
      "p",
      "Volumes are model m³, not calibrated field predictions. Eroded and deposited are cumulative exchanges since reset: the same material can be counted again. In transport is a present stock. Do not add these as independent inventories. Reader tools add or remove material externally. (Model; FV)",
      "supporting-text",
    ),
  );
  const parameters = el("fieldset", undefined, "university-parameters");
  parameters.append(el("legend", "Live model parameters"));
  // <!-- expert-review --> docs/science/model.md section 4 and parameters.md; provisional bounds.
  parameters.append(
    el(
      "p",
      "These are parameters of the implemented capacity model, with provisional engineering bounds. They are not measured landscape constants. The capacity coefficient is dimensionless; relaxation rates use hydraulic model seconds. (Model; Parameters)",
      "supporting-text",
    ),
  );
  const sliders = Object.entries(universityDefaults(options.defaults)).map(([name, value]) => {
    const key = name as keyof typeof parameterLabels;
    const slider = createSlider(
      {
        id: `${options.id}-${key}`,
        label: parameterLabels[key],
        ...CPU_ADMISSIBLE_RANGES[key],
        step: parameterSteps[key],
        unit: parameterUnits[key] === "1" ? "dimensionless" : parameterUnits[key],
      },
      value,
      (next) => {
        void options.configure({ [key]: next }).catch(options.onError);
      },
    );
    parameters.append(slider.root);
    return { key, slider };
  });
  root.append(figure, budget, parameters);
  const hiddenNotice = el("aside", undefined, "university-hidden-parameters");
  hiddenNotice.setAttribute("aria-label", "Hidden model parameters");
  hiddenNotice.hidden = true;
  const noticeText = el("p");
  const restore = button("Reset hidden parameters to defaults", () => {
    restore.disabled = true;
    void options
      .configure(universityDefaults(options.defaults))
      .catch(options.onError)
      .finally(() => {
        restore.disabled = false;
      });
  });
  hiddenNotice.append(noticeText, restore);
  // <!-- expert-review --> docs/science/model.md section 4; W99 comparative theory, not the solver.
  const theory = el(
    "p",
    "Comparative theory: E is incision rate (length per time), A is drainage area (area), S is channel slope (dimensionless), and m and n are empirical exponents. K has units determined by those exponents and the chosen units of E and A. This relation is not the implemented capacity law. The live erosion relaxation rate is not K; no dimensional mapping or field calibration is approved. (W99; Model)",
    "supporting-text university-theory",
  );
  function update(sample: HostSample | undefined, level: Level, enabled: boolean) {
    root.hidden = level !== "uni";
    parameters.disabled = !enabled;
    restore.disabled = !enabled;
    hiddenNotice.hidden = true;
    if (!sample) return;
    const changed = changedUniversityParameters(sample.config, options.defaults);
    hiddenNotice.hidden = level !== "hs" || changed.length === 0;
    noticeText.textContent = `Parameters changed — the live landscape keeps the hidden university settings: ${changed.map((key) => `${parameterLabels[key]} ${formatBoundNumber(sample.config[key], parameterUnits[key])} (default ${formatBoundNumber(options.defaults[key], parameterUnits[key])})`).join("; ")}. Resetting these parameters keeps the landscape and model step.`;
    for (const { key, slider } of sliders) {
      slider.update(sample.config[key]);
      // The configured value may lie between reader slider ticks after an external configure.
      const unit = parameterUnits[key] === "1" ? "dimensionless" : parameterUnits[key];
      const text = formatBoundNumber(sample.config[key], unit);
      slider.root.querySelector("output")!.textContent = text;
      slider.input.setAttribute("aria-valuetext", text);
    }
    if (level !== "uni") return;
    root.dataset.step = String(sample.snapshot.step);
    const data = universitySample(sample);
    for (const { key, value } of outputs) {
      value.textContent = formatUniversityNumber(data.budget[key], "model m³");
      value.dataset.value = String(data.budget[key]);
    }
    const profile = data.profile;
    chart.style.display = profile ? "block" : "none";
    if (!profile) {
      line.removeAttribute("points");
      scale.textContent = "";
      description.textContent =
        "The starting route is shorter than a grid cell; no long profile is available.";
      return;
    }
    const distances = profile.distanceM,
      elevations = profile.groundM;
    let min = Infinity,
      max = -Infinity;
    for (const value of elevations) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    const length = distances.at(-1)!;
    const span = max - min;
    line.setAttribute(
      "points",
      Array.from(
        elevations,
        (value, i) =>
          `${12 + (distances[i]! / length) * 456},${span === 0 ? 111 : 210 - ((value - min) / span) * 198}`,
      ).join(" "),
    );
    scale.textContent = `Distance along fixed starting route: ${formatBoundNumber(distances[0]!, "m")}–${formatBoundNumber(length, "m")}. Ground elevation above model datum: ${formatBoundNumber(min, "m")}–${formatBoundNumber(max, "m")}. Axes rescale to the current profile; vertical and horizontal scales differ.`;
    description.textContent = `Ink line: current ground on the fixed starting route. Upstream elevation ${formatBoundNumber(elevations[0]!, "m")}; downstream sampled elevation ${formatBoundNumber(elevations.at(-1)!, "m")}. ${data.route.complete ? "The starting route reaches the outlet; cell-spaced sampling can omit a shorter terminal segment." : `The starting route is incomplete (stopped at ${data.route.stoppedAt}); this is a partial reach, not a full river profile.`} The route is geometric, not a measured watercourse. (Model; Validation)`;
  }
  return { root, hiddenNotice, theory, update };
}
