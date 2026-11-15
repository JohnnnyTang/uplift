/**
 * Draggable arrows standing on the diorama (session 7D, D-W7-7D): a handle anchored at a point of the block,
 * re-projected through the book stage's camera, carrying an ink arrow that points along one of the block's
 * horizontal axes. Dragging a handle, or pressing an arrow key while it has focus, reports a direction in
 * block axes (`across` = block X, `along` = block Z, each with a sign); the page turns that into its own
 * command, the same one its page control sends. Hachure has no plate vocabulary: the arrows only know block
 * axes.
 *
 * The geometry helpers are pure (screen points in, a direction out); `attachBlockArrows` only wires DOM
 * pointer and key events and draws the arrows. Neither changes a snapshot or any model state.
 */
import type { BookStage } from "../stage/book-stage";
import type { ValleyDiorama } from "../stage/diorama";

export interface ScreenVector {
  readonly x: number;
  readonly y: number;
}

/** A direction in block axes: across the block (X, left → right) or along it (Z, back → front). */
export interface BlockDirection {
  readonly axis: "across" | "along";
  readonly sign: 1 | -1;
}

/** Screen directions of the block's +X and +Z axes at one point (unit vectors, client pixels). */
export interface BlockAxesOnScreen {
  readonly origin: ScreenVector;
  readonly across: ScreenVector;
  readonly along: ScreenVector;
  /** Screen length of `lengthM` block metres along each axis (unit: pixels). */
  readonly acrossPx: number;
  readonly alongPx: number;
}

const unit = (v: ScreenVector): ScreenVector => {
  const len = Math.hypot(v.x, v.y);
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
};
const dot = (a: ScreenVector, b: ScreenVector) => a.x * b.x + a.y * b.y;

/**
 * The block direction whose screen direction best matches a screen motion `delta`, or null when the motion
 * is shorter than `minPx`. Ties go to `across`.
 */
export function blockDirectionForMotion(
  delta: ScreenVector,
  axes: Pick<BlockAxesOnScreen, "across" | "along">,
  minPx = 0,
): BlockDirection | null {
  if (!(Math.hypot(delta.x, delta.y) >= Math.max(minPx, 1e-9))) return null;
  const d = unit(delta);
  const a = dot(d, unit(axes.across));
  const l = dot(d, unit(axes.along));
  if (Math.abs(a) >= Math.abs(l)) return { axis: "across", sign: a >= 0 ? 1 : -1 };
  return { axis: "along", sign: l >= 0 ? 1 : -1 };
}

/** Screen motions of the four arrow keys (client axes: y grows downwards). */
export const ARROW_KEY_MOTION: Readonly<Record<string, ScreenVector>> = Object.freeze({
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
});

/** Block axes on screen at block-local point `p` (metres), or null before the stage can project. */
export function blockAxesOnScreen(
  stage: Pick<BookStage, "projectBlockPoints">,
  p: readonly [number, number, number],
  lengthM: number,
): BlockAxesOnScreen | null {
  const [o, x, z] = stage.projectBlockPoints([p, [p[0] + lengthM, p[1], p[2]], [p[0], p[1], p[2] + lengthM]]);
  if (!o || !x || !z) return null;
  const ax = { x: x.x - o.x, y: x.y - o.y };
  const az = { x: z.x - o.x, y: z.y - o.y };
  return {
    origin: o,
    across: unit(ax),
    along: unit(az),
    acrossPx: Math.hypot(ax.x, ax.y),
    alongPx: Math.hypot(az.x, az.y),
  };
}

export interface BlockArrowHandle {
  /** Stable id, reported back with every gesture. */
  readonly id: string;
  /** Accessible name of the handle (the page's words). */
  readonly label: string;
  /** Block-local anchor (metres: X across, Y up from the base, Z along), or null to hide the handle. */
  readonly anchor: () => readonly [number, number, number] | null;
}

export interface BlockArrowsOptions {
  readonly stage: BookStage;
  readonly diorama: ValleyDiorama;
  /** A positioned element covering the stage host; the handles and arrows are drawn in it. */
  readonly layer: HTMLElement;
  readonly handles: readonly BlockArrowHandle[];
  /** A drag released (or an arrow key pressed) in a block direction: send the page's command. */
  readonly onGesture: (id: string, direction: BlockDirection, via: "pointer" | "keyboard") => void;
  /** Id of an element describing the keys, for `aria-describedby`. */
  readonly describedBy?: string;
  /** Whether the handles take input (false while the transition runs, for example). */
  readonly enabled?: () => boolean;
  /** Shortest drag that counts (unit: CSS pixels). Default 18. */
  readonly minDragPx?: number;
  /** Arrow length as a fraction of the block's width (unit: none). Default 0.2. */
  readonly arrowFraction?: number;
  /** A pointer press on a handle starts or ends (other gestures such as the orbit should stand aside). */
  readonly onDragChange?: (dragging: boolean) => void;
}

