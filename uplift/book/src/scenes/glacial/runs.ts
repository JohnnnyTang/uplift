/**
 * What the review build plays: a run is a starting state plus a series of snapshots, all through the
 * `LandscapeSnapshot` seam of `@hachure/ink/stage`.
 *
 * The source is session 5G's captured runs (`@hachure/glacier/captures/*`, format
 * `hachure-glacier-capture` v1): one recorded run per rock, real model output. Grid size, cell size, rock,
 * snowline, model time and the number of snapshots are all read from each capture's manifest, so a
 * regenerated capture on another grid drops in unchanged. The authored fixture remains as a renderer test
 * input and as the fallback if the captures cannot load; it is labelled as a fixture wherever it shows.
 *
 * No glacier physics here: the page only reads recorded fields and measures them with the model's own
 * section probe (`measureSection`), so margin-note numbers are the model's numbers.
 */
import {
  type CapturedRun,
  type CapturedRunManifest,
  type AveragedSectionMeasure,
  type GlacierSnapshot,
  decodeCapturedRun,
  measureOverdeepening,
  measureSectionAveraged,
} from "@hachure/glacier";
import graniteBin from "@hachure/glacier/captures/granite.bin?url";
import graniteManifest from "@hachure/glacier/captures/granite.json?url";
import sandstoneBin from "@hachure/glacier/captures/sandstone.bin?url";
import sandstoneManifest from "@hachure/glacier/captures/sandstone.json?url";
import shaleBin from "@hachure/glacier/captures/shale.bin?url";
import shaleManifest from "@hachure/glacier/captures/shale.json?url";
import type { LandscapeSnapshot, ValleyOrientation } from "@hachure/ink/stage";
import { FIXTURE_DRESSING, FIXTURE_LABEL, fixtureFrames } from "./fixture";

export interface ReviewFrame {
  /** Reader-facing label of this frame (for the fixture: what it is; for a run: bound model time). */
  readonly label: string;
  readonly snapshot: LandscapeSnapshot;
  /** Model time of the frame (unit: model years); null for authored, timeless frames. */
  readonly modelYears: number | null;
}

/**
 * The model's own measurements of one cross-section of the valley, at a recorded time, averaged over the
 * section column and its neighbours (`measureSectionAveraged`, D-W5-R1 item 9), so the notes do not jump
 * when the front face moves by one cell.
 */
export interface ReviewSection {
  /** Length of valley the averaged reading covers (unit: metres). */
  readonly spanM: number;
  /** Cross-profile shape exponent b (V ≈ 1, U ≈ 2 or more; unit: none). NaN when it cannot be fitted. */
  readonly shapeExponent: number;
  /** Width of the valley floor (unit: metres). */
  readonly floorWidthM: number;
  /** Rim-to-floor depth (unit: metres). */
  readonly depthM: number;
  /** How far the floor has been lowered since the start, at this section (unit: metres). */
  readonly floorLoweredM: number;
  /** Steepest wall slope in the section (unit: degrees). */
  readonly steepestWallDeg: number;
  /** Thickest ice in the section; 0 when ice-free (unit: metres). */
  readonly iceThicknessM: number;
}

export interface ReviewRun {
  readonly id: string;
  /** Rock key of the run (the model's rock id string; matches a lithology look key). */
  readonly rockKey: string;
  /** Presentation id of the rock's lithology look. */
  readonly rockId: number;
  /** The authored starting valley, drawn dashed on the cut face. */
  readonly start: LandscapeSnapshot;
  readonly frames: readonly ReviewFrame[];
  /** How the grid maps onto the block. */
  readonly orientation: ValleyOrientation;
  /** Display altitudes for snow and trees (unit: metres). The snowline is the model's, for real runs. */
  readonly dressing: { readonly snowlineM: number; readonly treelineM: number };
  /** Lowest bed and highest ice surface over the start and every frame (unit: metres). */
  readonly elevationRangeM: { readonly minM: number; readonly maxM: number };
  /** Erosion time compression of the model (unit: none); null for the fixture. */
  readonly erosionSpeedup: number | null;
  /** True for authored data that is not model output. The page then says so on every view. */
  readonly isFixture: boolean;
  /** Provenance line shown with the figure. */
  readonly provenance: string;
  /**
   * The model's section probe at grid index `valleyIndex` along the valley, for frame `frameIndex`.
   * Null when the run cannot be measured (the fixture).
   */
  section(frameIndex: number, valleyIndex: number): ReviewSection | null;
  /**
   * Whether the section sits in a basin carved by the ice (its floor below the floor down-valley,
   * `measureOverdeepening` against the run's start). Null when the run cannot be measured.
   */
  overdeepening(frameIndex: number, valleyIndex: number): ReviewOverdeepening | null;
  /**
   * Bed and ice across the valley at grid index `valleyIndex`, left to right as seen from the block's
   * front, with the starting bed. Null when the run cannot be measured.
   */
  profile(frameIndex: number, valleyIndex: number): ReviewProfile | null;
}

