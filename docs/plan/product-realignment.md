# Stage 1 product realignment

Owner-directed correction, 2026-11-09. Read the [product story](../product-story.md)
and [handoff principles](../handoff.md#pedagogical-design-principles) first.
This is the active sequence before Wave 5; it does not close Wave 4's open acceptance
items or relabel historical scientific outcomes.

## Scope and sequence

The current request is to correct the product direction before continuing implementation.
P0 records that correction in the governing documents. P1 and P2 implement and test it;
they are planned work, not delivered by the documentation change.

| Session                               | Outcome                                                                                                | Dependency                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| P0 · Product direction                | Consistent brief, evidence-based drift assessment, new acceptance gate and implementable next sessions | Current main                               |
| P1 · First playable book spread       | Book composition, immediate 3D interaction, optional question/flap, and a usable first lesson          | P0                                         |
| P2 · Turn to another discovery        | Second live lesson, real page turn/state lifecycle, reader walkthrough and review evidence             | P1                                         |
| Wave 5 · Hardening and release review | Hardware measurements, revised acceptance audit, science/accessibility review and retro                | P2 plus applicable carried technical gates |

Run P1 then P2 serially so each can revise the next brief from evidence. A product owner
review of the working sequence informs Wave 5; automated passes do not stand in for that
review. No new engine programme, catalogue, account system or instrumentation expansion
is needed for this correction.

## P0 · Product direction — current session

**Branch:** `s1/pivot/product-realignment`, in its own sibling worktree.

**Owned paths:** `docs/product-story.md`, `docs/handoff.md`,
`docs/plan/README.md`, `docs/plan/stage-1.md`, this file,
`README.md`, and append-only `DECISIONS.md`.

**Deliverables:** record the owner's intent, distinguish the existing research prototype
from the intended reader experience, remove contradictory active requirements, and make
the next product proof reviewable. Preserve science policy, evidence and engine code.

**Exit:** the governing documents agree on immediate play, optional questions, bounded
book composition, page turning, scientific honesty and the P1/P2 gate. Run `pnpm check`
and inspect the documentation diff. No claim that the app has already been redesigned.

## P1 · First playable book spread — next implementation session

**Owned paths:** `uplift/book/src/**`, `uplift/spreads/**`,
`hachure/runtime/src/core/lifecycle*`, `hachure/runtime/src/schema/**`,
`hachure/runtime/src/widgets/**`, `hachure/ink/src/**`,
`e2e/**`, `docs/review/product-realignment/**`, and append-only `DECISIONS.md`.
Minimal public exports and updates to this plan are integration glue; explain them.
If inspection finds a required runtime path outside these boundaries, record and bound
that extension before implementation. Solver changes are not part of this session.

**Candidate:** Contours to terrain. Start with the existing contour extraction, heightfield,
projection and lift. Prove a readable flat diagram and spatial counterpart in the real
renderer before polishing the shell. Do not substitute a static illustration or prerecorded
movie for the manipulable 3D scene.

**Deliverables:**

- Compose a complete desktop spread within the reading viewport, with a dominant
  illustration, clear page edges/gutter, quiet navigation location and readable DOM text.
  Define a portrait-page aspect ratio in the shell and document it; compose to it rather
  than letting content determine an arbitrarily tall sheet.
- Support a narrow-screen single-page presentation and zoom reflow. Do not shrink desktop
  content wholesale. Explanation, scene and navigation must remain easy to reach.
- Offer one obvious gesture on the actual illustration, a keyboard equivalent and an
  accessible text account of the change. Use only one optional condition control at
  opening; pause/reset remain reachable. No numeric tool palette in the primary view.
- Make the drawing lift and the scene become usable once ready, independent of prediction.
  Reduced motion offers the equivalent state without forced animated lifting or autoplay.
  Reuse geometry derived from the same state; presentation lift never edits the terrain.
- Put a brief optional question near a freely available answer flap. Reveal before or
  after interaction. Support an unanswered state and a nonjudgmental response to any guess.
  Remove endpoint/commitment requirements from this new reader flow.
- Keep deeper content, technical controls, sources and teacher notes accessible through
  explicit disclosure. Preserve level-switch state semantics, truthful labels and the
  existing separation of recorded and live data.
- Author one small sourced explanation, marked `<!-- expert-review -->`. Make no new
  morphology or geological-time claim. Review contour interaction truthfulness against
  actual geometry; an attractive lift alone is not evidence of a learning outcome.
- Keep the existing erosion example and validation artifacts reachable through an
  explicitly labelled research/example entry, outside the default reading sequence.
  Its recorded chart must never impersonate the new scene's live output.
- Record missing primitives and extract shared functionality where needed. Keep spread
  definitions thin. Existing scholarship and solver checks must remain intact.

**Verification:** update lifecycle/schema/widget tests whose mandatory gate assumptions
are intentionally changed, while retaining model-state and pending-science safeguards.
Browser checks must exercise direct interaction without a prediction, immediate reveal,
keyboard equivalence, reduced motion, zoom/reflow, level preservation and fallback.
Run `pnpm check`, relevant browser checks and `pnpm build`. Save full viewport evidence
at desktop, tablet and narrow phone widths; a full-height page capture alone cannot
prove the book fits. Inspect the actual render, not only a DOM snapshot.

**Exit:** the first spread passes the applicable product criteria below. Reserve a real
next-page interaction for P2; do not claim page turning is complete from an animated blank
sheet, dummy destination or disabled Next button.

## P2 · Turn to another discovery

**Owned paths:** the same implementation paths as P1 (serial ownership), plus
`hachure/runtime/src/sim-host/**` only if a documented existing-model source interaction
needs a shared host primitive. Minimal barrel exports and plan updates are glue.
Changing terrain physics requires a separately scoped decision and CPU/GPU comparisons.

**Candidate:** Where will the water go? First verify that placing a source on prepared
terrain is supported or can be expressed by a small reusable host/tool primitive.
Choose the teaching claim only after inspecting the live consequence at the actual
reading scale. Existing gross-erosion replay evidence is not evidence for this lesson.
If visibility or interaction does not work, record the failed trial and revise the
candidate. Do not broaden into erosion calibration to rescue an introductory page.

**Deliverables:**

- A second small, sourced and expert-review-marked lesson: one primary interaction,
  one visible consequence and one optional reveal. Validate the claimed model relationship
  with the science policy appropriate to its tier, plus actual rendered evidence.
- Functional previous/next navigation and a visible page-turn effect between the two
  working spreads. Page numbers and progress follow the active page; navigation never
  requires answering, winning or collecting a stamp.
- Guard gestures: scene drag must not flip a page; page turn must not accidentally apply
  a tool. Scope keyboard shortcuts to the reading surface, excluding form fields.
  If wheel/swipe navigation is included, debounce intentional turns and respect zoom
  and scrollable accessibility content.
- Pause an off-page simulation and retain its state for return. Keep the departing scene
  attached to its page during a turn, then restore focus to the arriving page heading.
  Revisiting does not reset progress or model state; reset remains explicit.
- Reduced-motion navigation, keyboard paths, truthful static fallback, stable layout,
  and disposal/re-entry checks with no duplicate animation loops or lost GPU resources.
- A short recording of the whole reader journey and a candid product-review note.
  Invite a few first-time readers to find the action, play, explain one observed change,
  reveal an answer and turn onward. Report what they actually did and said; wanting to
  continue and learning are human observations, not inferred from event counts.

**Exit:** the complete book sequence passes PB1–PB8. If human review cannot be performed,
mark it pending and provide the runnable sequence and protocol. Do not claim that
curiosity, comprehension or accessibility listening has been validated by automation.

## Product acceptance gate

These criteria add a product gate; they do not erase existing numerical correctness,
science-review, hardware or accessibility obligations. The dimensions below are review
viewports, not simulated measurements, and do not belong in lesson copy.

| ID                                      | Required evidence                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PB1 · Recognisable book                 | At 1366×768 and 1440×900 at normal zoom, a full two-page spread and navigation fit without lesson scrolling. The illustration is the primary visual element; the key action and answer reveal are reachable. No clipped content or text shrunk to force a pass.                                        |
| PB2 · Readable adaptation               | At a 390 px phone width, pages have an intentional single-page presentation. At 200% zoom and an equivalent 320 CSS px reflow width, content stays readable and reachable, with scrolling permitted and no two-dimensional text scroll requirement.                                                    |
| PB3 · Drawing becomes manipulable space | Recording shows the real flat diagram, same-state 3D geometry and direct interaction. Keyboard and reduced-motion alternatives reach equivalent meaningful states.                                                                                                                                     |
| PB4 · Immediate play                    | A fresh reader can operate the main scene without choosing an answer, configuring technical parameters, enabling logging or completing a prior spread. Readiness and genuine capability limitations are the only technical gates.                                                                      |
| PB5 · One visible lesson                | Each spread has one stated claim and one principal gesture. The visible consequence and any gauge derive from that scene's actual state. Scientific checks and accessible description match the rendered result.                                                                                       |
| PB6 · Pressure-free reflection          | Question can be skipped; answer can be revealed immediately; no score, stamp, endpoint or correct-choice requirement blocks reading. Optional challenges cannot block navigation.                                                                                                                      |
| PB7 · A book that continues             | Two working interactive spreads, a genuine page turn, previous/next and keyboard navigation, guarded gestures, preserved return state, managed focus and reduced-motion transition.                                                                                                                    |
| PB8 · Human review                      | Owner reviews the working sequence against the supplied reference; first-time reader observations report discoverability, understanding and willingness to continue. Human listening, science sign-off and hardware results are explicitly passed, failed or pending, never inferred from screenshots. |

For PB1, an opened optional deep explanation may use a further page or accessible
disclosure view. It must not silently stretch the normal spread into a long worksheet.
For PB5, a cosmetic animation on top of an unreadable numerical change is a failure.
A scene that plays beautifully but teaches an unsupported claim also fails.

## Keep, move, defer

| Keep as foundations                                                     | Move behind explicit disclosure                                          | Defer from the next product proof                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| CPU/GPU solvers, deterministic state, conservation and comparison tests | Numerical budgets, full profiles, seed/backend/configuration controls    | Further engine expansion and real DEM scope                            |
| Contours, hatching, picking, real lift and quantity encodings           | Recorded rain experiment, labelled as recorded and separate              | Unvalidated waterfall/challenge success                                |
| Bindings, accessible controls, reduced motion and truthful fallback     | Research status, validation history and opt-in classroom instrumentation | Stamps, scoring and more analytics work                                |
| Expert review and truthful model limits                                 | Equations and advanced parameters for readers who ask                    | Field calibration unless a selected lesson claims field rates or years |

## Handover and unresolved choices

**Done in P0:** product definition and active roadmap correction.
**Not done in P0:** UI redesign, new spread code, page-turn implementation or learner study.
**Plan-changing finding:** the existing implementation faithfully follows requirements that
gate play, foreground a recorded comparison and postpone paging. Cosmetic restyling alone
cannot fix that; lifecycle, editorial scope and stage acceptance must change together.

P1 chooses the exact book proportions and contour gesture from working visual trials.
P2 confirms the second lesson's feasibility before authoring its answer. Scientific
reviewer assignment and the carried hardware/human listening checks remain open.
These choices are implementation/review work, not reasons to reopen the owner's
already-clear direction.
