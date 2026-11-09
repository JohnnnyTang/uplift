/** <!-- expert-review --> Draft question; mechanism and validation sources: sources.md. */
import type { PredictSpec } from "@hachure/runtime";
import { RAIN_COMPARISON } from "@hachure/terrain";

/** Scoped to the matched gross-erosion experiment, not the failed incision question. */
export const predictDraft = {
  question: {
    hs: "The same starting landscape, the same model time. Which rain input will lift more material from the surface?",
    uni: "For matched exposed-rock runs at equal model time, which rain input produces greater cumulative gross erosion?",
  },
  options: [
    { hs: "Lighter rain", uni: "The lower rain input" },
    { hs: "Heavier rain", uni: "The higher rain input" },
    { hs: "The same amount", uni: "Equal cumulative gross erosion" },
  ],
  answer: RAIN_COMPARISON.answer,
  answerEvidence: RAIN_COMPARISON.evidencePath,
} as const satisfies PredictSpec;
