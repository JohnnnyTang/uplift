# Review roles, decisions and observation record

## Owner update · Stage 1 release · 2026-11-16

The owner reported that **expert review is done by the project team** and directed that
the group review of the working book be recorded as met, and that Stage 1 be published
and released. H6 (glacier), H7 (plates) and the retained research review are
**passed (owner-reported, team review)**. Reviewer names, reviewed commit, claim-level
answers and requested edits were not supplied and are not invented here. With H1–H5
already passed (D-W6-6E), the Stage 1 exit gate is met and **Stage 1 is released**.
H8's measured multi-device matrix and the narrow 6A latency misses stay recorded as
known limitations, not release blockers. Publication is by GitHub Pages. Stage 2
planning still needs its own owner direction. See D-W6-6F in [DECISIONS](../../../../DECISIONS.md).

Records below this block describe earlier states and keep their original wording.

## Owner update · 2026-11-16

The owner reported **"all passed for human checks"** on the production review at
`83f0ba6`. H1–H5, including F2, are **passed (owner-reported)**. The general pass also
covers human device-usability feedback; it does not supply H8's measured hardware
matrix. Exact setups, tester details and raw observations were not supplied.
Scientific specialist sign-offs H6/H7 and the retained research review remain
separate and pending; no publication or Stage 2 authorization is inferred.
See D-W6-6E in [DECISIONS](../../../../DECISIONS.md).

6D #55 is merged. The requested 1.5× opening-valley refinement follows this review;
the baseline pass is not a claim of human retesting after that change. Earlier
pending-human records below describe the audit before this owner report.

**Status, 2026-11-16:** no new human review performed. The owner requested that these
checks remain pending with assigned roles. No named participant, appointment, result
or approval is invented. The lead nominates people when review becomes available.

## Decision register before the owner pass

| Item                                                                                  | Current status and evidence                                                                                                                         | Accountable role                                         | Closure evidence                                                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Lesson 1 scene/look, O1 and O2                                                        | Approved in D-W5-5N2; [owner packet](../../glacial/acceptance/owner-scene-review.md)                                                                | Product owner                                            | Already recorded; do not reopen without a new observed issue or owner direction                                |
| Lesson 2 ghost key and block tip; F1 size change at the turn                          | Approved in the 2026-11-16 addition to D-W7-7G, [decision log](../../../../DECISIONS.md)                                                            | Product owner                                            | Already recorded for that scope only                                                                           |
| F2: lesson 2 recognisability at laptop size                                           | Pending; [7G owner packet](../../plates/acceptance/owner-scene-review.md)                                                                           | Product owner with 6C lead                               | Actual default view at laptop sizes, decision and any required adjustment                                      |
| Glacier scientific mechanism, qualifications and wording                              | Pending; eight questions in [expert packet](../../glacial/acceptance/expert-review.md)                                                              | SCI lead → geomorphologist/glaciologist                  | Reviewer/date/commit, claim IDs, answers, approved scope or requested edits                                    |
| Plate scientific wording, real figures and illustrated scope                          | Pending; seven questions in [expert packet](../../plates/acceptance/expert-review.md)                                                               | SCI lead → geologist/geophysicist                        | Reviewer/date/commit, PC/PD/NT IDs and approval or revisions; full-text checks where source access was limited |
| Research comparison and limits                                                        | Pending; [comparison evidence](../../../science/validation/rain-comparison/README.md), [historical failures](../../../science/validation/README.md) | SCI lead → geomorphology/hydrology reviewer              | Sign-off limited to supported gross-erosion comparison, with failed morphology preserved                       |
| First-time-reader observations                                                        | Pending; no participants                                                                                                                            | Product/research lead → first-time readers               | Uncoached observations using the protocol below; no inferred learning gain                                     |
| Screen-reader listening, real browser zoom, colour-vision and projector/classroom use | Pending; automated structure is not listening evidence                                                                                              | 6B QA lead → accessibility tester and classroom educator | [6B procedures H1–H3](../accessibility/human-checks.md): exact setup, actual observations and remediation      |
| Broader browser/device/hardware coverage                                              | Pending; one target-laptop performance record exists                                                                                                | QA/performance lead → device testers                     | Exact device, browser, driver, power, commit and repeated measurements                                         |
| Merged 6B audit reconciliation                                                        | Complete against main `d1fdae5` ([PR #53](https://github.com/JohnnnyTang/uplift/pull/53)); [audit](../accessibility/README.md)                      | 6C lead                                                  | Final evidence, fallback fixes and assigned pending items reconciled; no human gate closed                     |
| Publication/release decision                                                          | Pending                                                                                                                                             | Project lead with product owner and SCI/QA leads         | Linked decisions satisfying the Stage 1 gate; implementation merge alone is insufficient                       |

## First-time-reader protocol

Keep this separate from the guided teacher demonstration. Record practical setup,
not identifying personal details, and obtain appropriate permission before recording
a person. Do not enable or broaden the existing rain-only instrumentation.

Give the reader the default book with the neutral invitation: "Explore this book as
you normally would." Observe before prompting. Record what actually happens:

1. Do they find a rock choice and Play, and what do they expect those controls to do?
2. Do they notice the visible change, the front face and the distinction between the
   current run and a kept run? Can they describe what their comparison holds constant?
3. Do they discover the explanation without treating the question as a gate?
4. Do they find the next page? What do they think the plate scene represents, and do
   they distinguish its illustrated stage from the glacier's model time?
5. Do the ghost names, patterns and front face help them compare boundaries?
6. Can they return to the first lesson and recognise its retained state?
7. What do they want to explore next, if anything? Record their words without making
   continued use or completion into a learning score.

If assistance becomes necessary, log the exact prompt and its timing. Separate
unprompted observations from what the facilitator demonstrated. This small usability
record does not measure learning gains or establish population-wide outcomes.

## Blank result record

Copy this for each actual review; until completed it is a template, not evidence.

- **Record ID / role:** pending.
- **Date and reviewed commit:** pending.
- **Task / criterion / claim IDs:** pending.
- **Device, OS, browser/version, viewport/zoom, assistive technology/version:** pending.
- **Starting state and instructions given:** pending.
- **Observed action or exact reviewer feedback:** pending.
- **Result:** pending (pass / fail / mixed only after observation).
- **Evidence location and permission to retain it:** pending.
- **Limitations / assistance given:** pending.
- **Required change, accountable role and retest criterion:** pending.
- **Decision entry / approval scope:** pending.

Expert and owner decisions are appended to `DECISIONS.md`, with the precise reviewed
scope. Keep draft marks until the applicable scientific review is actually approved.
A partial decision closes only its listed items.
