/**
 * The construction sketch of a landscape block (D-W6-6H): pencil strokes that trace, in block space, the
 * form the block is about to take, in the order a draughtsman would construct it:
 *
 * ```
 * base       the footprint on the page (four edges)
 * upright    the four corner edges, from the page up
 * rim        the front section profile, the side rims, the back profile
 * section    lines on the front face (ice surface, crust base)
 * form       cross profiles of the surface, front to back
 * hachure    a few slope hachures
 * ```
 *
 * A presentation effect, not a process: the strokes are read from the block's current geometry (the same
 * grid and frame as the block's ink edges, so they stay registered with it) and never change it. Each
 * stroke carries the interval of the sketch (0–1) in which it is drawn; the stroke material reveals it from
 * one uniform, so drawing on costs no per-frame geometry. Plain typed arrays and no three.js, so it is
 * testable in Node. Deterministic: the hand-drawn wobble comes from a seeded generator, never
 * `Math.random()`.
 */
import { type BlockFrame, blockX, blockY, blockZ } from "./block-geometry";
import { sampleField } from "./dressing";
import type { BlockGrid } from "./snapshot";

export type SketchStrokeKind = "base" | "upright" | "rim" | "section" | "form" | "hachure";

/** Order in which the kinds are drawn. */
export const SKETCH_ORDER: readonly SketchStrokeKind[] = [
  "base",
  "upright",
  "rim",
  "section",
  "form",
  "hachure",
];

export interface SketchConfig {
  /** Seed of the hand-drawn wobble (unit: none). The same seed and block give the same sketch. */
  readonly seed: number;
  /** Cross profiles of the surface between the back and the front face (unit: count). */
  readonly crossProfiles: number;
  /** Most slope hachures drawn (unit: count). */
  readonly maxHachures: number;
  /** Wobble of a stroke off its true line (unit: cells). */
  readonly wobbleCells: number;
  /** How far a straight construction line runs past its corners (unit: fraction of its length). */
  readonly overshoot: number;
  /** Pencil stroke width (unit: CSS pixels). */
  readonly widthPx: number;
  /**
   * Share of the sketch spent on each kind of stroke (unit: none; normalised over the kinds present, so a
   * block without section lines or hachures gives their share to the others).
   */
  readonly share: Readonly<Record<SketchStrokeKind, number>>;
  /** Pause between two strokes, the pencil leaving the paper (unit: fraction of a stroke's time). */
  readonly penLift: number;
}

export const DEFAULT_SKETCH: SketchConfig = Object.freeze({
  seed: 20261116,
  crossProfiles: 5,
  maxHachures: 36,
  wobbleCells: 0.22,
  overshoot: 0.045,
  widthPx: 1,
  share: Object.freeze({ base: 0.2, upright: 0.14, rim: 0.3, section: 0.08, form: 0.18, hachure: 0.1 }),
  penLift: 0.18,
});

export interface SketchStroke {
  readonly kind: SketchStrokeKind;
  /** Block-local points as the stroke layers take them: `x, z, y` per point (unit: metres). */
  readonly points: number[];
  /** When the pencil reaches each point (unit: none, 0–1 of the sketch); increasing along the stroke. */
  readonly times: number[];
  readonly widthPx: number;
}

export interface SketchInput {
  /** Ice thinner than this is not drawn (unit: metres). */
  readonly iceThresholdM: number;
  /** Slope hachures as segments `a0, l0, a1, l1` in fractional cell coordinates (the block's own). */
  readonly hachures?: ArrayLike<number>;
  /** Extra lines on the front face, as `x, z, y` polylines (for example the crust base). */
  readonly sectionLines?: readonly ArrayLike<number>[];
}

/** A small seeded generator (mulberry32): [0, 1). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth noise in [−1, 1] at `n` points: random knots every few points, eased between. */
function wobble(n: number, random: () => number, knotEvery = 5): Float64Array {
  const out = new Float64Array(n);
  const knots = Math.max(2, Math.ceil((n - 1) / knotEvery) + 1);
  const k = Array.from({ length: knots }, () => random() * 2 - 1);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? (i / (n - 1)) * (knots - 1) : 0;
    const j = Math.min(knots - 2, Math.floor(u));
    const t = u - j;
    const e = t * t * (3 - 2 * t);
    out[i] = k[j]! * (1 - e) + k[j + 1]! * e;
  }
  return out;
}

/** The pencil's pace along a stroke: it starts and ends a little slower than it runs. */
const pace = (t: number) => 0.55 * t + 0.45 * t * t * (3 - 2 * t);

interface Draft {
  kind: SketchStrokeKind;
  points: number[];
  widthPx: number;
}

/**
 * The ordered construction strokes of the block `g` framed by `f`. Times are normalised so the first stroke
 * starts at 0 and the last ends at 1.
 */
