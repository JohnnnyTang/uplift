# Wave 5 B/C/D local handover

Implemented in parallel with GPT-6.1 Sol / high, from merged 5A (`8069a7f`).
Each session used its own branch and sibling worktree. The frontend-design skill
was loaded for UI work; Playwright was installed with the skill-installer Git
fallback and loaded for browser verification.

## Commits and review order

- B: `aee9e20`, `s1/w5/5b-runtime`: independent lifecycle/widgets, authored host
  initialization, settlement and retained fixed-step state.
- C: `292a58c`, `s1/w5/5c-book-shell`: bounded responsive book, settled paging,
  focus/history/gesture handling and research/depth suspension.
- D: preregistration `aa3acda`, implementation `933c6a8`, fixture fix `e4788a9`,
  `s1/w5/5d-playable-example`: real contour and water scenes, shared Ink primitives,
  sourced draft content and prospective prepared-terrain evidence.

The isolated `s1/w5/5bcd-lead` branch contains the lead decisions and a local
B -> C -> D review stack. Main is unchanged. These are not merged PRs; do not
start 5E from an unmerged session branch. GitHub CLI reported the saved keyring
credential invalid, so remote PR creation was not completed.

## Verification

- Combined `pnpm check`: 59 files / 509 tests; `pnpm build` passes (existing
  large-chunk advisory remains).
- B: three reader browser tests plus 68 existing GPU browser tests passed.
- C: nine browser tests; full 1366x768 composition fits, with phone, reflow,
  explanation and paging evidence in `shell/`.
- D: three renderer/lifecycle browser tests; three claim tests; all registered
  outcomes retained in `docs/science/validation/playable-book/`.
- Lead composed production-driver smoke in native installed Chrome: forced
  cpu-worker, cpu-64 and webgpu each reach ready, accept keyboard source movement
  to (19,9), yield 73 wet cells, retain selection on return and reset to zero.
  Forced flat remains a labelled fallback. No browser page errors in live paths.
  This is integration smoke, not full-horizon GPU scientific acceptance.

The smoke used `/e2e/fixtures/playable-spreads.html?host&backend=...` with reduced
motion. It exposed a Worker fixture importing the browser barrel, corrected by
using `@hachure/runtime/worker` plus exact Vite/TypeScript resolution. The public
production adapter now runs against B's host rather than a fixture-only solver.

## Lead choices and rationale

Keep 5A's fixed lessons/composition to avoid contradictory parallel design.
Use shared awaited step/settle/resume APIs so no model work bypasses departure.
Publish source markers only after accepted operations. Use three authored slope
variants rather than seeds that do not change authored terrain. Keep the research
link in the existing header to fit desktop height without shrinking type. Hide
the water lift slider to preserve one primary gesture. See `DECISIONS.md` D-5BCD.

## Still open

5E default-app/research migration and 5F integrated book acceptance are separate
sessions. Full prepared-terrain GPU science acceptance, human discoverability,
screen-reader listening, projector/target hardware and expert scientific review
remain pending. No claim of Wave 5 completion, reviewed science or classroom
learning gains follows from these automated checks.

Session PR-ready descriptions: `shell/README.md`, `example/PR.md`, and
`e2e/fixtures/reader-runtime-evidence.md` plus the runtime handover in this chat.
