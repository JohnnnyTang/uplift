import { describe, expect, it } from "vitest";
import { ChallengeProgress } from "./progress";
const stamp = {
  spreadId: "test.fixture",
  stampId: "fixture",
  definitionId: "verified-fixture",
  runId: "run",
  step: 3,
};
describe("safe local challenge progress", () => {
  it("keeps in-memory progress when access or quota operations fail", () => {
    const progress = new ChallengeProgress({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    });
    progress.record(stamp);
    progress.record(stamp);
    expect(progress.get(stamp.spreadId, stamp.stampId, stamp.definitionId)).toEqual(stamp);
    expect(progress.get(stamp.spreadId, stamp.stampId, "changed-definition")).toBeUndefined();
  });
  it("roundtrips a bounded versioned record and rejects corrupt storage", () => {
    let stored = "";
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    };
    new ChallengeProgress(storage).record(stamp);
    expect(new ChallengeProgress(storage).get(stamp.spreadId, stamp.stampId, stamp.definitionId)).toEqual(
      stamp,
    );
    for (const bad of ["{broken", '{"version":99,"stamps":[]}', '{"version":1,"stamps":[{"step":-1}]}']) {
      stored = bad;
      expect(
        new ChallengeProgress(storage).get(stamp.spreadId, stamp.stampId, stamp.definitionId),
      ).toBeUndefined();
    }
    expect(() => new ChallengeProgress(undefined).record({ ...stamp, step: NaN })).toThrow();
  });
});
