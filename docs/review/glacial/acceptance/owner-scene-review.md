# Owner scene-review packet: the default book (session 5N)

**Status: approved by owner 2026-11-14** (D-W5-5N2). The owner reviewed the scene and approved it as working,
and accepted findings O1 (book small at the default view) and O2 (block over the running head) as they are,
with no change. O3 (a first-time reader finds Play) remains a pending first-time-reader observation. The
owner also removed the water lesson in the same decision, so capture 20 shows a spread that is no longer in
the book; it stays as the record of what was reviewed. The packet below is unchanged from 5N. Captures come from
the real production build (`pnpm build`, `vite preview`), default route with no query string, installed
Chrome 157 with WebGPU on an Intel Arc 140V (the book's deeper level reads "Solver: webgpu"), commit
`b82dae5` plus this session's fixes. Regenerate with [`capture.mjs`](capture.mjs); per-capture rock, ghost,
model time, cut column, margin notes and text alternative are in [`results.json`](results.json).

## Please look at

| Capture                                                                                                                                                                          | What it shows                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [01 transition](captures/01-desktop-1440-transition.png)                                                                                                                         | The drawing → ink → colour transition, mid-way                                                |
| [02 opening](captures/02-desktop-1440-open.png) · [03 figure crop](captures/03-figure-open-2x.png)                                                                               | Default spread at rest: live run, sandstone, model time 0, the Play invitation                |
| [04 shale at 300](captures/04-desktop-1440-shale-300.png) · [05 crop](captures/05-figure-shale-300-2x.png)                                                                       | A shale run played to the horizon                                                             |
| [06 granite vs shale](captures/06-figure-granite-vs-shale-300-2x.png)                                                                                                            | Granite at 300 model years, kept shale run as the ghost at the same time (default cut i = 51) |
| [07 registered section](captures/07-figure-registered-section-300-2x.png) · [08 at 100 years](captures/08-figure-matched-100-2x.png)                                             | Same, front face at the registered section i = 74; scrubbed back to 100 model years           |
| [09 under the ice](captures/09-figure-under-the-ice-2x.png) · [10 below the snout](captures/10-figure-below-snout-2x.png)                                                        | X-ray view; the face below the snout, where the V stays                                       |
| [11 zoom 1.5](captures/11-desktop-1440-zoom-max.png)                                                                                                                             | The frozen view zoom at its maximum                                                           |
| [12 university](captures/12-desktop-1440-university.png) · [13 deeper panel](captures/13-desktop-1440-deeper-panel.png)                                                          | University level; deeper level with bound parameters, equations and run graphs                |
| [14 laptop 1366 × 768](captures/14-laptop-1366x768-open.png)                                                                                                                     | Short laptop                                                                                  |
| [15 phone](captures/15-phone-390.png) · [16 full page](captures/16-phone-390-full.png) · [17 320 px](captures/17-reflow-320-full.png)                                            | Phone flat page; 320 CSS px reflow                                                            |
| [18 reduced motion](captures/18-reduced-motion-1366.png) · [19 more contrast](captures/19-reduced-motion-contrast.png) · [20 water](captures/20-desktop-1440-water-spread-2.png) | Reduced motion; contrast setting; the water lesson as spread 2 (removed 2026-11-14, D-W5-5N2) |

## Findings that need an owner decision

**O1 · The tilted spread is small at the default view (PB1 at risk).** Measured by the PB1 tests on the
default route (bundled Chromium, default pose): at 1440 × 900 the two pages span 559 px of the 1440 px width,
the 3D block's outline is 74 × 79 px, and the 29 px lesson title is drawn 12 px tall, so body text is about a
third of its CSS size; at 1366 × 768 the pages span 477 px, the block is 50 × 54 px and the title 10 px tall
(captures 02, 14). The book starts about 350 px down a 900 px screen. The view toolbar and the fit reserve
room for the whole tilt and turn range (R2: "automatic fitting reserves space around the book"), and the
bottom bar takes the rest. Even at zoom 1.5 (capture 11) the block stays small. The reader can read every
text block through the upright reading panels (R1, frozen), and the section lens carries the V → U change,
so nothing is unreachable; but PB1 asks that "the illustration is the primary visual element" and that no
text is "shrunk to force a pass". This framing is frozen by D-W5-R1 item 1 and D-W5-R1a item 3, so 5N did
not change it. Options for the owner: (a) accept as is; (b) fit the book to the default pose only, keeping
the tilt/turn bounds but letting the book overflow at extreme poses; (c) raise the zoom ceiling above 1.5;
(d) lower the default sight line less. Measurements per viewport are attached to the PB1 tests in
`e2e/glacial-acceptance.spec.ts` (`view-metrics`).

**O2 · The block covers the figure page's running head** ("…ers shape valleys", captures 03–08). The scene
may rise past the figure frame by design (§1), but here it hides page furniture. Accept, or move the
running head / block anchor.

**O3 · Confirm the Play invitation works for a first-time reader** (D-W5-5M2 asked 5N to check). The
automated walk confirms the line shows at model time 0 and hides once the run moves; whether a new reader
finds Play without help is a first-time-reader observation, still **pending**.

## What 5N did not change

Book depth, binding, tilt 48°, spine view, zoom 1–1.5, reading panels, lens, rock set and colours, default cut
i = 51, overdeepening wording: all frozen (D-W5-R1, D-W5-R1a, D-W5-5M, D-W5-5M2).

## How to record the review

Append a DECISIONS.md entry (approve, adjust or reject O1–O3 and the scene as a whole). The GV4 row of the
[ledger](README.md) stays pending-human until then.

Recorded: D-W5-5N2 (2026-11-14), scene approved; O1 and O2 accepted as they are; GV4 owner review closed.
