/**
 * Content checks for "Where plates meet" (session 7E): schema and bindings against the plates contract
 * (D-W7-7E), the claim/source register (every paragraph and text group to registered claims and known
 * sources, every typed figure to a cited claim), the illustration's honesty rules (D-L2-1, the plan's
 * guardrails), and copy budgets for the 7R layout.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BindingEngine,
  type LevelText,
  findMalformedBindings,
  findTypedNumbers,
  parseBindings,
  validateReaderSpread,
} from "@hachure/runtime";
import { PLATES_PROBE_KINDS, STRING_PROBES, platesProbes } from "./bindings";
import { YEAR_CLAIMS, citedFigures, claims } from "./claims";
import { deeperText, pageContent, readerText, teacherNotesText } from "./content";
import * as lesson from "./lesson";
import { INTERNAL_SOURCES, sourceKeys, sources } from "./sources";
import { buildRegister, registerTable } from "./register";
import { PLATES_SEED, platesCatalogue, platesSpread } from "./spread";

// ---- Fixtures --------------------------------------------------------------------------------------------
const markdown = import.meta.glob<string>("./*.md", { query: "?raw", import: "default", eager: true });
const modules = import.meta.glob<string>(["./*.ts", "!./*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const repo = new URL("../../../", import.meta.url);
const parameters = JSON.parse(
  readFileSync(new URL("docs/science/plates/parameters.json", repo), "utf8"),
) as Record<string, unknown>;
const parameter = (path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      parameters,
    );

type Level = "hs" | "uni";
const levelTexts = (value: unknown): LevelText[] => {
  if (value && typeof value === "object" && "hs" in value && "uni" in value) return [value as LevelText];
  if (Array.isArray(value)) return value.flatMap(levelTexts);
  if (value && typeof value === "object") return Object.values(value).flatMap(levelTexts);
  return [];
};
const perLevel = (where: string, value: unknown) =>
  levelTexts(value).flatMap((t) => [
    { where, level: "hs" as Level, text: t.hs },
    { where, level: "uni" as Level, text: t.uni },
  ]);
const { boundary: boundaryAlternatives, ...viewAlternatives } = lesson.textAlternatives;

/** Every reader-facing text of the lesson outside the markdown files, per level, keyed by `textClaims`. */
const lessonTexts: { where: string; level: Level; text: string }[] = [
  ...perLevel("title", lesson.title),
  ...perLevel("runningHeads", lesson.runningHeads),
  ...perLevel("keyWords", lesson.keyWords),
  ...perLevel("predict", [lesson.predict.question, ...lesson.predict.options]),
  ...lesson.boundaries.flatMap((b) => perLevel(`boundaries.${b.id}`, b)),
  ...perLevel("stageWords", lesson.stageWords),
  ...perLevel("controlsCopy", lesson.controlsCopy),
  ...perLevel("figure", lesson.figure),
  ...perLevel("textAlternatives.start", lesson.textAlternatives.start),
  ...Object.entries(boundaryAlternatives).flatMap(([id, t]) => perLevel(`textAlternatives.${id}`, t)),
  ...perLevel("textAlternatives.views", {
    sceneReady: viewAlternatives.sceneReady,
    ghosts: viewAlternatives.ghosts,
    scale: viewAlternatives.scale,
    staticFallback: viewAlternatives.staticFallback,
  }),
  ...(["hs", "uni"] as const).flatMap((level) =>
    lesson.shows[level].map((text) => ({ where: "shows", level, text })),
  ),
  ...(["hs", "uni"] as const).flatMap((level) =>
    pageContent.ignores[level].map((text) => ({ where: `ignores.${level}`, level, text })),
  ),
];
/** The markdown reader texts, per level. */
const markdownTexts: { where: string; level: Level; text: string }[] = [
  ...perLevel("body", pageContent.body),
  ...perLevel("flap", pageContent.flap),
  { where: "deeper", level: "uni", text: deeperText },
  { where: "teacherNotes", level: "uni", text: teacherNotesText },
];
const readerTexts = [...lessonTexts, ...markdownTexts];
const allReaderText = readerTexts.map((t) => t.text).join("\n");
/** Texts that may type a cited real-world figure (never a schema-validated page field). */
const FIGURE_TEXTS = new Set(["deeper", "teacherNotes"]);

