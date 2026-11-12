/**
 * The one rock command (session 5K). The page's rock selector and the specimen dropped on the block both
 * call `chooseRock`, and nothing else changes the run. Until the runs runtime (5J) joins the book, this is a
 * local stand-in over the recorded runs; 5M swaps `createLocalRockCommand` for the runtime command behind the
 * same `RockCommand` shape.
 *
 * Local semantics, on recorded runs only: choosing another rock shows that rock's recorded run at the same
 * model time (the 5H behaviour, frozen at R1), and the run shown before becomes a kept run, newest first,
 * at most `MAX_KEPT_RUNS`. One recorded run per rock, so a rock appears at most once. A choice never edits a
 * run. (The runtime starts a fresh run from the authored start instead; 5J owns that.)
 */
import type { ReviewRun } from "./runs";

/** Kept runs besides the live one (plan §4: the live run plus up to two kept runs). */
export const MAX_KEPT_RUNS = 2;

export interface RunsState {
  readonly live: ReviewRun;
  /** Kept runs, newest first. */
  readonly kept: readonly ReviewRun[];
  /** A kept run dropped by the last choice (shown as a note), or null. */
  readonly dropped: ReviewRun | null;
}

export interface RockCommand {
  readonly state: RunsState;
  /** Returns the new state, or null when the choice changes nothing (the rock shown already). */
  chooseRock(rockKey: string): RunsState | null;
  /** Clears kept runs and returns to `live` (the explicit reset of plan §4). */
  reset(live: ReviewRun): RunsState;
}

export function createLocalRockCommand(
  runs: readonly ReviewRun[],
  initial: ReviewRun,
  initialKept: readonly ReviewRun[] = [],
): RockCommand {
  let state: RunsState = {
    live: initial,
    kept: initialKept.filter((r) => r !== initial).slice(0, MAX_KEPT_RUNS),
    dropped: null,
  };
  return {
    get state() {
      return state;
    },
    chooseRock(rockKey) {
      const next = runs.find((r) => r.rockKey === rockKey);
      if (!next || next === state.live) return null;
      const queue = [state.live, ...state.kept.filter((r) => r !== next)];
      state = {
        live: next,
        kept: queue.slice(0, MAX_KEPT_RUNS),
        dropped: queue[MAX_KEPT_RUNS] ?? null,
      };
      return state;
    },
    reset(live) {
      state = { live, kept: [], dropped: null };
      return state;
    },
  };
}
