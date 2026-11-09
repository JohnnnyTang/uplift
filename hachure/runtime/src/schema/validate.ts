/**
 * Runtime validator for spread schema v0. Hand-written (no schema library) so the runtime stays
 * dependency-free. It checks structure, clamps, cross-references, bindings and the no-typed-numbers rule.
 */
import {
  BINDING_NAMESPACES,
  SCENE_BINDING_KEYS,
  findMalformedBindings,
  findTypedNumbers,
  parseBindings,
} from "./bindings";
import { ACTIONS, COMPARATORS, ENGINES, LEVELS, SCHEMA_VERSION, TIERS, type Spread } from "./spread";

/** Names the spread may refer to in its engine. Omit a list to skip that check. */
export interface EngineCatalogue {
  /** Parameter names a slider or `scene.params` may set, for example the tunable `TerrainConfig` keys. */
  readonly params?: readonly string[];
  /** Tool kinds a brush may apply. */
  readonly tools?: readonly string[];
  /** Probe request kinds. */
  readonly probeKinds?: readonly string[];
}

export type IssueCode =
  | "type"
  | "required"
  | "enum"
  | "range"
  | "count"
  | "id-format"
  | "duplicate-id"
  | "unknown-reference"
  | "unknown-binding"
  | "malformed-binding"
  | "series-binding"
  | "typed-number"
  | "unknown-param"
  | "unknown-tool"
  | "unknown-probe-kind";

export interface ValidationIssue {
  /** Where the problem is, for example "controls[2].default". */
  readonly path: string;
  readonly code: IssueCode;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly spread: Spread; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

type Obj = Record<string, unknown>;

const SPREAD_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const LOCAL_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

class Checker {
  readonly issues: ValidationIssue[] = [];
  /** Every page-visible text, for the binding and typed-number pass. */
  readonly texts: { path: string; text: string }[] = [];

  issue(path: string, code: IssueCode, message: string): void {
    this.issues.push({ path, code, message });
  }

  obj(path: string, v: unknown): Obj | undefined {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Obj;
    this.issue(path, v === undefined ? "required" : "type", `${path} must be an object`);
    return undefined;
  }

  arr(path: string, v: unknown): unknown[] | undefined {
    if (Array.isArray(v)) return v;
    this.issue(path, v === undefined ? "required" : "type", `${path} must be an array`);
    return undefined;
  }

  str(path: string, v: unknown, { nonEmpty = true } = {}): string | undefined {
    if (typeof v === "string" && (!nonEmpty || v.trim() !== "")) return v;
    this.issue(path, v === undefined ? "required" : "type", `${path} must be a non-empty string`);
    return undefined;
  }

  num(
    path: string,
    v: unknown,
    opts: { integer?: boolean; min?: number; positive?: boolean } = {},
  ): number | undefined {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.issue(path, v === undefined ? "required" : "type", `${path} must be a finite number`);
      return undefined;
    }
    if (opts.integer && !Number.isInteger(v)) this.issue(path, "type", `${path} must be an integer`);
    if (opts.min !== undefined && v < opts.min) this.issue(path, "range", `${path} must be ≥ ${opts.min}`);
    if (opts.positive && v <= 0) this.issue(path, "range", `${path} must be > 0`);
    return v;
  }

  oneOf<T extends string>(path: string, v: unknown, allowed: readonly T[]): T | undefined {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
    this.issue(path, v === undefined ? "required" : "enum", `${path} must be one of: ${allowed.join(", ")}`);
    return undefined;
  }

  /** A page-visible LevelText: both levels required; texts are queued for the binding pass. */
  levelText(path: string, v: unknown): void {
    const o = this.obj(path, v);
    if (!o) return;
    for (const level of LEVELS) {
      const text = this.str(`${path}.${level}`, o[level]);
      if (text !== undefined) this.texts.push({ path: `${path}.${level}`, text });
    }
  }

  levels(path: string, v: unknown): void {
    const a = this.arr(path, v);
    if (!a) return;
    if (a.length === 0) this.issue(path, "count", `${path} must list at least one level`);
    a.forEach((l, i) => this.oneOf(`${path}[${i}]`, l, LEVELS));
    if (new Set(a).size !== a.length) this.issue(path, "duplicate-id", `${path} lists a level twice`);
  }

