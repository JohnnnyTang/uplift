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
