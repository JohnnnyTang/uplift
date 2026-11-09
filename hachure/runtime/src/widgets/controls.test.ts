import { describe, expect, it } from "vitest";
import { clampRange } from "./controls";
import { BOOK_PALETTE } from "./notes";
describe("reader control clamps", () => {
  const spec = { min: 0.25, max: 4, step: 0.25 };
  it("clamps ends and snaps to supported increments", () => {
    expect(clampRange(-100, spec)).toBe(0.25);
    expect(clampRange(100, spec)).toBe(4);
    expect(clampRange(1.37, spec)).toBe(1.25);
    expect(clampRange(100, { min: 0, max: 1, step: 0.6 })).toBe(0.6);
  });
  it("rejects non-finite inputs and invalid ranges", () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(() => clampRange(value, spec)).toThrow(RangeError);
    expect(() => clampRange(1, { ...spec, step: 0 })).toThrow(RangeError);
    expect(() => clampRange(1, { ...spec, min: 5 })).toThrow(RangeError);
  });
});
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
describe("reconciled palette contrast on paper", () => {
  for (const token of ["ink", "secondary", "water", "sediment"] as const) {
    it(`${token} supports normal-sized text`, () => {
      expect(
        (luminance(BOOK_PALETTE.paper) + 0.05) / (luminance(BOOK_PALETTE[token]) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
