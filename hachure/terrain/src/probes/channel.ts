import type { PointM, ProfileResult, StateSnapshot } from "../contract/index";
import { layer, pointCell } from "./shared";
import { sampleProfile } from "./profile";

export interface ChannelRequest {
  readonly source: PointM;
  readonly fallback?: "d8-accumulation";
}
export interface ChannelResult {
  readonly path: readonly PointM[];
  readonly method: "steepest-descent" | "d8-accumulation";
  readonly complete: boolean;
  readonly stoppedAt: "outlet" | "pit" | "boundary" | "visited";
  /** Upstream cell counts, including self; present only for the explicitly requested fallback. */
  readonly accumulation?: Float64Array;
}

/** D8 ground routing. Equal downward slopes use neighbour row-major order. */
export function extractChannel(snapshot: StateSnapshot, request: ChannelRequest): ChannelResult {
  const { gridSize: n, metresPerCell: l } = snapshot;
  const rock = layer(snapshot, "bedrockM"),
    loose = layer(snapshot, "sedimentM");
  const z = Array.from(rock, (v, i) => v + loose[i]!);
  const source = pointCell(snapshot, request.source);
  const outlet = snapshot.outlet.y * n + snapshot.outlet.x;
  function receiver(i: number, flats: boolean): number {
    const x = i % n,
      y = Math.floor(i / n);
    let best = -1,
      slope = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx,
          s = (z[i]! - z[j]!) / (l * Math.hypot(dx, dy));
        if (s > slope) {
          slope = s;
          best = j;
        }
      }
    // Flat routing strictly decreases row-major index: no pit filling or uphill breach.
    if (best < 0 && flats) {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy,
            j = ny * n + nx;
          if (nx >= 0 && ny >= 0 && nx < n && ny < n && j < i && z[j] === z[i] && (best < 0 || j < best))
            best = j;
        }
    }
    return best;
  }
  function trace(flats: boolean): ChannelResult {
    const path: PointM[] = [],
      visited = new Set<number>();
    let i = source;
    const result = (stoppedAt: ChannelResult["stoppedAt"]): ChannelResult => ({
      path,
      method: flats ? "d8-accumulation" : "steepest-descent",
      complete: stoppedAt === "outlet",
      stoppedAt,
    });
    while (true) {
      if (visited.has(i)) return result("visited");
      visited.add(i);
      const x = i % n,
        y = Math.floor(i / n);
      path.push({ xM: (x + 0.5) * l, yM: (y + 0.5) * l });
      if (i === outlet) return result("outlet");
      if (x === 0 || y === 0 || x === n - 1 || y === n - 1) return result("boundary");
      const next = receiver(i, flats);
      if (next < 0) return result("pit");
      i = next;
    }
  }
  const primary = trace(false);
  if (primary.complete || request.fallback !== "d8-accumulation") return primary;
  const accumulation = new Float64Array(n * n).fill(1);
  const order = Array.from({ length: n * n }, (_, i) => i).sort((a, b) => z[b]! - z[a]! || b - a);
  for (const i of order) {
    const x = i % n,
      y = Math.floor(i / n);
    if (i === outlet || x === 0 || y === 0 || x === n - 1 || y === n - 1) continue;
    const j = receiver(i, true);
    if (j >= 0) accumulation[j] += accumulation[i]!;
  }
  return { ...trace(true), accumulation };
}

/** Cell-spaced sampling needs floor(length/l)+1 points; any shorter terminal remainder is omitted. */
export function channelLengthM(channel: ChannelResult): number {
  let length = 0;
  for (let i = 1; i < channel.path.length; i++)
    length += Math.hypot(
      channel.path[i]!.xM - channel.path[i - 1]!.xM,
      channel.path[i]!.yM - channel.path[i - 1]!.yM,
    );
  return length;
}

/** One-cell arc-length samples, omitting a terminal remainder shorter than one cell. */
export function sampleChannelProfile(snapshot: StateSnapshot, channel: ChannelResult): ProfileResult {
  const length = channelLengthM(channel),
    l = snapshot.metresPerCell;
  const count = Math.floor(length / l) + 1;
  if (count < 2) throw new RangeError("Channel must span at least one cell");
  const target = (count - 1) * l;
  const path: PointM[] = [channel.path[0]!];
  let distance = 0;
  for (let i = 1; i < channel.path.length; i++) {
    const a = channel.path[i - 1]!,
      b = channel.path[i]!;
    const segment = Math.hypot(b.xM - a.xM, b.yM - a.yM);
    if (distance + segment >= target) {
      const t = (target - distance) / segment;
      path.push({ xM: a.xM + t * (b.xM - a.xM), yM: a.yM + t * (b.yM - a.yM) });
      break;
    }
    path.push(b);
    distance += segment;
  }
  return sampleProfile(snapshot, { kind: "long-profile", path, samples: count });
}
