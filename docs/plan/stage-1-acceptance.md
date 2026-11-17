# Stage 1 integrated acceptance ledger

**6G presentation update (2026-11-17):** the larger fitted book and study desk await owner review; see [desk evidence](../review/book-revision/desk-refinement/README.md) and D-W6-6G. Baseline release approval is retained.

**6H presentation update:** the slower drawing → sketch → lift entrance awaits owner review. See [the evidence packet](../review/book-revision/uplift-transition/README.md) and D-W6-6H. Existing scientific and hardware review statuses remain in force.

## Owner update · Stage 1 release · 2026-11-16

The owner reported that **expert review is done by the project team** and directed that
the group review of the working book be recorded as met, and that Stage 1 be published
and released. H6 (glacier), H7 (plates) and the retained research review are
**passed (owner-reported, team review)**. Reviewer names, reviewed commit, claim-level
answers and requested edits were not supplied and are not invented here. With H1–H5
already passed (D-W6-6E), the Stage 1 exit gate is met and **Stage 1 is released**.
H8's measured multi-device matrix and the narrow 6A latency misses stay recorded as
known limitations, not release blockers. Publication is by GitHub Pages. Stage 2
planning still needs its own owner direction. See D-W6-6F in [DECISIONS](../../DECISIONS.md).

Records below this block describe earlier states and keep their original wording.

## Owner update · 2026-11-16

The owner reported **"all passed for human checks"** on the production review at
`83f0ba6`. H1–H5, including F2, are **passed (owner-reported)**. The general pass also
covers human device-usability feedback; it does not supply H8's measured hardware
matrix. Exact setups, tester details and raw observations were not supplied.
Scientific specialist sign-offs H6/H7 and the retained research review remain
separate and pending; no publication or Stage 2 authorization is inferred.
See D-W6-6E in [DECISIONS](../../DECISIONS.md).

6D #55 is merged. The requested 1.5× opening-valley refinement follows this review;
the baseline pass is not a claim of human retesting after that change. Earlier
pending-human records below describe the audit before this owner report.

## Recorded audit · 6B · 2026-11-16

Baseline: merged main `cd856bcbf459c88f6e08cf4308d8c80bfb160a0a` (7G), with the bounded 6B accessibility fixes.
The default book contains **From V to U** and **Where plates meet**; the erosion research route is separate.
[6B audit, findings and reproducible evidence](../review/book-revision/accessibility/README.md).
**Publication/release remains open.** At the owner's direction, human checks remain pending with assigned
roles in the [human-check register](../review/book-revision/accessibility/human-checks.md). Stage 2 planning
waits until current work is complete. The historical sections below do not override this current scope.

D-W7-7G's final owner review (2026-11-16) **approved the ghost key, 12° block tip and F1's page-size change**.
Do not reopen those decisions. **F2 (recognisability at laptop size) remains pending.** The ledger separates
mechanical checks from human interpretation; a green browser suite cannot close the latter.

Verification: `pnpm check` passes (886 tests, 7 skipped); the full browser audit passed 109 with 4
hardware-only skips. After the final fallback fixes, 19 affected production tests passed on `11fecea`.
The 16-state axe scan has zero violations; its incomplete contrast results remain manual review.
See the audit packet for exact revision boundaries, setup, prior failures and skipped scope.

