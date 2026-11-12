import type { GlacialHost } from "./host";

export interface AnimationScheduler {
  request(callback: (timeMs: number) => void): number;
  cancel(handle: number): void;
}

const browserScheduler: AnimationScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Drives `host.advance` from animation frames. The host ignores frames while paused or after leaving, and
 * drops wall-clock gaps rather than catching up. Returns a stop function (idempotent).
 */
export function driveGlacialHost(
  host: GlacialHost,
  scheduler: AnimationScheduler = browserScheduler,
): () => void {
  let last: number | null = null;
  let handle = 0;
  let stopped = false;
  const frame = (time: number) => {
    if (stopped) return;
    if (last !== null) host.advance((time - last) / 1000);
    last = time;
    handle = scheduler.request(frame);
  };
  handle = scheduler.request(frame);
  return () => {
    if (stopped) return;
    stopped = true;
    scheduler.cancel(handle);
  };
}
