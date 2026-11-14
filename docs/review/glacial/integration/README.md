# 5M · Default-book integration and chrome

**Status:** the default route opens on _From V to U_ in the tilted book stage, joined to the live glacier
runtime (5J), the production scene (5K) and the lesson (5L). The water lesson is spread 2; the research route
stays (contents list). Decision record: DECISIONS.md, D-W5-5M.

## How it fits together

| Piece                                          | What it does                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `uplift/book/src/app/glacial.worker.ts`        | The book's glacier Worker: `installGlacialWorker(self)` (WebGPU where 5I parity and the device check pass).    |
| `uplift/book/src/app/glacial-spread.ts`        | The reader controller: owns the `GlacialHost`; page turns settle it, dispose the scene, and remount on return. |
| `uplift/book/src/app/glacial-live-source.ts`   | `viewFrame()` → figure, notes, lens; `comparison()` → ghost; every reader action → `host.dispatch`.            |
| `uplift/book/src/scenes/glacial/source.ts`     | The scene's one source interface; the review route's recorded runs implement it too (R1 behaviour kept).       |
| `uplift/book/src/scenes/glacial/review.ts`     | The 5K scene, now rendering 5L's words through the spread's probes (`BindingEngine` over `uValleyProbes`).     |
| `uplift/book/src/reader/shell.ts`, `shell.css` | Stage spreads (`layout: "stage"`), the bottom bar, contents, contrast, reading level, running heads.           |
| `e2e/glacial-book.spec.ts`                     | The full reader journey on the default route, phone, reduced motion, navigation while running, axe.            |

## The journey, as tested (`e2e/glacial-book.spec.ts`)

| Step                    | Reader action                             | Checked                                                                                  |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Open                    | `/`                                       | Tilted stage, h1 _From V to U_, live run at model time 0, bar, running heads, folios 1–2 |
| Transition              | (automatic)                               | `data-transition` running → done; canvas visible                                         |
| Pick rock (page)        | Shale radio                               | Live rock shale; an unadvanced run is replaced, nothing kept                             |
| Play                    | Play, then Pause                          | Model time ≥ 40 model years from the live model; notes in shale                          |
| Scrub back              | Recorded-time slider, Home / →            | "Earlier moment"; note "an earlier moment of this run"; 20 model years                   |
| Return to live          | Back to the latest moment                 | Live view, time back at the head                                                         |
| Slide the cut           | Front face slider ← →                     | Grid column 51 ↔ 50 (one cell per arrow; default from the spread config)                 |
| See under the ice       | Checkbox                                  | Text alternative says the ice is hidden; notes unchanged (view-only)                     |
| Second rock (specimen)  | Drag granite onto the block               | New run; shale kept and compared; granite radio checked                                  |
| Compare at matched time | Scrub to 40 model years                   | Compare note "a separate run with another rock, shale, at 40 model years"; lens ghost    |
| Change level            | University level                          | Same run id, same model time, same ghost; b in notes; Step; deeper panel with 4 graphs   |
| Turn the page and back  | While playing: next, then previous        | Water lesson; back: same run, kept run and ghost, still playing, time not behind         |
| Reset                   | Start again → Remove them and start again | Inline confirm; model time 0, sandstone, no ghost; focus back on Start again             |

Also: phone 390 × 844 (flat page, rock choice, play, bar to the water lesson and back, no horizontal scroll),
reduced motion (flat, no running animations, contrast as a book setting), and a serious/critical axe audit.

## Results (this machine, 2026-11-12)

| Check                                                 | Command                                                                                                    | Result                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Typecheck, lint, format, unit tests                   | `pnpm check`                                                                                               | pass: 699 tests passed, 7 skipped                      |
| Production build                                      | `pnpm build`                                                                                               | pass                                                   |
| Bundle budget                                         | `pnpm check:bundle`                                                                                        | pass: 6 683 214 / 10 000 000 bytes                     |
| Browser regression suite (bundled Chromium, CPU path) | `pnpm exec playwright test`                                                                                | pass: 72 passed, 4 skipped (WebGPU-only runtime tests) |
| Journey and 5J runtime in installed Chrome (WebGPU)   | `UPLIFT_E2E_CHANNEL=chrome pnpm exec playwright test e2e/glacial-book.spec.ts e2e/glacial-runtime.spec.ts` | pass: 16 passed                                        |

