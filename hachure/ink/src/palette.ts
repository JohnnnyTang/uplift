/**
 * Palette and line tokens for the ink look, and the two quantity channels (water, sediment).
 *
 * Values come from the 1C spike (D-1C): paper and ink, plus one colour per quantity taught. Colour appears
 * only where a state layer has a value; there are no decorative gradients or glow. The sediment channel
 * also carries an interrupted stripe pattern, so it stays distinct from water without colour vision.
 * 2E reconciles these with the book tokens; the renderer reads them from here.
 */
import type { LayerName } from "@hachure/terrain";

export const INK_TOKENS = Object.freeze({
  /** Flat untextured page, canvas clear colour and terrain fill. */
  paper: "#FAF8F2",
  /** Contours, hachures, the terrain edge, text. */
  ink: "#292B2C",
  /** Water channel (Okabe–Ito blue). */
  water: "#0072B2",
  /** Sediment channel (ochre, darkened Okabe–Ito orange). */
  sediment: "#B57900",
  /** Ordinary contour stroke (unit: CSS pixels). */
  contourWidthPx: 0.9,
  /** Index contour stroke, and the terrain edge (unit: CSS pixels). */
  indexContourWidthPx: 1.65,
  /** Hachure stroke (unit: CSS pixels). */
  hachureWidthPx: 0.85,
  /** Period of the interrupted sediment stripes (unit: CSS pixels). */
  sedimentStripePeriodPx: 6,
});

export type ChannelId = "water" | "sediment";
export type ChannelPattern = "solid" | "stripes";

/**
 * How one state layer becomes colour. Opacity rises linearly from 0 at `visibleFromM` to `maxOpacity` at
 * `fullAtM` and stays there; it is 0 below `visibleFromM`. These are display settings, not science, and a
 * page that shows the legend binds `visibleFromM` and `fullAtM` rather than typing them.
 */
export interface ChannelRamp {
  readonly id: ChannelId;
  /** The snapshot layer this channel shows. */
  readonly layer: LayerName;
  readonly colour: string;
  readonly pattern: ChannelPattern;
  /** Opacity at and above `fullAtM` (unit: none, 0–1). */
  readonly maxOpacity: number;
  /** Values at or below this are not drawn (unit: metres). */
  readonly visibleFromM: number;
  /** Values at or above this are drawn at `maxOpacity` (unit: metres). */
  readonly fullAtM: number;
}

export interface ChannelConfig {
  readonly water: ChannelRamp;
  readonly sediment: ChannelRamp;
}

/** Default channels: water depth in blue, suspended sediment in striped ochre. Display settings only. */
export const DEFAULT_CHANNELS: ChannelConfig = Object.freeze({
  water: Object.freeze({
    id: "water",
    layer: "waterM",
    colour: INK_TOKENS.water,
    pattern: "solid",
    maxOpacity: 0.48,
    visibleFromM: 0.005,
    fullAtM: 0.5,
  }),
  sediment: Object.freeze({
    id: "sediment",
    layer: "suspendedSedimentM",
    colour: INK_TOKENS.sediment,
    pattern: "stripes",
    maxOpacity: 0.55,
    visibleFromM: 0.0005,
    fullAtM: 0.02,
  }),
});

/** Merges partial channel settings over the defaults and checks them. */
export function resolveChannels(
  overrides: { readonly water?: Partial<ChannelRamp>; readonly sediment?: Partial<ChannelRamp> } = {},
): ChannelConfig {
  const water = { ...DEFAULT_CHANNELS.water, ...overrides.water, id: "water" as const };
  const sediment = { ...DEFAULT_CHANNELS.sediment, ...overrides.sediment, id: "sediment" as const };
  for (const ramp of [water, sediment]) {
    if (!(ramp.fullAtM > ramp.visibleFromM && ramp.visibleFromM >= 0)) {
      throw new RangeError(`${ramp.id} channel needs 0 ≤ visibleFromM < fullAtM`);
    }
    if (!(ramp.maxOpacity >= 0 && ramp.maxOpacity <= 1)) {
      throw new RangeError(`${ramp.id} channel maxOpacity must be in [0, 1]`);
    }
  }
  return Object.freeze({ water: Object.freeze(water), sediment: Object.freeze(sediment) });
}

