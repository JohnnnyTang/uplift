import type { BackendSelectionOptions } from "@hachure/runtime";
import type { GlacialBackendPreference } from "@hachure/runtime/glacial";
import type { ReaderEntry } from "../reader/contracts";
import { platesSpread, uValleySpread } from "@uplift/spreads";
import { createGlacialSpreadScene } from "../app/glacial-spread";
import { createPlatesSpreadScene } from "./plates/index";
import { PLATES_LESSON_COPY } from "./plates/lesson-copy";

/**
 * Production composition of the default book on the tilted book stage: lesson 1, "From V to U" (5M), then
 * lesson 2, "Where plates meet" (7F; D-L2-1 decision 6: two working spreads and a real page turn). The
 * contour and water lessons were removed (5M2, D-W5-5N2).
 */
export function createPlayableEntries(
  options: Pick<BackendSelectionOptions, "search">,
): readonly ReaderEntry[] {
  const params = new URLSearchParams(options.search ?? "");
  const glacier = params.get("glacier");
  const prefer: GlacialBackendPreference = glacier === "cpu" || glacier === "webgpu" ? glacier : "auto";
  const mode = params.get("mode");
  const view: { mode?: "flat" | "tilted"; reducedMotion?: true } = {
    ...(mode === "flat" || mode === "tilted" ? { mode } : {}),
    ...(params.get("motion") === "reduce" ? { reducedMotion: true, mode: "flat" as const } : {}),
  };
  return [
    {
      spread: uValleySpread,
      layout: "stage",
      createScene: (level, { folio }) => createGlacialSpreadScene({ level, folio, prefer, ...view }),
      // Lesson 1's fallback swaps the live model for its recorded runs (D-W5-5M).
      fallbackStatus: (reason) => `Showing recorded runs: ${reason}`,
    },
    {
      spread: platesSpread,
      layout: "stage",
      createScene: (level, { folio }) =>
        createPlatesSpreadScene({
          level,
          folio,
          copy: PLATES_LESSON_COPY,
          probes: platesSpread.probes,
          ...view,
        }),
      // Lesson 2 has no runs: its fallback is the drawing with the enlarged front face (D-W7-7F).
      fallbackStatus: (reason) => `Drawing only: ${reason}`,
    },
  ];
}
