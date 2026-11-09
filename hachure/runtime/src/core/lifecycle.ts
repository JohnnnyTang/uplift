export type LifecycleState = "flat" | "predicting" | "lifting" | "interactive" | "explained" | "challenged";
export interface LifecycleSnapshot {
  readonly state: LifecycleState;
  readonly prediction: number | null;
}

/** @deprecated Temporary legacy research adapter. 5E migrates callers to ReaderLifecycle.
 * New scenes never use prediction to authorize readiness or play. */
export class SpreadLifecycle {
  private current: LifecycleSnapshot = Object.freeze({ state: "flat", prediction: null });
  private readonly listeners = new Set<(snapshot: LifecycleSnapshot) => void>();
  constructor(
    private readonly options: { readonly keyControlId: string; readonly predictOptionCount: number },
  ) {
    if (!options.keyControlId.trim()) throw new Error("A key control id is required");
    if (
      !Number.isInteger(options.predictOptionCount) ||
      options.predictOptionCount < 2 ||
      options.predictOptionCount > 4
    ) {
      throw new RangeError("Predict needs two to four options");
    }
  }
  get state(): LifecycleState {
    return this.current.state;
  }
  get prediction(): number | null {
    return this.current.prediction;
  }
  get snapshot(): LifecycleSnapshot {
    return this.current;
  }
  private move(from: LifecycleState, to: LifecycleState, prediction = this.prediction): void {
    if (this.state !== from) throw new Error(`Cannot enter ${to} from ${this.state}`);
    this.publish({ state: to, prediction });
  }
  private publish(snapshot: LifecycleSnapshot): void {
    this.current = Object.freeze(snapshot);
    for (const listener of this.listeners) listener(this.current);
  }
  beginPrediction(): void {
    this.move("flat", "predicting");
  }
  commitPrediction(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.options.predictOptionCount)
      throw new RangeError("Unknown prediction option");
    this.move("predicting", "lifting", index);
  }
  completeLift(): void {
    this.move("lifting", "interactive");
  }
  explain(): void {
    this.move("interactive", "explained");
  }
  challenge(): void {
    this.move("explained", "challenged");
  }
  /** Resets the learning loop only. The host owns any explicit simulation reset. */
  reset(): void {
    this.publish({ state: "flat", prediction: null });
  }
  isControlEnabled(id: string): boolean {
    return (
      id !== this.options.keyControlId || ["interactive", "explained", "challenged"].includes(this.state)
    );
  }
  subscribe(listener: (snapshot: LifecycleSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
export function createSpreadLifecycle(
  options: ConstructorParameters<typeof SpreadLifecycle>[0],
): SpreadLifecycle {
  return new SpreadLifecycle(options);
}
