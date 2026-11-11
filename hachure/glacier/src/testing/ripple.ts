/**
 * Grid-scale (2Δx, odd/even) content of a profile: the share of its local variation carried by the
 * alternating mode, from 0 (smooth) to 1 (pure checkerboard). Σ(second difference)² over
 * Σ(centred difference)² + Σ(second difference)²: a centred difference is blind to an odd/even mode and a
 * second difference is largest on it. Used to guard the solver against grid-scale artefacts (session 5G2).
 */
export function gridScaleShare(values: ArrayLike<number>, from = 0, to = values.length): number {
  let alt = 0;
  let smooth = 0;
  for (let i = Math.max(1, from + 1); i < Math.min(values.length - 1, to - 1); i++) {
    const a = values[i - 1]!;
    const b = values[i]!;
    const c = values[i + 1]!;
    const d2 = a - 2 * b + c;
    const d1 = c - a;
    alt += d2 * d2;
    smooth += d1 * d1;
  }
  return alt + smooth > 0 ? alt / (alt + smooth) : 0;
}

/** {@link gridScaleShare} of a field along grid x (the valley), pooled over rows `j0..j1 − 1`. */
export function alongValleyGridScaleShare(
  field: ArrayLike<number>,
  nx: number,
  j0: number,
  j1: number,
  i0 = 0,
  i1 = nx,
): number {
  let alt = 0;
  let smooth = 0;
  for (let j = j0; j < j1; j++) {
    for (let i = Math.max(1, i0 + 1); i < Math.min(nx - 1, i1 - 1); i++) {
      const k = j * nx + i;
      const d2 = field[k - 1]! - 2 * field[k]! + field[k + 1]!;
      const d1 = field[k + 1]! - field[k - 1]!;
      alt += d2 * d2;
      smooth += d1 * d1;
    }
  }
  return alt + smooth > 0 ? alt / (alt + smooth) : 0;
}
