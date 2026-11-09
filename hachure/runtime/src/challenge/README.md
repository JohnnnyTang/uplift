# S1 · W4 · 4C: Evidence-gated challenge infrastructure

The runtime evaluates pending, threshold and composite checks from completed
simulation observations. Persistence uses scheduled model steps and an explicitly
approved clock when the schema requests geological years. Missing observations,
invalid probes, inconsistent clocks and new runs reset persistence. A pending
branch prevents awards even inside an `any` check.

The separate `ModelStepSlopeBreakTracker` supports prospective uncalibrated
model-step protocols. It does not approve a lesson or stamp. All six real arms in
[the registered experiment](../../../../docs/science/validation/challenge/README.md)
completed with numerical health, but none produced a qualifying candidate. The
actual book challenge therefore remains pending. The session's scientific success
exit criterion is **not met**; software fixtures do not change that result.

`createChallengeWidget` requires a committed answer and revealed explanation before
a new award. Progress is versioned, definition-specific and local, with storage
access failures handled in memory. A pending definition suppresses prior records.
The book's flap names the learner's own committed choice at either reading level.
An explicit experiment reset clears the current attempt but retains prior earned
progress; level changes never configure or reset the simulation.

## Verification

- `pnpm install`, `pnpm check`, `pnpm build`.
- Unit tests cover threshold/composite logic, pending branches, calibration, gaps,
  duplicate frames, run resets, synthetic detector/persistence cases, binary harden
  footprint and corrupt/blocked storage. Synthetic cases are software tests only.
- Start `pnpm dev --host 127.0.0.1 --port 5187` then run
  `node hachure/runtime/src/challenge/smoke.mjs` from the repository root.
- Browser smoke checks a clearly labelled engineering fixture's keyboard guided
  loop, stamp, reload, level change and denied-storage behavior. The separate real
  book check confirms committed-answer flaps, pending/no-stamp state, unchanged
  hashes, reset and hidden geological years. Results/screenshots: `evidence/`.
- `node docs/science/validation/challenge/assess.mjs` verifies every retained arm's
  schedule/source hashes and returns nonzero for the failed science gate.

## PR checklist

- [x] Owned runtime challenge paths; minimal public export/book glue and approved
      prospective validation documentation exceptions explained here.
- [x] `pnpm check` passes locally.
- [x] No scripted landform or solver change.
- [x] Displayed model step/stamp values bind to observed or saved progress.
- [x] CPU/GPU solvers unchanged; no comparison change required.
- [x] New scientific protocol/report uses `<!-- expert-review -->` and sources.
- [x] Decisions/open gate appended to `DECISIONS.md`.

## Handover

Done: generic evaluator, model-step tracker, safe local progress, stamp UI, guided-loop
context, focused tests, browser evidence and a complete prospectively registered
six-arm experiment. Not done: successful slope-break sequence, real-book stamp,
renderer-legibility evidence for that absent outcome, expert/human sign-off.

Surprise: even exposed rock with the stronger admissible capacity/rain settings
produced no detector candidate. Numerical health cannot close the morphology gate.
The plan should carry that failed challenge gate explicitly, rather than counting
the software fixture as the session's scientific exit. A future enabled persistence
check needs a fixed-step host observation schedule; ordinary view readback can skip
registered observation intervals and must fail closed.

Preserve preregistration commit `931285ecafa6d0592f2106e5c1158d6a919ccb9d` in
reachable ancestry. The lead will merge main into this branch and preserve merge
history in a **draft PR**. Rebase/cherry-pick would rewrite the immutable registration
anchor, so this is an agreed exception to the routine session rebase rule. Keep
the real challenge gate failed/pending in the PR description.
