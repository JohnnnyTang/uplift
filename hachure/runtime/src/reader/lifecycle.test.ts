import { describe, it, expect } from "vitest";
import { ReaderLifecycle } from "./lifecycle";
describe("independent reader state", () => {
  it("reveals before readiness and plays with an unanswered or skipped question", () => {
    const reader = new ReaderLifecycle({ questionOptionCount: 2, challenge: "pending" });
    reader.present({ ...reader.presentation(), explanationOpen: true });
    expect(reader.presentation().prediction.kind).toBe("unanswered");
    expect(reader.canPlay).toBe(false);
    reader.setReadiness({ kind: "ready" });
    reader.setAttached(true);
    expect(reader.canPlay).toBe(true);
    expect(reader.canAttemptChallenge).toBe(false);
    reader.present({ ...reader.presentation(), level: "uni", liftFraction: 1 });
    expect(reader.canPlay).toBe(true);
    reader.reset();
    expect(reader.presentation()).toMatchObject({
      level: "uni",
      explanationOpen: false,
      liftFraction: 0,
      prediction: { kind: "unanswered" },
    });
  });
  it("keeps absent questions absent, validates answers, and permits detached/fallback presentation", () => {
    const absent = new ReaderLifecycle();
    absent.setReadiness({ kind: "fallback", reason: "No renderer" });
    absent.present({ ...absent.presentation(), explanationOpen: true, liftFraction: 1 });
    absent.reset();
    expect(absent.presentation().prediction.kind).toBe("absent");
    expect(() => absent.present({ ...absent.presentation(), prediction: { kind: "unanswered" } })).toThrow();
    const reader = new ReaderLifecycle({ questionOptionCount: 2 });
    reader.present({ ...reader.presentation(), prediction: { kind: "answered", optionIndex: 1 } });
    expect(() =>
      reader.present({ ...reader.presentation(), prediction: { kind: "answered", optionIndex: 2 } }),
    ).toThrow();
    reader.dispose();
    reader.dispose();
    expect(() => reader.present(reader.presentation())).toThrow();
  });
});
