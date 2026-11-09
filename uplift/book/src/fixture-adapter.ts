/** Thin local adapter for 1A contracts. Replace at 3A integration, not with unmerged 2D code. */
import { createFakeSolver, fakeTiltedPlanePreset } from "@hachure/terrain/testing";
import type { StateSnapshot } from "@hachure/terrain";
import { clampRange } from "@hachure/runtime";
import { mockSpread } from "./mock-spread";
export function createFixtureAdapter() {
  const rain = mockSpread.controls.find((control) => control.kind === "slider")!;
  const speedSpec = mockSpread.controls.find((control) => control.kind === "speed")!;
  const solver = createFakeSolver({ gridSize: 32, seed: mockSpread.scene.seed, rainMmPerHr: rain.default });
  let speed = speedSpec.default,
    playing = false,
    remainder = 0;
  return {
    solver,
    get playing() {
      return playing;
    },
    get speed() {
      return speed;
    },
    setRain(value: number) {
      solver.configure({ rainMmPerHr: clampRange(value, rain) });
    },
    setSpeed(value: number) {
      speed = clampRange(value, speedSpec);
    },
    play() {
      playing = true;
    },
    pause() {
      playing = false;
    },
    /** Advance integer fixed steps only; the numerical timestep never changes. */
    advance(realSeconds: number) {
      if (!playing) return;
      remainder += Math.max(0, Math.min(realSeconds, 0.1)) * mockSpread.scene.stepsPerRealSecond * speed;
      const steps = Math.floor(remainder);
      remainder -= steps;
      if (steps) solver.step(steps);
    },
    reset() {
      playing = false;
      speed = speedSpec.default;
      remainder = 0;
      solver.configure({ rainMmPerHr: rain.default });
      solver.reset(fakeTiltedPlanePreset, mockSpread.scene.seed);
    },
    snapshot: () => solver.snapshot(),
  };
}
/** Numerical text derives from live snapshot/config values; no geological clock is invented. */
export function fixtureLabels(snapshot: StateSnapshot, speed: number, stepsPerRealSecond: number) {
  const format = (n: number) => new Intl.NumberFormat("en", { maximumSignificantDigits: 4 }).format(n);
  const barM = (snapshot.gridSize * snapshot.metresPerCell) / 4;
  return {
    time: `Uncalibrated fixture · ${format(stepsPerRealSecond * speed)} fixed steps per real second`,
    scale: `${format(barM)} m · fixture distance`,
    description: `Fake solver at step ${format(snapshot.step)}. Water input total: ${format(snapshot.budget.rainedWaterM3)} m³. Surface changes are scripted test data.`,
  };
}
