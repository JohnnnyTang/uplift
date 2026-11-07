<!-- expert-review -->

# What this model ignores — draft at two levels

S1/W1/1E, 2026-11-07. Proposed page copy for 3D, not approved scientific text.
Citations refer to [sources.md](sources.md). Keep a compact visible box at both
levels. A level change changes the explanation only, never these model assumptions.

## High school

- This is a simplified process model. It helps us investigate how moving water and
  loose material change a landscape; it does not predict a particular real valley.
  The same ground data make the flat contours and the raised terrain [model.md].
- All the rain in this model reaches the surface flow. We leave out water soaking
  into soil, groundwater, plants, snow and changes between storms [model.md; R].
- “Hardness” means resistance to erosion in this experiment. It is not a laboratory
  rock-hardness measurement. Loose sediment can move over hard rock [S08; model.md].
- The terrain has one height at each map position. It cannot represent overhangs,
  caves or the falling jet of a waterfall. The challenge detects a persistent steep
  section of the river bed, as a proxy [SW; validation-spec.md].
- The approximate landscape clock is a calibrated comparison, not a real-time
  prediction. Natural erosion varies between places and over time. A model storm
  does not stand for uninterrupted rain throughout the displayed years [K01; time-scale.md].
- We model slope-driven movement of loose sediment, not detailed rockfalls or every
  kind of bank collapse. We leave out glaciers, waves, tectonic uplift and changing
  sea level in this spread [S08; model.md].

Before calibration approval, replace the approximate-clock sentence with:
“Landscape time has not been calibrated yet.” Do not display the numeric years label.
The clock status must come from the same calibration metadata as the time widget.

## University additions

- Flow is a virtual-pipe, depth-averaged approximation; it does not resolve turbulence,
  vertical velocity, hydraulic jumps or three-dimensional free surfaces. Grid scale
  limits channel geometry. A resolved slope break is not proof of a hydraulic waterfall
  [M07, S08, SW].
- Capacity is a speed-and-slope function with experimental reference scales. Erosion
  and deposition relax toward it. We omit grain-size sorting, cohesive entrainment
  thresholds, explicit bedload, density differences, porosity and detailed armouring.
  This is not a numerical implementation of the Hjulström diagram [S08; H35; model.md].
- The stream-power relation is a comparative theory, not the solver equation. The live
  capacity/erosion controls are not measured stream-power coefficients [W99; model.md].
- Sediment transport uses conservative first-order face fluxes, which introduce numerical
  diffusion. The dry-cell threshold and evaporation sink are numerical choices. Slumping
  redistributes loose sediment above a prescribed angle; it does not fracture bedrock
  or solve a soil-mechanical failure model [FV, S08; model.md].
- Except for one prescribed outlet the boundaries are closed. Base level is fixed, with
  no tidal or downstream feedback. The terrain, source and uniform storm are idealised
  initial/boundary conditions [model.md].
- Calibration compares model section incision with a proposed long-term erosion context;
  catchment denudation is not local channel incision. The reference mapping is retained
  when controls change, so landscape rates remain indicative. Independent field prediction
  would require suitable data and validation beyond this demo [K01, W99; time-scale.md].
- Raise and dig introduce or remove material externally and are logged in the solid
  budget. Repeated legal edits can create artificial cliffs or pits; tool clamps do not
  certify physical realism [parameters.md; validation-spec.md].

## Integration notes

`[model.md]`, `[parameters.md]`, `[time-scale.md]` and `[validation-spec.md]` refer to
this science brief, not external authorities. Resolve bibliography keys to reader-facing
source links in 3D. Bind any numeric detail added to page copy to config, scene or probes.
Have the domain expert approve wording and calibration before release. Teachers' notes
should explain the waterfall proxy and the distinction between hydraulic and landscape time.
