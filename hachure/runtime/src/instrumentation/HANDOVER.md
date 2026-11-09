# S1 · W4 · 4F: Anonymous local classroom observations

Demo 1 now offers an optional classroom log that starts off, retains only a bounded
memory tail and downloads anonymous JSON only when the reader requests it. The
strict v1 schema separates recorded-comparison actions from live controls and
never claims completion or changed answers prove learning gains.

## Checklist

- [x] Owned instrumentation paths, with coordinated minimal public export, replay
      observer, book hooks and browser-test glue explained in DECISIONS.md.
- [x] `pnpm check` passes locally: 47 files, 443 tests.
- [x] Process model, solver equations, scientific outcomes and prediction gates unchanged.
- [x] Numeric event context comes from the atomic host sample or recorded data;
      snapshots are cloned and solver backend is an enum, with no device identity.
- [x] No solver changes; CPU/GPU comparison changes are inapplicable.
- [x] Optional question repeats the validated gross-erosion question with an
      expert-review/source comment. No new field-rate or learning-gain claim.
- [x] Append-only decision and integration guidance recorded.
- [x] Chromium opt-out, keyboard opt-in/export, stop/clear, state preservation,
      optional answers and observer-failure tests pass.
- [x] Full combined `pnpm test:e2e` suite passes: 10 Chromium cases.
- [x] Production build and strict bundle budget pass: 2,341,746 bytes.
- [ ] Remote CI execution follows branch publication by the integrator.

## Handover

Done: off-by-default collector, strict action/context validation, cloned numeric
config and distinct live/recorded seeds/model steps, solver-backend enum, sequence
order, bounded tail/omission count, clear/stop semantics, accessible local download
and failure containment. Events cover committed prediction, replay actions and
endpoint transitions, flap, pending challenge, reading level, live controls,
brush settings and applications, reset, and optional before/after answers.

Not done: a universal analytics schema, persistence, server collection or an
assessment of learning gains. These were excluded deliberately by the brief.
Remote CI and the existing expert/human/hardware gates are not claimed closed.
No push, PR or merge was performed.

Surprises: reset first publishes a zero-step sample using the current rain, then
publishes its default-rain configuration. The browser test waits for that existing
transaction to finish before checking hash preservation. Logging did not change
reset behavior. Both model state and recorded replay remain unchanged when the
reader starts/stops/clears/downloads the log.

Plan facts/integration: v1 is explicitly Demo 1/rain-comparison scoped. Successful
challenge events remain impossible in this schema. Feed 4A's selectedBackend enum
into live.backend and preserve its debug wiring. After successful 4B university
configure calls, record the accepted capacityCoefficient/erosionRatePerS/
depositionRatePerS action; record restore-defaults after hidden-default restoration.
See README.md for the exact hook contract. Keep 4D's motion/focus fixes while
merging the book's small action hooks. The separately identifiable implementation
commit is based on the 4E harness and can be cherry-picked after other sessions.
