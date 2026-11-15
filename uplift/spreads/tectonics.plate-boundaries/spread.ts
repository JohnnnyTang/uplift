/**
 * <!-- expert-review -->
 * "Where plates meet" as a reader spread: the lesson content plus its declared bound values, validated at
 * import. ILLUSTRATION: the boundary shapes are authored, not simulated (owner exception D-L2-1, this lesson
 * only); the scene (7D) draws 7C's authored sequences and serves the probe kinds in bindings.ts.
 *
 * - `modelScope: static-geometry`: there is no clock, no run and no model time; the validator then rejects
 *   any time binding and any play or speed control. Boundary choice, play, pause, the stage scrubber, the
 *   cut, the camera and ghosts are commands of the authored-sequence source (7B), not schema controls, as
 *   lesson 1's rock choice is a command of its host.
 * - `engine: "scene"`: a special-purpose scene; no engine parameter can be set.
 * - `tier: "stylised-theory"`: placeholder only. The schema has no "illustration" tier (raised in D-W7-7E);
 *   the shell shows `figure.label` ("Illustration: shapes drawn from real examples") as this spread's tier
 *   label, never a "stylised theory" badge.
 */
import { type EngineCatalogue, type ReaderSpread, validateReaderSpread } from "@hachure/runtime";
import { PLATES_PROBE_KINDS, platesProbes } from "./bindings";
import { pageContent } from "./content";
import { predict, title } from "./lesson";
import { sources } from "./sources";

const both = (text: string) => ({ hs: text, uni: text });

/** The seed of 7C's starting landscape (parameter row 6); the scene reads its own config. */
export const PLATES_SEED = 7;

export const platesCatalogue: EngineCatalogue = {
  params: [],
  tools: [],
  probeKinds: PLATES_PROBE_KINDS,
};

export const platesSpread: ReaderSpread = {
  schemaVersion: 0,
  id: "tectonics.plate-boundaries",
  title,
  tags: {
    domain: ["tectonics", "geomorphology"],
    courses: ["physical-geography", "geomorphology"],
    levels: ["hs", "uni"],
  },
  tier: "stylised-theory",
  engine: "scene",
  scene: {
    preset: "plates-start",
    seed: PLATES_SEED,
    camera: { position: [0, 1.2, 1], target: [0, 0, 0], fovDeg: 35 },
    modelScope: { kind: "static-geometry" },
  },
  controls: [
    { kind: "action", id: "reset", action: "reset", label: both("Start again"), levels: ["hs", "uni"] },
  ],
  probes: platesProbes,
  page: { ...pageContent, predict },
  teacherNotes: "teacher-notes.md",
  sources,
};

const result = validateReaderSpread(platesSpread, platesCatalogue);
if (!result.ok)
  throw new Error(
    `Invalid plate-boundaries spread: ${result.issues.map((issue) => issue.message).join("; ")}`,
  );
