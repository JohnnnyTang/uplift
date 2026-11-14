import type { BackendSelectionOptions } from "@hachure/runtime";
import type { GlacialBackendPreference } from "@hachure/runtime/glacial";
import type { ReaderEntry } from "../reader/contracts";
import { uValleySpread } from "@uplift/spreads";
import { createGlacialSpreadScene } from "../app/glacial-spread";
import { waterSpread } from "./content";
import { createPlayableScene, type PlayableSceneOptions } from "./playable-scene";
import { createHostedWaterDriver } from "./water-driver";

/**
 * Production composition of the default book (5M): "From V to U" on the tilted book stage is spread 1, the
 * water lesson is spread 2. The contour lesson was removed (5M2).
 */
export function createPlayableEntries(
  options: Pick<BackendSelectionOptions, "createWorkerTransport" | "search"> &
    Pick<PlayableSceneOptions, "inkBackend">,
): readonly ReaderEntry[] {
  const params = new URLSearchParams(options.search ?? "");
  const flat = params.get("backend") === "flat";
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
    {
      spread: waterSpread,
      createScene: (level) =>
        createPlayableScene({
          level,
          flat,
          ...(options.inkBackend ? { inkBackend: options.inkBackend } : {}),
          createWaterDriver: () => createHostedWaterDriver(options),
        }),
    },
  ];
}
