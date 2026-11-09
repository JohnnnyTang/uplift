<!-- expert-review -->

# Validation specification

**Acceptance interpretation, 2026-11-09:** the owner prioritizes visible causal
relationships and relative outcomes over field magnitudes. The frozen thresholds
below remain unchanged for the original and registered follow-up experiments.
Their pass/fail results are historical diagnostics; they are not the sole release
gate for a qualitative lesson. Future demonstrations follow
[education-policy.md](education-policy.md), with stable directional evidence, visual
legibility and truthful content. Calibration alone is not a qualitative-release gate.

Draft S1/W1/1E, 2026-11-07. These are preregistered **proposed acceptance tests**,
not results. 2F builds metric functions; 3B runs the real solver. Sources and scope:
[model.md](model.md), [S08] for process mechanisms, [W99] for incision context,
[FV] for conservation. Numeric thresholds below are engineering test definitions,
not universal geomorphic thresholds. Expert review is pending.

## Common protocol

Use CPU 128², 10 m cells, 0.05 s fixed step and the proposed defaults in
[parameters.md](parameters.md), with seeds 1, 17, 101 independently. Paired arms use
identical seeds and initial perturbations. Start all runs with zero water, suspended
sediment and pipe flux. Initial ground is `z = 150 + (L-y) tan(5°) + 0.0002(x-L/2)²`,
where x,y are cell-centre metres and `L=gridSize × metresPerCell`. Set loose thickness
1 m, bedrock `z-1 m`, hardness 0.2, and add seeded zero-mean perturbations bounded by
0.01 m to bedrock. This is an initial tilted catchment, not a scripted valley.
Put the outlet at the centre cell of the south edge, with base level defined in
[model.md](model.md). Add a 0.1 m³/s clean-water spring to the centre cell at row 8.
Rain is 10 mm/h unless specified. Implement this setup once in typed preset/fixture
code; reuse it, rather than reproducing literal terrain definitions in spread code.

Save initial state and every 200 steps through step 22000. Measure from initial state
for qualitative tests; the calibration window separately begins at step 2000. Compare
arms at the same step count and reference landscape time; never at equal wall time.
Freeze the exact config and metric definitions before comparing arms. Every test must
pass each seed, finite/nonnegative-stock checks and the mass-budget test. Report failures
and inconclusive results; do not select successful seeds or adjust thresholds after seeing
outcomes. A preregistered revision requires a decision entry and rerunning all arms.

## Metrics shared by tests and probes

- **Incision:** fixed east–west sections at rows 32, 48, 64, 80, 96. Within the fixed
  central strip `0.35L ≤ x ≤ 0.65L`, `I(y,t)=min_x z(x,y,0)-min_x z(x,y,t)`.
  Aggregate as the median across the five sections. Preserve negative values. This is
  minimum-elevation drop, not mean erosion, total exported sediment or a moving section.
- **Half-depth width:** on each same section find its lowest ground point in that strip.
  Shoulder elevations are medians of ground in `[0.2L,0.3L]` and `[0.7L,0.8L]`.
  Set rim to the lower shoulder, depth `d=rim-zmin`. For `d<0.5 m` report unresolved.
  Otherwise find the first crossing on each side of `zmin+d/2`, linearly interpolate,
  and subtract horizontal positions. If either crossing is missing, report unresolved,
  never zero. Compare widths only where both arms are resolved.
- **Channel/profile:** start at the declared spring, follow steepest downward ground
  slope among D8 neighbours, comparing diagonal slopes with distance `sqrt(2)l`.
  Ties use fixed row-major order. Stop at outlet, a pit, boundary or visited cell; flag
  incomplete paths. A D8 accumulation fallback must identify itself and use a documented
  deterministic pit rule. Never silently splice a plausible-looking channel. Sample
  ground on the traced polyline at one-cell arc-length spacing with bilinear interpolation.
  For paired comparisons use the baseline path fixed at step 2000; store the current
  path separately for the live challenge.
- **Knickpoint:** for a candidate profile sample `k`, define local downstream slope
  `Slocal=(z[k-1]-z[k+1])/(2l)`. Background `Sbg` is the median positive segment slope
  over samples `k-6` through `k+6`, excluding the central two segments. Require a complete
  window, `Slocal/max(Sbg,0.001) ≥ 3`, and a local ground drop `z[k-1]-z[k+1] ≥ 1 m`.
  If there are fewer than four positive background segments, report unresolved.
  Group adjacent candidates; choose the largest ratio, breaking ties upstream.
  Persistence means a detected candidate remains within two cells' arc length of its
  initial position at every scheduled observation for **100 calibrated landscape years**.
  A missing candidate, incomplete path or missed observation resets the timer. Require
  observation separation `200 × simYearsPerStep ≤ 10 years`; otherwise increase sampling
  to a fixed smaller step interval before running. Uncalibrated runs may report candidate
  slopes, but cannot earn a geological-time persistence pass or a waterfall stamp.

The slope-break detector is an operational challenge proxy. A depth-averaged heightfield
cannot establish a resolved free-falling waterfall, plunge pool or hydraulic jump [SW].
Synthetic metric fixtures are specified below so probes and challenge use identical rules.

## AC3a — more rain, more incision

Paired uniform-rock runs at 5 and 20 mm/h, everything else fixed. At step 22000 require
`Iwet-Idry ≥ max(0.1 m,0.05 × |Idry|)` and `Iwet>0`. Also require the direction holds
at each of the final three saved samples. This tests our capacity/flow mechanism,
not a claim that every natural basin responds monotonically to rainfall [S08, W99].
Export profiles, section ground elevations, water flux and incision time series.

