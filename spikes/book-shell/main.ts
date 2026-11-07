import katex from "katex";
import "katex/dist/katex.min.css";

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error("Missing shell element: " + selector);
  return found;
}

const level = element<HTMLSelectElement>("#level");
const university = element<HTMLElement>("#university");
const status = element<HTMLElement>("#status");
const commit = element<HTMLButtonElement>("#commit");
const inspect = element<HTMLButtonElement>("#inspect");
const canvas = element<HTMLCanvasElement>("#terrain");

// Immutable mathematical drawing fixture. No solver or simulation clock is present.
// Level changes never touch these data or the canvas.
const surface = Object.freeze(
  Array.from({ length: 15 }, (_, ring) =>
    Object.freeze(
      Array.from({ length: 145 }, (_, point) => {
        const theta = (point / 144) * Math.PI * 2;
        const radius = 0.045 + ring * 0.026;
        return Object.freeze({
          x: 0.5 + radius * Math.cos(theta) * (1 + 0.13 * Math.sin(3 * theta)),
          y: 0.47 + radius * Math.sin(theta) * 0.77 + ring * 0.003,
        });
      }),
    ),
  ),
);

function draw(): void {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) {
    element<HTMLElement>("#canvas-fallback").hidden = false;
    return;
  }
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  context.scale(pixelRatio, pixelRatio);
  context.strokeStyle = ink;
  for (const [index, ring] of surface.entries()) {
    context.lineWidth = index % 5 === 0 ? 1.5 : 0.7;
    context.beginPath();
    for (const [point, position] of ring.entries()) {
      const x = position.x * bounds.width;
      const y = position.y * bounds.height;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.stroke();
  }
}

katex.render(String.raw`E = K A^{m} S^{n}`, element("#formula"), {
  displayMode: true,
  output: "htmlAndMathml",
  throwOnError: true,
});

level.addEventListener("change", () => {
  const isUniversity = level.value === "uni";
  university.hidden = !isUniversity;
  element("#level-text").textContent = isUniversity
    ? "Keep the same terrain in view while reading the symbolic relation. The level changes the explanation, not the drawing."
    : "Begin with a question. Make a prediction, then use the terrain view to explore it.";
  status.textContent =
    (isUniversity ? "University" : "High school") +
    " reading level. The drawing and committed prediction are unchanged.";
});

document.querySelector("fieldset")?.addEventListener("change", () => {
  commit.disabled = false;
});
commit.addEventListener("click", () => {
  const selected = document.querySelector<HTMLInputElement>('input[name="prediction"]:checked');
  if (!selected) return;
  inspect.disabled = false;
  commit.textContent = "Prediction committed";
  element("#gate-hint").textContent = "The drawing is ready to inspect.";
  status.textContent =
    "Prediction committed: " + selected.parentElement?.textContent?.trim() + ". View control unlocked.";
});
inspect.addEventListener("click", () => {
  status.textContent =
    "The contours are fixed. In the production spread this slot hosts the interactive terrain. Read its description beneath the drawing.";
});

new ResizeObserver(draw).observe(canvas);
draw();
