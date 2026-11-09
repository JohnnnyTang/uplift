import {
  type BrushKind,
  type BrushOp,
  type PointM,
  type TerrainConfig,
  type ToolResult,
  BRUSH_KINDS,
  brushRadiusRangeM,
} from "@hachure/terrain";

export interface BrushCursorState {
  readonly at: PointM;
  readonly radiusM: number;
  readonly kind: BrushKind;
  /** Metres for raise/dig, fraction for smooth, dimensionless hardness for harden. */
  readonly amount: number;
  readonly enabled: boolean;
  readonly busy: boolean;
}
export interface ToolPaletteOptions {
  /** Unique DOM id prefix when more than one palette is mounted. */
  readonly id: string;
  readonly config: TerrainConfig;
  readonly applyTool: (op: BrushOp) => ToolResult | Promise<ToolResult>;
  readonly onCursorChange?: (state: BrushCursorState) => void;
}
export interface BrushAmountRange {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly label: string;
}
export function brushAmountRange(config: TerrainConfig, kind: BrushKind): BrushAmountRange {
  switch (kind) {
    case "raise":
      return { min: 0, max: config.brushMaxHeightM, unit: "m", label: "Raise height" };
    case "dig":
      return { min: 0, max: config.brushMaxDepthM, unit: "m", label: "Dig depth" };
    case "smooth":
      return { min: 0, max: 1, unit: "fraction", label: "Smoothing strength" };
    case "harden":
      return {
        min: config.hardnessRange[0],
        max: config.hardnessRange[1],
        unit: "hardness",
        label: "Rock hardness",
      };
  }
}
const finiteClamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) throw new RangeError("Brush values must be finite");
  return Math.max(min, Math.min(max, value));
};
const display = (value: number) => Number(value.toFixed(3)).toString();
const labels: Record<BrushKind, string> = { raise: "Raise", dig: "Dig", smooth: "Smooth", harden: "Harden" };

