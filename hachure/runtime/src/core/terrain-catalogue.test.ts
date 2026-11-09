import { describe, expect, it } from "vitest";
import { DEFAULT_TERRAIN_CONFIG, PROBE_KINDS, TOOL_KINDS } from "@hachure/terrain";
import { createTerrainEngineCatalogue } from "./terrain-catalogue";

describe("public terrain catalogue", () => {
  it("exposes tunable config and all public tool and probe kinds", () => {
    const catalogue = createTerrainEngineCatalogue();
    expect(catalogue.params).toEqual(
      Object.keys(DEFAULT_TERRAIN_CONFIG).filter(
        (key) => !["gridSize", "metresPerCell", "seed"].includes(key),
      ),
    );
    expect(catalogue.params).toContain("hardnessRange");
    expect(catalogue.tools).toEqual(TOOL_KINDS);
    expect(catalogue.probeKinds).toEqual(PROBE_KINDS);
  });
});