| Criterion                             | Automated / recorded evidence                                                                                       | Current disposition and remaining owner                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PB1 · Recognisable book               | `glacial-acceptance` and `plates-acceptance` viewport fits; 7G captures                                             | Mechanical checks; O1 and F1 owner-accepted. F2 / actual legibility pending owner and classroom reviewer (H2/H3/H5)                        |
| PB2 · Readable adaptation             | `book-acceptance`, `plates-acceptance`, expanded 390/320 px scans                                                   | Reflow checked; actual browser UI 200% zoom and reading pending accessibility reviewer (H2)                                                |
| PB3 · Drawing becomes space           | Both acceptance suites and [two-lesson recording](../review/plates/acceptance/captures/journey-turn-transform.webm) | Transition/reduced-motion mechanics checked; human spatial reading pending product researcher (H4)                                         |
| PB4 · Immediate play                  | Fresh-entry actions in both acceptance suites, no prediction/logging prerequisite                                   | Mechanical checks; uncoached discoverability pending product researcher (H4)                                                               |
| PB5 · One visible lesson              | Live glacier run/state checks, plates authored-shapes/text-alternative checks; linked expert packets                | Taught evidence retains its scope; expert decisions pending specialists (H6/H7)                                                            |
| PB6 · Pressure-free reflection        | Both suites reveal immediately with unanswered questions                                                            | Automated behavior checked; no score/endpoint gate introduced                                                                              |
| PB7 · Two working spreads             | `plates-book`, `plates-acceptance`, `book-shell`, new accessibility regressions                                     | Original two-lesson criterion applies; keyboard/turn/focus/return-state mechanics checked. Listening and gesture usability pending (H1/H4) |
| PB8 · Human review                    | Latest D-W7-7G decisions; assigned H1–H8 procedures, no new human observations                                      | Pending; approved owner sub-decisions do not close readers, science, listening or hardware                                                 |
| PB9 · Intervene and observe formation | `glacial-acceptance` separate rock runs, past inspection and matched-time comparison                                | Lesson 1 only. Lesson 2 intentionally has authored stages, no runs/model time (D-L2-1); PL1/PL2 cover its loop                             |

### Foundation, scientific and release obligations

| Check                              | Evidence / applicable interpretation                                                                                                                                       | Status and owner                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 · Performance                  | [6A/6A2](../perf/README.md), [7F two-lesson check](../perf/plates/README.md)                                                                                               | Recorded single-device evidence only. Other hardware, CPU glacier page-turn performance and two-lesson cold loads pending performance QA (H8); narrow historical GPU misses preserved |
| AC2 · Determinism                  | Unit suite and `glacial-runtime` CPU Worker/main replay; existing per-adapter GPU evidence                                                                                 | No solver change. Skipped hardware-only cases are not new passes; performance QA owns broader devices                                                                                 |
| AC3 · Historical morphology        | [Glacial validation](../science/validation/glacial-valley/README.md), [rain comparison](../science/validation/rain-comparison/README.md)                                   | Glacier 39 registered verdicts retain 16 pass / 23 fail; unsupported full-U/wider-floor claims not taught. Research waterfall unvalidated; no new release gate inferred               |
| AC4 · Mass / numerical checks      | Existing CPU/GPU numerical unit and browser comparison records                                                                                                             | No numerical changes; scientific expert review still pending H6/H7                                                                                                                    |
| AC5 · Drawing / scene entrance     | PB3 and PL6; owner artistic-transition clarification supersedes exact geometric mapping                                                                                    | Approved art scope; scientific evolution still model-driven in lesson 1, authored illustration only in lesson 2                                                                       |
| AC6 · Page/model agreement         | Spread bindings, cited-figure/claim register tests; acceptance page-state assertions                                                                                       | No independently typed model quantities introduced                                                                                                                                    |
| AC7 · Honest scope/time/limits     | Both acceptance suites and research `science` / `smoke` guards                                                                                                             | Glacier model time is uncalibrated; plates illustration early–late, no model time; research rates/waterfall limitations retained                                                      |
| AC8 · Two levels, one model        | `glacial-book`, `plates-book`, `university`, backend state-preservation tests                                                                                              | Level/panel changes preserve scientific state                                                                                                                                         |
| AC9 · Keyboard / motion / clamping | Existing input tests; new all-severity reading-panel axe and keyboard scroll regressions                                                                                   | Landmark and equation failures fixed. Listening, colour contrast incomplete nodes, projector legibility pending H1–H3                                                                 |
| AC10 · Teacher notes / sources     | [Glacier guide](../../uplift/spreads/geomorph.u-valley/teacher-notes.md), [plates guide](../../uplift/spreads/tectonics.plate-boundaries/teacher-notes.md), research guide | 6C consolidates current review/teacher packet; specialist decisions H6/H7 still pending                                                                                               |
| Supported fallback paths           | Backend chain tests, glacier runtime/scene cases, plates drawing-only case; 6B audit record                                                                                | Read actual backend/labels; recorded evidence and drawings never called a live solver or hardware pass                                                                                |
| Privacy / research truthfulness    | `instrumentation`, `comparison`, `science`, `smoke` suites                                                                                                                 | Collection remains off by default and rain-only; no learner outcomes inferred                                                                                                         |
| Release review / retro             | 6C packet preparation, later 6D retrospective                                                                                                                              | Expert/product decisions pending. No Stage 2 plan or new lesson authorized here                                                                                                       |

