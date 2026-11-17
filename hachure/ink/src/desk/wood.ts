/**
 * A procedural, tileable wood texture for a desk top: planks running left to right, each with its own tone,
 * long grain lines, broad figure and pores. Seeded and deterministic (no `Math.random()`); the same seed
 * always paints the same boards. Every line closes on itself across the tile's width, so the tile repeats
 * without a seam.
 *
 * `paintWood` draws through a small subset of the Canvas 2D API, so it is tested in Node with a recorder.
 */

/** A small seeded generator (mulberry32). Returns values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WoodLook {
  /** Planks per tile (unit: count). */
  readonly planks: number;
  /** Mid tone of the timber as sRGB 0–255. */
  readonly base: readonly [number, number, number];
  /** Dark grain and seams as sRGB 0–255. */
  readonly dark: readonly [number, number, number];
  /** Light grain as sRGB 0–255. */
  readonly light: readonly [number, number, number];
  /** How much one plank's tone may differ from the mid tone (unit: fraction, 0–1). */
  readonly plankVariation: number;
}

/** Oiled walnut: mid-dark and warm, so cream paper stays the brightest thing on the desk. */
export const WALNUT: WoodLook = {
  planks: 5,
  base: [118, 82, 54],
  dark: [44, 26, 14],
  light: [196, 150, 104],
  plankVariation: 0.09,
};

/** The Canvas 2D calls the painter needs. */
export type WoodContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "fillRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
  | "save"
  | "restore"
  | "rect"
  | "clip"
>;

const rgba = (c: readonly [number, number, number], alpha: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(3)})`;

/** Paints one tile of `widthPx` × `heightPx` (unit: canvas pixels). */
export function paintWood(
  ctx: WoodContext,
  widthPx: number,
  heightPx: number,
  seed: number,
  look: WoodLook = WALNUT,
): void {
  const random = seededRandom(seed);
  const plankHeight = heightPx / look.planks;
  const unit = heightPx / 800;
  const TAU = Math.PI * 2;
  /** A line across the whole tile whose ends meet (whole numbers of waves). */
  const wave = (y0: number, amplitude: number) => {
    const k1 = 1 + Math.floor(random() * 3);
    const k2 = 3 + Math.floor(random() * 5);
    const p1 = random() * TAU;
    const p2 = random() * TAU;
    const a2 = amplitude * (0.15 + random() * 0.3);
    ctx.beginPath();
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = y0 + amplitude * Math.sin(TAU * k1 * u + p1) + a2 * Math.sin(TAU * k2 * u + p2);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(u * widthPx, y);
    }
    ctx.stroke();
  };
  for (let p = 0; p < look.planks; p++) {
    const top = p * plankHeight;
    const tone = 1 + (random() * 2 - 1) * look.plankVariation;
    const warm = (random() * 2 - 1) * 5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, widthPx, plankHeight);
    ctx.clip();
    ctx.fillStyle = rgba([look.base[0] * tone + warm, look.base[1] * tone, look.base[2] * tone - warm], 1);
    ctx.fillRect(0, top, widthPx, plankHeight);
    // Broad figure: slow tonal bands along the board.
    for (let i = 0; i < 7; i++) {
      ctx.lineWidth = (10 + random() * 26) * unit;
      ctx.strokeStyle = rgba(random() < 0.5 ? look.dark : look.light, 0.035 + random() * 0.05);
      wave(top + random() * plankHeight, (4 + random() * 12) * unit);
    }
    // Grain: many fine lines, mostly dark, sharing a gentle drift.
    for (let i = 0; i < 64; i++) {
      ctx.lineWidth = (0.6 + random() * 1.5) * unit;
      ctx.strokeStyle = rgba(random() < 0.72 ? look.dark : look.light, 0.05 + random() * 0.14);
      wave(top + random() * plankHeight, (1.5 + random() * 6) * unit);
    }
    // Pores: short dark dashes along the grain.
    ctx.strokeStyle = rgba(look.dark, 0.2);
    ctx.lineWidth = 0.8 * unit;
    for (let i = 0; i < 260; i++) {
      const x = random() * widthPx;
      const y = top + random() * plankHeight;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (5 + random() * 16) * unit, y + (random() - 0.5) * unit);
      ctx.stroke();
    }
    // The end joint between two boards of this row, and the seam along its upper edge.
    const joint = random() * widthPx;
    ctx.fillStyle = rgba(look.dark, 0.62);
    ctx.fillRect(joint, top, 1.6 * unit, plankHeight);
    ctx.fillStyle = rgba(look.light, 0.1);
    ctx.fillRect(joint + 1.6 * unit, top, 1 * unit, plankHeight);
    ctx.fillStyle = rgba(look.dark, 0.66);
    ctx.fillRect(0, top, widthPx, 1.8 * unit);
    ctx.fillStyle = rgba(look.light, 0.12);
    ctx.fillRect(0, top + 1.8 * unit, widthPx, 1.1 * unit);
    ctx.restore();
  }
}

/** Tile size in canvas pixels; shown at `WOOD_TILE_CSS` so one plank is about a hand wide beside the book. */
export const WOOD_TILE_PX = { width: 1280, height: 800 } as const;

const tiles = new Map<string, Promise<string | null>>();

/**
 * An object URL of the wood tile for this seed, painted once per page and shared. Resolves to `null` where
 * no 2D canvas is available; callers then keep their plain desk colour.
 */
export function woodTextureUrl(seed = 7, look: WoodLook = WALNUT): Promise<string | null> {
  const key = `${seed}:${JSON.stringify(look)}`;
  let tile = tiles.get(key);
  if (!tile) {
    tile = new Promise<string | null>((resolve) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = WOOD_TILE_PX.width;
        canvas.height = WOOD_TILE_PX.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        paintWood(ctx, canvas.width, canvas.height, seed, look);
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png");
      } catch {
        resolve(null);
      }
    });
    tiles.set(key, tile);
  }
  return tile;
}
