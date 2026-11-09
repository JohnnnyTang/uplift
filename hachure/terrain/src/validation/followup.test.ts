import { describe, expect, it } from "vitest";
import { followupPreset } from "./followup-protocol";
import { validationConfig, validationPreset, VALIDATION_ARMS, VALIDATION_PROTOCOL } from "./protocol";

describe("preregistered mechanism-isolation controls", () => {
  for (const seed of VALIDATION_PROTOCOL.seeds)
    for (const arm of VALIDATION_ARMS)
      it(`preserves nonintervened inputs for seed ${seed} ${arm}`, () => {
        const config = validationConfig(seed, arm);
        const original = validationPreset(arm).create(config);
        const revised = followupPreset(arm).create(config);
        expect(revised.outlet).toEqual(original.outlet);
        expect(revised.layers.hardness).toEqual(original.layers.hardness);
        for (let i = 0; i < config.gridSize ** 2; i++) {
          expect(revised.layers.bedrockM[i]! + revised.layers.sedimentM[i]!).toBe(
            original.layers.bedrockM[i]! + (arm.startsWith("slope-") ? original.layers.sedimentM[i]! : 0),
          );
        }
        if (!arm.startsWith("slope-")) {
          expect(revised.layers.sedimentM.every((v) => v === 0)).toBe(true);
          expect(revised.layers.waterM).toEqual(original.layers.waterM);
          expect(revised.layers.suspendedSedimentM).toEqual(original.layers.suspendedSedimentM);
        } else {
          expect(revised.layers.bedrockM).toEqual(original.layers.bedrockM);
          expect(revised.layers.sedimentM).toEqual(original.layers.sedimentM);
          for (const key of ["waterM", "suspendedSedimentM"] as const) {
            expect(revised.layers[key].reduce((s, v) => s + v, 0)).toBe(
              original.layers[key].reduce((s, v) => s + v, 0),
            );
            expect(revised.layers[key].slice(64 * 128).every((v) => v === 0)).toBe(true);
            expect(revised.layers[key].slice(56 * 128, 64 * 128)).toEqual(
              original.layers[key].slice(24 * 128, 32 * 128),
            );
          }
        }
      });
});