export function buildSketch(
  g: BlockGrid,
  f: BlockFrame,
  input: SketchInput,
  config: Partial<SketchConfig> = {},
): SketchStroke[] {
  const cfg: SketchConfig = {
    ...DEFAULT_SKETCH,
    ...config,
    share: { ...DEFAULT_SKETCH.share, ...config.share },
  };
  const random = seededRandom(cfg.seed);
  const m = g.metresPerCell;
  const amp = cfg.wobbleCells * m;
  const last = f.cutRow;
  const right = g.across - 1;
  const bed = (a: number, l: number) => g.bedM[l * g.across + a]!;
  const surface = (a: number, l: number) => {
    const k = l * g.across + a;
    const ice = g.iceM[k]!;
    return g.bedM[k]! + (ice > input.iceThresholdM ? ice : 0);
  };
  const width = () => cfg.widthPx * (0.85 + 0.3 * random());
  const drafts: Draft[] = [];

  /** A straight construction line from p to q (block `x, y, z`), run past its ends and gently bowed. */
  const straight = (kind: SketchStrokeKind, p: readonly number[], q: readonly number[], steps = 7) => {
    const d = [q[0]! - p[0]!, q[1]! - p[1]!, q[2]! - p[2]!];
    const len = Math.hypot(d[0]!, d[1]!, d[2]!);
    if (!(len > 0)) return;
    // Wobble sideways: across the page for an upright, in the page plane for a line on the page.
    const vertical = Math.abs(d[1]!) > Math.hypot(d[0]!, d[2]!);
    const side = vertical ? [1, 0, 0] : [-d[2]! / len, 0, d[0]! / len];
    const from = -cfg.overshoot * (0.4 + 0.6 * random());
    const to = 1 + cfg.overshoot * (0.4 + 0.6 * random());
    const noise = wobble(steps + 1, random, 3);
    const pts: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const w = noise[i]! * amp * 0.6;
      // An upright starts on the page: it may run past the top corner, not below the paper.
      const y = Math.max(0, p[1]! + d[1]! * t + side[1]! * w);
      pts.push(p[0]! + d[0]! * t + side[0]! * w, p[2]! + d[2]! * t + side[2]! * w, y);
    }
    drafts.push({ kind, points: pts, widthPx: width() });
  };

  /** A line that follows the terrain: points `x, z, y`, wobbled a little in height. */
  const draped = (kind: SketchStrokeKind, pts: number[], heightWobble = 0.5) => {
    const n = pts.length / 3;
    if (n < 2) return;
    const noise = wobble(n, random);
    const out = pts.slice();
    for (let i = 0; i < n; i++)
      out[i * 3 + 2] = Math.max(0, out[i * 3 + 2]! + noise[i]! * amp * heightWobble);
    drafts.push({ kind, points: out, widthPx: width() });
  };

  const corner = (a: number, l: number, y = 0) => [blockX(f, a), y, blockZ(f, l)];
  // The footprint on the page: the front edge first (nearest the reader), the sides away from it, the back.
  straight("base", corner(0, last), corner(right, last));
  straight("base", corner(0, last), corner(0, 0));
  straight("base", corner(right, last), corner(right, 0));
  straight("base", corner(0, 0), corner(right, 0));
  // The corner edges, from the page up: front pair, then back pair.
  for (const [a, l] of [
    [0, last],
    [right, last],
    [right, 0],
    [0, 0],
  ] as const)
    straight("upright", corner(a, l), corner(a, l, blockY(f, bed(a, l))), 5);

  // The rim: the front section profile (the shape the lesson is about), the sides, then the back profile.
  const row = (l: number, height: (a: number, l: number) => number) => {
    const pts: number[] = [];
    for (let a = 0; a <= right; a++) pts.push(blockX(f, a), blockZ(f, l), blockY(f, height(a, l)));
    return pts;
  };
  const column = (a: number) => {
    const pts: number[] = [];
    for (let l = last; l >= 0; l--) pts.push(blockX(f, a), blockZ(f, l), blockY(f, bed(a, l)));
    return pts;
  };
  draped("rim", row(last, bed), 0.25);
  draped("rim", column(0), 0.25);
  draped("rim", column(right), 0.25);
  draped("rim", row(0, bed), 0.25);

  // Lines on the front face: the ice surface where the face cuts ice, then any the caller adds.
  let run: number[] = [];
  const closeRun = () => {
    if (run.length >= 6) draped("section", run, 0.2);
    run = [];
  };
  for (let a = 0; a <= right; a++) {
    if (g.iceM[last * g.across + a]! > input.iceThresholdM) {
      if (!run.length && a > 0) run.push(blockX(f, a - 1), blockZ(f, last), blockY(f, bed(a - 1, last)));
      run.push(blockX(f, a), blockZ(f, last), blockY(f, surface(a, last)));
    } else if (run.length) {
      run.push(blockX(f, a), blockZ(f, last), blockY(f, bed(a, last)));
      closeRun();
    }
  }
  closeRun();
  for (const line of input.sectionLines ?? []) draped("section", Array.from(line), 0.2);

  // Cross profiles of the visible surface, from the front face back.
  const rows = new Set<number>();
  for (let i = 1; i <= cfg.crossProfiles; i++) {
    const l = Math.round(last * (1 - i / (cfg.crossProfiles + 1)));
    if (l > 0 && l < last) rows.add(l);
  }
  for (const l of rows) draped("form", row(l, surface), 0.35);

  // A few slope hachures, evenly thinned from the block's own, back to front.
  const h = input.hachures;
  const total = h ? Math.floor(h.length / 4) : 0;
  const count = Math.min(Math.max(0, Math.floor(cfg.maxHachures)), total);
  for (let i = 0; i < count; i++) {
    const o = Math.floor(((i + 0.5) * total) / count) * 4;
    const [a0, l0, a1, l1] = [h![o]!, h![o + 1]!, h![o + 2]!, h![o + 3]!];
    if (Math.max(l0, l1) > last) continue;
    drafts.push({
      kind: "hachure",
      points: [
        blockX(f, a0),
        blockZ(f, l0),
        blockY(f, sampleField(g.bedM, g, a0, l0)) + m * 0.03,
        blockX(f, a1),
        blockZ(f, l1),
        blockY(f, sampleField(g.bedM, g, a1, l1)) + m * 0.03,
      ],
      widthPx: width() * 0.8,
    });
  }

  return schedule(drafts, cfg);
}

