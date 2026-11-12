/**
 * Content checks for "From V to U" (session 5L): schema and bindings, the claim/source register against the
 * registered results, the R1 view defaults read against the capture manifests, the overdeepened-note
 * trigger on the recorded runs, and copy budgets for the R1 layout.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CapturedRun,
  type CapturedRunManifest,
  ROCK_IDS,
  ROCK_TYPES,
  decodeCapturedRun,
  measureSection,
} from "@hachure/glacier";
import { PROTOCOL_SECTIONS, START_PRESET_ID } from "@hachure/glacier/testing";
import {
  BindingEngine,
  type LevelText,
  findMalformedBindings,
  findTypedNumbers,
  parseBindings,
  validateReaderSpread,
} from "@hachure/runtime";
import { GLACIAL_PROBE_KINDS, uValleyProbes } from "./bindings";
import { claims } from "./claims";
import { U_VALLEY_VIEW, noteColumns, noteSpanM, resolveDefaultFrontFace, roundForNote } from "./config";
import { deeperText, pageContent, readerText, teacherNotesText } from "./content";
import * as lesson from "./lesson";
import { type SourceKey, sourceKeys, sources } from "./sources";
import { GLACIER_CONFIG_FIELDS, ROCK_FIELDS, glacierCatalogue, uValleySpread } from "./spread";

// ---- Fixtures --------------------------------------------------------------------------------------------
const markdown = import.meta.glob<string>("./*.md", { query: "?raw", import: "default", eager: true });
const modules = import.meta.glob<string>(["./*.ts", "!./*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const repo = new URL("../../../", import.meta.url);
const captureDir = new URL("hachure/glacier/src/testing/captured-runs/", repo);
const summary = JSON.parse(readFileSync(new URL("docs/review/glacial/model/summary.json", repo), "utf8")) as {
  verdicts: { id: string; pass: boolean; detail: string }[];
};

function loadCapture(rock: string): CapturedRun {
  const manifest = JSON.parse(
    readFileSync(new URL(`${rock}.json`, captureDir), "utf8"),
  ) as CapturedRunManifest;
  return decodeCapturedRun(manifest, readFileSync(new URL(manifest.binFile, captureDir)));
}
const captures = Object.fromEntries(ROCK_IDS.map((rock) => [rock, loadCapture(rock)])) as Record<
  (typeof ROCK_IDS)[number],
  CapturedRun
>;

const levelTexts = (value: unknown): LevelText[] => {
  if (value && typeof value === "object" && "hs" in value && "uni" in value) return [value as LevelText];
  if (Array.isArray(value)) return value.flatMap(levelTexts);
  if (value && typeof value === "object") return Object.values(value).flatMap(levelTexts);
  return [];
};
/** Every reader-facing text of the lesson, per level. */
const readerTexts: { where: string; level: "hs" | "uni"; text: string }[] = [
  ...[
    ["title", lesson.title],
    ["runningHeads", lesson.runningHeads],
    ["keyWords", lesson.keyWords],
    ["predict", [lesson.predict.question, ...lesson.predict.options]],
    ["challenge", lesson.challenge],
    ["figure", lesson.figure],
    ["rocks", lesson.rocks],
    ["controls", lesson.controlsCopy],
    ["textAlternatives", lesson.textAlternatives],
    ["body", pageContent.body],
    ["flap", pageContent.flap],
  ].flatMap(([where, value]) =>
    levelTexts(value).flatMap((t) => [
      { where: where as string, level: "hs" as const, text: t.hs },
      { where: where as string, level: "uni" as const, text: t.uni },
    ]),
  ),
  ...lesson.marginNotes.flatMap((n) =>
    n.levels.map((level) => ({ where: `marginNotes.${n.id}`, level, text: n.text[level] })),
  ),
  ...pageContent.ignores.hs.map((text) => ({ where: "ignores", level: "hs" as const, text })),
  ...pageContent.ignores.uni.map((text) => ({ where: "ignores", level: "uni" as const, text })),
  { where: "deeper", level: "uni", text: deeperText },
  { where: "teacherNotes", level: "uni", text: teacherNotesText },
];
const allReaderText = readerTexts.map((t) => t.text).join("\n");

