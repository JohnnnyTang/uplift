/**
 * Seeded pseudo-random numbers for the terrain engine.
 *
 * Every random choice in `@hachure/terrain` goes through this module, so a seed reproduces a run bit for bit
 * (AGENTS.md, "Determinism"; handoff, "Stochastic models use a seeded random generator"). `Math.random()` is
 * banned in this package by ESLint.
 *
 * The generator is xoshiro128** 1.1 (Blackman and Vigna, https://prng.di.unimi.it/xoshiro128starstar.c):
 * 128 bits of state, period 2^128 − 1, pure 32-bit integer arithmetic, so it gives the same sequence on
 * every JavaScript engine. Its state is expanded from a 32-bit seed with SplitMix32, as the authors
 * recommend for seeding from a smaller value.
 */

/** The four 32-bit words of xoshiro128** state, each an unsigned integer. Never all zero. */
export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Next unsigned 32-bit integer, uniform on [0, 2^32). */
  nextUint32(): number;
  /** Next float, uniform on [0, 1), with 32 bits of resolution. */
  nextFloat(): number;
  /** Next float, uniform on [min, max). */
  nextRange(min: number, max: number): number;
  /** Next integer, uniform on [0, maxExclusive), without modulo bias. `maxExclusive` is 1 to 2^32. */
  nextInt(maxExclusive: number): number;
  /** A copy of the current state, for saving a run and resuming it with `createRngFromState`. */
  getState(): RngState;
}

const TWO_POW_32 = 0x1_0000_0000;

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError(`seed must be an unsigned 32-bit integer, got ${seed}`);
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** MurmurHash3's 32-bit finaliser: a bijective avalanche mix. */
function fmix32(h: number): number {
  let x = h;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

class Xoshiro128StarStar implements Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  nextUint32(): number {
    const s0 = this.a;
    const s1 = this.b;
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    let c = this.c ^ s0;
    const d = this.d ^ s1;
    this.b = s1 ^ c;
    this.a = s0 ^ d;
    c ^= t;
    this.c = c;
    this.d = rotl(d, 11);
    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / TWO_POW_32;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.nextFloat();
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO_POW_32) {
      throw new RangeError(`nextInt needs an integer in [1, 2^32], got ${maxExclusive}`);
    }
    // Reject the top partial block of 2^32 so every residue is equally likely.
    const limit = TWO_POW_32 - (TWO_POW_32 % maxExclusive);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return x % maxExclusive;
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }
}

/** Expands a 32-bit seed into a non-zero xoshiro128** state with SplitMix32. */
export function seedState(seed: number): RngState {
  assertSeed(seed);
  let s = seed | 0;
  const words: number[] = [];
  for (let i = 0; i < 4; i++) {
    s = (s + 0x9e3779b9) | 0;
    words.push(fmix32(s));
  }
  // SplitMix32 cannot return four zeros in a row, but keep the invariant explicit.
  if (!words.some((w) => w !== 0)) words[0] = 1;
  return [words[0]!, words[1]!, words[2]!, words[3]!];
}

/** A generator seeded from an unsigned 32-bit integer. The same seed always gives the same sequence. */
export function createRng(seed: number): Rng {
  return new Xoshiro128StarStar(seedState(seed));
}

/** Resumes a generator from a saved state (see `Rng.getState`). */
export function createRngFromState(state: RngState): Rng {
  if (
    state.length !== 4 ||
    !state.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff_ffff) ||
    state.every((w) => w === 0)
  ) {
    throw new RangeError("RngState must be four unsigned 32-bit integers, not all zero");
  }
  return new Xoshiro128StarStar(state);
}

/**
 * Derives an independent sub-seed from a run seed and a stream label, for example
 * `deriveSeed(config.seed, "tilted-plateau/noise")`. Separate labels give uncorrelated streams, so adding a
 * new random draw in one place never shifts the numbers drawn somewhere else.
 */
export function deriveSeed(seed: number, label: string): number {
  assertSeed(seed);
  let h = 0x811c9dc5; // FNV-1a over UTF-16 code units
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32((h ^ fmix32(seed + 0x9e3779b9)) >>> 0);
}
