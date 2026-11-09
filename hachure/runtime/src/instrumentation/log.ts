import type { TerrainConfig } from "@hachure/terrain";
import type { Level } from "../schema/spread";

/** v1 is scoped to Demo 1 and its validated recorded rain comparison. */
export const LEARNING_LOG_VERSION = 1;
export const DEFAULT_EVENT_LIMIT = 500;
const CONFIG_NUMBERS = [
  "gridSize",
  "metresPerCell",
  "seed",
  "rainMmPerHr",
  "gravityMPerS2",
  "pipeAreaM2",
  "manningNSPerMOneThird",
  "dtSimSeconds",
  "morphAccelerationFactor",
  "capacityCoefficient",
  "erosionRatePerS",
  "depositionRatePerS",
  "talusAngleDeg",
  "thermalRatePerS",
  "evaporationFractionPerStep",
  "brushMaxHeightM",
  "brushMaxDepthM",
  "brushMaxRadiusM",
  "brushMaxSlopeDeg",
] as const;
export interface LearningContext {
  readonly level: Level;
  readonly live: null | {
    readonly seed: number;
    readonly modelStep: number;
    readonly backend: "webgpu" | "cpu-worker" | "cpu-64" | "flat";
    readonly config: TerrainConfig;
  };
  readonly recorded: {
    readonly comparison: "rain-gross-erosion-v1";
    readonly seed: number;
    readonly modelStep: number;
    readonly dtSimSeconds: number;
    readonly rainMmPerHr: readonly [number, number];
  };
}
type BrushSettings = {
  readonly tool: "raise" | "dig" | "smooth" | "harden";
  readonly radiusM: number;
  readonly amount: number;
};
export type LearningAction =
  | { readonly kind: "collection"; readonly action: "start" | "stop" }
  | { readonly kind: "prediction"; readonly choice: number }
  | {
      readonly kind: "comparison";
      readonly action: "play" | "pause" | "scrub" | "seed" | "endpoint" | "reset";
    }
  | { readonly kind: "flap"; readonly open: boolean }
  | { readonly kind: "challenge"; readonly status: "pending" | "unavailable" }
  | { readonly kind: "level"; readonly level: Level }
  | {
      readonly kind: "control";
      readonly control: "rain" | "speed" | "capacityCoefficient" | "erosionRatePerS" | "depositionRatePerS";
      readonly value: number;
    }
  | { readonly kind: "playback"; readonly action: "play" | "pause" }
  | { readonly kind: "brush-settings"; readonly settings: BrushSettings }
  | {
      readonly kind: "tool";
      readonly settings: BrushSettings;
      readonly at: { readonly xM: number; readonly yM: number };
      readonly clamped: boolean;
      readonly applied: boolean;
    }
  | { readonly kind: "reset" }
  | { readonly kind: "restore-defaults" }
  | { readonly kind: "learning-check"; readonly phase: "pre" | "post"; readonly answer: 0 | 1 | 2 };
