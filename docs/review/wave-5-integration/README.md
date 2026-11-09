# Consolidated Wave 5 base

The owner requested one Wave 5 branch for completed work and future sessions.
**Canonical branch and PR base: s1/w5/integration.** Main is unchanged.
This branch fast-forwards main's 5A baseline to 7bf47d3, preserving the full A–F
implementation history, original references, owner corrections and G–N plan.
All existing committed Wave 5 branch tips are ancestors; no implementation conflict
or lockfile merge was necessary. [Exact source commits](sources.json).

The older scene-direction worktree had an uncommitted documentation draft. Its
[exact patch](superseded-scene-direction.patch) is preserved as archival data, including
its decision entry. It is superseded by the current product/colour/transition and
glacial-interaction decisions. Do not apply it: that would restore obsolete scope
and strict-transition requirements. The source worktree is left intact.

## Future sessions

Fetch origin and create each session branch/worktree from origin/s1/w5/integration.
Target PRs to s1/w5/integration. Merge in the order in the
[5G–5N plan](../../plan/stage-1-wave-5-glacial.md), then rebase dependent sessions on
that updated integration branch and rerun required checks. Only merged dependencies
may be consumed. This is an explicit Wave 5 exception to main-only session rules,
authorized by the consolidation request; main remains the default for other waves.
Do not use an old review branch or sibling WIP as a base. Do not start implementation
as part of this consolidation. Next session is 5G after this base is verified.

Keep this branch green. Merge/release to main remains a separate action; a consolidated
branch does not claim that the glacial lesson, product or human gates have passed.
Existing source branches are retained for traceability, not competing active bases.

## Verification

Verified in this integration checkout:

- pnpm check: typecheck, lint, formatting and 58 files / 503 tests passed.
- pnpm build: passed; existing large-chunk advisory remains.
- Bundle budget: 2,466,888 / 10,000,000 bytes passed.
- Existing app smoke suite: 8/8 passed in installed headless Chrome (44 seconds),
  including default/research routing, retained state, fallback and phone flow.
- Every listed branch tip is an ancestor. Original reference hashes and the archived
  draft hash match; production source and lockfile are unchanged from 7bf47d3.
- No full browser/GPU suite, expert/human acceptance or hardware benchmark was rerun.

[Fresh smoke capture](default-water-smoke.png).
No production implementation changes accompany the consolidation; active edits only
clarify branch workflow and preserve the superseded draft.
