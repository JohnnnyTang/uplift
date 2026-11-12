import { pickHeightfield, rayFromViewport } from "./picking/index";
import { projectToViewport, type Projection } from "./projection";
import { type ContourLine } from "./contours";
import { type Heightfield } from "./heightfield";
/** All selection marks use the renderer's projection and the actual extracted vertices. */
export function contourPath(line: ContourLine, projection: Projection, liftFraction: number): string {
  let path = "";
  for (let i = 0; i < line.pointsM.length; i += 2) {
    const [x, y] = projectToViewport(
      projection,
      line.pointsM[i],
      line.pointsM[i + 1],
      line.levelM,
      liftFraction,
    );
    path += `${i ? "L" : "M"}${x},${y} `;
  }
  return path + (line.closed ? "Z" : "");
}
/** A dot is a wet sample, not a parcel or a velocity arrow. */
export function wetSampleMarks(
  field: Heightfield,
  waterM: Float32Array,
  thresholdM: number,
  projection: Projection,
  liftFraction: number,
) {
  let path = "";
  let wetCells = 0;
  let leftCells = 0;
  let rightCells = 0;
  for (let i = 0; i < waterM.length; i++)
    if (waterM[i] >= thresholdM) {
      const x = ((i % field.gridSize) + 0.5) * field.metresPerCell;
      const y = (Math.floor(i / field.gridSize) + 0.5) * field.metresPerCell;
      const [px, py] = projectToViewport(projection, x, y, field.heightsM[i], liftFraction);
      path += `M${px},${py}h0.1 `;
      wetCells++;
      if (i % field.gridSize < field.gridSize / 2) leftCells++;
      else rightCells++;
    }
  return { path, wetCells, leftCells, rightCells };
}
/** Pointer capture owns the gesture; constrained lift never edits terrain. */
export function attachLiftHandle(
  element: SVGElement,
  read: () => number,
  change: (fraction: number) => void,
  gesture: (active: boolean) => void,
) {
  let drag: { y: number; fraction: number; pointerId: number } | null = null;
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { y: e.clientY, fraction: read(), pointerId: e.pointerId };
    element.setPointerCapture(e.pointerId);
    gesture(true);
  };
  const move = (e: PointerEvent) => {
    if (drag) change(Math.max(0, Math.min(1, drag.fraction + (drag.y - e.clientY) / 160)));
  };
  const end = () => {
    if (drag) {
      drag = null;
      gesture(false);
    }
  };
  element.addEventListener("pointerdown", down as EventListener);
  element.addEventListener("pointermove", move as EventListener);
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("lostpointercapture", end);
  return () => {
    end();
    element.removeEventListener("pointerdown", down as EventListener);
    element.removeEventListener("pointermove", move as EventListener);
    element.removeEventListener("pointerup", end);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("lostpointercapture", end);
  };
}

/** Shared direct terrain placement and native-key equivalent. Positions remain proposals until accepted by the host. */
export function attachSourcePlacement(options: {
  canvas: HTMLCanvasElement;
  marker: SVGElement;
  keyboard: HTMLElement;
  geometry: () => { field: Heightfield; projection: Projection; liftFraction: number };
  source: () => { xM: number; yM: number };
  place: (xM: number, yM: number) => void;
  gesture: (active: boolean) => void;
}) {
  const { canvas, marker, keyboard } = options;
  let dragging = false;
  const point = (e: PointerEvent | MouseEvent) => {
    const { field, projection, liftFraction } = options.geometry(),
      r = canvas.getBoundingClientRect();
    const hit = pickHeightfield(
      field,
      projection,
      liftFraction,
      rayFromViewport(projection, e.clientX - r.left, e.clientY - r.top),
    );
    if (hit) options.place(hit.xM, hit.yM);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    marker.setPointerCapture(e.pointerId);
    options.gesture(true);
  };
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    point(e);
    options.gesture(false);
  };
  const cancel = () => {
    if (dragging) {
      dragging = false;
      options.gesture(false);
    }
  };
  const key = (e: KeyboardEvent) => {
    const deltas: Record<string, readonly [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = deltas[e.key];
    if (!d) return;
    e.preventDefault();
    const s = options.source(),
      m = options.geometry().field.metresPerCell;
    options.place(s.xM + d[0] * m, s.yM + d[1] * m);
  };
  canvas.addEventListener("click", point);
  marker.addEventListener("pointerdown", down as EventListener);
  marker.addEventListener("pointerup", up as EventListener);
  marker.addEventListener("pointercancel", cancel);
  marker.addEventListener("lostpointercapture", cancel);
  keyboard.addEventListener("keydown", key);
  return () => {
    cancel();
    canvas.removeEventListener("click", point);
    marker.removeEventListener("pointerdown", down as EventListener);
    marker.removeEventListener("pointerup", up as EventListener);
    marker.removeEventListener("pointercancel", cancel);
    marker.removeEventListener("lostpointercapture", cancel);
    keyboard.removeEventListener("keydown", key);
  };
}