const probeById = new Map(platesProbes.map((p) => [p.id, p]));
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter((s) => s.trim()).length;
const sentencesOf = (text: string) => text.split(/(?<=[.?!:;])\s+/).filter((s) => s.trim());

/** Sample values for rendering templates: the parameter table's display values and long view strings. */
const SAMPLE: Record<string, number | string> = {
  reliefScale: parameter("display.surfaceVerticalExaggeration") as number,
  crustScale: parameter("display.crustVerticalExaggeration") as number,
  airyRatio: parameter("crust.airyRootPerMetreOfUplift") as number,
  crustDensity: parameter("crust.crustDensityKgPerM3") as number,
  mantleDensity: parameter("crust.mantleDensityKgPerM3") as number,
  snowline: parameter("dressing.snowlineM") as number,
  blockWidth: ((parameter("grid.columns") as number) * (parameter("grid.metresPerCell") as number)) / 1000,
  boundaryName: "Convergent",
  stageLabel: "middle",
  ghostNames: "Divergent and Transform",
  scaleBar: "20 km",
};
const engine = new BindingEngine({ probes: platesProbes, controls: platesSpread.controls });
engine.update({ probe: SAMPLE });
const render = (text: string) => engine.render(text);

// ---- Schema and bindings ---------------------------------------------------------------------------------
describe("plate-boundaries spread: schema and bindings", () => {
  it("validates as a static-geometry reader spread against the plates catalogue", () => {
    const result = validateReaderSpread(platesSpread, platesCatalogue);
    expect(result.ok ? [] : result.issues).toEqual([]);
    expect(platesSpread.scene.modelScope).toEqual({ kind: "static-geometry" });
    expect(platesSpread.engine).toBe("scene");
    expect(platesSpread.id).toBe("tectonics.plate-boundaries");
    expect(PLATES_SEED).toBe(parameter("seed"));
    // No playback or speed control in the schema: play, pause and the stage are sequence commands.
    expect(platesSpread.controls.map((c) => c.kind)).toEqual(["action"]);
  });

  it("declares probes the plates host can serve, reading fields that exist in the parameter table", () => {
    for (const probe of platesProbes) {
      expect(PLATES_PROBE_KINDS as readonly string[]).toContain(probe.request.kind);
      expect(probe.shape, probe.id).toBe("scalar");
      if (probe.request.kind === "plates-config")
        expect(typeof parameter(probe.field!), `${probe.id}: ${probe.field}`).toBe("number");
      if (probe.request.kind === "plates-scene")
        expect(["boundaryName", "stageLabel", "viewedNames", "blockWidthKm", "scaleBarLabel"]).toContain(
          probe.field,
        );
    }
    expect(STRING_PROBES.every((id) => probeById.get(id)?.request.kind === "plates-scene")).toBe(true);
    // The two display scales are visible at both levels (the label line's context, claim PC20).
    for (const id of ["reliefScale", "crustScale"]) expect(probeById.get(id)!.levels).toBeUndefined();
  });

  it("types no number in page fields; binds only declared scalar probes at the level that shows them", () => {
    for (const { where, level, text } of readerTexts) {
      if (!FIGURE_TEXTS.has(where)) expect(findTypedNumbers(text), `${where}.${level}: ${text}`).toEqual([]);
      expect(findMalformedBindings(text), where).toEqual([]);
      for (const b of parseBindings(text)) {
        expect(b.namespace, `${where}: ${b.raw}`).toBe("probe");
        const probe = probeById.get(b.key);
        expect(probe, `${where}: ${b.raw}`).toBeDefined();
        expect(probe!.levels ?? ["hs", "uni"], `${where}.${level}: ${b.raw}`).toContain(level);
      }
    }
  });

  it("does not spell out quantities as words either", () => {
    const spelled =
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million)\s+(metres?|meters?|m|km|kilometres?|years?|degrees|times)\b/i;
    for (const { where, text } of readerTexts)
      if (!FIGURE_TEXTS.has(where)) expect(text, where).not.toMatch(spelled);
  });

  it("renders every template through the binding engine", () => {
    for (const { text } of readerTexts) expect(() => render(text)).not.toThrow();
    expect(render(lesson.figure.scaleNote.hs)).toBe("Not to scale: heights ×4, crust depths ×0.75.");
    expect(render(lesson.controlsCopy.stageValue.hs)).toBe("middle stage");
    expect(render(lesson.textAlternatives.boundary.convergent.hs)).toMatch(
      /^Convergent boundary, middle stage\./,
    );
  });

  it("names each boundary's stage word for the stage, without time", () => {
    expect(lesson.stageWordFor(0)).toBe("start");
    expect(lesson.stageWordFor(0.2)).toBe("early");
    expect(lesson.stageWordFor(0.5)).toBe("middle");
    expect(lesson.stageWordFor(1)).toBe("late");
    expect(() => lesson.stageWordFor(Number.NaN)).toThrow();
    expect(lesson.controlsCopy.stageEarly.hs).toBe("early");
    expect(lesson.controlsCopy.stageLate.hs).toBe("late");
  });

  it("keeps expert-review metadata in every authored file and out of reader text", () => {
    expect(Object.keys(markdown).length).toBeGreaterThanOrEqual(8);
    for (const [path, text] of [...Object.entries(markdown), ...Object.entries(modules)])
      expect(text, path).toContain("<!-- expert-review -->");
    expect(allReaderText).not.toContain("<!--");
    expect(readerText("<!-- a -->\n\nText <!-- b -->")).toBe("Text");
  });
});

