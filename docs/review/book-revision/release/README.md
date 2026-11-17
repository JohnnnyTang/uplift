# 6C · Two-lesson scientific and product review packet

## Owner update · presentation release · 2026-11-17

The owner requested that sessions 6G and 6H be completed, merged in that order,
and published to GitHub Pages, with the release updated. The release combines
a larger fitted book on a procedural study desk with a held drawing, ordered
construction sketch, lift and natural-colour entrance. Input skips the entrance;
reduced motion shows the usable scene immediately. Neither change alters the
scientific model or starts a simulation.

The [6G evidence](../desk-refinement/README.md) records viewport-specific size
gains and the fit/centring deviations. The [6H evidence](../uplift-transition/README.md)
records phase timings, fallback behavior and verification. Publication authorization
does not turn these presentation changes into new scientific or classroom validation,
or establish a target-hardware frame-rate pass. Earlier records below are historical.

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

Reconciled 2026-11-16 against merged **6B**, main `d1fdae5` ([PR #53](https://github.com/JohnnnyTang/uplift/pull/53)).
The two lessons and current audit are now the review baseline. The original 7G preparation is recorded
in D-W6-6C-PREP; D-W6-6C records this integration. Sequence remains **6B → 6C → 6D**.
No expert decision or participant observation is inferred from the merge.

**Publication status: review candidate; Stage 1 release gate remains open.** The owner
requested that human checks remain pending with assigned roles. Role assignments below
are responsibilities, not claims that named reviewers have accepted or performed them.
No reviewer has been contacted by this work.

## Read and play

1. Follow the [short teacher journey](teacher-journey.md) through both lessons and back.
2. Compare the working sequence with the [saved owner references](../../../references/owner-2026-11-09/README.md)
   and the [product contract](../../../plan/product-realignment.md#product-acceptance-gate).
3. Use the register below to review actual claims and limitations. The linked registers
   and expert packets remain authoritative; this index does not replace or approve them.
4. Record each decision or observation in [review records](review-records.md), with the
   exact commit, setup, scope and evidence. Unperformed checks remain pending.

## Merged acceptance evidence

The [current acceptance ledger](../../../plan/stage-1-acceptance.md) and
[6B audit](../accessibility/README.md) reconcile PB1–PB9 and the applicable foundation checks.
The audit fixed nested main landmarks, keyboard scrolling of an overflowing equation, and the actual
glacier fallback's source lifetime and disclosure. Its final application revision is `11fecea`,
contained in the merged 6B head `80ab409`.

- Local `pnpm check`: 886 tests passed, 7 skipped; final affected production browser rerun: 19/19 passed.
- Final [6B browser CI](https://github.com/JohnnnyTang/uplift/actions/runs/43828808448/job/133168856784):
  116 passed, 1 skipped. This supersedes neither the recorded local setup nor its different skipped cases.
- [Sixteen axe scans](../accessibility/axe-results.json): zero violations; 14 lesson states retain
  incomplete contrast checks. These require human examination, not an inferred pass or failure.
- CI check and solver-comparison jobs passed on the PR head. CI execution does not establish
  classroom hardware performance, human listening or reviewed scientific claims.

[Human procedures H1–H8](../accessibility/human-checks.md) provide the listening, real-zoom,
colour/projector, reader, owner, expert and hardware tasks. Their roles and release status remain
pending in [review records](review-records.md); the research specialist review is also retained.

## Claims, sources, evidence and draft scope

<!-- expert-review -->

The following summarizes the existing review packets, not a new scientific assessment.
All scientific copy and teacher notes retain their expert-review status.

| Surface                                              | Claim and source register                                                                                                                                                                                                                                                | Evidence and limits to review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Drafts and reviewer                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **From V to U** (`geomorph.u-valley`)                | [Sentence/claim register](../../../science/glacial/lesson/README.md), [lesson sources](../../../../uplift/spreads/geomorph.u-valley/sources.md), [model sources](../../../science/glacial/sources.md)                                                                    | [5N expert packet](../../glacial/acceptance/expert-review.md) maps taught claims to the [registered protocol](../../../science/glacial/acceptance-protocol.md) and [production rerun](../../../science/validation/glacial-valley/README.md). Relative lowering at matched time is supported; wall steepness needs the equal-erosion/end-of-run qualification. Complete-U, floor-width ordering and early matched-time wall claims are not promoted from failed outcomes. Time is compressed model time, not a real valley age. | [All spread copy](../../../../uplift/spreads/geomorph.u-valley), including both pages/flaps, lesson text, limitations, captions and text alternatives in the register; [teacher notes](../../../../uplift/spreads/geomorph.u-valley/teacher-notes.md). Pending: geomorphologist/glaciologist, coordinated by SCI lead. |
| **Where plates meet** (`tectonics.plate-boundaries`) | [PC/NT claim register](../../../science/plates/claims.md), [sentence register](../../../science/plates/lesson/README.md), [lesson sources](../../../../uplift/spreads/tectonics.plate-boundaries/sources.md), [source access record](../../../science/plates/sources.md) | [7G expert packet](../../plates/acceptance/expert-review.md) covers every taught claim, cited figure and artistic choice. [Parameters](../../../science/plates/parameters.md) distinguish authored drawing choices from real-world facts. D-L2-1 allows authored relief only here: no scene claim of simulation or elapsed model years. Continental settings, omitted processes and differing drawing scales must remain clear.                                                                                                | [All spread copy](../../../../uplift/spreads/tectonics.plate-boundaries) and [teacher notes](../../../../uplift/spreads/tectonics.plate-boundaries/teacher-notes.md), including DOM text alternatives and help lines mapped by the register. Pending: geologist/geophysicist, coordinated by SCI lead.                 |
| **Erosion research example** (`?view=research`)      | [Lesson sources](../../../../uplift/spreads/geomorph.v-valley/sources.md), [rain comparison protocol and evidence](../../../science/validation/rain-comparison/README.md)                                                                                                | Recorded matched exposed-rock rain arms support a gross-material-lift comparison. Gross erosion is not net incision or catchment export. The separate live sandbox does not modify the recordings. [Original morphology failures](../../../science/validation/README.md) and [follow-up](../../../science/validation/followup/README.md) remain intact; the waterfall challenge is unvalidated and no stamp is enabled. No calibrated geological clock.                                                                        | [Research copy](../../../../uplift/spreads/geomorph.v-valley), [teacher notes](../../../../uplift/spreads/geomorph.v-valley/teacher-notes.md). Pending: geomorphology/hydrology reviewer, coordinated by SCI lead. Research evidence does not set the two lessons' teaching claims.                                    |

The 5N production rerun reports 18/18 arms reproduced bitwise and 39/39 verdicts
unchanged: **16 pass, 23 fail**, as registered. This is reproducibility evidence,
not an all-green morphology result. Review the eight questions in the glacial expert
packet and seven in the plate packet, including source-access limits. This session
has not re-read those papers or rerun the model protocol.

## Product evidence against the reference intent

| Intent                                                                              | Existing evidence on merged code                                                                                                                                               | Decision or remaining question                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A book with a dominant illustration, natural scene colours and an artistic entrance | [7G two-lesson ledger and captures](../../plates/acceptance/README.md); [5N glacial ledger](../../glacial/acceptance/README.md)                                                | D-W5-5N2 accepted lesson 1's look and O1/O2. D-W7-7G's 2026-11-16 owner review accepted the ghost key, block tip and F1 size change. F2 recognisability at laptop size remains pending. |
| Immediate action and an optional explanation                                        | Existing glacial/plates acceptance suites exercise picker/gesture, playback and immediate unanswered reveal                                                                    | First-time-reader discoverability and interpretation remain pending; a scripted journey is not a participant observation.                                                               |
| A next discovery, then a return to the same run                                     | [7G recording](../../plates/acceptance/captures/journey-turn-transform.webm), `plates-book.spec.ts` and `plates-acceptance.spec.ts` cover the turn and retained lesson 1 state | Owner accepted different fit sizes at 1440 × 900 (F1); do not reopen it as a required engine fit change. Human gesture usability/listening remains pending.                             |
| Readable adaptation and equivalent access                                           | Existing phone/reflow, keyboard, reduced-motion and axe evidence in the 7G ledger                                                                                              | Actual browser zoom, screen-reader listening, colour-vision and projector/classroom results remain pending under 6B.                                                                    |
| Honesty beside the relevant scene                                                   | Each lesson has its limitation disclosure and sources; the research route labels recordings separately from live terrain                                                       | Expert decisions remain pending. The artistic entrance is not evidence for process validity.                                                                                            |

Some older packets still say that the 7G owner look is pending. The appended
**2026-11-16 owner review in D-W7-7G** in [DECISIONS.md](../../../../DECISIONS.md)
supersedes that status for its explicit scope only; it does not close F2, science or
first-time-reader checks.

## Fallbacks and measured hardware scope

| Path                                               | What the reader receives                                                                                    | Evidence boundary                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glacier WebGPU unavailable                         | Live CPU worker fallback; backend detail is disclosed in the deeper view                                    | Existing runtime/backend tests and 6A/6A2 measurements. CPU playback throughput differs; it does not change the fixed-step claim.                                             |
| Glacier live host cannot start                     | Labelled recorded runs, not a live result                                                                   | `glacial-fallbacks.spec.ts` verifies recorded choice/time/ghost retention across levels and turns, hidden pause and restored play intent. No new simulation is implied.       |
| Glacier live host and recorded downloads both fail | Explicit illustration preview only; no live model or recorded run is available                              | `glacial-fallbacks.spec.ts` faults the actual capture fetches and verifies the label and return state. Never present the fixture as process evidence.                         |
| Glacier 3D cannot render                           | Drawing and enlarged front face with an explicit static-view disclosure                                     | `glacial-fallbacks.spec.ts` disables 3D on the default route and checks disclosure, immediate reveal and keyboard turns. Phone/reduced-motion layout is a separate condition. |
| Plate illustration cannot render in 3D             | "Drawing only" with the enlarged front face; no claim of recorded simulation runs                           | `plates-book.spec.ts` fallback test and 7G drawing-only capture.                                                                                                              |
| Research backend unavailable                       | The backend chain exposes its selected tier/failure; the flat tier disables unavailable simulation controls | `backends.spec.ts`; do not infer GPU availability from a forced-WebGPU fallback pass.                                                                                         |

Measured performance is on one target laptop, not a browser/device support matrix:
[6A and 6A2](../../../perf/README.md), [7F two-lesson measurements](../../../perf/plates/README.md).
The CPU scrub-after-Pause issue was fixed in 6A2; the original failure is historical.
The initial GPU rock-choice and research-return marginal target misses were not reworked.
7F did not measure CPU glacier across the turn, two-lesson cold network loads or other
hardware. Current evidence links, exact configurations and outstanding checks belong in
[6B's acceptance ledger](../../../plan/stage-1-acceptance.md); this packet carries no new hardware pass.

## Decision state and handover

[Review records](review-records.md) assigns each pending item and provides recording
fields for actual review. No first-time readers or experts participated in this 6C
review work. Do not infer learning gains from completing the journey or from telemetry.
The existing rain-only, opt-in local instrumentation is not extended.

**Done:** current two-lesson README, claim/source/evidence index, existing recording and
teacher journey, review roles and result templates. Research teacher instructions now
match optional prediction and immediate reveal in the integrated app. Merged 6B evidence, fallback behavior
and pending human tasks are reconciled.

**Not done:** human/expert review, publication approval or new human/hardware evidence collection. No Stage 2 work is included.

**Surprise:** the repository's top-level README and research teacher instructions still
described superseded states despite the implemented two-lesson, ungated journey.

**Plan fact:** pending work is review of this book, not another lesson or a new engine.
Quoted traceability row, **PL5**: "Honesty: the illustration label, authored-shapes
disclosure, no computed-looking numbers, cited figures, expert-review marks."

Glacial traceability, **GV5**: "Margin notes, caption, front face, ghost and explanation
all refer to the same run, time and config." The teacher journey preserves matched-time
comparison and identifies illustration stages separately from model time.
