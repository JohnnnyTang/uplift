# 4A GPU lifecycle review fixes

Three integration-review findings are covered by real CPU/WebGPU regressions:

- `dtSimSeconds` may change at reset before a run, matching CPU policy. A changed
  step is rejected synchronously once work is accepted or enqueued; the existing
  configuration and model state remain intact.
- Tool requests, including nested positions and source IDs/amounts, are captured
  synchronously before asynchronous GPU readback. Reusing caller objects cannot
  rewrite queued commands.
- Rejected work restores the public scheduled step count even when rejection
  occurs at a latched queue gate. A generation counter protects subsequent
  `reset(); step()` recovery from callbacks belonging to the old failed run.

Validation: TypeScript and all 68 installed-Chrome WebGPU browser tests pass.
No numerical kernel, process law, scientific threshold, parameter default or
historical science artifact changes. Book integration remains a separate change.
