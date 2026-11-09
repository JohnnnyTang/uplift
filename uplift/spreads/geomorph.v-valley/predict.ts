/** <!-- expert-review --> Draft question; mechanism and validation sources: sources.md. */
import type { PredictSpec } from "@hachure/runtime";

/** A pending answer cannot accidentally satisfy the scored PredictSpec contract. */
export const predictDraft = {
  question: {
    hs: "If the rain is stronger over the experiment, will the valley become deeper, wider, or both? Comparison duration: {{scene.duration.predictSpan}}.",
    uni: "From identical starting terrain, how will stronger rain change incision and half-depth width at a matched duration? Comparison duration: {{scene.duration.predictSpan}}.",
  },
  options: [
    { hs: "Deeper", uni: "Greater incision only" },
    { hs: "Wider", uni: "Greater half-depth width only" },
    { hs: "Both deeper and wider", uni: "Greater incision and half-depth width" },
  ],
  // TODO(3B): replace only from the reproducible T6 result, then supply answerEvidence.
  // Inconclusive or failed validation is not an answer option.
  answer: null,
} as const satisfies Omit<PredictSpec, "answer"> & { readonly answer: null };
