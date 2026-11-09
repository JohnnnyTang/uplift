/** <!-- expert-review --> Fixed sections from docs/science/validation-spec.md; no moving minima in y. */
export interface SectionSurface {
  readonly gridSize: number;
  readonly metresPerCell: number;
  readonly bedrockM: ArrayLike<number>;
  readonly sedimentM: ArrayLike<number>;
}
export interface SectionIncision {
  readonly row: number;
  readonly baselineMinimumM: number;
  readonly currentMinimumM: number;
  readonly incisionM: number;
}
export interface FixedSectionIncision {
  readonly resolved: boolean;
  readonly medianIncisionM: number | null;
  readonly sections: readonly SectionIncision[];
}

/** Same physical sections across tiers; reference rows are 32, 48, 64, 80, 96 on 128 cells. */
export function validationSectionRows(gridSize: number): readonly number[] {
  if (!Number.isInteger(gridSize) || gridSize < 8) throw new RangeError("Invalid section grid");
  return [32, 48, 64, 80, 96].map((row) => Math.floor((row / 128) * gridSize));
}

export function validationMedian(values: readonly number[]): number {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new RangeError("Median needs finite values");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Use reset baseline for live incision; pass the spin-up baseline explicitly for calibration. */
export function measureFixedSectionIncision(
  baseline: SectionSurface,
  current: SectionSurface,
): FixedSectionIncision {
  const n = baseline.gridSize;
  if (n !== current.gridSize || baseline.metresPerCell !== current.metresPerCell)
    throw new RangeError("Section grids must match");
  if (!(Number.isFinite(baseline.metresPerCell) && baseline.metresPerCell > 0))
    throw new RangeError("Invalid cell spacing");
  for (const surface of [baseline, current])
    if (surface.bedrockM.length !== n * n || surface.sedimentM.length !== n * n)
      throw new RangeError("Incomplete surface layers");
  const sections: SectionIncision[] = [];
  for (const row of validationSectionRows(n)) {
    let initial = Infinity,
      final = Infinity;
    for (let x = 0; x < n; x++) {
      const fraction = (x + 0.5) / n;
      if (fraction < 0.35 || fraction > 0.65) continue;
      const i = row * n + x;
      const a = baseline.bedrockM[i]! + baseline.sedimentM[i]!;
      const b = current.bedrockM[i]! + current.sedimentM[i]!;
      if (!Number.isFinite(a) || !Number.isFinite(b))
        return { resolved: false, medianIncisionM: null, sections: [] };
      initial = Math.min(initial, a);
      final = Math.min(final, b);
    }
    if (!Number.isFinite(initial + final)) return { resolved: false, medianIncisionM: null, sections: [] };
    sections.push({ row, baselineMinimumM: initial, currentMinimumM: final, incisionM: initial - final });
  }
  return { resolved: true, medianIncisionM: validationMedian(sections.map((s) => s.incisionM)), sections };
}
