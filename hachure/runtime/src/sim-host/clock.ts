/** Wall-clock scheduling only; numerical dt always remains a solver config value. */
export class FixedStepClock {
  private remainder = 0;
  droppedRealSeconds = 0;
  constructor(
    readonly stepsPerRealSecond: number,
    readonly maxBatchSteps = 8,
  ) {
    if (
      !Number.isFinite(stepsPerRealSecond) ||
      stepsPerRealSecond <= 0 ||
      !Number.isInteger(maxBatchSteps) ||
      maxBatchSteps < 1
    )
      throw new RangeError("Invalid fixed-step clock");
  }
  add(realSeconds: number, speed: number): void {
    if (!Number.isFinite(realSeconds) || realSeconds < 0 || !Number.isFinite(speed) || speed <= 0)
      throw new RangeError("Invalid wall-clock advance");
    const incoming = realSeconds * this.stepsPerRealSecond * speed;
    const capacity = this.maxBatchSteps * 2;
    const excess = Math.max(0, this.remainder + incoming - capacity);
    this.droppedRealSeconds += excess / (this.stepsPerRealSecond * speed);
    this.remainder = Math.min(capacity, this.remainder + incoming);
  }
  take(): number {
    const steps = Math.min(this.maxBatchSteps, Math.floor(this.remainder + 1e-10));
    this.remainder = Math.max(0, this.remainder - steps);
    return steps;
  }
  reset(): void {
    this.remainder = 0;
    this.droppedRealSeconds = 0;
  }
}
