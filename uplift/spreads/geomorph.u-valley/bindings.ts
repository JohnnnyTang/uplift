/**
 * <!-- expert-review -->
 * The live values the lesson's text may show, declared as spread probes. Every number on the page, in a
 * margin note, caption, ghost label or text alternative is one of these; nothing is typed.
 *
 * Request kinds are the contract with the glacial host (5J runtime, 5K scene, 5M integration):
 *
 * - `glacier-run`: a value of a run (`run: "live" | "kept"`): `modelYears`, `rockName` (string),
 *   `snapshotIntervalYears`, `backend` (string, as `selectGlacierBackend` reports it).
 * - `glacier-section`: the section under the front face of a run, **averaged over the columns of
 *   `noteColumns()`** (D-W5-R1 item 9) and rounded with `roundForNote()` for lengths. Fields follow
 *   `SectionMeasure` (`floorWidthM`, `depthM`, `maxWallSlopeDeg`, `shapeExponent`, `maxIceThicknessM`),
 *   plus `floorLoweredM` (start floor minus current floor, averaged the same way) and
 *   `adverseRiseDownValleyM` (highest averaged floor down-valley of the cut minus the floor at the cut; the
 *   overdeepened-note trigger, see `U_VALLEY_VIEW.overdeepenedNote`). For a kept run the section is read at
 *   its snapshot nearest the live run's model time (plan §4).
 * - `glacier-face`: `distanceFromHeadKm`, how far down the valley the front face stands.
 * - `glacier-config`: a `GlacierConfig` field of the live run, by name (tested against the contract).
 * - `glacier-rock`: a `RockType` field of the live run's rock (`relativeErodibility`,
 *   `criticalWallSlopeDeg`).
 * - `lesson-display`: a display constant of `U_VALLEY_VIEW`: `sectionSpanM` (`noteSpanM()`), `roundToM`, `minAdverseRiseM`.
 * - `glacier-section-series`: graph data, one series per run (live and kept) over recorded model time.
 */
import type { Level, Probe } from "@hachure/runtime";

const both = (text: string) => ({ hs: text, uni: text });
const UNI: readonly Level[] = ["uni"];

type Run = "live" | "kept";
const run = (id: string, label: string, r: Run, field: string, unit: string, sf = 4): Probe => ({
  id,
  label: both(label),
  request: { kind: "glacier-run", run: r },
  field,
  shape: "scalar",
  unit,
  significantFigures: sf,
});
const section = (id: string, label: string, r: Run, field: string, unit: string, sf = 4): Probe => ({
  id,
  label: both(label),
  request: { kind: "glacier-section", run: r },
  field,
  shape: "scalar",
  unit,
  significantFigures: sf,
});
const config = (id: string, label: string, field: string, unit: string, sf = 3): Probe => ({
  id,
  label: both(label),
  request: { kind: "glacier-config" },
  field,
  shape: "scalar",
  unit,
  significantFigures: sf,
  levels: UNI,
});
const series = (id: string, label: string, field: string, unit: string): Probe => ({
  id,
  label: both(label),
  request: { kind: "glacier-section-series", runs: "all" },
  field,
  shape: "series",
  unit,
  significantFigures: 3,
  levels: UNI,
});

/** Live run: time, rock and the averaged section under the front face. */
const liveProbes: readonly Probe[] = [
  run("modelTime", "Model time", "live", "modelYears", "model years"),
  run("rockName", "Rock", "live", "rockName", ""),
  {
    id: "faceDistance",
    label: both("Front face, down the valley"),
    request: { kind: "glacier-face" },
    field: "distanceFromHeadKm",
    shape: "scalar",
    unit: "km",
    significantFigures: 2,
  },
  section("floorWidth", "Floor width", "live", "floorWidthM", "m"),
  section("valleyDepth", "Valley depth", "live", "depthM", "m"),
  section("floorLowered", "Floor lowered since the start", "live", "floorLoweredM", "m"),
  section("steepestWall", "Steepest wall", "live", "maxWallSlopeDeg", "degrees", 2),
  section("iceThickness", "Ice thickness", "live", "maxIceThicknessM", "m"),
  section("adverseRise", "Floor rise down-valley", "live", "adverseRiseDownValleyM", "m"),
  { ...section("shapeExponent", "Shape exponent b", "live", "shapeExponent", "", 2), levels: UNI },
];

/** The kept run compared at the nearest recorded time ("a separate run with another rock"). */
const keptProbes: readonly Probe[] = [
  run("keptRockName", "Compared rock", "kept", "rockName", ""),
  run("keptModelTime", "Compared run time", "kept", "modelYears", "model years"),
  section("keptFloorWidth", "Compared floor width", "kept", "floorWidthM", "m"),
  section("keptValleyDepth", "Compared valley depth", "kept", "depthM", "m"),
  section("keptFloorLowered", "Compared floor lowered", "kept", "floorLoweredM", "m"),
  section("keptSteepestWall", "Compared steepest wall", "kept", "maxWallSlopeDeg", "degrees", 2),
  { ...section("keptShapeExponent", "Compared shape exponent", "kept", "shapeExponent", "", 2), levels: UNI },
];

