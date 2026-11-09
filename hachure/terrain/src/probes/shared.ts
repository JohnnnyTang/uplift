import type { LayerName, PointM, StateSnapshot } from "../contract/index";

export function layer(snapshot: StateSnapshot, name: LayerName): Float32Array {
  const values = snapshot.layers[name];
  if (!values || values.length !== snapshot.gridSize ** 2) {
    throw new Error(`Probe requires complete layer: ${name}`);
  }
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error(`Non-finite probe layer: ${name}`);
  }
  return values;
}

export function pointCell(snapshot: StateSnapshot, point: PointM): number {
  const { gridSize: n, metresPerCell: l } = snapshot;
  if (
    !Number.isFinite(point.xM) ||
    !Number.isFinite(point.yM) ||
    point.xM < 0 ||
    point.yM < 0 ||
    point.xM >= n * l ||
    point.yM >= n * l
  ) {
    throw new RangeError("Probe point must lie inside the grid");
  }
  return Math.floor(point.yM / l) * n + Math.floor(point.xM / l);
}

/** Cell-centred bilinear interpolation; outer half-cells use the nearest centre. */
export function interpolate(snapshot: StateSnapshot, values: Float32Array, point: PointM): number {
  pointCell(snapshot, point);
  const n = snapshot.gridSize;
  const x = Math.max(0, Math.min(n - 1, point.xM / snapshot.metresPerCell - 0.5));
  const y = Math.max(0, Math.min(n - 1, point.yM / snapshot.metresPerCell - 0.5));
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const x1 = Math.min(n - 1, x0 + 1),
    y1 = Math.min(n - 1, y0 + 1);
  const a = values[y0 * n + x0]! * (1 - (x - x0)) + values[y0 * n + x1]! * (x - x0);
  const b = values[y1 * n + x0]! * (1 - (x - x0)) + values[y1 * n + x1]! * (x - x0);
  return a * (1 - (y - y0)) + b * (y - y0);
}

export function median(values: readonly number[]): number {
  if (!values.length) throw new RangeError("Median needs samples");
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}
