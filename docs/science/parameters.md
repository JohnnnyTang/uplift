<!-- expert-review -->

# Parameters, units and reader clamps

Draft S1/W1/1E, 2026-11-07. Names match the 1A draft at commit `716c4bb`.
References: [sources.md](sources.md). This table is the proposed source of defaults
for 2A/2B; this session does not edit the parallel 1A contract or its fake solver.

**Evidence labels.** P = physical reference; E = engineering choice for this model;
C = pending calibration. An E interval is a proposed admissible experiment range,
not a literature measurement. Citations identify the governing method or constraint;
they do not imply that a paper supplies our numeric defaults. Expert review and 3B
validation may narrow these intervals. Enforce joint stability conditions in
[model.md](model.md), not only independent min/max tests. None is release calibration.

## Every TerrainConfig field

| Field                        | Units                                        | Proposed default         | Proposed admissible range           | Basis                                                                                                                         |
| ---------------------------- | -------------------------------------------- | ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `gridSize`                   | cells per side                               | 128 CPU; 256 GPU target  | 32–512 integers; fixtures may use 8 | E: handoff performance targets; 1B/5A must measure                                                                            |
| `metresPerCell`              | m                                            | 10                       | 1–20                                | E: idealised catchment scale, [model.md](model.md); recalculate pipe area and CFL when changed                                |
| `seed`                       | unsigned integer                             | 1                        | 0–4294967295                        | E: deterministic replay, no physical interpretation                                                                           |
| `rainMmPerHr`                | mm/h effective rainfall                      | 10                       | 0–50                                | E: bounded storm experiments; [R] supplies rainfall units/intensity context, not this upper limit                             |
| `gravityMPerS2`              | m/s²                                         | 9.81                     | fixed 9.81                          | P: rounded conventional standard 9.80665 [G]; not a gravity slider                                                            |
| `pipeAreaM2`                 | m²                                           | 20 at cell side 10 m     | 0.01–100, subject to CFL            | E: virtual cross-section, not a surveyed river section [M07, S08 §4]; candidate scaling `0.2 × metresPerCell²`                |
| `dtSimSeconds`               | hydraulic s/step                             | 0.05                     | 0.0001–0.05, subject to guards      | E: explicit update [FV, SW]; fixed per run, not a reader speed control                                                        |
| `morphAccelerationFactor`    | dimensionless clock mapping                  | 1, uncalibrated sentinel | 1–1e9 as storage bounds only        | C: derive from measured incision, [time-scale.md](time-scale.md); outside storage bounds requires review, never clipping      |
| `capacityCoefficient`        | dimensionless with explicit reference scales | 0.01                     | 0–0.1                               | E: [S08 §5.1] motivates dependence; our normalisation uses 1 m and 1 m/s, so paper constants are not imported as measurements |
| `erosionRatePerS`            | hydraulic s⁻¹                                | 0.5                      | 0–1                                 | E: relaxation to capacity [M07, S08]; bounded by `rate × dt ≤ 1`                                                              |
| `depositionRatePerS`         | hydraulic s⁻¹                                | 1                        | 0–2                                 | E: relaxation to capacity [M07, S08]; same bound                                                                              |
| `hardnessRange`              | dimensionless `[min,max]`                    | `[0,0.9]`                | `0 ≤ min ≤ max ≤ 1`                 | E: exposed-rock multiplier `1-r`, [model.md](model.md); no conversion to Mohs hardness                                        |
| `talusAngleDeg`              | degrees from horizontal                      | 33                       | 30–42                               | P/E: cohesionless-material context [A]; choice 33 is provisional, not a universal rock angle                                  |
| `thermalRatePerS`            | hydraulic s⁻¹                                | 0.15                     | 0–1                                 | E: loose-layer relaxation [S08 §5.3], with `4 rate × dt ≤ 1`                                                                  |
| `evaporationFractionPerStep` | fraction/step                                | 0.00001                  | 0–0.0001 at default dt              | E: drying mechanism [model.md](model.md); no climatic evaporation claim                                                       |
| `brushMaxHeightM`            | m/application                                | 5                        | 0–5                                 | E: interaction bound; deposited loose material, budgeted as tool input                                                        |
| `brushMaxDepthM`             | m/application                                | 5                        | 0–5                                 | E: interaction bound; remove loose material before rock, budget tool output                                                   |
| `brushMaxRadiusM`            | m                                            | 200                      | 10–200 at default grid              | E: minimum one cell, at most one quarter of domain width                                                                      |
| `brushMaxSlopeDeg`           | degrees                                      | 60                       | 1–60                                | E: terrain-edit guard, not stable talus; steep edited faces are artificial                                                    |