  /** min < max, default in [min, max], optional step > 0. */
  range(path: string, o: Obj, withStep: boolean): void {
    const min = this.num(`${path}.min`, o.min);
    const max = this.num(`${path}.max`, o.max);
    const def = this.num(`${path}.default`, o.default);
    if (withStep) this.num(`${path}.step`, o.step, { positive: true });
    if (min === undefined || max === undefined) return;
    if (min >= max) this.issue(`${path}.min`, "range", `${path}: min must be below max`);
    if (def !== undefined && (def < min || def > max)) {
      this.issue(`${path}.default`, "range", `${path}: default ${def} is outside [${min}, ${max}]`);
    }
  }

  inCatalogue(
    path: string,
    value: string | undefined,
    list: readonly string[] | undefined,
    code: IssueCode,
  ): void {
    if (value !== undefined && list && !list.includes(value)) {
      this.issue(path, code, `${path}: "${value}" is not known to the engine`);
    }
  }
}

/** Validates an unknown value as a v0 spread. */
export function validateSpread(input: unknown, catalogue: EngineCatalogue = {}): ValidationResult {
  const c = new Checker();
  const s = c.obj("spread", input);
  if (!s) return { ok: false, issues: c.issues };

  if (s.schemaVersion !== SCHEMA_VERSION) {
    c.issue("schemaVersion", "enum", `schemaVersion must be ${SCHEMA_VERSION}`);
  }
  const id = c.str("id", s.id);
  if (id !== undefined && !SPREAD_ID.test(id)) c.issue("id", "id-format", `id must look like "domain.slug"`);
  c.levelText("title", s.title);

  const tags = c.obj("tags", s.tags);
  if (tags) {
    for (const key of ["domain", "courses"] as const) {
      c.arr(`tags.${key}`, tags[key])?.forEach((t, i) => c.str(`tags.${key}[${i}]`, t));
    }
    c.levels("tags.levels", tags.levels);
  }
  c.oneOf("tier", s.tier, TIERS);
  c.oneOf("engine", s.engine, ENGINES);

  // Scene.
  const durationIds = new Set<string>();
  const scene = c.obj("scene", s.scene);
  if (scene) {
    c.str("scene.preset", scene.preset);
    c.num("scene.seed", scene.seed, { integer: true, min: 0 });
    c.num("scene.stepsPerRealSecond", scene.stepsPerRealSecond, { positive: true });
    const camera = c.obj("scene.camera", scene.camera);
    if (camera) {
      for (const key of ["position", "target"] as const) {
        const v = c.arr(`scene.camera.${key}`, camera[key]);
        if (v && v.length !== 3)
          c.issue(`scene.camera.${key}`, "count", `scene.camera.${key} needs 3 numbers`);
        v?.forEach((n, i) => c.num(`scene.camera.${key}[${i}]`, n));
      }
      const fov = c.num("scene.camera.fovDeg", camera.fovDeg, { positive: true });
      if (fov !== undefined && fov >= 180)
        c.issue("scene.camera.fovDeg", "range", "fovDeg must be below 180");
    }
    if (scene.params !== undefined) {
      const params = c.obj("scene.params", scene.params);
      for (const [name, value] of Object.entries(params ?? {})) {
        c.num(`scene.params.${name}`, value);
        c.inCatalogue(`scene.params.${name}`, name, catalogue.params, "unknown-param");
      }
    }
    if (scene.durations !== undefined) {
      const durations = c.obj("scene.durations", scene.durations);
      for (const [name, value] of Object.entries(durations ?? {})) {
        if (!LOCAL_ID.test(name))
          c.issue(`scene.durations.${name}`, "id-format", `bad duration id "${name}"`);
        const d = c.obj(`scene.durations.${name}`, value);
        if (d) c.num(`scene.durations.${name}.simYears`, d.simYears, { positive: true });
        durationIds.add(name);
      }
    }
  }

  // Controls and probes share one id space.
  const seenIds = new Set<string>();
  const claimId = (path: string, v: unknown): string | undefined => {
    const localId = c.str(path, v);
    if (localId === undefined) return undefined;
    if (!LOCAL_ID.test(localId)) c.issue(path, "id-format", `${path}: "${localId}" is not a valid id`);
    if (seenIds.has(localId)) c.issue(path, "duplicate-id", `${path}: id "${localId}" is used twice`);
    seenIds.add(localId);
    return localId;
  };

  const valueControls = new Set<string>();
  c.arr("controls", s.controls)?.forEach((raw, i) => {
    const p = `controls[${i}]`;
    const ctl = c.obj(p, raw);
    if (!ctl) return;
    const ctlId = claimId(`${p}.id`, ctl.id);
    c.levelText(`${p}.label`, ctl.label);
    c.levels(`${p}.levels`, ctl.levels);
    const kind = c.oneOf(`${p}.kind`, ctl.kind, ["slider", "brush", "speed", "action"] as const);
    if (kind === "slider") {
      const param = c.str(`${p}.param`, ctl.param);
      c.inCatalogue(`${p}.param`, param, catalogue.params, "unknown-param");
      c.range(p, ctl, true);
      c.str(`${p}.unit`, ctl.unit, { nonEmpty: false });
    } else if (kind === "speed") {
      c.range(p, ctl, true);
    } else if (kind === "brush") {
      const tool = c.str(`${p}.tool`, ctl.tool);
      c.inCatalogue(`${p}.tool`, tool, catalogue.tools, "unknown-tool");
      const radius = c.obj(`${p}.radiusM`, ctl.radiusM);
      if (radius) c.range(`${p}.radiusM`, radius, false);
      const strength = c.obj(`${p}.strength`, ctl.strength);
      if (strength) {
        c.range(`${p}.strength`, strength, false);
        c.str(`${p}.strength.unit`, strength.unit, { nonEmpty: false });
      }
    } else if (kind === "action") {
      c.oneOf(`${p}.action`, ctl.action, ACTIONS);
    }
    if (ctlId !== undefined && (kind === "slider" || kind === "speed")) valueControls.add(ctlId);
  });

  const probeShapes = new Map<string, "scalar" | "series">();
  c.arr("probes", s.probes)?.forEach((raw, i) => {
    const p = `probes[${i}]`;
    const probe = c.obj(p, raw);
    if (!probe) return;
    const probeId = claimId(`${p}.id`, probe.id);
    c.levelText(`${p}.label`, probe.label);
    const request = c.obj(`${p}.request`, probe.request);
    if (request) {
      const kind = c.str(`${p}.request.kind`, request.kind);
      c.inCatalogue(`${p}.request.kind`, kind, catalogue.probeKinds, "unknown-probe-kind");
    }
    if (probe.field !== undefined) c.str(`${p}.field`, probe.field);
    const shape = c.oneOf(`${p}.shape`, probe.shape, ["scalar", "series"] as const);
    c.str(`${p}.unit`, probe.unit, { nonEmpty: false });
    c.num(`${p}.significantFigures`, probe.significantFigures, { integer: true, positive: true });
    if (probe.levels !== undefined) c.levels(`${p}.levels`, probe.levels);
    if (probeId !== undefined && shape) probeShapes.set(probeId, shape);
  });

  // Page.
  const page = c.obj("page", s.page);
  if (page) {
    c.levelText("page.body", page.body);
    const predict = c.obj("page.predict", page.predict);
    if (predict) {
      c.levelText("page.predict.question", predict.question);
      const options = c.arr("page.predict.options", predict.options);
      if (options) {
        if (options.length < 2 || options.length > 4) {
          c.issue("page.predict.options", "count", "predict needs 2 to 4 options");
        }
        options.forEach((o, i) => c.levelText(`page.predict.options[${i}]`, o));
        const answer =
          predict.answer === null
            ? undefined
            : c.num("page.predict.answer", predict.answer, { integer: true, min: 0 });
        if (answer !== undefined && answer >= options.length) {
          c.issue("page.predict.answer", "range", `answer ${answer} is not an option index`);
        }
      }
      if (predict.answerEvidence !== undefined) c.str("page.predict.answerEvidence", predict.answerEvidence);
    }
    c.levelText("page.flap", page.flap);
    const ignores = c.obj("page.ignores", page.ignores);
    if (ignores) {
      for (const level of LEVELS) {
        const items = c.arr(`page.ignores.${level}`, ignores[level]);
        if (items && items.length === 0)
          c.issue(`page.ignores.${level}`, "count", "ignores must not be empty");
        items?.forEach((t, i) => {
          const text = c.str(`page.ignores.${level}[${i}]`, t);
          if (text !== undefined) c.texts.push({ path: `page.ignores.${level}[${i}]`, text });
        });
      }
    }
    c.arr("page.keyWords", page.keyWords)?.forEach((raw, i) => {
      const kw = c.obj(`page.keyWords[${i}]`, raw);
      if (!kw) return;
      c.levelText(`page.keyWords[${i}].term`, kw.term);
      c.levelText(`page.keyWords[${i}].definition`, kw.definition);
    });
    if (page.equations !== undefined) {
      c.arr("page.equations", page.equations)?.forEach((e, i) => c.str(`page.equations[${i}]`, e));
    }
  }

  // Challenge.
  const challenge = c.obj("challenge", s.challenge);
  if (challenge) {
    c.levelText("challenge.prompt", challenge.prompt);
    checkChallenge(c, "challenge.check", challenge.check, probeShapes);
    const stamp = c.obj("challenge.stamp", challenge.stamp);
    if (stamp) {
      c.str("challenge.stamp.id", stamp.id);
      c.levelText("challenge.stamp.label", stamp.label);
    }
  }

  c.str("teacherNotes", s.teacherNotes);
  const sources = c.arr("sources", s.sources);
  if (sources && sources.length === 0) c.issue("sources", "count", "a spread needs at least one source");
  sources?.forEach((raw, i) => {
    const src = c.obj(`sources[${i}]`, raw);
    if (!src) return;
    c.str(`sources[${i}].citation`, src.citation);
    if (src.url !== undefined) c.str(`sources[${i}].url`, src.url);
    if (src.doi !== undefined) c.str(`sources[${i}].doi`, src.doi);
  });

  // Text pass: bindings resolve, and no typed numbers (page and model agree).
  for (const { path, text } of c.texts) {
    for (const bad of findMalformedBindings(text)) {
      c.issue(path, "malformed-binding", `${path}: "${bad}" is not a binding; use {{namespace.key}}`);
    }
    for (const b of parseBindings(text))
      checkBinding(c, path, b.namespace, b.key, { probeShapes, valueControls, durationIds });
    for (const n of findTypedNumbers(text)) {
      c.issue(path, "typed-number", `${path}: typed number "${n}"; bind it instead (page and model agree)`);
    }
  }

  return c.issues.length === 0
    ? { ok: true, spread: input as Spread, issues: [] }
    : { ok: false, issues: c.issues };
}

