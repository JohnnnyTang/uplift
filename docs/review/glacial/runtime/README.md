# Runs, timeline and comparison runtime (session 5J)

**Result: wave plan §4 is implemented in `@hachure/runtime` and proven by unit tests in Node and browser
tests in a real Worker on the reference grid (160 × 64). The tests cover WebGPU by default, the labelled CPU
fallback, and a real WebGPU device loss in installed Chrome.** There is no scene or book integration here:
5K owns the scene and 5M joins it to the book.

| File                                                 | What                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `hachure/runtime/src/glacial-host/`                  | `GlacialHost` (main thread), engine, protocol, Worker transport, labels, animation driver |
| `hachure/runtime/src/runs/`                          | Run config and budget, `RecordedRun` (capture format), `RunStore` (kept runs, lookup)     |
| `hachure/runtime/src/*/host.test.ts`, `runs.test.ts` | Unit tests (Node, in-process engine with Worker semantics)                                |
| `e2e/glacial-runtime.spec.ts`                        | Browser tests, using the fixture `e2e/fixtures/glacial-runtime.html`                      |
| `e2e/fixtures/glacial-runtime-evidence.json`         | What the browser tests observed, per browser (backend, reasons, hashes, memory, timing)   |

## Entry points

- `@hachure/runtime/glacial`: main-thread side. It contains `GlacialHost`, `GlacialWorkerTransport`,
  `driveGlacialHost`, the labels and the `runs` module. It loads no solver or GPU code.
- `@hachure/runtime/glacial-worker`: the engine side. An app Worker module calls `installGlacialWorker(self)`.
  `InProcessGlacialTransport` runs the same engine on the calling thread, for tests or as a last resort.

```ts
const host = new GlacialHost({
  transport: new GlacialWorkerTransport(
    new Worker(new URL("./glacial.worker.ts", import.meta.url), { type: "module" }),
  ),
});
await host.initialize(); // backend chosen, run 1 at the authored start, paused
driveGlacialHost(host); // requestAnimationFrame → host.advance(realSeconds)
host.subscribe((state) => render(state, host.viewFrame(), host.comparison()));
// Page rock selector AND 3D specimen drop:
host.dispatch({ kind: "choose-rock", rockId });
```

## §4 as built

| Reader action                    | Command / API                                    | Behaviour                                                                                                                                                                                                                                                                                                                                                                                             | Proven by                                                                          |
| -------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Choose a rock (selector or drop) | `{ kind: "choose-rock", rockId }` (the only one) | If the live run has not advanced, the choice just sets the rock: the unadvanced run is replaced and nothing is kept. Otherwise a new run starts from the authored start and the previous run is kept unchanged. The play intent is kept: if the old run was playing, the new one plays from step 0. Choosing the live run's own rock does nothing. The newly kept run becomes the default comparison. | unit "rock choice"; e2e "one rock command" (both inputs log the identical command) |
| Play / pause / step / speed      | `play`, `pause`, `step`, `set-speed`             | Fixed step `dtYears` always. Speed (¼–4×) and `modelYearsPerRealSecond` change scheduling only. One batch is in flight at a time. Wall-clock time a slow backend cannot use is dropped, not caught up. `step` advances to the next recorded time. A run stops at its horizon.                                                                                                                         | unit "time"; e2e                                                                   |
| Record                           | automatic                                        | Snapshots are recorded at step 0 and every `snapshotIntervalYears` (20). The worker splits batches at those boundaries, so recorded snapshots do not depend on scheduling. They are stored in the frozen capture format (u16, 81 920 B per snapshot), and `RecordedRun` implements `CapturedRun`.                                                                                                     | unit "recorded run"; e2e determinism                                               |
| Scrub                            | `{ kind: "scrub", modelYears, runId? }`          | Scrubbing pauses and shows the nearest recorded snapshot of the live or a kept run, labelled "earlier · model time t" or "kept run N · model time t". `play` and `step` return to the live state. Scrubbing to the live head is the live view. Nothing branches.                                                                                                                                      | unit, e2e "scrubbing"                                                              |
| Compare                          | `{ kind: "compare", runId }`, `comparison()`     | Uses the recorded snapshot nearest to the viewed time, labelled with its actual time ("matched" / "nearest"). Runs on different backends compare **only at matched recorded times**; otherwise the result is "unmatched" with a reason.                                                                                                                                                               | unit "comparison"; e2e fallback                                                    |
| Kept-run limit                   | automatic                                        | The live run plus up to two kept runs are held. A third kept run drops the oldest, with a visible `evicted` notice. References to the dropped run (comparison, view) are cleared.                                                                                                                                                                                                                     | unit, e2e "eviction"                                                               |
| Reset                            | `{ kind: "reset", confirmed? }`                  | Returns `confirm-required` while kept runs exist. Confirmed: no kept runs, the default rock, speed 1, the live view and no comparison. The session's backend is kept, so a failed GPU is not silently retried.                                                                                                                                                                                        | unit, e2e "reset" (inline confirm, focus)                                          |
| Leave / return                   | `pauseAndSettle()`, `resume()`                   | Leaving pauses, drains accepted work, publishes a final frame equal to the live position, and keeps everything. Commands are rejected until return. Return restores the play intent; the first animation frame after it is only a baseline (no catch-up).                                                                                                                                             | unit, e2e "leaving mid-run"                                                        |
| Level, camera, cut, ice view     | —                                                | These are not host state at all. A level toggle leaves the runs, hashes and state unchanged.                                                                                                                                                                                                                                                                                                          | unit, e2e "scrubbing" (state equal across levels)                                  |

