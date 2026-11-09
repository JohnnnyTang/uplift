# S1 · W4 · 4E: End-to-end tests, CI and debug overlay

The production book now has Chromium coverage for its prediction gate, generated
flat diagram, rendered lift, scope labels and reading-level state preservation.
The exhaustive recorded comparison and unscored-science regressions guard the
supported teaching claim and the pending historical claims. `?debug` supplies
measured runtime diagnostics; CI enforces a strict uncompressed bundle budget.

## Checklist

- [x] Owned paths respected, with minimal book wiring/public export and root
      dependency/script glue explained in DECISIONS.md.
- [x] `pnpm check` passes locally (46 test files, 434 unit tests).
- [x] Simulation stays process-based; no solver or landform changes.
- [x] Page diagnostics read the host sample, timing counters and view backend.
- [x] CPU/GPU comparison update is inapplicable: neither solver changed.
- [x] No new scientific explanation; supported wording and evidence remain intact.
- [x] Decisions and open follow-ups appended to DECISIONS.md.
- [x] `pnpm test:e2e` passes: seven Chromium cases, including both viewport sizes.
- [x] Production build succeeds; `pnpm check:bundle` reports 2,333,779 bytes,
      below 10,000,000 bytes (all generated files, uncompressed).
- [ ] Remote GitHub Actions run: requires branch publication by the integrator.

## Handover

Done: test runner, strict preview/server lifecycle, exact all-seed/sample replay
checks, stable shared axes, endpoint feedback, keyboard controls, reset, live and
recorded state preservation, hidden-years/pending-no-stamp fixture, opt-in debug,
CI Chromium and failure evidence, bundle accounting and boundary tests. A missing
null-answer guard in book feedback is fixed. Pinned axe-core is ready for 4D.

Not done: remote CI execution, WebGPU/performance measurements, human listening,
expert approval or enabling a challenge. No push, PR or merge was performed.

Surprises: testing a generic null-answer spread exposed scored wording in the
book although the prediction widget itself correctly stayed unscored. The mobile
exhaustive test needs more than a short smoke timeout; it receives two minutes,
with one worker and no retries hiding failures.

Plan facts: 4A must replace the current CPU-worker debug identifier with its
selected backend and adjust grid/backend-specific assertions. The overlay's page
fps must not be cited as the target hardware acceptance measurement. Anonymous
instrumentation belongs to the separate authorized 4F session.
