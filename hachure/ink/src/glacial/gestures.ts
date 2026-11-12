/**
 * Direct gestures on the glacial diorama (session 5K). Each gesture is a pointer shortcut for a control the
 * page already has, so every one has a keyboard equivalent there:
 *
 * - **Cut drag**: drag the block's front face along the valley; the page's front-face slider (arrow keys)
 *   does the same. View-only.
 * - **Specimen drop**: drag a rock specimen from the tray onto the block; the tray's radio buttons do the
 *   same, through the same command.
 *
 * The geometry helpers are pure (screen points in, numbers out); the attach functions only wire DOM pointer
 * events and call back. Neither changes a run.
 */
import type { BookStage } from "../stage/book-stage";
import type { ValleyDiorama } from "../stage/diorama";

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Where the block is on screen, in viewport (client) coordinates. */
export interface BlockScreenGeometry {
  /** Convex outline of the whole visible block (base and top corners). */
  readonly outline: readonly ScreenPoint[];
  /** The front (cut) face: base left, base right, top right, top left. */
  readonly frontFace: readonly ScreenPoint[];
  /** Screen motion of the front face per block row moved down the valley (towards the reader). */
  readonly perRow: ScreenPoint;
}

/** Convex hull (monotone chain), counter-clockwise in screen axes. */
export function convexHull(points: readonly ScreenPoint[]): ScreenPoint[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: ScreenPoint, a: ScreenPoint, b: ScreenPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: ScreenPoint[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: ScreenPoint[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(pt: ScreenPoint, poly: readonly ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * Block rows to move the front face for a pointer moved by `delta` on screen: the motion projected onto
 * the face's screen direction of travel. Positive moves the face down the valley (towards the reader).
 */
export function rowsForDrag(delta: ScreenPoint, perRow: ScreenPoint): number {
  const len2 = perRow.x * perRow.x + perRow.y * perRow.y;
  if (!(len2 > 1e-9)) return 0;
  return (delta.x * perRow.x + delta.y * perRow.y) / len2;
}

/** Projects the block's corners through the stage. Null before the stage and diorama are ready. */
export function blockScreenGeometry(stage: BookStage, diorama: ValleyDiorama): BlockScreenGeometry | null {
  const fp = diorama.footprint();
  const d = diorama.describe();
  if (!fp || !d) return null;
  const hw = fp.widthM / 2;
  const h = fp.heightM;
  const rowM = d.cutAlongIndex > 0 ? (fp.frontZ - fp.backZ) / d.cutAlongIndex : 1;
  const pts = stage.projectBlockPoints([
    [-hw, 0, fp.frontZ],
    [hw, 0, fp.frontZ],
    [hw, h, fp.frontZ],
    [-hw, h, fp.frontZ],
    [-hw, 0, fp.backZ],
    [hw, 0, fp.backZ],
    [hw, h, fp.backZ],
    [-hw, h, fp.backZ],
    [0, 0, fp.frontZ],
    [0, 0, fp.frontZ + rowM],
  ]);
  if (pts.some((p) => p === null)) return null;
  const q = pts as ScreenPoint[];
  return {
    outline: convexHull(q.slice(0, 8)),
    frontFace: q.slice(0, 4),
    perRow: { x: q[9]!.x - q[8]!.x, y: q[9]!.y - q[8]!.y },
  };
}

export interface CutDragOptions {
  readonly stage: BookStage;
  readonly diorama: ValleyDiorama;
  /** Element receiving pointer events over the scene (the desk). */
  readonly surface: HTMLElement;
  /** Number of block rows along the valley (the grid length), to turn rows into a cut fraction. */
  readonly rows: () => number;
  /** Smallest allowed cut fraction (unit: none). */
  readonly minFraction?: () => number;
  /** Called with the new cut fraction (0 = head, 1 = full block). The page moves its slider and the block. */
  readonly onCut: (fraction: number) => void;
  /** Called when a drag starts and ends (for announcing the final state once). */
  readonly onDragEnd?: () => void;
  /** Whether the gesture is available (false while the transition runs, for example). */
  readonly enabled?: () => boolean;
}

export interface AttachedGesture {
  /** True if the pointer event starts this gesture; other handlers (the orbit) should then ignore it. */
  claims(event: PointerEvent): boolean;
  dispose(): void;
}

/** Hover over the front face shows a move cursor; dragging it moves the cut, one block row at a time. */
export function attachCutDrag(o: CutDragOptions): AttachedGesture {
  let drag: { id: number; start: ScreenPoint; cut: number; perRow: ScreenPoint } | null = null;
  const enabled = () => o.enabled?.() ?? true;
  const onFace = (e: PointerEvent) => {
    if (!enabled() || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return false;
    if (
      e.target instanceof Element &&
      e.target.closest("button,input,label,select,textarea,a,summary,[data-gesture]")
    )
      return false;
    const g = blockScreenGeometry(o.stage, o.diorama);
    return !!g && pointInPolygon({ x: e.clientX, y: e.clientY }, g.frontFace);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || !onFace(e)) return;
    const g = blockScreenGeometry(o.stage, o.diorama)!;
    drag = {
      id: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      cut: o.diorama.describe()!.cutFraction,
      perRow: g.perRow,
    };
    o.surface.setPointerCapture(e.pointerId);
    o.surface.classList.add("gs-cutting");
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!drag) {
      o.surface.classList.toggle("gs-over-face", onFace(e));
      return;
    }
    if (e.pointerId !== drag.id) return;
    const rows = Math.max(1, o.rows() - 1);
    const dRows = Math.round(
      rowsForDrag({ x: e.clientX - drag.start.x, y: e.clientY - drag.start.y }, drag.perRow),
    );
    const min = o.minFraction?.() ?? 0;
    const fraction = Math.min(1, Math.max(min, Math.round(drag.cut * rows + dRows) / rows));
    o.onCut(fraction);
    e.preventDefault();
  };
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (o.surface.hasPointerCapture(drag.id)) o.surface.releasePointerCapture(drag.id);
    drag = null;
    o.surface.classList.remove("gs-cutting");
    o.onDragEnd?.();
  };
  o.surface.addEventListener("pointerdown", down);
  o.surface.addEventListener("pointermove", move);
  o.surface.addEventListener("pointerup", up);
  o.surface.addEventListener("pointercancel", up);
  return {
    claims: (e) => drag !== null || (e.type === "pointerdown" && e.button === 0 && onFace(e)),
    dispose() {
      o.surface.removeEventListener("pointerdown", down);
      o.surface.removeEventListener("pointermove", move);
      o.surface.removeEventListener("pointerup", up);
      o.surface.removeEventListener("pointercancel", up);
      o.surface.classList.remove("gs-cutting", "gs-over-face");
    },
  };
}

export interface SpecimenDragOptions {
  readonly stage: BookStage;
  readonly diorama: ValleyDiorama;
  /** The specimens; each carries its rock key in `data-rock`. */
  readonly specimens: () => readonly HTMLElement[];
  /** An overlay element (positioned over the viewport) that shows the drop outline while dragging. */
  readonly overlay: SVGSVGElement;
  /** The rock dropped on the block: call the same command as the page selector. */
  readonly onDrop: (rockKey: string) => void;
  readonly reducedMotion: () => boolean;
  readonly enabled?: () => boolean;
}

/**
 * Pick up a specimen (pointer down and move a few pixels), carry it over the block, let go: `onDrop`. A
 * press without movement stays a normal click on the selector. Letting go elsewhere puts it back.
 */
export function attachSpecimenDrag(o: SpecimenDragOptions): { dispose(): void } {
  let drag: {
    id: number;
    el: HTMLElement;
    rock: string;
    start: ScreenPoint;
    chip: HTMLElement | null;
    over: boolean;
  } | null = null;
  const ns = "http://www.w3.org/2000/svg";
  const outline = document.createElementNS(ns, "polygon");
  outline.setAttribute("class", "gs-drop-outline");
  o.overlay.append(outline);
  const showOutline = (g: BlockScreenGeometry | null, active: boolean) => {
    o.overlay.toggleAttribute("data-active", active && !!g);
    if (!g) return;
    const r = o.overlay.getBoundingClientRect();
    outline.setAttribute(
      "points",
      g.outline.map((p) => `${(p.x - r.left).toFixed(1)},${(p.y - r.top).toFixed(1)}`).join(" "),
    );
  };
  const down = (e: PointerEvent) => {
    if (!(o.enabled?.() ?? true) || e.button !== 0 || !e.isPrimary) return;
    const el = (e.currentTarget as HTMLElement) ?? null;
    const rock = el?.dataset.rock;
    if (!el || !rock) return;
    drag = { id: e.pointerId, el, rock, start: { x: e.clientX, y: e.clientY }, chip: null, over: false };
    // Capture now, so the moves that carry the specimen off its label still reach it; no text selection.
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.start.x;
    const dy = e.clientY - drag.start.y;
    if (!drag.chip) {
      if (Math.hypot(dx, dy) < 6) return;
      const svg = drag.el.querySelector("svg");
      const chip = document.createElement("div");
      chip.className = "gs-chip-carried";
      chip.setAttribute("aria-hidden", "true");
      if (svg) chip.append(svg.cloneNode(true));
      (o.overlay.parentElement ?? document.body).append(chip);
      drag.chip = chip;
      drag.el.classList.add("gs-specimen-lifted");
    }
    e.preventDefault();
    drag.chip.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const g = blockScreenGeometry(o.stage, o.diorama);
    drag.over = !!g && pointInPolygon({ x: e.clientX, y: e.clientY }, g.outline);
    drag.chip.toggleAttribute("data-over", drag.over);
    showOutline(g, true);
    outline.toggleAttribute("data-over", drag.over);
  };
  const finish = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.el.hasPointerCapture(d.id)) d.el.releasePointerCapture(d.id);
    d.el.classList.remove("gs-specimen-lifted");
    showOutline(null, false);
    if (!d.chip) return;
    // A drag is never also a click on the selector.
    const swallow = (c: Event) => {
      c.preventDefault();
      c.stopPropagation();
    };
    d.el.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => d.el.removeEventListener("click", swallow, { capture: true }), 0);
    const dropped = e.type === "pointerup" && d.over;
    const chip = d.chip;
    if (dropped || o.reducedMotion()) chip.remove();
    else {
      // Back to the tray.
      const home = d.el.getBoundingClientRect();
      chip.style.transition = "transform 220ms ease-in";
      chip.style.transform = `translate(${home.left + home.width / 2}px, ${home.top + home.height / 2}px)`;
      setTimeout(() => chip.remove(), 240);
    }
    if (dropped) o.onDrop(d.rock);
  };
  const bound = new Set<HTMLElement>();
  const bind = () => {
    for (const el of o.specimens()) {
      if (bound.has(el)) continue;
      bound.add(el);
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", finish);
      el.addEventListener("pointercancel", finish);
    }
  };
  bind();
  return {
    dispose() {
      for (const el of bound) {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", finish);
        el.removeEventListener("pointercancel", finish);
      }
      drag?.chip?.remove();
      outline.remove();
    },
  };
}
