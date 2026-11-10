<!-- expert-review -->

# Registered acceptance protocol: "From V to U" (session 5G)

Registered before the final runs, as required by the [education policy](../education-policy.md)
("register a single teaching claim, the paired intervention, all seeds, the fixed run horizon and the
intended view before a new validation run"). The same definitions live in code in
`hachure/glacier/src/testing/protocol.ts` (arms, horizon, sections, criteria) and
`hachure/glacier/src/testing/evaluate.ts` (evaluation). **Change the prose and the code together.**
5N reruns this protocol on production code and keeps every arm, including failures.

## Claim under test

> After the same model time, the valley in softer rock is wider and deeper, and in harder rock it keeps
> steeper walls and changes more slowly. In every rock, the V under the ice becomes a U-shaped trough,
> while below the snout it stays a V.

Teach only the parts that pass (see [feasibility.md](feasibility.md) for the result).

## Model and configuration

- Model: `@hachure/glacier` CPU reference, `DEFAULT_GLACIER_CONFIG` (128 × 96 cells, 40 m, fixed step
  0.0025 model years), authored start `v-valley/1` (`DEFAULT_V_VALLEY`).
- Time: model years, time compressed for erosion (`erosionSpeedup`); no geological-year claim.

## Arms

| Arm                                                                | Purpose                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `shale-s1..3`, `sandstone-s1..3`, `granite-s1..3`                  | Rock comparison: the reference model, each rock, start roughness seeds 1, 2, 3            |
| `control-no-ice`                                                   | No ice (sandstone): nothing may erode                                                     |
| `control-no-erosion`                                               | Ice flows, erosion off (sandstone): the V must be unchanged                               |
| `check-half-step`                                                  | Sandstone seed 1 at half the time step (0.00125 yr): numerical resolution of the measures |
| `attempt-a0-plain-sia`, `attempt-a0-plain-sia-shale`               | Recorded attempt A0: plain shallow ice, no lateral drag                                   |
| `attempt-a2a-surface-balance`, `attempt-a2a-surface-balance-shale` | Recorded attempt A2a: mass balance on the live ice surface                                |

## Horizon, matched times and sections

- Horizon: **300 model years**; snapshots every **20 model years**.
- Matched comparison times: **100, 200, 300 model years** (separate runs looked up at the same time,
  as in the product's comparison).
- Sections (grid column i, distance from the mouth): **below the snout i = 14 (0.56 km)**, the control
  reach the ice never reaches; **under the ice i = 74 (2.96 km)**, the registered teaching section;
  **upper valley i = 90 (3.6 km)**, reported only.

## Measures (one definition: `measureSection`)

- **Floor width**: continuous width of bed within 25 m of the lowest point (m).
- **Depth**: lower rim minus floor (m). Rims: highest bed on each side of the floor.
- **Lower-wall slope**: mean cell-to-cell slope between 10 % and 60 % of depth, both sides (°).
- **Shape exponent b**: least-squares fit of (z − floor) = a·|y − centre|^b over 5–60 % of depth
  (Svensson 1959; Harbor 1992): V ≈ 1, U ≈ 2 or more.
- **Eroded area**: rock removed from the section since the start (m²), the rate measure.
- **Floor lowering**: start floor minus current floor (m).

## Criteria (`PROTOCOL_CRITERIA`)

Thresholds are legibility and resolution choices, not geomorphic constants.

| ID         | Pass when                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1         | In **every** rock arm at the horizon, under-ice section: floor widens ≥ 20 m, b rises ≥ 0.2, floor lowered ≥ 30 m, steepest wall steepens ≥ 5° (shale can gain only 8°)                                                     |
| T2         | In every rock arm: ice never reaches the below-snout section; its floor, floor width (≤ 0.5 m change) and b (≤ 0.02) are unchanged                                                                                          |
| R1 rate    | At every matched time and seed: under-ice eroded area shale > sandstone > granite, each step ≥ 1000 m²                                                                                                                      |
| R2 wider   | Same, floor width shale > sandstone > granite, each step ≥ 5 m                                                                                                                                                              |
| R3 steeper | Same, steepest wall granite > sandstone > shale, each step ≥ 2°                                                                                                                                                             |
| R4 deeper  | Same, floor lowering shale > sandstone > granite, each step ≥ 5 m                                                                                                                                                           |
| S1 shape   | Rate versus shape: at equal eroded area (the smallest granite horizon value), the steepest granite wall is steeper than the steepest shale wall by ≥ 3° in every seed. Pass → rock changes the **shape**, not only the rate |
| K1         | No-ice control: zero erosion and zero ice                                                                                                                                                                                   |
| K2         | No-erosion control: zero erosion, floor width unchanged, ice present                                                                                                                                                        |
| N1         | Half-step check: floor width, floor elevation and steepest wall change by less than the R2–R4 gaps; eroded area by < 5 %                                                                                                    |

The thresholds and the horizon were fixed after the pilot runs recorded in [feasibility.md](feasibility.md),
before the registered run; they are legibility/resolution choices, and the pilots are part of the record.

A claim the protocol does not pass is not taught. A failed arm stays in the record.
