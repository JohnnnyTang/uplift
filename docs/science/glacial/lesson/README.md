<!-- expert-review -->

# From V to U: lesson claim/source register and fuller limits (session 5L)

The lesson content lives in [`uplift/spreads/geomorph.u-valley/`](../../../../uplift/spreads/geomorph.u-valley/README.md).
This note is the human-readable claim/source register. The machine-readable copy is `claims.ts`, and
`lesson.test.ts` checks it. Every paragraph of reader text names its claims and sources in a review comment.
Every taught claim has a literature source and model evidence. Every registered verdict it relies on passed in
the 5G2 registered run (`docs/review/glacial/model/summary.json`). Claims that are not supported are listed
too, so the text cannot drift into them.

Scope (D-W5-R1 item 3): teach **shape**. The claim is "soft rock wears away faster and deeper; hard rock
keeps steeper walls", plus the V → U change shown by shape. The lesson makes no floor-width claim and no
full-T1 claim.

## Register

| ID  | Status     | Statement (where)                                                                                                        | Sources             | Evidence                                                                                      | Limits                                                                                                                                                      |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | taught     | A river cuts a narrow V-shaped valley (page).                                                                            | BE10                | Authored start (model §1)                                                                     | Background. The starting V is authored, not simulated.                                                                                                      |
| C2  | taught     | Sliding ice wears the rock away, faster with faster sliding (page, deeper).                                              | Hal79, Her15        | K1, K2 pass; model §4                                                                         | One lumped abrasion/quarrying law.                                                                                                                          |
| C3  | taught     | Under the ice the floor is lowered and the lower walls are cut back, towards a U, **by shape** (page).                   | HHR88, Har92, Sed09 | E-T1 shape component: b rises ≥ 0.2 in all 9 arms (+0.25 to +0.37); R4; captures test         | T1 fails in 8 of 9 arms and E-T1 fails in every arm, on the 30 m lowering threshold. Shale's U later opens into a broad trough. Not taught as a finished U. |
| C4  | explained  | Where there is no ice, the V stays as it was (challenge, teacher notes, text alternative).                               | Hal79               | T2 component: floor Δ 0.00 m in every arm; K1                                                 | T2 fails in shale seeds 2–3 only because the growing glacier reached the control section.                                                                   |
| C5  | taught     | Soft rock wears away faster (page, flap).                                                                                | Sel80, Rocks        | R1-rate, E-R1-rate pass                                                                       | Erodibility values are teaching choices; only the ordering is sourced.                                                                                      |
| C6  | taught     | Soft rock is worn deeper, read as floor lowering at matched time (page, flap, prediction answer).                        | Har92, Sel80        | R4-deeper pass                                                                                | Holds at matched time only. E-R4 (equal erosion) fails.                                                                                                     |
| C7  | taught     | Hard rock keeps steeper walls (page, flap).                                                                              | Aug92, Sel80        | S1-shape, E-R3-steeper pass; captures test (registered i = 74 and default cut, last snapshot) | **Not at early matched times.** R3 fails at 100 and 200 model years, when granite has barely been eroded. The flap and the teacher notes say so.            |
| C8  | taught     | Shale is soft, sandstone medium, granite hard (rock names and help).                                                     | Sel80, Aug92        | rock-types.md                                                                                 | Real rock masses vary: a fractured granite can be weaker than a massive sandstone.                                                                          |
| C9  | explained  | An overdeepened basin, where the floor is lower than the floor further down-valley (conditional margin note, deeper).    | CS12                | Captures test (trigger on averaged sections)                                                  | Depth uncalibrated. CS12 was verified at abstract level only.                                                                                               |
| C10 | explained  | Model years, with erosion compressed; never geological years (limitation line, deeper).                                  | Model               | model §4                                                                                      | No calibration is claimed.                                                                                                                                  |
| C11 | explained  | Ice flows by deformation and sliding (deeper).                                                                           | CP10, Wee57         | model §2                                                                                      | Shallow ice; all ice is temperate.                                                                                                                          |
| C12 | explained  | Walls carry part of the ice's weight, so sliding is slowest on the axis; plain shallow ice keeps a V (page uni, deeper). | Nye65, HHR88, Sed09 | shape-factor tests; attempts A0 and A2                                                        | Geometric estimate, flagged for expert review.                                                                                                              |
| C13 | not-taught | "The soft-rock valley has a wider floor."                                                                                | —                   | R2, E-R2 fail                                                                                 | At equal erosion, hard rock has the wider floor.                                                                                                            |
| C14 | not-taught | "Every rock forms a complete U (T1)."                                                                                    | —                   | T1 fails in 8 of 9 arms; E-T1 fails in all 9                                                  | —                                                                                                                                                           |
| C15 | display    | The default front face is a display choice (deeper, teacher notes).                                                      | —                   | D-W5-R1 item 4; test                                                                          | Never the basis of a claim.                                                                                                                                 |
| C16 | explained  | Near the head every rock is lowered far more, yet the floor still rises towards the headwall (teacher notes).            | Model record        | D-5H-R1 (b); captures test                                                                    | A model observation.                                                                                                                                        |

## Owner decisions applied

