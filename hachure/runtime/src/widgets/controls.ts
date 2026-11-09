export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}
export interface RangeSpec {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}
/** Reader clamp, including programmatic changes; NaN never reaches the model. */
export function clampRange(value: number, spec: Pick<RangeSpec, "min" | "max" | "step">): number {
  if (![spec.min, spec.max, spec.step].every(Number.isFinite) || spec.min > spec.max || spec.step <= 0)
    throw new RangeError("A slider needs an ordered finite range and positive step");
  if (!Number.isFinite(value)) throw new RangeError("A slider value must be finite");
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  const maxStep = Math.floor((spec.max - spec.min) / spec.step + Number.EPSILON * 8);
  const tick = Math.min(maxStep, Math.round((clamped - spec.min) / spec.step));
  return Number((spec.min + tick * spec.step).toPrecision(12));
}
export function createSlider(spec: RangeSpec, value: number, onChange: (value: number) => void) {
  const root = el("div", undefined, "widget-slider");
  const label = el("label", spec.label);
  label.htmlFor = spec.id;
  const input = el("input");
  input.type = "range";
  input.id = spec.id;
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step);
  const output = el("output");
  output.htmlFor = input.id;
  root.append(label, output, input);
  function update(next: number) {
    input.value = String(clampRange(next, spec));
    const text = `${input.value} ${spec.unit}`.trim();
    output.textContent = text;
    input.setAttribute("aria-valuetext", text);
  }
  input.addEventListener("input", () => {
    update(input.valueAsNumber);
    onChange(input.valueAsNumber);
  });
  update(value);
  return { root, input, update };
}
export function createToggle(
  id: string,
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
) {
  const root = el("label", undefined, "widget-toggle");
  const input = el("input");
  input.id = id;
  input.type = "checkbox";
  input.checked = checked;
  root.append(input, el("span", label));
  input.addEventListener("change", () => onChange(input.checked));
  return { root, input };
}
export function createPlayback(onPlay: () => void, onPause: () => void, onReset: () => void) {
  const root = el("div", undefined, "widget-playback");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Run controls");
  const play = button("Play", onPlay),
    pause = button("Pause", onPause),
    reset = button("Reset", onReset);
  root.append(play, pause, reset);
  function update(playing: boolean, locked: boolean) {
    play.disabled = locked;
    pause.disabled = locked;
    play.setAttribute("aria-pressed", String(playing));
    pause.setAttribute("aria-pressed", String(!playing));
  }
  update(false, true);
  return { root, play, pause, reset, update };
}
