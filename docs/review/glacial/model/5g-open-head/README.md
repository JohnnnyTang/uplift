# Glacier model review evidence (session 5G, open valley head; superseded by 5G2)

Archived by session 5G2: the 5G registered run on the open-head start `v-valley/1` (128 × 96). Kept
unchanged as part of the record; the current evidence is in the parent folder.

Evidence for the 5G glacier model (`@hachure/glacier`, CPU reference). Model note, protocol and the
full attempt record live in [docs/science/glacial](../../../../science/glacial/). Everything here is
generated; regenerate with:

```sh
GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/run-arm.review.test.ts   # all arms (~15 min on 6 cores)
GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/figures.review.test.ts   # figures + summary.json
```

| File                      | What                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sections-underIce.svg`   | Cross-sections at the registered teaching section (2.96 km from the mouth): rows = shale, sandstone, granite (seed 1), plain-SIA attempt A0, surface-balance attempt A2a, no-erosion control; columns = start, 100, 200, 300 model years. Dashed: the starting V. Solid: bed now. Blue: ice in section. Vertical scale = horizontal. |
| `sections-belowSnout.svg` | Same rows at 0.56 km: the reach the ice never reaches stays the starting V.                                                                                                                                                                                                                                                          |
| `sections-upper.svg`      | Same rows at 3.6 km, below the headwall (reported, not registered).                                                                                                                                                                                                                                                                  |
| `metrics-under-ice.svg`   | Floor width, depth, lower-wall slope and shape exponent at the teaching section over model time; mean of seeds 1–3 with a min–max band; rock identity by colour, dash pattern and direct label.                                                                                                                                      |
| `runs/<arm>.json`         | Every arm: config, probes, ice budget, numerical diagnostics and section measures every 20 model years, section rows.                                                                                                                                                                                                                |
| `runs/<arm>-t<years>.png` | Plan views at the start and matched times: hillshaded bed, 100 m contours, ice thickness in blue (0–400 m), ice-free glacial lowering in ochre (0–300 m). Valley head on the right, mouth on the left.                                                                                                                               |
| `summary.json`            | The registered evaluation: verdicts, the matched-time table and the attempt measures.                                                                                                                                                                                                                                                |

## Registered result (300 model years, seeds 1–3; under-ice section unless stated)

Means of three seeds. Floor lowering = start floor − floor now.

| Rock        | Floor width (m) | Shape exponent b | Steepest wall | Floor lowering (m) | Eroded section area (m²) |
| ----------- | --------------- | ---------------- | ------------- | ------------------ | ------------------------ |
| start (all) | 142             | 1.16             | 27°           | 0                  | 0                        |
| shale       | 165             | 1.36             | 34°           | 51                 | 125 000 (rims failing)   |
| sandstone   | 166             | 1.24             | 42°           | 35                 | 13 800                   |
| granite     | 158             | 1.16             | 41°           | 15                 | 6 100                    |

| Verdict                                                                                                  | Result                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T2 V unchanged below the snout (all 9 rock arms)                                                         | **pass**                                                                                                                                  |
| R1 softer rock erodes faster (all seeds, all matched times)                                              | **pass**                                                                                                                                  |
| R4 softer rock is cut deeper (floor lowering)                                                            | **pass**                                                                                                                                  |
| S1 rock changes shape, not only rate: at equal eroded area granite's steepest wall is 41° vs shale's 34° | **pass**                                                                                                                                  |
| K1 no-ice control, K2 no-erosion control                                                                 | **pass**                                                                                                                                  |
| N1 half time step changes nothing measurable                                                             | **pass** (0.0 m, 0.00°)                                                                                                                   |
| T1 a clear trough by 300 years (floor +20 m, b +0.2, lowering ≥ 30 m, wall +5°)                          | **fail** for sandstone (b +0.08) and granite (b ±0, lowering 15 m) and shale seed 2; pass shale seeds 1, 3                                |
| R2 softer rock gives a wider floor at every matched time                                                 | **fail** (at 100 years soft-rock floors are narrower; at 300 years shale ≈ sandstone)                                                     |
| R3 harder rock has steeper walls at every matched time                                                   | **fail** at matched _time_ (granite reaches 41° only by 300 years while sandstone sits at its 42° limit); holds at matched _erosion_ (S1) |

Attempts at the horizon (sandstone unless named): plain SIA (A0) narrows the floor 142 → 94 m and cuts
102 m down (an inner gorge); the lateral-drag model widens it to 166 m and cuts 35 m. Surface-referenced
mass balance (A2a) widens more (226 m) but its glacier size then depends on the rock.

CPU cost: 0.30–0.41 s per model year on the 128 × 96 grid (Node 24, one core each, seven runs sharing
one machine), so a 300-year run is about 1.5–2 minutes of worker time.
