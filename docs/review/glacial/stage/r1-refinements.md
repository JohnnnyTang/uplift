# R1 owner refinements — 2026-11-11

Implemented on branch s1/w5/r1-refinements from the merged Wave 5 integration baseline.

Done: layered page thickness and cover, higher far edge, upright enlarged lesson/keywords/
explanation/live-note panels, keyboard close and focus return, phone and reduced-motion support.
The original DOM moves into the panel; bound notes remain live without duplicating model values.
No model, solver, run data or scientific copy changed.

Verification: pnpm check (607 passed, 7 skipped); Chrome checks for exact scene-frame stability,
preserved recorded time, live note updates after time changes, Escape focus restoration, phone
panel bounds and reduced-motion animation removal. Inspected 1440×900, 1366×768 and 390×844.
A favicon 404 is the only observed browser console error.

Evidence from this session is in output/playwright/r1-book.png, r1-reading.png, r1-laptop.png
and r1-phone.png. The temporary CLI scripts there reproduce the interaction checks and captures.
Existing historical stage captures were preserved.

Not done: production 5J–5N migration, scientific/expert sign-off or final owner acceptance.
Surprise: increasing CSS rotateX lowered the far edge visually; a smaller camera pitch produces
the requested steeper reading slope. Added reading actions require compact keyword layout on
short laptops. Carry these presentation decisions into the production scene and content sessions.
