/**
 * The 3D camera built from the shared projection, so the canvas lands on the same pixels as the SVG.
 * `projection.test.ts` checks this against `projectToViewport`.
 */
import { OrthographicCamera } from "three";
import type { Projection } from "../projection";

/** Sets an orthographic camera to match a projection. Creates one when none is given. */
export function cameraFromProjection(
  projection: Projection,
  camera: OrthographicCamera = new OrthographicCamera(),
): OrthographicCamera {
  const p = projection;
  camera.left = p.left;
  camera.right = p.rightEdge;
  camera.top = p.top;
  camera.bottom = p.bottom;
  camera.near = p.near;
  camera.far = p.far;
  camera.zoom = 1;
  camera.position.set(p.back[0] * p.distanceM, p.back[1] * p.distanceM, p.back[2] * p.distanceM);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}
