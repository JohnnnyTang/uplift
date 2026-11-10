# Uplift

**A geography book whose drawings come to life.** Ink illustrations lift off bounded paper pages into
3D scenes readers can touch and explore. Each spread offers one small discovery, an optional question
and answer flap, and a reason to turn the page. High-school and university readers explore the same
model at different depths.

Underneath the book is **Hachure**, the terrain and ink engine. Hachures are the short ink strokes old maps
used to show slope, which is the look the engine draws.

> **Wave 5 base:** `s1/w5/integration` contains completed A–F work, references and the
> current G–N plan. Future Wave 5 sessions branch from and target this branch.
> [Integration handover](docs/review/wave-5-integration/README.md).
>
> **Status:** The local Wave 5 review stack delivers two playable lessons, contour lift and
> prepared-terrain spring placement, with page turning and a labelled erosion research route.
> Main remains at 5A. Implementation verification and pending owner, human accessibility,
> expert and hardware review are tracked in the [acceptance ledger](docs/plan/stage-1-acceptance.md)
> and [review packet](docs/review/book-revision/acceptance/README.md). Wave 6 completes those gates;
> local integration does not establish release readiness.

The latest review branch includes Wave 5B–5F; main remains at 5A. The first lesson is
**From V to U**: a textbook drawing of a glaciated valley turns into a naturally coloured
3D diorama standing on a tilted book page. The reader picks a rock type, watches the
glacier reshape the valley, scrubs back through the run and compares separate runs.
[Wave 5 sessions 5G–5N](docs/plan/stage-1-wave-5-glacial.md) are planned, not started. [Saved references](docs/references/owner-2026-11-09/README.md)
and [branch audit](docs/review/book-revision/current-direction-review.md).

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
