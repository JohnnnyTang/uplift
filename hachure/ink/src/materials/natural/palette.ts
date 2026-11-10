/**
 * Natural material colours for illustrative landscape scenes (owner decision 3, 2026-11-09): rock, soil,
 * meadow, forest, snow, ice and water in poster-like natural colours, not a data ramp. None of these
 * colours encodes a measured quantity, so none needs a numeric legend; categories that matter for the
 * lesson (rock type) carry a lithology pattern as their non-colour cue.
 *
 * Values are sRGB hex. Each pair is a lit tone and a shade tone; the cel shader picks between them in
 * bands rather than blending smoothly, which keeps the look illustrative.
 */
export const NATURAL_TOKENS = Object.freeze({
  /** Paper the scene stands on; the colour wash starts from it. Same value as INK_TOKENS.paper. */
  paper: "#FAF8F2",
  /** Ink outlines and hachures. Same value as INK_TOKENS.ink. */
  ink: "#292B2C",
  /** Exposed rock on the land surface, before the rock type tints it. */
  weatheredRock: "#9AA2A6",
  snow: "#F4F6F6",
  snowShade: "#C7D3DA",
  /** Glacier surface: pale blue. */
  ice: "#C4E0EC",
  iceShade: "#93BED6",
  /** Glacier ice seen in section on the cut face: a touch deeper than the surface. */
  iceSection: "#A9D0E4",
  /** Flow marks on the ice surface. */
  iceFlow: "#6E9AB6",
  meltwater: "#3A8BC2",
  meadow: "#9CB86C",
  meadowShade: "#7A9A50",
  conifer: "#2E5C3D",
  coniferShade: "#1E412C",
  soil: "#8A6A48",
  /** Contact shadow on the paper (multiplied with low opacity). */
  shadow: "#3B3A36",
});

export type NaturalToken = keyof typeof NATURAL_TOKENS;
