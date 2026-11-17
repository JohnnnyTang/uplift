# Stage 1 retrospective · the two-lesson book

**6D, 2026-11-16.** Based on merged 6B (`d1fdae5`, [PR #53](https://github.com/JohnnnyTang/uplift/pull/53))
and reconciled 6C (`83f0ba6`, [PR #54](https://github.com/JohnnnyTang/uplift/pull/54)). This records the
implemented book and its evidence; **the Stage 1 release gate remains open**. The owner requested that
human checks remain pending with assigned roles and that Stage 2 planning wait. This retrospective
neither selects another lesson nor supplies a Stage 2 plan.

The [acceptance ledger](stage-1-acceptance.md) remains the criterion-by-criterion status source.
The [6C review packet](../review/book-revision/release/README.md) connects the actual book journey,
claims, sources, teacher guide and outstanding decisions. No new reader, expert or hardware observation
was collected for this retrospective.

## What the book now demonstrates

_From V to U_ lets readers choose a rock, play a separate glacier run, inspect earlier states and compare
kept runs at matched model time. _Where plates meet_ supplies the second discovery: choose a boundary,
play or scrub its illustrated stage, compare viewed boundaries, then return to the retained glacier run.
Both have immediate answer reveals and optional reading depth. The research example remains separately
labelled. The [two-lesson recording](../review/plates/acceptance/captures/journey-turn-transform.webm)
and [teacher journey](../review/book-revision/release/teacher-journey.md) show this scope.

These are demonstrated interactions, not evidence that first-time readers discover the controls,
interpret the comparisons correctly or learn more. Those observations remain H4 below.

## Actual visual and accessibility findings

| Observed finding                                                                                                        | Resolution and remaining boundary                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The glacial book was small at default laptop framing; the block overlapped its running head                             | Owner accepted O1/O2 in D-W5-5N2. Preserve that decision; it is not a classroom legibility test.                                                                                  |
| Plate ghost labels covered the front face and could clip; transform relief needed a higher default view                 | 7G moved labels beneath the face with leaders and tipped the block 12 degrees while retaining the book tilt. Owner approved both.                                                 |
| Lesson 2 changed the fitted book size at the 1440 × 900 turn                                                            | Owner accepted F1 as is. F2, recognising the landforms at ordinary laptop size, remains pending.                                                                                  |
| Open answer content could run off the desk; plates inherited an unused text column                                      | 7G bounded the open-flap column and removed the empty column. Phone/reflow behavior has separate checks.                                                                          |
| Initial lesson scans missed nested main landmarks and an overflowing university equation inaccessible to keyboard users | 6B kept one app main landmark and made the shared formula widget focusable. Regression tests reach and scroll the equation, then restore focus on Escape.                         |
| Default glacier startup fallback lost its comparison when readers returned                                              | 6B retained recorded sources across turns, paused hidden playback and restored play intent. New default-route failure tests cover recorded, preview-only and drawing-only states. |
| Review fixtures and old instructions did not fully describe the current book                                            | 6B fixed fixture port overrides and expanded actual-route coverage. 6C corrected the README and research teacher instructions for optional prediction and immediate reveal.       |

Sources: [glacier owner packet](../review/glacial/acceptance/owner-scene-review.md),
[7G ledger](../review/plates/acceptance/README.md), [6B findings](../review/book-revision/accessibility/README.md)
and the final owner-review addition to D-W7-7G in [DECISIONS.md](../../DECISIONS.md).
Older packets retain their historical wording; that final decision supersedes only its explicit scope.

## Scientific boundaries stayed intact

<!-- expert-review -->

This is a summary of the existing [6C claim/evidence register](../review/book-revision/release/README.md#claims-sources-evidence-and-draft-scope),
not new scientific approval. The glacier remains an uncalibrated process model. The
[5N production rerun](../science/validation/glacial-valley/README.md) reproduced 18/18 arms bitwise and
39/39 registered verdicts unchanged: **16 pass, 23 fail**. Reproducibility does not make those failed
morphology criteria pass. Complete-U, floor-width ordering and early matched-time wall claims remain
outside the supported teaching scope; the [expert packet](../review/glacial/acceptance/expert-review.md)
retains the qualifications on the claims actually taught.

Plate relief is authored under the lesson-specific D-L2-1 exception. It is labelled an illustration,
uses early-to-late stages, and does not claim a simulation or model years. The
[plate expert packet](../review/plates/acceptance/expert-review.md) still awaits specialist review.
The [research rain comparison](../science/validation/rain-comparison/README.md) teaches its supported
gross-erosion comparison; gross erosion is not net incision or catchment export. Failed morphology and
the unvalidated waterfall remain recorded. Neither another lesson nor this retro changes their status.

## Performance: useful measurements with bounded scope

The [6A/6A2 measurements](../perf/README.md) and [7F two-lesson check](../perf/plates/README.md) used the
ASUS Zenbook S 14, Core Ultra 7 258V, Intel Arc 140V, driver 32.0.101.8860, visible Chrome 157.0.8103.78,
AC power and production builds. They are historical measurements at the commits recorded in those
packets, not new benchmarks of the 6B/6C merge or a device-support matrix.

| Finding                                                           | Measured result and interpretation                                                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smaller CPU batches bounded the wait immediately after Pause      | 6A2 scrub p90 fell from 344 to 67 ms, maximum 96 ms; pause-to-final-frame p90 fell from 370 to 75 ms. The original miss remains historical.                                                                                 |
| Responsiveness had a throughput cost                              | Paired CPU A/B at 1× measured median 3.76 versus 3.99 model years/s, about 6% lower, with three pairs. Main-thread busy time increased from 10% to 17–20%; 1× frames remained below 50 ms. WebGPU scheduling was unchanged. |
| Some narrow latency targets remain unmet in the recorded 6A scope | Initial GPU rock-choice p90 was 204 ms against 200; GPU research return p90 was 1,051 ms against 1,000. They were not reworked in 6A2.                                                                                      |
| Lesson 2 appears promptly, with an authored first entrance        | 7F first-turn medians: drawing 456 ms, stage ready 737 ms, usable after transition 3,389 ms. Lesson-2 playback was 101 fps; gesture p90 values were about 44–108 ms for the measured choices/scrubs.                        |
| Returning preserved the glacier while the other lesson was open   | 7F retained the same run and resumed play on 20/20 returns. Its measured return includes resumed playback; it is not hidden advance during the other lesson.                                                                |
| Coverage remains limited                                          | CPU glacier performance across page turns, two-lesson cold network loads and other hardware remain unmeasured in 7F. Perceived startup hitches and model-update cadence still need people.                                  |

6B's final production bundle was **6,773,706 bytes** against the 10,000,000-byte budget. A browser or
unit timeout while test workloads overlap is not a user-facing performance measurement; 6B recorded
that distinction and reran the unchanged check without contention.

## Reuse proved inside the working lessons

| Capability                                                      | Actual public entry point and production use                                                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tilted book stage, diorama, book binding and landscape snapshot | [`@hachure/ink/stage`](../../hachure/ink/src/stage/index.ts): `createBookStage`, `createValleyDiorama`, `createBookBinding`, `LandscapeSnapshot`; consumed by both production scenes.     |
| Drawing-to-scene entrance                                       | [`@hachure/ink/transition`](../../hachure/ink/src/transition/index.ts): `runTransition`; both scenes keep this presentation effect separate from their source state.                      |
| Front-face lens and cut gesture                                 | [`@hachure/ink/glacial`](../../hachure/ink/src/glacial/index.ts): `sectionLensSvg`, `attachCutDrag`; reused by plates as well as the glacier.                                             |
| Bound text, equations and reader lifecycle contracts            | [`@hachure/runtime`](../../hachure/runtime/src/index.ts): `BindingEngine`, `createDisplayFormula` and reader contracts; both lessons share these guarantees.                              |
| Live glacier runs and matched-time comparison                   | [`@hachure/runtime/glacial`](../../hachure/runtime/src/glacial-host/index.ts): `GlacialHost` and driver; demonstrated in lesson 1.                                                        |
| Authored stage playback and ghosts                              | `createAuthoredSequence` / `driveSequence` from `@hachure/runtime`, consumed by [`plates/sequence.ts`](../../uplift/book/src/scenes/plates/sequence.ts); demonstrated in lesson 2.        |
| Crust fields and on-block direction gestures                    | Optional snapshot/crust additions in `@hachure/ink/stage` and [`@hachure/ink/plates`](../../hachure/ink/src/plates/index.ts); demonstrated in lesson 2 and recorded in D-W7-7B/7B2/7D/7G. |

Both scenes also reuse Uplift's [reading panel](../../uplift/book/src/scenes/glacial/reading-panel.ts)
and [view controls](../../uplift/book/src/scenes/glacial/view-controls.ts). Those are shared book code,
not extracted Hachure primitives. The glacier host and authored-sequence source have each proved their
own lesson; their public APIs alone do not establish reuse by multiple lessons. No new abstraction,
engine family or extraction was implemented by 6D.

## Verification and what it cannot establish

The [6B audit record](../review/book-revision/accessibility/README.md#verification-record) distinguishes
its local full browser run (109 passed, four hardware-only skips) before the fallback patch from the
rebuilt affected-suite run (19/19) afterward. Local `pnpm check` passed 886 unit tests with seven skips.
The final 16-state axe scan found no violations at any severity; 14 lesson scans still contain
incomplete contrast checks. These require actual examination, not an inferred pass or failure.

Fresh [6C browser CI](https://github.com/JohnnnyTang/uplift/actions/runs/43873739729/job/133321285991)
passed 116 tests with one skip; all four CI jobs were green before merge. Its setup and skip
scope differ from the local audit. Neither result closes human listening, classroom performance,
first-time-reader understanding or expert sign-off. The existing rain-only opt-in instrumentation was
not broadened, and completion is not a learning-gain measure.

## Open work and accountable roles

All rows below remain pending. [H1–H8 procedures](../review/book-revision/accessibility/human-checks.md)
and [6C review records](../review/book-revision/release/review-records.md) specify the tasks and result
fields. Roles arrange the work; no named participant has accepted or completed an assignment here.

| Item                                                                             | Accountable role                                            | Evidence that closes the item                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 · Screen-reader listening across lessons, panels, controls and turns          | Accessibility reviewer, coordinated by 6B QA                | Tester/date/commit, actual OS/browser/AT setup, heard announcements and focus behavior, defects and retest.                                                                           |
| H2 · Real 200% browser zoom and legibility                                       | Accessibility and classroom reviewers, coordinated by 6B QA | Browser UI zoom setting and physical display, both levels/panels, reachable controls and actual readability; viewport emulation alone is insufficient.                                |
| H3 · Colour, incomplete contrast checks and projector/classroom reading          | Classroom and accessibility reviewers, coordinated by 6B QA | Exact unresolved nodes, foreground/background measurements where possible, projector/room/distance and observed non-colour cue use.                                                   |
| H4 · First-time discovery, comparison interpretation and willingness to continue | Product researcher with 6C lead                             | Uncoached observations, exact assistance and limitations under the review protocol; no inferred learning gains.                                                                       |
| H5 · F2 laptop recognisability                                                   | Product owner with 6C lead                                  | Explicit judgement at ordinary 1366 × 768 and 1440 × 900 views, and any required adjustment/retest. Existing label/tip/F1 approvals stay approved.                                    |
| H6 · Glacier scientific claims and qualifications                                | SCI lead coordinating geomorphologist/glaciologist          | Reviewed commit and claim IDs, answers to the eight expert questions, approved scope or required revisions.                                                                           |
| H7 · Plate scientific wording and illustrated scope                              | SCI lead coordinating geologist/geophysicist                | Reviewed commit and PC/PD/NT IDs, seven expert answers, source-access follow-up and approval or revisions.                                                                            |
| H8 · Wider devices and remaining performance scope                               | Performance QA with project lead                            | Actual GPU/browser/mobile/classroom setups, driver/power/commit, repeated CPU-turn/cold-load measurements and recorded usability; disposition of narrow misses and perceived hitches. |
| Research claim/limits review                                                     | SCI lead coordinating geomorphology/hydrology reviewer      | Sign-off scoped to supported gross erosion, with failed morphology and the unvalidated waterfall preserved.                                                                           |
| Publication and Stage 1 release                                                  | Project lead with product owner and SCI/QA leads            | Linked decisions satisfying the acceptance ledger and reviewed publication scope; merging 6B/6C/6D is insufficient.                                                                   |

## What the work taught us

Actual-route failures and optional reading surfaces exposed defects that successful fixtures and
opening-spread scans did not. Accessibility verification needs the same depth, fallback and return
journey that readers can use. Full-severity scans and keyboard action supplied complementary evidence.

Review status also drifted independently of code: the implemented two-lesson book still had one-lesson
instructions and superseded pending-owner text. A review packet must name its exact baseline, preserve
old results, and apply later decisions only to their stated scope. Evidence preparation is useful even
when human review is deliberately pending, provided those distinctions remain visible.

## 6D handover

Done: retrospective of merged 6B/6C, scoped findings and performance, proved reuse, and reconciliation
of pending roles. Not done: human/expert/hardware checks or publication approval. Stage 2 planning is
explicitly deferred; no new lesson is selected. This record changes no scientific outcome.

> PL9: "Reuse: no heavy spread code; lesson 1 and engine behaviour unchanged; new primitives recorded in `DECISIONS.md`."

> GV6: "Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as non-colour cue, reflow."

Sources for those rows: [Wave 7](stage-1-wave-7-plates.md#5--acceptance-rows) and
[glacial Wave 5](stage-1-wave-5-glacial.md#6--acceptance-rows).
