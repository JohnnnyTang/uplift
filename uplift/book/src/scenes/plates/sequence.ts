/**
 * Lesson 2's authored-sequence source (7B's `createAuthoredSequence`) over 7C's boundary relief. One source
 * per book: it lives in the spread controller, so boundary, stage and ghosts survive page turns.
 *
 * Frames are quantised to `1 / STAGE_STEPS` of the stage and memoised (a small LRU), so continuous play
 * rebuilds the block at most `STAGE_STEPS` times from early to late, scrubbing back over a stretch reuses
 * frames, and a ghost at the shown stage costs nothing extra once drawn. Quantising is deterministic (the
 * same stage always gives the same frame) and fine enough that the sequence reads as continuous; the source's
 * own stage, which the page reads, is never rounded.
 */
import { type AuthoredSequenceSource, createAuthoredSequence } from "@hachure/runtime";
import type { LandscapeSnapshot } from "@hachure/ink/stage";
import { PLATE_BOUNDARIES, type PlateBoundary, type PlatesRelief, createPlatesRelief } from "./relief/index";

/** Frames per sequence from early to late (unit: count). The scrubber steps by the same amount. */
export const STAGE_STEPS = 100;
/** Early → late in this many view seconds while playing (unit: s). */
export const PLAY_SECONDS = 12;
/** Reduced-motion stops (unit: count, 3–5): 0, ¼, ½, ¾, 1. */
export const REDUCED_MOTION_STOPS = 5;
/** Frames kept in memory across all boundaries (unit: count; one frame is about 0.4 MB). */
const MEMO_FRAMES = 48;

export const quantiseStage = (stage: number): number => Math.round(stage * STAGE_STEPS) / STAGE_STEPS;

export interface PlatesSequence {
  readonly relief: PlatesRelief;
  readonly source: AuthoredSequenceSource<LandscapeSnapshot>;
  /** The shared starting landscape (stage 0 of every boundary). */
  readonly start: LandscapeSnapshot;
  /** Frames generated so far (for tests and the perf note). */
  generated(): number;
  /**
   * Generates and keeps the frame of `boundary` at `stage` ahead of time (idle time while playing), so the
   * next draw only rebuilds the block. Deterministic: the frame is the one `frameAt` would return.
   */
  prefetch(boundary: PlateBoundary, stage: number): void;
}

/** A memoised, quantised generator per boundary, sharing one LRU. */
function memoised(relief: PlatesRelief): {
  generate: (b: PlateBoundary) => (stage: number) => LandscapeSnapshot;
  count: () => number;
} {
  const memo = new Map<string, LandscapeSnapshot>();
  let count = 0;
  return {
    generate: (b) => (stage) => {
      const q = quantiseStage(stage);
      const key = `${b}:${q}`;
      const hit = memo.get(key);
      if (hit) {
        memo.delete(key);
        memo.set(key, hit);
        return hit;
      }
      const frame = relief.relief(b, q);
      count++;
      memo.set(key, frame);
      if (memo.size > MEMO_FRAMES) memo.delete(memo.keys().next().value!);
      return frame;
    },
    count: () => count,
  };
}

export function createPlatesSequence(
  options: { reducedMotion?: boolean; relief?: PlatesRelief } = {},
): PlatesSequence {
  const relief = options.relief ?? createPlatesRelief();
  const start = relief.start();
  const m = memoised(relief);
  const source = createAuthoredSequence<LandscapeSnapshot>({
    sequences: PLATE_BOUNDARIES.map((b) => ({ key: b, generate: m.generate(b) })),
    start: () => start,
    stagePerViewSecond: 1 / PLAY_SECONDS,
    reducedMotionStops: REDUCED_MOTION_STOPS,
    reducedMotion: options.reducedMotion ?? false,
  });
  return {
    relief,
    source,
    start,
    generated: m.count,
    prefetch: (b, stage) => void m.generate(b)(Math.min(1, Math.max(0, stage))),
  };
}

export const asBoundary = (v: string | null | undefined): PlateBoundary | null =>
  PLATE_BOUNDARIES.includes(v as PlateBoundary) ? (v as PlateBoundary) : null;
