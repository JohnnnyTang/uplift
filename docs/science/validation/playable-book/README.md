# Prepared terrain validation results

<!-- expert-review -->

**Removed 2026-11-13 (D-W5-5M2):** the contour lesson (`cartography.contours`) was removed from the book. Its geometry checks below are kept as the historical record; the water results are unchanged and still back the water lesson.

**Removed 2026-11-14 (D-W5-5N2):** the water lesson (`hydrology.water-path`) was also removed from the book. Every result below and `results.json` are kept unchanged as the historical record; no shipped lesson relies on them now. The test that produced them (`uplift/book/src/scenes/claims.test.ts`, with the prepared surface in `scenes/geometry.ts`) was removed with the lesson, so the record can be regenerated only from git history (last at `e41a30e`).

The prospective source-only intervention was committed as `aa3acda` before acceptance execution. All results are retained in `results.json`, including complete resolved run configs, wet masks, hashes, diagnostics and relocation continuations. The deterministic runs were repeated once to add full resolved configuration metadata; outcomes were unchanged. The separate 5A exploratory observations were not relabelled as acceptance.

| Prepared longitudinal slope | Left source: left / right wet cells | Right source: left / right wet cells |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| .03                         | 61 / 0                              | 0 / 61                               |
| .04 (production)            | 65 / 0                              | 0 / 65                               |
| .05                         | 67 / 0                              | 0 / 67                               |

Every pair follows the registered count direction and differs in wet extent after the fixed horizon. All pairs contain 16 model m³ of water at that horizon. No acceptance threshold, horizon or source was tuned after the run. The seed is fixed but does not affect the authored geometry; these are three geometry variants, not independent random replicates. Relocation keeps existing water immediately and then yields an additional wet region after continuation. Diagnostics and masks, including all outcomes, remain in the raw record.

The selected contour's actual vertices match the triangulated surface to the preregistered tolerance. Projection checks at flat, half and full lift use the renderer's public projection. Height samples remain bitwise unchanged. These establish mathematical consistency, not a learning outcome.

The supported claim is narrow: source location changes which parts of these prepared fixed surfaces become wet in this model. The asymmetric single outlet means no symmetric outlet inference is supported. No erosion, field rate, geological time, real catchment or individual parcel claim is made.

Source validation: inspected the USGS [topographic map definition](https://www.usgs.gov/faqs/what-a-topographic-map) and [Map Symbol Guide](https://www.usgs.gov/ngp-standards-and-specifications/us-topo-map-symbol-guide) for equal-elevation contours. Inspected the authors' [Mei, Decaudin & Hu publication record](https://www-evasion.imag.fr/Publications/2007/MDH07/) for the hydraulic model. The latter supports the mechanism; tested configuration values here are educational settings, not measured field parameter ranges. Existing `docs/science/model.md` and `sources.md` retain the deeper source audit and limitations.

CPU geometry/process checks pass. Rendered evidence and reproducible commands are in `docs/review/book-revision/example`. Actual composed host/backend verification, GPU numerical acceptance, expert review, classroom readability and learner understanding remain pending. No solver code changed; no CPU/GPU comparison was weakened or replaced.
