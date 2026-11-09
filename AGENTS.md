# Rules for coding agents

You are working on **Uplift** (the book) and **Hachure** (the engine underneath). Read these before you
change anything:

1. `docs/handoff.md`, sections "Pedagogical design principles" and "Scientific rigour policy". They are
   requirements, not suggestions.
2. `docs/product-story.md`: what we are building and the threads that cross every stage.
3. `docs/plan/README.md`: how work is split into stages, waves and sessions.
4. The current stage plan (`docs/plan/stage-1.md`), and **your session's brief** in it.

## Current Wave 5 direction

Use `s1/w5/integration` as the base and PR target for every future Wave 5 session.
Consume only dependencies already merged there; this owner-authorized exception
supersedes main-only launch instructions for Wave 5. Other waves retain their default.

For the opening lesson, read docs/plan/stage-1-wave-5-glacial.md and your 5G–5N
brief. U-shaped valley formation must combine physical-condition changes (UI and
an equivalent 3D gesture) with watching, inspecting/replaying and comparing formation
over time. Neither part is optional. A–F are retained foundations, not glacial acceptance.
The transition is artistic, contours optional, scene colours natural. Quote the relevant
GV acceptance row in the session handover; record deviations before dependent work.

## Non-negotiables

- **Process-based simulation only.** Landforms emerge from simulated flow, transport and deposition. Never
  script or keyframe a landform.
- **Page and model agree.** Never type a number on the page that the simulation computes or configures
  (values, years, metres, labels on gauges). Bind it: `{{probe.sedimentOut}}`, `{{scene.timeScale}}`.
- **One idea per spread.** Two ideas means two spreads.
- **Two levels, one simulation.** The level toggle changes text, visible controls and overlays. It never
  resets or changes the model.
- **CPU and GPU solvers agree.** Whenever either changes, add or update the comparison test.
- **Determinism.** Fixed time step, seeded randomness (no `Math.random()` in simulation code), reproducible
  runs.
- **No invented science.** Draft scientific text, mark it `<!-- expert-review -->`, and cite a source.
- **Textbook art and natural scene colours.** Keep the book simple; illustrations and 3D scenes may use
  natural rock, soil, vegetation, ice and water colours. There is no one-or-two-colour limit. Data colours
  need legends and non-colour cues; preserve accessible contrast. The 2D-to-3D entrance is an artistic
  transition, not an exact geometric mapping. Scientific process evolution remains model-driven.
- **Accessible by default.** Keyboard-operable controls, a text alternative for the key visual change,
  reduced-motion mode, colour-blind-safe palette.

## Architecture rules

- Hachure never imports from Uplift (enforced by ESLint). Spreads use only `@hachure/*` public entry points.
- If a spread needs heavy custom code, the engine is missing a primitive. Raise it in `DECISIONS.md` rather
  than hard-coding it in the spread.
- Simulation parameters live in one typed config with units in the names (`rainMmPerHr`, `metresPerCell`).
- Workspace packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`); there is no library
  build step in Stage 1.

## Working in a session

- Work on your session branch in your own worktree (see `docs/plan/README.md` → "Running a session").
- Stay inside your session's **owned paths**. If you must touch a file outside them, keep the change minimal
  and say why in the PR.
- Never hand-merge `pnpm-lock.yaml`: take main's version and rerun `pnpm install`.
- Record decisions and open questions in `DECISIONS.md` (append; keep both sides on conflict).
- Before opening the PR: `pnpm check` passes, and the PR template checklist is filled in.
- Finish with a short handover note in the PR description: what is done, what is not, what surprised you,
  and any fact that should change the plan.

## Commands

```sh
pnpm install      # install
pnpm dev          # run the book
pnpm test         # unit tests (Vitest)
pnpm check        # typecheck + lint + format check + tests
pnpm build        # production build
```
