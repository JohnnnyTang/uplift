import type { BookStage, BOOK_VIEW_LIMITS } from "@hachure/ink/stage";

/** Explicit drag surface keeps orbit gestures separate from the lesson's controls. */
export function createViewControls(stage: BookStage, limits: typeof BOOK_VIEW_LIMITS, host: HTMLElement) {
  const controls = document.createElement("fieldset");
  controls.className = "gs-view-controls";
  const legend = document.createElement("legend");
  legend.textContent = "View angle";
  const initial = stage.view;
  const makeRange = (text: string, min: number, max: number) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    label.append(text, input);
    controls.append(label);
    return input;
  };
  controls.append(legend);
  const height = makeRange("View height", 90 - limits.maxTiltDeg, 90 - limits.minTiltDeg);
  const turn = makeRange("Turn", limits.minOrbitDeg, limits.maxOrbitDeg);
  const sync = () => {
    height.value = String(90 - stage.view.tiltDeg);
    turn.value = String(stage.view.orbitDeg);
    height.setAttribute("aria-valuetext", `${height.value} degrees above the page`);
    turn.setAttribute("aria-valuetext", `${turn.value} degrees from centre`);
  };
  height.oninput = () => {
    stage.setView({ tiltDeg: 90 - Number(height.value) });
    sync();
  };
  turn.oninput = () => {
    stage.setView({ orbitDeg: Number(turn.value) });
    sync();
  };
  const drag = document.createElement("button");
  drag.type = "button";
  drag.textContent = "Drag to rotate";
  drag.className = "gs-view-drag";
  drag.setAttribute("aria-label", "Rotate view: drag or use arrow keys; Home resets");
  let start: { id: number; x: number; y: number; tiltDeg: number; orbitDeg: number } | null = null;
  drag.onpointerdown = (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, ...stage.view };
    drag.setPointerCapture(event.pointerId);
  };
  drag.onpointermove = (event) => {
    if (!start || start.id !== event.pointerId) return;
    stage.setView({
      orbitDeg: start.orbitDeg + (event.clientX - start.x) * 0.2,
      tiltDeg: start.tiltDeg + (event.clientY - start.y) * 0.2,
    });
    sync();
  };
  const end = () => {
    start = null;
  };
  drag.onpointerup = end;
  drag.onpointercancel = end;
  drag.onlostpointercapture = end;
  drag.onkeydown = (event) => {
    const step = event.shiftKey ? 5 : 2;
    if (event.key === "Home") stage.setView(initial);
    else if (event.key === "ArrowLeft") stage.setView({ orbitDeg: stage.view.orbitDeg - step });
    else if (event.key === "ArrowRight") stage.setView({ orbitDeg: stage.view.orbitDeg + step });
    else if (event.key === "ArrowUp") stage.setView({ tiltDeg: stage.view.tiltDeg - step });
    else if (event.key === "ArrowDown") stage.setView({ tiltDeg: stage.view.tiltDeg + step });
    else return;
    event.preventDefault();
    sync();
  };
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset view";
  reset.onclick = () => {
    stage.setView(initial);
    sync();
  };
  controls.append(drag, reset);
  host.prepend(controls);
  sync();
  return { dispose: () => controls.remove() };
}
