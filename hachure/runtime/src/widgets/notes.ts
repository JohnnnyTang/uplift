import type { KeyWord, Level, Tier } from "../schema/spread";
import { el } from "./controls";
export const BOOK_PALETTE = Object.freeze({
  paper: "#faf8f2",
  ink: "#242b2a",
  secondary: "#505852",
  desk: "#555c56",
  rule: "#c9c9bc",
  water: "#0072b2",
  sediment: "#9c6500",
});
const TIERS: Record<Tier, string> = {
  "physical-law": "Physical law",
  "process-model": "Process model",
  "stylised-theory": "Stylised theory",
  "agent-stochastic": "Agent / stochastic",
};
export function createTierBadge(tier: Tier) {
  return el("span", `Model tier: ${TIERS[tier]}`, "widget-tier");
}
/** Caller supplies a resolved binding including calibration status and units. */
export function createTimeScale(label: string) {
  const root = el("p", label, "widget-time");
  return {
    root,
    update(text: string) {
      root.textContent = text;
    },
  };
}
/** fraction is bar length / visible terrain width, using the same live spatial config. */
export function createScaleBar(label: string, fraction: number) {
  const root = el("div", undefined, "widget-scale"),
    bar = el("span", undefined, "widget-scale-line"),
    text = el("span");
  bar.setAttribute("aria-hidden", "true");
  root.append(bar, text);
  function update(label: string, fraction: number) {
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1)
      throw new RangeError("Scale fraction must be in (0, 1]");
    bar.style.width = `${fraction * 100}%`;
    text.textContent = label;
  }
  update(label, fraction);
  return { root, update };
}
export function createIgnores(items: readonly string[]) {
  const root = el("details", undefined, "widget-ignores"),
    list = el("ul");
  root.append(el("summary", "What this model ignores"), list);
  function update(items: readonly string[]) {
    list.replaceChildren(...items.map((text) => el("li", text)));
  }
  update(items);
  return { root, update };
}
export function createKeyWords(words: readonly KeyWord[], level: Level) {
  const root = el("section", undefined, "widget-keywords"),
    list = el("dl");
  root.append(el("h2", "Key words"), list);
  function update(level: Level) {
    list.replaceChildren(
      ...words.flatMap((word) => [el("dt", word.term[level]), el("dd", word.definition[level])]),
    );
  }
  update(level);
  return { root, update };
}
export function createColourLegend(inkLabel = "Ink lines: surface") {
  const root = el("ul", undefined, "widget-legend");
  root.setAttribute("aria-label", "Colour and line legend");
  for (const [kind, text] of [
    ["ink", inkLabel],
    ["water", "Blue, solid: water"],
    ["sediment", "Ochre, dashed: sediment"],
  ]) {
    const item = el("li"),
      swatch = el("span", undefined, `legend-swatch legend-${kind}`);
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, el("span", text));
    root.append(item);
  }
  return root;
}
