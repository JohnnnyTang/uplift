import { describe, expect, it } from "vitest";
import { AnnouncementGate } from "./announcements";

describe("bound visual-change announcements", () => {
  it("coalesces running snapshots, announces paused state promptly and suppresses duplicates", () => {
    const gate = new AnnouncementGate();
    expect(gate.accept("initial", 0, false)).toBe(true);
    expect(gate.accept("step one", 500, false)).toBe(false);
    expect(gate.accept("step two", 5000, false)).toBe(true);
    expect(gate.accept("step three", 5100, true)).toBe(true);
    expect(gate.accept("step three", 10000, true)).toBe(false);
    expect(gate.accept("reset", 10100, true)).toBe(true);
  });
  it("does not publish on invalid clock values or allow rapid speech intervals", () => {
    const gate = new AnnouncementGate();
    expect(gate.accept("invalid", NaN, true)).toBe(false);
    expect(gate.accept("valid", 0, true)).toBe(true);
    expect(() => new AnnouncementGate(0)).toThrow(RangeError);
  });
});
