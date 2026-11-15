<!-- expert-review -->

# Where plates meet: science and art brief (session 7A)

Lesson 2 of the book ([wave plan](../../plan/stage-1-wave-7-plates.md), owner decisions D-L2-1). This
folder is the scientific basis for the authored boundary relief that 7C builds and the copy that 7E writes.

**Tier: illustration.** Under the owner's scoped exception (D-L2-1, decision 2) the landforms in this
lesson are **authored, not simulated**. They are procedural shapes drawn from cited real examples. Nothing
here is a process model, nothing forms in the scene, and no scene value may be printed on the page as a
fact. "No invented science" still applies: every real-world figure has a source, and every value chosen
for legibility is labelled **ARTISTIC CHOICE**.

| File                                              | What it holds                                                                                                                                      | For        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [reference-landforms.md](reference-landforms.md)  | One real example per boundary: the Himalaya and Tibet, the East African Rift, the San Andreas at Wallace Creek                                     | 7C, 7E     |
| [parameters.md](parameters.md)                    | The parameter table (38 rows, each cited or labelled), the formulas, the Airy root derivation, the front-face crust geometry, the snapshot mapping | 7B, 7C, 7R |
| [parameters.json](parameters.json)                | The same table, machine-readable, for 7C's typed config                                                                                            | 7C         |
| [claims.md](claims.md)                            | Claim register (school and university, sources, expert-review) and the draft "What this shows / ignores"                                           | 7E, 7G     |
| [sources.md](sources.md)                          | Every reference, with what this session actually read                                                                                              | all        |
| [Storyboard](../../review/plates/brief/README.md) | The starting landscape and each boundary at stage 0, 0.5 and 1 with the front face, drawn from `parameters.json`                                   | owner, 7R  |

## The starting landscape

One seeded continental block, about 160 km square, shared by all three boundaries (stage 0 is identical
for each):

- **Surface.** Rolling lowland at about 400 m, tilted gently down to the right so streams have a
  direction. Ridges 20 km apart and 1,500 m crest to trough (raised from 7A's 500 m at the look review, D-W7-7R) and stream valleys run left to right across
  the block, so they cross the boundary nearly at right angles. Each valley has a shallow channel for the
  stream dressing. A little seeded noise breaks up the regularity.
- **Boundary.** A straight line from the back of the block to the front, through the middle. The front
  face cuts across it.
- **Front face and walls.** Three flat rock layers (sandstone, shale, limestone; 600 m each, drawn with the
  surface's vertical exaggeration) over crystalline crust; a crust band of uniform thickness (35 km) with a
  flat base; mantle beneath, down to a fixed block base.
- **Scales.** Heights and rock layers ×4; crust depths compressed to ×0.75 (the root keeps its Airy
  proportion to the crust). Both are artistic choices, bound into the page (decision D-W7-7A).

## Per boundary, stage 0 → 1

| Boundary   | Surface                                                                                                                                                  | Front face                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Convergent | A range rises along the boundary and widens from 40 to 80 km; crest about 5,500 m, peaks to about 7,500 m; snow above 5,700 m near stage 1               | Layers bend up with the range; the crust thickens into a root 5.6 times as deep as the range is high |
| Divergent  | A 50 km rift sinks between three stepped fault scarps per side; floor down 1,500 m, shoulders up 600 m (D-W7-7R); ridges and streams drop with the floor | Layers drop in steps at each fault; the crust thins from 35 to 25 km beneath the rift                |
| Transform  | The two sides slide in opposite directions (right-lateral) until crossing ridges and streams are offset by 8 km                                          | Unchanged                                                                                            |

## Guardrails this brief answers

- The illustration label and the authored-shapes disclosure are drafted in [claims.md](claims.md).
- Every figure the page may cite is in the real-world column of [parameters.md](parameters.md) or the
  register, with a source. Scale and exaggeration are bound, never typed.
- The formulas are deterministic (seeded noise, no `Math.random()`), continuous in the stage, and give an
  identical stage 0 for all three boundaries.
- Continental settings only; no erosion; no "run", "model time" or years tied to the stage.
