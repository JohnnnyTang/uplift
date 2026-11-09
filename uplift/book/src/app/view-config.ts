import { DEFAULT_CHANNELS, resolveChannels } from "@hachure/ink";
import { BOOK_PALETTE, type CameraPose } from "@hachure/runtime";
/** One configuration drives the renderer and its explanatory labels. */
export const LESSON_VIEW = Object.freeze({
  contourIntervalM: 5,
  reliefScale: 2,
  channels: resolveChannels({
    water: DEFAULT_CHANNELS.water,
    sediment: { ...DEFAULT_CHANNELS.sediment, colour: BOOK_PALETTE.sediment },
  }),
});
/** Schema camera points use terrain widths, Y up; the ink view uses an orthographic orbit. */
export function inkCamera(camera: CameraPose) {
  const x = camera.position[0] - camera.target[0];
  const y = camera.position[1] - camera.target[1];
  const z = camera.position[2] - camera.target[2];
  return {
    azimuthDeg: (Math.atan2(-x, z) * 180) / Math.PI,
    elevationDeg: (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI,
    zoom: 1,
  };
}
