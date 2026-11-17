/**
 * @hachure/ink/desk — the study desk a book stage lies on: a seeded wooden top, lamp light, the book's
 * shadow and a few decorative objects, as CSS 3D furniture in the book's own coordinate system.
 *
 * Kept apart from `@hachure/ink/stage` so a page can paint its desk before three.js loads.
 */
export { type StudyDeskOptions, createStudyDesk } from "./study-desk";
export {
  type WoodContext,
  type WoodLook,
  WALNUT,
  WOOD_TILE_PX,
  paintWood,
  seededRandom,
  woodTextureUrl,
} from "./wood";
