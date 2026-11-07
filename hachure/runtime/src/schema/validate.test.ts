import { describe, expect, it } from "vitest";
import { findMalformedBindings, findTypedNumbers, parseBindings } from "./bindings";
import type { Spread } from "./spread";
import { type EngineCatalogue, type IssueCode, validateSpread } from "./validate";

/** Schema test fixture. Its text is placeholder wording, not page content and not science. */
function fixture(): Spread {
  const both = (text: string) => ({ hs: text, uni: text });
  return {
    schemaVersion: 0,
    id: "test.fixture",
    title: both("Fixture spread"),
    tags: { domain: ["test"], courses: [], levels: ["hs", "uni"] },
    tier: "process-model",
    engine: "terrain",
    scene: {
      preset: "fake-tilted-plane",
      seed: 7,
      camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 40 },
      stepsPerRealSecond: 60,
      params: { rainMmPerHr: 5 },
      durations: { predictSpan: { simYears: 10_000 } },
    },
    controls: [
      {
        kind: "slider",
        id: "rain",
        label: both("Rain"),
        levels: ["hs", "uni"],
        param: "rainMmPerHr",
        min: 0,
        max: 50,
        step: 1,
        default: 5,
        unit: "mm/h",
      },
      {
        kind: "brush",
        id: "hardBrush",
        label: both("Harden rock"),
        levels: ["hs", "uni"],
        tool: "harden",
        radiusM: { min: 10, max: 100, default: 30 },
        strength: { min: 0, max: 0.9, default: 0.8, unit: "1" },
      },
      {
        kind: "speed",
        id: "speed",
        label: both("Speed"),
        levels: ["hs", "uni"],
        min: 0.25,
        max: 4,
        step: 0.25,
        default: 1,
      },
      { kind: "action", id: "reset", label: both("Reset"), levels: ["hs", "uni"], action: "reset" },
    ],
    probes: [
      {
        id: "sedimentOut",
        label: both("Sediment out"),
        request: { kind: "budget" },
        field: "exportedSedimentM3",
        shape: "scalar",
        unit: "m³",
        significantFigures: 2,
      },
      {
        id: "profile",
        label: both("Long profile"),
        request: { kind: "long-profile", samples: 64 },
        shape: "series",
        unit: "m",
        significantFigures: 3,
        levels: ["uni"],
      },
    ],
    page: {
      body: {
        hs: "Time runs at {{scene.timeScale}}. So far {{probe.sedimentOut}} has left through the outlet.",
        uni: "Rain is {{control.rain}}; each cell is {{scene.metresPerCell}} wide. The 3D view lifts from the 2D map.",
      },
      predict: {
        question: both("If it rains harder for {{scene.duration.predictSpan}}, what happens?"),
        options: [both("Option A"), both("Option B"), both("Option C")],
        answer: 2,
        answerEvidence: "qualitative/more-rain",
      },
      flap: both("Fixture explanation."),
      ignores: { hs: ["Fixture item."], uni: ["Fixture item, longer."] },
      keyWords: [{ term: both("Term"), definition: both("Definition.") }],
      equations: ["E = K A^{m} S^{n}", "m \\approx 0.5"],
    },
    challenge: {
      prompt: both("Fixture challenge."),
      check: {
        kind: "all",
        checks: [
          {
            kind: "probe-threshold",
            probe: "sedimentOut",
            comparator: ">",
            threshold: 1,
            sustainSimYears: 0,
          },
        ],
      },
      stamp: { id: "fixture", label: both("Fixture stamp") },
    },
    teacherNotes: "teacher-notes.md",
    sources: [{ citation: "Fixture citation" }],
  };
}

