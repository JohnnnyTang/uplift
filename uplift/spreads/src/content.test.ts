import { describe, expect, it } from "vitest";
import {
  assertNoTypedNumbers,
  findMalformedBindings,
  parseBindings,
  SCENE_BINDING_KEYS,
} from "@hachure/runtime";
import { contentBindings, pageContent, teacherNotesText } from "../geomorph.v-valley/content";
import { predictDraft } from "../geomorph.v-valley/predict";
import { sourceKeys, sources } from "../geomorph.v-valley/sources";

// Scan authored files too: a new paragraph must not evade the checks by staying unimported.
const markdown = import.meta.glob<string>("../geomorph.v-valley/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const modules = import.meta.glob<string>(["../geomorph.v-valley/*.ts", "!../geomorph.v-valley/spread.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

// Link destinations and DOI identifiers are bibliography metadata, not displayed quantities.
// Link labels remain under test, including a numeric value hidden inside a label.
const visibleMarkdown = (text: string): string => text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
const authoredFields = [
  ...strings(pageContent),
  ...strings(predictDraft.question),
  ...strings(predictDraft.options),
  teacherNotesText,
  ...sources.map((source) => source.citation),
  ...Object.values(markdown).map(visibleMarkdown),
];

function assertDeclaredBindings(text: string): void {
  expect(findMalformedBindings(text), text).toEqual([]);
  const allowed = new Set<string>([
    ...SCENE_BINDING_KEYS.map((key) => `scene.${key}`),
    ...contentBindings.durations.map((id) => `scene.duration.${id}`),
    ...contentBindings.scalarProbes.map((id) => `probe.${id}`),
    ...contentBindings.valueControls.map((id) => `control.${id}`),
  ]);
  for (const binding of parseBindings(text)) {
    expect(allowed.has(`${binding.namespace}.${binding.key}`), binding.raw).toBe(true);
  }
}

describe("valley draft content", () => {
  it("binds every computed number and resolves every authored binding", () => {
    for (const text of authoredFields) {
      assertNoTypedNumbers(text);
      assertDeclaredBindings(text);
    }
  });

  it("retains expert-review metadata in every authored content file", () => {
    expect(Object.keys(markdown).length).toBeGreaterThanOrEqual(7);
    for (const [path, text] of [...Object.entries(markdown), ...Object.entries(modules)])
      expect(text, path).toContain("<!-- expert-review -->");
    // Metadata is not spoken as prose by a textContent-based shell.
    expect(pageContent.body.hs).not.toContain("<!--");
    expect(pageContent.flap.uni).not.toContain("<!--");
    expect(teacherNotesText).not.toContain("<!--");
  });

  it("leaves prediction correctness pending real-model evidence", () => {
    expect(predictDraft.answer).toBeNull();
    expect("answerEvidence" in predictDraft).toBe(false);
    expect(predictDraft.options).toHaveLength(3);
    for (const question of Object.values(predictDraft.question))
      expect(question).toContain("{{scene.duration.predictSpan}}");
    expect(pageContent.flap.hs).toContain("not marked any choice correct");
    expect(pageContent.flap.uni).toContain("pending model validation");
  });

  it("keeps clock approval and the comparative equation explicit", () => {
    for (const body of Object.values(pageContent.body)) expect(body).toContain("{{scene.timeScale}}");
    for (const level of ["hs", "uni"] as const)
      expect(pageContent.ignores[level].join(" ")).toContain("{{scene.timeScale}}");
    expect(pageContent.equations).toEqual(["E = K A^{m} S^{n}"]);
    expect(pageContent.body.uni).toContain("not this solver's capacity equation");
    expect(pageContent.body.uni).toContain("K has no established mapping");
  });

  it("resolves prose citation keys and supplies a source for every key", () => {
    const knownKeys = new Set<string>(sourceKeys);
    for (const text of [...strings(pageContent), teacherNotesText]) {
      for (const citation of text.matchAll(/\(([A-Z][A-Za-z0-9]*(?:; [A-Z][A-Za-z0-9]*)*)\)/g))
        for (const key of citation[1]!.split("; ")) expect(knownKeys.has(key), key).toBe(true);
    }
    for (const key of sourceKeys)
      expect(
        sources.some((source) => source.citation.startsWith(`${key} —`)),
        key,
      ).toBe(true);
    for (const source of sources) expect(source.url).toBeTruthy();
  });

  it("catches typed quantities, missing declarations and the legacy clock alias", () => {
    expect(() => assertNoTypedNumbers("Run for 1000 years.")).toThrow();
    expect(() => assertNoTypedNumbers(visibleMarkdown("[10 m](https://example.org)"))).toThrow();
    expect(() => assertDeclaredBindings("{{probe.incisionDepht}}")).toThrow();
    expect(() => assertDeclaredBindings("{{scene.duration.undeclared}}")).toThrow();
    expect(() => assertDeclaredBindings("{{scene.timeScaleLabel}}")).toThrow();
    expect(() => assertDeclaredBindings("{{probe}}")).toThrow();
  });
});
