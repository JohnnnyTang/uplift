import type { AnimationScheduler } from "../glacial-host/driver";

export type { AnimationScheduler };

const browserScheduler: AnimationScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Drives `target.advance` from animation frames, the same way `driveGlacialHost` drives the glacial host.
 * The scheduler is injectable, so tests supply the view clock. The target ignores frames while paused or
 * after leaving. Returns a stop function (idempotent).
 */
export function driveSequence(
  target: { advance(viewSeconds: number): void },
  scheduler: AnimationScheduler = browserScheduler,
): () => void {
  let last: number | null = null;
  let handle = 0;
  let stopped = false;
  const frame = (timeMs: number) => {
    if (stopped) return;
    if (last !== null) target.advance(Math.max(0, timeMs - last) / 1000);
    last = timeMs;
    handle = scheduler.request(frame);
  };
  handle = scheduler.request(frame);
  return () => {
    if (stopped) return;
    stopped = true;
    scheduler.cancel(handle);
  };
}
