/**
 * <!-- expert-review -->
 * The values the lesson's text may show, declared as spread probes (contract D-W7-7E). Every number the
 * illustration configures (its two display scales, the Airy proportion and densities, the snowline, the
 * block's width) and every live word of the view (boundary name, stage word, ghost names, scale-bar label)
 * reaches the page through one of these; nothing is typed. Real-world figures are not probes: they are
 * cited facts, typed only in the deeper level and teacher notes and registered in claims.ts.
 *
 * Request kinds are 7D's scene contract (D-W7-7D), adopted by 7E (D-W7-7E):
 *
 * - `plates-config`: a numeric field of `PLATES_RELIEF_CONFIG` (uplift/book/src/scenes/plates/relief/config.ts)
 *   by dotted path, the same keys as docs/science/plates/parameters.json (checked by the lesson test).
 * - `plates-scene`: the live view and derived display values: `boundaryName` (string: the lesson's
 *   `boundaries[key].name` for the shown boundary), `stageLabel` (string: `stageWords[stageWordFor(stage)]`
 *   at the reading level), `viewedNames` (string: the names of the boundaries drawn as ghosts, joined with
 *   "and"), `blockWidthKm` (number: grid columns × metres per cell / 1000) and `scaleBarLabel` (string: the
 *   scale bar's label exactly as the scene draws it; the one key 7E adds to D-W7-7D).
 *
 * No probe holds a time, a run or a measurement of the drawn landforms (D-L2-1; 7A's NT5).
 */
import type { Level, Probe } from "@hachure/runtime";

const both = (text: string) => ({ hs: text, uni: text });
const UNI: readonly Level[] = ["uni"];

const config = (id: string, label: string, field: string, unit: string, sf: number): Probe => ({
  id,
  label: both(label),
  request: { kind: "plates-config" },
  field,
  shape: "scalar",
  unit,
  significantFigures: sf,
});
const view = (id: string, label: string, field: string): Probe => ({
  id,
  label: both(label),
  request: { kind: "plates-scene" },
  field,
  shape: "scalar",
  unit: "",
  significantFigures: 1,
});

export const platesProbes: readonly Probe[] = [
  // Display scales (ARTISTIC CHOICE, parameter rows 2 and 3). Written "×{{probe.reliefScale}}".
  config(
    "reliefScale",
    "Vertical exaggeration of heights and rock layers",
    "display.surfaceVerticalExaggeration",
    "",
    2,
  ),
  config("crustScale", "Vertical scale of crust depths", "display.crustVerticalExaggeration", "", 2),
  // Cited values the drawing uses (rows 16–18, 37): university level only.
  {
    ...config("airyRatio", "Root depth per metre of height", "crust.airyRootPerMetreOfUplift", "", 2),
    levels: UNI,
  },
  { ...config("crustDensity", "Crust density", "crust.crustDensityKgPerM3", "kg/m³", 4), levels: UNI },
  { ...config("mantleDensity", "Mantle density", "crust.mantleDensityKgPerM3", "kg/m³", 4), levels: UNI },
  { ...config("snowline", "Snowline in the drawing", "dressing.snowlineM", "m", 4), levels: UNI },
  {
    id: "blockWidth",
    label: both("Width of the block"),
    request: { kind: "plates-scene" },
    field: "blockWidthKm",
    shape: "scalar",
    unit: "km",
    significantFigures: 3,
    levels: UNI,
  },
  // The live view, as words.
  view("boundaryName", "Boundary shown", "boundaryName"),
  view("stageLabel", "Stage shown", "stageLabel"),
  view("ghostNames", "Boundaries shown as ghost outlines", "viewedNames"),
  view("scaleBar", "Scale bar", "scaleBarLabel"),
];

/** Request kinds the plates host must serve; the validator checks the probes against this list. */
export const PLATES_PROBE_KINDS = ["plates-scene", "plates-config"] as const;

/** The `plates-scene` probes that carry strings; every other probe carries a number. */
export const STRING_PROBES: readonly string[] = ["boundaryName", "stageLabel", "ghostNames", "scaleBar"];
