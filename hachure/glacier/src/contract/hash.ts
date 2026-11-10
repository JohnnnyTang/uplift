/**
 * State digest for determinism tests: two FNV-1a lanes over the step count and the raw bytes of the
 * Float64 bed and ice fields. Not cryptographic; detects any bit difference.
 */
const FNV_PRIME = 0x01000193;

function fnv1a(hash: number, bytes: Uint8Array): number {
  let h = hash;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

export function hashGlacierState(step: number, fields: readonly (Float64Array | Float32Array)[]): string {
  const header = new Uint8Array(new Float64Array([step, fields.length]).buffer);
  let a = fnv1a(0x811c9dc5, header);
  let b = fnv1a(0x050c5d1f, header);
  for (const field of fields) {
    const bytes = new Uint8Array(field.buffer, field.byteOffset, field.byteLength);
    a = fnv1a(a, bytes);
    b = fnv1a(b ^ 0x5bd1e995, bytes);
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