- **Default front face (R1 item 4).** `U_VALLEY_VIEW.defaultFrontFace` is grid column 51 at the last snapshot.
  `resolveDefaultFrontFace(manifest)` reads it against each capture manifest and throws if the grid does not
  fit. At that cut, averaged over three columns, all three rocks have b > 1.5 (1.74 / 1.60 / 1.61). The floor
  is lowered 57 / 40 / 18 m and the steepest wall is 35 / 42 / 45° (shale / sandstone / granite). At the
  registered section i = 74 (single column, last snapshot) the same orderings hold. The deeper level and the
  teacher notes say that the cut is a display choice and that the claims rest on i = 74.
- **Margin notes (R1 item 9).** The notes are bound templates only. Values come from the section averaged
  over `noteColumns()` (120 m), rounded with `roundForNote()` (10 m). The deeper level says this through
  bound values.
- **Fig. 1 labels (R1 item 7).** valley head, glacier, snout, U-shaped valley, V-shaped valley, valley floor.
  Words only.
- **Comparison.** The copy always says "a separate run with another rock". Time is always "model years".

## Head-basin note (R1 item 5): verification and a finding

**Citation, verified 2026-11-11.** Cook, S. J. & Swift, D. A. (2012). Subglacial basins: their origin and
importance in glacial systems and landscapes. _Earth-Science Reviews_ 115(4), 332–372.
doi:10.1016/j.earscirev.2012.09.009. The authors, title, journal, volume, issue, pages and DOI match the
University of Sheffield White Rose eprint 100951 (the author-accepted manuscript) and the University of
Dundee research portal record. Only the abstract was read. The manuscript PDF (about 11 MB, with embedded
font encodings) could not be fetched or decoded as text in this session.

The abstract supports these statements:

- Valley and outlet glaciers "overdeepen" their beds, eroding closed basins below local base level.
- To leave such a basin, ice, water and sediment must ascend an adverse slope.

The abstract does not address where in a valley such basins form, or the role of lithology. The note
therefore attributes neither to CS12.

**Finding: the trigger the owner specified does not fire where the owner expected.** I evaluated the R1
definition ("the bed rises down-valley from the section") on the recorded seed-1 runs, using the
three-column-averaged floor:

- **Granite:** no adverse rise anywhere in the valley at any snapshot. Near the head, granite is lowered by
  100–160 m, but the starting floor rises steeply towards the headwall, so the floor still rises up-valley.
- **Shale:** an adverse rise of up to about 8 m, at columns about 20–47 at 200–300 model years. This is the
  lower trough above the snout, not the valley head.
- **Sandstone:** at most about 3 m, at columns 26–36.
- **Head basin, all rocks:** with single-column floors, shale shows rises of 8–16 m in the head basin. These
  are the documented residual ±10 m alternation there. Averaging removes them.

With the threshold set at 5 m (half the note rounding), the note shows only in shale's lower trough late in
the run. It never shows in granite or at the default cut.

The drafted wording ("thick ice near the valley head can carve a basin deeper than the valley below it, even
in hard rock") would therefore be **false wherever the note appears**. The note was refined to say only what
is true where it fires:

- HS: "The ice has worn the floor here lower than the floor further down: a basin, called an overdeepening."
- Uni: "Overdeepened: the floor rises {{probe.adverseRise}} down-valley from here, an adverse slope ice and
  meltwater must climb. Valley glaciers carve such basins; their depth here is not calibrated."

The deep head-basin lowering that worried the R1 review (D-5H-R1 (b): hard rock cut deep near the head) is
not an adverse slope, so the R1 note does not cover it. The teacher notes explain it (C16). A reader-facing
note for the head reach would need a new owner decision. One possible draft: "Near the valley head the ice
is thickest and slides fastest, so every rock is cut down further here." That text is **not wired**. The
expert question of D-5H-R1 (b) stays open.

## Fuller limits (beyond the page's single line)

- This is a simplified process model with no calibration against a real valley. Magnitudes are indicative.
  Erosion is compressed (`erosionSpeedup`), and model years are not geological years.
- Ice flow uses a shallow-ice model with a geometric lateral-drag estimate, not a higher-order stress
  solution. All ice is temperate. A cold-based thin-ice ramp stands in for the thermal regime.
- The mass balance comes from a fixed snowline on the starting bed. The feedback in which erosion lowers the
  glacier surface and shrinks the glacier is omitted, so every rock gets the same ice.
- One lumped erosion law covers abrasion and quarrying. There is no subglacial water, no sediment cover and
  no meltwater incision below the snout.
- Rock walls fail at a fixed critical slope for each rock. Bedding, joints and variation of rock within a
  run are not represented.
- The registered results are three seeds on one grid. The live and captured runs are seed 1. GPU and CPU
  runs differ by millimetres, so comparisons stay at matched times.
- No human classroom test or expert sign-off has been done.

## Open expert questions (unchanged from 5G/5G2/5H/R1, plus one)

1. The area-method lateral-drag estimate and the cold-based ramp (D-W5-5G).
2. The 30 m lowering threshold of T1 (D-W5-5G2).
3. Head-basin lowering and overdeepening (D-5H-R1 (b)). New: the R1 adverse-slope trigger shows the note
   only in shale's lower trough. Is that acceptable, and does the head reach need its own note?
4. Whether "hard rock keeps steeper walls" should be qualified on the page itself, rather than only in the
   flap, given that R3 fails at early matched times.
