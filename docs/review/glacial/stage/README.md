# 5H · Book stage, scene look and transition — R1 review build

**Status: R1 review build on 5G2's captured runs** (`@hachure/glacier/captures/*`, format
`hachure-glacier-capture` v1, one recorded run per rock: shale, sandstone, granite). Every view says on the
page that it is a recorded run of a simplified model with compressed time. The authored fixture is only shown
with `&fixture=1` (and as the fallback if the captures fail to load), and is then labelled "Authored fixture —
not a model run". Captured on 5G2's regenerated captures (enclosed valley head, 160 × 64 cells at 40 m,
16 snapshots from 0 to 300 model years).

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
need no code change. The capture positions are grid columns and model years (`U_COLUMN`, `MATCHED_COLUMN`,
`MATCHED_YEARS` in `capture.mjs`), picked from the model's `measureSection` over every column and snapshot;
the measured numbers behind each are in the comment there and in DECISIONS.md (D-5H-R1). Recheck them when
the captures change.

[results.json](results.json) records, for each capture, the browser, stage mode, backend, provenance line,
margin notes and text alternative. Captured in headless Chrome. No human, hardware or screen-reader check yet.

## Reader action and visible outcome

**Reader action:** open the spread; choose a rock; press Play or drag the time ruler; slide the front face up
the valley; tick "See under the ice". **Visible outcome:** the textbook line drawing on the tilted right page
goes sketchy, the block rises off the paper drawn in ink, then colour washes in. Play shows the recorded run:
the glacier grows from the head of the valley and the bed is worn down under it. The front face shows the
model's cross-section, with the starting V dashed; the margin notes give the model's own floor width, depth,
floor lowering and steepest wall at that section and time.

| Capture                                                                                                                                                                    | What it shows                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [open-transition-run-front-face.webm](open-transition-run-front-face.webm)                                                                                                 | Open → transition → shale run playing 0 → 300 model years → front face from V (mouth) to U (i = 51) → ice hidden → granite at the same place |
| [1 drawing](desktop-1440-1-drawing.png) · [2 ink](desktop-1440-2-ink.png) · [3 colour](desktop-1440-3-colour.png)                                                          | The transition on the tilted book, 1440 × 900 (sandstone, last snapshot)                                                                     |
| [desktop-1366.png](desktop-1366.png)                                                                                                                                       | Tilted book at 1366 × 768                                                                                                                    |
| [phone-390.png](phone-390.png) (2×) · [phone-390-full.png](phone-390-full.png)                                                                                             | Phone at page size: first screen, and the whole page                                                                                         |
| [run-shale-frame-00](run-shale-frame-00.png) · [05](run-shale-frame-05.png) · [10](run-shale-frame-10.png) · [15](run-shale-frame-15.png)                                  | The shale run at four recorded times (start, no ice → last snapshot)                                                                         |
| [front-face-v-below-snout.png](front-face-v-below-snout.png) · [front-face-u-under-ice.png](front-face-u-under-ice.png)                                                    | Front face at 300 model years: V at the mouth, below the snout; the clearest U under the ice (shale, i = 51), starting V dashed              |
| [tilted-u-under-ice.png](tilted-u-under-ice.png)                                                                                                                           | The same cut on the tilted page                                                                                                              |
| [under-the-ice.png](under-the-ice.png)                                                                                                                                     | "See under the ice" (view-only; the ice is hidden, not melted)                                                                               |
| [rock-shale.png](rock-shale.png) · [rock-sandstone.png](rock-sandstone.png) · [rock-granite.png](rock-granite.png)                                                         | The three runs at the same time (300 years) and face (i = 51), ice hidden: lowered 60 / 40 / 20 m, steepest wall 35 / 42 / 45° (bound)       |
| [matched-erosion-shale-80yr](matched-erosion-shale-80yr.png) · [sandstone-160yr](matched-erosion-sandstone-160yr.png) · [granite-300yr](matched-erosion-granite-300yr.png) | **Extra, not the reader default.** Each rock at its own matched-erosion time, registered section i = 74, ice hidden                          |
| [desktop-1440-flat.png](desktop-1440-flat.png)                                                                                                                             | Flat page, scene inside the figure (forced)                                                                                                  |
| [reduced-motion-1440.png](reduced-motion-1440.png)                                                                                                                         | Reduced motion: flat page and a crossfade instead of the rise                                                                                |
| [zoom-200-equivalent.png](zoom-200-equivalent.png)                                                                                                                         | 200 % zoom equivalent: flat, single column                                                                                                   |
| [static-fallback-1440.png](static-fallback-1440.png)                                                                                                                       | No 3D (`&static=1`, or no WebGL/WebGPU): the drawing is the figure                                                                           |
| [fixture-1440.png](fixture-1440.png)                                                                                                                                       | The authored fixture (`&fixture=1`), labelled as such                                                                                        |

## How the recorded runs look (5G2, compared with the 5G captures)

All numbers are the model's `measureSection` on the captures (seed 1); the page shows them rounded to 10 m.

- **The ice now stays in the valley.** With the enclosed head the glacier fills the valley and its head
  basin; the ridges outside carry only thin ice. In the 5G captures the ice covered the whole upper basin,
  ridges included.
- **The U reads in all three rocks at one honest place.** At 300 model years and column i = 51 (4.3 km down
  the valley from the head, under 175–200 m of ice) every rock is a U by the model's shape fit (b 1.73 /
  1.59 / 1.61, shale / sandstone / granite); the floor is lowered 57 / 40 / 18 m and the steepest wall is
  35 / 42 / 45°. That is the page sentence, at the reader-default time. With the 5G captures only shale
  showed a U, and only at mid-run near the head.
- **Shale's U is not permanent.** At the registered section (i = 74) shale's U is clearest at 140 years
  (b 1.64) and degrades as its walls retreat (b 0.77 by 300 years); the U zone moves down-valley with the
  snout, so at 300 years it sits at i ≈ 40–54 and ends abruptly up-valley (b 1.66 at i = 54, 1.07 at i = 55).
- **The head basin is overdeepened in every rock.** Above about i = 94 the floor is lowered 100–230 m,
  granite included (with 55° walls). Sliding the face there shows hard rock cut deep; this is real model
  output, flagged for expert review (DECISIONS.md, D-5H-R1).
- **The odd/even ripple is gone from the valley reach.** The 5G captures alternated 75 m / 300 m floor
  widths column to column; now the floor width moves in steps (220 → 156 → 74 m) where the probe's 25 m
  floor band catches or misses a bench, so a margin note can still jump by one cell.
- **No rock reaches the registered 30 m lowering at the registered section by matched erosion** (shale
  80 years: 26 m; sandstone 160 years: 26 m; granite 300 years: 18 m). Granite keeps the steepest walls
  there too (34.5 / 42.2 / 45.9°).
- The data support "soft rock wears away faster and deeper; hard rock keeps steeper walls" (checked in
  `runs.test.ts` at i = 74 and i = 51). They do **not** support "softer rock gives a wider floor": floor
  width is not ordered by rock (209 / 177 / 179 m at i = 51), so the page does not say it.

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
