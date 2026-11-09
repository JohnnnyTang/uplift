<!-- expert-review -->

# Terrain process model — implementation brief

Draft for S1/W1/1E, 2026-11-07. Tier: **process model**, with indicative magnitudes.
This is a proposed discretisation for 2A, not evidence that a solver passes validation.
References use the keys in [sources.md](sources.md). Read [parameters.md](parameters.md),
[validation-spec.md](validation-spec.md) and [time-scale.md](time-scale.md) together.

## Wave 3 prerequisite: resistance before calibration

The frictionless Wave 2 update failed timestep refinement (D-2A-1). The corrected
implementation adds Manning-style resistance and uses donor-area face velocities.
[hydraulic-resistance.md](hydraulic-resistance.md) derives the mapping, documents its
limitations, and reports equal-duration refinement. The default wave policy is now
`halt`; `report` is diagnostic-only and cannot support scientific acceptance.
Roughness, quantitative landscape years and qualitative claims remain unapproved.

## State, units and boundaries

Match 1A's draft `TerrainConfig` and `TerrainState`. Let cell side `l = metresPerCell`,
area `a = l²`, and fixed hydraulic step `dt = dtSimSeconds`. Bedrock elevation `b`, loose
sediment thickness `s`, water depth `h`, and suspended equivalent settled thickness `m`
are metres; ground `z = b + s`, free surface `H = z + h`. Hardness `r` is dimensionless.
Each of four outward pipe discharges `q_ij` is m³/s. Suspended concentration `c = m/h`
is a solid-volume/water-volume ratio, not kg/m³. Treat rock and sediment as the same
solid-volume equivalent: no porosity or density change. Negative bedrock elevation is
valid; negative `s`, `h` or `m` is not.

Use row-major cells, x east, y south. Four cardinal neighbours share hydraulic faces.
All external faces are closed except one declared outlet face on the outlet cell.
For corner outlets choose south, east, north, west in that priority order. The outlet
has a fixed receiving water surface equal to its initial ground elevation; permit
outflow only, with no incoming sediment. Other boundary faces have zero discharge.
No solid slumping crosses the boundary. Record that base level in the preset metadata.
This boundary prescription is our engineering choice, not a result from [M07].

Use separate input/output buffers for each stage. Gather neighbours in a fixed order;
never update neighbours in place. All exchanges use the same stored face transfer on
both sides. CPU budgets use float64; GPU reductions need fixed ordering. Neither solver
may use an order-dependent floating-point atomic sum as its reproducibility mechanism.

## One fixed step, in order

### 1. Add rain and sources

`hR_i = h_i + dt × (rainMmPerHr / 3_600_000 + Qsource_i/a)`.

`Qsource` is m³/s from a spring or equivalent local rain source. Increment rain and
source counters by their actual added volumes separately. Rain is effective surface
input: infiltration is omitted. Unit conversion follows [R]; addition follows the
pipe-model pipeline [M07, S08]. Do not multiply this input by landscape years.

### 2. Virtual pipes and water balance

For each face, using `H = z + hR`, propose

`q*_ij = max(0, qOld_ij + dt × pipeAreaM2 × gravityMPerS2 × (H_i-H_j)/l)`.

Before limiting, replace each predictor with the positive root of
`q + beta q² = q*`, using `Aflow = l hR_i`, `R = Aflow/(l+2hR_i)` and
`beta = dt pipeAreaM2 g n²/(Aflow² R^(4/3))`. Set outgoing flow to zero at
`hR_i ≤ dryDepthM`. Here `n = manningNSPerMOneThird`; see the linked derivation.
Then let `k_i = min(1, a hR_i / (dt Σ_j q*_ij))`, taking `k_i = 1` when the sum is zero.
Set `q_ij = k_i q*_ij`, then gather

`hW_i = hR_i + dt/a × (Σ_j q_ji - Σ_j q_ij)`.

Include outlet outflow in the donor sum; increment `outflowedWaterM3`. Closed faces
are zero even if old flux buffers contain nonzero values. This adapts virtual-pipe
routing [M07; S08 §4]. The limiter preserves donor water; it is not a proof of wave
accuracy or general stability. Reject a nonfinite step rather than hiding it by clamps.

### 3. Velocity

For each directed face define `v_ij = q_ij/(l max(hR_i,dryDepthM))`, using
its donor's area, exactly as in the resistance term. Closed faces contribute zero.
The cell's eastward velocity is half the sum of the net signed west and east face
velocities; southward velocity analogously averages north/south faces. In uniform
flow this recovers `q/(lh)`. Use zero velocity when `(hR+hW)/2 ≤ dryDepthM`.

This is our reconstruction, replacing the former net-discharge/mean-depth ratio:
that ratio at a newly wet receiver can produce `l/dt` regardless of how slowly
its donor flows. Face speeds instead share the resistance geometry and remain
bounded in the refinement regression. It is a process-model velocity, not a full
momentum-conserving shallow-water reconstruction. `dryDepthM = 1e-6 m` is numerical.

### 4. Capacity, erosion and deposition

Estimate ground slope `p = |∇z|`, `sinθ = p/sqrt(1+p²)`. Proposed capacity in metres:

`C_i = capacityCoefficient × (1 m) × sinθ × sqrt(u²+v²)/(1 m/s)`.