## Historical A–F baseline introduction · 2026-11-09

Reviewed on the local Wave 5 stack based on `d01f631` (5E integrated); at that time main remained at 5A.
This earlier contour/water evidence does not establish glacial or plates acceptance.
[Original packet](../review/book-revision/acceptance/README.md) and
[direction correction](../review/book-revision/current-direction-review.md).

## Historical two-lesson acceptance · 7G · 2026-11-15

Walked on the default app at `27f033c` (all of Wave 7 merged) plus 7G's fixes, on Windows 11 with an Intel Arc
140V; full ledger with evidence links: [docs/review/plates/acceptance](../review/plates/acceptance/README.md)
(D-W7-7G). The book has two lessons again, _From V to U_ and _Where plates meet_, so **PB7 is back in its
original form** (two working interactive spreads and a genuine page turn; D-L2-1 decision 6). Lesson 2 is an
authored illustration (D-L2-1): it has no runs or model time, so PB9 applies to lesson 1 and lesson 2's reader
loop is PL1–PL2. 6B → 6C → 6D take over every pending check.

| Row | Status                                                                                                    | Row | Status                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------- |
| PB1 | pass with note (book small at ≤ 1440, O1; size change at the turn, F1); fail → fixed (lesson 1 flap open) | PL1 | pass                                                                                        |
| PB2 | pass; human legibility and real browser zoom pending                                                      | PL2 | pass                                                                                        |
| PB3 | pass; human spatial reading pending                                                                       | PL3 | pass with note; owner judgement at laptop size pending (F2)                                 |
| PB4 | pass; first-time reader pending                                                                           | PL4 | pass                                                                                        |
| PB5 | pass; expert sign-off pending                                                                             | PL5 | pass; fail → fixed (one sentence implied formation); expert sign-off pending                |
| PB6 | pass                                                                                                      | PL6 | pass; owner look of the 12° block tip pending                                               |
| PB7 | pass (original form); listening and gesture usability pending                                             | PL7 | pass; fail → fixed (live reduced motion, fixture wording); listening, colour vision pending |
| PB8 | pending-human (owner review of the 7G decisions, readers, listening, expert, hardware)                    | PL8 | pass                                                                                        |
| PB9 | pass (lesson 1); not applicable to lesson 2 by D-L2-1 decision 8                                          | PL9 | pass with note (one lesson-1 CSS fix, one generic engine option recorded)                   |

## Glacial acceptance (5N, 2026-11-14) — superseded by the two-lesson ledger above for PB1–PB9

Walked on the default app at `b82dae5` plus 5N fixes; full ledger with evidence links:
[docs/review/glacial/acceptance](../review/glacial/acceptance/README.md) (D-W5-5N). The registered protocol
was rerun on production code: 18/18 arms reproduce the 5G2 record bitwise, 39/39 verdicts identical
(16 pass, 23 fail as registered); the GPU passes every registered gate on one adapter
([validation](../science/validation/glacial-valley/README.md)).

**5N2 amendment (2026-11-14, D-W5-5N2):** the owner approved the scene as working (GV4 owner review closed;
O1 and O2 accepted as they are) and removed the water lesson; the book is the single lesson _From V to U_.
PB7 is amended for a one-lesson book (no second spread to turn to) and GV7 drops the water spread.

| Row | Status                                                                   | Row | Status                                                                      |
| --- | ------------------------------------------------------------------------ | --- | --------------------------------------------------------------------------- |
| PB1 | pass: owner accepted O1 as is (5N2); 5N: at risk                         | GV1 | pass                                                                        |
| PB2 | pass; human legibility and real zoom pending                             | GV2 | pass                                                                        |
| PB3 | pass; human spatial reading pending                                      | GV3 | partial: taught claims pass; T1, R2, R3, E-T1, E-R2, E-R4 fail (not taught) |
| PB4 | pass; first-time reader finding Play pending                             | GV4 | pass; owner approved 2026-11-14 (5N2)                                       |
| PB5 | pass; expert sign-off pending                                            | GV5 | pass (one content defect fixed in 5N)                                       |
| PB6 | pass                                                                     | GV6 | pass; screen-reader listening and colour-vision pending                     |
| PB7 | amended (5N2, one lesson): pass; listening and gesture usability pending | GV7 | pass (amended by 5N2: single lesson, research route, privacy)               |
| PB8 | pending-human (readers, listening, expert, hardware; owner review done)  | GV8 | pass                                                                        |
| PB9 | pass                                                                     | GV9 | pass on Intel Arc 140V; other hardware pending                              |

