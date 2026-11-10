/**
 * What the review build plays: a run is a starting state plus a series of snapshots, all through the
 * `LandscapeSnapshot` seam of `@hachure/ink/stage`.
 *
 * Today the only source is the authored fixture (two frames, no model time). When session 5G's captured
 * runs are merged, `reviewRuns()` returns them instead (one per rock), and the fixture stays as a renderer
 * test input only. Nothing else in the review build changes.
 */
import type { LandscapeSnapshot } from "@hachure/ink/stage";
import { FIXTURE_DRESSING, FIXTURE_LABEL, fixtureFrames } from "./fixture";

export interface ReviewFrame {
  /** Reader-facing label of this frame (for the fixture: what it is; for a run: bound model time). */
  readonly label: string;
  readonly snapshot: LandscapeSnapshot;
}

export interface ReviewRun {
  readonly id: string;
  /** Rock id of the run (matches a lithology look). */
  readonly rockId: number;
  /** The authored starting valley, drawn dashed on the cut face. */
  readonly start: LandscapeSnapshot;
  readonly frames: readonly ReviewFrame[];
  /** Display altitudes for snow and trees (unit: metres). From the model config for real runs. */
  readonly dressing: { readonly snowlineM: number; readonly treelineM: number };
  /** True for authored data that is not model output. The page then says so on every view. */
  readonly isFixture: boolean;
  /** Provenance line shown with the figure. */
  readonly provenance: string;
}

export function reviewRuns(): readonly ReviewRun[] {
  const f = fixtureFrames();
  return [
    {
      id: "fixture",
      rockId: 0,
      start: f.start.snapshot,
      frames: [f.start, f.glaciated],
      dressing: FIXTURE_DRESSING,
      isFixture: true,
      provenance: FIXTURE_LABEL,
    },
  ];
}