/** DOM palette backed only by the public terrain tool contract; it never owns or resets the solver. */
export function createToolPalette(options: ToolPaletteOptions) {
  let config = options.config;
  let kind: BrushKind = "raise";
  let radiusM = brushRadiusRangeM(config, config).minM;
  let amount = Math.min(1, config.brushMaxHeightM);
  let at: PointM = {
    xM: (Math.floor(config.gridSize / 2) + 0.5) * config.metresPerCell,
    yM: (Math.floor(config.gridSize / 2) + 0.5) * config.metresPerCell,
  };
  let enabled = true;
  let busy = false;
  let disposed = false;
  const root = document.createElement("fieldset");
  root.className = "tool-palette";
  root.style.display = "grid";
  root.style.gap = "0.5rem";
  const legend = document.createElement("legend");
  legend.textContent = "Shape the terrain";
  const toolLabel = document.createElement("label");
  toolLabel.textContent = "Tool";
  const select = document.createElement("select");
  select.id = `${options.id}-tool`;
  toolLabel.htmlFor = select.id;
  for (const value of BRUSH_KINDS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value];
    select.append(option);
  }
  function numberInput(suffix: string, text: string) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const output = document.createElement("output");
    input.id = `${options.id}-${suffix}`;
    input.type = "number";
    input.step = "any";
    label.htmlFor = input.id;
    label.textContent = text;
    output.htmlFor = input.id;
    output.setAttribute("aria-live", "off");
    return { label, input, output };
  }
  const radius = numberInput("radius", "Brush radius (m)");
  const strength = numberInput("amount", "Raise height (m)");
  const help = document.createElement("p");
  help.id = `${options.id}-help`;
  help.textContent =
    "Focus the terrain cursor. Arrow keys move it; Enter or Space applies the tool. Repeated edits can create unrealistic terrain.";
  const cursor = document.createElement("button");
  cursor.type = "button";
  cursor.textContent = "Terrain brush cursor";
  cursor.setAttribute("aria-describedby", help.id);
  cursor.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space");
  const status = document.createElement("p");
  status.id = `${options.id}-status`;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  root.append(
    legend,
    toolLabel,
    select,
    radius.label,
    radius.input,
    radius.output,
    strength.label,
    strength.input,
    strength.output,
    help,
    cursor,
    status,
  );
  const state = (): BrushCursorState => ({
    at: { ...at },
    radiusM,
    kind,
    amount,
    enabled: enabled && !root.disabled && !disposed,
    busy,
  });
  const position = () => `Cursor east ${display(at.xM)} m, south ${display(at.yM)} m.`;
  function render() {
    const range = brushRadiusRangeM(config, config);
    root.disabled = !enabled || range.maxM < range.minM || disposed;
    cursor.setAttribute("aria-disabled", String(busy));
    root.setAttribute("aria-busy", String(busy));
    select.value = kind;
    radius.input.min = String(range.minM);
    radius.input.max = String(Math.max(range.minM, range.maxM));
    radius.input.value = String(radiusM);
    radius.output.textContent = `${display(radiusM)} m`;
    const a = brushAmountRange(config, kind);
    strength.label.textContent = `${a.label} (${a.unit})`;
    strength.input.min = String(a.min);
    strength.input.max = String(a.max);
    strength.input.value = String(amount);
    strength.output.textContent = `${display(amount)} ${a.unit}`;
    cursor.setAttribute("aria-label", `Terrain brush cursor. ${position()} ${labels[kind]}.`);
    options.onCursorChange?.(state());
  }
  function setPosition(next: PointM) {
    const lo = config.metresPerCell / 2,
      hi = (config.gridSize - 0.5) * config.metresPerCell;
    at = { xM: finiteClamp(next.xM, lo, hi), yM: finiteClamp(next.yM, lo, hi) };
    status.textContent = `${position()}${at.xM !== next.xM || at.yM !== next.yM ? " Terrain edge reached." : ""}`;
    render();
  }
  function setRadius(next: number) {
    const range = brushRadiusRangeM(config, config);
    radiusM = finiteClamp(next, range.minM, Math.max(range.minM, range.maxM));
    status.textContent = `Brush radius ${display(radiusM)} m.${radiusM !== next ? " Brush radius limit reached." : ""}`;
    render();
  }
  function setAmount(next: number) {
    const range = brushAmountRange(config, kind);
    amount = finiteClamp(next, range.min, range.max);
    status.textContent = `${range.label} ${display(amount)} ${range.unit}.${amount !== next ? " Brush strength limit reached." : ""}`;
    render();
  }
  function setKind(next: BrushKind) {
    if (!(BRUSH_KINDS as readonly string[]).includes(next)) throw new RangeError("Unknown brush");
    kind = next;
    const range = brushAmountRange(config, kind);
    amount = finiteClamp(amount, range.min, range.max);
    status.textContent = `${labels[kind]} selected. ${position()}`;
    render();
  }
  async function apply() {
    if (root.disabled || busy || disposed) return;
    const base = { at: { ...at }, radiusM };
    let op: BrushOp;
    switch (kind) {
      case "raise":
        op = { ...base, kind, heightM: amount };
        break;
      case "dig":
        op = { ...base, kind, depthM: amount };
        break;
      case "smooth":
        op = { ...base, kind, strength: amount };
        break;
      case "harden":
        op = { ...base, kind, hardness: amount };
        break;
    }
    busy = true;
    status.textContent = `Applying ${labels[op.kind].toLowerCase()}…`;
    render();
    try {
      const result = await options.applyTool(op);
      if (disposed) return;
      const limits = result.clamped.length ? ` Limit reached: ${result.clamped.join(", ")}.` : "";
      status.textContent = `${labels[op.kind]} ${result.applied ? "applied" : "made no change"} at east ${display(op.at.xM)} m, south ${display(op.at.yM)} m. Net material change ${display(result.volumeChangeM3)} m³.${limits}`;
    } catch {
      if (!disposed)
        status.textContent = "The tool could not be applied. Try again when the terrain is ready.";
    } finally {
      busy = false;
      if (!disposed) render();
    }
  }
  const abort = new AbortController();
  const signal = abort.signal;
  select.addEventListener("change", () => setKind(select.value as BrushKind), { signal });
  function edit(input: HTMLInputElement, update: (value: number) => void) {
    input.addEventListener(
      "change",
      () => {
        try {
          update(input.valueAsNumber);
        } catch {
          status.textContent = "Enter a finite brush value.";
          render();
        }
      },
      { signal },
    );
  }
  edit(radius.input, setRadius);
  edit(strength.input, setAmount);
  cursor.addEventListener(
    "keydown",
    (event) => {
      if (root.disabled || busy || disposed) return;
      const shifts: Record<string, readonly [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const shift = shifts[event.key];
      if (shift) {
        event.preventDefault();
        setPosition({
          xM: at.xM + shift[0] * config.metresPerCell,
          yM: at.yM + shift[1] * config.metresPerCell,
        });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) void apply();
      }
    },
    { signal },
  );
  cursor.addEventListener(
    "click",
    () => {
      void apply();
    },
    { signal },
  );
  status.textContent = position();
  render();
  return {
    root,
    cursor,
    status,
    state,
    setPosition,
    setRadius,
    setAmount,
    setKind,
    apply,
    setEnabled(next: boolean) {
      enabled = next;
      render();
    },
    refreshConfig(next: TerrainConfig) {
      config = next;
      const range = brushRadiusRangeM(config, config);
      radiusM = finiteClamp(radiusM, range.minM, Math.max(range.minM, range.maxM));
      const a = brushAmountRange(config, kind);
      amount = finiteClamp(amount, a.min, a.max);
      setPosition(at);
    },
    dispose() {
      disposed = true;
      abort.abort();
      root.remove();
    },
  };
}
