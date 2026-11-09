import { describe, expect, it } from "vitest";
import { resolveTerrainConfig } from "@hachure/terrain";
import { brushAmountRange } from "./index";

describe("brush amount units and clamps", () => {
  const config = resolveTerrainConfig({ brushMaxHeightM: 3, brushMaxDepthM: 2, hardnessRange: [0.1, 0.8] });
  it("binds the height/depth/hardness endpoints to the current terrain config", () => {
    expect(brushAmountRange(config, "raise")).toMatchObject({ min: 0, max: 3, unit: "m" });
    expect(brushAmountRange(config, "dig")).toMatchObject({ min: 0, max: 2, unit: "m" });
    expect(brushAmountRange(config, "harden")).toMatchObject({ min: 0.1, max: 0.8, unit: "hardness" });
    expect(brushAmountRange(config, "smooth")).toMatchObject({ min: 0, max: 1, unit: "fraction" });
  });
});