function checkBinding(
  c: Checker,
  path: string,
  namespace: string,
  key: string,
  known: { probeShapes: Map<string, string>; valueControls: Set<string>; durationIds: Set<string> },
): void {
  const raw = `{{${namespace}.${key}}}`;
  if (!(BINDING_NAMESPACES as readonly string[]).includes(namespace)) {
    c.issue(path, "unknown-binding", `${path}: ${raw} uses an unknown namespace`);
    return;
  }
  if (namespace === "probe") {
    const shape = known.probeShapes.get(key);
    if (!shape) c.issue(path, "unknown-binding", `${path}: ${raw} names no declared probe`);
    else if (shape === "series")
      c.issue(path, "series-binding", `${path}: ${raw} is a series; bind a scalar probe`);
  } else if (namespace === "control") {
    if (!known.valueControls.has(key)) {
      c.issue(path, "unknown-binding", `${path}: ${raw} names no slider or speed control`);
    }
  } else {
    const parts = key.split(".");
    const ok =
      parts.length === 1
        ? (SCENE_BINDING_KEYS as readonly string[]).includes(key)
        : parts.length === 2 && parts[0] === "duration" && known.durationIds.has(parts[1]!);
    if (!ok) c.issue(path, "unknown-binding", `${path}: ${raw} is not a scene value or declared duration`);
  }
}