/** Opacity of a channel for one value. The terrain shader computes exactly this. */
export function channelOpacity(ramp: ChannelRamp, valueM: number): number {
  if (!(valueM > ramp.visibleFromM)) return 0;
  const t = Math.min(1, (valueM - ramp.visibleFromM) / (ramp.fullAtM - ramp.visibleFromM));
  return t * ramp.maxOpacity;
}

/** One legend entry. Labels are defaults; a spread may replace them with its own level text. */
export interface LegendToken {
  readonly id: ChannelId;
  readonly label: string;
  readonly layer: LayerName;
  /** Unit of `visibleFromM` and `fullAtM`. */
  readonly unit: "m";
  readonly colour: string;
  readonly pattern: ChannelPattern;
  readonly maxOpacity: number;
  readonly visibleFromM: number;
  readonly fullAtM: number;
}

const DEFAULT_LABELS: Readonly<Record<ChannelId, Partial<Record<LayerName, string>>>> = {
  water: { waterM: "Water depth" },
  sediment: { suspendedSedimentM: "Sediment in transport", sedimentM: "Loose sediment" },
};

/** Legend entries for the current channels, in drawing order (water under sediment). */
export function legendTokens(channels: ChannelConfig = DEFAULT_CHANNELS): LegendToken[] {
  return [channels.water, channels.sediment].map((ramp) => ({
    id: ramp.id,
    label: DEFAULT_LABELS[ramp.id][ramp.layer] ?? ramp.layer,
    layer: ramp.layer,
    unit: "m",
    colour: ramp.colour,
    pattern: ramp.pattern,
    maxOpacity: ramp.maxOpacity,
    visibleFromM: ramp.visibleFromM,
    fullAtM: ramp.fullAtM,
  }));
}

/**
 * A legend swatch as an SVG string: the channel colour at full opacity over paper, with the same stripe
 * pattern the terrain uses. Decorative (`aria-hidden`); the legend label carries the meaning.
 */
export function legendSwatchSvg(token: LegendToken, sizePx = 16): string {
  const s = sizePx;
  const fill = `<rect width="${s}" height="${s}" fill="${INK_TOKENS.paper}"/>`;
  const frame = `<rect x="0.5" y="0.5" width="${s - 1}" height="${s - 1}" fill="none" stroke="${INK_TOKENS.ink}" stroke-width="1"/>`;
  let body: string;
  if (token.pattern === "stripes") {
    const p = INK_TOKENS.sedimentStripePeriodPx;
    const stripes: string[] = [];
    for (let k = -s; k < 2 * s; k += p) {
      stripes.push(`<path d="M${k} ${s}L${k + s} 0" stroke-width="${p / 2}"/>`);
    }
    body = `<g stroke="${token.colour}" stroke-opacity="${token.maxOpacity}">${stripes.join("")}</g>`;
  } else {
    body = `<rect width="${s}" height="${s}" fill="${token.colour}" fill-opacity="${token.maxOpacity}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">${fill}${body}${frame}</svg>`;
}

/** Parses `#rrggbb` into sRGB components in [0, 1]. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`);
  const v = parseInt(m[1]!, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** sRGB component to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear light to sRGB component. */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * The colour a channel produces over paper at a given opacity, in sRGB [0, 1]. Mixes in linear light, as
 * the renderer does (three's working colour space is linear sRGB).
 */
export function overlayOnPaper(colour: string, opacity: number): [number, number, number] {
  const paper = hexToRgb(INK_TOKENS.paper).map(srgbToLinear);
  const c = hexToRgb(colour).map(srgbToLinear);
  return [0, 1, 2].map((i) => linearToSrgb(paper[i]! + (c[i]! - paper[i]!) * opacity)) as [
    number,
    number,
    number,
  ];
}
