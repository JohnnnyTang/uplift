/**
 * Bindings: how live values reach page text. Syntax: `{{namespace.key}}`.
 *
 * - `probe.<id>`: a scalar probe declared by the spread.
 * - `control.<id>`: the current value of a slider or speed control.
 * - `scene.<key>`: a value derived from the scene and engine config (keys below), or
 *   `scene.duration.<id>` for a duration declared in `scene.durations` (tension T3).
 */

export const BINDING_NAMESPACES = ["probe", "scene", "control"] as const;
export type BindingNamespace = (typeof BINDING_NAMESPACES)[number];

/** Scene values the runtime derives and keeps live. None of them is typed by a spread author. */
export const SCENE_BINDING_KEYS = [
  /** The time-compression label, for example "1 s ≈ 1,000 years" (unit in the label). */
  "timeScale",
  /** Simulated years per real second at the current speed (unit: years per second). */
  "simYearsPerRealSecond",
  /** Simulated time since the last reset (unit: years). */
  "simYearsElapsed",
  /** The scale-bar label, for example "500 m". */
  "scaleBar",
  /** Cell size (unit: metres). */
  "metresPerCell",
  /** Side length of the terrain (unit: metres). */
  "terrainWidthM",
  /** Cells per side at the current device tier (unit: cells). */
  "gridSize",
] as const;
export type SceneBindingKey = (typeof SCENE_BINDING_KEYS)[number];

export interface Binding {
  /** The binding as written, braces included. */
  readonly raw: string;
  readonly namespace: string;
  /** Everything after the first dot, for example "sedimentOut" or "duration.predictSpan". */
  readonly key: string;
  /** Offset of `raw` in the text. */
  readonly index: number;
}

const BINDING = /\{\{\s*([A-Za-z]+)\.([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\s*\}\}/g;
const ANY_BRACES = /\{\{[^}]*\}\}|\{\{|\}\}/g;

/** Every well-formed binding in a text, in order. */
export function parseBindings(text: string): Binding[] {
  return [...text.matchAll(BINDING)].map((m) => ({
    raw: m[0],
    namespace: m[1]!,
    key: m[2]!,
    index: m.index,
  }));
}

/** Brace groups that are not well-formed bindings, for example `{{probe}}` or a stray `{{`. */
export function findMalformedBindings(text: string): string[] {
  const wellFormed = new Set(parseBindings(text).map((b) => b.index));
  return [...text.matchAll(ANY_BRACES)].filter((m) => !wellFormed.has(m.index)).map((m) => m[0]);
}

/**
 * Typed numbers in a text, after removing bindings. A digit run counts unless it is part of a word: digits
 * after a letter (CO2, H2O) and the dimension words 2D and 3D are allowed. Everything else, including
 * "10,000", "0.5", "1st" and "10km", is reported. (Ordinals and units glued to numbers are still numbers.)
 */
export function findTypedNumbers(text: string): string[] {
  const stripped = text.replace(BINDING, " ");
  const found: string[] = [];
  for (const m of stripped.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const before = stripped[m.index - 1] ?? "";
    const after = stripped.slice(m.index + m[0].length);
    if (/[A-Za-z]/.test(before)) continue; // CO2, H2O, x1
    if (/^D(?![A-Za-z])/.test(after) && (m[0] === "2" || m[0] === "3")) continue; // 2D, 3D
    found.push(m[0] + (after.match(/^[A-Za-z%°]+/)?.[0] ?? ""));
  }
  return found;
}
