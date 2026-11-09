# Stage 1 · Wave 3 implementation and evidence

Run started 2026-11-08 local time; implementation handover 2026-11-09.

**Wave 3 closure (2026-11-09):** the implementation, diagnostic follow-up and
visible educational comparison are complete under the owner's education-first
policy. The new question teaches supported cumulative gross erosion; it does not
claim a deeper valley or a waterfall. Stage 1 expert and human review remain open.

## Closure evidence

[PR #20](https://github.com/JohnnnyTang/uplift/pull/20), merged at `0a64e40`,
preserves all original failures, diagnoses their causes and records the
owner's revised priorities. Session 3F supplies the previously missing
[visible comparison and matching lesson](../science/validation/rain-comparison/README.md):
all recorded seeds on one scale, bound counters, prediction-specific feedback,
keyboard replay/scrubbing, reduced motion and preserved state across levels.
The presentation protocol was frozen before extraction and visual inspection.

The final implementation passes `pnpm check` (434 tests), production build, the comparison
browser suite and the existing CPU lift/tool integration smoke. The evidence
includes six viewport/seed screenshots and normal-speed playback. GPU equations
are unchanged; the existing water comparison remains part of CI.

**Handover:** Wave 4 can proceed after merge and green main. Geological calibration
remains unapproved, the old deeper/wider answer remains null in historical status,
and the slope-break challenge remains non-executable. Expert scientific review,
human screen-reader listening, classroom feedback and target-hardware performance
are Stage 1 release work, not claimed complete here.

The sections below preserve the original implementation handover and why it did
not close the wave. Historical “open/blocked” statements describe that point in
time; this closure and the linked education policy supersede them for current work.

## Gates and ordering

Wave 2 was closed at main `0d44efa`. The kickoff checked GitHub open PRs, remote
main and existing worktrees; no concurrent Wave 3 work existed. Existing Wave 1
worktrees and user changes were preserved. Every new session used its own sibling
worktree and `s1/w3/<session>-<slug>` branch.

The lead implemented and merged the hydraulic prerequisite before starting 3B/3C
or permitting 3A solver edits. Independent content, tools and host work ran in
parallel. Session merge order remains **3D → 3B → 3E → 3A → 3C**.

## Evidence inventory

| Session                | PR / state                                                                                          | Evidence                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hydraulic prerequisite | [#13](https://github.com/JohnnnyTang/uplift/pull/13), merged                                        | 360 tests, build and GitHub CI; dimensional derivation and fixed-duration refinement in [hydraulic resistance](../science/hydraulic-resistance.md)   |
| 3D content             | [#14](https://github.com/JohnnnyTang/uplift/pull/14), merged                                        | 366 tests after rebase, build and CI; bound draft text, null prediction answer pending evidence                                                      |
| 3B validation          | [#17](https://github.com/JohnnnyTang/uplift/pull/17), infrastructure/evidence merged; science unmet | 378 engineering tests, build and CI; eighteen runs, failed AC3/T6/calibration packet and exact reach diagnostics                                     |
| 3E tools               | [#15](https://github.com/JohnnnyTang/uplift/pull/15), merged                                        | 386 tests after science rebase, build, browser keyboard smoke and CI                                                                                 |
| 3A integration         | [#18](https://github.com/JohnnnyTang/uplift/pull/18), merged                                        | 407 tests, build and CI; Worker host, real CPU preset/tools, float64 metric, atomic bindings and recorded guided flow                                |
| 3C water GPU           | [#16](https://github.com/JohnnnyTang/uplift/pull/16), merged last                                   | 410 unit tests, build, 29 Intel browser tests and 29 SwiftShader CI tests; real128² preset comparison, guarded commits and split-elevation precision |

## Unchanged scientific gates

**Later owner clarification (2026-11-09):** the archived findings below retain
their original interpretation. Future release decisions follow
[education-first acceptance](../science/education-policy.md): visible causality
and reliable relative effects take priority over field-scale magnitudes; calibration
is required only for real-world time/rate claims. The registered diagnostic reruns
continue unchanged. Wave 3 remains open for a validated, visually legible lesson,
not merely for satisfying the historical absolute thresholds.

No expert approval is implied by passing engineering tests. Roughness and the
virtual-pipe adaptation remain expert-review drafts. Landscape years stay hidden
until calibration approval metadata exists. A failed or inconclusive prediction
experiment must remain unscored. Full-reach claims require complete paths; reset
and calibration baselines must be identified separately.

Wave 4 may start only after Wave 3's documented exit criteria are met. The stage
still requires domain-expert sign-off and target-hardware/human accessibility
review; neither can be substituted by CI.

## Scientific findings and merge interpretation

<!-- expert-review -->

The preregistered 3B rain experiments fail AC3a for seeds 1, 17 and 101: the
wet-minus-dry fixed-section incision is negative, rather than meeting the positive
minimum margin. Uniform calibration arms also lack positive median incision.
All eighteen preregistered arms completed without guard or mass-budget failure.
The [validation packet](../science/validation/README.md) contains exact configs,
per-seed measurements, source fingerprints and plots. Final outcomes:

- AC3a fails: wet-minus-dry incision is about −0.00049 to −0.00072 m; the minimum margin is +0.1 m.
- AC3b fails: uniform and hard-band widths are identical, with no qualifying knickpoint candidates; calibrated persistence is unapproved.
- AC3c fails its magnitude criterion: flatter-reach deposition exceeds steep-reach deposition by about 21.6 m³, below the required 64 m³. Both arms deliver sediment and close the exact reach budget.
- T6 is inconclusive on every seed; the answer remains null.
- Calibration fails: all fifteen measured sections have nonpositive incision after spin-up; no geological-time factor is installed.

Measurements are retained every two hundred steps; complete profile/section CSVs
are retained at the initial, spin-up and final samples. Full terrain snapshots are
not archived. The packet explicitly discloses this retention deviation.

Publishing tested measurement infrastructure and its failed evidence is not a pass
for session 3B's scientific exit criteria. Integration may consume those public
metrics from main, but must remain an explicitly unscored, uncalibrated draft.
The original thresholds remain unchanged. **Wave 3 stays open and Wave 4 is blocked.**
A scientific follow-up must explain the measured behaviour and review any revised
model, experiment horizon or question before rerunning every affected arm and seed.
No failing seed may be dropped, no successful run substituted, and no threshold
relaxed merely to obtain a passing gate.

## Facts for later sessions

- A Worker must import the Worker-safe runtime entry, not a DOM/style-loading barrel.
- The public GPU API is water-only and refuses configurations enabling omitted
  physics. Full GPU erosion, transport, slumping, evaporation and budgets remain 4A.
- Preserve the GPU's resident guard-before-commit and same-version atomic readback;
  use the same snapshot for terrain and contours.
- A pending challenge cannot award a stamp. The recorded hard-band experiment does
  not supply a validated successful tool sequence for 4C.
- Headless development timings are component measurements, not AC1 classroom or
  full-solver frame-rate evidence. Target hardware and human accessibility remain open.

## Integration recording and timing limits

The [CPU browser evidence](../../uplift/book/src/app/evidence/README.md) links the
recorded predict → lift → run → flap flow, keyboard/pointer brush assertions,
reset, level-state preservation and reduced motion. The recording is a working
research-draft investigation, not a scientifically accepted lesson.

The final loaded-machine sample includes an eight-step Worker batch of 266.7 ms,
snapshot/probes of 25.7 ms, transfer/scheduling of 5.6 ms and view extraction of
32.6 ms. These are individual samples, not warmed steady-state throughput. They
must not be compared as a full-solver performance claim with 3C's isolated water
stage. Keep bounded publication and separate visual animation; measure again under
recorded target-hardware conditions in the performance sessions.

## Final implementation verification

The final integrated code passed `pnpm check` (410 tests), production build and
both GitHub CI jobs. The water suite ran all twenty-nine tests locally on Intel
Arc 140V / Chrome 156 and in CI on SwiftShader / Chrome 158; CI did not skip for
missing capability. The real 128² plateau with its declared spring agrees after
eighty water-only steps within the unchanged field tolerances. Full GPU erosion
and sediment-process parity remain 4A, not a claim of this water-stage comparison.

The separate scientific command
`node hachure/terrain/src/validation/assess.mjs --require-pass` exits with failure.
That is the preserved wave gate, not a failed implementation test being hidden.
Review the evidence, diagnose the process/experiment mismatch, preregister any
scientifically justified revision and rerun all affected arms/seeds before closure.
Approval alone cannot substitute for passing the applicable criteria.

## Registered follow-up and revised science priority

[The completed follow-up](../science/validation/followup/README.md) replays all
eighteen originals exactly and runs eighteen preregistered revised arms. Cover
shielded the original hardness intervention. Exposed rock shows a small resistance
effect without the intended slope break/narrowing; the revised transport setup
shows more deposit in the flatter reach, while rain still does not deepen the
measured minima. All engineering guards and budgets pass.

The owner now prioritizes visible relationships and relative outcomes over
quantitative field accuracy. Apply [education-policy.md](../science/education-policy.md):
retain the old scores as diagnostics, make calibration optional when no real-world
years/rates are claimed, and prioritize a clearly visible, correctly explained
paired interaction. The current prediction remains unscored. No visual/lesson gate
is claimed to pass from numerical diagnostics alone.
