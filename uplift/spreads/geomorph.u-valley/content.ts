/**
 * <!-- expert-review -->
 * Assembles the reader text of "From V to U". Review metadata (`<!-- expert-review -->` and the per-paragraph
 * `<!-- claims: … | sources: … -->` comments) stays in source and is stripped from what a reader or a
 * screen reader gets.
 */
import type { PageSpec } from "@hachure/runtime";
import hsBody from "./page.hs.md?raw";
import uniBody from "./page.uni.md?raw";
import hsFlap from "./flap.hs.md?raw";
import uniFlap from "./flap.uni.md?raw";
import uniDeeper from "./deeper.uni.md?raw";
import teacherNotes from "./teacher-notes.md?raw";
import { equations, ignores, keyWords } from "./lesson";

/** Removes review comments and collapses the blank lines they leave. */
export const readerText = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const pageContent = {
  body: { hs: readerText(hsBody), uni: readerText(uniBody) },
  flap: { hs: readerText(hsFlap), uni: readerText(uniFlap) },
  ignores,
  keyWords,
  equations,
} as const satisfies Omit<PageSpec, "predict">;

/** The deeper level (university reading level only): mechanisms, bound parameters, graphs, measures. */
export const deeperText = readerText(uniDeeper);

export const teacherNotesText = readerText(teacherNotes);
