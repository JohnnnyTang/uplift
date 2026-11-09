/** <!-- expert-review --> Composes the draft content with public engine primitives; sources remain attached. */
import { DEFAULT_TERRAIN_CONFIG, CPU_ADMISSIBLE_RANGES, TILTED_PLATEAU_ID } from "@hachure/terrain";
import { type Spread, createTerrainHostCatalogue, validateSpread } from "@hachure/runtime";
import { pageContent } from "./content";
import { predictDraft } from "./predict";
import { sources } from "./sources";
const both = (text: string) => ({ hs: text, uni: text });

export const valleySpread: Spread = {
  schemaVersion: 0,
  id: "geomorph.v-valley",
  title: both("More rain, more material moved?"),
  tags: {
    domain: ["geomorphology"],
    courses: ["physical-geography", "geomorphology", "hydrology"],
    levels: ["hs", "uni"],
  },
  tier: "process-model",
  engine: "terrain",
  scene: {
    preset: TILTED_PLATEAU_ID,
    seed: DEFAULT_TERRAIN_CONFIG.seed,
    camera: { position: [0, 1.2, 1], target: [0, 0, 0], fovDeg: 45 },
    stepsPerRealSecond: 30,
  },
  controls: [
    {
      kind: "slider",
      id: "rain",
      param: "rainMmPerHr",
      label: both("Rain input"),
      levels: ["hs", "uni"],
      min: CPU_ADMISSIBLE_RANGES.rainMmPerHr.min,
      max: CPU_ADMISSIBLE_RANGES.rainMmPerHr.max,
      step: 1,
      default: DEFAULT_TERRAIN_CONFIG.rainMmPerHr,
      unit: "mm/h",
    },
    {
      kind: "speed",
      id: "speed",
      label: both("Playback speed"),
      levels: ["hs", "uni"],
      min: 0.25,
      max: 4,
      default: 1,
      step: 0.25,
    },
    { kind: "action", id: "play", action: "play-pause", label: both("Play or pause"), levels: ["hs", "uni"] },
    { kind: "action", id: "reset", action: "reset", label: both("Reset experiment"), levels: ["hs", "uni"] },
  ],
  probes: [
    {
      id: "incisionDepth",
      label: both("Incision since reset"),
      request: { kind: "fixed-section-incision", baseline: "reset" },
      field: "medianIncisionM",
      shape: "scalar",
      unit: "m",
      significantFigures: 3,
    },
    {
      id: "sedimentOut",
      label: both("Sediment exported"),
      request: { kind: "budget" },
      field: "exportedSedimentM3",
      shape: "scalar",
      unit: "m³",
      significantFigures: 3,
    },
  ],
  page: { ...pageContent, predict: predictDraft },
  challenge: {
    prompt: both("Investigate the landscape; the persistent slope-break challenge awaits validation."),
    check: {
      kind: "pending",
      reason: "The slope-break test and landscape clock still need scientific validation.",
    },
    stamp: { id: "waterfall", label: both("Persistent slope break") },
  },
  teacherNotes: "teacher-notes.md",
  sources,
};
const result = validateSpread(valleySpread, createTerrainHostCatalogue());
if (!result.ok)
  throw new Error(`Invalid valley spread: ${result.issues.map((issue) => issue.message).join("; ")}`);
