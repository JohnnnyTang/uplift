import type { Level } from "../schema/spread";
import type { ReaderGesture, ReaderPresentation, ReaderSceneStatus, SceneReadiness } from "./contracts";

export interface ReaderLifecycleOptions {
  readonly questionOptionCount?: number;
  readonly level?: Level;
  readonly liftFraction?: number;
  readonly selection?: ReaderPresentation["selection"];
  readonly challenge?: "absent" | "pending" | "available";
}
/** Presentation and readiness are independent. No answer, endpoint or reward grants access. */
export class ReaderLifecycle {
  private view: ReaderPresentation;
  private scene: ReaderSceneStatus = {
    readiness: { kind: "loading" },
    gesture: "idle",
    activity: "paused",
    attached: false,
  };
  private challengeState: "absent" | "pending" | "available";
  private readonly listeners = new Set<() => void>();
  constructor(private readonly defaults: ReaderLifecycleOptions = {}) {
    this.defaults = structuredClone(defaults);
    const count = defaults.questionOptionCount;
    if (count !== undefined && (!Number.isInteger(count) || count < 2 || count > 4))
      throw new RangeError("Question needs two to four options");
    this.challengeState = defaults.challenge ?? "absent";
    this.view = this.initial(defaults.level ?? "hs");
    this.validate(this.view);
  }
  private initial(level: Level): ReaderPresentation {
    return {
      level,
      prediction:
        this.defaults.questionOptionCount === undefined ? { kind: "absent" } : { kind: "unanswered" },
      explanationOpen: false,
      liftFraction: this.defaults.liftFraction ?? 0,
      selection: structuredClone(this.defaults.selection ?? { kind: "none" }),
    };
  }
  private validate(state: ReaderPresentation): void {
    if (!Number.isFinite(state.liftFraction) || state.liftFraction < 0 || state.liftFraction > 1)
      throw new RangeError("Lift must be between zero and one");
    const prediction = state.prediction;
    if ((this.defaults.questionOptionCount === undefined) !== (prediction.kind === "absent"))
      throw new Error("Question presence is authored");
    if (
      prediction.kind === "answered" &&
      (!Number.isInteger(prediction.optionIndex) ||
        prediction.optionIndex < 0 ||
        prediction.optionIndex >= this.defaults.questionOptionCount!)
    )
      throw new RangeError("Unknown option");
    if (state.level !== "hs" && state.level !== "uni") throw new RangeError("Unknown reading level");
  }
  presentation(): ReaderPresentation {
    return structuredClone(this.view);
  }
  status(): ReaderSceneStatus {
    return structuredClone(this.scene);
  }
  present(state: ReaderPresentation): void {
    this.live();
    this.validate(state);
    this.view = structuredClone(state);
    this.publish();
  }
  setReadiness(readiness: SceneReadiness): void {
    this.live();
    this.scene = { ...this.scene, readiness: structuredClone(readiness) };
    this.publish();
  }
  setGesture(gesture: ReaderGesture): void {
    this.live();
    this.scene = { ...this.scene, gesture };
    this.publish();
  }
  setActivity(activity: ReaderSceneStatus["activity"]): void {
    this.live();
    this.scene = { ...this.scene, activity };
    this.publish();
  }
  setAttached(attached: boolean): void {
    this.live();
    this.scene = { ...this.scene, attached };
    this.publish();
  }
  get canPlay(): boolean {
    return this.scene.readiness.kind === "ready" && this.scene.attached && this.scene.activity !== "settling";
  }
  get challenge(): "absent" | "pending" | "available" {
    return this.challengeState;
  }
  /** Pending/absent challenges never produce a stamp; supported evaluation remains external. */
  get canAttemptChallenge(): boolean {
    return this.challengeState === "available" && this.canPlay;
  }
  reset(): void {
    this.live();
    this.view = this.initial(this.view.level);
    this.scene = { ...this.scene, activity: "paused", gesture: "idle" };
    this.publish();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose(): void {
    if (this.scene.readiness.kind === "disposed") return;
    this.scene = {
      ...this.scene,
      readiness: { kind: "disposed" },
      attached: false,
      activity: "paused",
      gesture: "idle",
    };
    this.publish();
    this.listeners.clear();
  }
  private live(): void {
    if (this.scene.readiness.kind === "disposed") throw new Error("Reader is disposed");
  }
  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
