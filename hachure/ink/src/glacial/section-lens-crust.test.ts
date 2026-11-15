import { describe, expect, it } from "vitest";
import { PROVISIONAL_LITHOLOGIES } from "../materials/natural/lithology";
import { scaleBarLengthM, sectionLensSvg, sectionLensWindow } from "./section-lens";

// A front face across a range (D-W7-7B): 41 samples, 5 km apart; crust 35 km, a root under the range.
const n = 41;
const acrossM = Float64Array.from({ length: n }, (_, a) => a * 5000);
const startBedM = new Float64Array(n).fill(300);
const startCrustBaseM = Float64Array.from(startBedM, (z) => z - 35_000);
const ridge = (a: number) => Math.max(0, 1 - Math.abs(a - 20) / 8);
const bedM = Float64Array.from({ length: n }, (_, a) => 300 + 4000 * ridge(a));
const crustBaseM = Float64Array.from({ length: n }, (_, a) => -34_700 - 25_000 * ridge(a));
const look = PROVISIONAL_LITHOLOGIES[2]!;
const words = { start: "start", crust: "crust", mantle: "mantle" };

describe("section lens with a crust band", () => {
  const profile = { acrossM, bedM, startBedM, look, crustBaseM, startCrustBaseM };

  it("frames the whole face, down below the deepest crust base", () => {
    const w = sectionLensWindow(profile);
    expect(w.first).toBe(0);
    expect(w.last).toBe(n - 1);
    expect(w.topM).toBeGreaterThan(4300);
    expect(w.bottomM).toBeLessThan(Math.min(...crustBaseM));
  });

  it("draws the crust band, the mantle, the crust base and the starting crust base, with labels", () => {
    const svg = sectionLensSvg(profile, { words, verticalScale: 1, title: "Front face" });
    for (const cls of ["lens-crust", "lens-mantle", "lens-crust-base", "lens-bed", "lens-start", "lens-bar"])
      expect(svg).toContain(`class="${cls}"`);
    expect(svg).toContain('id="section-lens-crust"');
    expect(svg).toContain('id="section-lens-mantle"');
    // Two dashed starting profiles: the bed and the crust base.
    expect(svg.match(/class="lens-start"/g)!.length).toBe(2);
    expect(svg).toContain(">crust</text>");
    expect(svg).toContain(">mantle</text>");
    // The only number printed is still the scale bar, derived from the profile's metres.
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
    expect(texts.filter((t) => /\d/.test(t))).toEqual([`${scaleBarLengthM(acrossM[n - 1]!)} m`]);
    expect(sectionLensSvg(profile, { words, verticalScale: 1, title: "Front face" })).toBe(svg);
  });

  it("draws up to three comparison profiles, crust bases included, each with its own pattern and label", () => {
    const g = (dz: number, label: string) => ({
      bedM: Float64Array.from(bedM, (z) => z - dz),
      crustBaseM: Float64Array.from(crustBaseM, (z) => z + dz * 5),
      label,
    });
    const svg = sectionLensSvg(
      { ...profile, ghost: g(1000, "first"), ghosts: [g(2000, "second"), g(3000, "third")] },
      { words },
    );
    expect(svg.match(/class="lens-ghost"/g)!.length).toBe(2);
    expect(svg.match(/class="lens-ghost lens-ghost-1"/g)!.length).toBe(2);
    expect(svg.match(/class="lens-ghost lens-ghost-2"/g)!.length).toBe(2);
    expect(svg.match(/class="lens-ghost-halo"/g)!.length).toBe(6);
    for (const label of ["first", "second", "third"]) expect(svg).toContain(`>${label}</text>`);
    expect(svg).toContain(".lens-ghost-1{stroke-dasharray");
    expect(() =>
      sectionLensSvg({ ...profile, ghost: g(1, "a"), ghosts: [g(2, "b"), g(3, "c"), g(4, "d")] }, { words }),
    ).toThrow(RangeError);
  });

  it("without a crust base draws no crust pieces", () => {
    const svg = sectionLensSvg({ acrossM, bedM, startBedM, look }, { words });
    for (const cls of ["lens-crust", "lens-mantle", "lens-crust-base"])
      expect(svg).not.toContain(`class="${cls}"`);
    expect(svg).not.toContain("-crust");
    expect(svg).not.toContain(">crust</text>");
  });
});
