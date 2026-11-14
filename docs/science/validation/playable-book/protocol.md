# Prospective protocol — playable book

Registered before acceptance execution, 2026-11-09. Lead approved the source-only intervention and bounded claim. Exploratory 5A results are not acceptance data.

**Removed 2026-11-13 (D-W5-5M2):** the contour lesson (`cartography.contours`) was removed from the book. The geometry section below is kept as registered; it no longer covers a shipped lesson.

**Removed 2026-11-14 (D-W5-5N2):** the water lesson (`hydrology.water-path`) was removed from the book. The source-only intervention below is kept as registered and its results as recorded; it no longer covers a shipped lesson.

Claim: changing spring position changes the wet extent on this prepared fixed terrain. No catchment/outlet, erosion, field rate or learner-outcome inference.

Three authored initial states: longitudinal slopes .03, .04 (production), .05. Each has the same twin troughs, 32-square grid, 2 m cells, left edge outlet (8,31), zero water/flux/sediment and hardness .5. Seed 5 is fixed but does not affect this authored geometry; these are geometry variants, not stochastic replicates.

For each state run fresh left (17,9) and right (47,9) stable-id springs, .4 m³/s, 2000 fixed steps at .02 s with the full WATER_CONFIG from geometry.ts. Wet threshold .002 m. Prospective direction: left source yields more wet cells in the left half than the right half; right source yields more in the right half. Paired wet masks must differ. Retain zero results and failed directions without tuning threshold/horizon. Report counts, water volume, masks, diagnostics and hashes. Additionally continue each left run with right source for 2000 steps; retain old-water cue and all outcomes.

Geometry: sampleSurface at every selected contour vertex equals its level within 1e-5 m. Lift fractions 0,.5,1 change projection only; heightfield unchanged. Check exact selected path projection and renderer screenshots in the final camera at desktop and phone. Real browser keyboard, reduced motion, reset, detached level changes and flat fallback checks complement geometry tests.

Intended production view: azimuth 0°, elevation 48°, zoom 1.05, relief scale 3, contour interval .5 m. Blue water reaches full opacity .7 at .025 m; actual wet samples have ink dots. These are display encodings, not solver thresholds. No threshold changes after execution. CPU acceptance runs and same-device GPU numerical comparison are separate; unavailable backends remain pending.
