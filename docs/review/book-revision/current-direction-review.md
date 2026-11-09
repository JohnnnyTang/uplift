# Current branch review and owner correction · 2026-11-09

## Reviewed baseline and scope

Fetched origin/main (8069a7f), origin/s1/w5/5e-migration (39ab5fb), and
origin/s1/w5/5bcd-lead (e7e7f0a). The latter contains B/C/D, E and F; reviewed
in the isolated s1/w5/current-review worktree. Main was already up to date and
was not merged with the review branch. This supersedes the prior unmerged
scene-direction draft, which had only inspected 5A.

Inspected production scene, material, geometry, shell, routes and contracts;
reviewed committed F screenshots and a fresh default-water smoke capture. This
is a product/implementation gap audit, not a claim of exhaustive bug review or
new human testing. No production code is changed by this review.

## Required corrections

| Priority | Finding and evidence                                                                                                                                                                                                                                                                                      | Required correction                                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Opening selection remains hardwired to contour/source lessons in [entries.ts](../../../uplift/book/src/scenes/entries.ts), [content.ts](../../../uplift/book/src/scenes/content.ts). This contradicts the new first-lesson choice.                                                                        | Discuss the U-shaped-valley scene, then replace the opening adapter/content. Retain old examples and their evidence as useful fixtures or secondary lessons, without pretending they are the chosen opening.                                        |
| P1       | [materials.ts](../../../hachure/ink/src/view/materials.ts), createTerrainMaterial, fills an unlit surface with paper plus water/sediment tint. [Raised evidence](acceptance/raised-desktop.png) and the fresh [water capture](current-water-review.png) remain visually dominated by lines and wet marks. | Introduce legible complete terrain/ice objects, natural material colours and illustrative depth cues. Contours optional. Reuse geometry/renderer facilities where suitable; a material change alone will not supply glacier geometry or processes.  |
| P1       | [geometry.ts](../../../uplift/book/src/scenes/geometry.ts) disables erosion and supplies prepared channels; [water-driver.ts](../../../uplift/book/src/scenes/water-driver.ts) wraps the hydraulic host. The current hachure sources contain no glacial flow/erosion implementation.                      | A shared, scientifically supported glacial process capability is missing. Reopen that bounded scope after scene agreement. Do not relabel water as ice or prescribe the final U shape. Existing water evidence does not validate glacial formation. |
| P2       | [playable-scene.ts](../../../uplift/book/src/scenes/playable-scene.ts), lift(), directly changes exaggeration; the principal interaction teaches the lifting itself. Its contour/water union and [reader contracts](../../../hachure/runtime/src/reader/contracts.ts) encode the old scene choices.       | Make the entrance a short artistic transition, independent of the lesson interaction. No exact mapping/projection proof is needed. Extend scene-specific APIs only once the agreed glacier interaction needs it; retain the controller lifecycle.   |
| P2       | [book-acceptance.spec.ts](../../../e2e/book-acceptance.spec.ts) verifies lift values, wet SVG paths, paging and state, with saved screenshots. Those checks can all pass without the owner's desired scene.                                                                                               | Preserve regression checks, add evidence for the agreed complete scene and its process consequence. Do not interpret old PB3 mechanics as acceptance of the new lesson. No need for frame-by-frame geometric correspondence.                        |
| P2       | The fresh [water capture](current-water-review.png) shows a small illustration above several technical labels; model/time disclosure is repeated and much of the spread is empty.                                                                                                                         | Recompose around the geographical scene. Consolidate essential limitations and disclose cell thresholds/technical readouts in depth. Keep readable text and existing reflow behavior; do not merely enlarge everything until it clips.              |

These are gaps against the updated brief, not retroactive claims that B/C/D/E failed
the briefs they were given. No new runtime correctness failure was found by the
checks below; that is not a guarantee that no defect remains.

## Work to retain

- B: independent play/reveal, authored initialization, settlement, retained real model
  state, backend comparison safeguards and accessibility lifecycle.
- C: bounded responsive reader, keyboard navigation, gesture arbitration, page turns,
  focus, reflow and reduced-motion paths.
- D: public Ink interaction facilities, bindings, real solver integration and honest
  narrow evidence. Keep contour tools available without making them mandatory.
- E: production default/research routing, retained return state and research provenance.
- F: regression coverage, viewport evidence, explicit pending human/science/hardware
  gates. Reassess product criteria for the chosen lesson; preserve historical results.

## Follow-up: combined interaction selected

After this review the owner chose both intervention and time-based observation and
requested planning. [Wave 5 sessions 5G–5N](../../plan/stage-1-wave-5-glacial.md) are
now the active plan. The discussion-only wording below records this review's original
state, not a current hold. Its findings and baseline test outcomes are unchanged.

## First-lesson discussion at review time

Preferred subject: formation of a U-shaped valley. A textbook line illustration
transitions into a compact, naturally coloured mountain valley with a glacier.
Focus on one causal idea: how glacial erosion changes the valley's cross-section.
The transition can use an ordinary reveal, morph or fade; it is not a science project.

<!-- expert-review -->

Valley glaciers can widen and deepen river-cut valleys into broad U-shaped troughs.
Sources: [NPS U-shaped valleys](https://www.nps.gov/articles/ushapedvalleysfjordshangingvalleys.htm),
[NPS Yosemite geology](https://www.nps.gov/yose/learn/nature/geology.htm).
These establish the topic, not a calibrated erosion law or implementation validation.

Proposed presentation for discussion: watch the same short valley reach evolve;
an optional hide/show-ice action exposes the actual underlying bed and a transverse
section. This is an X-ray-style visibility change, not instantaneous melting.
Use natural rock/soil and white/blue ice, with a simple book around it. Avoid adding
moraines, fjords, hanging valleys or a whole climate system to this first page.

The owner has chosen the subject; the main physical intervention, scope of time,
model law and evidence requirements are still for discussion. Do not assume an ice
thickness slider maps directly to erosion without the chosen model supporting it.
No glacial implementation or replacement session schedule is started here.

## Fresh verification

Against e7e7f0a in this checkout:

- Locked dependency install succeeded without lockfile changes.
- pnpm check passed: typecheck, lint, format and 58 files / 503 tests.
- Production build passed; existing large-chunk advisory remains.
- Existing app smoke suite: 8/8 passed in installed headless Chrome, covering
  default/research routes, independent play/reveal, retained state, CPU/flat/WebGPU
  route smoke, phone flow, graphics loss and interrupted research lift.
- Inspected the fresh smoke screenshot saved as current-water-review.png; historical
  acceptance screenshots/results were not overwritten.
- Original owner reference copies verified by SHA-256 against uploaded files.

Full browser/GPU suites were not rerun in this review. The earlier F packet records
52 browser and 68 GPU tests; those remain historical results, not this run's claims.
No expert, first-time-reader, screen-reader listening or hardware pass is inferred.

## Handover

Done: branch review, direction corrections, original reference preservation,
updated acceptance/status notes and verification. Not done: agreed glacier interaction,
replacement implementation plan, glacial model or new scene. Surprise: the fetched
B/C/D branch already contains E and F. Plan-changing fact: a glacial opening requires
new process capability; the current wave's no-new-physics restriction is superseded
for this selected lesson. The existing shell/runtime need not be discarded.

This review owns direction/plan/review docs, references and appended decisions.
AGENTS receives a minimal colour/transition correction because its previous rule
contradicted the explicit owner instruction. No solver or scientific results change.
