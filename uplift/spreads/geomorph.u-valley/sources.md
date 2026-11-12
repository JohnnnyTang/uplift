<!-- expert-review -->

# From V to U: sources and the limits of their use

Citation keys in the deeper level and teacher notes resolve below and in `sources.ts`. The local science
notes are the authority for what the model actually does; the literature motivates the mechanisms, it does
not validate this model. The full claim/source register, with the evidence for each claim, is
[docs/science/glacial/lesson/README.md](../../../docs/science/glacial/lesson/README.md).

## Process rules

| Rule in this lesson                                             | Source basis and boundary                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ice flows by deformation (Glen's law) and basal sliding         | CP10 (standard values), Wee57 (sliding law). Shallow-ice approximation, all ice temperate (Model).                                                           |
| Lateral drag shields the axis; erosion peaks on the lower walls | Nye65, HHR88, Sed09 for the pattern; Model for the geometric area-method estimate used here (an expert-review flag, not a stress solution).                  |
| Erosion grows with sliding speed                                | Hal79 (abrasion theory), Her15 (field exponent near two). One lumped law; abrasion and quarrying are not separated.                                          |
| The cross-section changes from a V towards a U                  | HHR88, Har92 (V → U by glacial erosion), Sve59 and Har92 (power-law shape exponent). Taught by shape only (Results; D-W5-R1 item 3).                         |
| Rock type: erodibility and the steepest stable wall             | Sel80 (rock-mass strength and slope), Aug92 (trough-wall form follows rock-mass strength). The ordering is sourced; the values are teaching choices (Rocks). |
| A fixed snowline supplies the ice                               | Oer01 (linear mass-balance profile). The snowline is authored and fixed; the elevation feedback is omitted (Model).                                          |
| Overdeepened basins                                             | CS12: valley glaciers erode closed basins with adverse bed slopes below the floor further down-valley. Depth in this model is uncalibrated.                  |
| Background: rivers cut V-shaped valleys                         | BE10. The starting V is authored, not simulated.                                                                                                             |

## Parameters

Every number the page shows is bound to the run's configuration or to the model's section measures (see
`bindings.ts`). Physical constants follow CP10. Teaching choices (snowline, erosion time compression, rock
values, cold-based thickness ramp, stress cap) are documented as such in Model and Rocks; none is a
measured constant of a real valley.

## Verification status

- **CS12** (Cook & Swift 2012): bibliographic details (authors, title, Earth-Science Reviews volume 115,
  issue 4, pages 332–372, DOI 10.1016/j.earscirev.2012.09.009) confirmed on 2026-11-11 against the
  White Rose (Sheffield) and Dundee repository records. The abstract was read: closed basins formed by
  glacial erosion beneath valley and outlet glaciers ("overdeepenings"), requiring ice, water and sediment
  to ascend an adverse slope. The full text was not machine-readable in this session; the lesson's note
  therefore claims only what the abstract states. Statements about where in a valley such basins form, or
  how lithology affects them, are not attributed to CS12.
- **HHR88, Sed09**: DOIs from the 5G sources register; Sed09 was read in full by session 5G.
- **Har92, Hal79, Her15, Nye65, Wee57, Sve59, Sel80, Aug92**: bibliographic details from the 5G register
  (docs/science/glacial/sources.md), where their status (abstract or secondary) is recorded. Not re-read
  in this session; an expert should confirm them against the full texts.
- **CP10, Oer01, BE10**: standard references, not re-read in this session.

## Fuller limits

The page carries one limitation line ("Simplified model; time is compressed."). The fuller list is the
"What this model ignores" disclosure (`lesson.ts`), the deeper level, and Model §6–§7. The lesson
register lists the unsupported claims (no floor-width claim, no full trough in every rock) and the open
expert questions.
