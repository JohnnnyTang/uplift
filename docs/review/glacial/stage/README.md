# 5H · Book stage, scene look and transition — R1 review build

**Status: draft R1 review build on 5G's merged captured runs** (`@hachure/glacier/captures/*`, format
`hachure-glacier-capture` v1, one recorded run per rock: shale, sandstone, granite). Every view says on the
page that it is a recorded run of a simplified model with compressed time. The authored fixture is only shown
with `&fixture=1` (and as the fallback if the captures fail to load), and is then labelled "Authored fixture —
not a model run". The lead redoes this build on session 5G2's regenerated captures (enclosed valley head)
before R1.

Route: `?review=glacial-stage` (options: `&mode=flat|tilted`, `&motion=reduce`, `&backend=webgl2|webgpu`,
`&cut=0..1`, `&rock=shale|sandstone|granite`, `&frame=<snapshot index>`, `&static=1`, `&fixture=1`).

## Recapture (one command)

From the repository root:

```sh
node docs/review/glacial/stage/capture.mjs
```

It builds the book, serves the production build on a free port, writes every PNG, the video and
[results.json](results.json) here, deletes captures it no longer makes, and stops the server. Grid size, cell
size, snapshot count, rock, snowline and model time are all read from the capture manifests, so new captures
need no code change. Two capture positions are tuned to the current runs (`U_FRAME`, `U_CUT` in
`capture.mjs`: where the front face shows the clearest U); recheck them after the captures change.

[results.json](results.json) records, for each capture, the browser, stage mode, backend, provenance line,
margin notes and text alternative. Captured in headless Chrome. No human, hardware or screen-reader check yet.

## Reader action and visible outcome

**Reader action:** open the spread; choose a rock; press Play or drag the time ruler; slide the front face up
the valley; tick "See under the ice". **Visible outcome:** the textbook line drawing on the tilted right page
goes sketchy, the block rises off the paper drawn in ink, then colour washes in. Play shows the recorded run:
the glacier grows from the head of the valley and the bed is worn down under it. The front face shows the
model's cross-section, with the starting V dashed; the margin notes give the model's own floor width, depth,
floor lowering and steepest wall at that section and time.

| Capture                                                                                                                                   | What it shows                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [open-transition-run-front-face.webm](open-transition-run-front-face.webm)                                                                | Open → transition → shale run playing 0 → end → time back to the U frame → front face from V to U → ice hidden → granite at the same place |
| [1 drawing](desktop-1440-1-drawing.png) · [2 ink](desktop-1440-2-ink.png) · [3 colour](desktop-1440-3-colour.png)                         | The transition on the tilted book, 1440 × 900 (sandstone, last snapshot)                                                                   |
| [desktop-1366.png](desktop-1366.png)                                                                                                      | Tilted book at 1366 × 768                                                                                                                  |
| [phone-390.png](phone-390.png) (2×) · [phone-390-full.png](phone-390-full.png)                                                            | Phone at page size: first screen, and the whole page                                                                                       |
| [run-shale-frame-00](run-shale-frame-00.png) · [05](run-shale-frame-05.png) · [10](run-shale-frame-10.png) · [15](run-shale-frame-15.png) | The shale run at four recorded times (start, no ice → last snapshot)                                                                       |
| [front-face-v-below-snout.png](front-face-v-below-snout.png) · [front-face-u-under-ice.png](front-face-u-under-ice.png)                   | Front face: V at the mouth, below the snout; the clearest U in the runs (shale, under the ice), starting V dashed                          |
| [tilted-u-under-ice.png](tilted-u-under-ice.png)                                                                                          | The same cut on the tilted page                                                                                                            |
| [under-the-ice.png](under-the-ice.png)                                                                                                    | "See under the ice" (view-only; the ice is hidden, not melted)                                                                             |
| [rock-shale.png](rock-shale.png) · [rock-sandstone.png](rock-sandstone.png) · [rock-granite.png](rock-granite.png)                        | The three recorded runs at the same time and front face, ice hidden: colour plus pattern (dashes, stipple, crosses)                        |
| [desktop-1440-flat.png](desktop-1440-flat.png)                                                                                            | Flat page, scene inside the figure (forced)                                                                                                |
| [reduced-motion-1440.png](reduced-motion-1440.png)                                                                                        | Reduced motion: flat page and a crossfade instead of the rise                                                                              |
| [zoom-200-equivalent.png](zoom-200-equivalent.png)                                                                                        | 200 % zoom equivalent: flat, single column                                                                                                 |
| [static-fallback-1440.png](static-fallback-1440.png)                                                                                      | No 3D (`&static=1`, or no WebGL/WebGPU): the drawing is the figure                                                                         |
| [fixture-1440.png](fixture-1440.png)                                                                                                      | The authored fixture (`&fixture=1`), labelled as such                                                                                      |

## How the recorded runs look (compared with the fixture)

- **The fixture was a clean, idealised U.** The real runs are not. In the current captures the ice covers
  almost the whole upper basin, ridges included, because the valley head is open (5G2 is regenerating the
  captures with an enclosed head).
- **Shale** changes most: the floor is lowered by hundreds of metres under the ice, and by the last snapshot
  the walls and rims are worn down too, so the trough is broad and shallow rather than a crisp U. The
  clearest U in any run is shale at 200 model years near the valley head (shape exponent about 1.9).
- **Sandstone** is lowered by tens of metres (up to about 130 m near the head); its section stays close to a V in shape (shape exponent about 1.1
  to 1.4 by the model's own fit).
- **Granite** barely changes in 300 model years: the floor is lowered about 20 m, the V stays, and the
  walls stay the steepest. Read on the page, a granite run looks like ice sitting on the starting valley.
- **Shale has an odd/even ripple along the valley** in the eroded bed: at 200 model years, near the head, the
  model's floor width alternates between about 75 m and 300 m+ from one grid column to the next (granite and
  sandstone are smooth). The front-face notes therefore jump as the face moves one cell. Flagged for 5G2/5I.
- The data support the page sentence "soft rock wears away faster and deeper; hard rock keeps steeper walls"
  (also checked in `runs.test.ts`). They do **not** support "softer rock gives a wider floor": floor width
  is not ordered by rock, so the page does not say it.

## What is built

- `@hachure/ink/stage`: `createBookStage` (DOM book under CSS `rotateX`, one canvas with a camera that
  matches the CSS perspective exactly, paper shadow-catcher, contact shadow, flat fallback) and
  `createValleyDiorama` (block from a `LandscapeSnapshot`). New for the real runs: `setElevationRange` (one
  vertical frame across all runs, so the block never resizes when the rock or time changes),
  `describe().cutAlongIndex` and `valleyGridIndex` (map the front face back to the model's grid column).
- Natural materials: the look set now matches the model's rocks (shale: dashes; sandstone: stipple;
  granite: crosses, after FGDC-STD-013-2006).
- `@hachure/ink/transition`: unchanged.
- `uplift/book/src/scenes/glacial/runs.ts`: loads and decodes the three captures, maps them through the
  seam (orientation from the capture format: valley along columns, downstream = decreasing i), and measures
  the front face with `measureSection` from `@hachure/glacier`. No glacier physics in Ink or the book.
- `review.ts`: rock choice switches to that rock's recorded run at the same model time; a time ruler (one
  tick per recorded snapshot; Play/Pause; arrow keys step one snapshot) plays the run; margin notes and the
  live text alternative bind to the run.
