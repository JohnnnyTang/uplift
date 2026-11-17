/**
 * A study desk under the open book: a wooden top, a warm lamp pool, the book's own shadow and a few things a
 * reader leaves beside a book (loose paper, a pencil, an eraser, a mug). Decoration only.
 *
 * The desk is CSS 3D furniture in the book's own coordinate system, like the binding (`createBookBinding`):
 * it is a child of the tilted book element, so it follows the book's tilt, turn, zoom and fit with no code
 * of its own and no second render pass. The top lies below the paper by the book's thickness. Nothing here
 * takes pointer events, focus or a place in the accessibility tree, and nothing moves by itself.
 *
 * ```ts
 * const desk = createStudyDesk(book, { seed: 7 });
 * // …
 * desk.dispose();
 * ```
 *
 * Variation (the boards of the top) is seeded; see `wood.ts`.
 */
import { woodTextureUrl } from "./wood";

export interface StudyDeskOptions {
  /** Seed of the wooden top (unit: none). Default 7. */
  readonly seed?: number;
  /**
   * Book width the desk is drawn for (unit: CSS pixels). The desk and its objects scale with the book's
   * actual layout width relative to this. Default 1040.
   */
  readonly designWidthPx?: number;
  /** How far the desk top lies below the paper (unit: CSS pixels at the design width). Default 56. */
  readonly depthPx?: number;
  /** The book's boards beyond the paper, for its shadow (unit: CSS pixels at the design width). */
  readonly boards?: { readonly sidePx: number; readonly topPx: number; readonly bottomPx: number };
  /** Draw the objects beside the book. Default true; the top, light and book shadow are always drawn. */
  readonly objects?: boolean;
}

type V3 = readonly [number, number, number];

/** Towards the lamp: upper left, beyond the book's far edge (x right, y down the page, z up). */
const LIGHT: V3 = (() => {
  const v = [-0.42, -0.46, 0.78] as const;
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n] as const;
})();
/** Where a point's shadow lands on the desk, per unit of its height. */
const SHADOW = [-LIGHT[0] / LIGHT[2], -LIGHT[1] / LIGHT[2]] as const;

const shade = (colour: V3, normal: V3, ambient = 0.5, diffuse = 0.62) => {
  const lit = Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]);
  const f = ambient + diffuse * lit;
  return `rgb(${colour.map((c) => Math.round(Math.min(255, c * f))).join(",")})`;
};

function el(className: string, style: Partial<CSSStyleDeclaration> = {}): HTMLDivElement {
  const node = document.createElement("div");
  node.className = className;
  Object.assign(node.style, { position: "absolute", left: "0", top: "0" }, style);
  return node;
}

/** A flat face in desk space: `x` and `y` are where its own right and down directions point. */
function face(
  width: number,
  height: number,
  origin: V3,
  x: V3,
  y: V3,
  background: string,
  twoSided = false,
): HTMLDivElement {
  const n: V3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return el("hachure-desk-face", {
    width: `${width}px`,
    height: `${height}px`,
    transformOrigin: "0 0",
    transform: `matrix3d(${[...x, 0, ...y, 0, ...n, 0, ...origin, 1].map((v) => +v.toFixed(4)).join(",")})`,
    background,
    backfaceVisibility: twoSided ? "visible" : "hidden",
  });
}

/** The soft shadow of a rectangle of this height lying (turned by `turnDeg`) on the desk. */
function castShadow(
  cx: number,
  cy: number,
  width: number,
  height: number,
  turnDeg: number,
  liftPx: number,
  blurPx: number,
  alpha: number,
  radius = "3px",
): HTMLDivElement {
  return el("hachure-desk-shadow", {
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: radius,
    background: `rgba(24,12,4,${alpha})`,
    filter: `blur(${blurPx}px)`,
    transform: `translate(${cx + SHADOW[0] * liftPx - width / 2}px, ${cy + SHADOW[1] * liftPx - height / 2}px) rotate(${turnDeg}deg)`,
  });
}

const SVG = "http://www.w3.org/2000/svg";

