# 5K · Production glacial scene and direct interaction

**Status:** production scene on 5G2's recorded runs (`@hachure/glacier/captures/*`), on the R1-approved 5H
book stage, unchanged where D-W5-R1 froze it. Decision record: DECISIONS.md, D-W5-5K.

Route: `?review=glacial-stage` (options: `&mode=flat|tilted`, `&motion=reduce`, `&backend=webgl2|webgpu`,
`&column=<grid column>` or `&cut=0..1`, `&rock=<rock>`, `&kept=<rock>[,<rock>]`, `&frame=<index>`,
`&static=1`, `&fixture=1`). The default front face is grid column i = 51 at the last snapshot (D-W5-R1 item 4),
passed as a scene option; in the book it comes from the spread config.

## Recapture (one command)

```sh
node docs/review/glacial/scene/capture.mjs
```

Builds the book, serves the production build, writes every PNG and [results.json](results.json) here, and
stops the server. [results.json](results.json) records for each capture the stage mode, backend, front-face
column, live and kept rock, whether the overdeepening note shows, the margin notes and the text alternative.
Headless Chrome only; no human, screen-reader or hardware check yet.

## Reader actions and visible outcomes

| Reader action                                  | Keyboard / page equivalent                       | Visible outcome                                                             |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Drag a rock specimen onto the block            | Rock radio group (same `chooseRock` command)     | That rock's run shows; the previous run becomes the kept run (dotted ghost) |
| Drag the block's front face along the valley   | Front face slider, one grid cell per arrow press | The cut moves; face, lens, notes and text alternative follow                |
| See under the ice                              | Checkbox (Space)                                 | Ice hidden on the block and in the lens (view-only)                         |
| Drag the scene / wheel (limited turntable, R2) | View height, Turn, Zoom sliders; Reset view      | Book and block turn together; the run is untouched                          |
| Play / scrub the time ruler (5H, unchanged)    | Play button, range input                         | Recorded snapshots; ghost follows at the matched recorded time              |

| Capture                                                                                                                                                                            | What it shows                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [desktop-1440-default.png](desktop-1440-default.png)                                                                                                                               | Reader default: sandstone, 300 model years, face at i = 51; lens beside the caption            |
| [desktop-1440-compare.png](desktop-1440-compare.png) · [laptop-1366-compare.png](laptop-1366-compare.png)                                                                          | Shale with the kept granite run as the ghost; margin notes for both runs                       |
| [desktop-1440-specimen-drag.png](desktop-1440-specimen-drag.png) · [desktop-1440-specimen-dropped.png](desktop-1440-specimen-dropped.png)                                          | Carrying shale over the block (drop outline), and after the drop                               |
| [desktop-1440-under-the-ice.png](desktop-1440-under-the-ice.png)                                                                                                                   | See under the ice                                                                              |
| [phone-390.png](phone-390.png) (2×) · [phone-390-full.png](phone-390-full.png)                                                                                                     | Phone, flat page; lens in the flow                                                             |
| [figure-shale-frame-00](figure-shale-frame-00.png) · [05](figure-shale-frame-05.png) · [10](figure-shale-frame-10.png) · [15](figure-shale-frame-15.png)                           | The figure at page size over the shale run: the V at the start turning towards a U in the lens |
| [figure-v-below-snout.png](figure-v-below-snout.png) · [figure-u-under-ice.png](figure-u-under-ice.png)                                                                            | V below the snout (i = 10) against U under the ice (i = 51), same run and time                 |
| [lens-shale-ghost-granite](lens-shale-ghost-granite.png) · [lens-sandstone-ghost-shale](lens-sandstone-ghost-shale.png) · [lens-granite-ghost-shale](lens-granite-ghost-shale.png) | The enlarged front face with each kept-run ghost                                               |
| [overdeepening-note.png](overdeepening-note.png)                                                                                                                                   | Shale at i = 35, 300 model years: the model's floor lies below the floor further down          |
| [reduced-motion-1440.png](reduced-motion-1440.png) · [static-fallback-1440.png](static-fallback-1440.png) · [fig1-labels.png](fig1-labels.png)                                     | Reduced motion (flat), the labelled static fallback, and Fig. 1's leader-line labels           |

## What the captures show

- **The morphology change reads at page size in the lens.** On the tilted page the block's cut face is only
  a few pixels tall, so the U was not legible there alone; the lens draws the same section (true across,
  vertical ×2, both bound in its label) with the dashed starting V and the ghost.
- **The comparison reads by shape**: at i = 51, 300 model years, the shale floor lies about 40 m below
  granite's (margin notes 60 m against 20 m lowered) and granite keeps the steeper wall (45° against 35°).
  Floor width is not ordered by rock, and no claim is made about it.
- **The overdeepening note appears only in shale's lower trough** (i = 26–43 at 300 model years; never in
  sandstone, granite or the head reach). See D-W5-5K item 5.
- **Dressing follows the model**: flow marks trace the recorded velocity (longer where faster); the river
  starts below the snout and runs to the front on the filled bed.

## Not done

No video; touch drag of the cut face (the slider is the phone path); human and screen-reader checks.
