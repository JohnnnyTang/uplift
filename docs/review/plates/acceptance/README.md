# 7G · Acceptance ledger: the two-lesson book (_From V to U_, _Where plates meet_)

**Walked:** 2026-11-15 on the default app (the production build, `vite preview`, default route), on branch
`s1/w7/7g-plates-acceptance`: base `27f033c` (main with all of Wave 7 merged) plus this session's code commit
`9b55f23`. **Device for every row:** Windows 11 Home 10.0.26300, Intel Core Ultra 7 258V, Intel Arc 140V GPU;
browsers driven headless by Playwright at the stated viewports (1× device scale unless a capture says 2×):

- **Automated rows:** Playwright 1.65's bundled Chromium on SwiftShader (no WebGPU adapter, so lesson 1 runs its
  labelled CPU worker and lesson 2 draws through WebGL 2). These are the e2e results below.
- **Captures and video:** installed Chrome 157.0.8103.78 with WebGPU on the Arc 140V (adapter "intel xe-2lpg").
  See [`results.json`](results.json) for each capture's backend and book transform.

Decision record: DECISIONS.md, **D-W7-7G** (the owner's 7G decisions, session decisions, defects fixed).

Statuses: **pass** (automated evidence on the default app); **pass with note** (passes, with a recorded caveat);
**fail → fixed** (found and fixed here, and the evidence now passes); **pending-human**, **pending-hardware** (never
inferred from screenshots or tests). An automated pass never closes a human, expert or hardware check. 6B → 6C →
6D take over every pending check; no code work is passed to them.

## Owner decisions in 7G (D-W7-7G)

| Item                                       | Status                    | Evidence                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 · Ghost labels off the face, inside page | done · pending owner look | `plates-acceptance.spec.ts` › "D-W7-7G owner item 1 …": at 1440 × 900, 1920 × 1080, 1366 × 768 and 390 × 844 every key entry lies inside the figure page and below the front face, and its leader runs from the profile to the entry. Captures `d1-*` against `before/` ([owner packet](owner-scene-review.md) §1) |
| 2 · Higher default block view, tilt 48°    | done · pending owner look | "D-W7-7G owner item 2 …": book `rotateX(48deg)`, View height 42°, top-to-face ratio > 1.7 (1.2–1.4 untipped, 2.0–2.2 with the 12° tip). Captures `d2-*`, `pl3-transform-late-2x.png`, video `journey-turn-transform.webm`                                                                                          |
| 3 · No rift lakes                          | pass (verified, kept)     | `dressing.test.ts` › "draws no lakes in the production look …"; capture `pl3-divergent-late-2x.png`                                                                                                                                                                                                                |

## PB1–PB9: the two-lesson book (PB7 in its original form, D-L2-1 decision 6)

| Row | Required result (abridged)                                                                                                  | Status                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PB1 | Spread and navigation fit 1366×768 and 1440×900 without lesson scrolling; illustration primary                              | **pass with note** · **fail → fixed** (lesson 1, flap open, ran off the desk)                       | Lesson 2: "PB1 PB4: lesson 2 fits …" (no page scroll, spread on the desk, column not scrolling, picker on screen). Lesson 1: `glacial-acceptance.spec.ts` › "PB1 …". Note: at ≤ 1440 × 900 the book is drawn small (owner's O1, accepted D-W5-5N2); the book changes size at the turn at 1440 (F1). Fix: captures `a-1440-lesson1-uni-flap.png` |
| PB2 | Phone single page; 200 % zoom / 320 px reflow readable                                                                      | pass · pending-human (legibility, real browser zoom)                                                | "PL7 PB2: phone, 320 px reflow …" (390, 320, 683 × 384: flat, no sideways scroll); `plates-book.spec.ts` › "phone: …"; lesson 1: `book-acceptance.spec.ts`; capture `d1-390x844-transform-ghosts.png`                                                                                                                                           |
| PB3 | Drawing → artistic transition → complete 3D scene; keyboard and reduced motion equivalent                                   | pass · pending-human (spatial reading)                                                              | "PL6: Replay the drawing …"; "PB7 PL8: lesson 1 turns …" (the turn runs the transition); video `journey-turn-transform.webm`; lesson 1: `glacial-acceptance.spec.ts` › "PB3 GV4 …"                                                                                                                                                              |
| PB4 | Immediate play: no answer, setup or logging gate                                                                            | pass · pending-human (a first-time reader finds the picker and Play)                                | "PB1 PB4 …" (picker works with no prediction chosen); "PL1 …"; lesson 1: `glacial-acceptance.spec.ts` journey                                                                                                                                                                                                                                   |
| PB5 | One claim and one gesture per spread; consequence and descriptions match the rendered state                                 | pass · pending (expert sign-off)                                                                    | Lesson 2: one claim (plate boundaries shape the land), one gesture (choose a boundary); no gauges; the text alternative is built from the shown state ("PL4 PL5 …", "PL7 …"). [Expert packet](expert-review.md). Lesson 1: 5N ledger                                                                                                            |
| PB6 | Question skippable, answer immediate, nothing gates                                                                         | pass                                                                                                | "PB6: the prediction can be skipped …"; lesson 1: `glacial-acceptance.spec.ts` › "PB6 …"                                                                                                                                                                                                                                                        |
| PB7 | Two working spreads, real page turn, previous/next and keyboard, guarded gestures, return state, focus, reduced-motion turn | **pass** (original form restored) · pending-human (listening, gesture usability)                    | "PB7 PL8: lesson 1 turns to lesson 2 …" (PageDown, focus on the title, same tilt) and "PB7 PL8 PL9: turning back …" (PageUp, same run and rock, focus); `plates-book.spec.ts` › "the book has two lessons …", "the journey across both lessons …", "navigation while lesson 1 is running …", "reduced motion: the turn …"                       |
| PB8 | Owner review, first-time readers, listening, science sign-off, hardware: explicit                                           | **pending-human**                                                                                   | [Owner packet](owner-scene-review.md) (7G decisions, F1, F2); [expert packet](expert-review.md); no participants, listening, expert or other hardware recorded                                                                                                                                                                                  |
| PB9 | Intervene and observe formation over time (defined for the U-valley lesson)                                                 | pass (lesson 1) · lesson 2: not applicable by owner decision (D-L2-1 decision 8: no model, no runs) | Lesson 1: `glacial-acceptance.spec.ts` journey, unchanged and green; lesson 1's run, rock and kept run survive the turns (`plates-book.spec.ts` journey). Lesson 2's reader loop (pick, play or scrub, compare ghosts) is PL1–PL2                                                                                                               |

## PL1–PL9: lesson 2 (wave plan §5)

| Row | Required result (abridged)                                                                               | Status                                                                                                    | Evidence                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PL1 | Picker or dragged plate arrow shows that boundary's sequence from the shared start                       | pass                                                                                                      | "PL1: the picker, a dragged plate arrow and the arrow keys …" (stage 0 after each choice); `plates-scene.spec.ts` › picker, arrow drag, arrow keys; 7C: stage 0 identical for all three (unit)                                                                                                              |
| PL2 | Play, pause and scrub a stage with no model time or years; viewed boundaries as labelled ghosts          | pass                                                                                                      | "PL2: play, pause and scrub early → late …" (stage holds when paused, "early"/"late" only, no run/time/year words, ghosts with glyph, sample and leader); `plates-book.spec.ts` journey                                                                                                                     |
| PL3 | Range, rift with scarps and transform offset recognisable at page size; follow the 7A table              | **pass with note** · pending-human (owner judgement at laptop size, F2)                                   | Captures `pl3-*-late-2x.png`, `d2-*`; 7C relief tests (monotone range and root, rift deepens, transform offset grows with relief and crust unchanged); 7R approved the look. Block outline about 260 px wide at 1440 × 900 (190 before 7G), 180 px at 1366 × 768, 450 px at 1920 × 1080                     |
| PL4 | Front face: root under the range, thinner under the rift, unchanged at the transform                     | pass                                                                                                      | "PL4 PL5 …" (the text alternative names each crust change at late); captures `pl3-*-late-2x.png`; 7B crust-band and 7C crust tests (unit)                                                                                                                                                                   |
| PL5 | Illustration label, authored-shapes disclosure, no computed-looking numbers, cited figures, expert marks | pass · **fail → fixed** (one school sentence implied formation) · pending (expert sign-off)               | "PL4 PL5 …" (one label line, no tier badge, "authored" and "do not form in the scene" at both levels, no run/simulation/time/year words, expert-review mark in the DOM); 7E `lesson.test.ts` (typed figures only from the cited register; register fresh, 214 sentences); [expert packet](expert-review.md) |
| PL6 | Drawing → ink → colour into a naturally coloured block on the tilted page, reusing lesson 1's stage      | pass · pending owner look of the 12° tip                                                                  | "PL6: Replay the drawing …" (running → done on the tilted page, state kept); "PB7 PL8 …" (tilt 48° on both); video; captures                                                                                                                                                                                |
| PL7 | Keyboard, text alternatives, reduced motion, glyph and pattern cues, reflow and phone                    | pass · **fail → fixed** (live reduced motion; fixture wording) · pending-human (listening, colour vision) | "PL7: the keyboard alone …" (radios, End/Home, Space, front-face slider); "PL7 PB2 …"; `plates-book.spec.ts` › axe audit, reduced motion, drawing only; `plates-scene.spec.ts` › static fallback now "Drawing only: …"                                                                                      |
| PL8 | Real page turn, contents, deep links; lesson 1 state preserved; research route retained                  | pass                                                                                                      | "PB7 PL8 …" (both tests); `plates-book.spec.ts` › "the book has two lessons …" (contents, deep link, history, research route), journey (run, kept run, model time; no hidden advance)                                                                                                                       |
| PL9 | Reuse: no heavy spread code; lesson 1 and engine behaviour unchanged; new primitives recorded            | pass with note                                                                                            | Lesson 1's suites pass (`glacial-*`, `book-acceptance`, `smoke`, `university`, `science`, `comparison`). One lesson-1 CSS rule added (flap open only, layout). One generic engine option added and recorded (`pitchDeg`, D-W7-7G; lesson 1 passes none). The spread package holds content only              |

## Defects found and fixed here

1. **Lesson 1 ran off the desk with its flap open** (1440 × 900 and 1366 × 768, both levels; 7F's surprise 3).
   `uplift/book/src/scenes/glacial/review.css`: with the flap open only, the column grows as far as the tilted
   book fits and then scrolls inside the page, as lesson 2's does. Measured: spread bottom 1045 → 792 px against
   the desk's 806 at 1440 × 900 (university), 891 → 673 against 674 at 1366 × 768.
2. **Lesson 2's left page kept lesson 1's empty notes column** (7F's handover). `plates.css`: one column. The
   text uses the page's measure (under about 75 characters), the spread is shorter, the book fits at 0.75 at
   1440 × 900 (was 0.55) and at 1920 × 1080 both lessons' spreads are 830 px, so the turn no longer resizes the
   book there.
3. **Ghost labels over the front face, clipped at the page edge** (owner item 1). `scene.ts`, `plates.css`: the
   key under the face with leaders.
4. **The 7D fixture's static view said "Simplified view: …"** (7F's surprise 4). `e2e/fixtures/plates-scene.ts`
   now mounts lesson 2 with the book's wording; `plates-scene.spec.ts` checks it.
5. **Reduced motion turned on mid-session kept continuous play** (found by the acceptance spec). `scene.ts`
   follows the media setting live.
6. **"Press Play to see the landform it makes"** read as the landform forming in the scene (guardrail 1).
   `page.hs.md` now says "the drawing shows its landform from early to late"; the register is regenerated.

## Known issues checked (from 7F's handover)

| Issue                                                           | Disposition                                                                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Lesson 1, university level, flap open, off the desk at 1440 | fixed (defect 1)                                                                                                                                   |
| (b) Whole book at minimum scale at 1440 × 900                   | improved for lesson 2 (0.75, defect 2); lesson 1 unchanged at 0.60 (O1, accepted). PL3 judged honestly at laptop size: pass with note, F2 to owner |
| (c) Book size changes at the turn at 1920 × 1080                | fixed at 1920 (equal spread heights). At 1440 the book now grows at the turn (0.60 → 0.75); recorded as F1; owner accepted as is (2026-11-16)      |
| (d) Lesson 2's left page uses about 60 % of its width           | fixed (defect 2)                                                                                                                                   |
| (e) The plates-scene fixture shows "Simplified view"            | fixed (defect 4)                                                                                                                                   |

## Pending — never inferred from this evidence (6B–6D take these over)

- **Owner review** of the 7G look decisions (items 1 and 2) and findings F1, F2: [packet](owner-scene-review.md).
- **Expert sign-off** of lesson 2's claims: [packet](expert-review.md), seven questions.
- **First-time readers** (PB4, PB8): do they find the picker and Play, read the ghosts, understand the crust?
- **Human listening** with a screen reader (PB7, PL7): the text alternative, the key and the page turn.
- **Colour-vision and projector checks** (PL7): glyphs and dash patterns back the colours; not yet seen by people.
- **Hardware**: other GPUs, Safari, Firefox, mobile devices, classroom machines. Captures use one adapter.

## §2 guardrail checklist for the whole wave (7A–7G)

- [x] **Labelled an illustration; no text implies formation, computation or simulation.** One label line; the
      disclosure says the shapes are authored and "do not form in the scene" at both levels; 7E's tests forbid
      "form", "grow", "run", "simulation" and "model time" outside denials. 7G fixed the one sentence that still
      implied formation ("the landform it makes").
- [x] **No run, model time, years or computed-looking gauge; the scrubber shows early → late.** Checked on the page
      text at both levels ("PL2 …", "PL4 PL5 …"); years appear only in the deeper level's real-time-scales
      paragraph, framed as facts about the real Earth (D-W7-7E).
- [x] **Every figure is a cited real-world fact; scales are bound.** 7E's `citedFigures` register and binding
      checks; the scales come from the scene config through probes.
- [x] **Shapes follow the 7A table, each parameter cited.** `parameters.md`/`.json`; 7C's generators read the
      config; 7G changed no shape (the tip is view-only).
- [x] **Deterministic relief, no `Math.random()`.** 7C's determinism tests; 7D's quantised, memoised frames; the
      new leader placement and tip are pure view code.
- [x] **Level, camera, cut and ghosts are view-only; lesson 1's state never touched.** "PB7 PL8 PL9 …",
      `plates-book.spec.ts` journey (lesson 1's run, rock, kept run and model time after lesson 2's choices).
- [x] **Keyboard equivalents, text alternatives, reduced motion; glyphs and patterns as well as colours.** "PL7 …"
      tests, axe audit; the key keeps glyph and dash sample, and the pattern words for listeners.
- [x] **Hachure never imports Uplift; generic additions in Hachure; shapes stay lesson content.** ESLint rule;
      `pitchDeg` is a generic stage option with no plate vocabulary.
- [x] **Scientific text marked `<!-- expert-review -->` with sources.** Every copy file and both registers; the
      mark reaches the page DOM.
- [x] **One label line; fuller limits in "What this shows / ignores" and the sources.** "PL4 PL5 …".

## Test results

See the PR for the exact command output. Summary: `pnpm check` (typecheck, lint, format, 886 unit tests),
`pnpm build`, bundle budget, and the full browser suite (`pnpm test:e2e`, SwiftShader): 106 passed, 1 failed, 4 skipped in 17.2 min. The failure was 7F's left-page fit test, which measured before the stage refit the book (one slow SwiftShader frame, now that lesson 2's closed-flap page no longer sits at the minimum scale); it now polls. Rerun of the plates suites (`plates-acceptance`, `plates-book`, `plates-scene`): 32 passed in 4.2 min.
The new `plates-acceptance.spec.ts` (12 tests) takes about 30–40 s.

## Files

| Path                            | What                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `e2e/plates-acceptance.spec.ts` | The acceptance walk (12 tests, one page), named by row                        |
| `capture.mjs`, `results.json`   | Captures and video from the production build (installed Chrome, WebGPU)       |
| `captures/`, `captures/before/` | 7G captures; the same views on main before 7G                                 |
| `owner-scene-review.md`         | Owner scene-review packet: the 7G decisions, the lesson as a whole, F1 and F2 |
| `expert-review.md`              | Expert-review packet: every claim with its sources, figures, questions        |
