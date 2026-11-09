import { LEVELS, type Control, type Level, type Probe } from "../schema/index";

/** A view-only store: intentionally has no solver or simulation callback. */
export class LevelState {
  private current: Level;
  private readonly listeners = new Set<(level: Level) => void>();
  constructor(initial: Level = "hs") {
    this.assertLevel(initial);
    this.current = initial;
  }
  private assertLevel(level: Level): void {
    if (!LEVELS.includes(level)) throw new RangeError(`Unknown level: ${level}`);
  }
  get level(): Level {
    return this.current;
  }
  setLevel(level: Level): void {
    this.assertLevel(level);
    if (level === this.current) return;
    this.current = level;
    for (const listener of this.listeners) listener(level);
  }
  visibleControls(controls: readonly Control[]): readonly Control[] {
    return controls.filter((control) => control.levels.includes(this.current));
  }
  visibleProbes(probes: readonly Probe[]): readonly Probe[] {
    return probes.filter((probe) => !probe.levels || probe.levels.includes(this.current));
  }
  subscribe(listener: (level: Level) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
export function createLevelState(initial: Level = "hs"): LevelState {
  return new LevelState(initial);
}
