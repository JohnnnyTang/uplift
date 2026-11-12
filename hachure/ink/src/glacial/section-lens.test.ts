import { describe, expect, it } from "vitest";
import { PROVISIONAL_LITHOLOGIES } from "../materials/natural/lithology";
import { scaleBarLengthM, sectionLensSvg, sectionLensWindow } from "./section-lens";

const n = 64;
const mid = 31.5;
const acrossM = Float64Array.from({ length: n }, (_, a) => a * 40);
// A V between rims at 1620 m, outer flanks falling away beyond the rims; the floor lowered towards a U.
const startBedM = Float64Array.from({ length: n }, (_, a) => {
  const d = Math.abs(a - mid);
  return d < 11 ? 1400 + d * 20 : 1620 - (d - 11) * 8;
});
const bedM = Float64Array.from(startBedM, (z, a) =>
  Math.abs(a - mid) < 6 ? Math.min(z, 1360 + (a - mid) ** 2 * 2) : z,
);
const iceM = Float64Array.from(bedM, (z, a) => (Math.abs(a - mid) < 8 ? Math.max(0, 1550 - z) : 0));
// Thin ice on a ridge far from the valley must not stretch the window.
iceM[2] = 30;
const look = PROVISIONAL_LITHOLOGIES[1]!;
const profile = { acrossM, bedM, iceM, startBedM, look };

describe("section lens", () => {
  it("frames the starting valley between its rims and the valley glacier, not ridge ice", () => {
    const w = sectionLensWindow(profile);
    expect(w.first).toBeGreaterThan(15);
    expect(w.last).toBeLessThan(n - 15);
    expect(w.topM).toBeLessThan(1700);
    expect(w.bottomM).toBeLessThan(Math.min(...bedM));
  });

  it("draws the bed, the dashed start, the dotted kept run with its label, and a scale bar from the metres", () => {
    const ghost = { bedM: Float64Array.from(bedM, (z) => z - 20), label: "shale run" };
    const options = {
      words: { start: "starting V", ice: "ice" },
      verticalScale: 2,
      title: "Front face, enlarged",
    };
    const svg = sectionLensSvg({ ...profile, ghost }, options);
    for (const cls of ["lens-bed", "lens-start", "lens-ghost", "lens-ice", "lens-rock-pattern", "lens-bar"])
      expect(svg).toContain(`class="${cls}"`);
    expect(svg).toContain("shale run");
    expect(svg).toContain("starting V");
    expect(svg).toContain('role="img"');
    // The only number printed is the scale bar, derived from the profile's metres.
    const w = sectionLensWindow({ ...profile, ghost });
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
    expect(texts.filter((t) => /\d/.test(t))).toEqual([
      `${scaleBarLengthM(acrossM[w.last]! - acrossM[w.first]!)} m`,
    ]);
    expect(sectionLensSvg({ ...profile, ghost }, options)).toBe(svg);
  });

  it("picks round scale-bar lengths", () => {
    expect(scaleBarLengthM(1000)).toBe(200);
    expect(scaleBarLengthM(450)).toBe(100);
    expect(scaleBarLengthM(90)).toBe(20);
  });
});
