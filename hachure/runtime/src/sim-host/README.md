# CPU host integration

The host owns wall-clock scheduling, never numerical timestep adaptation. The CPU Worker owns the solver,
persistent source, reset baseline and serialized command queue. Only copied snapshot buffers transfer;
the authoritative float64 state stays in the Worker. Normal probe/view publication runs at two samples per
second, with one automatic request in flight. Slow frames discard wall-clock catch-up after a bounded
backlog; no extra model time is invented. The UI coalesces manual-command snapshots to at most four view
updates per second and uses one snapshot version for mesh, contours and overlays.

Use the `@hachure/runtime/worker` entry from a module Worker. The ordinary runtime entry also exports DOM
widgets and KaTeX CSS and must not be evaluated in a Worker. The real browser smoke test caught this
boundary; a Node-only unit suite does not exercise Vite's development CSS injection.

The source declared by the real tilted-plateau preset is applied after initialization and every reset.
The host verifies the south-face/base-level convention. Reset baseline and current channel paths are
separate; the live sample carries explicit completeness and calibration status. Numeric landscape years
require an approved calibration record; an acceleration factor alone grants no approval.

A null prediction answer is an unscored investigation. A pending challenge has no numerical success rule
and cannot award a stamp. The full persistent slope-break challenge belongs to session 4C.

`uplift/book/src/app/smoke.mjs` records the real browser flow. Measurements distinguish Worker step batches,
snapshot/probe calculation, main-thread contour/mesh extraction, and transfer plus event scheduling.
Development headless-browser measurements do not establish the classroom hardware performance gate.

Incision uses the shared fixed-section scientific metric on copied authoritative float64 stocks, with a separate reset baseline. Float32 snapshots are only the drawing and channel-path interface; they cannot quantize the reported incision signal.

## Playable reader boundary (5B)

`SimHost.pauseAndSettle()` closes the mutation gate immediately, drains every accepted
advance/configuration/tool command in order, then publishes a final atomic sample.
Detach only after it resolves. The retained host still owns the actual solver and
fractional fixed-step remainder. Stop the scene scheduler while hidden and reset its
wall-clock timestamp on return; never feed the off-page gap into `advance`.
`resume(playing = false)` reopens mutations without requiring autoplay. `step(steps)`
is an awaited, sampled fixed-step action for reduced motion and bounded interventions.
Explicit reset remains paused and restores authored state, configuration and sources.

The optional `AuthoredTerrainInitial` on initialization carries exact grid/cell size,
edge outlet, terrain layers and unique persistent sources. The selector preserves the
physical configuration (including pipe area) across all tiers; it never substitutes a
different landscape. Inputs are validated and cloned, and each backend builds its own
local preset; functions do not cross the Worker boundary. Worker and main-thread
CPU/GPU transports share the same initialization/reset/diagnostic implementation.

Authored samples explicitly report `diagnostics.kind === "unavailable"`: their empty
legacy profile slots and null incision are not observations. Do not display valley
profile or incision widgets for such samples. Use actual snapshot water for the water
lesson. Legacy research samples retain their original diagnostics and calibration
restrictions. A spring outside `[0, gridSize * metresPerCell)` is rejected with
`off-grid`, leaving an existing stable-id source intact. Publish requested source
coordinates only after a successful tool result; pointer UI constraints are separate
from solver rejection. Rain-source radius clamps remain reported in ToolResult.

`ReaderLifecycle` independently stores presentation/readiness; reveal and question
state do not authorize play. The 5E research caller migration removed the temporary
prediction-gated `SpreadLifecycle` adapter. Learning widgets accept an absent
question and explanations are immediately revealable, including after reset.

Verification in the 5B worktree: `pnpm check` (506 tests), `pnpm build`, e2e TypeScript,
three `e2e/reader-runtime.spec.ts` tests using installed Chrome, and the existing
terrain GPU browser suite (68 tests) pass. The reader fixture records keyboard reset
focus in `e2e/fixtures/reader-runtime-keyboard.png`; it is wiring evidence, not a
scientific lesson or learner/hardware result. Native Chrome with unsafe WebGPU exposes
an adapter here; forcing ANGLE Swiftshader/Vulkan did not. The GPU-specific regression
skips only when an adapter is unavailable; shader/runtime/numerical failures still fail.
