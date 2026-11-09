/** <!-- expert-review --> Frozen before reruns; see validation/followup/preregistration.md. */
import type { TerrainPreset } from "../contract/index";
import { validationPreset, type ValidationArm } from "./protocol";

export const FOLLOWUP_PROTOCOL_ID = "s1-w3-mechanism-isolation-v1";

/** Change initial material exposure or pulse position, never the process equations. */
export function followupPreset(arm: ValidationArm): TerrainPreset {
  const original = validationPreset(arm);
  return {
    id: FOLLOWUP_PROTOCOL_ID + "/" + arm,
    create(config) {
      const state = original.create(config);
      const { bedrockM, sedimentM, waterM, suspendedSedimentM } = state.layers;
      if (!arm.startsWith("slope-")) {
        // Remove uniform cover: ground and outlet shift down equally; relief is unchanged.
        for (let i = 0; i < bedrockM.length; i++) {
          sedimentM[i] = 0;
        }
      } else {
        // Translate the whole eight-row pulse to the last eight rows before the reach.
        const n = config.gridSize;
        for (let y = (24 / 128) * n; y < (32 / 128) * n; y++)
          for (let x = (56 / 128) * n; x < (72 / 128) * n; x++) {
            const from = y * n + x;
            const to = (y + (32 / 128) * n) * n + x;
            waterM[to] = waterM[from]!;
            suspendedSedimentM[to] = suspendedSedimentM[from]!;
            waterM[from] = 0;
            suspendedSedimentM[from] = 0;
          }
      }
      return state;
    },
  };
}
