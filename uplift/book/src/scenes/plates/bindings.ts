/**
 * The values lesson 2's page may bind (D-W7-7D, "Bindings served"). Every number comes from the relief
 * config the block is drawn from, and every word from the copy and the sequence state, so page and scene
 * agree; nothing here is a measurement of the drawing.
 *
 * - `plates-scene` probes, by `field`: `boundaryName`, `stageLabel`, `viewedNames` (strings),
 *   `surfaceVerticalExaggeration`, `crustVerticalExaggeration`, `blockWidthKm`, `blockLengthKm` (numbers),
 *   `scaleBarLabel` (string, the scale bar's label as drawn, D-W7-7E).
 * - `plates-config` probes: any numeric leaf of the relief config, by dotted path (`crust.normalThicknessM`).
 */
import type { BoundValue, Probe } from "@hachure/runtime";
import type { LevelText, PlatesSceneCopy } from "./copy";
import { type PlateBoundary, type PlatesReliefConfig, platesSceneScales } from "./relief/index";
import { stageWord } from "./words";

/** Probe request kinds the plates scene serves (the spread's validator checks its probes against them). */
export const PLATES_PROBE_KINDS = ["plates-scene", "plates-config"] as const;

/** Fields of the `plates-scene` probe kind. */
export const PLATES_SCENE_FIELDS = [
  "boundaryName",
  "stageLabel",
  "viewedNames",
  "surfaceVerticalExaggeration",
  "crustVerticalExaggeration",
  "blockWidthKm",
  "blockLengthKm",
  "scaleBarLabel",
] as const;

/**
 * The scale bar drawn along the front edge of the block (and of Fig. 2): a round length near a quarter of
 * the block's width (unit: km), from the config's grid. A scale, not a measurement of a landform.
 */
export function scaleBarKm(config: PlatesReliefConfig): number {
  const widthKm = ((config.grid.columns - 1) * config.grid.metresPerCell) / 1000;
  const nice = [1, 2, 5, 10, 20, 25, 40, 50, 100, 200, 250, 500];
  return nice.filter((v) => v <= widthKm * 0.3).at(-1) ?? nice[0]!;
}

/** A numeric leaf of the config by dotted path, or undefined. */
export function configValue(config: PlatesReliefConfig, path: string): number | undefined {
  let node: unknown = config;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "number" && Number.isFinite(node) ? node : undefined;
}

export interface PlatesBindingState {
  readonly boundary: PlateBoundary | null;
  readonly stage: number;
  /** Boundaries drawn as ghosts, in drawing order. */
  readonly ghosts: readonly PlateBoundary[];
}

/** Joins names as "a", "a and b", "a, b and c". */
function listWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
}

/** The `plates-scene` values for one state, at one level. */
export function platesSceneValues(
  config: PlatesReliefConfig,
  copy: PlatesSceneCopy,
  level: "hs" | "uni",
  s: PlatesBindingState,
): Record<(typeof PLATES_SCENE_FIELDS)[number], BoundValue> {
  const t = (x: LevelText) => x[level];
  const scales = platesSceneScales(config);
  const { columns, rows, metresPerCell } = config.grid;
  return {
    boundaryName: s.boundary ? t(copy.boundaries[s.boundary].name) : t(copy.controls.noBoundary),
    stageLabel: t(copy.controls[stageWord(s.stage)]),
    viewedNames: listWords(s.ghosts.map((g) => t(copy.boundaries[g].name).toLowerCase())),
    surfaceVerticalExaggeration: scales.reliefScale,
    crustVerticalExaggeration: config.display.crustVerticalExaggeration,
    blockWidthKm: ((columns - 1) * metresPerCell) / 1000,
    blockLengthKm: ((rows - 1) * metresPerCell) / 1000,
    scaleBarLabel: `${scaleBarKm(config)} km`,
  };
}

/**
 * Probe values for the binding engine: every declared probe of a served kind that has a value. Probes of
 * other kinds are left alone (another producer may serve them).
 */
export function platesProbeValues(
  probes: readonly Probe[],
  config: PlatesReliefConfig,
  copy: PlatesSceneCopy,
  level: "hs" | "uni",
  s: PlatesBindingState,
): Record<string, BoundValue> {
  const scene: Record<string, BoundValue> = platesSceneValues(config, copy, level, s);
  const out: Record<string, BoundValue> = {};
  for (const p of probes) {
    if (p.shape !== "scalar") continue;
    const v =
      p.request.kind === "plates-scene"
        ? scene[p.field ?? ""]
        : p.request.kind === "plates-config"
          ? configValue(config, p.field ?? "")
          : undefined;
    if (v !== undefined) out[p.id] = v;
  }
  return out;
}

const both = (text: string): LevelText => ({ hs: text, uni: text });
const sceneProbe = (field: (typeof PLATES_SCENE_FIELDS)[number], unit: string, label: string): Probe => ({
  id: field,
  label: both(label),
  request: { kind: "plates-scene" },
  field,
  shape: "scalar",
  unit,
  significantFigures: 3,
});

/**
 * Default probes, used when the book passes none (the placeholder copy binds these ids). 7E's spread
 * declares its own; ids equal to the field names keep the placeholder working with either.
 */
export const PLATES_DEFAULT_PROBES: readonly Probe[] = Object.freeze([
  sceneProbe("boundaryName", "", "Boundary shown"),
  sceneProbe("stageLabel", "", "Stage of formation"),
  sceneProbe("viewedNames", "", "Boundaries already viewed"),
  sceneProbe("surfaceVerticalExaggeration", "", "Vertical exaggeration of heights and rock layers"),
  sceneProbe("crustVerticalExaggeration", "", "Vertical scale of crust depths"),
  sceneProbe("blockWidthKm", "km", "Width of the block"),
  sceneProbe("blockLengthKm", "km", "Length of the block"),
  sceneProbe("scaleBarLabel", "", "Scale bar"),
]);
