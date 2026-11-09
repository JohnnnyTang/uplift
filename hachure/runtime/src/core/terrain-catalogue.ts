import { DEFAULT_TERRAIN_CONFIG, PROBE_KINDS, TOOL_KINDS, type TunableConfigKey } from "@hachure/terrain";
import type { EngineCatalogue } from "../schema/index";

/** Derive the terrain catalogue from public contracts; never duplicate engine key lists. */
export function createTerrainEngineCatalogue(): EngineCatalogue {
  const params = Object.keys(DEFAULT_TERRAIN_CONFIG).filter(
    (key): key is TunableConfigKey => !["gridSize", "metresPerCell", "seed"].includes(key),
  );
  return Object.freeze({ params: Object.freeze(params), tools: TOOL_KINDS, probeKinds: PROBE_KINDS });
}
