<!-- expert-review -->

# Prospective model-step slope-break experiment

Protocol `s1-w4-model-step-slope-break-v1`, registered before execution. The commit
containing this protocol, typed config, tracker and runner is the immutable anchor
written into every result. This is a new exploratory engineering experiment;
previous failed hard-band and exposed-rock records remain unchanged.

Teaching hypothesis: on an exposed-rock starting catchment, a reader-painted hard
band can leave a persistent slope break relative to otherwise identical uniform
rock. A slope-break proxy does not resolve falling water, jets or plunge pools.
Sources: [the implemented model](../../model.md),
[the existing detector specification](../../validation-spec.md),
[education scope](../../education-policy.md), and their S08/SW/W99 references.

## Frozen inputs and intervention

Run all six arms: seeds 1, 17, 101, each with uniform and hard-band treatments.
Use the CPU float64 reference solver, halt on instability, 128² cells, 10 m per
cell, 0.05 hydraulic seconds per step. Use DEFAULT_TERRAIN_CONFIG except rain
50 mm/h, capacity coefficient 0.1 and erosion relaxation 1 per hydraulic second.
These are existing provisional reader bounds, not field constants or calibration.
Use createTiltedPlateauPreset({looseThicknessM: 0}); all other preset options stay
at their existing defaults, including slope, noise, spring, hardness and outlet.
Initial geometry is identical between paired arms. Add the preset's declared spring.

Advance 2000 warmup steps, then apply a row-major sequence of harden brushes:
centres in every column on rows 73 and 74, radius one cell (10 m). The disks' union
covers rows 72 through 75. Set hardness to 0.9 in the hard-band arm and sham-set
0.2 in the uniform arm. No raise, dig, smooth, terrain step, imposed channel or
scripted morphological change is allowed. Save the tool results and confirm tools
change no ground height or external solid-volume ledger. Advance both arms to
step 22000; no early success stop, horizon extension, parameter search, seed exclusion
or post-result adjustment. A stability rejection fails that arm and preserves its
partial output; other arms still run.

## Frozen proxy and acceptance

Use the unchanged detectKnickpoints definition: complete current D8 path from the
spring, cell-spaced ground samples, central two-segment drop at least 1 m, slope
ratio at least 3 relative to the existing background rule. Evaluate candidate
positions only in rows 64 through 75 (the band and up to eight cells upstream),
using linear interpolation along the traced path. Do not substitute another reach
if the candidate appears elsewhere. Retain all candidates separately as diagnostics.

For the new model-time criterion, observe at every 200 steps from the intervention
through the fixed endpoint. A candidate must remain within two cells' arc length of
its initial position for 2000 model steps, with complete, resolved paths at every
observation. Missing observations, missing candidates, unresolved or incomplete
paths, or a new run reset the track. Repeated observations of the same step add no
time. The criterion is model-step persistence, never calibrated geological years.

Numerical gate: all three hard-band arms pass at the fixed endpoint; no uniform
arm passes at any observation. All saved samples have finite/nonnegative stocks,
no stability rejection, and solid/water residuals within the unchanged validation
spec's max(1e-6 m³, 1% throughput reference) bound, computed from float64 stock
changes. Report exact effect sizes and failures, even if no candidate appears.

Teaching release also requires a shared-scale, visibly legible paired comparison
in the actual renderer at desktop/mobile playback size and speed, bound text that
matches the measured effect, and the usual expert/human review gates. A numerical
pass alone cannot enable the real book stamp. If the numerical gate fails, retain
the real spread's pending check and do not manufacture a success view. Synthetic
checker/stamp fixtures demonstrate software behavior only and are labelled as such.

## Retention and reproduction

Commit protocol and runner before executing `node docs/science/validation/challenge/run.mjs`.
Store registration commit, solver/source/config hashes, full effective config, initial/
intervention/final state hashes, tools/results, diagnostics and every scheduled
profile/candidate/budget/residual observation. Full terrain snapshots are not retained;
the fixed seed, config and tool log reproduce them. Run all six arms exactly once
for this protocol. A numerical failure is a failed scientific gate, independent of
passing software tests.
