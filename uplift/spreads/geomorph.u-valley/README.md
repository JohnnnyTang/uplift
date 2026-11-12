<!-- expert-review -->

# From V to U — lesson content (session 5L)

Lesson 1 of the default book. Content only: the scene is 5K's, the runs and timeline are 5J's, the
integration into the tilted book is 5M's. Nothing here simulates; every number on the page is a binding.

| File                             | What it holds                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.hs.md`, `page.uni.md`      | The left page's two or three sentences, per reading level.                                                                                                            |
| `flap.hs.md`, `flap.uni.md`      | The answer under the flap (always openable; the prediction never gates it).                                                                                           |
| `deeper.uni.md`                  | The deeper level: mechanisms, bound parameters, run-graph reading, what the notes measure, overdeepening.                                                             |
| `teacher-notes.md`, `sources.md` | Teacher notes; sources and their verification status.                                                                                                                 |
| `lesson.ts`                      | Lesson and figure numbers (data), title, key words, prediction, margin challenge, caption, Fig. 1 labels, rocks, margin notes, text alternatives, ignores, equations. |
| `bindings.ts`                    | The declared probes (the host contract for every bound value).                                                                                                        |
| `config.ts`                      | R1 view defaults: default front face, note averaging and rounding, overdeepened-note threshold.                                                                       |
| `claims.ts`                      | Machine-readable claim/source register; prose register in `docs/science/glacial/lesson/README.md`.                                                                    |
| `content.ts`, `spread.ts`        | Assembly; the `ReaderSpread`, validated at import.                                                                                                                    |
| `lesson.test.ts`                 | Schema, bindings, claim register against the registered results, view defaults against the captures, copy budgets.                                                    |

## Contract for 5K and 5M

- **Numbers.** Shell composes "Lesson " + `LESSON_NUMBER` and "Fig. " + `FIGURE_NUMBER`; text never carries
  them. Every other value comes from a probe in `bindings.ts`. `glacier-section` values are the section
  averaged over `noteColumns(cut)` (D-W5-R1 item 9) with lengths passed through `roundForNote()`.
- **Margin notes.** `marginNotes` templates, each with a `when` condition: `always`, `past-view` (scrubbed
  to a recorded earlier moment), `face-under-ice`, `face-below-snout`, `kept-run` (a kept run is compared),
  `overdeepened` (`adverseRiseDownValleyM ≥ U_VALLEY_VIEW.overdeepenedNote.minAdverseRiseM`, on the
  averaged floor). `levels` says at which reading level a note shows.
- **Default front face.** `resolveDefaultFrontFace(manifest)` gives the grid column and the last snapshot
  index for each run; it throws if the grid does not fit. A display choice; claims rest on
  `U_VALLEY_VIEW.registeredSectionColumn`.
- **Fig. 1 labels.** `figure.labels`: words and the feature each points at (valley head, glacier, snout,
  U-shaped valley, V-shaped valley, valley floor). Words only.
- **Text alternatives.** `textAlternatives` templates for the scene's live region; `figure.drawingAlternative`
  for the static drawing.
- **Comparison.** Always "a separate run with another rock" (`controlsCopy`, `marginNotes`, `textAlternatives`).
