/**
 * The state digest every backend uses for `TerrainSolver.hash()`, so hashes are comparable across
 * backends and runs. It covers the step count and the raw bytes of every layer, in `TERRAIN_LAYERS` order.
 * Not cryptographic: it detects any bit difference, which is all determinism tests need.
 */
import { TERRAIN_LAYERS } from "./state";
import type { StateSnapshot } from "./solver";

const FNV_PRIME = 0x01000193;

function fnv1a(hash: number, bytes: Uint8Array): number {
  let h = hash;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/**
 * 64-bit digest as 16 hex characters (two independent 32-bit FNV-1a lanes). Throws if the snapshot is
 * missing a layer, because a partial hash would silently pass determinism tests.
 */
export function hashSnapshot(snapshot: Pick<StateSnapshot, "step" | "gridSize" | "layers">): string {
  const header = new Uint8Array(new Float64Array([snapshot.step, snapshot.gridSize]).buffer);
  let a = fnv1a(0x811c9dc5, header);
  let b = fnv1a(0x050c5d1f, header);
  for (const name of TERRAIN_LAYERS) {
    const layer = snapshot.layers[name];
    if (!layer) throw new Error(`hashSnapshot needs every layer; "${name}" is missing`);
    const bytes = new Uint8Array(layer.buffer, layer.byteOffset, layer.byteLength);
    a = fnv1a(a, bytes);
    b = fnv1a(b ^ 0x5bd1e995, bytes);
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