### Backend

`selectGlacierBackend({ prefer: "auto" })` runs in the Worker once, at run 1. It picks WebGPU where
`GLACIER_GPU_PARITY` and the per-device check allow it, otherwise the CPU with `fallbackReason`. Later runs
use the same backend, with no device check each time. Every run carries `backend` and `fallbackReason`;
`state().backend/fallbackReason` is the live run's, for the deeper level or diagnostics.

- If a later WebGPU creation fails, that run (and the session from then on) runs on the CPU, labelled.
- If a run fails mid-way (`GlacierGpuError`), it is **halted**. Snapshots recorded before the failure stay,
  and the run never continues. The host offers `{ kind: "restart-on-cpu" }`, which starts a NEW CPU run from
  the authored start through `restartOnCpu`, labelled "WebGPU run halted at step N (reason); new CPU run
  from the authored start". The halted run becomes a kept run with its `webgpu` label.

### Memory

Production plan: 16 snapshots × 81 920 B = 1.31 MB per run, so the live run plus two kept runs need at most
3.93 MB, against a 32 MiB budget. `planGlacialRuns` refuses any config whose worst case exceeds the budget,
`RecordedRun` refuses snapshots beyond its run's limit, and `RunStore` asserts the budget after every change.
The bed quantization is fixed at each run's start, with 500 m of headroom below the start's lowest bed. A
unit test re-encodes all three registered 300-year captures with it: **0 values clamped**.

## Browser evidence (this machine, 2026-11-12)

The suite passed **11 of 11 tests in installed Chrome** (`UPLIFT_E2E_CHANNEL=chrome`, Intel Arc 140V, WebGPU)
and **8 passed + 3 skipped in Playwright's bundled Chromium**, which has no WebGPU adapter. The skipped
tests need WebGPU, and the labelled fake covers the halt path there.

- Auto backend: `webgpu` in Chrome. In bundled Chromium it is `cpu`, with "WebGPU not used, running on CPU:
  [adapter-unavailable] No WebGPU adapter".
- Forced `skew-erosion` fault in Chrome: `cpu`, "[device-check-failed] GPU differs from CPU on this device
  after 80 steps (bed 0.61 m …; limit 0.01 m)".
- Real device loss in Chrome (`loseDeviceForTest`): the run halted at step 100 (`device-lost`) and the CPU
  run was offered.
- Determinism: the same rock gave identical recorded hashes in a Worker at 4× and on the main thread
  stepping 37 at a time, and again after a reload (9 snapshots). The step-400 hash equals the hash a Node
  run of the reference grid gives (`35216f50917fba66`). WebGPU same-device replay at 4× and with
  53-step chunks gave identical hashes. As D-W5-5I says, these hashes are not equal to the CPU's, even at the
  start, so the backend label matters.
- Production recording on WebGPU: a full 300-year run (120 000 steps) recorded 16 snapshots and 1 310 720 B
  with 0 clamped, in about 8 s of wall time at 4×.

Commands: `pnpm test` (unit), `pnpm exec playwright test e2e/glacial-runtime.spec.ts` (browser), and
`UPLIFT_E2E_CHANNEL=chrome …` (adds the WebGPU tests).

## Handover notes for 5K and 5M

- Wire the page rock selector and the specimen drop to the same `dispatch({ kind: "choose-rock", rockId })`.
- The scene reads `viewFrame()`, which gives the snapshot, probes and label of whatever is shown, live or
  recorded. The ghost reads `comparison()`, whose snapshot is at the actual recorded time and whose label
  carries that time. Margin notes measure these snapshots, so the page, the scene and the notes refer to the
  same run and time (GV5).
- `host.run(id)` is a `CapturedRun`, so `reviewRunsFromCaptures`-style code can show live or kept runs as-is.
- A "flip" to the other run's scene is `dispatch({ kind: "scrub", runId: compareRunId, modelYears })`.
- The label strings in `labels.ts` are defaults built from bound values. 5L can wrap or replace the wording.
- The book needs its own Worker module: `installGlacialWorker(self)` from `@hachure/runtime/glacial-worker`.
- A CPU-only 300-year run takes about 90 s of Worker time (D-W5-5G). Playback on the CPU is therefore
  slower than the scheduled rate, by design (dropped wall-clock time, never a larger step).
