/**
 * Spread schema v0: the declarative definition of one spread, refined from the handoff's draft
 * ("Spread specification format") for Demo 1's needs. Deliberately thin (tension T9); v1 comes in Stage 2.
 *
 * The schema is engine-agnostic: it never imports an engine package. Engine parameter names, tool kinds
 * and probe kinds are plain strings here, and `validateSpread` checks them against an `EngineCatalogue`
 * the caller passes in (for the terrain engine, built from `@hachure/terrain`).
 *
 * Page and model agree: no text field may contain a typed number. Numbers reach the page only through
 * bindings, `{{namespace.key}}`, resolved against live state (see `bindings.ts`).
 */

export const SCHEMA_VERSION = 0;

export const LEVELS = ["hs", "uni"] as const;
/** Reading level: high school or university. */
export type Level = (typeof LEVELS)[number];

/**
 * Text at both levels. Both are required, so switching level always has something to show; repeat the text
 * when it is the same. May contain bindings.
 */
export type LevelText = Readonly<Record<Level, string>>;

export const TIERS = ["physical-law", "process-model", "stylised-theory", "agent-stochastic"] as const;
/** The model's rigour tier, shown as a badge (handoff, "Scientific rigour policy"). */
export type Tier = (typeof TIERS)[number];

export const ENGINES = ["terrain", "human", "scene"] as const;
export type EngineId = (typeof ENGINES)[number];

/** A 3-vector in terrain widths, origin at the terrain centre, +y up (unit: terrain widths). */
export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view (unit: degrees). */
  readonly fovDeg: number;
}

/** A duration the page may mention, bound as `{{scene.duration.<id>}}` (tension T3). */
export interface SceneDuration {
  /** Length of the duration (unit: simulated years). */
  readonly simYears: number;
}

export interface SceneSpec {
  /** Preset id, for example "tilted-plateau". Grid size comes from the device tier, not the spread. */
  readonly preset: string;
  /** Seed for the preset and for any randomness (unit: none; unsigned 32-bit integer). */
  readonly seed: number;
  readonly camera: CameraPose;
  /**
   * Solver steps per real second at normal speed (unit: steps per second). The time-scale label is
   * derived from this and the engine's simulated years per step; it is never typed (tension T4).
   */
  readonly stepsPerRealSecond: number;
  /** Engine parameter overrides for this spread, by engine parameter name. */
  readonly params?: Readonly<Record<string, number>>;
  /** Named durations the page text can bind to. */
  readonly durations?: Readonly<Record<string, SceneDuration>>;
}

interface ControlBase {
  /** Unique among the spread's controls and probes. Bound as `{{control.<id>}}`. */
  readonly id: string;
  readonly label: LevelText;
  /** Levels at which the control is shown. Hiding a control never changes the model (tension T7). */
  readonly levels: readonly Level[];
}

/** A slider bound to one engine parameter. `min`/`max` are the reader clamps. */
export interface SliderControl extends ControlBase {
  readonly kind: "slider";
  /** Engine parameter name, for example "rainMmPerHr". */
  readonly param: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  /** Display unit, for example "mm/h". */
  readonly unit: string;
}