// ---- Claim/source register -------------------------------------------------------------------------------
const claimById = new Map(claims.map((c) => [c.id, c]));
const known = new Set<string>(sourceKeys);

/** Paragraphs of a markdown file with the claims/sources comment that precedes each. */
function annotatedParagraphs(text: string) {
  const out: { paragraph: string; claims: string[]; sources: string[] }[] = [];
  let current: { claims: string[]; sources: string[] } | null = null;
  for (const block of text.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    const meta = /^<!--\s*claims:\s*([^|]*)\|\s*sources:\s*([^>]*?)\s*-->$/.exec(trimmed);
    if (meta) {
      const list = (s: string, sep: string) =>
        s
          .split(sep)
          .map((x) => x.trim())
          .filter(Boolean);
      current = { claims: list(meta[1]!, ","), sources: list(meta[2]!, ";") };
      continue;
    }
    if (!trimmed || /^<!--[\s\S]*-->$/.test(trimmed)) continue;
    out.push({ paragraph: trimmed, claims: current?.claims ?? [], sources: current?.sources ?? [] });
    current = null;
  }
  return out;
}
const sourceMarkdown = Object.entries(markdown).filter(
  ([path]) => !path.endsWith("README.md") && !path.endsWith("sources.md"),
);
const annotated = sourceMarkdown.flatMap(([path, text]) =>
  annotatedParagraphs(text).map((p) => ({ path, ...p })),
);
const citationKeys = (text: string) =>
  [...text.matchAll(/\(([A-Z][A-Za-z0-9-]*(?:; [A-Z][A-Za-z0-9-]*)*)\)/g)].flatMap((m) => m[1]!.split("; "));

