/**
 * <!-- expert-review -->
 * View configuration of "From V to U": display choices fixed at the owner review gate (D-W5-R1 items 4, 5
 * and 9). None of these values is a model parameter, and none is typed on the page: the scene (5K) and the
 * book (5M) read them from here, and the page shows them only through bindings.
 *
 * Grid columns are read against the capture manifest (`hachure-glacier-capture` v1: the valley runs along
 * columns i, i = 0 is the mouth), never against a hard-coded grid size.
 */
import { PROTOCOL_SECTIONS } from "@hachure/glacier/testing";

/** Which recorded moment a default view opens on. */
export type SnapshotChoice = "last";

export interface UValleyViewConfig {
  /**
   * Default front face (D-W5-R1 item 4): the grid column the cut opens on, for every rock, at the last
   * recorded snapshot. A display choice picked after scanning the runs (D-5H-R1 2), not a registered test:
   * no page claim may rest on this column alone.
   */
  readonly defaultFrontFace: { readonly gridColumn: number; readonly snapshot: SnapshotChoice };
  /** The registered under-ice section of the acceptance protocol (grid column). Claims rest here. */
  readonly registeredSectionColumn: number;
  /**
   * Margin notes (D-W5-R1 item 9): the section averaged over this many neighbouring columns (odd, centred
   * on the cut), values rounded to `roundToM` (unit: metres). The registered protocol keeps one column.
   */
  readonly marginNotes: { readonly sectionAverageColumns: number; readonly roundToM: number };
  /**
   * Overdeepened-section note (D-W5-R1 item 5): shown when the averaged valley floor somewhere down-valley
   * of the cut stands at least this much above the floor at the cut (an adverse bed slope; unit: metres).
   * Half the note rounding, so a shown rise never rounds to zero, and above the ±2 m start roughness.
   */
  readonly overdeepenedNote: { readonly minAdverseRiseM: number };
}

export const U_VALLEY_VIEW: UValleyViewConfig = Object.freeze({
  defaultFrontFace: Object.freeze({ gridColumn: 51, snapshot: "last" }),
  registeredSectionColumn: PROTOCOL_SECTIONS.underIce,
  marginNotes: Object.freeze({ sectionAverageColumns: 3, roundToM: 10 }),
  overdeepenedNote: Object.freeze({ minAdverseRiseM: 5 }),
}) as UValleyViewConfig;

/** The part of a capture manifest the view needs (structurally a `CapturedRunManifest`). */
export interface ManifestGrid {
  readonly grid: { readonly nx: number; readonly ny: number; readonly metresPerCell: number };
  readonly snapshots: readonly { readonly modelYears: number }[];
}

export interface ResolvedFrontFace {
  /** Grid column of the cut (unit: cells; i = 0 is the mouth). */
  readonly gridColumn: number;
  /** Index of the snapshot the view opens on. */
  readonly snapshotIndex: number;
  /** Model time of that snapshot (unit: model years). */
  readonly modelYears: number;
}

/**
 * Resolves the default front face against a run's manifest. Throws when the column (with its averaging
 * window) does not fit the manifest's grid or the run has no snapshot, so a regenerated capture on another
 * grid fails loudly instead of opening on a wrong section.
 */
export function resolveDefaultFrontFace(
  manifest: ManifestGrid,
  view: UValleyViewConfig = U_VALLEY_VIEW,
): ResolvedFrontFace {
  const half = (view.marginNotes.sectionAverageColumns - 1) / 2;
  const i = view.defaultFrontFace.gridColumn;
  if (!Number.isInteger(i) || i - half < 0 || i + half > manifest.grid.nx - 1)
    throw new RangeError(`default front face column ${i} does not fit a grid of ${manifest.grid.nx} columns`);
  if (manifest.snapshots.length === 0) throw new RangeError("the run has no recorded snapshot");
  const snapshotIndex = manifest.snapshots.length - 1;
  return { gridColumn: i, snapshotIndex, modelYears: manifest.snapshots[snapshotIndex]!.modelYears };
}

/** The columns averaged for a margin note at `gridColumn` (D-W5-R1 item 9). */
export function noteColumns(gridColumn: number, view: UValleyViewConfig = U_VALLEY_VIEW): number[] {
  const half = (view.marginNotes.sectionAverageColumns - 1) / 2;
  return Array.from({ length: view.marginNotes.sectionAverageColumns }, (_, k) => gridColumn - half + k);
}

/** Length of valley a margin note averages over (unit: metres); bound as `{{probe.sectionSpan}}`. */
export function noteSpanM(metresPerCell: number, view: UValleyViewConfig = U_VALLEY_VIEW): number {
  return view.marginNotes.sectionAverageColumns * metresPerCell;
}

/** Display rounding of a model length in a margin note (unit: metres). */
export function roundForNote(valueM: number, view: UValleyViewConfig = U_VALLEY_VIEW): number {
  const step = view.marginNotes.roundToM;
  return Math.round(valueM / step) * step || 0;
}