/** An inclusive range with a default. */
export interface ClampedRange {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

/** A brush that applies an engine tool. Ranges are the reader clamps. */
export interface BrushControl extends ControlBase {
  readonly kind: "brush";
  /** Engine tool kind, for example "harden". */
  readonly tool: string;
  /** Brush radius (unit: metres). */
  readonly radiusM: ClampedRange;
  /** Tool strength in the tool's own unit (height or depth in metres, hardness, smoothing fraction). */
  readonly strength: ClampedRange & { readonly unit: string };
}

/** Simulation speed as a multiple of `stepsPerRealSecond`. */
export interface SpeedControl extends ControlBase {
  readonly kind: "speed";
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
}

export const ACTIONS = ["play-pause", "reset", "step"] as const;
export type ActionId = (typeof ACTIONS)[number];

/** A button. */
export interface ActionControl extends ControlBase {
  readonly kind: "action";
  readonly action: ActionId;
}

export type Control = SliderControl | BrushControl | SpeedControl | ActionControl;
export type ControlKind = Control["kind"];

/**
 * A live value the page may show. `shape: "scalar"` probes can be bound in text; `"series"` probes feed
 * graphs (for example the long profile) and cannot be bound in text.
 */
export interface Probe {
  /** Unique among the spread's controls and probes. Bound as `{{probe.<id>}}`. */
  readonly id: string;
  readonly label: LevelText;
  /** Engine probe request: `kind` is the engine's probe kind, the rest are its parameters. */
  readonly request: { readonly kind: string } & Readonly<Record<string, unknown>>;
  /** For a probe whose result has several fields, the field to read, for example "exportedSedimentM3". */
  readonly field?: string;
  readonly shape: "scalar" | "series";
  /** Display unit, for example "m³". */
  readonly unit: string;
  /** Significant figures for display. */
  readonly significantFigures: number;
  /** Levels at which the probe is shown. Defaults to every level. */
  readonly levels?: readonly Level[];
}

export const COMPARATORS = [">", ">=", "<", "<="] as const;
export type Comparator = (typeof COMPARATORS)[number];

/** A challenge condition, evaluated against live simulation state, never against the page. */
export type ChallengeCheck =
  | {
      readonly kind: "probe-threshold";
      /** A scalar probe id. */
      readonly probe: string;
      readonly comparator: Comparator;
      /** Threshold in the probe's unit. */
      readonly threshold: number;
      /** How long the condition must hold (unit: simulated years). 0 means "at any instant". */
      readonly sustainSimYears: number;
    }
  | { readonly kind: "all"; readonly checks: readonly ChallengeCheck[] }
  | { readonly kind: "any"; readonly checks: readonly ChallengeCheck[] };

export interface PredictSpec {
  readonly question: LevelText;
  /** Two to four choices. */
  readonly options: readonly LevelText[];
  /** Index of the correct option. */
  readonly answer: number;
  /**
   * Id of the qualitative test whose result backs the answer (tension T6). Required before expert review;
   * optional while content is drafted.
   */
  readonly answerEvidence?: string;
}

export interface KeyWord {
  readonly term: LevelText;
  readonly definition: LevelText;
}

export interface PageSpec {
  /** The left page's running text. */
  readonly body: LevelText;
  readonly predict: PredictSpec;
  /** The explanation behind the flap. */
  readonly flap: LevelText;
  /** "What this model ignores", one item per entry, at each level's depth. */
  readonly ignores: Readonly<Record<Level, readonly string[]>>;
  readonly keyWords: readonly KeyWord[];
  /**
   * University-level display equations, TeX. Exempt from the typed-number check, since constants in a
   * formula are part of the law; live parameter values go in the body as bindings.
   */
  readonly equations?: readonly string[];
}

export interface ChallengeSpec {
  readonly prompt: LevelText;
  readonly check: ChallengeCheck;
  /** The stamp awarded on success. */
  readonly stamp: { readonly id: string; readonly label: LevelText };
}

export interface Source {
  readonly citation: string;
  readonly url?: string;
  readonly doi?: string;
}

export interface Spread {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  /** "<domain>.<slug>", for example "geomorph.v-valley". */
  readonly id: string;
  readonly title: LevelText;
  readonly tags: {
    readonly domain: readonly string[];
    readonly courses: readonly string[];
    readonly levels: readonly Level[];
  };
  readonly tier: Tier;
  readonly engine: EngineId;
  readonly scene: SceneSpec;
  readonly controls: readonly Control[];
  readonly probes: readonly Probe[];
  readonly page: PageSpec;
  readonly challenge: ChallengeSpec;
  /** Path to the teacher note (markdown), relative to the spread folder. */
  readonly teacherNotes: string;
  readonly sources: readonly Source[];
}
