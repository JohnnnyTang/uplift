/**
 * @hachure/ink/plates — generic on-block gesture pieces first needed by lesson 2 (session 7D, D-W7-7D):
 * draggable arrows standing on the diorama that report directions in block axes. No plate or boundary
 * vocabulary lives here; the page maps a direction to its own command.
 */
export {
  type AttachedBlockArrows,
  type BlockArrowHandle,
  type BlockArrowsOptions,
  type BlockAxesOnScreen,
  type BlockDirection,
  type ScreenVector,
  ARROW_KEY_MOTION,
  attachBlockArrows,
  blockAxesOnScreen,
  blockDirectionForMotion,
} from "./block-arrows";
