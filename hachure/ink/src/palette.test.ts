import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHANNELS,
  INK_TOKENS,
  channelOpacity,
  hexToRgb,
  legendSwatchSvg,
  legendTokens,
  linearToSrgb,
  overlayOnPaper,
  resolveChannels,
  srgbToLinear,
} from "./palette";

type Rgb = readonly [number, number, number];

/**
 * Machado, Oliveira and Fernandes (2009), full-severity simulation matrices, applied in linear RGB
 * (https://doi.org/10.1109/TVCG.2009.113). The same matrices the 1C spike used.
 */
const CVD: Record<string, readonly Rgb[] | null> = {
  normal: null,
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(srgb: Rgb, matrix: readonly Rgb[] | null): Rgb {
  if (!matrix) return srgb;
  const l = srgb.map(srgbToLinear);
  return matrix.map((row) =>
    linearToSrgb(Math.min(1, Math.max(0, row[0] * l[0]! + row[1] * l[1]! + row[2] * l[2]!))),
  ) as unknown as Rgb;
}

/** CIE L*a*b* (D65) from sRGB. */
function lab(srgb: Rgb): Rgb {
  const [r, g, b] = srgb.map(srgbToLinear) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const deltaE = (a: Rgb, b: Rgb) => {
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

function relativeLuminance(srgb: Rgb): number {
  const [r, g, b] = srgb.map(srgbToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("palette", () => {
  it("keeps water and sediment distinct from each other and from paper under colour-vision deficiency", () => {
    const paper = hexToRgb(INK_TOKENS.paper);
    const water = overlayOnPaper(INK_TOKENS.water, DEFAULT_CHANNELS.water.maxOpacity);
    const sediment = overlayOnPaper(INK_TOKENS.sediment, DEFAULT_CHANNELS.sediment.maxOpacity);
    for (const [vision, matrix] of Object.entries(CVD)) {
      const w = simulate(water, matrix);
      const s = simulate(sediment, matrix);
      const p = simulate(paper, matrix);
      // CIE76 ΔE: about 2 is a just-noticeable difference; these margins are far above it.
      expect(deltaE(w, s), `${vision}: water vs sediment`).toBeGreaterThan(20);
      expect(deltaE(w, p), `${vision}: water vs paper`).toBeGreaterThan(20);
      expect(deltaE(s, p), `${vision}: sediment vs paper`).toBeGreaterThan(20);
    }
  });

  it("gives ink on paper at least WCAG AAA contrast", () => {
    const ink = relativeLuminance(hexToRgb(INK_TOKENS.ink));
    const paper = relativeLuminance(hexToRgb(INK_TOKENS.paper));
    expect((paper + 0.05) / (ink + 0.05)).toBeGreaterThan(7);
  });

  it("maps a layer value to opacity: zero below the visible threshold, linear, then capped", () => {
    const ramp = DEFAULT_CHANNELS.water;
    expect(channelOpacity(ramp, 0)).toBe(0);
    expect(channelOpacity(ramp, ramp.visibleFromM)).toBe(0);
    expect(channelOpacity(ramp, Number.NaN)).toBe(0);
    const mid = (ramp.visibleFromM + ramp.fullAtM) / 2;
    expect(channelOpacity(ramp, mid)).toBeCloseTo(ramp.maxOpacity / 2, 12);
    expect(channelOpacity(ramp, ramp.fullAtM * 10)).toBe(ramp.maxOpacity);
  });

  it("builds legend tokens from the live channel settings", () => {
    const channels = resolveChannels({ sediment: { layer: "sedimentM", fullAtM: 0.5 } });
    const [water, sediment] = legendTokens(channels);
    expect(water).toMatchObject({ id: "water", label: "Water depth", layer: "waterM", pattern: "solid" });
    expect(sediment).toMatchObject({
      id: "sediment",
      label: "Loose sediment",
      fullAtM: 0.5,
      pattern: "stripes",
    });
    expect(legendSwatchSvg(sediment!)).toContain(INK_TOKENS.sediment);
    expect(legendSwatchSvg(water!)).toContain('aria-hidden="true"');
    expect(() => resolveChannels({ water: { fullAtM: 0 } })).toThrow(RangeError);
  });

  it("round-trips sRGB through linear light", () => {
    for (const c of [0, 0.02, 0.2, 0.5, 1]) expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 12);
    expect(overlayOnPaper(INK_TOKENS.water, 0)).toEqual(
      hexToRgb(INK_TOKENS.paper).map((c) => linearToSrgb(srgbToLinear(c))),
    );
  });
});