export interface AttachedBlockArrows {
  /** Re-projects the handles and redraws the arrows (call after the view or the block changes). */
  update(): void;
  /** The arrow each handle shows at rest (null: a neutral, double-headed hint across the block). */
  setDirection(id: string, direction: BlockDirection | null): void;
  /** True while a pointer drag on a handle is in progress (other gestures should ignore the pointer). */
  claims(event: PointerEvent): boolean;
  /** Client-space centres of the handles, for browser tests (null when hidden). */
  targets(): Readonly<Record<string, ScreenVector | null>>;
  dispose(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** One arrow from `from` to `to` with a filled head, as an SVG path `d` (shaft) and points (head). */
function arrowPath(from: ScreenVector, to: ScreenVector, headPx: number): { shaft: string; head: string } {
  const d = unit({ x: to.x - from.x, y: to.y - from.y });
  const n = { x: -d.y, y: d.x };
  const base = { x: to.x - d.x * headPx, y: to.y - d.y * headPx };
  const w = headPx * 0.55;
  const f = (v: number) => v.toFixed(1);
  return {
    shaft: `M${f(from.x)} ${f(from.y)}L${f(base.x)} ${f(base.y)}`,
    head: `${f(to.x)},${f(to.y)} ${f(base.x + n.x * w)},${f(base.y + n.y * w)} ${f(base.x - n.x * w)},${f(base.y - n.y * w)}`,
  };
}

export function attachBlockArrows(o: BlockArrowsOptions): AttachedBlockArrows {
  const minDrag = o.minDragPx ?? 18;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "hb-arrows");
  svg.setAttribute("aria-hidden", "true");
  o.layer.append(svg);
  interface State {
    readonly spec: BlockArrowHandle;
    readonly button: HTMLButtonElement;
    readonly group: SVGGElement;
    rest: BlockDirection | null;
    axes: BlockAxesOnScreen | null;
    drag: { id: number; start: ScreenVector; direction: BlockDirection | null; lengthPx: number } | null;
  }
  const states: State[] = o.handles.map((spec) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hb-handle";
    button.dataset.handle = spec.id;
    button.dataset.gesture = "block-arrow";
    button.setAttribute("aria-label", spec.label);
    if (o.describedBy) button.setAttribute("aria-describedby", o.describedBy);
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "hb-arrow");
    group.dataset.handle = spec.id;
    svg.append(group);
    o.layer.append(button);
    return { spec, button, group, rest: null, axes: null, drag: null };
  });
  const enabled = () => o.enabled?.() ?? true;
  const layerOrigin = () => {
    const r = o.layer.getBoundingClientRect();
    return { x: r.left, y: r.top };
  };

  const draw = (s: State) => {
    const axes = s.axes;
    s.group.replaceChildren();
    if (!axes) return;
    const at = layerOrigin();
    const c = { x: axes.origin.x - at.x, y: axes.origin.y - at.y };
    // Axes were projected over a tenth of the block width; the arrow spans `arrowFraction` of it.
    const perAxisPx = (o.arrowFraction ?? 0.2) / 0.1;
    const scaleFor = (dir: BlockDirection) => (dir.axis === "across" ? axes.acrossPx : axes.alongPx);
    const vecFor = (dir: BlockDirection) => (dir.axis === "across" ? axes.across : axes.along);
    const headPx = 11;
    const pieces: { from: ScreenVector; to: ScreenVector }[] = [];
    const dir = s.drag?.direction ?? s.rest;
    if (dir) {
      const v = vecFor(dir);
      // A drag stretches the arrow with the pointer, from its full length up to half as long again.
      const base = Math.max(30, scaleFor(dir) * perAxisPx);
      const len = s.drag?.direction ? Math.min(base * 1.5, Math.max(base, s.drag.lengthPx)) : base;
      const half = len / 2;
      pieces.push({
        from: { x: c.x - v.x * half * dir.sign, y: c.y - v.y * half * dir.sign },
        to: { x: c.x + v.x * half * dir.sign, y: c.y + v.y * half * dir.sign },
      });
    } else {
      // At rest with no direction: a double-headed hint across the block, inviting a drag.
      const v = axes.across;
      const half = Math.max(30, axes.acrossPx * perAxisPx) / 2;
      pieces.push(
        { from: c, to: { x: c.x + v.x * half, y: c.y + v.y * half } },
        { from: c, to: { x: c.x - v.x * half, y: c.y - v.y * half } },
      );
    }
    s.group.toggleAttribute("data-neutral", !dir);
    s.group.toggleAttribute("data-dragging", !!s.drag?.direction);
    for (const p of pieces) {
      const { shaft, head } = arrowPath(p.from, p.to, headPx);
      for (const cls of ["hb-arrow-halo", "hb-arrow-ink"]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `${cls} hb-arrow-shaft`);
        path.setAttribute("d", shaft);
        const tip = document.createElementNS(SVG_NS, "polygon");
        tip.setAttribute("class", `${cls} hb-arrow-head`);
        tip.setAttribute("points", head);
        s.group.append(path, tip);
      }
    }
  };

  const update = () => {
    const fp = o.diorama.footprint();
    const at = layerOrigin();
    for (const s of states) {
      const anchor = fp ? s.spec.anchor() : null;
      s.axes = anchor && fp ? blockAxesOnScreen(o.stage, anchor, fp.widthM * 0.1) : null;
      s.button.hidden = !s.axes;
      if (s.axes) {
        s.button.style.left = `${(s.axes.origin.x - at.x).toFixed(1)}px`;
        s.button.style.top = `${(s.axes.origin.y - at.y).toFixed(1)}px`;
      }
      draw(s);
    }
  };

  const listeners: [EventTarget, string, EventListener][] = [];
  const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
    target.addEventListener(type, fn as EventListener);
    listeners.push([target, type, fn as EventListener]);
  };
  for (const s of states) {
    on<PointerEvent>(s.button, "pointerdown", (e) => {
      if (!enabled() || e.button !== 0 || !e.isPrimary) return;
      s.drag = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, direction: null, lengthPx: 0 };
      s.button.setPointerCapture(e.pointerId);
      s.button.classList.add("hb-handle-dragging");
      o.onDragChange?.(true);
      e.preventDefault();
    });
    on<PointerEvent>(s.button, "pointermove", (e) => {
      if (!s.drag || e.pointerId !== s.drag.id || !s.axes) return;
      const delta = { x: e.clientX - s.drag.start.x, y: e.clientY - s.drag.start.y };
      s.drag.direction = blockDirectionForMotion(delta, s.axes, minDrag);
      s.drag.lengthPx = Math.hypot(delta.x, delta.y) * 2;
      s.button.dataset.preview = s.drag.direction ? `${s.drag.direction.axis}${s.drag.direction.sign}` : "";
      draw(s);
      e.preventDefault();
    });
    const finish = (e: PointerEvent) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      const done = e.type === "pointerup" ? s.drag.direction : null;
      if (s.button.hasPointerCapture(s.drag.id)) s.button.releasePointerCapture(s.drag.id);
      s.drag = null;
      s.button.classList.remove("hb-handle-dragging");
      delete s.button.dataset.preview;
      o.onDragChange?.(false);
      draw(s);
      if (done) o.onGesture(s.spec.id, done, "pointer");
    };
    on<PointerEvent>(s.button, "pointerup", finish);
    on<PointerEvent>(s.button, "pointercancel", finish);
    on<KeyboardEvent>(s.button, "keydown", (e) => {
      const motion = ARROW_KEY_MOTION[e.key];
      if (!motion || !enabled() || !s.axes || e.altKey || e.ctrlKey || e.metaKey) return;
      const direction = blockDirectionForMotion(motion, s.axes);
      if (!direction) return;
      e.preventDefault();
      e.stopPropagation();
      o.onGesture(s.spec.id, direction, "keyboard");
    });
  }

  update();
  return {
    update,
    setDirection(id, direction) {
      const s = states.find((x) => x.spec.id === id);
      if (!s) return;
      s.rest = direction;
      draw(s);
    },
    claims: (e) => states.some((s) => s.drag?.id === e.pointerId || e.target === s.button),
    targets() {
      const out: Record<string, ScreenVector | null> = {};
      for (const s of states) out[s.spec.id] = s.axes ? s.axes.origin : null;
      return out;
    },
    dispose() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      for (const s of states) s.button.remove();
      svg.remove();
    },
  };
}
