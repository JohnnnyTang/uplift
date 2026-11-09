<!-- expert-review -->

Investigate how flow, sediment transport and resistance interact to change a valley. Compare rainfall experiments from the same starting terrain and seed, at the same model duration. Read incision separately from exported sediment: a lowered section does not tell us where all its material went. (Model; Validation)

The implemented transport capacity depends on flow speed and ground slope. Erosion and deposition transfer material toward that capacity; hardness reduces exposed-bedrock erosion, while loose cover remains mobile. Conservative face transfers carry suspended material between cells. These are simplified process rules, not a calibrated prediction for a real catchment. (Model; S08; FV)

For comparison, the stream-power relation below describes incision E using drainage area A, channel slope S, exponents m and n, and erodibility K. It is not this solver's capacity equation. K has no established mapping to the live erosion-rate control. (W99; Model)

Rain: {{control.rain}}. Fixed-section incision: {{probe.incisionDepth}}. Exported sediment: {{probe.sedimentOut}}. Cell width: {{scene.metresPerCell}}. Clock: {{scene.timeScale}}. Grid resolution and the distinction between hydraulic time and landscape time limit the interpretation. (Validation; Calibration)
