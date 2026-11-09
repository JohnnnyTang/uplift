# 2E widget and shell evidence

Run the mock book with `pnpm dev --host 127.0.0.1 --port 5178 --strictPort`, then
`pnpm --filter @uplift/book smoke`. The smoke command uses installed Chrome via Playwright;
`SHELL_BASE_URL` can override the URL. It writes this directory's screenshots and results.

## Visual review

Chrome 156.0.8078.80, headless on Windows, CSS viewports rather than physical projector hardware.
The agent opened and reviewed the projector high-school and university screenshots. Both pages
remain readable, the gutter divides the facing pages, the controls retain labels and units, and
there is no horizontal overflow. Expanded notes and controls extend below projector height;
vertical scrolling is intentional, with no fixed page height or clipped text. At tablet and mobile
widths the pages stack in reading order. Full-page screenshots include expanded notes so this
long-content state can be assessed too. Numerical measurements are in `results.json`.

- [Projector, high school](projector-hs.png)
- [Projector, university](projector-uni.png)
- [Mobile, high school](mobile-hs.png)
- [Mobile, university](mobile-uni.png)

## Keyboard and semantics

The browser smoke actually sends keyboard events to the skip link, radio group, commit, sliders,
checkbox, flap, disclosures, playback buttons, reset and native reading-level select. It checks
that commit gates model controls, Home/End clamp the sliders, speed updates the bound step-rate
label, and reset restores the seeded state and defaults. Level changes preserve the solver hash,
committed answer and parameter values. The KaTeX formula retains semantic MathML and its TeX
annotation. `accessibility-tree.yml` records named controls, regions, figure, status and math.

Reduced motion starts with no autoplay. Enabling the preference during playback pauses it;
explicit Play remains available. Live status reports actions and bound snapshot values on pause,
rather than flooding speech with every frame. The visible description updates from snapshots.

**Human screen-reader listening: NOT PERFORMED.** No human listener was available. No NVDA or
Narrator process was running when inspected. The accessibility snapshot and automated keyboard
checks are structural evidence, not a replacement for this explicit exit criterion. Before accepting
2E, a person must listen with their screen reader: read the spread, choose and commit a prediction,
hear the committed choice, adjust rain/speed with units, play/pause and hear snapshot values, reveal
the explanation, switch levels and read the MathML, then reset and confirm the gate announcement.
Record reader/browser versions, observations and any fixes here. This criterion remains open.

## Palette and scientific boundary

`BOOK_PALETTE` reconciles 1C/1D: paper `#faf8f2`, ink `#242b2a`, secondary `#505852`, desk `#555c56`,
water/focus `#0072b2`, sediment `#9c6500`, structural rule `#c9c9bc`. The darker 1D ochre replaces
1C's `#b57900` so sediment can support normal-sized text on paper. Unit tests enforce at least
4.5:1 contrast for ink, secondary text, water and sediment on paper. Legends pair colour with words
and solid/dashed lines; colour is never the only identifier. Rule/gutter grey is structural only.
Physical projector washout and the later colour-vision audit remain later-stage checks.

This is visibly a widget test fixture, not released geography content. The fake solver scripts its
surface changes. The drawing is a diagnostic set of row profiles from its snapshot, not the production
contour renderer. No prediction is scored, stamp awarded, scientific relation asserted, or landscape
time calibration invented. All displayed numerical values are derived from the live fake solver,
control definitions or scene configuration. The algebra formula is a cited typesetting specimen only.

## Integration handover

`mountBook` stays outside `src/app/`. Its local adapter uses only the public 1A schema and terrain
contracts. Widgets are callback-driven and do not depend on unmerged 2D implementation. Session 3A
can connect predict commit to the lifecycle, use the shared level state and binding engine, and replace
the diagnostic canvas with InkView without changing the widget primitives. Native view-only toggles
use boolean callbacks; no unsupported toggle variant was added to schema v0. The fake adapter and
mock content must be removed from the reader route before scientific release.