`simYearsPerStep` is derived, not an independent config field:
`dtSimSeconds × morphAccelerationFactor / 31_557_600`. It is meaningful as landscape
time only after the calibration status is approved. `31_557_600` is the Julian-year
conversion used by the 1A contract (365.25 days); it is a convention, not an erosion rate.

## Reader controls and joint clamps

| Control                          | Initial value       | Reader clamp                                                      | Behaviour and source                                                                                   |
| -------------------------------- | ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Rain                             | config rain         | 0–50 mm/h, step 1                                                 | All effective input becomes runoff; no claim of continuous millennial storms [R, ignores.md]           |
| Harden brush                     | preset hardness 0.2 | 0–0.9, step 0.05; also within config hardness range               | Writes exposed-column hardness; 0.8 is the hard-band validation value; dimensionless engineering scale |
| Raise                            | 1 m/application     | 0–`brushMaxHeightM`                                               | Add loose sediment; obey slope/radius guards and account for actual volume                             |
| Dig                              | 1 m/application     | 0–`brushMaxDepthM`                                                | Remove sediment then rock; obey guards and account for actual volume                                   |
| Brush radius                     | 50 m                | `metresPerCell`–`min(brushMaxRadiusM,gridSize × metresPerCell/4)` | If empty, disable brush and explain; recompute on grid changes                                         |
| Preset downslope angle           | 5°                  | 1–10°                                                             | Initial-condition experiment, reset required; set in typed preset config, not spread prose             |
| Local slope after a terrain edit | current field       | at most `brushMaxSlopeDeg`                                        | Limit actual applied height; announce a clamp hit; steep cuts are acknowledged as artificial           |

Slope is a **preset** parameter, not an extra `TerrainConfig` field in 1A. Keep it in
one typed preset definition with units (`slopeDeg`); no parallel duplicate on the page.
Hardness 1 is reserved for an immobile-bedrock fixture; readers are capped below it.
Raise/dig clamps apply to each operation, so repeated editing can still create an
unrealistic landscape. Announce cumulative extremes; these limits do not certify realism.
All values and limits printed in reader UI must bind to the actual config/control values.

## Numerical constants and review changes

`dryDepthM = 1e-6`, reference capacity thickness 1 m, reference speed 1 m/s, wave
safety factor 0.5 and cardinal degree 4 are named solver constants from [model.md](model.md).
Keep one shared definition across CPU/GPU, not separate literals per backend.
At `dt=0.05`, the candidate evaporation fraction has an e-folding time of about
5000 hydraulic seconds; it is intentionally an experimental sink, not field weather.
Changing `dt` while preserving drying rate requires `fNew = 1-(1-fOld)^(dtNew/dtOld)`.

Compared with 1A placeholders, the proposed capacity coefficient is 0.01 rather than 1,
and evaporation fraction is 0.00001 rather than 0.015. The latter placeholder would
remove shallow rainwater too quickly to treat it as a credible default without tests.
No qualitative outcome is assumed from these proposals. 2A implements them; 3B tests
and calibrates them, records all changes and sends out-of-range values for review.
