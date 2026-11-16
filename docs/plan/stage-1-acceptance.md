# Stage 1 integrated acceptance ledger

Reviewed 2026-11-09 on the local Wave 5 review stack, based on `d01f631`
(5E integrated). Main remains at 5A. This is an implementation/evidence review;
product acceptance and release remain open. [Review packet](../review/book-revision/acceptance/README.md).

**Owner clarification after this evidence:** the existing PB3 mechanics do not close
the intended complete-scene experience; the selected opening has changed to glacial
U-shaped valley formation. Prior test results remain valid for their original scope,
not evidence of glacial erosion or approval of the old lesson. See the
[current review](../review/book-revision/current-direction-review.md).

## Two-lesson book acceptance (7G, 2026-11-15) — current

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
