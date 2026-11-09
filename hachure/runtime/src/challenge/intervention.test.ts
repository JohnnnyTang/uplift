import { expect, it } from "vitest";
import { applyBrush, createTiltedPlateauPreset, DEFAULT_TERRAIN_CONFIG } from "@hachure/terrain";
it("registered harden disks use binary support including rim cells: exactly rows 72–75", () => {
  const state = createTiltedPlateauPreset({ looseThicknessM: 0 }).create(DEFAULT_TERRAIN_CONFIG);
  const ground = Float32Array.from(state.layers.bedrockM);
  for (const row of [73, 74])
    for (let x = 0; x < 128; x++)
      applyBrush(
        state,
        { kind: "harden", at: { xM: (x + 0.5) * 10, yM: (row + 0.5) * 10 }, radiusM: 10, hardness: 0.9 },
        DEFAULT_TERRAIN_CONFIG,
      );
  const changedRows = [];
  for (let y = 0; y < 128; y++) {
    const hardened = Array.from(state.layers.hardness.slice(y * 128, (y + 1) * 128)).filter(
      (v) => v === Math.fround(0.9),
    ).length;
    if (hardened) {
      expect(hardened).toBe(128);
      changedRows.push(y);
    }
  }
  expect(changedRows).toEqual([72, 73, 74, 75]);
  expect(state.layers.bedrockM).toEqual(ground);
});
