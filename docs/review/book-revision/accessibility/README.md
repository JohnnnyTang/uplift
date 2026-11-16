# 6B · Acceptance and accessibility audit

Audit started 2026-11-16 from merged `main` **cd856bcbf459c88f6e08cf4308d8c80bfb160a0a** (7G).
Branch `s1/w6/6b-accessibility`, isolated worktree. Both default lessons and the retained research route
are in scope. The [integrated ledger](../../../plan/stage-1-acceptance.md) is the current release-status
entry point. Historical packets keep their original evidence and failed science outcomes.

**Release remains open.** At the owner's instruction, human checks stay pending with assigned roles;
[human-checks.md](human-checks.md) has the current two-lesson procedures and result template. Stage 2
planning is deferred at the owner's request. 6C's independent packet preparation does not close review.

## Findings and bounded fixes

| Finding                                                                                                              | Change                                                                                                           | Verification                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Both reader lessons nested `.reader-book` main inside `#app` main, generating three moderate axe landmark violations | Reader book is a div; the shared app host remains the one main landmark on reader and research routes            | New `e2e/accessibility.spec.ts`, both lessons and research return; before/after axe reports          |
| Glacier university deeper panel contained an overflowing equation without keyboard focus, a serious axe violation    | Shared display-formula primitive is focusable; semantic MathML retained; copied reading panels preserve tabindex | Regression reaches equation with Tab and scrolls with ArrowRight, then Escape restores trigger focus |
| Book-shell and reader-runtime fixtures ignored `UPLIFT_FIXTURE_PORT`                                                 | Both use the shared fixture origin, preserving their explicit per-suite origin overrides                         | Final suite runs on non-default ports 4273/4274                                                      |
| Current ledger still presented 2026-11-09 / 5A as the current baseline and repeated superseded owner-pending states  | New current 6B section; historical results retained; final D-W7-7G approval distinguished from pending F2        | Read against merged DECISIONS.md and the 7G evidence                                                 |

The supported-fallback walk also found that default glacier startup failure rebuilt the recorded
source on each return, losing the selected comparison. The controller now retains every source kind,
pauses recorded playback while away and restores its play intent. Unavailable recordings are labelled
as an illustration preview, and unavailable 3D is labelled drawing-only. Startup failure is handled
inside the same scene mount, with failed initialized-host resources disposed. New
`e2e/glacial-fallbacks.spec.ts` covers the actual default app rather than only review fixtures.

The code/test paths outside the two named documentation ownership paths are the bounded fixes above:
`uplift/book/src/reader/shell.ts`, `hachure/runtime/src/widgets/formula.ts`,
`e2e/accessibility.spec.ts`, `e2e/book-shell.spec.ts`, `e2e/reader-runtime.spec.ts`,
`e2e/glacial-fallbacks.spec.ts`, `uplift/book/src/app/glacial-spread.ts`,
`uplift/book/src/scenes/glacial/review.ts`, and `uplift/book/src/scenes/entries.ts`.
`DECISIONS.md` is the required session record. No solver, scientific claim or authored relief changes.

## Reproduce

Use Node 22+ and pnpm 11, and install the pinned dependencies and Playwright Chromium. From this worktree:

```powershell
pnpm install --frozen-lockfile
pnpm check
$env:UPLIFT_E2E_PORT = '4273'
$env:UPLIFT_FIXTURE_PORT = '4274'
pnpm test:e2e
pnpm check:bundle
```

The suite builds the production app and owns both local servers. For the supplementary scan, separately
run a production preview on a free port, then run:

```powershell
pnpm build
pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4273 --strictPort
# In a second terminal:
$env:UPLIFT_AUDIT_ORIGIN = 'http://127.0.0.1:4273'
node docs/review/book-revision/accessibility/audit.mjs
```

The script covers school, open answer, university, deeper/sources panels, 390/320 px, and the research
school/university routes: 16 scans. It records all violation severities and incomplete rules, checks
panel focus/escape return and overflow, and exits nonzero for serious/critical violations. The new
browser regression rejects every violation, including the moderate landmark regressions.

## Verification record

Final application revision: **11feceaa7089a861ce20bc856fe09c5c421aca7f**. The final changes after that
revision are audit documentation/evidence only. Windows 11 10.0.26300, Intel Core Ultra 7 258V;
Playwright 1.65 bundled Chromium 158.0.8127.18, headless SwiftShader. This is not a new hardware pass.

| Verification                                         | Result / scope                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                         | Pass: typecheck, lint, formatting, 886 unit tests passed / 7 skipped                                                                                   |
| Full `pnpm test:e2e`, isolated ports                 | 109 passed / 4 hardware-only skipped, 20.5 min; included landmark/equation and fixture-origin fixes, before the subsequent fallback lifecycle patch    |
| Rebuilt production affected-suite rerun on `11fecea` | 19/19 passed, 3.5 min: accessibility, glacial-book, glacial-fallbacks and glacial-scene                                                                |
| Supplementary 16-state audit on `11fecea`            | Zero violations at every severity; 14 lesson scans have incomplete contrast checks, two research scans have none. [Final raw result](axe-results.json) |
| Production build and bundle                          | Pass; 6,773,706 bytes / 10,000,000-byte budget                                                                                                         |
| Documentation links                                  | Local evidence links checked; no missing targets                                                                                                       |

The four browser skips are real WebGPU device loss, same-device GPU replay, production GPU recording,
and native WebGPU authored transport. Unit skips likewise do not establish GPU support. Existing
adapter evidence remains in its original packets. The final production rerun covers every app path
changed after the full suite; unchanged scientific solvers were not retuned.

One unchanged plates-relief test exceeded its default timeout when unit and browser workloads overlapped
(885 passed / 1 timeout / 7 skipped). With browser workloads stopped, the full `pnpm check` passed without
changing its timeout or assertion. This timing observation is not an application performance result.

The initial baseline browser attempt was interrupted after discovering the fixture-origin failures and
accessibility defects. Connection-refused failures against port 4174 are harness failures, not lesson
failures. The baseline `pnpm check` passed 886 unit tests, 7 skipped. [axe-before.json](axe-before.json)
records the 16 initial scans, including the serious equation finding. Final evidence above uses the fixed
production build. No skipped GPU test will be counted as a hardware pass.

## Traceability and handover

> PL7: "Keyboard equivalents, text alternatives, reduced motion, glyph and pattern cues for boundary
> types, reflow and phone."

> PL8: "Two-lesson book: real page turn, contents, deep links; lesson 1 state preserved across turns;
> research route retained."

> GV6: "Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as
> non-colour cue, reflow."

GV6 comes from the [glacial single source](../../../plan/stage-1-wave-5-glacial.md); the PL rows come from the [Wave 7 single source](../../../plan/stage-1-wave-7-plates.md).
PB1–PB9 and applicable AC foundation obligations are mapped in the integrated ledger. The former
waterfall challenge and failed glacier morphology remain recorded research limitations, not new
release teaching claims.

Done: current audit scope, reproducible expanded scans, bounded fixes, regression coverage and assigned
human procedures. Not done: actual listening, real browser zoom/legibility, projector/colour review,
first-time readers, F2, expert decisions and broader hardware. Surprises: serious-only opening-page
scans missed both landmark navigation defects and the deeper equation; fixture fallback coverage did
not establish the default app's failure-and-return behavior. Plan-changing fact: audit
optional reading surfaces as well as opening spreads; 6C must preserve these pending human distinctions.
6C follows the merged 6B result; 6D retro follows current review results. Stage 2 planning waits.
