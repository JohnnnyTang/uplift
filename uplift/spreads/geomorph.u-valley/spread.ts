/**
 * <!-- expert-review -->
 * "From V to U" as a reader spread: the lesson content plus its declared live values, validated against
 * the glacier contract. The glacial host (5J/5K/5M) serves the probe kinds in bindings.ts; the view
 * defaults (default front face, note averaging, overdeepened-note threshold) are in config.ts.
 *
 * `engine: "terrain"`: the schema has no glacier engine id yet (the handoff lists this lesson as
 * "T (+ice)"); the field is not used for dispatch. Rock choice, cut, ice view and the specimen gesture are
 * view or run commands of the glacial host, not schema controls.
 */
import {
  DEFAULT_GLACIER_CONFIG,
  GLACIER_CONFIG_LIMITS,
  ROCK_TYPES,
  type GlacierConfig,
  type RockType,
} from "@hachure/glacier";
import { START_PRESET_ID } from "@hachure/glacier/testing";
import { type EngineCatalogue, type ReaderSpread, validateReaderSpread } from "@hachure/runtime";
import { GLACIAL_PROBE_KINDS, uValleyProbes } from "./bindings";
import { pageContent } from "./content";
import { predict, title } from "./lesson";
import { sources } from "./sources";

const both = (text: string) => ({ hs: text, uni: text });

/**
 * Playback scheduling target (unit: model years per real second). Scheduling only: speed never changes the
 * fixed step or a result (plan §4). 5J may tune it to the backend.
 */
export const MODEL_YEARS_PER_REAL_SECOND = 10;

export const glacierCatalogue: EngineCatalogue = {
  params: Object.keys(GLACIER_CONFIG_LIMITS),
  tools: [],
  probeKinds: GLACIAL_PROBE_KINDS,
};

/** Fields a `glacier-config` / `glacier-rock` probe may read (checked by the tests). */
export const GLACIER_CONFIG_FIELDS = Object.keys(DEFAULT_GLACIER_CONFIG) as (keyof GlacierConfig)[];
export const ROCK_FIELDS = Object.keys(ROCK_TYPES.sandstone) as (keyof RockType)[];

export const uValleySpread: ReaderSpread = {
  schemaVersion: 0,
  id: "geomorph.u-valley",
  title,
  tags: {
    domain: ["geomorphology"],
    courses: ["physical-geography", "geomorphology"],
    levels: ["hs", "uni"],
  },
  tier: "process-model",
  engine: "terrain",
  scene: {
    preset: START_PRESET_ID,
    seed: DEFAULT_GLACIER_CONFIG.seed,
    camera: { position: [0, 1.2, 1], target: [0, 0, 0], fovDeg: 35 },
    modelScope: { kind: "live-process", time: "uncalibrated" },
    stepsPerRealSecond: MODEL_YEARS_PER_REAL_SECOND / DEFAULT_GLACIER_CONFIG.dtYears,
  },
  controls: [
    { kind: "action", id: "play", action: "play-pause", label: both("Play or pause"), levels: ["hs", "uni"] },
    { kind: "action", id: "step", action: "step", label: both("Step"), levels: ["uni"] },
    {
      kind: "speed",
      id: "speed",
      label: both("Playback speed"),
      levels: ["hs", "uni"],
      min: 0.25,
      max: 4,
      step: 0.25,
      default: 1,
    },
    { kind: "action", id: "reset", action: "reset", label: both("Start again"), levels: ["hs", "uni"] },
  ],
  probes: uValleyProbes,
  page: { ...pageContent, predict },
  teacherNotes: "teacher-notes.md",
  sources,
};

const result = validateReaderSpread(uValleySpread, glacierCatalogue);
if (!result.ok)
  throw new Error(`Invalid u-valley spread: ${result.issues.map((issue) => issue.message).join("; ")}`);
