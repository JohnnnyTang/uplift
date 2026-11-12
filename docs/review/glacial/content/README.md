# Lesson content review: copy fit (session 5L)

`capture.mjs` places the 5L lesson content into the R1 review build without modifying the build. Run it from
the repository root: `node docs/review/glacial/content/capture.mjs`. It renders the margin notes through the
runtime's `BindingEngine` from real model output:

- the shale run at its last snapshot, with the sandstone run as the kept, compared run;
- the section at the default front face, averaged over `noteColumns()` and rounded with `roundForNote()`.

These captures show the worst case for the margin: a kept run is shown and the challenge is in the margin.

| Capture                                             | Layout                             | Result                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-1440-hs.png`, `desktop-1440-uni.png`       | Tilted book, 1440 × 900            | Fits. The whole spread is on screen, and neither the text page nor the margin overflows.                                                                   |
| `laptop-1366x768-hs.png`, `laptop-1366x768-uni.png` | Short laptop, terms-only key words | Fits. The first uni draft pushed the book below the viewport, so the uni compare note was shortened and the averaging note moved to the deeper level only. |
| `phone-390-hs.png`, `phone-390-uni.png`             | Flat readable page (full page)     | Reads top to bottom, with no clipping or horizontal scroll.                                                                                                |

`results.json` records, for each view, the margin notes as rendered, the measured section values and the
overflow checks.

Default-cut values (averaged, rounded):

| Rock      | Floor | Depth | Lowered | Steepest wall | b   |
| --------- | ----- | ----- | ------- | ------------- | --- |
| Shale     | 210 m | 270 m | 60 m    | 35°           | 1.7 |
| Sandstone | 180 m | 260 m | 40 m    | 42°           | 1.6 |

**Observed, for 5K/5M.** In the tilted layout the bottom of the flap box sits within about 10 px of the
folio ("2"). The page grows to fit its content (R2b), so nothing is clipped, but the folio could use more
bottom padding. That is a CSS matter in the scene or book, outside 5L's paths. The lesson number and figure
number are added by the shell, and the prediction options are shown as a plain line; 5M decides their final
presentation.

Not covered: real screen-reader listening, a human first-reader check, and the live runtime (5J/5M).
