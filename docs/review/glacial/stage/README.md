# 5H · Book stage, scene look and transition — review evidence

**Status: draft, on the authored fixture.** Every capture here uses the authored fixture, and the page says
so ("Authored fixture — not a model run"). The R1 review build on 5G's merged captured runs is not done yet;
it replaces these captures when 5G merges.

Route: `?review=glacial-stage` (options: `&mode=flat|tilted`, `&motion=reduce`, `&backend=webgl2|webgpu`,
`&cut=0..1`, `&frame=<index>`, `&static=1`). To regenerate:

```sh
pnpm --filter @uplift/book exec vite --port 5190 --host 127.0.0.1
STAGE_BASE_URL=http://127.0.0.1:5190 node docs/review/glacial/stage/capture.mjs
```

[results.json](results.json) records the browser, the stage mode, the backend and the text alternative for
each capture. Captured in headless Chrome (WebGPU backend). No human, hardware or screen-reader check yet.

## Reader action and visible outcome

**Reader action:** open the spread. **Visible outcome:** the textbook line drawing on the tilted right page goes
sketchy, the block rises off the paper drawn in ink, then colour and shading wash in: rock in section on the
block's sides, snowy peaks, a pale-blue glacier with flow marks, forest and meadow lower down, a meltwater river
below the snout, and a shadow on the paper. The diorama may rise past the figure frame.

| Capture                                                                                                                 | What it shows                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [1 drawing](desktop-1440-1-drawing.png) · [2 ink](desktop-1440-2-ink.png) · [3 colour](desktop-1440-3-colour.png)       | The transition on the tilted book, 1440 × 900                                                                                  |
| [desktop-1366.png](desktop-1366.png)                                                                                    | Tilted book at 1366 × 768                                                                                                      |
| [transition-and-cut.webm](transition-and-cut.webm)                                                                      | Open → transition → front face slid up the valley (V below the snout → U under the ice) → ice hidden → limestone look → replay |
| [front-face-v-below-snout.png](front-face-v-below-snout.png) · [front-face-u-under-ice.png](front-face-u-under-ice.png) | The block's front face: V below the snout; U under the ice with the ice in section and the starting V dashed                   |
| [tilted-u-under-ice.png](tilted-u-under-ice.png)                                                                        | Cut under the ice, on the tilted page                                                                                          |
| [under-the-ice.png](under-the-ice.png)                                                                                  | "See under the ice" (view-only; the ice is hidden, not melted)                                                                 |
| [rock-granite.png](rock-granite.png) · [rock-limestone.png](rock-limestone.png) · [rock-shale.png](rock-shale.png)      | Provisional rock looks: colour plus lithology pattern (crosses, brick, dashes)                                                 |
| [desktop-1440-flat.png](desktop-1440-flat.png)                                                                          | Flat page, scene inside the figure (forced)                                                                                    |
| [reduced-motion-1440.png](reduced-motion-1440.png)                                                                      | Reduced motion: flat page and a crossfade instead of the rise                                                                  |
| [phone-390.png](phone-390.png) · [zoom-200-equivalent.png](zoom-200-equivalent.png)                                     | Phone and 200 % zoom: flat, single column, scene inside the figure                                                             |
| [static-fallback-1440.png](static-fallback-1440.png)                                                                    | No 3D (`&static=1`, or no WebGL/WebGPU): the drawing is the figure                                                             |

## What is built

- `@hachure/ink/stage`: `createBookStage` (DOM book under CSS `rotateX`, one canvas with a camera that
  matches the CSS perspective exactly, paper shadow-catcher, contact shadow, flat fallback by media query and
  fit check) and `createValleyDiorama` (landscape block from a snapshot: ground, ice, ice in section, walls with
  lithology, river, trees, ink edges, hachures, flow marks, dashed starting profile; cut, ice view and rock-look
  preview are view-only).
- `@hachure/ink/stage` also re-exports the natural materials (`materials/natural`): palette, lithology patterns
  (one tile for canvas and SVG), cel-shaded node materials with a paper → colour wash.
- `@hachure/ink/transition`: the drawing → ink → colour timeline as a pure function of time, plus a runner;
  reduced motion is a crossfade.
- `uplift/book/src/scenes/glacial`: Fig. 1 (authored line drawing), the fixture, the run seam and the
  review composition.

## The data seam expected from 5G

The stage draws `LandscapeSnapshot` values (`hachure/ink/src/stage/snapshot.ts`):

```ts
{ columns, rows, metresPerCell,            // grid, row-major: index = row * columns + column
  bedM, iceThicknessM?, rockId?,          // per cell (rockId may be one number for the run)
  iceVelocityMPerYr?: { x, y },           // optional; flow marks fall back to ice-surface slope
  modelTimeYr? }
```

plus a `ValleyOrientation` (which axis runs down the valley, and which way) and the display altitudes
(`snowlineM` from the model's fixed snowline config; `treelineM` illustrative). A run is a start snapshot plus
a series of snapshots (`uplift/book/src/scenes/glacial/runs.ts`). Swapping in 5G's captured runs means
filling `reviewRuns()` from 5G's exported fixtures; nothing in Ink changes.

## Not done (waits for merged 5G)

- R1 review build on real captured runs: desktop + phone captures at page size and the video with a
  captured run playing.
- Margin-note numbers (floor width and depth) bind to 5G's probes; the fixture has none, so the note says so.
- Model time label and play/pause/timeline on a real run.
