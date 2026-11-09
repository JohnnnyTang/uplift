import type { StateSnapshot } from "../contract/index";
import { layer, median } from "./shared";

export interface HalfDepthWidthRequest {
  readonly row: number;
}
export type HalfDepthWidthResult =
  | { readonly resolved: false; readonly reason: "shoulders" | "shallow" | "crossing" }
  | {
      readonly resolved: true;
      readonly widthM: number;
      readonly depthM: number;
      readonly minimumXM: number;
      readonly leftXM: number;
      readonly rightXM: number;
    };

/** Fixed east-west section and shoulder/central strips from validation-spec.md. */
export function halfDepthWidth(
  snapshot: StateSnapshot,
  request: HalfDepthWidthRequest,
): HalfDepthWidthResult {
  const { gridSize: n, metresPerCell: l } = snapshot;
  if (!Number.isInteger(request.row) || request.row < 0 || request.row >= n)
    throw new RangeError("Invalid section row");
  const b = layer(snapshot, "bedrockM"),
    s = layer(snapshot, "sedimentM");
  const z = Array.from({ length: n }, (_, x) => b[request.row * n + x]! + s[request.row * n + x]!);
  const left: number[] = [],
    right: number[] = [];
  let minimum = -1;
  for (let x = 0; x < n; x++) {
    const fraction = (x + 0.5) / n;
    if (fraction >= 0.2 && fraction <= 0.3) left.push(z[x]!);
    if (fraction >= 0.7 && fraction <= 0.8) right.push(z[x]!);
    if (fraction >= 0.35 && fraction <= 0.65 && (minimum < 0 || z[x]! < z[minimum]!)) minimum = x;
  }
  if (!left.length || !right.length || minimum < 0) return { resolved: false, reason: "shoulders" };
  const depthM = Math.min(median(left), median(right)) - z[minimum]!;
  if (depthM < 0.5) return { resolved: false, reason: "shallow" };
  const target = z[minimum]! + depthM / 2;
  function crossing(direction: number): number | undefined {
    for (let x = minimum + direction; x >= 0 && x < n; x += direction) {
      if (z[x]! >= target) {
        const previous = x - direction;
        return (previous + 0.5 + (direction * (target - z[previous]!)) / (z[x]! - z[previous]!)) * l;
      }
    }
    return undefined;
  }
  const leftXM = crossing(-1),
    rightXM = crossing(1);
  if (leftXM === undefined || rightXM === undefined) return { resolved: false, reason: "crossing" };
  return {
    resolved: true,
    widthM: rightXM - leftXM,
    depthM,
    minimumXM: (minimum + 0.5) * l,
    leftXM,
    rightXM,
  };
}