function checkChallenge(
  c: Checker,
  path: string,
  v: unknown,
  probeShapes: Map<string, string>,
  depth = 0,
): void {
  const check = c.obj(path, v);
  if (!check) return;
  if (depth > 8) {
    c.issue(path, "range", `${path}: challenge checks nest too deeply`);
    return;
  }
  const kind = c.oneOf(`${path}.kind`, check.kind, ["probe-threshold", "all", "any", "pending"] as const);
  if (kind === "pending") {
    c.str(`${path}.reason`, check.reason);
  } else if (kind === "probe-threshold") {
    const probe = c.str(`${path}.probe`, check.probe);
    if (probe !== undefined) {
      const shape = probeShapes.get(probe);
      if (!shape) c.issue(`${path}.probe`, "unknown-reference", `${path}: probe "${probe}" is not declared`);
      else if (shape !== "scalar")
        c.issue(`${path}.probe`, "series-binding", `${path}: probe "${probe}" is a series`);
    }
    c.oneOf(`${path}.comparator`, check.comparator, COMPARATORS);
    c.num(`${path}.threshold`, check.threshold);
    c.num(`${path}.sustainSimYears`, check.sustainSimYears, { min: 0 });
  } else if (kind === "all" || kind === "any") {
    const checks = c.arr(`${path}.checks`, check.checks);
    if (checks && checks.length === 0)
      c.issue(`${path}.checks`, "count", `${path}: needs at least one check`);
    checks?.forEach((sub, i) => checkChallenge(c, `${path}.checks[${i}]`, sub, probeShapes, depth + 1));
  }
}
