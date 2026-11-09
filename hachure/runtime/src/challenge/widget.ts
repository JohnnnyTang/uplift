import type { ChallengeSpec, Level, LevelText } from "../schema/spread";
import { el } from "../widgets/controls";
import { formatBoundNumber } from "../bindings/format";
import { ChallengeEvaluator, type ChallengeObservation } from "./evaluator";
import { browserProgressStorage, ChallengeProgress, type StampRecord } from "./progress";
import "./challenge.css";
export interface ChallengeWidgetOptions {
  readonly spreadId: string;
  readonly definitionId: string;
  readonly spec: ChallengeSpec;
  readonly predictionOptions: readonly LevelText[];
  readonly observationIntervalSteps: number;
  readonly progress?: ChallengeProgress;
  readonly onAward?: (record: StampRecord) => void;
}
export interface ChallengeLearningState {
  readonly level: Level;
  readonly prediction: number | null;
  readonly explained: boolean;
}
/** A pending definition always outranks local progress, including stale or forged records. */
export function createChallengeWidget(options: ChallengeWidgetOptions) {
  const root = el("section", undefined, "challenge-widget");
  root.setAttribute("aria-label", "Landscape challenge");
  const title = el("h2", "Challenge"),
    prompt = el("p"),
    answer = el("p", undefined, "supporting-text");
  const status = el("p", undefined, "challenge-status widget-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-atomic", "true");
  function updateStatus(text: string) {
    if (status.textContent !== text) status.textContent = text;
  }
  const stamp = el("p", undefined, "stamp");
  stamp.hidden = true;
  root.append(title, prompt, answer, status);
  const evaluator = new ChallengeEvaluator(options.spec.check, options.observationIntervalSteps);
  const progress = options.progress ?? new ChallengeProgress(browserProgressStorage());
  let earnedThisRun: StampRecord | undefined;
  function update(observation: ChallengeObservation | undefined, state: ChallengeLearningState) {
    prompt.textContent = options.spec.prompt[state.level];
    const committed = state.prediction === null ? undefined : options.predictionOptions[state.prediction];
    answer.textContent = committed
      ? `Your committed prediction: ${committed[state.level]}.`
      : "Commit a prediction, test it, then reveal the explanation before attempting the challenge.";
    const evaluation = observation ? evaluator.observe(observation) : undefined;
    root.dataset.status = evaluation?.status ?? "waiting";
    if (evaluator.pendingReason) {
      updateStatus(`Challenge not yet available. ${evaluator.pendingReason}`);
      root.dataset.status = "pending";
      stamp.remove();
      return;
    }
    if (!committed || !state.explained) {
      evaluator.reset();
      root.dataset.status = "waiting";
      updateStatus(
        "Test your committed prediction and reveal the explanation before attempting this challenge.",
      );
    } else if (!evaluation) updateStatus("Waiting for a completed simulation observation.");
    else {
      updateStatus(evaluation.reason);
      if (evaluation.passed && observation && !earnedThisRun) {
        earnedThisRun = {
          spreadId: options.spreadId,
          stampId: options.spec.stamp.id,
          definitionId: options.definitionId,
          runId: observation.runId,
          step: observation.step,
        };
        progress.record(earnedThisRun);
        options.onAward?.({ ...earnedThisRun });
      }
    }
    const record =
      earnedThisRun ?? progress.get(options.spreadId, options.spec.stamp.id, options.definitionId);
    stamp.hidden = !record;
    if (record) root.append(stamp);
    else stamp.remove();
    if (record)
      stamp.textContent = `${earnedThisRun ? "Stamp earned" : "Previously earned stamp"}: ${options.spec.stamp.label[state.level]}. Recorded at ${formatBoundNumber(record.step, "model steps")}.`;
  }
  // Explicit reset clears the current attempt, never the learner's previously earned progress.
  function reset() {
    evaluator.reset();
    earnedThisRun = undefined;
    stamp.hidden = true;
    stamp.remove();
  }
  return { root, update, reset };
}

/** Shared wording for an explanation anchored to the learner's actual choice. */
export function committedExplanation(
  options: readonly LevelText[],
  prediction: number | null,
  level: Level,
  text: string,
) {
  const choice = prediction === null ? undefined : options[prediction];
  return choice ? `You predicted: ${choice[level]}.\n\n${text}` : text;
}