const probeById = new Map(uValleyProbes.map((p) => [p.id, p]));
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter((s) => s.trim()).length;

/** Sample values for rendering templates: long plausible strings, used for length budgets only. */
const SAMPLE: Record<string, number | string> = {
  modelTime: 300,
  rockName: "sandstone",
  faceDistance: 2.4,
  floorWidth: 220,
  valleyDepth: 340,
  floorLowered: 60,
  steepestWall: 46,
  iceThickness: 300,
  adverseRise: 10,
  shapeExponent: 1.74,
  keptRockName: "sandstone",
  keptModelTime: 300,
  keptFloorWidth: 220,
  keptValleyDepth: 340,
  keptFloorLowered: 60,
  keptSteepestWall: 46,
  keptShapeExponent: 1.74,
  sectionSpan: 120,
  noteRounding: 10,
};
const engine = new BindingEngine({ probes: uValleyProbes, controls: uValleySpread.controls });
engine.update({ probe: SAMPLE });
const render = (text: string) => engine.render(text);

// ---- Schema and bindings ---------------------------------------------------------------------------------
describe("u-valley spread: schema and bindings", () => {
  it("validates as a reader spread against the glacier catalogue", () => {
    const result = validateReaderSpread(uValleySpread, glacierCatalogue);
    expect(result.ok ? [] : result.issues).toEqual([]);
    expect(uValleySpread.scene.preset).toBe(START_PRESET_ID);
    for (const rock of ROCK_IDS) expect(captures[rock].manifest.start.preset).toBe(START_PRESET_ID);
  });

  it("declares probes the glacial host can serve", () => {
    for (const probe of uValleyProbes) {
      expect(GLACIAL_PROBE_KINDS as readonly string[]).toContain(probe.request.kind);
      if (probe.request.kind === "glacier-config")
        expect(GLACIER_CONFIG_FIELDS as string[], probe.id).toContain(probe.field);
      if (probe.request.kind === "glacier-rock")
        expect(ROCK_FIELDS as string[], probe.id).toContain(probe.field);
    }
  });

  it("types no number and binds only declared scalar probes, at the level that shows them", () => {
    for (const { where, level, text } of readerTexts) {
      expect(findTypedNumbers(text), `${where}.${level}: ${text}`).toEqual([]);
      expect(findMalformedBindings(text), where).toEqual([]);
      for (const b of parseBindings(text)) {
        expect(b.namespace, `${where}: ${b.raw}`).toBe("probe");
        const probe = probeById.get(b.key);
        expect(probe, `${where}: ${b.raw}`).toBeDefined();
        expect(probe!.shape, b.raw).toBe("scalar");
        expect(probe!.levels ?? ["hs", "uni"], `${where}.${level}: ${b.raw}`).toContain(level);
      }
    }
  });

  it("does not spell out configured quantities as words either", () => {
    const spelled =
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand)\s+(metres?|meters?|m|years?|model years|degrees|columns|cells|seeds|kilometres?)\b/i;
    for (const { where, text } of readerTexts) expect(text, where).not.toMatch(spelled);
  });

  it("renders every template through the binding engine", () => {
    for (const { level, text } of readerTexts)
      if (level === "hs" || level === "uni") expect(() => render(text)).not.toThrow();
    expect(render(lesson.marginNotes.find((n) => n.id === "time")!.text.hs)).toBe(
      "300 model years in sandstone",
    );
  });

  it("keeps expert-review metadata in every authored file and out of reader text", () => {
    expect(Object.keys(markdown).length).toBeGreaterThanOrEqual(7);
    for (const [path, text] of [...Object.entries(markdown), ...Object.entries(modules)])
      expect(text, path).toContain("<!-- expert-review -->");
    expect(allReaderText).not.toContain("<!--");
    expect(readerText("<!-- a -->\n\nText <!-- b -->")).toBe("Text");
  });
});