/** A hexagonal pencil seen from above, point to the right. */
function pencil(length: number, width: number): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${length} ${width}`);
  svg.setAttribute("width", String(length));
  svg.setAttribute("height", String(width));
  const add = (tag: string, attributes: Record<string, string | number>) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, String(v));
    svg.append(node);
  };
  const body = length * 0.865;
  const third = width / 3;
  // Rubber, ferrule, three painted facets (lit from the far side), the sharpened cone and the lead.
  add("rect", { x: 0, y: 1, width: 22, height: width - 2, rx: 3, fill: "#b9675b" });
  add("rect", { x: 20, y: 0, width: 24, height: width, fill: "#a9a59a" });
  for (const x of [25, 31, 37]) add("rect", { x, y: 0, width: 2, height: width, fill: "#7f7b70" });
  add("rect", { x: 44, y: 0, width: body - 44, height: third, fill: "#d9a33a" });
  add("rect", { x: 44, y: third, width: body - 44, height: third, fill: "#c48a25" });
  add("rect", { x: 44, y: third * 2, width: body - 44, height: third, fill: "#996817" });
  add("polygon", {
    points: `${body},0 ${length - 12},${width / 2 - 2.5} ${length - 12},${width / 2 + 2.5} ${body},${width}`,
    fill: "#d8b88a",
  });
  add("polygon", {
    points: `${body},${third * 2} ${length - 12},${width / 2 + 0.5} ${length - 12},${width / 2 + 2.5} ${body},${width}`,
    fill: "#b08f62",
  });
  add("polygon", {
    points: `${length - 12},${width / 2 - 2.5} ${length},${width / 2} ${length - 12},${width / 2 + 2.5}`,
    fill: "#3a3836",
  });
  return svg;
}

/** A box standing on the desk, turned about the vertical; its faces take the lamp's light. */
function box(
  cx: number,
  cy: number,
  width: number,
  depth: number,
  height: number,
  turnDeg: number,
  colour: V3,
  baseZ = 0,
): HTMLDivElement {
  const a = (turnDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // The box's own right and near directions on the desk.
  const r: V3 = [c, s, 0];
  const f: V3 = [-s, c, 0];
  const at = (u: number, v: number, z: number): V3 => [cx + r[0] * u + f[0] * v, cy + r[1] * u + f[1] * v, z];
  const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
  const down: V3 = [0, 0, -1];
  const top = baseZ + height;
  const hw = width / 2;
  const hd = depth / 2;
  const group = el("hachure-desk-box", { transformStyle: "preserve-3d" });
  group.append(
    face(width, depth, at(-hw, -hd, top), r, f, shade(colour, [0, 0, 1])),
    face(width, height, at(-hw, hd, top), r, down, shade(colour, f)),
    face(depth, height, at(hw, hd, top), neg(f), down, shade(colour, r)),
    face(depth, height, at(-hw, -hd, top), f, down, shade(colour, neg(r))),
    face(width, height, at(hw, -hd, top), neg(r), down, shade(colour, neg(f))),
  );
  return group;
}

/** A glazed mug of tea: a ring of lit strips outside and inside, a rim, the tea and a handle. */
function mug(cx: number, cy: number, radius: number, height: number, handleDeg: number): HTMLDivElement {
  const group = el("hachure-desk-mug", { transformStyle: "preserve-3d" });
  const glaze: V3 = [58, 82, 126];
  const inside: V3 = [214, 208, 192];
  const strips = 28;
  const wall = 8;
  const teaDepth = 34;
  const down: V3 = [0, 0, -1];
  for (let i = 0; i < strips; i++) {
    const t = ((i + 0.5) / strips) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const w = 2 * radius * Math.tan(Math.PI / strips) + 0.8;
    const along: V3 = [s, -c, 0];
    // A darker foot and a soft highlight band, on the glaze the lamp gives this strip.
    const outer = face(
      w,
      height,
      [cx + radius * c - (along[0] * w) / 2, cy + radius * s - (along[1] * w) / 2, height],
      along,
      down,
      shade(glaze, [c, s, 0], 0.42, 0.9),
    );
    outer.style.backgroundImage =
      "linear-gradient(to bottom, rgba(255,255,255,.14), rgba(255,255,255,0) 22%, rgba(0,0,0,0) 70%, rgba(0,0,0,.28))";
    const ri = radius - wall;
    const wi = 2 * ri * Math.tan(Math.PI / strips) + 0.8;
    const inner = face(
      wi,
      teaDepth,
      [cx + ri * c + (along[0] * wi) / 2, cy + ri * s + (along[1] * wi) / 2, height],
      [-along[0], -along[1], 0],
      down,
      shade(inside, [-c, -s, 0], 0.5, 0.6),
    );
    group.append(outer, inner);
  }
  const disc = (r: number, z: number, style: Partial<CSSStyleDeclaration>) =>
    el("hachure-desk-face", {
      width: `${r * 2}px`,
      height: `${r * 2}px`,
      borderRadius: "50%",
      transform: `translate3d(${cx - r}px, ${cy - r}px, ${z}px)`,
      ...style,
    });
  group.append(
    disc(radius - wall + 1, height - teaDepth, {
      background: "radial-gradient(circle at 34% 30%, #8a5a2c, #5b3416 55%, #40230e)",
    }),
    disc(radius, height, {
      border: `${wall}px solid ${shade(glaze, [0, 0, 1], 0.5, 0.75)}`,
      boxSizing: "border-box",
    }),
  );
  // The handle: a rounded loop in the upright plane through the mug's axis, two sheets thick.
  const a = (handleDeg * Math.PI) / 180;
  const out: V3 = [Math.cos(a), Math.sin(a), 0];
  const side: V3 = [-out[1], out[0], 0];
  for (const offset of [-7, 0, 7]) {
    const loop = face(
      radius * 0.62,
      height * 0.56,
      [
        cx + out[0] * (radius - 3) + side[0] * offset,
        cy + out[1] * (radius - 3) + side[1] * offset,
        height * 0.8,
      ],
      out,
      down,
      "transparent",
      true,
    );
    Object.assign(loop.style, {
      boxSizing: "border-box",
      border: `15px solid ${shade(glaze, offset > 0 ? side : [-side[0], -side[1], 0], 0.45, 0.8)}`,
      borderLeft: "0",
      borderRadius: `0 ${radius * 0.5}px ${radius * 0.5}px 0`,
    });
    group.append(loop);
  }
  return group;
}

export function createStudyDesk(book: HTMLElement, options: StudyDeskOptions = {}): { dispose(): void } {
  const design = options.designWidthPx ?? 1040;
  const depth = options.depthPx ?? 56;
  const boards = options.boards ?? { sidePx: 38, topPx: 14, bottomPx: 16 };
  const root = el("hachure-desk", { inset: "0", transformStyle: "preserve-3d", pointerEvents: "none" });
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  book.prepend(root);
  let wood: string | null = null;
  let disposed = false;

  const build = () => {
    const width = book.clientWidth;
    const bookHeight = book.clientHeight;
    if (!width || !bookHeight) return;
    const unit = width / design;
    const W = design;
    const H = bookHeight / unit;
    const space = el("hachure-desk-space", {
      transformOrigin: "0 0",
      transform: `scale3d(${unit}, ${unit}, ${unit})`,
      transformStyle: "preserve-3d",
    });
    // ---- The top: one flat layer below the paper, carrying everything that lies flat. ----
    const half = 2800;
    const top = el("hachure-desk-top", {
      left: `${W / 2 - half}px`,
      top: `${H / 2 - half}px`,
      width: `${half * 2}px`,
      height: `${half * 2}px`,
      transform: `translateZ(${-depth}px)`,
      backgroundColor: "#6b4a30",
      backgroundImage: wood ? `url("${wood}")` : "none",
      backgroundSize: "1600px 1000px",
      overflow: "hidden",
    });
    // Positions below are book coordinates (origin: the paper's top-left corner), moved into the layer.
    const ox = half - W / 2;
    const oy = half - H / 2;
    const lightX = ox - W * 0.08;
    const lightY = oy - H * 0.22;
    const lamp = el("hachure-desk-light", {
      inset: "0",
      background: [
        `radial-gradient(circle at ${lightX}px ${lightY}px, rgba(255,226,176,.46), rgba(255,208,146,.22) 620px, rgba(255,200,130,.06) 1250px, rgba(255,200,130,0) 1700px)`,
        `radial-gradient(circle at ${ox + W * 0.4}px ${oy + H * 0.42}px, rgba(22,12,5,0) 640px, rgba(22,12,5,.38) 1150px, rgba(18,10,4,.82) 1900px, rgba(14,8,3,.96) 2600px)`,
      ].join(","),
    });
    top.append(lamp);
    const flat = el("hachure-desk-objects", { transform: `translate(${ox}px, ${oy}px)` });
    const shadows = el("hachure-desk-shadows", { transform: `translate(${ox}px, ${oy}px)` });
    // The book's shadow: close and dark where the boards meet the wood, longer and softer away from the lamp.
    const bw = W + boards.sidePx * 2;
    const bh = H + boards.topPx + boards.bottomPx;
    const bookShadow = el("hachure-desk-book-shadow", {
      width: `${bw}px`,
      height: `${bh}px`,
      borderRadius: "6px",
      transform: `translate(${-boards.sidePx}px, ${-boards.topPx}px)`,
      boxShadow: [
        "0 0 10px 3px rgba(20,10,3,.6)",
        `${SHADOW[0] * depth * 0.55}px ${SHADOW[1] * depth * 0.55}px 16px 2px rgba(20,10,3,.5)`,
        `${SHADOW[0] * depth}px ${SHADOW[1] * depth}px 46px 10px rgba(20,10,3,.42)`,
      ].join(","),
    });
    // Objects beside the book: paper and pencil on the left near corner, eraser and mug on the right.
    const sheet = (x: number, y: number, turn: number, ruled: boolean) =>
      el("hachure-desk-sheet", {
        width: "470px",
        height: "660px",
        transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`,
        backgroundColor: "#e7e0cf",
        backgroundImage: ruled
          ? "repeating-linear-gradient(to bottom, rgba(70,96,130,0) 0 27px, rgba(70,96,130,.26) 27px 28px)"
          : "none",
        boxShadow: "3px 4px 7px rgba(20,10,3,.42)",
      });
    const pencilAt = { x: -205, y: 150, turn: -58, length: 400, width: 18 };
    const pencilNode = el("hachure-desk-pencil", {
      width: `${pencilAt.length}px`,
      height: `${pencilAt.width}px`,
      transform: `translate(${pencilAt.x - pencilAt.length / 2}px, ${pencilAt.y - pencilAt.width / 2}px) rotate(${pencilAt.turn}deg)`,
    });
    pencilNode.append(pencil(pencilAt.length, pencilAt.width));
    const eraser = { x: W + 128, y: H * 0.36, w: 120, d: 52, h: 28, turn: 74 };
    const cup = { x: W + 190, y: -40, r: 86, h: 176 };
    const cupReach = Math.hypot(SHADOW[0], SHADOW[1]) * cup.h;
    const cupShadow = el("hachure-desk-shadow", {
      width: `${cupReach + cup.r * 2}px`,
      height: `${cup.r * 2}px`,
      borderRadius: `${cup.r}px`,
      background: "linear-gradient(to right, rgba(24,12,4,.62), rgba(24,12,4,.26))",
      filter: "blur(9px)",
      transformOrigin: `${cup.r}px ${cup.r}px`,
      transform: `translate(${cup.x - cup.r}px, ${cup.y - cup.r}px) rotate(${(Math.atan2(SHADOW[1], SHADOW[0]) * 180) / Math.PI}deg)`,
    });
    if (options.objects !== false) {
      flat.append(sheet(-420, -250, -8, false), sheet(-455, -190, 5, true));
      shadows.append(
        castShadow(pencilAt.x, pencilAt.y, pencilAt.length, pencilAt.width, pencilAt.turn, 9, 3, 0.5),
        castShadow(eraser.x, eraser.y, eraser.w, eraser.d, eraser.turn, eraser.h * 0.6, 5, 0.55),
        cupShadow,
      );
    }
    top.append(flat, bookShadow, shadows);
    if (options.objects !== false) {
      const above = el("hachure-desk-objects", { transform: `translate(${ox}px, ${oy}px)` });
      above.append(pencilNode);
      top.append(above);
    }
    space.append(top);
    // ---- Things that stand up from the top. ----
    if (options.objects !== false) {
      const standing = el("hachure-desk-objects hachure-desk-standing", {
        transform: `translateZ(${-depth}px)`,
        transformStyle: "preserve-3d",
      });
      const sleeve = box(
        eraser.x,
        eraser.y,
        eraser.w * 0.56,
        eraser.d + 1.5,
        eraser.h + 1,
        eraser.turn,
        [52, 86, 128],
      );
      standing.append(
        box(eraser.x, eraser.y, eraser.w, eraser.d, eraser.h, eraser.turn, [232, 228, 218]),
        sleeve,
        mug(cup.x, cup.y, cup.r, cup.h, 38),
      );
      space.append(standing);
    }
    root.replaceChildren(space);
  };

  const observer = new ResizeObserver(build);
  observer.observe(book);
  build();
  void woodTextureUrl(options.seed ?? 7).then((url) => {
    if (disposed || !url) return;
    wood = url;
    build();
  });
  return {
    dispose() {
      disposed = true;
      observer.disconnect();
      root.remove();
    },
  };
}
