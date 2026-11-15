/**
 * Lesson 2's boundary relief (session 7C). ILLUSTRATION — authored shapes, NOT a simulation (D-L2-1).
 * The production scene (7D) consumes this; boundary shapes stay lesson content, never Hachure.
 */
export {
  PLATES_RELIEF_CONFIG,
  PLATE_BOUNDARIES,
  type PlateBoundary,
  type PlatesLayer,
  type PlatesReliefConfig,
  type PlatesSceneScales,
  platesSceneScales,
} from "./config";
export { type CellField, type PlatesField, ease, platesField } from "./field";
export {
  type PlatesElevationFrame,
  type PlatesRelief,
  type PlatesReliefSnapshot,
  createPlatesRelief,
  relief,
  startingLandscape,
} from "./relief";
