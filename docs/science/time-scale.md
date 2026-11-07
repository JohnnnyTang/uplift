<!-- expert-review -->

# Landscape-time calibration proposal

Draft S1/W1/1E, 2026-11-07. **Status: uncalibrated; expert approval pending.**
[Sources](sources.md): [K01] supplies long-term catchment-denudation context;
[W99] supplies channel-incision context. Neither directly calibrates this solver.

## Separate the clocks

The hydraulic solver integrates `dtSimSeconds`, in seconds. Its rain, transport and
relaxation rates always use that step. The displayed landscape clock is an indicative
mapping of model change to elapsed geological time. It does not turn the simulated
rainfall into a continuous storm lasting thousands of years. `morphAccelerationFactor`
is a **clock mapping only** in Stage 1: never multiply the erosion increment by it as
well. That would count acceleration twice and change the calibrated trajectory.
This interpretation must be reconciled with 1A's draft comment before 2A ships.

For `secondsPerYear = 31_557_600`:

`simYearsPerStep = dtSimSeconds × morphAccelerationFactor / secondsPerYear`.

Default factor 1 is a storage sentinel, not a proposed geological calibration. Until
3B produces the record below, show “Landscape time not calibrated” and bind the actual
hydraulic duration if a timer is needed. A numeric approximate-years label is gated
by calibration metadata, not by checking whether the factor is greater than 1.

## Reproducible measurement in 3B

1. Freeze solver commit, config, preset hash, seed, grid, outlet base level and tool log.
   Use the uniform-rock baseline and fixed cross-sections from [validation-spec.md](validation-spec.md).
   Do not use the fixture solver or let a level toggle change the model.
2. Run 2000 hydraulic steps to establish flow. Save the calibration baseline at that
   point, then run 20000 measured steps, with metrics every 200 steps. Reject dry,
   unstable, unresolved or outlet-dominated sections.
3. For each valid section measure minimum-ground-elevation drop from the saved baseline;
   use the median positive drop `D` in metres. Publish individual values as well as the
   median. If no resolved incision occurs, calibration fails; do not substitute a
   convenient number. Repeat seeds 1, 17 and 101.
4. Proposed contextual target `Eref = 0.05 mm/year = 0.00005 m/year`, with a sensitivity
   interval `0.01–0.1 mm/year`. This is an **engineering selection within the order of
   magnitude illustrated by K01 Fig. 2**, not a reported universal fluvial incision
   interval. Catchment-average denudation and local channel incision differ. The domain
   expert must approve the site/process analogy or supply a better incision dataset.
5. Let `N = 20000` measured steps. Compute
   `yearsForRun = D/Eref`, `simYearsPerStep = D/(N Eref)`, and
   `morphAccelerationFactor = simYearsPerStep × secondsPerYear / dtSimSeconds`.
   Store the derived value once in the resolved config, with provenance and approval
   status in preset/calibration metadata. Reject out-of-bounds factors rather than clip.

Arithmetic illustration **only**, not a measured result: if `D=0.1 m` over 20000 steps,
then `yearsForRun=2000`, `simYearsPerStep=0.1`, and for `dt=0.05 s` the factor is
`63_115_200`. The sensitivity targets map the same hypothetical run to 1000–10000 years.
Do not copy these illustrative values into defaults or mark calibration complete.
The three seed-specific mappings must be reported; approve one reference mapping,
then retain it for all paired validation experiments rather than recalibrating each arm.

## Bound wording and playback

After approval, bind the approximate clock to the derived years per step. Suggested
reader wording: “Landscape time ≈ {{scene.elapsedYearsLabel}}; rates are indicative.”
Before approval: “Landscape time not calibrated.” Binding IDs here are proposals for
3A/3D to declare and validate against the spread schema; they are not existing probes.
The “ignores” text must explain calibration, intermittency and spatial scale.

For a playback-time label, let the host's configured scheduled steps per real second
be `stepsPerRealSecond`. Then
`yearsPerRealSecond = stepsPerRealSecond × simYearsPerStep`.
Bind the whole label (for example `scene.timeScaleLabel`), including its speed-dependent
value. Do not infer it from instantaneous frame rate. If the host cannot keep up, show
actual accumulated elapsed time and indicate slower playback; while paused, say paused.
Bind the prediction duration to `scene.durationLabel`, derived from one configured
prediction step count and the same mapping. No fixed duration literal belongs in page text.

## Calibration record and reapproval

3B writes a machine-readable record plus CSV/plots under `docs/science/validation/`:
solver and config hashes; seed; warm-up and measured step counts; sections; raw and
median incision; literature target and interval; seed spread; derived factor; time-label
example; approver and date (pending until supplied). Record why the target is suitable.
K01 shows strong averaging-time dependence, so a single short sediment-gauging rate is
insufficient justification. This clock is not a forecasting claim for a real catchment.

Any change to physics, grid scale, boundary condition, erosion/slump rates or default
rain requires rerunning the record. During a reader experiment retain the approved
reference clock and label it indicative; do not change its meaning to force equal
incision between scenarios. Speed and level changes require no scientific recalibration.
