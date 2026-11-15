/**
 * <!-- expert-review -->
 * Builds the sentence-level claim/source register of "Where plates meet": every reader sentence, where it
 * stands, the claims it rests on and their sources. docs/science/plates/lesson/README.md carries the table
 * this produces, and lesson.test.ts checks that the README holds every row, so the register cannot drift
 * from the copy. Pure and dependency-free (inputs are passed in), so a script can print it too.
 */
import type { LevelText } from "@hachure/runtime";

export interface RegisterClaim {
  readonly id: string;
  readonly sources: readonly string[];
}

export interface RegisterRow {
  readonly where: string;
  readonly level: string;
  readonly sentence: string;
  readonly claims: readonly string[];
  readonly sources: readonly string[];
}

const META = /^<!--\s*claims:\s*([^|]*)\|\s*sources:\s*([^>]*?)\s*-->$/;
const list = (s: string, sep: string) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

/** Splits reader text into sentences (bold run-in heads stay with their sentence). */
export function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+(?=[A-Z"“*])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function levelTexts(value: unknown): LevelText[] {
  if (value && typeof value === "object" && "hs" in value && "uni" in value) return [value as LevelText];
  if (Array.isArray(value)) return value.flatMap(levelTexts);
  if (value && typeof value === "object") return Object.values(value).flatMap(levelTexts);
  return [];
}

/**
 * @param markdown  Reader markdown by file name (`page.hs.md`, …), with review comments.
 * @param groups    Text groups of lesson.ts by `textClaims` key, each a level text or a list per level.
 * @param textClaims  lesson.ts's claims per text group.
 * @param claims    The claim register (id and sources).
 */
export function buildRegister(
  markdown: Readonly<Record<string, string>>,
  groups: Readonly<Record<string, unknown>>,
  textClaims: Readonly<Record<string, readonly string[]>>,
  claims: readonly RegisterClaim[],
): RegisterRow[] {
  const sourcesOf = (ids: readonly string[], extra: readonly string[] = []) => {
    const out = new Set<string>(extra);
    for (const id of ids) for (const s of claims.find((c) => c.id === id)?.sources ?? []) out.add(s);
    return [...out];
  };
  const rows: RegisterRow[] = [];
  for (const [file, text] of Object.entries(markdown)) {
    const level = /\.hs\.md$/.test(file) ? "hs" : "uni";
    let current: { claims: string[]; sources: string[] } | null = null;
    for (const block of text.split(/\n\s*\n/)) {
      const trimmed = block.trim();
      const meta = META.exec(trimmed);
      if (meta) {
        current = { claims: list(meta[1]!, ","), sources: list(meta[2]!, ";") };
        continue;
      }
      if (!trimmed || /^<!--[\s\S]*-->$/.test(trimmed)) continue;
      for (const sentence of sentencesOf(trimmed))
        rows.push({
          where: file,
          level,
          sentence,
          claims: current?.claims ?? [],
          sources: sourcesOf(current?.claims ?? [], current?.sources ?? []),
        });
      current = null;
    }
  }
  for (const [group, value] of Object.entries(groups)) {
    const ids = textClaims[group] ?? [];
    const perLevel: [string, string][] = Array.isArray((value as { hs?: unknown }).hs)
      ? (["hs", "uni"] as const).flatMap((l) =>
          ((value as Record<string, string[]>)[l] ?? []).map((t) => [l, t] as [string, string]),
        )
      : levelTexts(value).flatMap((t) =>
          t.hs === t.uni
            ? [["both", t.hs] as [string, string]]
            : [["hs", t.hs] as [string, string], ["uni", t.uni] as [string, string]],
        );
    for (const [level, text] of perLevel)
      for (const sentence of sentencesOf(text))
        rows.push({ where: `lesson.ts ${group}`, level, sentence, claims: ids, sources: sourcesOf(ids) });
  }
  return rows;
}

/** One markdown table row per register row (pipes escaped). */
export function registerTable(rows: readonly RegisterRow[]): string[] {
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  return [
    "| Where | Level | Sentence | Claims | Sources |",
    "| ----- | ----- | -------- | ------ | ------- |",
    ...rows.map(
      (r) =>
        `| ${cell(r.where)} | ${r.level} | ${cell(r.sentence)} | ${r.claims.join(", ")} | ${r.sources.join(", ")} |`,
    ),
  ];
}
