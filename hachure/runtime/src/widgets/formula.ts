import katex from "katex";
import "katex/dist/katex.min.css";
import { el } from "./controls";
/** Preserve semantic MathML alongside visual HTML; never paint equations into a texture. */
export function createDisplayFormula(tex: string): HTMLElement {
  const root = el("div", undefined, "widget-formula");
  katex.render(tex, root, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: true,
    trust: false,
    strict: "error",
  });
  return root;
}