export interface ReviewOverdeepening {
  readonly overdeepened: boolean;
  /** Rise of the floor down-valley carved since the start (unit: metres). */
  readonly carvedRiseM: number;
  /** Highest averaged floor down-valley of the section minus the floor here (unit: metres). */
  readonly adverseRiseM?: number;
}

export interface ReviewProfile {
  /** Across-valley positions (unit: metres). */
  readonly acrossM: Float64Array;
  readonly bedM: Float64Array;
  readonly iceM: Float64Array;
  readonly startBedM: Float64Array;
}

/**
 * Grid orientation of every `hachure-glacier-capture` v1 file: the valley runs along columns i, and
 * downstream is decreasing i (i = 0 is the mouth). Part of the format contract, not of a single run.
 */
export const CAPTURE_ORIENTATION: ValleyOrientation = Object.freeze({
  valleyAxis: "columns",
  downstream: "decreasing",
});

/**
 * Grid row (for a valley along columns) of the `a`-th sample across the block, left to right as seen from its
 * front face: the same rotation `toBlockGrid` of `@hachure/ink/stage` applies.
 */
export function acrossRow(orientation: ValleyOrientation, rows: number, a: number): number {
  if (orientation.valleyAxis !== "columns") throw new RangeError("captures run along columns");
  return orientation.downstream === "decreasing" ? a : rows - 1 - a;
}

/**
 * Trees are drawn up to this far below the model's snowline (unit: metres). Illustrative dressing only:
 * the model has no vegetation.
 */
export const TREELINE_BELOW_SNOWLINE_M = 300;

/** The captures the review build loads, in teaching order (soft → hard). */
const CAPTURE_FILES: readonly { readonly rock: string; readonly manifest: string; readonly bin: string }[] = [
  { rock: "shale", manifest: shaleManifest, bin: shaleBin },
  { rock: "sandstone", manifest: sandstoneManifest, bin: sandstoneBin },
  { rock: "granite", manifest: graniteManifest, bin: graniteBin },
];

function rangeOf(snaps: readonly LandscapeSnapshot[]): { minM: number; maxM: number } {
  let minM = Infinity;
  let maxM = -Infinity;
  for (const s of snaps) {
    for (let k = 0; k < s.bedM.length; k++) {
      const bed = s.bedM[k]!;
      minM = Math.min(minM, bed);
      maxM = Math.max(maxM, bed + (s.iceThicknessM?.[k] ?? 0));
    }
  }
  return { minM, maxM };
}

/** The authored fixture as a run (two frames, no model time, labelled). */
export function fixtureRun(): ReviewRun {
  const f = fixtureFrames();
  const frames = [f.start, f.glaciated].map((x) => ({ ...x, modelYears: null }));
  return {
    id: "fixture",
    rockKey: "granite",
    rockId: 0,
    start: f.start.snapshot,
    frames,
    orientation: Object.freeze({ valleyAxis: "rows", downstream: "increasing" }),
    dressing: FIXTURE_DRESSING,
    elevationRangeM: rangeOf(frames.map((x) => x.snapshot)),
    erosionSpeedup: null,
    isFixture: true,
    provenance: FIXTURE_LABEL,
    section: () => null,
    overdeepening: () => null,
    profile: () => null,
  };
}

/** Kept for the renderer tests: the fixture as the only run. */
export function reviewRuns(): readonly ReviewRun[] {
  return [fixtureRun()];
}

/**
 * Turns decoded captures into review runs. `lookIdFor` maps the model's rock id string to the presentation
 * id of its lithology look. Pure: everything comes from each capture's manifest and payload.
 */
export function reviewRunsFromCaptures(
  captures: readonly CapturedRun[],
  lookIdFor: (rockKey: string) => number,
): ReviewRun[] {
  return captures.map((capture) => {
    const m = capture.manifest;
    const rockId = lookIdFor(m.rockId);
    const glacier = Array.from({ length: capture.count }, (_, k) => capture.snapshot(k));
    const snapshots: LandscapeSnapshot[] = glacier.map((g) => toLandscapeSnapshot(g, rockId));
    const frames: ReviewFrame[] = snapshots.map((snapshot, k) => ({
      label: `${glacier[k]!.modelYears} model years`,
      snapshot,
      modelYears: glacier[k]!.modelYears,
    }));
    const start = glacier[0]!;
    const measures = glacier.map((g) => createFrameMeasures(g, start));
    const snowlineM = m.config.snowlineAltitudeM;
    return {
      id: `capture-${m.rockId}`,
      rockKey: m.rockId,
      rockId,
      start: snapshots[0]!,
      frames,
      orientation: CAPTURE_ORIENTATION,
      dressing: { snowlineM, treelineM: snowlineM - TREELINE_BELOW_SNOWLINE_M },
      elevationRangeM: rangeOf(snapshots),
      erosionSpeedup: m.config.erosionSpeedup,
      isFixture: false,
      provenance: "Recorded run of the glacier model",
      section: (k, i) => measures[k]?.section(i) ?? null,
      overdeepening: (k, i) => measures[k]?.overdeepening(i) ?? null,
      profile: (k, i) => measures[k]?.profile(i) ?? null,
    };
  });
}