describe("plate-boundaries claim/source register", () => {
  it("annotates every reader paragraph with registered claims and known sources", () => {
    expect(sourceMarkdown.length).toBe(6);
    for (const p of annotated) {
      const at = `${p.path}: ${p.paragraph.slice(0, 60)}`;
      expect(p.claims.length, at).toBeGreaterThan(0);
      expect(p.sources.length, at).toBeGreaterThan(0);
      for (const id of p.claims) expect(claimById.has(id), `${at}: claim ${id}`).toBe(true);
      for (const key of p.sources) expect(known.has(key), `${at}: source ${key}`).toBe(true);
      // A key cited in the prose is one the annotation lists.
      for (const key of citationKeys(p.paragraph)) expect(p.sources, `${at}: (${key})`).toContain(key);
    }
  });

  it("names registered claims for every text group in lesson.ts", () => {
    const groups = new Set(lessonTexts.map((t) => t.where));
    groups.add("equations");
    for (const group of groups) {
      const ids = lesson.textClaims[group];
      expect(ids, group).toBeDefined();
      expect(ids!.length, group).toBeGreaterThan(0);
      for (const id of ids!) expect(claimById.has(id), `${group}: ${id}`).toBe(true);
    }
    for (const group of Object.keys(lesson.textClaims)) expect(groups.has(group), group).toBe(true);
  });

  it("keeps the sentence register in docs/science/plates/lesson/README.md complete and current", () => {
    expect(new Set(Object.keys(lesson.textGroups))).toEqual(new Set(lessonTexts.map((t) => t.where)));
    const files = Object.fromEntries(
      sourceMarkdown.map(([path, text]) => [path.replace("./", ""), text] as [string, string]),
    );
    const rows = buildRegister(files, lesson.textGroups, lesson.textClaims, claims);
    expect(rows.length).toBeGreaterThan(100);
    for (const row of rows) {
      expect(row.claims.length, row.sentence).toBeGreaterThan(0);
      expect(
        row.sources.some((s) => s !== "Params" && s !== "Claims" && s !== "Lesson") ||
          row.claims.every((id) => claimById.get(id)!.status === "display"),
        `${row.where}: ${row.sentence} needs a literature source`,
      ).toBe(true);
    }
    const readme = readFileSync(new URL("docs/science/plates/lesson/README.md", repo), "utf8");
    // Prettier pads table cells, so compare rows with the padding removed.
    const squash = (s: string) => s.replace(/\s*\|\s*/g, "|").replace(/\s+/g, " ");
    const readmeRows = new Set(readme.split("\n").map(squash));
    for (const line of registerTable(rows).slice(2))
      expect(readmeRows.has(squash(line)), `missing from the README register: ${line.slice(0, 120)}`).toBe(
        true,
      );
  });

  it("resolves every parenthetical citation key in reader prose", () => {
    for (const { text } of readerTexts)
      for (const key of citationKeys(text)) expect(known.has(key), key).toBe(true);
  });

  it("gives every claim a known source, and every real-world claim a literature source", () => {
    for (const claim of claims) {
      expect(claim.sources.length, claim.id).toBeGreaterThan(0);
      for (const key of claim.sources) expect(known.has(key), `${claim.id}: ${key}`).toBe(true);
      if (claim.status === "taught" || claim.status === "explained")
        expect(
          claim.sources.some((k) => !INTERNAL_SOURCES.includes(k)),
          `${claim.id} needs a literature source`,
        ).toBe(true);
    }
  });

  it("teaches every taught claim somewhere, uses every source, and lists every source", () => {
    const referenced = new Set<string>([
      ...annotated.flatMap((p) => p.claims),
      ...Object.values(lesson.textClaims).flat(),
    ]);
    const used = new Set<string>([
      ...annotated.flatMap((p) => p.sources),
      ...claims.flatMap((c) => c.sources),
    ]);
    for (const claim of claims.filter((c) => c.status !== "not-taught"))
      expect(referenced.has(claim.id), `${claim.id} is not in the copy`).toBe(true);
    for (const key of sourceKeys) expect(used.has(key), `source ${key} is never used`).toBe(true);
    for (const key of sourceKeys)
      expect(
        sources.some((s) => s.citation.startsWith(`${key} —`)),
        key,
      ).toBe(true);
  });

  it("types a number only as a registered cited figure, in a paragraph that names its claim", () => {
    const figures = new Map(citedFigures.map((f) => [f.figure, f.claims]));
    for (const f of citedFigures)
      for (const id of f.claims) {
        expect(claimById.get(id)?.status, `${f.figure}: ${id}`).toMatch(/taught|explained/);
        expect(findTypedNumbers(claimById.get(id)!.statement), `${f.figure} in ${id}`).toContain(f.figure);
      }
    const typed = new Set<string>();
    for (const p of annotated.filter((a) => /deeper|teacher-notes/.test(a.path)))
      for (const n of findTypedNumbers(p.paragraph)) {
        typed.add(n);
        const ids = figures.get(n);
        expect(ids, `${p.path}: typed ${n} is not a cited figure`).toBeDefined();
        expect(
          ids!.some((id) => p.claims.includes(id)),
          `${p.path}: ${n} needs claim ${ids!.join("/")}`,
        ).toBe(true);
      }
    for (const f of citedFigures)
      expect(typed.has(f.figure), `${f.figure} is registered but unused`).toBe(true);
  });
});

