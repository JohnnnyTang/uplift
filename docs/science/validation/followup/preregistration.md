<!-- expert-review -->

# Wave 3 mechanism-isolation preregistration

Registered 2026-11-09, before executing the revised arms. Protocol:
`s1-w3-mechanism-isolation-v1`. The Git commit containing this document and the
runner is the immutable registration anchor recorded in every new run.

## Review of the failed experiments

The original eighteen records remain unchanged. Their fixed-section aggradation
cannot be replaced by catchment-total erosion: those measure different things.
The uniform and hard-band budget/geometry measurements are identical. In the
implemented stage-four rule, loose sediment is removed first and hardness only
multiplies demand remaining for exposed bedrock. One metre of initial loose cover
may therefore prevent this experiment from testing rock resistance at all.
Replay will measure minimum band cover and actual band/global bedrock loss.
This is a code-derived hypothesis, not yet an observed exposure measurement.

The seed-one transport runs deliver only 28.0551 and 57.5456 cubic metres to the
measured reach from about 1280 cubic metres initially suspended. The acceptance
margin is 64 cubic metres. With zero initial reach suspension, no erosion and
nonnegative outgoing/suspended stocks, the exact reach balance bounds net deposit
by incoming sediment. Thus this delivered supply cannot meet the margin even if
all of it deposits in the flatter reach. Moving supply nearer the reach tests
local slope response without conditioning the threshold on an observed outcome.

The landscape duration is 1100 hydraulic seconds, not millennia. There is no
supported erosion-rate extrapolation to select a longer horizon or install a
clock. Do not change the horizon, rate constants, margins or prediction options.

## Frozen revision and hypotheses

1. Landscape arms (rain-low, rain-high, uniform, hard-band): remove the initial
   uniform one-metre loose cover, retaining the original bedrock array exactly.
   Ground and outlet base level both shift down by one metre; all slopes and
   relief are preserved exactly. Start with zero loose cover; keep hardness, rain
   and all other inputs.
   Hypothesis: exposing rock makes hardness causally active. It does **not** imply
   the incision, narrowing or slope-break criteria will pass. Rain/T6/calibration
   must all be rerun because their initial material also changed. Subsequent loose
   cover and landforms must emerge solely from the unchanged solver.
2. Transport arms: translate the identical water/sediment pulse from rows 24–31
   to rows 56–63, the eight upstream rows immediately adjacent to the measured
   reach beginning at row 64. Preserve columns, pulse volumes, initial terrain,
   downstream slopes, source, rain and zero erosion/slumping. Hypothesis: supply
   attenuation upstream obscures the slope response; adjacent placement increases
   delivery. No requirement that the two arms deliver identical amounts is added.

The layer/exposure reasoning is an adaptation of layered-material erosion in
[Šťava et al. (2008), §§3 and 5](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Stava-2008-Interactive_Terrain_Modeling_Using_Hydraulic_Erosion.pdf),
rechecked for this review. The precise rule is our [model](../../model.md) and
`cpu/kernel.ts`, not a verbatim implementation of that paper. Delivery reasoning
follows the exact stock/face-flux identity in the [validation spec](../../validation-spec.md).
The revised fixture positions are experimental controls, not field measurements.

A pre-execution fixture check found that transferring cover into the float32
bedrock array rounds elevations across the 256 m exponent boundary by up to
0.00001526 m. Uniform cover removal avoids this rounding confound; relative
geometry is exact. This correction precedes registration and all simulation runs.

## Execution, stopping and interpretation

Run **36 arms**: all six original arms and all six revised arms for seeds 1, 17, 101. Use the original typed config, 128² grid, 10 m cells, fixed 0.05 s timestep,
200-step samples, 2000-step path/calibration baseline, 22000 landscape steps and
10000 transport steps. No stopping early for success, seed exclusion, parameter
search or post-result extension. Stability rejection stops that arm and is a failure;
retain partial evidence and continue other arms. Record source/config/state hashes.

Original replays must reproduce final hashes and scientific measurements; added
passive diagnostics must not change the solver. New samples additionally record
band cover, bedrock loss and wet exposed band cells. Keep the existing JSON/CSV
retention schedule: metrics every 200 steps; full section/profile rows at initial,
baseline and endpoint. Full terrain snapshots are not archived; this declared
retention limitation also applies here. No new solver or GPU equations are changed.

Recompute **unchanged** AC3a/AC3b/AC3c/T6 predicates for all seeds, separately for
original and revised packets. Calibration uses the original window and proposed
analogy, remains unapproved, and cannot authorize years or knickpoint persistence.
Report effect sizes even if a margin fails. Run a separate nonzero acceptance gate
when any required scientific predicate fails. Tests of evidence integrity do not
count as scientific acceptance.

This is an agent-reviewed experimental revision, pending domain-expert review.
It is not an approved replacement of the original lesson or Wave 3 gates. Any
success applies only to the revised material/supply conditions. Keep the original
public status, null prediction answer, hidden landscape years and pending challenge.
Further revisions require another prospective registration; do not tune this one.

## Reproduction

`node hachure/terrain/src/validation/run.mjs --followup`

Outputs are isolated under `followup/baseline-replay/` and `followup/revised/`.
Assessment and the post-run report will be committed separately after registration.
