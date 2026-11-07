/* global self, performance */
import { createCpu, settings, median } from "./cpu.mjs";
self.onmessage = () => {
  const samples = [];
  for (let r = 0; r < settings.repeats; r++) {
    const cpu = createCpu(128);
    cpu.step(settings.warmup);
    const start = performance.now();
    cpu.step(settings.steps);
    samples.push((performance.now() - start) / settings.steps);
  }
  const cpu = createCpu(128);
  cpu.step(1);
  const snapshot = cpu.snapshot();
  self.postMessage({ msPerStep: median(samples), samples, snapshot: snapshot.buffer }, [snapshot.buffer]);
};