export interface LearningEvent {
  readonly version: typeof LEARNING_LOG_VERSION;
  readonly sequence: number;
  readonly source: "live" | "recorded" | "lesson";
  readonly context: LearningContext;
  readonly action: LearningAction;
}
export interface LearningExport {
  readonly version: typeof LEARNING_LOG_VERSION;
  readonly scope: "rain-gross-erosion";
  readonly droppedEvents: number;
  readonly events: readonly LearningEvent[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keys = (value: unknown, expected: readonly string[]): value is Record<string, unknown> =>
  object(value) &&
  Reflect.ownKeys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value);
const level = (value: unknown) => value === "hs" || value === "uni";
const oneOf = (value: unknown, choices: readonly string[]) =>
  typeof value === "string" && choices.includes(value);
const pair = (value: unknown) =>
  Array.isArray(value) &&
  Object.getPrototypeOf(value) === Array.prototype &&
  value.length === 2 &&
  Reflect.ownKeys(value).length === 3 &&
  !("toJSON" in value) &&
  number(Object.getOwnPropertyDescriptor(value, "0")?.value) &&
  number(Object.getOwnPropertyDescriptor(value, "1")?.value);
function config(value: unknown): value is TerrainConfig {
  return (
    keys(value, [...CONFIG_NUMBERS, "hardnessRange"]) &&
    CONFIG_NUMBERS.every((key) => number(value[key])) &&
    pair(value.hardnessRange)
  );
}
export function captureLearningConfig(value: TerrainConfig): TerrainConfig {
  // Copy only the contract's numeric parameters; never include arbitrary host metadata.
  return Object.fromEntries([
    ...CONFIG_NUMBERS.map((key) => [key, value[key]]),
    ["hardnessRange", [...value.hardnessRange]],
  ]) as unknown as TerrainConfig;
}
function context(value: unknown): value is LearningContext {
  if (!keys(value, ["level", "live", "recorded"]) || !level(value.level)) return false;
  if (
    value.live !== null &&
    !(
      keys(value.live, ["seed", "modelStep", "backend", "config"]) &&
      integer(value.live.seed) &&
      integer(value.live.modelStep) &&
      oneOf(value.live.backend, ["webgpu", "cpu-worker", "cpu-64", "flat"]) &&
      config(value.live.config) &&
      value.live.seed === value.live.config.seed
    )
  )
    return false;
  const r = value.recorded;
  return (
    keys(r, ["comparison", "seed", "modelStep", "dtSimSeconds", "rainMmPerHr"]) &&
    r.comparison === "rain-gross-erosion-v1" &&
    integer(r.seed) &&
    integer(r.modelStep) &&
    number(r.dtSimSeconds) &&
    r.dtSimSeconds > 0 &&
    pair(r.rainMmPerHr)
  );
}
function settings(value: unknown): value is BrushSettings {
  return (
    keys(value, ["tool", "radiusM", "amount"]) &&
    oneOf(value.tool, ["raise", "dig", "smooth", "harden"]) &&
    number(value.radiusM) &&
    number(value.amount)
  );
}
function action(value: unknown): value is LearningAction {
  if (!object(value)) return false;
  switch (value.kind) {
    case "collection":
      return keys(value, ["kind", "action"]) && oneOf(value.action, ["start", "stop"]);
    case "prediction":
      return keys(value, ["kind", "choice"]) && integer(value.choice) && value.choice <= 3;
    case "comparison":
      return (
        keys(value, ["kind", "action"]) &&
        oneOf(value.action, ["play", "pause", "scrub", "seed", "endpoint", "reset"])
      );
    case "flap":
      return keys(value, ["kind", "open"]) && typeof value.open === "boolean";
    case "challenge":
      return keys(value, ["kind", "status"]) && oneOf(value.status, ["pending", "unavailable"]);
    case "level":
      return keys(value, ["kind", "level"]) && level(value.level);
    case "control":
      return (
        keys(value, ["kind", "control", "value"]) &&
        oneOf(value.control, [
          "rain",
          "speed",
          "capacityCoefficient",
          "erosionRatePerS",
          "depositionRatePerS",
        ]) &&
        number(value.value)
      );
    case "playback":
      return keys(value, ["kind", "action"]) && oneOf(value.action, ["play", "pause"]);
    case "brush-settings":
      return keys(value, ["kind", "settings"]) && settings(value.settings);
    case "tool":
      return (
        keys(value, ["kind", "settings", "at", "clamped", "applied"]) &&
        settings(value.settings) &&
        keys(value.at, ["xM", "yM"]) &&
        number(value.at.xM) &&
        number(value.at.yM) &&
        typeof value.clamped === "boolean" &&
        typeof value.applied === "boolean"
      );
    case "restore-defaults":
    case "reset":
      return keys(value, ["kind"]);
    case "learning-check":
      return (
        keys(value, ["kind", "phase", "answer"]) &&
        oneOf(value.phase, ["pre", "post"]) &&
        integer(value.answer) &&
        value.answer <= 2
      );
    default:
      return false;
  }
}
function source(value: LearningAction): LearningEvent["source"] {
  if (["prediction", "comparison", "flap", "learning-check"].includes(value.kind)) return "recorded";
  if (["control", "playback", "brush-settings", "tool", "reset", "restore-defaults"].includes(value.kind))
    return "live";
  return "lesson";
}
/** Strict extra-key rejection keeps identity/free-text fields out at every nesting level. */
export function isLearningEvent(value: unknown): value is LearningEvent {
  try {
    return (
      keys(value, ["version", "sequence", "source", "context", "action"]) &&
      value.version === LEARNING_LOG_VERSION &&
      integer(value.sequence) &&
      context(value.context) &&
      action(value.action) &&
      value.source === source(value.action)
    );
  } catch {
    return false;
  }
}

/** Pure local collection: no clock, identifier, storage or network dependency. */
export function createLearningLog(readContext: () => LearningContext, capacity = DEFAULT_EVENT_LIMIT) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2000)
    throw new RangeError("Invalid local event limit");
  let enabled = false,
    sequence = 0,
    dropped = 0;
  const events: LearningEvent[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* Observers cannot affect collection or model actions. */
      }
    }
  };
  function record(value: LearningAction): boolean {
    if (!enabled) return false;
    try {
      const event: LearningEvent = {
        version: LEARNING_LOG_VERSION,
        sequence,
        source: source(value),
        context: readContext(),
        action: value,
      };
      if (!isLearningEvent(event)) return false;
      // Serialization can invoke accessors or custom hooks after the input check.
      // Retain only the validated JSON representation, before eviction or sequencing.
      const copy: unknown = JSON.parse(JSON.stringify(event));
      if (!isLearningEvent(copy)) return false;
      if (events.length === capacity) {
        events.shift();
        dropped++;
      }
      events.push(copy);
      sequence++;
      notify();
      return true;
    } catch {
      return false;
    }
  }
  return {
    record,
    start() {
      if (enabled) return;
      enabled = true;
      record({ kind: "collection", action: "start" });
      notify();
    },
    stop() {
      if (!enabled) return;
      record({ kind: "collection", action: "stop" });
      enabled = false;
      notify();
    },
    clear() {
      events.length = 0;
      sequence = 0;
      dropped = 0;
      notify();
    },
    exportJson(): string {
      return JSON.stringify(
        {
          version: LEARNING_LOG_VERSION,
          scope: "rain-gross-erosion",
          droppedEvents: dropped,
          events,
        } satisfies LearningExport,
        null,
        2,
      );
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get enabled() {
      return enabled;
    },
    get size() {
      return events.length;
    },
    get droppedEvents() {
      return dropped;
    },
    capacity,
  };
}
export type LearningLog = ReturnType<typeof createLearningLog>;