The table below remains the historical A–F baseline, not a glacial pass.
See [session ownership and criteria](stage-1-wave-5-glacial.md#traceability-and-drift-gate).

| Criterion                    | Automated / rendered evidence                                                                                                                                        | Status and remaining owner                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PB1 recognisable book        | `e2e/book-acceptance.spec.ts`: full viewport captures at 1366×768 and 1440×900, both real lessons; no lesson scrolling in normal closed-flap view                    | Mechanics checked; owner visual/reference review pending, 6C                                  |
| PB2 readable adaptation      | Same suite: both lessons at 390 px, 320 CSS px, tablet and 683×384 effective viewport; text/illustration navigation, no horizontal overflow                          | Effective 200% reflow checked; actual browser zoom and human legibility/listening pending, 6B |
| PB3 drawing becomes space    | `acceptance/reader-journey.webm`: real attached-ring pointer lift, real spring placement; keyboard/reduced-motion suite                                              | Automated mechanics and rendered evidence; human spatial interpretation pending               |
| PB4 immediate play           | No selected answer, no collection or technical setup before direct lift/source actions; smoke direct-entry cases                                                     | Automated pass; full suite 52/52                                                              |
| PB5 one visible lesson       | Contour geometry/projection unit tests; prospective source-only intervention in `docs/science/validation/playable-book`; actual scene screenshots and bound captions | Narrow geometry/prepared-surface claims supported; expert review pending, 6C                  |
| PB6 pressure-free reflection | Immediate pre-run reveal on both lessons; skipped questions, explicit resets and no stamp guards                                                                     | Automated pass; full suite 52/52                                                              |
| PB7 book continues           | Actual default pointer/keyboard turns, retained lift/explanation, smoke settled water/research return; shell arbitration/race fixtures                               | Automated mechanics; listening/gesture usability with people pending, 6B/6C                   |
| PB8 human review             | New listening and first-time-reader protocols in packet                                                                                                              | Pending; no human participants or owner approval recorded                                     |

The contour lesson behind the PB3 and PB5 lift evidence was removed on 2026-11-13 (D-W5-5M2); the
rows stay as the historical record. The water lesson behind the PB3 spring, PB5 source-only intervention, PB6 and PB7 water evidence was
removed on 2026-11-14 (D-W5-5N2); those rows also stay as the historical record.

Evidence paths above are repository-relative; captures live in
`docs/review/book-revision/acceptance/`. Exact execution outcomes are in the
packet's verification record; a screenshot or unit pass does not close PB8.

| Foundation / release obligation                     | Evidence / disposition                                                                                                                      | Accountable session                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Process simulation, deterministic CPU/GPU agreement | Existing unit suite and 68 browser GPU comparisons; no solver change in 5F                                                                  | 6A preserves comparisons for any measured tuning    |
| Research route truthfulness                         | `comparison`, `science`, `smoke`, `university` browser suites preserve exact seeds/samples, shared axes, no invented years or pending stamp | 6B retains regression suite                         |
| Privacy                                             | `instrumentation.spec.ts`: opt-out/opt-in export, no names/free text/network, v1 rain scope                                                 | 6C any future study design; no new reader analytics |
| Accessibility                                       | Actual keyboard/reduced-motion journey and axe serious/critical scan; actual listening and colour/projector checks still required           | 6B                                                  |
| Startup, manipulation and page-turn performance     | Headless diagnostic runs only; visible target integrated-GPU measurement pending                                                            | 6A                                                  |
| Scientific sign-off                                 | Both new lesson drafts retain expert-review markers and sources; failed erosion morphology and pending waterfall remain historical          | 6C                                                  |
| Product decision and learner observations           | No observations supplied or inferred                                                                                                        | Owner + 6C                                          |
| Later-stage selection / retro                       | Use packet drift audit; no automatic new engines, quizzes, DEMs or catalogue                                                                | 6D                                                  |

No Wave 5 local merge asserts that main is integrated, that field magnitudes are
calibrated, or that the book is ready for release.
