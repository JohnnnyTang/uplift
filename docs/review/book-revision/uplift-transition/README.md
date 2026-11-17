# 6H uplift entrance review

The complete drawing holds for **2.4 s**, a geometry-derived pencil sketch draws for
**2.6 s**, the block rises and settles for **2.2 s**, then colour arrives over **1.3 s**.
Total authored presentation time: **8.5 s**, previously **2.7 s**.
Playback advances at most 100 ms per rendered frame, so render stalls extend wall
time instead of erasing whole phases; exact-time sampling and model time are unchanged. The 3% overshoot is presentation
only. The drawing and sketch remain distinct artistic layers, as allowed by PB3.

The design keeps the established book typography and natural palette. Its distinctive
moment is the ordered construction of a geography block: footprint, rising corners,
section/rim, surface profiles and restrained hachures. There is no layout or desk
change here. The pencil follows real block geometry with deterministic slight wobble.
The drawing recedes while the construction sketch appears; the ink block grows into
that sketch, then receives natural colour. Mid-sketch and mid-lift stills were inspected
visually: strokes remain registered and the ink relief is legible against the paper.

Any key, pointer press or Play completes the entrance; the same input still reaches
its control. Replay repeats it. Reduced motion and return visits skip it immediately.
No simulation state or model time is changed by the entrance.

## Evidence

`before-{glacial,plates}.webm` and corresponding before stills are preserved from the
interrupted session on baseline 7fb7280. `after-{glacial,plates}.webm` and after stills
are refreshed for the final continuation at 1440×900, DPR 2, using installed Chrome's
WebGPU path. Videos include the initial live entrance, settled page, then
automation-frozen phase stills: 1000 ms hold, 3700 ms mid-sketch, 4900 ms complete
sketch, 6100 ms mid-lift, 6900 ms settling, 7800 ms colour. `capture.mjs` reproduces them.
The earlier `webgl2-glacial*` files are retained historical evidence, not refreshed.

Native installed Chrome reproduced every phase in both fresh entrances and replays
at approximately **8.5 s**. Browser version, backend and phase timestamps are in
`timing.json`; `CAPTURE_CHANNEL=chrome node timing.mjs` reproduces the measurement.
This is one machine/browser observation, not a hardware-wide performance claim.

Bundled Chromium/SwiftShader exposed a real presentation bug: slow frames skipped
straight from sketch to done (hosted CI also skipped glacial lift). CPU profiling
showed mostly idle time, and native shader compile/draw calls were short. Disabling
the SVG filter, hiding sketch/shadow surfaces and an alternate buffer reveal did
not reliably fix it; those experimental code changes were reverted. The bounded
presentation clock now preserves hold, sketch, lift, colour and done. An isolated
software-rendered glacial entrance took **27,073 ms** with all phases present.
Earlier overloaded captures took 58,707/72,440 ms (glacial/plates); those are excluded
from performance acceptance. A reader can always skip immediately; software timing
is not evidence of smooth hardware rendering.

Dedicated PB3/PL6 tests retain exact phase-order assertions with a 60-second
animation wait budget. Other route, gesture and model journeys explicitly press
Escape after readiness, exercising the supported skip path without repeatedly
waiting for presentation. Their behavioural assertions remain intact.

## Acceptance and handover

> GV4: Drawing → ink → colour transition into a complete, naturally coloured diorama standing on a tilted book page

> PL6: Drawing → ink → colour transition into a naturally coloured block on the tilted book page, reusing lesson 1's stage

The continuation corrects reduced motion (previous WIP crossfaded), Tab/modifier
and assistive click skipping, contact-shadow updates, phase continuity and transition
runner allocations. A held drawing is applied once, and invisible canvases do not
queue renders. Existing stroke
ordering, deterministic geometry and phase tests were retained. Scope is presentation
only. Owner visual acceptance and broader hardware checks remain pending.

The first six-spec local run passed 45 tests, failed four and skipped four after a
serial failure. The corrections were checked with a focused run (22 passes, one
plate replay failure before the final invisible-render fix) and a final complete
plate acceptance run: **12 passed in 58.8 s**, including full replay, keyboard,
phone/reflow/reduced motion and retained state. The glacial full entrance test and
previously failing plate drag/return checks passed in that focused run. Final
repository check results are appended below. The full e2e suite is
not run locally; the six affected lesson and book specs are the selected regression scope.
The original Claude work retains attribution; the continuation and PR provenance
identify Codex accurately. 6G should merge first, followed by a 6H rebase and checks.

## Final pre-integration checks

- `pnpm check`: 901 passed, 7 skipped; typecheck, lint and formatting passed.
- `pnpm build`: passed. `pnpm check:bundle`: 6,782,287 / 10,000,000 bytes.
- Local full six-spec attempt and focused corrections are described above; the final complete plate acceptance run passed all 12 checks.
- Hosted initial full suite (run 44053856115): 113 passed, one skipped, three failed (glacial phase skipping and two plate gesture/return time budgets). The phase clock and explicit non-animation skip setup address those findings; final-head hosted validation is required before integration.
- Native evidence: Chrome 157.0.8103.79, WebGPU, both fresh/replay sequences around 8.5 s. No multi-device performance claim.
- Pending: rebase onto merged 6G, repeat checks and inspect the combined enlarged book at mid-lift.

## Combined integration verification

6H was rebased onto main `9e3c713` after 6G merged. Both sessions' decision and
acceptance records, the enlarged fit/desk, and the flap-state flush were retained.
[Combined peak/settled captures](integration/README.md) cover both lessons at
1366×768 and 2560×1440. Peak clearance was visually inspected; no fit change was needed.

- Integrated lesson acceptance/fallback selection: **22 passed** (3.4 min), including
  complete PB3/PL6 sequences, keyboard/reduced motion, fit and queued flap retention.
- Glacial scene and research smoke specs: **12 passed** (1.4 min).
- Hosted pre-rebase run 44062927193: 110 passed, one skipped, six failed. Five scene
  gesture tests still assumed the old entrance duration; their setup now uses Escape
  after readiness. Full PB3/PL6 passed. The sixth failure exposed research navigation
  during initial reader mounting: hiding the stage before mount completed caused
  layout errors and rejected navigation. The shell now waits for in-flight mounting
  before settling, detaching and hiding; a gated-mount regression verifies this race.

The full hosted suite must pass on the final rebased head before merging. Native
phase media remain valid: the integration adds 6G layout and lifecycle coordination,
without changing the authored entrance phases or stroke geometry.

Final post-integration verification: `pnpm check` passed (908 tests, seven skipped;
typecheck, lint and formatting passed). `pnpm build` passed; bundle is
6,793,525 / 10,000,000 bytes. The complete shell + research smoke selection passed
**14/14** (1.2 min), including the deterministic initial-mount departure regression.
