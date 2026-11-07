<!-- expert-review -->

# Sources and verification register

S1/W1/1E, checked 2026-11-07. This register distinguishes an inspected primary source
from a verified bibliographic identity. Expert approval of the model, parameters and
calibration remains pending. Numeric defaults and validation thresholds labelled
engineering proposals elsewhere are ours; a citation to a mechanism is not evidence
that its authors measured our constants.

## Sources used by the brief

| Key | Reference and stable location                                                                                                                                                                                                                                                                                                                                               | Verification and permitted use                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M07 | Mei, X., Decaudin, P. and Hu, B.-G. (2007), _Fast Hydraulic Erosion Simulation and Visualization on GPU_, Pacific Graphics. [DOI: 10.1109/PG.2007.15](https://doi.org/10.1109/PG.2007.15), [author-lab publication record](https://evasion.imag.fr/Publications/2007/MDH07/)                                                                                                | Title/authors/year and DOI verified in the IEEE publisher/indexed lab records. Direct lab fetch timed out and HAL full text was access-denied; original equation-by-equation checking remains open. Use the accessible S08 §§4–5 for the inspected pipe/capacity construction; do not claim our extensions are verbatim M07. |
| S08 | Šťava, O., Beneš, B., Brisbin, M. and Křivánek, J. (2008), _Interactive Terrain Modeling Using Hydraulic Erosion_, SCA, pp. 201–210. [Author-lab record](https://www.cs.purdue.edu/cgvlab/www/publications/Stava08SCA/), [author-hosted paper](https://www.cs.purdue.edu/cgvlab/www/resources/papers/Stava-2008-Interactive_Terrain_Modeling_Using_Hydraulic_Erosion.pdf)   | Inspected paper §§4–5: virtual pipes, speed/slope capacity and material slippage. Its semi-Lagrangian transport is not adopted. Our conservative two-stock/flux rules and reference-unit normalisation are adaptations, not a reproduction of its full layered model.                                                        |
| FV  | Ketcheson, D. I., LeVeque, R. J. and del Razo, M. J., _Riemann Problems and Jupyter Solutions_, [finite-volume introduction](https://www.clawpack.org/riemann_book/html/Approximate_solvers.html), [advection](https://www.clawpack.org/riemann_book/html/Advection.html)                                                                                                   | Inspected conservation-form update, boundary-flux cancellation and CFL discussion. Supports conservative discretisation reasoning; does not prove the stability of our coupled pipe/erosion system.                                                                                                                          |
| SW  | Same authors, [The shallow water equations](https://www.clawpack.org/riemann_book/html/Shallow_water.html)                                                                                                                                                                                                                                                                  | Inspected depth-averaging assumptions and wave speeds `u ± sqrt(gh)`. Basis for a conservative wave-speed diagnostic, not a claim of full shallow-water accuracy.                                                                                                                                                            |
| W99 | Whipple, K. X. and Tucker, G. E. (1999), _Dynamics of the stream-power river incision model: Implications for height limits of mountain ranges, landscape response timescales, and research needs_, JGR 104(B8), 17661–17674. [DOI: 10.1029/1999JB900120](https://doi.org/10.1029/1999JB900120), [paper](https://geosci.uchicago.edu/~kite/doc/Whipple_and_Tucker_1999.pdf) | Title, authors, publication and scope checked against the paper/publisher record. Comparative incision theory only. It supplies no direct calibration for our capacity coefficient.                                                                                                                                          |
| K01 | Kirchner, J. W. et al. (2001), _Mountain erosion over 10 yr, 10 k.y., and 10 m.y. time scales_, Geology 29(7), 591–594. [Paper](https://people.wou.edu/~taylors/andrews_forest/refs/kirchner_etal_2001.pdf)                                                                                                                                                                 | Inspected abstract and Fig. 2: long-term denudation context and averaging-time mismatch. The target in time-scale.md is our provisional analogy; this is not a local river-incision dataset.                                                                                                                                 |
| R   | USGS Water Science School, [Rainfall calculator, metric: How much water falls during a storm?](https://water.usgs.gov/edu/activity-howmuchrain-metric.html)                                                                                                                                                                                                                 | Inspected unit/volume and rainfall-intensity context. Supports mm/h terminology; does not establish our 0–50 mm/h control clamp or long-term storm frequency.                                                                                                                                                                |
| G   | BIPM, 3rd CGPM (1901), [Declaration on the unit of mass and on the definition of weight; conventional value of g](https://www.bipm.org/en/committees/cg/cgpm/3-1901/resolution-2)                                                                                                                                                                                           | Official conventional standard is 9.80665 m/s². Our default 9.81 is rounded, not site-specific gravity.                                                                                                                                                                                                                      |
| A   | USACE HEC-RAS, [Selecting an Angle of Repose in Cohesionless Sediment](https://www.hec.usace.army.mil/confluence/cwmsdocs/rasum/latest/selecting-an-angle-of-repose-in-cohesionless-sediment-271613986.html)                                                                                                                                                                | Official indexed text gives about 30–42° for cohesionless material; dynamic page body was not readable. S08 §5.3 independently uses a 30° dry-sand example. The chosen 33° is provisional, not a universal rock-slope limit.                                                                                                 |

## Audit of the remaining handoff references

- **H35 — Hjulström (1935).** _Studies of the morphological activity of rivers as
  illustrated by the River Fyris_. [Digitised original](https://paleoarchive.com/literature/Hjulstrom1935-MorphologicalActivityRiversRiverFyris.pdf).
  Bibliographic identity cross-checked with [USGS reference list](https://pubs.usgs.gov/wri/1984/4218/report.pdf).
  The historical curve is context only: this model has no grain-size-dependent entrainment
  or measured Hjulström thresholds. Do not transcribe values from an uninspected chart.
- **UC Davis AR Sandbox.** [Developer's project site](https://web.cs.ucdavis.edu/~okreylos/ResDev/SARndbox/)
  and [download/support page](https://web.cs.ucdavis.edu/~okreylos/ResDev/SARndbox/Download.html).
  Project identity and teaching/software precedent verified. It does not validate our erosion model.
- **Three.js.** [WebGPURenderer documentation](https://threejs.org/docs/#WebGPURenderer)
  and [TSL documentation](https://threejs.org/docs/#TSL). Renderer/backend references,
  not scientific process sources. Installed-version API verification and benchmarks belong
  to 1B/1C; no renderer performance claims are made in this brief.
- **Every Joule.** Already verified as the design precedent by the handoff. It is not
  a source for process rules, parameter values or calibration; no new scientific use here.

## Evidence gaps and release gate

1. Inspect the original M07 full text when accessible; reconcile any discrepancy with S08
   before citing a particular original equation number. Our implementation choices are
   explicitly specified in model.md so they do not depend on a guessed equation number.
2. Have an expert approve the rainfall experiment bounds, cohesionless-slump analogy,
   hardness interpretation and numerical parameter envelope. We have not invented field
   measurements for interaction constraints, seeds, pipe area or relaxation coefficients.
3. Obtain a suitable site/process-specific channel-incision dataset or approve the stated
   denudation analogy before authorising a geological clock. Run 3B and publish its record.
4. Review every predicted outcome against solver evidence. No source substitutes for the
   qualitative tests, and no test success substitutes for expert sign-off.

The `<!-- expert-review -->` marker applies to each science file in its entirety.
Keep the markers until an authorised domain expert supplies recorded approval.