## AC3b — hard band, slope break and narrower channel

Compare uniform hardness 0.2 with a band of hardness 0.8 across rows 72–75,
all columns. Leave the initial height, loose cover and other inputs identical.
Require a persistent knickpoint in the band or within eight cells upstream of its
upstream edge. Record its exact position; distinguish “at contact” from “upstream”.
The uniform run must not have a persistent candidate in that same reach. At row 74,
use the same half-depth metric and demand `Wband ≤ 0.9 × Wuniform` with a reduction
of at least half a cell; both depths must be resolved. Persistence uses the approved
clock; if step 22000 is too early, report failure under this specification and propose
a longer **fixed** horizon for review, never run only the successful arm longer.

The location expectation is a hypothesis, not guaranteed by every hardness geometry.
If the slope break forms downstream, the upstream acceptance claim has not passed.
Do not insert a terrain step or animate a waterfall to satisfy it. Surface-height
changes must emerge from the process solver. Source: mechanism [S08]; test geometry
and thresholds are our proposal.

## AC3c — reduced slope, greater deposition

Avoid an ambiguous “flatter catchment exported less because it eroded less” test.
Use a companion transport fixture at 128² with 10 m cells: a 5° upstream reach to
row 63, a continuous downstream reach with either 1° or 5° slope, matching elevations
at row 63. Use identical shallow cross-slope convergence, one south outlet and its
initial base level in each arm; no discontinuous height step. Set erosion rate and
thermal rate to zero, all else as default. Preload the same 0.1 m suspended equivalent
thickness over central columns 56–71 in rows 24–31, with 0.5 m water in those cells.
Run 10000 fixed steps with the same clean-water spring and 10 mm/h rain in each arm.

Measure final newly deposited solid volume in rows 64–119 (exclude the outlet zone).
Demand flat-reach deposition exceeds steep-reach deposition by at least 5% of the
initial suspended volume, with nonzero cumulative sediment entry to that reach in both
arms. Record reach-face sediment inflow, outflow and remaining suspended stock so a
pass cannot be caused solely by failure to deliver sediment. Source: capacity mechanism
[S08]; our controlled fixture isolates transport and deposition.

## T6 — test the prediction before choosing its answer

Reuse AC3a rain arms with thermal slumping enabled. At step 22000 compare median
incision and median half-depth width across sections resolved in both arms (at least
three required). “Deeper” requires AC3a's incision margin; “wider” requires an increase
of `max(0.5l,0.05 × Wdry)`. Require the same classification at the final three samples
and across all seeds. “Both” means both predicates pass. A decrease beyond either
margin, insufficient resolved sections, or inconsistent classification is inconclusive.
Do not map an inconclusive result to an answer option. Leave the answer index `TODO(3B)`;
revise the question if the supported behaviour does not fit the options. Export the
classification and config hash for 3D's flap/predict content, not a handwritten answer.

## AC4 — solid and water budgets

No tools, initial suspension as specified by each fixture. Let
`Rsolid = Δ[a Σ(b+s+m)] + exportedSedimentM3` and
`Rwater = Δ[a Σh] - rainedWaterM3 - sourcedWaterM3 + evaporatedWaterM3 + outflowedWaterM3`.
If tools are enabled subtract `toolNetM3` from the solid residual; sediment injection
requires its own explicit source term. Use fixed-order float64 CPU sums of changes.
Set solid reference volume to `max(erodedM3, initial suspended volume, exportedSedimentM3)`
and water reference to `max(initial water volume, rainedWaterM3+sourcedWaterM3)`.
Require each absolute residual `≤ max(1e-6 m³,0.01 × referenceVolume)` at every saved
sample. For zero-throughput fixtures require the 1e-6 absolute bound; do not divide by
zero. Never normalise by total bedrock volume or elevation datum. Log absolute and
relative residuals, plus the reference volume. Source: conservation-form identity [FV].

Include isolated tests: closed flat wet grid; dry cells retaining sediment as deposits;
full draining through the outlet; evaporation with sediment; zero rain; fully hard
bedrock with mobile loose cover; solid-conserving slumping. Count actual transfers;
no stock should vanish at a dry guard or outlet. Tool tests verify the external solid
volume ledger separately. CPU/GPU comparisons in 3C/4A include every changed layer
and budgets, with stated absolute and relative tolerances; they are not bitwise comparisons.

## 2F synthetic fixtures and reproducibility

- Plane `z=100-0.1y`: known constant gradient, no knickpoint; point flux follows a
  prescribed uniform face-flow field. Bilinear long-profile interpolation is exact.
- V section `z=10+0.5|x-x0|` with rim 20 m: depth 10 m and half-depth width 20 m;
  use enough cells to resolve it. Flat/shallow/no-crossing cases must return unresolved.
- Piecewise linear profile with background slope 0.01 and a 2 m drop over two 10 m
  samples: the central two-cell slope meets the ratio/drop thresholds. Verify exact
  candidate index and persistence just below/at 100 years, missing samples and motion
  beyond the allowed reach. Uniform slope and an outlet-edge step must fail.
- Budget fixture moves a known solid volume bedrock → suspended → deposit/export;
  assert stocks and cumulative exchanges separately, including nonzero initial suspension.
- Same seed/input log/step count reproduces all CPU layer bytes and counters exactly.
  GPU repeatability is same device/driver; record them. Repeat after a level toggle;
  no solver method may be called by that view operation.

The validation packet includes configs, hashes, raw CSV, metric implementation version,
all three seeds, pass/fail tables and plots. 3B must report unvalidated or failed claims
before content or challenge release; expert approval is a separate gate from test success.
