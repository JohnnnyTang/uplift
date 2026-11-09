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

The unavailable-graphics integration test additionally found that Three r187's
`WebGPURenderer` constructor overwrites `getFallback` with a WebGL backend, and
asynchronous `dispose()` re-awaits a failed `init()`. Compute now rejects absent
WebGPU/null adapters/device creation failure before constructing a renderer, then
uses the public managed `Renderer` plus `WebGPUBackend` and `StandardNodeLibrary`
with `getFallback: null`. Explicit device ownership and awaited cleanup prevent
both silent compute fallback and an uncaught disposal rejection. This retains the
same Three storage/dispatch kernels; 68 actual browser comparisons and three
availability unit tests pass. Book tests cover absent and null adapters with all
graphics contexts unavailable, while retaining flat prediction/replay.
