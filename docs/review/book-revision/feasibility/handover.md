## Session

S1 · W5 · 5A — Feasibility, reader contracts and design constraints

## What changed

Readers will lift the same contour geometry, then move a source and see real water
respond on a prepared landscape. 5A fixes that two-spread sequence using actual
InkView/CPU evidence and freezes the interfaces needed for the parallel 5B/5C/5D
work. Production mounting and all solver kernels remain unchanged.

Adds optional-question/challenge ReaderSpread validation while preserving legacy
Spread consumers; scene lifecycle/status/binding contracts; authored terrain
initialization types; shell navigation contracts; and usable, explicitly non-scientific
fixture adapters. Defines layout, phone/reflow, focus, gestures, routes, reset,
quiescence and precise host initialization signatures in contracts.md.

The exploratory trial includes real contour dragging, source picking/replacement,
keyboard/reduced-motion alternatives, screenshots and a recording. Both the initial
pale depth encoding and the clearer repeat are retained. This is feasibility evidence,
not prospective science or a claim that the default app has been migrated.

## Checklist

- [x] Owned paths respected except minimal glue described below.
- [x] pnpm check passes: 495 tests across 56 files, typecheck, lint and format.
- [x] Simulation remains process-based; no scripted landform or water route.
- [x] Displayed model values come from actual configuration/state.
- [x] No CPU/GPU solver changes; existing comparison tests retained.
- [x] Proposed scientific claims marked expert-review, with source records linked;
      final external cartography sources and prospective validation belong to 5D.
- [x] Decisions and open questions appended in DECISIONS.md (D-5A).

Additional checks: production build passes; bundle 2,418,719 bytes under 10,000,000.
Standalone spike TypeScript, ESLint and formatting pass. Existing browser run passed
22/23; science fixture initially failed with Vite's Outdated Optimize Dep response.
Isolated the spike cache and restricted e2e dependency scanning to its fixture HTML;
the affected science test then passed, including after the harness fix. No clean
full-suite rerun or remote CI pass is claimed.

Outside-owned glue: runtime index re-exports the frozen reader types. The one-line
e2e fixture configuration now limits dependency scanning to e2e/fixtures/*.html,
because standalone spike aliases are intentionally local to its own Vite config.
DECISIONS.md is append-only session bookkeeping required by AGENTS.md.

## Handover

Done: fixed sequence, real-renderer exploratory recording, optional schema and
bindings validation, shared types/adapters, composition and integration contracts.

Not done: 5B authored host/quiescence implementation; 5C actual shell/page turns;
5D production primitives, one-gesture response and prospective science; 5E default
app migration; 5F integrated acceptance. Human listening, scientific sign-off,
product review and target-hardware performance remain pending.

Surprises: source tools already exist, but host initialization, domain and diagnostic
baselines are valley-specific. Water becomes clear with a truthful depth ramp and
state-derived ink dots; the retained pale trial shows why visual review mattered.
The water fixture has one outlet, so it supports changed wet routing, not a symmetric
two-outlet destination law. The contour lift is visible but its framing can improve.

Plan-changing facts: 5B must implement the documented authored initialization seam
before integration; 5D consumes those exact signatures rather than growing a private
host. All retained scenes must settle before hiding, including phone text pages.
Dependents start only once this 5A branch is merged. This document is the prepared
PR body; PR publication and remote CI must be recorded separately.
