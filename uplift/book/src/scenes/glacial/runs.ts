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
  decodeCapturedRun,
  measureSection,
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

/** The model's own measurements of one cross-section of the valley, at a recorded time. */
export interface ReviewSection {
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
    const snapshots: LandscapeSnapshot[] = glacier.map((g) => ({
      columns: g.nx,
      rows: g.ny,
      metresPerCell: g.metresPerCell,
      bedM: g.bedM,
      iceThicknessM: g.iceThicknessM,
      rockId,
      iceVelocityMPerYr: { x: g.surfaceVelocityXMPerYear, y: g.surfaceVelocityYMPerYear },
      modelTimeYr: g.modelYears,
    }));
    const frames: ReviewFrame[] = snapshots.map((snapshot, k) => ({
      label: `${glacier[k]!.modelYears} model years`,
      snapshot,
      modelYears: glacier[k]!.modelYears,
    }));
    const startSections = new Map<number, ReturnType<typeof measureSection>>();
    const section = (frameIndex: number, valleyIndex: number): ReviewSection | null => {
      const g = glacier[frameIndex];
      if (!g || !Number.isInteger(valleyIndex) || valleyIndex < 0 || valleyIndex >= m.grid.nx) return null;
      let start = startSections.get(valleyIndex);
      if (!start) {
        start = measureSection(glacier[0]!.bedM, glacier[0]!.iceThicknessM, m.grid, valleyIndex);
        startSections.set(valleyIndex, start);
      }
      const now = measureSection(g.bedM, g.iceThicknessM, m.grid, valleyIndex);
      return {
        floorWidthM: now.floorWidthM,
        depthM: now.depthM,
        floorLoweredM: start.floorElevationM - now.floorElevationM,
        steepestWallDeg: now.maxWallSlopeDeg,
        iceThicknessM: now.maxIceThicknessM,
      };
    };
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
      section,
    };
  });
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
