<!-- expert-review -->

# Snapshot probes and analysis

Implementation of the engineering metric definitions in
[validation-spec.md](../../../../docs/science/validation-spec.md), with stock and
flux units from [model.md](../../../../docs/science/model.md). Those documents cite
the process/conservation sources. Synthetic tests check metric arithmetic only;
real-solver behaviour, calibration and expert scientific approval remain pending.

All functions are exported through `@hachure/terrain`. `probe(snapshot, request)`
uses the existing public `ProbeRequest`/`ProbeResultFor` contract. Analysis helpers
have their own exported typed inputs/results. No helper advances or modifies state.
Missing required layers, non-finite sampled fields and invalid spatial requests
throw rather than silently substituting zero. A partial snapshot need include only
the layers used by the requested metric.

- `sampleProfile` supports bent polylines and cross-sections, uniformly spaced in
  arc length with cell-centred bilinear interpolation of bedrock, loose sediment
  and water. The outer half-cell extends the nearest centre; no extrapolation is
  implied. Requests must stay inside the half-open grid domain.
- `extractChannel` begins at the cell containing the supplied spring. It follows
  the largest strictly downward ground slope, dividing diagonal drops by the
  diagonal distance. Equal slopes choose row-major neighbours. Outlet arrival is
  complete; another boundary, pit or repeated cell is incomplete.
- Optional `fallback: "d8-accumulation"` retries the **whole** source path using a
  deterministic D8 receiver graph and returns its upstream cell counts (self
  included). Downhill receivers use the same steepest rule. Flat receivers move
  only to equal-height neighbours with smaller row-major index, choosing the
  smallest index. Sorting cells by descending ground elevation, then descending
  index, permits a fixed-order accumulation without cycles. Boundaries and the
  declared outlet are terminal. This rule can drain a flat toward the wrong edge;
  it does not fill pits, cross uphill saddles, select a new source, or splice paths.
  A closed pit remains incomplete. Accumulation counts are a topographic routing
  diagnostic, not measured discharge or evidence of a real river.
- `sampleChannelProfile` samples the supplied path at one-cell arc spacing. It
  omits a final remainder shorter than one cell and rejects paths shorter than a
  cell. Its result does not erase channel completeness: callers retain the
  `ChannelResult` alongside the profile. For paired validation retain the baseline
  path at the specified step; trace the live path separately.
- `halfDepthWidth(snapshot, { row })` samples the fixed east-west row at cell
  centres. It uses the validation specification's central and shoulder strips,
  lower shoulder median, shallow-depth cutoff and interpolated first half-depth
  crossings. Equal minima select the westernmost centre. Unresolved width has no
  numeric width value. This is a morphological ground width, not wetted width.
- `detectKnickpoints` requires one-cell arc spacing. The background uses the twelve
  segments spanning samples `k-6` through `k+6`, excluding segments `k-1 → k` and
  `k → k+1`. It requires four positive background segments, the specified ratio
  and drop, and groups adjacent qualifying indices. Largest ratio wins; exact
  ties choose the upstream index. `resolved` means at least one full background
  window was evaluable; it does not mean a candidate exists or a waterfall forms.
- `knickpointPersistence` reduces a supplied history without hidden state. Each
  track compares with its **initial** arc position, so gradual drift cannot evade
  the two-cell limit. Missing scheduled steps, missing candidates and incomplete
  paths reset affected tracks. Its result describes the latest observation, not a
  latched achievement. An explicit approved-calibration assertion is required;
  `snapshot.simYears` is insufficient. The caller must obtain that assertion from
  the approved calibration provenance described in
  [time-scale.md](../../../../docs/science/time-scale.md). The cadence must represent
  no more than ten years per observation. This slope-break proxy alone never
  establishes resolved falling water or awards a stamp.
- `aggregateBudget` recomputes current suspension stock with a fixed row-major
  float64 reduction and copies cumulative exchanges from the solver ledger.
  `budgetResidual(current, initial)` sums layer **changes**, differences the ledger
  counters, includes initial suspension and tools, and applies the specification's
  absolute/relative acceptance bounds. Relative residual is `null` for zero
  reference volume. Sediment injection requires a separate source ledger before
  it can be supported. Neither erosion nor deposition counters are extra stocks.
- `pointFlux` reads the containing cell. Water discharge is the sum of its four
  **outgoing** pipe discharges; speed comes from the stored velocity components.
  Sediment flux is an instantaneous outgoing estimate `Q × m/h`, zero at or below
  the model's dry-depth guard. **It is not the actual limited sediment transfer**:
  the current snapshot contract lacks pre-routing water, erosion-stage suspension
  and limited sediment-face fluxes. Use the cumulative export ledger for budgets;
  reach-face transfer validation needs a future solver diagnostic. No exact
  instantaneous sediment flux is inferred from data that are absent.

The implementation version is the source commit used by a validation run. Record
it with configs and raw results; never treat the tests here as AC3/AC4 real-solver
validation results.
