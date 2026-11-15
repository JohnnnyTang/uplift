# Lesson 2 production scene: captures (session 7D)

_Where plates meet_ on lesson 1's tilted book stage, mounted in the reader shell as 7F will mount it
(`e2e/fixtures/plates-scene.html`). ILLUSTRATION: the shapes are authored (D-L2-1). Regenerate with
`node uplift/book/src/scenes/plates/review/capture.mjs` (SwiftShader; `--gpu` for the machine's GPU).
`captures.json` lists every file with the scene's state and its live text alternative.

The left page shows 7D's placeholder copy until 7F passes 7E's lesson copy.

| File                                                                                  | What it shows                                                                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `drawing-static.png`                                                                  | Fig. 2, the flat drawing (the static fallback), with the enlarged front face                             |
| `transition-ink.png`                                                                  | The transition: the block rising in ink over the fading drawing                                          |
| `start.png`                                                                           | The starting landscape, no boundary chosen; neutral double arrows invite a drag                          |
| `convergent-stage-05.png`, `convergent-stage-1.png`, `convergent-stage-1-block.png`   | Range, snow, cover layers bent up, the root                                                              |
| `divergent-stage-1.png`, `divergent-stage-1-block.png`                                | Rift: inked scarps with ticks, lakes on the floor, layers stepped down, thin crust                       |
| `transform-stage-1.png`, `transform-stage-1-block.png`, `transform-stage-1-above.png` | Ridges and streams offset at the fault, default camera and from above                                    |
| `ghosts-stage-075.png`                                                                | Divergent with convergent (dotted) and transform (dash-dot) ghosts, labelled on the block and in the key |
| `phone-convergent.png`                                                                | Phone, one readable page                                                                                 |
| `reduced-motion.png`                                                                  | Reduced motion: flat page, the stage steps in quarters                                                   |
| `university.png`                                                                      | University level: words change, the scene does not                                                       |

Owner requirement (2026-11-15), transform legibility: no trees within 16 km of the boundary and 0.03 density
elsewhere, streams in every valley that crosses the boundary, and fault-scarp ink for the rift; see the
three transform captures and `divergent-stage-1-block.png`.

Frame time during continuous play (dev laptop GPU, `review/perf.mjs <boundary> gpu`): display-rate frames
(median 8.3 ms, p90 8.5 ms, p99 25–33 ms); 101 block rebuilds from early to late, median 26 ms each.
