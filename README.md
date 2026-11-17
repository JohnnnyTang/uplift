# Uplift

**A geography book whose drawings come to life.** Ink illustrations lift off bounded paper pages into
3D scenes readers can touch and explore. Each spread offers one small discovery, an optional question
and answer flap, and a reason to turn the page. High-school and university readers explore the same
model at different depths.

Underneath the book is **Hachure**, the terrain and ink engine. Hachures are the short ink strokes old maps
used to show slope, which is the look the engine draws.

The default book has two playable lessons: **From V to U**, a glacial process model,
and **Where plates meet**, an authored illustration of continental plate boundaries.
Both are on `main` after Wave 7 (PR #52), with the 6B accessibility and fallback audit merged
(PR #53). The labelled erosion research example remains
available through Contents. The earlier contour and prepared-terrain water lessons were
removed (D-W5-5M2 and D-W5-5N2).

**Release status:** Stage 1 is released by owner direction (D-W6-6F). Play the
[published book](https://johnnnytang.github.io/uplift/). The owner authorized publication
of the 6G/6H presentation updates and the 6I/6J English–Simplified Chinese reader,
single-sheet page turn and scrollbar-flash fix on 2026-11-17. The language menu
remembers your choice; changing language or turning pages preserves lesson state.
See the [bilingual and page-turn evidence](docs/review/book-revision/bilingual-turns/README.md).
This does not establish classroom validation or a broader hardware performance pass;
the recorded limitations and human follow-ups remain. Start with
the [two-lesson review packet](docs/review/book-revision/release/README.md) and
[current acceptance ledger](docs/plan/stage-1-acceptance.md).

In _From V to U_, choose a rock, play, pause and inspect, then compare separate runs at
matched model time. In _Where plates meet_, choose a boundary and play or scrub its
illustrated sequence; its shapes are authored, with no simulation clock. Reading level,
answer reveal and navigation remain independent of play.

The [product story](docs/product-story.md),
[glacial brief](docs/plan/stage-1-wave-5-glacial.md),
[plate-boundaries brief](docs/plan/stage-1-wave-7-plates.md) and
[saved owner references](docs/references/owner-2026-11-09/README.md) describe the intended experience.
The `s1/w5/integration` base exception applies only to further Wave 5 sessions; Wave 6 targets `main`.

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
pnpm install --frozen-lockfile
pnpm dev          # book shell at http://localhost:5173
pnpm test         # Vitest: solver and spread logic
pnpm check        # typecheck + lint + format check + unit tests
pnpm build        # production build of the book (separate from check)
pnpm test:e2e     # builds and audits production routes in Playwright
```

For the browser suite, install its Chromium once with `pnpm exec playwright install chromium`.
See the [browser-test guide](e2e/README.md) for fixtures, backends and hardware evidence.
To inspect the production build, run `pnpm --filter @uplift/book preview --host 127.0.0.1`.
The [short teacher journey](docs/review/book-revision/release/teacher-journey.md) includes both
lessons, the research route and an existing recording; it is a review guide, not a sign-off.

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
