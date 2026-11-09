import { createTerrainEngineCatalogue } from "../core/index";
/** Snapshot-pair metrics belong to the host, because a solver snapshot alone has no reset baseline. */
export function createTerrainHostCatalogue() {
  const catalogue = createTerrainEngineCatalogue();
  return { ...catalogue, probeKinds: [...(catalogue.probeKinds ?? []), "fixed-section-incision"] };
}
