/** <!-- expert-review --> Citation keys resolve reader prose; scope and verification are in sources.md. */
import type { Source } from "@hachure/runtime";

export const sourceKeys = [
  "Comparison",
  "Model",
  "Parameters",
  "Validation",
  "Results",
  "Calibration",
  "Sources",
  "S08",
  "M07",
  "FV",
  "SW",
  "W99",
  "R",
  "G",
  "A",
  "Resistance",
] as const;

export const sources = [
  {
    citation:
      "Comparison — Uplift paired rain experiment: gross erosion, shared-scale replay and presentation evidence",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/validation/rain-comparison/README.md",
  },
  {
    citation: "Results — Uplift reproducible validation packet: failed criteria and inconclusive prediction",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/validation/README.md",
  },
  {
    citation: "Model — Uplift terrain process model: implemented rules and explicit adaptations",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/model.md",
  },
  {
    citation: "Parameters — Uplift typed parameter ranges and reader clamps; provisional engineering bounds",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/parameters.md",
  },
  {
    citation:
      "Validation — Uplift metric definitions, paired experiments and prediction evidence requirements",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/validation-spec.md",
  },
  {
    citation: "Calibration — Uplift landscape-time proposal and approval requirements",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/time-scale.md",
  },
  {
    citation: "Sources — Uplift verification register and unresolved evidence gaps",
    url: "https://github.com/JohnnnyTang/uplift/blob/main/docs/science/sources.md",
  },
  {
    citation:
      "S08 — Šťava, Beneš, Brisbin and Křivánek, Interactive Terrain Modeling Using Hydraulic Erosion",
    url: "https://www.cs.purdue.edu/cgvlab/www/resources/papers/Stava-2008-Interactive_Terrain_Modeling_Using_Hydraulic_Erosion.pdf",
  },
  {
    citation: "M07 — Mei, Decaudin and Hu, Fast Hydraulic Erosion Simulation and Visualization on GPU",
    url: "https://evasion.imag.fr/Publications/2007/MDH07/",
  },
  {
    citation:
      "FV — Ketcheson, LeVeque and del Razo, Riemann Problems and Jupyter Solutions: finite volume methods",
    url: "https://www.clawpack.org/riemann_book/html/Approximate_solvers.html",
  },
  {
    citation: "SW — Ketcheson, LeVeque and del Razo, The shallow water equations",
    url: "https://www.clawpack.org/riemann_book/html/Shallow_water.html",
  },
  {
    citation: "W99 — Whipple and Tucker, Dynamics of the stream-power river incision model",
    url: "https://doi.org/10.1029/1999JB900120",
  },
  {
    citation:
      "R — USGS Water Science School, Rainfall calculator, metric: How much water falls during a storm?",
    url: "https://water.usgs.gov/edu/activity-howmuchrain-metric.html",
  },
  {
    citation:
      "G — BIPM, Declaration on the unit of mass and on the definition of weight; conventional gravity",
    url: "https://www.bipm.org/en/committees/cg/cgpm/3-1901/resolution-2",
  },
  {
    citation: "A — USACE HEC-RAS, Selecting an Angle of Repose in Cohesionless Sediment",
    url: "https://www.hec.usace.army.mil/confluence/cwmsdocs/rasum/latest/selecting-an-angle-of-repose-in-cohesionless-sediment-271613986.html",
  },
  {
    citation:
      "Resistance — USACE HEC-RAS, Eulerian shallow-water equation solver: numerical resistance reference",
    url: "https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.4/theoretical-basis-for-one-dimensional-and-two-dimensional-hydrodynamic-calculations/2d-unsteady-flow-hydrodynamics/numerical-methods/eulerian-shallow-water-equation-solver",
  },
] as const satisfies readonly Source[];
