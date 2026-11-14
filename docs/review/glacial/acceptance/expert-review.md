<!-- expert-review -->

# Expert-review packet: _From V to U_ (session 5N)

**Status: pending.** No geomorphologist or glaciologist has reviewed this lesson. Nothing below is signed
off. This packet gathers what an expert needs in one place: every scientific claim the reader sees, where
it is marked `<!-- expert-review -->`, the source it cites, the model evidence (re-run by 5N on production
code), and the open questions. The authoritative claim register is
[docs/science/glacial/lesson/README.md](../../../science/glacial/lesson/README.md) (`claims.ts` in code,
checked by `lesson.test.ts`); the sources are [sources.md](../../../../uplift/spreads/geomorph.u-valley/sources.md)
and [docs/science/glacial/sources.md](../../../science/glacial/sources.md).

## What the reader sees (default level), verbatim

Page text (`uplift/spreads/geomorph.u-valley/page.hs.md`, marked expert-review):

1. "A river cuts a narrow valley shaped like a V." (C1; BE10)
2. "When a glacier fills the valley, the sliding ice wears the rock away: the floor is lowered and the lower
   walls are cut back, towards a U." (C2, C3; Hal79, Her15, HHR88, Har92)
3. "Choose the rock: soft rock wears away faster and deeper; hard rock keeps steeper walls." (C5, C6, C7;
   Sel80, Aug92)

Flap answer (`flap.hs.md`): shale is lowered most after the same model time; granite keeps steeper walls,
"compare the walls once both have been cut". University page (`page.uni.md`): sliding slowest on the axis
because the walls carry part of the ice's weight; "after equal erosion, harder rock keeps steeper walls".
Conditional margin note (C9; CS12): "The ice has worn the floor here lower than the floor further down: a
basin, called an overdeepening." Limitation line (C10): "Simplified model; time is compressed."
Text alternative (5K): "closer to a U / closer to a V (shape b; a V is about 1, a U about 2)".

## The evidence behind each taught claim, re-run in 5N

The registered protocol ([acceptance-protocol.md](../../../science/glacial/acceptance-protocol.md)) was re-run
on production code at commit `b82dae5`; every arm reproduced the 5G2 record bitwise and all 39 verdicts came
out identical ([validation README](../../../science/validation/glacial-valley/README.md)).

| Claim (page)                                | Relies on            | 5N rerun                                                                                                         |
| ------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| C2 sliding ice erodes; none without ice     | K1, K2               | pass (0 m³ eroded without ice or without erosion)                                                                |
| C3 V → towards a U, by shape                | E-T1 b component; R4 | b rises +0.25 to +0.37 at matched erosion in all 9 arms; full E-T1 fails on the 30 m lowering threshold          |
| C5 soft rock wears faster                   | R1, E-R1             | pass (smallest eroded-area step 4 001 m² ≥ 1 000; time to equal erosion 85 / 151 / 300 model years)              |
| C6 soft rock worn deeper (matched time)     | R4                   | pass (smallest step 10.2 m ≥ 5)                                                                                  |
| C7 hard rock keeps steeper walls            | S1, E-R3 (not R3)    | S1 pass: granite 45.9–46.7° vs shale 34.6° at equal erosion; E-R3 pass (3.7° ≥ 2); **R3 fails at 100 and 200 y** |
| not taught: wider floor in soft rock        | R2, E-R2             | fail (hard rock ends with the wider floor)                                                                       |
| not taught: a complete U in every rock (T1) | T1                   | fail in 8 of 9 arms                                                                                              |

The live page reproduces C6 at a matched time: in `e2e/glacial-acceptance.spec.ts` (journey), at the
registered section i = 74 and 100 model years, the bound notes read shale lowered 30 m against granite 10 m
(CPU worker, bundled Chromium; registered seed-1 values 30.7 m and 7.1 m).

## Questions for the expert

1. **Lateral drag.** The U needs a per-column area-method shape factor (plain shallow ice keeps the V,
   attempt A0, re-run here). Is a geometric shape factor acceptable for a teaching model, or does the
   lesson need a higher-order (iSOSIA-type) solution? (D-W5-5G)
2. **Cold-based ramp** (ice < 40 m does not slide, ramp to 120 m) and the 200 kPa stress cap. (D-W5-5G)
3. **The 30 m lowering threshold of T1** decides every T1/E-T1 failure except shale's b. Is "towards a U, by
   shape" an honest summary of a section that widens and steepens but lowers 18–27 m at matched erosion?
   (D-W5-5G2)
4. **"Hard rock keeps steeper walls" at early times.** R3 fails at 100 and 200 model years (granite has hardly
   been cut; walls 34.0° vs shale 34.7° at 100 y, seed 1). The flap qualifies it; should the page sentence?
5. **Shale at the registered section late in the run.** At 300 model years shale's b at i = 74 falls below the
   start (0.77–1.14 against 1.16–1.18) as the walls retreat into a broad trough; the text alternative will then
   say "closer to a V than a U" there. Is that a correct reading of a wide, flat-floored trough, or does the
   power-law fit mislead for broad troughs?
6. **Overdeepening note** fires only in shale's lower trough (rise ≤ ~8 m, 240–300 model years); the head
   reach is lowered 100–230 m but never has an adverse slope. Is the note's wording right, and does the head
   reach need its own note? (D-W5-R1a item 1; C16 draft unwired)
7. **Rock values.** Erodibility 2 / 1 / 0.4 and critical wall 34° / 42° / 55° are teaching choices; only the
   ordering is sourced (Sel80, Aug92). Acceptable?
8. **Citations not re-read against full texts:** Har92, Hal79, Her15, Nye65, Wee57, Sve59, Sel80, Aug92 (5G
   register); CS12 abstract only.

## How to review

`pnpm dev`, open the default route; switch to University level for equations, bound parameters and run
graphs. The registered evidence: `docs/science/validation/glacial-valley/results.json` (every arm and verdict),
`docs/review/glacial/model/` (sections and plan views, 5G2), `docs/science/glacial/feasibility.md` (every
failed attempt). Record the review as a new DECISIONS.md entry; do not edit this packet's evidence.