/** A glacier snapshot in the `LandscapeSnapshot` seam of the stage (the fields are shared, not copied). */
export function toLandscapeSnapshot(g: GlacierSnapshot, rockId: number): LandscapeSnapshot {
  return {
    columns: g.nx,
    rows: g.ny,
    metresPerCell: g.metresPerCell,
    bedM: g.bedM,
    iceThicknessM: g.iceThicknessM,
    rockId,
    iceVelocityMPerYr: { x: g.surfaceVelocityXMPerYear, y: g.surfaceVelocityYMPerYear },
    modelTimeYr: g.modelYears,
  };
}

/** The model's own measures of one snapshot, against its run's authored start. */
export interface FrameMeasures {
  section(valleyIndex: number): ReviewSection | null;
  overdeepening(valleyIndex: number): ReviewOverdeepening | null;
  profile(valleyIndex: number): ReviewProfile | null;
}

const startSectionCache = new WeakMap<GlacierSnapshot, Map<number, AveragedSectionMeasure>>();

/**
 * Measures of snapshot `g` of a run whose authored start is `start`, through the model's section probes
 * (`measureSectionAveraged`, `measureOverdeepening`). Used for recorded captures and for the live runtime
 * alike (5M), so the page reads the same numbers whichever source it shows.
 */
export function createFrameMeasures(g: GlacierSnapshot, start: GlacierSnapshot): FrameMeasures {
  const grid = { nx: g.nx, ny: g.ny, metresPerCell: g.metresPerCell };
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < g.nx;
  let startSections = startSectionCache.get(start);
  if (!startSections) startSectionCache.set(start, (startSections = new Map()));
  const starts = startSections;
  const sections = new Map<number, ReviewSection>();
  return {
    section(i) {
      if (!valid(i)) return null;
      const cached = sections.get(i);
      if (cached) return cached;
      let s0 = starts.get(i);
      if (!s0) {
        s0 = measureSectionAveraged(start.bedM, start.iceThicknessM, grid, i);
        starts.set(i, s0);
      }
      const now = measureSectionAveraged(g.bedM, g.iceThicknessM, grid, i);
      const result: ReviewSection = {
        spanM: now.spanM,
        shapeExponent: now.shapeExponent,
        floorWidthM: now.floorWidthM,
        depthM: now.depthM,
        floorLoweredM: s0.floorElevationM - now.floorElevationM,
        steepestWallDeg: now.maxWallSlopeDeg,
        iceThicknessM: now.maxIceThicknessM,
      };
      sections.set(i, result);
      return result;
    },
    overdeepening(i) {
      if (!valid(i)) return null;
      const o = measureOverdeepening(g.bedM, grid, i, { initialBed: start.bedM });
      return {
        overdeepened: o.overdeepened,
        carvedRiseM: o.carvedRiseM,
        adverseRiseM: o.adverseRiseDownValleyM,
      };
    },
    profile(i) {
      if (!valid(i)) return null;
      const { nx, ny, metresPerCell } = grid;
      const out = {
        acrossM: new Float64Array(ny),
        bedM: new Float64Array(ny),
        iceM: new Float64Array(ny),
        startBedM: new Float64Array(ny),
      };
      for (let a = 0; a < ny; a++) {
        const k = acrossRow(CAPTURE_ORIENTATION, ny, a) * nx + i;
        out.acrossM[a] = a * metresPerCell;
        out.bedM[a] = g.bedM[k]!;
        out.iceM[a] = g.iceThicknessM[k]!;
        out.startBedM[a] = start.bedM[k]!;
      }
      return out;
    },
  };
}

/** Lowest and highest elevation across several runs (unit: metres), to fix the block's frame. */
export function combinedRange(runs: readonly ReviewRun[]): { minM: number; maxM: number } {
  return {
    minM: Math.min(...runs.map((r) => r.elevationRangeM.minM)),
    maxM: Math.max(...runs.map((r) => r.elevationRangeM.maxM)),
  };
}

export interface LoadedRuns {
  readonly runs: readonly ReviewRun[];
  /** Why the captures could not be used (the fixture is shown instead), or null. */
  readonly error: string | null;
}

/** Fetches and decodes the captured runs. Falls back to the labelled fixture if they cannot load. */
export async function loadReviewRuns(lookIdFor: (rockKey: string) => number): Promise<LoadedRuns> {
  try {
    const captures = await Promise.all(
      CAPTURE_FILES.map(async (file) => {
        const [manifestRes, binRes] = await Promise.all([fetch(file.manifest), fetch(file.bin)]);
        if (!manifestRes.ok) throw new Error(`${file.rock} manifest: HTTP ${manifestRes.status}`);
        if (!binRes.ok) throw new Error(`${file.rock} payload: HTTP ${binRes.status}`);
        const manifest = (await manifestRes.json()) as CapturedRunManifest;
        return decodeCapturedRun(manifest, await binRes.arrayBuffer());
      }),
    );
    return { runs: reviewRunsFromCaptures(captures, lookIdFor), error: null };
  } catch (error) {
    return {
      runs: [fixtureRun()],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