In installed Chrome (Intel Arc 140V) the default book picked **WebGPU** (deeper level: "Solver: webgpu") and
reached 100 model years in about 10 s at 1×, the scheduled 10 model years per second. Bundled Chromium has no
adapter, so the same route runs on the labelled CPU, as 5J documented.

## Captures

From `capture.mjs` (bundled Chromium, CPU path). `results.json` holds each capture's rock, ghost, model time,
cut column, margin notes and text alternative.

| Capture                                                                                                                     | What it shows                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [desktop-1440-transition.png](desktop-1440-transition.png)                                                                  | The drawing → ink → colour transition, mid-way                          |
| [desktop-1440-open.png](desktop-1440-open.png)                                                                              | The default route at rest: live run 1, sandstone, model time 0, the bar |
| [desktop-1440-contents.png](desktop-1440-contents.png)                                                                      | Contents: both lessons and the research route                           |
| [desktop-1440-shale-played.png](desktop-1440-shale-played.png)                                                              | Shale after play, paused at the live head                               |
| [desktop-1440-compare-matched.png](desktop-1440-compare-matched.png)                                                        | Granite at a recorded time with the shale ghost at the same time        |
| [desktop-1440-university.png](desktop-1440-university.png) · [desktop-1440-deeper-panel.png](desktop-1440-deeper-panel.png) | University level; the deeper level with bound parameters and graphs     |
| [laptop-1366x768-open.png](laptop-1366x768-open.png)                                                                        | Short laptop                                                            |
| [phone-390-open.png](phone-390-open.png) · [phone-390-full.png](phone-390-full.png)                                         | Phone: flat page with the bar                                           |
| [reduced-motion-1366.png](reduced-motion-1366.png) · [reduced-motion-1366-contrast.png](reduced-motion-1366-contrast.png)   | Reduced motion; more contrast                                           |
| [desktop-1440-water-spread-2.png](desktop-1440-water-spread-2.png)                                                          | The water lesson as spread 2                                            |

## GV rows

- **GV1** (rock → new run; selector and specimen): the page radio and the specimen drop both call the source's
  `chooseRock` → `{ kind: "choose-rock" }`; tested in the journey (shale by radio, granite by drop).
- **GV2** (play/pause/step, scrub, return to live, compare at matched model time): journey steps 4–10; unit
  test `glacial-live-source.test.ts` (ghost at the same recorded time).
- **GV4** (drawing → ink → colour on a tilted book page): default route, tilted stage, transition state checked;
  reduced motion and phones use the flat page with a crossfade.
- **GV5** (notes, caption, face, ghost, explanation on the same run, time and config): one source; measures
  from the drawn snapshot (`createFrameMeasures`), bindings fed from it; unit test compares the source's section
  with the model probe on the host's own frame.
- **GV6** (keyboard, text alternatives, reduced motion, lithology patterns, reflow): every gesture has its
  control (radio, slider, checkbox, R2 sliders); live text alternative from 5L templates; axe audit; phone and
  320 px reflow in `book-acceptance.spec.ts`.
- **GV7** (default book, water spread, research route, privacy): water is spread 2; research via contents;
  the instrumentation and research specs pass unchanged.
- **GV9** (CPU/GPU): the book runs auto selection (WebGPU by the 5I record and per-device check, else the
  labelled CPU). Playwright's bundled Chromium has no adapter and runs CPU; see the PR for the installed-Chrome
  run.

## Not done

- No human, screen-reader, classroom or hardware check. Automated passes do not close those gates.
- The contour lesson leaves the default sequence (code and evidence kept); recorded as D-W5-5M item 1.
- The R2 view-controls strip stays a row of labelled sliders (frozen at R1); only its styling is quieter.
