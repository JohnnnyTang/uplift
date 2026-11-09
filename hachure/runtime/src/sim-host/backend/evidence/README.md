# 4A book backend evidence

`e2e/backends.spec.ts` exercises the production book through the preview server.
The original 4E cases remain CPU-pinned in `e2e/helpers.ts`; backend coverage is
separate and does not turn unavailable WebGPU into a claimed GPU pass.

Installed Chrome hardware run:

```powershell
$env:UPLIFT_BACKEND_CHROME='1'
$env:UPLIFT_REQUIRE_WEBGPU='1'
$env:UPLIFT_BACKEND_EVIDENCE='1'
pnpm exec playwright test e2e/backends.spec.ts --reporter=list
```

Generic CI uses `pnpm exec playwright test`. Its forced WebGPU case may genuinely
return flat when an adapter is unavailable; the test verifies the failure reason,
static drawing and domain, while independent flat tests verify the guided loop.
`UPLIFT_REQUIRE_WEBGPU=1` makes that fallback a hardware-evidence failure.
Evidence JSON/PNG files are written only when `UPLIFT_BACKEND_EVIDENCE` is set;
generic CI does not overwrite the committed hardware record.

## Observed book behavior

- Forced WebGPU: 256² cells at 5 m, 1280 m domain, real WebGPU rendering and live
  accepted steps. The captured canvas is 568×349 pixels, all opaque, with RGB
  channel range of 214. `book-webgpu256.json` records the same simulation/view
  step. Its full-page PNG was visually inspected: the raised ink terrain and the
  book controls render, with the recorded comparison kept separate.
- Forced CPU Worker: 128² at 10 m with a WebGL2 view. Forced CPU64: 64² at 20 m
  with a WebGL2 view. Every tier binds the quarter-domain scale bar to 320 m.
- Forced flat: genuine step-zero 64² drawing, disabled live sliders/playback/tools,
  working prediction, recorded result/replay/pause and explanation. Reset and
  reading-level changes retain truthful science status and no pending stamp.
- Default failure chain: unavailable GPU reaches a CPU rendering tier; unavailable
  GPU plus Worker reaches CPU64; unavailable GPU plus graphics contexts reaches
  flat. Both absent `navigator.gpu` and a null adapter are tested with no WebGL.
  They produce no uncaught page error after the compute factory repair.
- Reading-level toggles preserve live state hash/step and recorded values/timeline.
  Reset restores the initial hash, selected grid/domain and recorded prediction
  gate. Admission measurements do not leak evolved state into the initial page.

`forced-*.json/png` and `failure-*.json/png` preserve the observed selected tier,
bound scale, errors/fallback reasons and page drawing. `automatic-webgpu.json/png`
records the unforced hardware choice. `environment.json` records the OS-reported
Intel Arc 140V driver and Core Ultra CPU; adapter information alone does not expose
the driver version.

## Limits and handover

This is headless development-machine integration evidence, with uncontrolled
power/thermal conditions. It does not close visible classroom frame rate, human
accessibility, expert science approval or projector gates. A captured debug page
fps sample is not a controlled end-to-end performance benchmark.

GPU `configure` currently rebuilds managed core/resources while preserving model
state. Shader compilation, configuration readback and classroom slider-drag
responsiveness are **not** covered by the ms/step benchmark and require a 5A
measurement. No responsiveness optimization is claimed or made without evidence.

Solver review fixes are separate commits: fixed dt after accepted/enqueued steps,
ToolOp capture before async work, truthful rejection/reset step counts, and a
compute-only managed Three backend that cannot fall back to WebGL. Book/helper/CI
mounting glue is coordinated by the lead; this evidence change owns only the new
backend test and this directory.

## First-run fixture observation

One initial generic 15-case run passed all eight new backend cases and six of the
seven original cases, but the original unscored science fixture's prediction gate
remained disabled past its existing readiness timeout. The cause was not retained
in that run's overwritten trace and is unconfirmed. No timeout was increased and
no book/helper/fixture code was changed to accommodate it.

An isolated Vite `--force` first-page diagnostic then reached the real CPU Worker
fixture's enabled prediction gate in 951 ms with no page, console or request error;
its Worker URL, selected128² backend, step-zero hash and empty failures are saved
in `science-cold-diagnostic.json`. The original science case subsequently passed
in 6.2 s. Dependency-optimizer/load timing is only an inference, not a diagnosis.
The final full-suite result is reported separately; this note preserves the first
observation without claiming a fix that was not demonstrated.

## Final verification

- Installed Chrome hardware: eight forced-tier/failure cases passed, followed by
  the added unforced automatic-selection case (passed, selected WebGPU256).
- Fresh complete generic Chromium run: **16 passed**, retries **zero**, duration
  4.3 minutes. This includes the original unscored science case and all original
  recorded-comparison/smoke/size cases.
- Root TypeScript and e2e TypeScript checks passed; the new test passed ESLint.
  GPU lifecycle/fallback changes additionally passed 68 real GPU comparisons and
  three availability unit tests in their separate implementation commits.
- The lead's book/helper/CI glue was not changed or included in this evidence
  commit. Production preview rebuilt the integrated app for browser checks;
  final overall check/build/bundle verification remains coordinated by the lead.
