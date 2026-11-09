/** <!-- expert-review --> Draft reader text; source markers remain in the displayed copy. */
import type { PageSpec } from "@hachure/runtime";
import hsBody from "./page.hs.md?raw";
import uniBody from "./page.uni.md?raw";
import hsFlap from "./flap.hs.md?raw";
import uniFlap from "./flap.uni.md?raw";
import teacherNotes from "./teacher-notes.md?raw";
import { equations } from "./equations";
import { ignores } from "./ignores";
import { keyWords } from "./keywords";

// Review metadata stays in source, not in textContent read aloud to a learner.
const readerText = (text: string): string => text.replace(/<!-- expert-review -->/g, "").trim();

export const pageContent = {
  body: { hs: readerText(hsBody), uni: readerText(uniBody) },
  flap: { hs: readerText(hsFlap), uni: readerText(uniFlap) },
  ignores,
  keyWords,
  equations,
} as const satisfies Omit<PageSpec, "predict">;

export const teacherNotesText = readerText(teacherNotes);

/** Required declarations for the integrating spread; no model values are duplicated here. */
export const contentBindings = {
  scalarProbes: ["incisionDepth", "sedimentOut"],
  valueControls: ["rain"],
  durations: ["predictSpan"],
} as const;
