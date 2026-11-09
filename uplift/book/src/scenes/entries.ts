import type { BackendSelectionOptions } from "@hachure/runtime";
import type { ReaderEntry } from "../reader/contracts";
import { contourSpread, waterSpread } from "./content";
import { createPlayableScene, type PlayableSceneOptions } from "./playable-scene";
import { createHostedWaterDriver } from "./water-driver";
/** Production composition entry. The live lesson always selects the shared authored host. */
export function createPlayableEntries(
  options: Pick<BackendSelectionOptions, "createWorkerTransport" | "search"> &
    Pick<PlayableSceneOptions, "inkBackend">,
): readonly ReaderEntry[] {
  const flat = new URLSearchParams(options.search ?? "").get("backend") === "flat";
  return [
    {
      spread: contourSpread,
      createScene: (level) =>
        createPlayableScene("contour", {
          level,
          flat,
          ...(options.inkBackend ? { inkBackend: options.inkBackend } : {}),
        }),
    },
    {
      spread: waterSpread,
      createScene: (level) =>
        createPlayableScene("water", {
          level,
          flat,
          ...(options.inkBackend ? { inkBackend: options.inkBackend } : {}),
          createWaterDriver: () => createHostedWaterDriver(options),
        }),
    },
  ];
}