// ---- Honesty: illustration, not simulation (D-L2-1, guardrails) ------------------------------------------
describe("plate-boundaries honesty rules", () => {
  it("never says run, simulation, model time or computed, and never that a landform forms or grows", () => {
    for (const { where, text } of readerTexts) {
      expect(text, where).not.toMatch(/\bruns?\b|simulat|model time|comput|calculat|\bmodel\b/i);
      expect(text, where).not.toMatch(/\b(grows?|grew|growing)\b/i);
      // "form" only in a denial ("do not form", "nothing forms").
      expect(text, where).not.toMatch(/(?<!\bnot |\bnothing )\b(forms?|formed|forming)\b/i);
    }
  });

  it("carries exactly one label line, and the disclosure says the shapes are authored", () => {
    expect(lesson.figure.label).toEqual({
      hs: "Illustration: shapes drawn from real examples",
      uni: "Illustration: shapes drawn from real examples",
    });
    for (const { where, text } of readerTexts.filter((t) => t.where !== "figure"))
      expect(text, where).not.toContain("Illustration: shapes drawn from real examples");
    for (const level of ["hs", "uni"] as const) {
      const disclosure = pageContent.ignores[level].join(" ");
      expect(disclosure, level).toMatch(/authored/);
      expect(disclosure, level).toMatch(/do not form in the scene/);
      expect(disclosure, level).toMatch(/not a clock/);
      expect(disclosure, level).toMatch(/[Nn]o erosion/);
      expect(disclosure, level).toMatch(/Continent/);
      expect(disclosure, level).toContain("{{probe.reliefScale}}");
      expect(disclosure, level).toContain("{{probe.crustScale}}");
    }
  });

  it("keeps years and rates out of the school level and out of the page; deeper level only, framed as real", () => {
    const year = /\byears?\b|\bannual|\bper year|\ba year\b|mm\/yr|cm\/yr|million/i;
    for (const { where, level, text } of readerTexts)
      if (where !== "deeper" && where !== "teacherNotes") expect(text, `${where}.${level}`).not.toMatch(year);
    for (const p of annotated) {
      if (!year.test(p.paragraph)) continue;
      expect(p.path, p.paragraph.slice(0, 60)).toBe("./deeper.uni.md");
      expect(
        p.claims.some((id) => YEAR_CLAIMS.includes(id)),
        p.paragraph.slice(0, 60),
      ).toBe(true);
      expect(p.paragraph).toMatch(/not in the drawing/);
      expect(p.paragraph).toMatch(/no clock/);
      expect(p.paragraph).toMatch(/cited facts about the real Earth/);
    }
  });

  it("names out-of-scope settings only as left out, and never calls rifts symmetric", () => {
    const outOfScope = /volcan|magma|subduct|trench|earthquake|ocean ridge|mid-ocean/i;
    for (const { where, text } of readerTexts)
      for (const s of sentencesOf(text))
        if (outOfScope.test(s)) expect(s, where).toMatch(/left out|leaves? out|out of scope|not shown/);
    for (const { where, text } of readerTexts)
      for (const s of sentencesOf(text))
        if (/\brifts? (are|is) symmetric|symmetric rift/i.test(s)) expect(s, where).toMatch(/drawing|"/);
  });

  it("states no size of the drawing as a fact (NT5) and no unsourced rate (NT2, NT3)", () => {
    expect(allReaderText).not.toMatch(/\b(drawn|drawing's|this) (range|rift|offset|root) is \d/i);
    expect(allReaderText).not.toMatch(/opening rate|spreading rate|convergence rate|rising (by|at)/i);
    expect(allReaderText).not.toMatch(/hundred kilomet/i);
  });

  it("keeps the flap's drawn-root sentence true for the bound scales (root ÷ range on screen ≈ 1)", () => {
    const onScreen =
      ((SAMPLE.airyRatio as number) * (SAMPLE.crustScale as number)) / (SAMPLE.reliefScale as number);
    expect(onScreen).toBeGreaterThan(0.8);
    expect(onScreen).toBeLessThan(1.3);
    expect(pageContent.flap.uni).toContain("about as deep as the range is high");
  });
});

// ---- Copy for the 7R layout -------------------------------------------------------------------------------
describe("plate-boundaries copy fits the 7R layout", () => {
  it("keeps the left page in editorial form: two or three short sentences, six key words", () => {
    expect(lesson.LESSON_NUMBER).toBe(2);
    expect(lesson.FIGURE_NUMBER).toBe(2);
    expect(lesson.title.hs).toBe("Where plates meet");
    for (const level of ["hs", "uni"] as const) {
      expect(sentences(pageContent.body[level]), level).toBeGreaterThanOrEqual(2);
      expect(sentences(pageContent.body[level]), level).toBeLessThanOrEqual(3);
    }
    // Lesson 1's budgets (60 / 74 words): the page has the same room.
    expect(words(pageContent.body.hs)).toBeLessThanOrEqual(60);
    expect(words(pageContent.body.uni)).toBeLessThanOrEqual(74);
    expect(lesson.keyWords.map((k) => k.term.hs)).toEqual([
      "plate",
      "plate boundary",
      "convergent",
      "divergent",
      "transform",
      "crust",
    ]);
    for (const k of lesson.keyWords) {
      expect(words(k.definition.hs), k.term.hs).toBeLessThanOrEqual(12);
      expect(words(k.definition.uni), k.term.hs).toBeLessThanOrEqual(14);
    }
  });

  it("keeps the prediction, flap, caption, label and scale note short", () => {
    expect(words(pageContent.flap.hs)).toBeLessThanOrEqual(70);
    expect(words(pageContent.flap.uni)).toBeLessThanOrEqual(100);
    expect(lesson.predict.options).toHaveLength(3);
    expect(lesson.predict.options[lesson.predict.answer]!.hs).toMatch(/thicker/);
    expect(pageContent.flap.hs).toMatch(/^Thicker\./);
    expect(pageContent.flap.uni).toMatch(/^Several times deeper\./);
    for (const level of ["hs", "uni"] as const) {
      expect(words(lesson.predict.question[level])).toBeLessThanOrEqual(16);
      for (const o of lesson.predict.options) expect(words(o[level])).toBeLessThanOrEqual(9);
      expect(words(lesson.figure.caption[level])).toBeLessThanOrEqual(26);
      expect(sentences(lesson.figure.label[level])).toBe(1);
      expect(render(lesson.figure.scaleNote[level]).length).toBeLessThanOrEqual(60);
    }
  });

  it("gives each boundary a name, a distinct arrow glyph with a spoken form, and short help", () => {
    expect(lesson.boundaries.map((b) => b.id)).toEqual(["convergent", "divergent", "transform"]);
    expect(new Set(lesson.boundaries.map((b) => b.glyph)).size).toBe(3);
    for (const b of lesson.boundaries) {
      expect(b.glyph).toMatch(/^[←→⇅↑↓ ]+$/u);
      expect(b.name.hs.toLowerCase()).toBe(b.id);
      expect(b.example.hs).toMatch(/^Shapes drawn from /);
      for (const level of ["hs", "uni"] as const) {
        expect(words(b.help[level]), `${b.id}.${level}`).toBeLessThanOrEqual(24);
        expect(words(b.glyphLabel[level])).toBeLessThanOrEqual(8);
      }
    }
    // Help text names the real example; the stage words are early and late only on the scrubber.
    expect(lesson.boundaries.map((b) => b.example.hs).join(" ")).toMatch(
      /Himalaya.*East African Rift.*Wallace Creek/,
    );
  });

  it("gives Fig. 2 a few label words and every control a short label", () => {
    const labels = lesson.figure.labels.map((l) => l.text.hs);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(6);
    for (const word of ["plate boundary", "crust"]) expect(labels).toContain(word);
    for (const l of labels) expect(l).toMatch(/^[a-z -]+$/);
    for (const [key, t] of Object.entries(lesson.controlsCopy))
      expect(words(t.hs), key).toBeLessThanOrEqual(16);
  });

  it("keeps text alternatives short enough for a polite live region", () => {
    for (const { where, text } of perLevel("alt", lesson.textAlternatives))
      expect(render(text).length, where).toBeLessThanOrEqual(360);
    expect(render(lesson.figure.drawingAlternative.hs).length).toBeLessThanOrEqual(400);
  });
});
