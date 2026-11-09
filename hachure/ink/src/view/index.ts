/**
 * @hachure/ink/view — the 3D ink terrain (three.js WebGPURenderer with WebGL2 fallback).
 *
 * Kept apart from `@hachure/ink` so the flat SVG drawing can paint before three.js loads (tension T8).
 */
export {
  type InkBackend,
  type InkBackendRequest,
  type InkLayers,
  type InkStateInput,
  type InkSurfaceState,
  type InkView,
  type InkViewOptions,
  type InkViewStats,
  DEFAULT_INK_LAYERS,
  INK_VIEW_LAYERS,
  createInkView,
} from "./ink-view";
export { cameraFromProjection } from "./camera";
