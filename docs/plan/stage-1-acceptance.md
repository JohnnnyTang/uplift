# Stage 1 integrated acceptance ledger

Reviewed 2026-11-09 on the local Wave 5 review stack, based on `d01f631`
(5E integrated). Main remains at 5A. This is an implementation/evidence review;
product acceptance and release remain open. [Review packet](../review/book-revision/acceptance/README.md).

**Owner clarification after this evidence:** the existing PB3 mechanics do not close
the intended complete-scene experience; the selected opening has changed to glacial
U-shaped valley formation. Prior test results remain valid for their original scope,
not evidence of glacial erosion or approval of the old lesson. See the
[current review](../review/book-revision/current-direction-review.md).

## Planned extension acceptance — not yet run

5G–5N must supply PB9 and GV1–GV9 evidence: rock-type choice through UI/3D starting
separate runs, formation over time, pause/step/scrubbing, matched-time comparison with
kept runs, glacial process and CPU/GPU parity, a naturally coloured scene on a tilted
book page, provenance and accessible default-book integration. Every extension
criterion is **pending**. 5N owns the integrated packet; 5G/5I own mechanism and
backend evidence; R1 records the owner's scene review. The table below remains the historical A–F baseline, not a glacial pass.
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
