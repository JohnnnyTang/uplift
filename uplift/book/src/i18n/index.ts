import { LESSON_ZH } from "./lesson-zh";
import { UI_ZH, translateDynamic } from "./ui-zh";

export type Language = "en" | "zh-CN";
export const LANGUAGE_STORAGE_KEY = "uplift.language";
let language: Language = "en";
const listeners = new Set<() => void>();
export const getLanguage = (): Language => language;

/** Language changes only presentation. No scene/controller is replaced. */
export function setLanguage(next: Language): void {
  if (next !== "en" && next !== "zh-CN") return;
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    /* Reading works without storage. */
  }
  for (const listener of listeners) listener();
}
export function initializeLanguage(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    /* Private browsing. */
  }
  language = saved === "zh-CN" ? "zh-CN" : "en";
  if (typeof document !== "undefined") document.documentElement.lang = language;
}
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function translate(source: string): string {
  if (language === "en" || !source.trim()) return source;
  const key = source.trim();
  const exact = UI_ZH[key] ?? LESSON_ZH[key];
  if (exact !== undefined) return source.replace(key, exact);
  const dynamic = translateDynamic(key, translate);
  if (dynamic !== null) return source.replace(key, dynamic);
  // Authored markdown is rendered one paragraph at a time; keep citations and equations verbatim.
  if (source.includes("\n\n"))
    return source
      .split(/(\n\s*\n)/)
      .map(translate)
      .join("");
  return source;
}

// Explicit text/attribute bindings: only registered reader copy is changed. There is no
// document-wide mutation observer, no HTML replacement, and no interception of DOM APIs.
const textSources = new WeakMap<Node, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
export function writeText(node: Node, source: string | null): void {
  if (source === null) {
    textSources.delete(node);
    node.textContent = null;
    return;
  }
  textSources.set(node, source);
  node.textContent = translate(source);
}
export function textNode(source: string): Text {
  const node = document.createTextNode("");
  writeText(node, source);
  return node;
}
export function writeAttribute(node: Element, attribute: string, source: string): void {
  const map = attributeSources.get(node) ?? new Map<string, string>();
  map.set(attribute, source);
  attributeSources.set(node, map);
  node.setAttribute(attribute, translate(source));
}
export function refreshLanguage(root: Node): void {
  const source = textSources.get(root);
  if (source !== undefined) root.textContent = translate(source);
  if (root instanceof Element) {
    for (const [name, original] of attributeSources.get(root) ?? [])
      root.setAttribute(name, translate(original));
  }
  for (const child of Array.from(root.childNodes)) refreshLanguage(child);
}
/** SVG strings come from the diagram generators; register just their accessible copy. */
export function localizeDiagram(root: Element): void {
  for (const element of root.querySelectorAll("text, title, desc")) writeText(element, element.textContent);
  for (const element of root.querySelectorAll("[aria-label]"))
    writeAttribute(element, "aria-label", element.getAttribute("aria-label") ?? "");
}

export function writeMarkup(node: Element, markup: string): void {
  node.innerHTML = markup;
  localizeDiagram(node);
}

/** Localize unit words after binding; numerical values and scientific unit symbols stay intact. */
export function localizeUnits(text: string): string {
  return language === "zh-CN"
    ? text
        .replace(/model years/g, "模型年")
        .replace(/degrees/g, "度")
        .replace(/per year/g, "每年")
    : text;
}