/** Deeper level: display constants, bound parameters and run graphs. */
const deeperProbes: readonly Probe[] = [
  {
    id: "sectionSpan",
    label: both("Length of valley averaged in a note"),
    request: { kind: "lesson-display" },
    field: "sectionSpanM",
    shape: "scalar",
    unit: "m",
    significantFigures: 4,
    levels: UNI,
  },
  {
    id: "noteRounding",
    label: both("Note rounding"),
    request: { kind: "lesson-display" },
    field: "roundToM",
    shape: "scalar",
    unit: "m",
    significantFigures: 3,
    levels: UNI,
  },
  {
    id: "overdeepenedThreshold",
    label: both("Smallest floor rise for the overdeepened note"),
    request: { kind: "lesson-display" },
    field: "minAdverseRiseM",
    shape: "scalar",
    unit: "m",
    significantFigures: 3,
    levels: UNI,
  },
  {
    ...run("snapshotInterval", "Snapshot interval", "live", "snapshotIntervalYears", "model years"),
    levels: UNI,
  },
  { ...run("backend", "Solver backend", "live", "backend", ""), levels: UNI },
  config("snowline", "Snowline altitude", "snowlineAltitudeM", "m", 4),
  config("massBalanceGradient", "Mass-balance gradient", "massBalanceGradientPerYear", "per year"),
  config("maxAccumulation", "Largest accumulation", "maxAccumulationMPerYear", "m/yr"),
  config("iceDensity", "Ice density", "iceDensityKgPerM3", "kg/m³"),
  config("gravity", "Gravity", "gravityMPerS2", "m/s²"),
  config("slidingAtReference", "Sliding at reference stress", "slidingMPerYearAtReferenceStress", "m/yr"),
  config("referenceStress", "Reference basal stress", "referenceBasalStressPa", "Pa"),
  config("slidingExponent", "Sliding-law exponent m", "slidingStressExponent", ""),
  config("maxSlidingStress", "Stress cap for sliding and erosion", "maxSlidingStressPa", "Pa"),
  config("slidingOnset", "Ice thickness where sliding starts", "slidingOnsetIceThicknessM", "m"),
  config("fullSliding", "Ice thickness of full sliding", "fullSlidingIceThicknessM", "m"),
  config("erosionAtReference", "Erosion at reference sliding", "erosionMPerYearAtReferenceSliding", "m/yr"),
  config("referenceSliding", "Reference sliding speed", "referenceSlidingMPerYear", "m/yr"),
  config("erosionExponent", "Erosion-law exponent l", "erosionSlidingExponent", ""),
  config("erosionSpeedup", "Erosion time compression", "erosionSpeedup", ""),
  config("wallFailureRate", "Wall relaxation rate", "wallFailureRatePerYear", "per year"),
  config("timeStep", "Fixed time step", "dtYears", "model years"),
  config("metresPerCell", "Cell size", "metresPerCell", "m"),
  config("gridColumns", "Grid columns", "nx", "cells"),
  config("gridRows", "Grid rows", "ny", "cells"),
  {
    id: "rockErodibility",
    label: both("Relative erodibility"),
    request: { kind: "glacier-rock" },
    field: "relativeErodibility",
    shape: "scalar",
    unit: "",
    significantFigures: 2,
    levels: UNI,
  },
  {
    id: "rockCriticalWall",
    label: both("Steepest stable wall"),
    request: { kind: "glacier-rock" },
    field: "criticalWallSlopeDeg",
    shape: "scalar",
    unit: "degrees",
    significantFigures: 2,
    levels: UNI,
  },
  series("floorLoweredSeries", "Floor lowered over model time", "floorLoweredM", "m"),
  series("valleyDepthSeries", "Valley depth over model time", "depthM", "m"),
  series("floorWidthSeries", "Floor width over model time", "floorWidthM", "m"),
  series("steepestWallSeries", "Steepest wall over model time", "maxWallSlopeDeg", "degrees"),
  series("shapeExponentSeries", "Shape exponent over model time", "shapeExponent", ""),
];

export const uValleyProbes: readonly Probe[] = [...liveProbes, ...keptProbes, ...deeperProbes];

/** Request kinds the glacial host must serve; the validator checks the probes against this list. */
export const GLACIAL_PROBE_KINDS = [
  "glacier-run",
  "glacier-section",
  "glacier-face",
  "glacier-config",
  "glacier-rock",
  "lesson-display",
  "glacier-section-series",
] as const;