Set `C = 0` when `hW ≤ dryDepthM`. The explicit reference units make 1A's dimensionless
coefficient consistent with an equivalent-thickness stock. They are our normalisation;
the coefficient is not a transferable measured sediment-transport constant.
Capacity dependence on speed and slope follows [S08 eq. 2; M07].

For `C > m`, let `demand = min(1, erosionRatePerS × dt) × (C-m)`.
Remove `eLoose = min(s, demand)` first, then
`eRock = (1-r) × (demand-eLoose)` from bedrock. Add `eLoose+eRock` to `m`.
For `m > C`, transfer `d = min(1, depositionRatePerS × dt) × (m-C)` from `m` to `s`.
Increment `erodedM3` or `depositedM3` by the actual thickness transfer times `a`.
Hardness acts on exposed bedrock, not on the overlying mobile sediment. This two-stock
exchange and hardness rule are our simplified adaptation of [S08 §5.1]; no cohesion,
grain sorting or sediment shielding law is implied.

The stream-power relation `E = K A^m S^n` from [W99] may be discussed as a comparison
at university level. It is **not** the implemented capacity law, and its `K` cannot be
labelled as the live `erosionRatePerS` without a separately defined dimensional mapping.

### 5. Conservative flux-form sediment transport

This replaces back-tracing; do not copy semi-Lagrangian transport from [M07/S08].
Use the donor's erosion-stage `mE`, the water stock **before routing**, `hR`, and the
already limited pipe fluxes from stage 2:

`c_i = mE_i / max(hR_i, hW_i, dryDepthM)`; `F*_ij = q_ij c_i` (m³ solid/s).

Apply `β_i = min(1, a mE_i / (dt Σ_j F*_ij))`, or 1 for zero sum, and store
`F_ij = β_i F*_ij`. Gather

`mT_i = mE_i + dt/a × (Σ_j F_ji - Σ_j F_ij)`.

Record the identical outlet solid transfer in `exportedSedimentM3`. This is our
first-order donor-cell flux adaptation of conservation form [FV]. Using the larger
water depth avoids excessive concentration when a cell drains; the donor limiter
is still mandatory. Test this choice on draining and filling cells. Each face's debit
and credit cancel exactly algebraically; roundoff is measured by the budget test.
Do not erase negative sediment after transport to conceal a broken scheme. Greater
accuracy may require a conservative higher-order limiter, to be decided from 3B results.

### 6. Thermal slumping of loose material

For each lower cardinal neighbour compute
`e_ij = max(0, z_i-z_j-l tan(talusAngleDeg))`.
Propose thickness transfer `t*_ij = thermalRatePerS × dt × e_ij / 2`, scale all
outgoing transfers together so their sum cannot exceed `s_i`, then gather debits and
credits into `s`. Bedrock and suspended stock do not slump. The factor 1/2 avoids
overshooting equalisation on an isolated equal-area pair; the many-neighbour case
still needs the time-step bound below. This is our conservative loose-layer variant
of slope-threshold relaxation [S08 §5.3], not resolved rockfall or thermal physics.
A bare-bedrock valley may therefore fail to widen: report that result honestly.

### 7. Evaporation and stranded sediment

`hNew = (1-evaporationFractionPerStep) hW`. Increment evaporated water by the actual
removed volume. If `hNew ≤ dryDepthM`, deposit **all** remaining `mT` into `s` and
increment `depositedM3`. Keep the small residual water (unless its removal is also
counted as evaporation). Otherwise retain `mT`: water loss increases concentration.
Stranding is our budget-preserving dry-cell rule, not a physical evaporation law.
[S08 §5.2] motivates material deposition as water disappears; its dissolution model
is not implemented here.

## Fixed-step stability and failure policy

Require the following for every accepted step (engineering safety factor 0.5):

- Wave guard: `dt [(|u|+sqrt(g h))/l + (|v|+sqrt(g h))/l] ≤ 0.5` [SW, FV].
- Donor transport guard: `dt Σ_j q_ij / (a max(hR_i,dryDepthM)) ≤ 1`, with the
  sediment donor limiter above. This is a flux-volume CFL/positivity condition.
- Reaction guards: `dt × max(erosionRatePerS,depositionRatePerS) ≤ 1` and
  `dt × thermalRatePerS × 4 ≤ 1`. Evaporation fraction is in `[0,1)`.

The shallow-water wave guard is a conservative diagnostic for this pipe approximation,
not a claim that it solves the full shallow-water equations. The default time step is
only a candidate until 2A's stress tests cover the permitted controls. On violation,
pause with a diagnostic; rerun from reset at a smaller fixed step recorded in config.
Do not vary the time step silently, speed it up for low frame rate, or use calibrated
landscape years inside the hydraulic kernels. Revisit bounds if pipe area or grid scale
changes. CPU and GPU must use the same stage order, constants, clamps and guards.

## Conserved quantities

For no tools, `Vsolid = a Σ(b+s+m)` obeys
`Vsolid(t)-Vsolid(0)+exportedSedimentM3 = 0`.
With tools, subtract `toolNetM3`; with sediment sources, explicitly account for them.
Compare changes rather than a huge datum-dependent absolute bedrock volume.
`erodedM3` and `depositedM3` are cumulative exchanges, while `suspendedM3` is a stock;
never add all three as if they were independent inventories.
Water change equals rain plus sources minus evaporation minus outlet discharge.
See [validation-spec.md](validation-spec.md) for residual normalisation and dry tests.
