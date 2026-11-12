/**
 * @hachure/ink/glacial — the production glacial scene's engine pieces (session 5K): dressing rules read from
 * model state, the enlarged front-face section, and direct gestures that mirror page controls.
 *
 * Kept apart from `@hachure/ink/stage`; the dressing rules and the section lens have no three.js
 * dependency, so the page can draw the lens before (or without) the 3D scene.
 */
export {
  type FilledRouting,
  GLACIAL_DRESSING_RULES,
  riverOnFilledBed,
  routeFilledBed,
  snoutRow,
  speedFlowLines,
} from "./dressing";
export {
  type SectionLensOptions,
  type SectionLensProfile,
  type SectionLensWindow,
  type SectionLensWords,
  scaleBarLengthM,
  sectionLensSvg,
  sectionLensWindow,
} from "./section-lens";
export {
  type AttachedGesture,
  type BlockScreenGeometry,
  type CutDragOptions,
  type ScreenPoint,
  type SpecimenDragOptions,
  attachCutDrag,
  attachSpecimenDrag,
  blockScreenGeometry,
  convexHull,
  pointInPolygon,
  rowsForDrag,
} from "./gestures";