const catalogue: EngineCatalogue = {
  params: ["rainMmPerHr", "erosionRatePerS"],
  tools: ["raise", "dig", "smooth", "harden"],
  probeKinds: ["point-flux", "long-profile", "cross-section", "budget"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests bend the fixture into invalid shapes.
type Loose = Record<string, any>;

/** Applies a mutation to a deep copy of the fixture and returns the issue codes. */
function codesAfter(mutate: (s: Loose) => void, cat: EngineCatalogue = catalogue): IssueCode[] {
  const s = structuredClone(fixture()) as Loose;
  mutate(s);
  const result = validateSpread(s, cat);
  return result.ok ? [] : result.issues.map((i) => i.code);
}

describe("validateSpread", () => {
  it("accepts a valid spread", () => {
    const result = validateSpread(fixture(), catalogue);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validateSpread(null).ok).toBe(false);
    expect(validateSpread("spread").ok).toBe(false);
  });

  it.each<[string, (s: Loose) => void, IssueCode]>([
    ["missing id", (s) => delete s.id, "required"],
    ["bad id format", (s) => (s.id = "Valley"), "id-format"],
    ["wrong schema version", (s) => (s.schemaVersion = 1), "enum"],
    ["unknown tier", (s) => (s.tier = "vibes"), "enum"],
    ["missing university text", (s) => delete s.title.uni, "required"],
    ["empty level list", (s) => (s.controls[0].levels = []), "count"],
    ["slider min ≥ max", (s) => (s.controls[0].min = 60), "range"],
    ["slider default outside clamps", (s) => (s.controls[0].default = 99), "range"],
    ["slider step ≤ 0", (s) => (s.controls[0].step = 0), "range"],
    ["brush radius default outside clamps", (s) => (s.controls[1].radiusM.default = 1), "range"],
    ["unknown control kind", (s) => (s.controls[0].kind = "knob"), "enum"],
    ["duplicate id across controls and probes", (s) => (s.probes[0].id = "rain"), "duplicate-id"],
    ["unknown engine param", (s) => (s.controls[0].param = "rainInchesPerDay"), "unknown-param"],
    ["unknown scene param", (s) => (s.scene.params = { gravity: 1 }), "unknown-param"],
    ["unknown tool", (s) => (s.controls[1].tool = "dynamite"), "unknown-tool"],
    ["unknown probe kind", (s) => (s.probes[0].request.kind = "magic"), "unknown-probe-kind"],
    ["too few predict options", (s) => (s.page.predict.options = [s.page.predict.options[0]]), "count"],
    ["predict answer out of range", (s) => (s.page.predict.answer = 3), "range"],
    [
      "typed number in body",
      (s) => (s.page.body.hs = "Over 10,000 years the valley deepens."),
      "typed-number",
    ],
    ["typed number in question", (s) => (s.page.predict.question.hs = "Rain for 100 years?"), "typed-number"],
    ["typed number in an option", (s) => (s.page.predict.options[0].uni = "About 0.5 m"), "typed-number"],
    ["typed number in ignores", (s) => (s.page.ignores.uni = ["Runs on a 256 grid."]), "typed-number"],
    ["typed number in a control label", (s) => (s.controls[0].label.hs = "Rain (0–50)"), "typed-number"],
    ["unknown probe binding", (s) => (s.page.flap.hs = "See {{probe.nope}}."), "unknown-binding"],
    ["series probe bound in text", (s) => (s.page.flap.hs = "See {{probe.profile}}."), "series-binding"],
    ["unknown namespace", (s) => (s.page.flap.hs = "See {{config.rainMmPerHr}}."), "unknown-binding"],
    ["unknown scene key", (s) => (s.page.flap.hs = "See {{scene.colour}}."), "unknown-binding"],
    ["undeclared duration", (s) => (s.page.flap.hs = "See {{scene.duration.forever}}."), "unknown-binding"],
    ["binding to a brush", (s) => (s.page.flap.hs = "See {{control.hardBrush}}."), "unknown-binding"],
    ["malformed binding", (s) => (s.page.flap.hs = "See {{probe}}."), "malformed-binding"],
    [
      "challenge names unknown probe",
      (s) => (s.challenge.check.checks[0].probe = "nope"),
      "unknown-reference",
    ],
    ["challenge on a series probe", (s) => (s.challenge.check.checks[0].probe = "profile"), "series-binding"],
    ["challenge bad comparator", (s) => (s.challenge.check.checks[0].comparator = "=="), "enum"],
    ["empty challenge group", (s) => (s.challenge.check.checks = []), "count"],
    ["no sources", (s) => (s.sources = []), "count"],
    ["empty ignores", (s) => (s.page.ignores.hs = []), "count"],
    ["camera vector of wrong length", (s) => (s.scene.camera.position = [0, 1]), "count"],
  ])("rejects: %s", (_name, mutate, code) => {
    expect(codesAfter(mutate)).toContain(code);
  });

  it("reports the path of each issue", () => {
    const s = structuredClone(fixture()) as Loose;
    s.controls[0].default = 99;
    const result = validateSpread(s, catalogue);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.path)).toContain("controls[0].default");
  });

  it("skips engine-name checks when no catalogue is given", () => {
    expect(codesAfter((s) => (s.controls[0].param = "anything"), {})).toEqual([]);
  });

  it("exempts equations from the typed-number check", () => {
    expect(codesAfter((s) => (s.page.equations = ["\\theta = 33^{\\circ}"]))).toEqual([]);
  });
});

describe("bindings", () => {
  it("parses namespace and key, including dotted keys", () => {
    const b = parseBindings("a {{probe.x}} b {{ scene.duration.span }}");
    expect(b.map(({ namespace, key }) => [namespace, key])).toEqual([
      ["probe", "x"],
      ["scene", "duration.span"],
    ]);
  });

  it("finds malformed brace groups", () => {
    expect(findMalformedBindings("{{probe.x}} {{probe}} {{ }} stray }}")).toEqual([
      "{{probe}}",
      "{{ }}",
      "}}",
    ]);
  });

  it("finds typed numbers outside bindings", () => {
    expect(findTypedNumbers("for 10,000 years, 0.5 m, 1st, 10km, 45%")).toEqual([
      "10,000",
      "0.5",
      "1st",
      "10km",
      "45%",
    ]);
  });

  it("allows digits that are part of a word, and 2D or 3D", () => {
    expect(findTypedNumbers("CO2 and H2O; the 2D map lifts into 3D. {{probe.a1}}")).toEqual([]);
    expect(findTypedNumbers("4D")).toEqual(["4D"]);
  });
});
