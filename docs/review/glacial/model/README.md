# Glacier model review evidence (session 5G2: enclosed valley head)

Evidence for the `@hachure/glacier` CPU reference on the registered start `v-valley/2` (160 × 64 cells,
40 m; the head basin enclosed by higher ground). Model note, protocol and the full attempt record:
[docs/science/glacial](../../../science/glacial/). The 5G registered run on the open-head start is kept
unchanged in [5g-open-head/](5g-open-head/README.md); the 5G2 pilots in [pilots-5g2/](pilots-5g2/).
Everything here is generated; regenerate with:

```sh
GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/run-arm.review.test.ts   # all arms (~15 min on 7 cores)
GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/figures.review.test.ts   # figures + summary.json
```

| File                      | What                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sections-underIce.svg`   | Cross-sections at the registered teaching section (2.96 km from the mouth): rows = shale, sandstone, granite (seed 1), the 5G open-head shale run, plain-SIA attempt A0, surface-balance attempt A2a, no-erosion control; columns = start, 100, 200, 300 model years. Dashed: the starting V. Solid: bed now. Blue: ice. Vertical scale = horizontal. |
| `sections-belowSnout.svg` | Same rows at 0.56 km (the control reach).                                                                                                                                                                                                                                                                                                             |
| `sections-upper.svg`      | Same rows at 3.6 km (reported, not registered).                                                                                                                                                                                                                                                                                                       |
| `metrics-under-ice.svg`   | The four registered trough measures at the teaching section over model time (floor width, floor lowered, steepest lower wall, shape exponent b); mean of seeds 1–3 with a min–max band; rock identity by colour, dash pattern and direct label.                                                                                                       |
| `runs/<arm>.json`         | Every arm: config, start options, probes, ice budget, numerical diagnostics and section measures every 20 model years, section rows.                                                                                                                                                                                                                  |
| `runs/<arm>-t<years>.png` | Plan views at the start and matched times: hillshaded bed, 100 m contours, ice thickness in blue (0–400 m), ice-free glacial lowering in ochre (0–300 m). Valley head on the right.                                                                                                                                                                   |
| `summary.json`            | The registered evaluation: verdicts (matched time and matched erosion), the matched-time table and the attempt measures.                                                                                                                                                                                                                              |

## Registered result (300 model years, seeds 1–3; under-ice section)

Means of three seeds (b per seed in brackets). Floor lowered = start floor − floor now.

| Rock        | Floor width (m) | Shape exponent b      | Steepest wall | Floor lowered (m) | Eroded section area (m²) |
| ----------- | --------------- | --------------------- | ------------- | ----------------- | ------------------------ |
| start (all) | 142             | 1.17                  | 27°           | 0                 | 0                        |
| shale       | 200             | 0.99 (0.77/1.05/1.14) | 37°           | 56                | 174 000 (walls retreat)  |
| sandstone   | 171             | 1.08 (1.37/0.92/0.94) | 42°           | 37                | 38 600                   |
| granite     | 225             | 1.47 (1.50/1.46/1.45) | 46°           | 18                | 13 700                   |

At equal eroded area (13 725 m², granite's horizon value): shale at ~84 model years, sandstone at ~150,
granite at ~300; floor width 185 / 216 / 225 m; steepest wall 34.6 / 42.3 / 46.4°; floor lowered
27 / 25 / 18 m.

| Verdict                                                                        | Result                                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| T1 a clear trough at 300 years (floor +20 m, b +0.2, lowered ≥ 30 m, wall +5°) | **fail** except sandstone seed 1: granite fails only the lowering (18 m); shale and sandstone seeds 2–3 fail b |
| T2 V unchanged below the snout                                                 | **fail** in shale seeds 2–3 (the growing shale glacier reached 0.52–0.56 km); pass elsewhere                   |
| R1 softer rock erodes faster; R4 softer rock is cut deeper                     | **pass**                                                                                                       |
| R2 wider floor in softer rock; R3 steeper walls in harder rock (matched time)  | **fail**                                                                                                       |
| S1 rock changes the shape: at equal erosion granite's wall 46° vs shale's 35°  | **pass**                                                                                                       |
| E-T1 trough at matched erosion                                                 | **fail** (every arm lowered 18–27 m at the matched area)                                                       |
| E-R1 time to remove the same area; E-R3 steeper walls at equal erosion         | **pass**                                                                                                       |
| E-R2 wider floor in softer rock; E-R4 deeper in softer rock (equal erosion)    | **fail** (hard rock widens more; lowering gaps 2–7 m)                                                          |
| K1, K2 controls; N1 half step                                                  | **pass**                                                                                                       |

**Leak:** fixed. The shale glacier grows over the run (0.57 → 1.10 km³, 100 → 300 years) instead of
draining away (5G open head, re-run with this solver: 0.38 → 0.33 km³); the ice that leaves through the
border frame is thin ice on the outer flanks.

CPU cost: 0.42–0.44 s per model year on 160 × 64 (Node 24, one core each, seven runs sharing one
8-core machine; a lone run measured 0.34 s in pilots), so a 300-year run is ~2 minutes of worker time.
