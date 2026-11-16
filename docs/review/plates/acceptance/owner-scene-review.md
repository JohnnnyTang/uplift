# Owner scene-review packet: _Where plates meet_ in the two-lesson book (session 7G)

**Status: pending owner review.** These captures come from the production build (`pnpm build`, `vite preview`)
on the default route. They were taken in installed Chrome 157 with WebGPU on an Intel Arc 140V (Windows 11),
from this PR's code (base `27f033c`). Regenerate them with [`capture.mjs`](capture.mjs). For each capture,
[`results.json`](results.json) records the viewport, backend, stage mode, book transform, boundary, stage, ghosts
and the live text alternative. `captures/before/` holds the same views on main before 7G.

The scene is an **illustration**: lesson 2's shapes are authored from cited examples (D-L2-1).

## Look at these first: your two 7G decisions

### 1 · Ghost labels off the front face, inside the page (D-W7-7G item 1)

The labels are now the ghost key, set on the page right under the block's front face: a dash sample, the boundary
glyph and the name for each boundary already viewed. A fine ink leader with an open dot ties each entry to its
profile on the face. No label covers the face, and the key reflows with the page on phones.

| Before (main)                                                                                                             | After (7G)                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [1440 × 900](captures/before/1440x900-transform-ghosts.png): labels over the face, the right one clipped at the page edge | [1440 × 900](captures/d1-1440x900-transform-ghosts.png) · [close look 2×](captures/d1-1440x900-figure-2x.png)         |
| [1920 × 1080](captures/before/1920x1080-transform-ghosts.png): labels over the face and the block's top                   | [1920 × 1080](captures/d1-1920x1080-transform-ghosts.png) · [close look 2×](captures/d1-1920x1080-figure-2x.png)      |
| [390 × 844 phone](captures/before/390x844-transform-ghosts.png): labels over the face                                     | [390 × 844 phone](captures/d1-390x844-transform-ghosts.png) · [1366 × 768](captures/d1-1366x768-transform-ghosts.png) |

**Your call.** At 1440 × 900 and below, the whole book is drawn at a small fit scale (your O1, accepted for lesson
1), so the key is as legible as the figure caption, no more. The old on-block labels were larger, but they covered
the face and were clipped. At 1920 × 1080 the key reads at caption size. If you want the labels larger at laptop
sizes, the options are a larger key font (it would push the caption and controls down) or a bigger book (O1).

### 2 · A higher default view of the block, book tilt unchanged (D-W7-7G item 2)

On the tilted book, "View height" is the book's own tilt (the camera is matched to the paper), so changing its
default would have tilted the book at the turn. The higher view therefore comes from the block: it is tipped 12°
towards the reader about its own front edge. The front edge stays on the paper, the top shows more and the front
face a little less. The book stays at 48° and "View height" still reads 42°. On phones, the flat stage's camera
rises by the same 12°.

| Before (main)                                                                                                                    | After (7G)                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [start, 1440 × 900](captures/before/1440x900-start.png) · [start, 1920 × 1080](captures/before/1920x1080-start.png)              | [start, 1440 × 900](captures/d2-1440x900-start.png) · [start, 1920 × 1080](captures/d2-1920x1080-start.png) · [1366 × 768](captures/d2-1366x768-start.png) |
| transform at late: [`../integration/look-transform-late-block.png`](../integration/look-transform-late-block.png) (7F, untipped) | [transform at late, 2×](captures/pl3-transform-late-2x.png): the offset ridges and streams read at the fault from the default view                         |

Video: [`journey-turn-transform.webm`](captures/journey-turn-transform.webm) (1440 × 900, GPU). It shows lesson 1, the
page turn, the transition, convergent at late, then transform played from early to late with convergent as a
ghost.

**Your call.** Is 12° enough, or too much? The block's back now rises a little further past the page's top edge,
as the scene already did in lesson 1 (your O2, accepted).

### 3 · No rift lakes (item 3)

Verified and kept: [divergent at late](captures/pl3-divergent-late-2x.png) shows no lakes. `maxLakes` is 0 by
default, and a unit test holds the production look to no lakes.

## Then the lesson as a whole (PL3, PL4, PL6)

| Capture                                                                                                                          | Look for                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [start](captures/pl3-start-2x.png)                                                                                               | The shared starting landscape: ridges and streams crossing the boundary, layers and crust on the front face |
| [convergent, late](captures/pl3-convergent-late-2x.png)                                                                          | A collision range with snow; the layers bend up; a deep crustal root (PL3, PL4)                             |
| [divergent, late](captures/pl3-divergent-late-2x.png)                                                                            | A rift between inked, ticked scarps; layers step down; thinner crust; no lakes                              |
| [transform, late](captures/pl3-transform-late-2x.png)                                                                            | Ridges and streams offset at the fault; relief and crust unchanged                                          |
| [lesson 1 at 1440](captures/c-1440-lesson1.png) → [lesson 2 at 1440](captures/c-1440-lesson2.png)                                | The turn on the same tilt. Lesson 2's left page is one column now, and its book is drawn larger (see below) |
| [lesson 1, university, flap open](captures/a-1440-lesson1-uni-flap.png) · [lesson 2, same](captures/a-1440-lesson2-uni-flap.png) | Both books stay on the desk; the left column scrolls inside the page (lesson 1 fixed in 7G)                 |
| [reduced motion](captures/pl7-reduced-motion.png) · [drawing only](captures/pl7-drawing-only.png)                                | The flat page with the stage in steps; the static fallback says "Drawing only: …"                           |

## Findings for an owner decision

**F1 · The book's size changes a little at the turn at 1440 × 900.** Lesson 2's left page is now one column (7G
fixed the empty margin-notes column it had inherited), so its spread is shorter and the book fits at 0.75 instead
of the 0.55 minimum. Lesson 1 stays at 0.60, so the book grows a little when you turn to lesson 2. Before 7G it
shrank (0.60 → 0.55). At 1920 × 1080 the two spreads are now the same height, so the size no longer changes there.
At 1366 × 768 both lessons sit at the minimum scale. Options: (a) accept, since lesson 2 is now easier to read at
laptop size; (b) fit both lessons to one page height (an engine change in the book stage, for 6B).

**F2 · PL3 at laptop sizes.** At 1440 × 900 the block's outline is about 260 px across (about 190 px before
7G). The range, rift and offset are recognisable in the full-screen captures, and clearly so in the 2× close looks.
At 1366 × 768 (minimum scale) it is about 180 px, and at 1920 × 1080 about 450 px. Judge whether "recognisable at page size" holds for you
there; the ledger records it as pass with a note.

## How to record the review

Append a DECISIONS.md entry that approves or adjusts D-W7-7G items 1 and 2 and answers F1 and F2. The ledger's
PB8 row stays pending until then.
