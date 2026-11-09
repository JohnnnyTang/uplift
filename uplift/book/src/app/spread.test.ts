import { describe, expect, it } from "vitest";
import { createTerrainHostCatalogue, validateSpread } from "@hachure/runtime";
import { valleySpread } from "@uplift/spreads";
import { RAIN_COMPARISON, V_VALLEY_SCIENCE_STATUS } from "@hachure/terrain";

describe("real valley spread wiring", () => {
  it("validates every authored binding against its actual public host catalogue", () => {
    expect(validateSpread(valleySpread, createTerrainHostCatalogue())).toMatchObject({ ok: true });
  });
  it("never supplies an invented prediction answer or executable draft challenge", () => {
    expect(valleySpread.page.predict.answer).toBe(RAIN_COMPARISON.answer);
    expect(valleySpread.page.predict.answerEvidence).toBe(RAIN_COMPARISON.evidencePath);
    expect(V_VALLEY_SCIENCE_STATUS.prediction.answer).toBeNull();
    expect(valleySpread.challenge.check.kind).toBe("pending");
    expect(
      validateSpread(
        {
          ...valleySpread,
          page: { ...valleySpread.page, predict: { ...valleySpread.page.predict, answer: 50 } },
        },
        createTerrainHostCatalogue(),
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateSpread(
        { ...valleySpread, challenge: { ...valleySpread.challenge, check: { kind: "pending", reason: "" } } },
        createTerrainHostCatalogue(),
      ),
    ).toMatchObject({ ok: false });
  });
});