// ---- Claim/source register -------------------------------------------------------------------------------
const INTERNAL: readonly SourceKey[] = ["Model", "Protocol", "Results", "Rocks", "Lesson"];
const claimIds = new Set(claims.map((c) => c.id));
/** Claims about this model itself (its clock, its recorded runs), sourced to the model records. */
const MODEL_STATEMENTS = ["C10", "C16"];
const known = new Set<string>(sourceKeys);

/** Paragraphs of a markdown file with the claims/sources comment that precedes each. */
function annotatedParagraphs(text: string) {
  const out: { paragraph: string; claims: string[]; sources: string[] }[] = [];
  let current: { claims: string[]; sources: string[] } | null = null;
  for (const block of text.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    const meta = /^<!--\s*claims:\s*([^|]*)\|\s*sources:\s*([^>]*?)\s*-->$/.exec(trimmed);
    if (meta) {
      current = {
        claims: meta[1]!
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        sources: meta[2]!
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
      };
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

describe("u-valley claim/source register", () => {
  it("annotates every reader paragraph with registered claims and known sources", () => {
    for (const [path, text] of sourceMarkdown) {
      const paragraphs = annotatedParagraphs(text);
      expect(paragraphs.length, path).toBeGreaterThan(0);
      for (const p of paragraphs) {
        expect(p.claims.length, `${path}: ${p.paragraph.slice(0, 60)}`).toBeGreaterThan(0);
        expect(p.sources.length, `${path}: ${p.paragraph.slice(0, 60)}`).toBeGreaterThan(0);
        for (const id of p.claims) expect(claimIds.has(id), `${path}: claim ${id}`).toBe(true);
        for (const key of p.sources) expect(known.has(key), `${path}: source ${key}`).toBe(true);
      }
    }
  });

  it("resolves every parenthetical citation key in reader prose", () => {
    for (const { text } of readerTexts)
      for (const m of text.matchAll(/\(([A-Z][A-Za-z0-9]*(?:; [A-Z][A-Za-z0-9]*)*)\)/g))
        for (const key of m[1]!.split("; ")) expect(known.has(key), key).toBe(true);
  });

  it("supplies a literature source and evidence for every taught or explained claim", () => {
    for (const claim of claims) {
      expect(claim.sources.length, claim.id).toBeGreaterThan(0);
      expect(claim.evidence.length, claim.id).toBeGreaterThan(0);
      for (const key of claim.sources) expect(known.has(key), `${claim.id}: ${key}`).toBe(true);
      if (claim.status === "taught" || claim.status === "explained") {
        expect(
          claim.sources.some((k) => !INTERNAL.includes(k)) || MODEL_STATEMENTS.includes(claim.id),
          `${claim.id} needs a literature source`,
        ).toBe(true);
      }
    }
  });

  it("relies only on registered verdicts that passed, or on components that hold in every arm", () => {
    const byId = new Map(summary.verdicts.map((v) => [v.id, v]));
    for (const claim of claims) {
      for (const e of claim.evidence) {
        if (e.kind === "verdict") {
          expect(byId.get(e.id), `${claim.id}: ${e.id}`).toBeDefined();
          expect(byId.get(e.id)!.pass, `${claim.id}: ${e.id}`).toBe(true);
        } else if (e.kind === "component") {
          const arms = summary.verdicts.filter((v) => new RegExp(e.pattern).test(v.id));
          expect(arms.length, e.pattern).toBeGreaterThanOrEqual(9);
          for (const arm of arms) {
            if (e.holds === "b-rise") {
              // E-T1 detail: "b +0.25 (need +0.2)".
              const rise = Number(/b \+([0-9.]+)/.exec(arm.detail)?.[1]);
              expect(rise, arm.id).toBeGreaterThanOrEqual(0.2);
            } else {
              // T2 detail: "floor Δ 0.00 m".
              expect(arm.detail, arm.id).toMatch(/floor Δ 0\.00 m/);
            }
          }
        }
      }
    }
  });

  it("teaches each page claim somewhere and cites every listed source", () => {
    const used = new Set<string>();
    const referenced = new Set<string>();
    for (const [, text] of sourceMarkdown)
      for (const p of annotatedParagraphs(text)) {
        p.claims.forEach((c) => referenced.add(c));
        p.sources.forEach((s) => used.add(s));
      }
    for (const claim of claims) claim.sources.forEach((s) => used.add(s));
    for (const key of sourceKeys) expect(used.has(key), `source ${key} is never used`).toBe(true);
    for (const claim of claims.filter((c) => c.status === "taught"))
      expect(referenced.has(claim.id), `${claim.id} is not on the page`).toBe(true);
    for (const key of sourceKeys)
      expect(
        sources.some((s) => s.citation.startsWith(`${key} —`)),
        key,
      ).toBe(true);
  });

  it("makes no claim the registered runs do not support", () => {
    // R1 item 3: no floor-width claim, no full-T1 claim.
    const page = [pageContent.body.hs, pageContent.body.uni, pageContent.flap.hs, pageContent.flap.uni];
    for (const text of [...page, teacherNotesText, deeperText])
      for (const sentence of text.split(/(?<=[.;:])\s+/)) {
        // Sentences that state the limit itself ("not ordered", "not a finished U") are allowed.
        if (/\b(no width claim|not ordered|do not teach|not reached|not a finished)\b/i.test(sentence))
          continue;
        expect(sentence).not.toMatch(/\b(soft|shale|weak)\b[^.]*\bwider\b|\bwider\b[^.]*\b(soft|shale)\b/i);
        expect(sentence).not.toMatch(/\b(fully|complete|finished)\b[^.]*\bU\b/);
      }
    // The overdeepened note claims neither the valley head nor hard rock (lesson test below).
    const note = lesson.marginNotes.find((n) => n.id === "overdeepened")!;
    for (const text of [note.text.hs, note.text.uni])
      expect(text).not.toMatch(/valley head|hard rock|granite/i);
  });

  it("says model years and compressed time, never geological years", () => {
    expect(allReaderText).not.toMatch(
      /(?<!not )geolog\w* (years|time)|years ago|thousand years|million years|\bka\b/i,
    );
    expect(lesson.controlsCopy.timeUnit.hs).toBe("model years");
    expect(probeById.get("modelTime")!.unit).toBe("model years");
    expect(lesson.figure.limitation.hs).toMatch(/time is compressed/);
    expect(deeperText).toContain("Model years are not geological years");
  });

  it("names comparison as a separate run with another rock", () => {
    const compare = lesson.marginNotes.find((n) => n.id === "compare")!;
    expect(compare.text.hs).toContain("a separate run with another rock");
    expect(compare.text.uni).toContain("a separate run with another rock");
    expect(lesson.textAlternatives.compare.hs).toContain("a separate run with another rock");
    expect(teacherNotesText).toContain("a separate run with another rock");
    expect(allReaderText).not.toMatch(/paired run|side-by-side|lockstep/i);
  });
});

// ---- R1 view defaults against the capture manifests -------------------------------------------------------
function averagedSection(run: CapturedRun, snapshotIndex: number, gridColumn: number) {
  const snap = run.snapshot(snapshotIndex);
  const start = run.snapshot(0);
  const cols = noteColumns(gridColumn);
  const now = cols.map((i) => measureSection(snap.bedM, snap.iceThicknessM, run.manifest.grid, i));
  const then = cols.map((i) => measureSection(start.bedM, undefined, run.manifest.grid, i));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    floorM: mean(now.map((s) => s.floorElevationM)),
    floorLoweredM: mean(then.map((s) => s.floorElevationM)) - mean(now.map((s) => s.floorElevationM)),
    steepestWallDeg: mean(now.map((s) => s.maxWallSlopeDeg)),
    shapeExponent: mean(now.map((s) => s.shapeExponent)),
    iceM: mean(now.map((s) => s.maxIceThicknessM)),
  };
}

describe("u-valley view defaults (D-W5-R1 items 4 and 9)", () => {
  it("resolves the default front face against every capture manifest: same column, last snapshot", () => {
    for (const rock of ROCK_IDS) {
      const m = captures[rock].manifest;
      const face = resolveDefaultFrontFace(m);
      expect(face.gridColumn).toBe(U_VALLEY_VIEW.defaultFrontFace.gridColumn);
      expect(face.snapshotIndex).toBe(m.snapshots.length - 1);
      expect(face.modelYears).toBe(m.snapshots.at(-1)!.modelYears);
    }
    expect(() =>
      resolveDefaultFrontFace({ grid: { nx: 40, ny: 8, metresPerCell: 40 }, snapshots: [{ modelYears: 0 }] }),
    ).toThrow();
    expect(() => resolveDefaultFrontFace({ ...captures.shale.manifest, snapshots: [] })).toThrow();
  });

  it("keeps the display cut apart from the registered section the claims rest on", () => {
    expect(U_VALLEY_VIEW.registeredSectionColumn).toBe(PROTOCOL_SECTIONS.underIce);
    expect(U_VALLEY_VIEW.defaultFrontFace.gridColumn).not.toBe(U_VALLEY_VIEW.registeredSectionColumn);
    expect(deeperText).toContain("claims rest on the registered under-ice section");
    expect(teacherNotesText).toContain("display choice");
  });

  it("opens on a cut where every rock is a U by shape and the page sentence holds (averaged notes)", () => {
    const at = Object.fromEntries(
      ROCK_IDS.map((rock) => {
        const run = captures[rock];
        const face = resolveDefaultFrontFace(run.manifest);
        return [rock, averagedSection(run, face.snapshotIndex, face.gridColumn)];
      }),
    ) as Record<(typeof ROCK_IDS)[number], ReturnType<typeof averagedSection>>;
    for (const rock of ROCK_IDS) {
      expect(at[rock].shapeExponent, rock).toBeGreaterThan(1.5);
      expect(at[rock].iceM, rock).toBeGreaterThan(0);
    }
    expect(at.shale.floorLoweredM).toBeGreaterThan(at.sandstone.floorLoweredM);
    expect(at.sandstone.floorLoweredM).toBeGreaterThan(at.granite.floorLoweredM);
    expect(at.granite.steepestWallDeg).toBeGreaterThan(at.sandstone.steepestWallDeg);
    expect(at.sandstone.steepestWallDeg).toBeGreaterThan(at.shale.steepestWallDeg);
  });

  it("supports the page sentence at the registered section with the protocol's single-column measure", () => {
    const i = U_VALLEY_VIEW.registeredSectionColumn;
    const at = Object.fromEntries(
      ROCK_IDS.map((rock) => {
        const run = captures[rock];
        const last = run.count - 1;
        const s = measureSection(
          run.snapshot(last).bedM,
          run.snapshot(last).iceThicknessM,
          run.manifest.grid,
          i,
        );
        const s0 = measureSection(run.snapshot(0).bedM, undefined, run.manifest.grid, i);
        return [rock, { lowered: s0.floorElevationM - s.floorElevationM, wall: s.maxWallSlopeDeg }];
      }),
    ) as Record<(typeof ROCK_IDS)[number], { lowered: number; wall: number }>;
    expect(at.shale.lowered).toBeGreaterThan(at.sandstone.lowered);
    expect(at.sandstone.lowered).toBeGreaterThan(at.granite.lowered);
    expect(at.granite.wall).toBeGreaterThan(at.sandstone.wall);
    expect(at.sandstone.wall).toBeGreaterThan(at.shale.wall);
  });

  it("averages notes over three columns and rounds lengths for display", () => {
    expect(noteColumns(51)).toEqual([50, 51, 52]);
    expect(noteSpanM(captures.shale.manifest.grid.metresPerCell)).toBe(120);
    expect(roundForNote(56.7)).toBe(60);
    expect(roundForNote(-4)).toBe(0);
  });
});

// ---- Overdeepened note (D-W5-R1 item 5) -------------------------------------------------------------------
/**
 * Reference implementation of the `adverseRiseDownValleyM` probe contract (bindings.ts): the highest
 * averaged floor down-valley of the cut minus the averaged floor at the cut. The host computes it; this
 * copy checks that the note's words are true wherever it would show on the recorded runs.
 */
const floorCache = new Map<string, number[]>();
/** Floor elevation of every column of one snapshot (unit: metres), measured once. */
function floors(run: CapturedRun, snapshotIndex: number): number[] {
  const key = `${run.manifest.rockId}:${snapshotIndex}`;
  let out = floorCache.get(key);
  if (!out) {
    const snap = run.snapshot(snapshotIndex);
    out = Array.from(
      { length: run.manifest.grid.nx },
      (_, i) => measureSection(snap.bedM, snap.iceThicknessM, run.manifest.grid, i).floorElevationM,
    );
    floorCache.set(key, out);
  }
  return out;
}
function adverseRise(run: CapturedRun, snapshotIndex: number, gridColumn: number): number {
  const f = floors(run, snapshotIndex);
  const averaged = (i: number) => {
    const cols = noteColumns(i);
    return cols.reduce((t, c) => t + f[c]!, 0) / cols.length;
  };
  const half = (U_VALLEY_VIEW.marginNotes.sectionAverageColumns - 1) / 2;
  let highest = -Infinity;
  for (let i = half; i < gridColumn; i++) highest = Math.max(highest, averaged(i));
  return highest - averaged(gridColumn);
}
const valleyEndColumn = (run: CapturedRun) =>
  Math.round(run.manifest.start.options.valleyLengthM! / run.manifest.grid.metresPerCell);
const shows = (run: CapturedRun, k: number, i: number) =>
  adverseRise(run, k, i) >= U_VALLEY_VIEW.overdeepenedNote.minAdverseRiseM;

describe("u-valley overdeepened note on the recorded runs", () => {
  it("shows in shale's lower trough at the end of the run, not at the valley head", () => {
    const run = captures.shale;
    const last = run.count - 1;
    const columns = Array.from({ length: valleyEndColumn(run) - 2 }, (_, k) => k + 2).filter((i) =>
      shows(run, last, i),
    );
    expect(columns.length).toBeGreaterThan(0);
    expect(Math.max(...columns)).toBeLessThan(U_VALLEY_VIEW.defaultFrontFace.gridColumn);
  });

  it("never shows in granite, nor at the default cut in any rock", () => {
    const granite = captures.granite;
    for (let k = 0; k < granite.count; k += 5)
      for (let i = 2; i <= valleyEndColumn(granite); i += 3)
        expect(shows(granite, k, i), `t${k} i${i}`).toBe(false);
    for (const rock of ROCK_IDS) {
      const run = captures[rock];
      expect(shows(run, run.count - 1, U_VALLEY_VIEW.defaultFrontFace.gridColumn), rock).toBe(false);
    }
  });

  it("near the head, granite is lowered far more than at the default cut, yet its floor still rises up-valley", () => {
    const run = captures.granite;
    const last = run.count - 1;
    const atCut = averagedSection(run, last, U_VALLEY_VIEW.defaultFrontFace.gridColumn).floorLoweredM;
    const head = Math.max(
      ...Array.from(
        { length: 20 },
        (_, k) => averagedSection(run, last, valleyEndColumn(run) - 25 + k).floorLoweredM,
      ),
    );
    expect(head).toBeGreaterThan(4 * atCut);
    expect(shows(run, last, valleyEndColumn(run) - 15)).toBe(false);
  });
});

// ---- Copy for the R1 layout -------------------------------------------------------------------------------
describe("u-valley copy fits the R1 layout", () => {
  it("keeps the left page in editorial form: two or three short sentences, five key words", () => {
    expect(lesson.LESSON_NUMBER).toBe(1);
    expect(lesson.FIGURE_NUMBER).toBe(1);
    for (const level of ["hs", "uni"] as const) {
      expect(sentences(pageContent.body[level]), level).toBeGreaterThanOrEqual(2);
      expect(sentences(pageContent.body[level]), level).toBeLessThanOrEqual(3);
    }
    // The R1 review build's draft copy ran to about seventy-four words; the lesson must not be longer.
    expect(words(pageContent.body.hs)).toBeLessThanOrEqual(60);
    expect(words(pageContent.body.uni)).toBeLessThanOrEqual(74);
    expect(lesson.keyWords.map((k) => k.term.hs)).toEqual([
      "glacier",
      "V-shaped valley",
      "U-shaped valley",
      "glacial erosion",
      "rock type",
    ]);
    for (const k of lesson.keyWords) {
      expect(words(k.definition.hs), k.term.hs).toBeLessThanOrEqual(12);
      expect(words(k.definition.uni), k.term.hs).toBeLessThanOrEqual(14);
    }
  });

  it("keeps the flap, challenge, caption and limitation short", () => {
    expect(words(pageContent.flap.hs)).toBeLessThanOrEqual(70);
    expect(words(pageContent.flap.uni)).toBeLessThanOrEqual(100);
    expect(words(lesson.predict.question.hs)).toBeLessThanOrEqual(16);
    for (const level of ["hs", "uni"] as const) {
      expect(words(lesson.challenge[level])).toBeLessThanOrEqual(26);
      expect(words(lesson.figure.caption[level])).toBeLessThanOrEqual(26);
      expect(sentences(lesson.figure.limitation[level])).toBe(1);
    }
    // One limitation line on the page: the running text does not repeat it.
    for (const text of [pageContent.body.hs, pageContent.body.uni])
      expect(text).not.toMatch(/simplified model/i);
  });

  it("fits the default margin notes into the R1 notes' length", () => {
    const shown = (level: "hs" | "uni") =>
      lesson.marginNotes
        .filter((n) => n.levels.includes(level) && (n.when === "always" || n.when === "face-under-ice"))
        .map((n) => render(n.text[level]));
    // The R1 review build's six notes ran to about one hundred and eighty characters.
    expect(shown("hs").join("").length).toBeLessThanOrEqual(180);
    expect(shown("uni").join("").length).toBeLessThanOrEqual(280);
    for (const note of lesson.marginNotes)
      expect(render(note.text.hs).length, note.id).toBeLessThanOrEqual(note.id === "compare" ? 110 : 100);
  });

  it("gives Fig. 1 a few label words, and names the rocks soft to hard", () => {
    const labels = lesson.figure.labels.map((l) => l.text.hs);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(6);
    for (const word of ["V-shaped valley", "valley floor", "valley head"]) expect(labels).toContain(word);
    for (const l of labels) expect(l).toMatch(/^[A-Za-z -]+$/);
    expect(lesson.rocks.map((r) => r.id)).toEqual([...ROCK_IDS]);
    for (const r of lesson.rocks) expect(r.hardness.hs).toBe(ROCK_TYPES[r.id].hardness);
    expect(lesson.predict.options[lesson.predict.answer]!.hs).toMatch(/shale/i);
  });
});
