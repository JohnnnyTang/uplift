import type {
  CrossSectionRequest,
  LongProfileRequest,
  ProfileResult,
  StateSnapshot,
} from "../contract/index";
import { interpolate, layer, pointCell } from "./shared";

export function sampleProfile(
  snapshot: StateSnapshot,
  request: LongProfileRequest | CrossSectionRequest,
): ProfileResult {
  const path = request.kind === "long-profile" ? request.path : [request.from, request.to];
  if (path.length < 2 || !Number.isInteger(request.samples) || request.samples < 2) {
    throw new RangeError("Profile needs at least two vertices and two integer samples");
  }
  const lengths = [0];
  for (let i = 0; i < path.length; i++) {
    pointCell(snapshot, path[i]!);
    if (i)
      lengths.push(
        lengths[i - 1]! + Math.hypot(path[i]!.xM - path[i - 1]!.xM, path[i]!.yM - path[i - 1]!.yM),
      );
  }
  const total = lengths.at(-1)!;
  if (!(total > 0)) throw new RangeError("Profile path must have positive length");
  const bedrock = layer(snapshot, "bedrockM"),
    sediment = layer(snapshot, "sedimentM"),
    water = layer(snapshot, "waterM");
  const distanceM = new Float64Array(request.samples),
    bedrockM = new Float64Array(request.samples),
    groundM = new Float64Array(request.samples),
    waterM = new Float64Array(request.samples);
  let segment = 1;
  for (let i = 0; i < request.samples; i++) {
    const distance = (total * i) / (request.samples - 1);
    while (segment < path.length - 1 && lengths[segment]! <= distance) segment++;
    const span = lengths[segment]! - lengths[segment - 1]!;
    const t = span > 0 ? (distance - lengths[segment - 1]!) / span : 0;
    const a = path[segment - 1]!,
      b = path[segment]!;
    const point = { xM: a.xM + t * (b.xM - a.xM), yM: a.yM + t * (b.yM - a.yM) };
    distanceM[i] = distance;
    bedrockM[i] = interpolate(snapshot, bedrock, point);
    groundM[i] = bedrockM[i]! + interpolate(snapshot, sediment, point);
    waterM[i] = interpolate(snapshot, water, point);
  }
  return { kind: request.kind, distanceM, bedrockM, groundM, waterM };
}
