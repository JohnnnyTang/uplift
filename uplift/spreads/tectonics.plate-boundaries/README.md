<!-- expert-review -->

# Where plates meet — lesson content (session 7E)

Lesson 2 of the default book. Content only: the scene is 7D's, the authored sequences are 7C's, the book
integration is 7F's. **The figure is an illustration** (owner exception D-L2-1): the boundary shapes are
authored from real examples and never claimed to form in the scene. Nothing here is simulated; every
number the illustration configures is a binding, and every real-world figure is a cited fact.

| File                             | What it holds                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.hs.md`, `page.uni.md`      | The left page's three sentences, per reading level.                                                                                                                                      |
| `flap.hs.md`, `flap.uni.md`      | The answer under the flap (always openable; the prediction never gates it).                                                                                                              |
| `deeper.uni.md`                  | The deeper level: cited real examples, crust thicknesses, isostasy, real time scales (framed as not in the drawing), how the drawing is scaled.                                          |
| `teacher-notes.md`, `sources.md` | Teacher notes; sources and the limits of their use.                                                                                                                                      |
| `lesson.ts`                      | Lesson and figure numbers (data), title, key words, prediction, boundaries (names, glyphs, help), stage words, control words, Fig. 2 caption, label line, text alternatives, disclosure. |
| `bindings.ts`                    | The declared probes: the host contract for every bound value (D-W7-7E).                                                                                                                  |
| `claims.ts`                      | Machine-readable claim register and cited-figure register; prose register in `docs/science/plates/lesson/README.md`.                                                                     |
| `content.ts`, `spread.ts`        | Assembly; the `ReaderSpread`, validated at import (static geometry: no clock).                                                                                                           |
| `lesson.test.ts`                 | Schema, bindings, claim register, honesty rules, copy budgets.                                                                                                                           |

## Contract for 7D and 7F

- **Numbers.** The shell composes "Lesson " + `LESSON_NUMBER` and "Fig. " + `FIGURE_NUMBER`. Every other
  value comes from a probe in `bindings.ts`, in 7D's request kinds (D-W7-7D): `plates-config` (a
  `PLATES_RELIEF_CONFIG` field by dotted path) and `plates-scene` (`boundaryName`, `stageLabel`,
  `viewedNames`, `scaleBarLabel` as strings; `blockWidthKm` as a number). `scaleBarLabel` is the one field
  7E adds to 7D's list.
- **Label line.** `figure.label` is the page's one label line, and the spread's visible tier label.
  `spread.tier` is `"illustration"` (added to the schema in 7F, D-W7-7F); no model-tier badge is shown.
- **Boundaries.** `boundaries` in picker order with `name`, `glyph`, `glyphLabel`, `motion`, `help` and
  `example`. The host serves `name` as `{{probe.boundaryName}}`; ghost labels use `name` and `glyph`.
- **Stage.** The scrubber shows `controlsCopy.stageEarly` → `controlsCopy.stageLate` only; its spoken
  value is `controlsCopy.stageValue` with `{{probe.stageLabel}}` = `stageWords[stageWordFor(stage)]`.
- **Text alternatives.** `textAlternatives.start` before a choice, `textAlternatives.boundary[key]` after,
  `ghosts` when ghosts show, `scale` once per view; `figure.drawingAlternative` for the static drawing.
- **Disclosure.** "What this illustration shows and leaves out" (`controlsCopy.disclosureHeading`):
  `shows[level]`, then `page.ignores[level]`.
- **Deeper level.** `deeperText` and `pageContent.equations` at university level only. It types cited
  real-world figures; each is registered in `citedFigures` with its claim.
