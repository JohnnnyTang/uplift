import { describe, expect, it } from "vitest";
import { createRng, createRngFromState, deriveSeed, seedState } from "./index";

describe("xoshiro128**", () => {
  it("matches the reference sequence for state [1, 2, 3, 4]", () => {
    // Worked by hand from the reference C code (prng.di.unimi.it/xoshiro128starstar.c):
    // out = rotl(s1 × 5, 7) × 9, so the first output is rotl(10, 7) × 9 = 11520.
    const rng = createRngFromState([1, 2, 3, 4]);
    expect([rng.nextUint32(), rng.nextUint32(), rng.nextUint32(), rng.nextUint32()]).toEqual([
      11520, 0, 5927040, 70819200,
    ]);
  });

  it("gives the same sequence for the same seed and different ones for different seeds", () => {
    const draw = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 64 }, () => rng.nextUint32());
    };
    expect(draw(1)).toEqual(draw(1));
    expect(draw(1)).not.toEqual(draw(2));
    expect(draw(0)).not.toEqual(draw(0xffff_ffff));
  });

  it("resumes exactly from a saved state", () => {
    const a = createRng(17);
    for (let i = 0; i < 10; i++) a.nextUint32();
    const b = createRngFromState(a.getState());
    for (let i = 0; i < 100; i++) expect(b.nextUint32()).toBe(a.nextUint32());
  });

  it("returns values in range, with a plausible mean", () => {
    const rng = createRng(101);
    let sum = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const u = rng.nextUint32();
      expect(Number.isInteger(u) && u >= 0 && u < 2 ** 32).toBe(true);
      const f = rng.nextFloat();
      expect(f >= 0 && f < 1).toBe(true);
      const r = rng.nextRange(-2, 3);
      expect(r >= -2 && r < 3).toBe(true);
      const k = rng.nextInt(7);
      expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
      sum += f;
    }
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.01);
  });

  it("nextInt covers every residue roughly equally", () => {
    const rng = createRng(5);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[rng.nextInt(6)]!++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it("rejects bad seeds, states and bounds", () => {
    expect(() => createRng(-1)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
    expect(() => createRng(2 ** 32)).toThrow(RangeError);
    expect(() => createRngFromState([0, 0, 0, 0])).toThrow(RangeError);
    expect(() => createRng(1).nextInt(0)).toThrow(RangeError);
  });

  it("never seeds an all-zero state", () => {
    for (const seed of [0, 1, 2, 0x9e3779b9, 0xffff_ffff]) {
      expect(seedState(seed).some((w) => w !== 0)).toBe(true);
    }
  });
});

describe("deriveSeed", () => {
  it("is deterministic, depends on both seed and label, and stays a u32", () => {
    expect(deriveSeed(1, "noise")).toBe(deriveSeed(1, "noise"));
    expect(deriveSeed(1, "noise")).not.toBe(deriveSeed(2, "noise"));
    expect(deriveSeed(1, "noise")).not.toBe(deriveSeed(1, "bands"));
    for (const seed of [0, 1, 0xffff_ffff]) {
      const s = deriveSeed(seed, "x");
      expect(Number.isInteger(s) && s >= 0 && s <= 0xffff_ffff).toBe(true);
    }
  });
});
