/**
 * @hachure/ink/stage — a scene anchored to a DOM book page under CSS 3D, with a matched camera, a paper
 * shadow-catcher and overflow above the figure frame; plus the landscape diorama it shows and the natural
 * materials it is drawn in.
 *
 * Kept apart from `@hachure/ink` (like `@hachure/ink/view`) so the flat page can paint before three.js loads.
 */
export {
  type BookStage,
  type BookStageOptions,
  type StageBackendRequest,
  type StageMode,
  type StageModeRequest,
  FLAT_STAGE_QUERY,
  createBookStage,
} from "./book-stage";
export {
  type DioramaDescription,
  type DioramaOptions,
  type DioramaReveal,
  type Footprint,
  ValleyDiorama,
  createValleyDiorama,
} from "./diorama";
export {
  type BlockGrid,
  type LandscapeSnapshot,
  type ValleyOrientation,
  DEFAULT_ORIENTATION,
  elevationRange,
  toBlockGrid,
  validateSnapshot,
  valleyGridIndex,
} from "./snapshot";
export { type DressingConfig, DEFAULT_DRESSING } from "./dressing";
export {
  type Rect,
  type StageCamera,
  type StageGeometry,
  bookTransformCss,
  cssProjectBookPoint,
  pageFrameMatrix,
  pageToWorld,
  stageCamera,
  tiltedBookFits,
  worldToStage,
} from "./camera-match";
export * from "../materials/natural/index";
