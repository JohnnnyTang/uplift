import type { BookStage, BookView, BOOK_VIEW_LIMITS } from "@hachure/ink/stage";

/** Mouse gestures on the scene, with equivalent native keyboard controls. */
export function createViewControls(
  stage: BookStage,
  limits: typeof BOOK_VIEW_LIMITS,
  host: HTMLElement,
  surface: HTMLElement,
) {
  const controls = document.createElement("div");
  controls.className = "gs-view-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Camera view");
  const initial = stage.view;
  const makeRange = (text: string, min: number, max: number, step = 1) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const name = document.createElement("span");
    name.textContent = text;
    label.append(name, input);
    controls.append(label);
    return input;
  };
  const height = makeRange("View height", 90 - limits.maxTiltDeg, 90 - limits.minTiltDeg);
  const turn = makeRange("Turn", limits.minOrbitDeg, limits.maxOrbitDeg);
  const zoom = makeRange("Zoom", limits.minZoom, limits.maxZoom, 0.01);
  const sync = () => {
    height.value = String(90 - stage.view.tiltDeg);
    turn.value = String(stage.view.orbitDeg);
    zoom.value = String(stage.view.zoom);
    height.setAttribute("aria-valuetext", `${height.value} degrees above the page`);
    turn.setAttribute("aria-valuetext", `${turn.value} degrees from centre`);
    zoom.setAttribute("aria-valuetext", `${Math.round(stage.view.zoom * 100)} percent`);
  };
  const update = (view: Partial<BookView>) => {
    stage.setView(view);
    sync();
  };
  height.oninput = () => update({ tiltDeg: 90 - Number(height.value) });
  turn.oninput = () => update({ orbitDeg: Number(turn.value) });
  zoom.oninput = () => update({ zoom: Number(zoom.value) });
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset view";
  reset.onclick = () => update(initial);
  const hint = document.createElement("p");
  hint.className = "gs-view-hint";
  hint.textContent = "Drag the scene to turn · Scroll over it to zoom";
  controls.append(reset, hint);
  host.prepend(controls);

  // Reserve the toolbar's actual height, including wrapping and browser text zoom.
  const measure = () => host.style.setProperty("--gs-controls-height", `${controls.offsetHeight + 24}px`);
  const observer = new ResizeObserver(measure);
  observer.observe(controls);
  measure();
  const blocked = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest("button,input,select,textarea,a,summary,details,.gs-reading-region,[contenteditable]");
  let start: { id: number; x: number; y: number; view: BookView; moved: boolean } | null = null;
  let suppressClick = false;
  const down = (event: PointerEvent) => {
    // Mouse drag leaves native touch scrolling available on the readable phone layout.
    if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary || blocked(event.target))
      return;
    suppressClick = false;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, view: stage.view, moved: false };
  };
  const move = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) {
      surface.setPointerCapture(start.id);
      start.moved = true;
      surface.classList.add("gs-orbiting");
    }
    event.preventDefault();
    update({ orbitDeg: start.view.orbitDeg + dx * 0.2, tiltDeg: start.view.tiltDeg + dy * 0.2 });
  };
  const end = () => {
    if (!start) return;
    const id = start.id;
    suppressClick = start.moved;
    start = null;
    if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    surface.classList.remove("gs-orbiting");
  };
  const click = (event: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || blocked(event.target) || event.deltaY === 0) return;
    // In flat reading mode only the illustration captures wheel input; text still scrolls.
    if (stage.mode === "flat" && !(event.target instanceof Element && event.target.closest(".gs-frame")))
      return;
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? surface.clientHeight
          : 1;
    event.preventDefault();
    update({
      zoom: stage.view.zoom * Math.exp(-Math.max(-240, Math.min(240, event.deltaY * unit)) * 0.0015),
    });
  };
  const noSelect = (event: Event) => {
    if (start) event.preventDefault();
  };
  surface.addEventListener("pointerdown", down);
  surface.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("blur", end);
  surface.addEventListener("lostpointercapture", end);
  surface.addEventListener("click", click, true);
  surface.addEventListener("selectstart", noSelect);
  surface.addEventListener("wheel", wheel, { passive: false });
  sync();
  return {
    dispose() {
      end();
      observer.disconnect();
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      surface.removeEventListener("lostpointercapture", end);
      surface.removeEventListener("click", click, true);
      surface.removeEventListener("selectstart", noSelect);
      surface.removeEventListener("wheel", wheel);
      controls.remove();
      host.style.removeProperty("--gs-controls-height");
    },
  };
}
