import { el } from "../widgets/controls";

/** Keep changing measurements readable without queueing speech every snapshot. */
export class AnnouncementGate {
  private previous = "";
  private announcedAt = -Infinity;
  constructor(readonly intervalMs = 5000) {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000)
      throw new RangeError("Announcement interval must be at least a second");
  }
  accept(text: string, nowMs: number, paused: boolean): boolean {
    if (!Number.isFinite(nowMs)) return false;
    if (text === this.previous || (!paused && nowMs - this.announcedAt < this.intervalMs)) return false;
    this.previous = text;
    this.announcedAt = nowMs;
    return true;
  }
}

/** Both alternatives receive the same already-bound text; only speech is throttled. */
export function createVisualDescription(initial: string) {
  const root = el("div", undefined, "snapshot-description");
  const visible = el("p", initial);
  const announcement = el("p", "", "a11y-announcement");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  const gate = new AnnouncementGate();
  root.append(visible, announcement);
  return {
    root,
    update(text: string, paused: boolean) {
      if (visible.textContent !== text) visible.textContent = text;
      if (gate.accept(text, performance.now(), paused)) announcement.textContent = text;
    },
  };
}
