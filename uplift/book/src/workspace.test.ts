import { packageName as ink } from "@hachure/ink";
import { packageName as runtime } from "@hachure/runtime";
import { packageName as terrain } from "@hachure/terrain";
import { spreadIds } from "@uplift/spreads";
import { describe, expect, it } from "vitest";

describe("workspace wiring", () => {
  it("resolves every Hachure package through its public entry point", () => {
    expect([terrain, ink, runtime]).toEqual(["@hachure/terrain", "@hachure/ink", "@hachure/runtime"]);
  });

  it("resolves the spreads registry", () => {
    expect(Array.isArray(spreadIds)).toBe(true);
  });
});
