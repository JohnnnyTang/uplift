import {
  findMalformedBindings,
  parseBindings,
  SCENE_BINDING_KEYS,
  type Control,
  type Probe,
} from "../schema/index";
import { formatBoundNumber } from "./format";
export type BoundValue = number | string;
export interface BindingSample {
  readonly probe?: Readonly<Record<string, number>>;
  readonly scene?: Readonly<Record<string, BoundValue>>;
  readonly control?: Readonly<Record<string, number>>;
}
export interface BindingDefinitions {
  readonly probes: readonly Probe[];
  readonly controls: readonly Control[];
  readonly durationIds?: readonly string[];
}

/** Host-fed reactive text. Publish once per probe sample; no timers, solver calls or GPU readbacks here. */
export class BindingEngine {
  private readonly formats = new Map<string, { unit: string; significantFigures: number }>();
  private readonly values = new Map<string, BoundValue>();
  private readonly listeners = new Set<() => void>();
  private readonly sceneKeys: Set<string>;
  constructor(definitions: BindingDefinitions) {
    this.sceneKeys = new Set([
      ...SCENE_BINDING_KEYS,
      "timeScaleLabel",
      ...(definitions.durationIds ?? []).map((id) => `duration.${id}`),
    ]);
    for (const [key, unit] of Object.entries({
      simYearsPerRealSecond: "years/s",
      simYearsElapsed: "years",
      metresPerCell: "m",
      terrainWidthM: "m",
      gridSize: "cells",
    }))
      this.formats.set(`scene.${key}`, { unit, significantFigures: key === "gridSize" ? 4 : 3 });
    for (const id of definitions.durationIds ?? [])
      this.formats.set(`scene.duration.${id}`, { unit: "years", significantFigures: 3 });
    for (const probe of definitions.probes) {
      if (probe.shape === "scalar")
        this.formats.set(`probe.${probe.id}`, {
          unit: probe.unit,
          significantFigures: probe.significantFigures,
        });
    }
    for (const control of definitions.controls) {
      if (control.kind !== "slider" && control.kind !== "speed") continue;
      this.formats.set(`control.${control.id}`, {
        unit: control.kind === "slider" ? control.unit : "×",
        significantFigures: 4,
      });
      this.values.set(`control.${control.id}`, control.default);
    }
  }
  private canonicalKey(key: string): string {
    return key === "scene.timeScaleLabel" ? "scene.timeScale" : key;
  }
  private assertKey(key: string): void {
    if (!this.formats.has(key) && !(key.startsWith("scene.") && this.sceneKeys.has(key.slice(6))))
      throw new Error(`Unknown or non-scalar binding: ${key}`);
  }
  /** Validate before publishing so a bad sample cannot leave half-updated page text. */
  update(sample: BindingSample): void {
    const pending: [string, BoundValue][] = [];
    for (const [namespace, values] of Object.entries(sample)) {
      for (const [id, value] of Object.entries(values)) {
        const key = this.canonicalKey(`${namespace}.${id}`);
        this.assertKey(key);
        if (
          (typeof value !== "number" && typeof value !== "string") ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          throw new RangeError(`Invalid binding value: ${key}`);
        pending.push([key, value]);
      }
    }
    let changed = false;
    for (const [key, value] of pending) {
      if (this.values.get(key) !== value) {
        this.values.set(key, value);
        changed = true;
      }
    }
    if (changed) for (const listener of this.listeners) listener();
  }
  render(text: string): string {
    if (findMalformedBindings(text).length) throw new Error("Malformed binding in text");
    const bindings = parseBindings(text);
    let result = "";
    let cursor = 0;
    for (const binding of bindings) {
      const key = this.canonicalKey(`${binding.namespace}.${binding.key}`);
      this.assertKey(key);
      const value = this.values.get(key);
      const format = this.formats.get(key);
      const display =
        value === undefined
          ? "—"
          : typeof value === "string"
            ? value
            : formatBoundNumber(value, format?.unit, format?.significantFigures);
      result += text.slice(cursor, binding.index) + display;
      cursor = binding.index + binding.raw.length;
    }
    return result + text.slice(cursor);
  }
  subscribeText(text: string, listener: (text: string) => void): () => void {
    let previous = this.render(text);
    listener(previous);
    const update = () => {
      const next = this.render(text);
      if (previous !== next) {
        previous = next;
        listener(next);
      }
    };
    this.listeners.add(update);
    return () => {
      this.listeners.delete(update);
    };
  }
}
