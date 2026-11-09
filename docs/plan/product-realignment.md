# Product realignment: accepted direction and product gate

Owner-directed correction, 2026-11-09. Product-direction commit 46fefe6 is merged
into main. Read the [product story](../product-story.md) and
[handoff principles](../handoff.md#pedagogical-design-principles).

## Execution now follows a complete Wave 5

The original P0 direction work is delivered. The preliminary P1/P2 outline is
**superseded by [Wave 5 sessions 5A–5F](stage-1-wave-5.md)**, covering contracts,
runtime revision, book shell/paging, the new example, migration of the built app,
and integrated verification. 5A is on main; 5B–5F are integrated on the local review branch. See the [acceptance ledger](stage-1-acceptance.md); owner, human, expert and hardware gates remain pending.

The former Wave 5 hardening sessions are now [Wave 6](stage-1.md#wave-6--hardening-and-release-review).
Historical evidence keeps its original status; this revision neither closes human/
scientific gates nor converts failed morphology into a success.

| Earlier outline                    | Current accountable work                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| P0 direction                       | Delivered and merged to main                                                                |
| P1 first playable spread           | 5A contracts/feasibility; 5B runtime; 5C shell; 5D example                                  |
| P2 another discovery and page turn | 5C paging; 5D second spread; 5E real-app migration                                          |
| P1/P2 validation and review        | 5F integrated product checks; 6A–6C hardware/human/expert completion                        |
| Future-plan correction             | Wave plan and downstream briefs revised now; 5F reconciles measured implementation findings |

The table below remains the authoritative product acceptance contract. Session
briefs point here instead of maintaining a second, subtly different definition.

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

## Open choices and honest completion

5A fixes book proportions, the primary contour gesture and the second lesson after
a bounded real-renderer trial. 5D supplies sourced draft copy and claim evidence.
The owner has already authorized the direction; these are implementation decisions,
not reasons to ask for it again.

5F and Wave 6 explicitly track product review, human listening, target hardware and
expert sign-off. Implementation integration alone cannot close those gates.
