/**
 * Physical CSS-3D book furniture around a flat DOM reading plane.
 * The gutter curves below that plane; the figure/camera anchor stays at z=0.
 */
export function createBookBinding(book: HTMLElement): { dispose(): void } {
  const root = document.createElement("div");
  root.className = "hachure-book-binding";
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "absolute",
    inset: "0",
    transformStyle: "preserve-3d",
    pointerEvents: "none",
  });
  book.prepend(root);
  const depth = 48;
  const ns = "http://www.w3.org/2000/svg";
  const build = () => {
    const width = book.clientWidth;
    if (!width) return;
    const halfGutter = Math.min(32, width * 0.034);
    const centre = width / 2;
    // A rounded trough: zero slope where the curved paper meets each reading plane.
    const recess = (x: number) => {
      const t = Math.min(1, Math.abs(x - centre) / halfGutter);
      return 22 * (1 - t * t * (3 - 2 * t));
    };
    const nodes: Element[] = [];
    const surface = (x: number, w: number, z: number, angle = 0) => {
      const strip = document.createElement("div");
      strip.className = "hachure-binding-paper";
      Object.assign(strip.style, {
        position: "absolute",
        top: "0",
        left: `${x}px`,
        width: `${w + 1.2}px`,
        height: "100%",
        transformOrigin: "0 50%",
        transform: `translateZ(${z}px) rotateY(${angle}rad)`,
        background: "var(--book-paper, #faf8f2)",
      });
      nodes.push(strip);
    };
    surface(0, centre - halfGutter, 0);
    surface(centre + halfGutter, centre - halfGutter, 0);
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const x = centre - halfGutter + (i / segments) * halfGutter * 2;
      const next = centre - halfGutter + ((i + 1) / segments) * halfGutter * 2;
      const z = -recess(x);
      const dz = -recess(next) - z;
      surface(x, Math.hypot(next - x, dz), z, -Math.atan2(dz, next - x));
      const strip = nodes[nodes.length - 1] as HTMLElement;
      // Tone follows the actual paper slope; the trough's silhouette carries the depth.
      const slope = dz / (next - x);
      const shade = Math.round(246 + Math.min(0, slope) * 12);
      strip.style.background = `rgb(${shade}, ${shade - 3}, ${shade - 11})`;
    }
    const face = document.createElementNS(ns, "svg");
    face.setAttribute("viewBox", `0 0 ${width} ${depth}`);
    face.setAttribute("preserveAspectRatio", "none");
    Object.assign(face.style, {
      position: "absolute",
      left: "0",
      top: "100%",
      width: "100%",
      height: `${depth}px`,
      overflow: "visible",
      transformOrigin: "0 0",
      transform: "rotateX(-90deg)",
    });
    const profile = (layer: number) => {
      const points: string[] = [];
      for (let i = 0; i <= 80; i++) {
        const x = (i / 80) * width;
        const y = layer + recess(x) * (1 - layer / depth);
        points.push(`${x + ((x - centre) / centre) * layer * 0.6},${y}`);
      }
      return points.join(" ");
    };
    const fill = document.createElementNS(ns, "polygon");
    fill.setAttribute("points", `${profile(0)} ${width + depth * 0.6},${depth} ${-depth * 0.6},${depth}`);
    fill.setAttribute("fill", "#e6e0d0");
    face.append(fill);
    for (let y = 2; y < depth; y += 2.4) {
      const line = document.createElementNS(ns, "polyline");
      line.setAttribute("points", profile(y));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#b9b09c");
      line.setAttribute("stroke-width", "0.65");
      face.append(line);
    }
    nodes.push(face);
    // Solid outer fore-edges, ruled along the thickness, on both halves of the book.
    for (const right of [false, true]) {
      const edge = document.createElementNS(ns, "svg");
      edge.setAttribute("viewBox", `0 0 ${depth} ${book.clientHeight}`);
      edge.setAttribute("preserveAspectRatio", "none");
      const paper = document.createElementNS(ns, "rect");
      paper.setAttribute("width", String(depth));
      paper.setAttribute("height", String(book.clientHeight));
      paper.setAttribute("fill", "#e6e0d0");
      edge.append(paper);
      for (let x = 2; x < depth; x += 2.4) {
        const rule = document.createElementNS(ns, "line");
        rule.setAttribute("x1", String(x));
        rule.setAttribute("x2", String(x));
        rule.setAttribute("y1", "0");
        rule.setAttribute("y2", String(book.clientHeight));
        rule.setAttribute("stroke", "#b9b09c");
        rule.setAttribute("stroke-width", "0.65");
        edge.append(rule);
      }
      Object.assign(edge.style, {
        position: "absolute",
        top: "0",
        left: right ? "100%" : "0",
        width: `${depth}px`,
        height: "100%",
        transformOrigin: "0 0",
        transform: `matrix3d(${right ? 0.6 : -0.6},0,-1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1)`,

        border: "1px solid #b9b09c",
      });
      nodes.push(edge);
    }
    root.replaceChildren(...nodes);
  };
  const observer = new ResizeObserver(build);
  observer.observe(book);
  build();
  return {
    dispose() {
      observer.disconnect();
      root.remove();
    },
  };
}
