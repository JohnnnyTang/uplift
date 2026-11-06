# Decisions and open questions

The group reviews this file. Append new entries at the end of the relevant section, newest last. Each
decision gives its reason, so it can be revisited when the reason stops holding.

Format: `D-NNN · date · stage/session · title`, then **Decision**, **Why**, **Revisit if**.

## Decisions

### D-001 · 2026-11-06 · S0 bootstrap · One monorepo with pnpm workspaces

**Decision.** One repository, two top-level workspace folders: `hachure/` (engine packages
`@hachure/terrain`, `@hachure/ink`, `@hachure/runtime`) and `uplift/` (`@uplift/book`, `@uplift/spreads`).

**Why.** The handoff says to build the first spread end to end and extract the engine from it as it
stabilises. During extraction, most changes cut across the engine and the book; one repo makes those single
PRs. The "Hachure never imports Uplift" rule is enforced by ESLint (`no-restricted-imports`), so the engine
can still be split out and published later without untangling.

**Revisit if.** Hachure is published as components in the group's wider GIS platform, or a second consumer
of Hachure appears. Then move `hachure/` to its own repo with history (`git subtree split`).

### D-002 · 2026-11-06 · S0 bootstrap · Licences: MIT for code, CC BY 4.0 for content (provisional)

**Decision.** Code is MIT. Educational content (`uplift/spreads/`, `docs/`) is CC BY 4.0. The repository is
public.

**Why.** The project lead asked for a public repository with a proper licence. MIT matches Three.js and keeps
Hachure easy to reuse in research and in the group's GIS ecosystem. CC BY 4.0 is the standard open
educational resource licence: teachers can adapt and redistribute spreads with attribution.

**Revisit if.** The group chooses an institutional licence (handoff "Open decisions"). Relicensing is easy
while the group holds all copyright, and gets harder once outside contributions arrive, so settle it before
accepting external PRs.

### D-003 · 2026-11-06 · S0 bootstrap · Packages export TypeScript source; one root typecheck

**Decision.** Workspace packages point `exports` at `src/index.ts`. Vite and Vitest consume the source
directly; `pnpm typecheck` runs one `tsc --noEmit` over the whole repo.

**Why.** No library build step means faster iteration while the APIs are still moving. A publishable build
(`tsup` or `vite build --lib`) is added when Hachure is first published.

**Revisit if.** Typecheck becomes slow (then switch to project references with `tsc -b`) or a package is
published.

### D-004 · 2026-11-06 · S0 bootstrap · TypeScript 6.0, not 7.0

**Decision.** Pin `typescript@6.0.3`.

**Why.** `typescript-eslint@8.72` supports TypeScript `<6.1`. TypeScript 7 (the native compiler) is out, but
type-aware linting does not support it yet.

**Revisit if.** typescript-eslint supports 7.x.

### D-005 · 2026-11-06 · S0 bootstrap · Stage → wave → session work model

**Decision.** Work is planned as stages (each closed by a group-reviewed gate), waves (run in order within a
stage) and sessions (run in parallel on git worktrees within a wave). Only the current stage is planned in
detail. See `docs/plan/README.md`.

**Why.** The handoff warns against engine-first drift and expects facts to change after real implementation.
Parallel sessions with owned paths and contracts merged first keep agents from colliding.

### D-006 · 2026-11-06 · S0 bootstrap · `@hachure/human` is not created yet

**Decision.** No placeholder package for the human/agent engine.

**Why.** It is out of scope for Demo 1. An empty package invites engine-first design. It is created in the
stage that builds its first spread (Von Thünen, roadmap phase 4).

## Open questions

Carried from the handoff ("Open decisions for the project lead"). The stage that needs each answer is noted.

- [ ] **Scientific sign-off owners** per domain. _Needed by Stage 1, wave 5_ (Demo 1 gate requires expert
      sign-off).
- [ ] **Learning-outcome instrumentation** in Demo 1 (anonymous interaction logs, pre/post quiz). _Decide
      before Stage 1, wave 4_. It changes the runtime's event design.
- [ ] **Domains and trademarks** for Uplift / Hachure (for example uplift.earth). _Before any public launch._
- [ ] **Curriculum alignment** for high school: which national or exam curricula first. _Needed by Stage 2._
- [ ] **Languages:** English only for demos, or bilingual from the start. _Decide before Stage 2._ Bilingual
      text changes the page text format, so decide before the schema is frozen.
- [ ] **Licence and distribution** (see D-002; the current choice is provisional).
- [ ] **Publishing Hachure** as shareable components in the group's GIS ecosystem platform. _Stage 2 exit._
- [ ] **Real DEM source** and default demo region. _Needed by Stage 3._
- [ ] **Book UI technology:** DOM pages or canvas page texture. _Resolved in Stage 1, wave 1 (session 1D)._
