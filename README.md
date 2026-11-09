# Uplift

**A geography book whose drawings come to life.** Ink illustrations lift off bounded paper pages into
3D scenes readers can touch and explore. Each spread offers one small discovery, an optional question
and answer flap, and a reason to turn the page. High-school and university readers explore the same
model at different depths.

Underneath the book is **Hachure**, the terrain and ink engine. Hachures are the short ink strokes old maps
used to show slope, which is the look the engine draws.

> **Status:** Stage 1 product realignment. Hachure foundations and an integrated erosion research
> example run today; the intended playable book is not yet delivered. The next work is book-sized
> composition, immediate 3D play and two interactive spreads with page turning. See the
> [product story](docs/product-story.md) and [active plan](docs/plan/product-realignment.md).

## Why this exists

Geography is spatial and slow. Rivers cut valleys over timescales far longer than any lesson, and a page
shows one frozen moment.
Uplift invites readers to play first, see a consequence and uncover an explanation when curious.
Scientific depth supports that invitation: landscape changes emerge from simulated processes,
quantities agree with the scene, and model limits and applicable time/scale are stated honestly.
Questions, challenges and advanced controls never stand between a reader and the next page.

## Repository layout

```
hachure/            the engine (MIT); never imports from uplift/
  terrain/          @hachure/terrain — heightfield, water, sediment; WebGPU solver + CPU reference
  ink/              @hachure/ink — ink line and hatching render layer, contour lift
  runtime/          @hachure/runtime — spread schema, lifecycle, probe bindings, page widgets
uplift/             the book
  book/             @uplift/book — the book shell (Vite app)
  spreads/          @uplift/spreads — one folder per spread (content is CC BY 4.0)
docs/
  handoff.md        the project brief: principles, rigour policy, architecture, Demo 1 spec
  product-story.md  the product story and the threads that run through every stage
  plan/             the stage → wave → session implementation plan
DECISIONS.md        decisions and open questions, for group review
AGENTS.md           rules for coding agents (CLAUDE.md points here)
```

## Run, build, test

Requires Node 22+ (24 recommended, see `.nvmrc`) and pnpm 11 (`corepack enable`).

```sh
pnpm install
pnpm dev          # book shell at http://localhost:5173
pnpm test         # Vitest: solver and spread logic
pnpm check        # typecheck + lint + format check + tests (what CI runs, plus build)
pnpm build        # production build of the book
```

## How the work is organised

Work runs in **stages** (each closed by a group-reviewed gate), each stage in sequential **waves**, and each
wave in **sessions** that run in parallel on separate git worktrees. The framework and the current stage's
detailed plan are in [`docs/plan/`](docs/plan/README.md). Later stages are planned only when the previous
one closes, because real implementation changes the facts.

## Inspiration and precedent

- [Every Joule](https://iamtechartist.com/every-joule/) by Techartist: the quality bar for a 3D textbook.
- UC Davis KeckCAVES [Augmented Reality Sandbox](https://arsandbox.ucdavis.edu/): the physical precedent for
  shape-the-terrain, watch-the-water teaching. Uplift adds web delivery, erosion and deposition over time,
  curriculum structure and two reading levels.

## Licence

- Code (`hachure/`, `uplift/book/`, tooling): [MIT](LICENSE).
- Educational content (`uplift/spreads/`, `docs/`): [CC BY 4.0](LICENSE-CONTENT.md).

The split is provisional until the group settles the handoff's open licensing decision; see
[DECISIONS.md](DECISIONS.md) D-002.
