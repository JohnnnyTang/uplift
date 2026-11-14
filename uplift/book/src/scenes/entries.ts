import type { BackendSelectionOptions } from "@hachure/runtime";
import type { GlacialBackendPreference } from "@hachure/runtime/glacial";
import type { ReaderEntry } from "../reader/contracts";
import { uValleySpread } from "@uplift/spreads";
import { createGlacialSpreadScene } from "../app/glacial-spread";

/**
 * Production composition of the default book: the single lesson "From V to U" on the tilted book stage.
 * The contour lesson was removed (5M2) and the water lesson was removed (5N2, D-W5-5N2).
 */
export function createPlayableEntries(
  options: Pick<BackendSelectionOptions, "search">,
): readonly ReaderEntry[] {
  const params = new URLSearchParams(options.search ?? "");
  const glacier = params.get("glacier");
  const prefer: GlacialBackendPreference = glacier === "cpu" || glacier === "webgpu" ? glacier : "auto";
  const mode = params.get("mode");
  return [
    {
      spread: uValleySpread,
      layout: "stage",
      createScene: (level, { folio }) =>
        createGlacialSpreadScene({
          level,
          folio,
          prefer,
          ...(mode === "flat" || mode === "tilted" ? { mode } : {}),
          ...(params.get("motion") === "reduce" ? { reducedMotion: true, mode: "flat" as const } : {}),
        }),
    },
  ];
}
