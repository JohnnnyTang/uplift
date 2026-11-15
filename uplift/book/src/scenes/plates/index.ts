/**
 * Lesson 2, _Where plates meet_: the production scene (session 7D, D-W7-7D). ILLUSTRATION: authored shapes,
 * not a simulation (D-L2-1).
 *
 * 7F mounts it as spread 2 of the default book, like lesson 1:
 *
 * ```ts
 * { spread: <7E's spread>, layout: "stage",
 *   createScene: (level, { folio }) =>
 *     createPlatesSpreadScene({ level, folio, copy: <7E's copy>, probes: <7E's spread>.probes, ...modeFlags }) }
 * ```
 *
 * The scene module itself (`./scene`, three.js) loads lazily on first mount.
 */
export { type PlatesSpreadOptions, createPlatesSpreadScene } from "./spread";
import type { MountedPlatesScene, PlatesSceneOptions } from "./scene";
export type { MountedPlatesScene, PlatesPagePresentation, PlatesSceneOptions } from "./scene";
export { type LevelText, type PlatesSceneCopy, PLATES_PLACEHOLDER_COPY } from "./copy";
export {
  PLATES_DEFAULT_PROBES,
  PLATES_PROBE_KINDS,
  PLATES_SCENE_FIELDS,
  configValue,
  platesProbeValues,
  platesSceneValues,
} from "./bindings";
export { type PlatesSequence, PLAY_SECONDS, STAGE_STEPS, createPlatesSequence } from "./sequence";
export { describeScene, stageWord } from "./words";

/** Mounts the scene on its own (review captures, the e2e fixture); the book uses `createPlatesSpreadScene`. */
export async function mountPlatesScene(
  root: HTMLElement,
  options: PlatesSceneOptions = {},
): Promise<MountedPlatesScene> {
  const { mountPlatesScene: mount } = await import("./scene");
  return mount(root, options);
}
