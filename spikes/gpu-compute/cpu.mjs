// Engineering fixture only, not an erosion model.
export const settings = { seed: 187, warmup: 10, steps: 80, repeats: 3, tolerance: 1e-5 };
export function initialState(n) {
  const a = new Float32Array(n * n * 4);
  let seed = settings.seed;
  for (let i = 0; i < a.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    a[i] = 0.1 + (seed / 4294967296) * 0.01;
    a[i + 3] = 0.02 + (seed / 4294967296) * 0.001;
  }
  return a;
}
export function createCpu(n) {
  let a = initialState(n),
    b = new Float32Array(a.length);
  return {
    snapshot: () => a.slice(),
    step(count) {
      for (let t = 0; t < count; t++)
        for (let s = 0; s < 5; s++) {
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
              const i = (y * n + x) * 4,
                l = x > 0 ? i - 4 : i,
                r = x < n - 1 ? i + 4 : i,
                u = y > 0 ? i - n * 4 : i,
                d = y < n - 1 ? i + n * 4 : i;
              b[i] = a[i];
              b[i + 1] = a[i + 1];
              b[i + 2] = a[i + 2];
              b[i + 3] = a[i + 3];
              if (s === 0) b[i] = a[i] + 0.0001;
              if (s === 1) {
                b[i] = Math.max(0, a[i] + 0.125 * (a[l] + a[r] + a[u] + a[d] - 4 * a[i]));
                b[i + 1] = (a[r] - a[l]) * 0.25;
                b[i + 2] = (a[d] - a[u]) * 0.25;
              }
              if (s === 2) {
                b[i + 1] = a[i + 1] / (1 + a[i]);
                b[i + 2] = a[i + 2] / (1 + a[i]);
              }
              if (s === 3)
                b[i + 3] = Math.max(
                  0,
                  a[i + 3] + 0.0625 * (a[l + 3] + a[r + 3] + a[u + 3] + a[d + 3] - 4 * a[i + 3]),
                );
              if (s === 4) b[i] = a[i] * 0.999;
            }
          [a, b] = [b, a];
        }
    },
  };
}
export function compare(a, b) {
  if (a.length !== b.length) throw new Error("State lengths differ");
  let error = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error("Non-finite state");
    error = Math.max(error, Math.abs(a[i] - b[i]));
  }
  return error;
}
export function bitwiseEqual(a, b) {
  const x = new Uint32Array(a.buffer, a.byteOffset, a.length),
    y = new Uint32Array(b.buffer, b.byteOffset, b.length);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}
export function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

export function fixedTreeSum(input) {
  let a = input.slice();
  for (let count = a.length / 4; count > 1; count /= 2) {
    const b = new Float32Array((count / 2) * 4);
    for (let i = 0; i < count / 2; i++)
      for (let lane = 0; lane < 4; lane++) b[i * 4 + lane] = a[i * 8 + lane] + a[i * 8 + 4 + lane];
    a = b;
  }
  return a;
}
