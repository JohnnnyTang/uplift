/**
 * @hachure/ink — public entry point: everything the flat page drawing needs, with no three.js import, so
 * the book can paint the SVG first and load the 3D view behind it (tension T8).
 *
 * The 3D view (`createInkView`) lives in `@hachure/ink/view`.
 */
export const packageName = "@hachure/ink";

export {
  type Heightfield,
  INK_HEIGHT_LAYERS,
  heightRange,
  heightfieldFromFunction,
  heightfieldFromSnapshot,
} from "./heightfield";
export {
  type Diagonal,
  buildTriangleIndex,
  cellDiagonal,
  clampToSurface,
  quadDiagonal,
  sampleSurface,
  triangleIndexCount,
  writeQuadTriangles,
} from "./topology";
export {
  type ContourLine,
  type ContourOptions,
  type ContourSet,
  DRAW_MIN_SPACING_CELLS,
  contourSegmentCount,
  drawnPoints,
  extractContours,
} from "./contours";
export {
  type CameraPose,
  type Projection,
  type TerrainFrame,
  type Vec3,
  type Viewport,
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSE,
  createProjection,
  projectToViewport,
  resolveCameraPose,
  terrainFrameFromHeightfield,
  worldPosition,
} from "./projection";
export { type SvgOptions, boundaryRingM, toSvg } from "./svg";
export {
  type HachureOptions,
  type HachureSet,
  DEFAULT_HACHURE_OPTIONS,
  extractHachures,
  sampleGradient,
} from "./hachures";
export {
  type ChannelConfig,
  type ChannelId,
  type ChannelPattern,
  type ChannelRamp,
  type LegendToken,
  DEFAULT_CHANNELS,
  INK_TOKENS,
  channelOpacity,
  hexToRgb,
  legendSwatchSvg,
  legendTokens,
  linearToSrgb,
  overlayOnPaper,
  resolveChannels,
  srgbToLinear,
} from "./palette";
export {
  type FrameClock,
  type LiftPhase,
  type LiftRun,
  type LiftState,
  type LiftTargets,
  type LiftTiming,
  DEFAULT_LIFT_TIMING,
  FLAT_STATE,
  LIFTED_STATE,
  liftStateAt,
  runLift,
} from "./lift";

export * from "./picking/index";
export * from "./interaction";
