<!-- expert-review -->

# Hydraulic resistance correction — S1/W3 prerequisite

Draft, 2026-11-09. Engineering validation passed; expert approval is pending.
This corrects the D-2A-1 counterexample; it does not approve geological rates.

## Derivation for the pipe variables

Let A be the configured virtual pipe area, l the cell width, h the donor depth
after rain, and S = (Hdonor − Hreceiver)/l. The original inertial equation is
`dq/dt = A g S`, with q in m³/s. A is an inertial parameter, not the wetted area.
Choose a cell-wide rectangular flow section: `Af = l h`, wetted perimeter
`P = l + 2h`, hydraulic radius `R = Af/P`, and directed face speed `v = q/Af`.
The rectangular section is our subgrid convention, not a resolved channel.

[USACE's hydraulic equations](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.6/theoretical-basis-for-one-dimensional-and-two-dimensional-hydrodynamic-calculations/1d-unsteady-flow-hydrodynamics/semi-implicit-finite-volume-scheme/hydraulic-equations-1d-fv) give the SI Manning friction slope `Sf = n² v|v| / R^(4/3)`.
Subtract this slope in the existing pipe equation:

`dq/dt = A g [S − n² q|q|/(Af² R^(4/3))]`.

This preserves the pipe inertia while giving stationary discharge
`q = Af R^(2/3) sqrt(S)/n` for positive S. Equating A with Af would silently
change the original pressure acceleration. The chosen equation instead changes
its resistance; it omits advective momentum and cannot claim full shallow-water accuracy.

Freeze h, Af, R and the explicit pressure predictor during each fixed step.
For nonnegative `p = max(0, qOld + dt A g S)`, solve resistance implicitly:

`q + beta q² = p`, `beta = dt A g n²/(Af² R^(4/3))`,
`q = 2p / [1 + sqrt(1 + 4 beta p)]`.

Beta has units s/m³, so beta q² has discharge units. The rationalised positive
root avoids cancellation and is nonnegative. Treating the quadratic implicitly,
rather than freezing its speed at the old zero value, damps the very first wet step.
At h ≤ the shared dry threshold set outgoing q to zero and retain water stock.
Then apply the existing donor-volume limiter, water gather, sediment transfers,
slumping and evaporation. No transfer is created or lost by resistance itself.

Cell velocity averages signed face speeds q/Af, using each flow's donor section.
This matches the friction speed in uniform flow. Dividing incoming discharge by
a newly wet receiver's depth instead creates a spurious speed proportional to l/dt.
All four outward pipes remain separate; this is still an approximate process model.

## Sources, parameter envelope and approval

[USACE HEC-RAS energy-loss guidance](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.4/basic-data-requirements/geometric-data/energy-loss-coefficients)
tabulates natural-stream roughness from 0.025 through 0.150 and stresses calibration.
We use that as a provisional envelope, not evidence that shallow hillslope flow has
those values. `manningNSPerMOneThird` has SI units s/m^(1/3), default 0.035, allowed
0.025–0.15. Experts must review this adaptation and its dry-cell convention.
[USACE's Eulerian discretisation](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.4/theoretical-basis-for-one-dimensional-and-two-dimensional-hydrodynamic-calculations/2d-unsteady-flow-hydrodynamics/numerical-methods/eulerian-shallow-water-equation-solver)
is a reference for implicit resistance; the derivation above is our pipe adaptation.

## Evidence and guard policy

`cpu/resistance.test.ts` tests analytical Manning equilibrium and equal 50 s runs
of the original 64², seed 1, 10 m-cell catchment counterexample with a 0.1 m³/s
spring. Evaporation's continuous rate is held fixed when dt changes. Incision here
is the maximum decrease of bedrock plus loose-sediment surface, not a calibrated valley metric.

| Fixed step (s) | Final peak speed (m/s) | Maximum surface incision (m) | Exported solids (m³) | Peak wave number |
| -------------- | ---------------------- | ---------------------------- | -------------------- | ---------------- |
| 0.05           | 0.51773117             | 0.00068439576                | 4.87748048e-7        | 0.00648112       |
| 0.025          | 0.51768757             | 0.00068336530                | 4.87207534e-7        | 0.00324008       |
| 0.0125         | 0.51766578             | 0.00068285090                | 4.86937298e-7        | 0.00161992       |

Successive differences shrink; finest-pair relative differences are below 0.02
for speed, incision and export. The old limiter-driven speeds no longer appear.
Export is tiny at this duration; this is numerical convergence, not field validation.
The CPU stability extremes, deterministic replay and mass-budget tests also pass.
The pond drainage test now permits retained water: resistance slows drainage, while
the same exact water-balance check continues to include storage and exported water.

Restore `waveGuard: "halt"` as default. Every production step exceeding the shared
wave guard is rejected without committing state. Explicit `report` remains for
numerical diagnosis only and is not scientific acceptance. Deep-water rejection is
tested. No adaptive stepping or relaxed guard was introduced. Wider experiments
may halt and must rerun with a smaller fixed timestep, not suppress the failure.

3C must port this same pressure/root/donor limiter and donor-area velocity ordering,
then run real-browser water/flux/velocity comparisons. No production GPU solver
exists yet, so this prerequisite records CPU fixtures rather than claiming GPU parity.
3B must use the real preset and evaluate qualitative claims across seeds; no predict
answer, geological time calibration, or domain-expert sign-off is supplied here.
