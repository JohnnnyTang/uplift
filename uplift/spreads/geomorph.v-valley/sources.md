<!-- expert-review -->

# Sources and the limits of their use

The citation keys in page text resolve below. The local science brief is the authority for what this implementation actually does. Literature motivates mechanisms; it does not validate our experiment, approve calibration or supply every interaction clamp.

## Process rules

| Rule in this spread                                                   | Evidence and implementation boundary                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effective rain and local sources add water                            | R explains rainfall volume and units. Model specifies conversion and omitted infiltration.                                                                                                                                    |
| Virtual pipes route water; wet/dry guards and resistance limit motion | S08 describes pipe exchange and a donor limiter; M07 is the earlier method. Resistance supplies a numerical reference only: the pipe adaptation and roughness envelope require the serial correction in Model and Parameters. |
| Capacity, erosion, deposition and hardness                            | S08 motivates speed/slope capacity and material layers. Model defines our equivalent-volume stocks, exposed-bedrock resistance and relaxation rules.                                                                          |
| Sediment transport and the solid budget                               | FV explains conservative face accounting. Our donor-cell adaptation is specified in Model; the semi-Lagrangian method in S08 is not used.                                                                                     |
| Loose-sediment slumping                                               | S08 motivates slope relaxation. A provides cohesionless-sediment context. Model's loose-only rule is not resolved bank collapse or rockfall.                                                                                  |
| Evaporation and stranded sediment                                     | Model defines the numerical sink and budget-preserving dry-cell deposition; S08 supplies drying context, not our climatic rate.                                                                                               |
| Incision, half-depth width and slope-break proxy                      | Validation defines operational measurements. They are engineering test definitions, not universal geomorphic thresholds. SW explains depth-averaging limitations.                                                             |
| Stream-power relation                                                 | W99 supplies comparative incision theory. It is not the implemented capacity law and supplies no direct mapping for the live erosion-rate parameter.                                                                          |
| Landscape clock                                                       | Calibration requires a measured model result and approved field analogy. The current default is uncalibrated; no numeric geological years are authorised.                                                                     |

## Parameter ranges

Parameters lists every typed field, unit, proposed range and evidence category. Read it with Model's joint stability guards. Numeric reader labels must come from the resolved configuration, never this bibliography.

| Parameter family                                                   | Basis of range or constraint                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rain intensity                                                     | R establishes terminology and volume conversion; the experimental clamp is our provisional engineering choice.                                                                   |
| Gravity                                                            | G supplies conventional gravity; the implementation rounds it.                                                                                                                   |
| Hydraulic roughness and wet/dry convention                         | Resistance is a method reference. The serial correction owns the derived pipe mapping and sourced provisional envelope in Parameters; neither is approved by this content draft. |
| Grid size, cell spacing, virtual-pipe area and fixed step          | Model and Parameters define engineering choices constrained by conservation, stability and performance. They are not surveyed river dimensions.                                  |
| Capacity, erosion/deposition relaxation, hardness and thermal rate | S08 motivates mechanisms; Parameters gives our bounded experimental coefficients, which are not imported field measurements.                                                     |
| Talus angle                                                        | A and S08 provide cohesionless-material context. Parameters records the provisional choice; it is not a universal bedrock-slope limit.                                           |
| Evaporation and dry threshold                                      | Model and Parameters specify numerical choices, not a measured climate.                                                                                                          |
| Brush radius, height, depth, slope, smoothing and hardness         | Parameters defines interaction limits and Tools implements them. Repeated legal edits need not be physically realistic.                                                          |
| Preset slope, seed, boundary/source geometry and playback          | Parameters and Validation define experimental initial conditions. Seed and playback have no physical calibration.                                                                |
| Morphological clock factor                                         | Calibration owns the proposed reference analogy, reproducible measurement and explicit expert approval. Storage bounds are not scientific approval.                              |

## Bibliography

- [Model — Uplift terrain process model: implemented rules and explicit adaptations](../../../docs/science/model.md)
- [Parameters — Uplift typed parameter ranges and reader clamps; provisional engineering bounds](../../../docs/science/parameters.md)
- [Validation — Uplift metric definitions, paired experiments and prediction evidence requirements](../../../docs/science/validation-spec.md)
- [Calibration — Uplift landscape-time proposal and approval requirements](../../../docs/science/time-scale.md)
- [Sources — Uplift verification register and unresolved evidence gaps](../../../docs/science/sources.md)
- [S08 — Šťava, Beneš, Brisbin and Křivánek, Interactive Terrain Modeling Using Hydraulic Erosion](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Stava-2008-Interactive_Terrain_Modeling_Using_Hydraulic_Erosion.pdf)
- [M07 — Mei, Decaudin and Hu, Fast Hydraulic Erosion Simulation and Visualization on GPU](https://evasion.imag.fr/Publications/2007/MDH07/)
- [FV — Ketcheson, LeVeque and del Razo, Riemann Problems and Jupyter Solutions: finite volume methods](https://www.clawpack.org/riemann_book/html/Approximate_solvers.html)
- [SW — Ketcheson, LeVeque and del Razo, The shallow water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html)
- [W99 — Whipple and Tucker, Dynamics of the stream-power river incision model](https://doi.org/10.1029/1999JB900120)
- [R — USGS Water Science School, Rainfall calculator, metric: How much water falls during a storm?](https://water.usgs.gov/edu/activity-howmuchrain-metric.html)
- [G — BIPM, Declaration on the unit of mass and on the definition of weight; conventional gravity](https://www.bipm.org/en/committees/cg/cgpm/3-1901/resolution-2)
- [A — USACE HEC-RAS, Selecting an Angle of Repose in Cohesionless Sediment](https://www.hec.usace.army.mil/confluence/cwmsdocs/rasum/latest/selecting-an-angle-of-repose-in-cohesionless-sediment-271613986.html)
- [Resistance — USACE HEC-RAS, Eulerian shallow-water equation solver: numerical resistance reference](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.4/theoretical-basis-for-one-dimensional-and-two-dimensional-hydrodynamic-calculations/2d-unsteady-flow-hydrodynamics/numerical-methods/eulerian-shallow-water-equation-solver)

- [Results — Uplift reproducible validation packet: failed criteria and inconclusive prediction](https://github.com/JohnnnyTang/uplift/blob/main/docs/science/validation/README.md)

## Verification and review

The S08 paper, FV conservation introduction, SW assumptions and G official declaration were inspected for this content draft. M07's author-lab record verifies its bibliographic identity; original full-text equation checking remains open. W99's identity was corroborated in the author's university profile, while the linked paper/DOI was unavailable during this run; the existing science register records its earlier paper inspection. R and A retain the verification limits documented in Sources. No new numeric value was taken from an inaccessible reference.

Every scientific statement here remains an expert-review draft. Prediction correctness requires the paired real-solver result; a citation cannot substitute for that test. Hydraulic correction, calibration approval and classroom release remain separate gates.