function strokeLength(points: readonly number[]): number {
  let len = 0;
  for (let i = 3; i < points.length; i += 3)
    len += Math.hypot(
      points[i]! - points[i - 3]!,
      points[i + 1]! - points[i - 2]!,
      points[i + 2]! - points[i - 1]!,
    );
  return len;
}

/** Gives every stroke its interval: kinds in order, each kind's share split by stroke length. */
function schedule(drafts: readonly Draft[], cfg: SketchConfig): SketchStroke[] {
  const kinds = SKETCH_ORDER.filter((kind) => drafts.some((d) => d.kind === kind));
  const shareSum = kinds.reduce((s, kind) => s + Math.max(0, cfg.share[kind]), 0) || 1;
  const out: SketchStroke[] = [];
  let t = 0;
  for (const kind of kinds) {
    const group = drafts.filter((d) => d.kind === kind);
    const span = Math.max(0, cfg.share[kind]) / shareSum;
    // A stroke's time grows with its length, but less than in proportion: short strokes are not instant.
    const weights = group.map((d) => Math.sqrt(Math.max(strokeLength(d.points), 1e-9)));
    const weightSum = weights.reduce((s, w) => s + w, 0);
    group.forEach((d, i) => {
      const slot = (span * weights[i]!) / weightSum;
      const start = t;
      const end = t + slot / (1 + cfg.penLift);
      t += slot;
      const len = strokeLength(d.points) || 1;
      const times: number[] = [start];
      let run = 0;
      for (let p = 3; p < d.points.length; p += 3) {
        run += Math.hypot(
          d.points[p]! - d.points[p - 3]!,
          d.points[p + 1]! - d.points[p - 2]!,
          d.points[p + 2]! - d.points[p - 1]!,
        );
        times.push(start + (end - start) * pace(Math.min(1, run / len)));
      }
      out.push({ kind: d.kind, points: d.points, times, widthPx: d.widthPx });
    });
  }
  // The last stroke ends the sketch exactly.
  const endT = out.length ? out.at(-1)!.times.at(-1)! : 1;
  if (endT > 0) for (const s of out) for (let i = 0; i < s.times.length; i++) s.times[i] = s.times[i]! / endT;
  return out;
}

/** Packed segments of a sketch, one entry per segment, as the stroke layer's instanced attributes. */
export interface PackedSketch {
  readonly count: number;
  readonly segPrev: Float32Array;
  readonly segStart: Float32Array;
  readonly segEnd: Float32Array;
  readonly segNext: Float32Array;
  readonly segWidth: Float32Array;
  /** Per segment: when the pencil starts and finishes it (unit: none, 0–1 of the sketch). */
  readonly segReveal: Float32Array;
}

/** Packs strokes into segment attributes (neighbour points for mitred joints, as `StrokeBuffer` does). */
export function packSketch(strokes: readonly SketchStroke[]): PackedSketch {
  const count = strokes.reduce((s, k) => s + Math.max(0, k.points.length / 3 - 1), 0);
  const packed = {
    count,
    segPrev: new Float32Array(count * 3),
    segStart: new Float32Array(count * 3),
    segEnd: new Float32Array(count * 3),
    segNext: new Float32Array(count * 3),
    segWidth: new Float32Array(count),
    segReveal: new Float32Array(count * 2),
  };
  let n = 0;
  for (const s of strokes) {
    const points = s.points.length / 3;
    const copy = (target: Float32Array, i: number) => {
      const p = Math.min(points - 1, Math.max(0, i)) * 3;
      target.set([s.points[p]!, s.points[p + 1]!, s.points[p + 2]!], n * 3);
    };
    for (let i = 0; i + 1 < points; i++, n++) {
      copy(packed.segPrev, i - 1);
      copy(packed.segStart, i);
      copy(packed.segEnd, i + 1);
      copy(packed.segNext, i + 2);
      packed.segWidth[n] = s.widthPx;
      packed.segReveal[n * 2] = s.times[i]!;
      packed.segReveal[n * 2 + 1] = s.times[i + 1]!;
    }
  }
  return packed;
}
