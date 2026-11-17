# 6G: book size, placement and study desk

The interrupted implementation was resumed from `0085e96`; its procedural walnut desk,
CSS 3D objects, contact shadows and fitted book are retained. The book is the visual
focus; cream paper contrasts with walnut (#765236), dark grain (#2c1a0e), light grain
(#c49668) and the restrained blue mug. Existing textbook typography is unchanged.
New screenshots prefixed `verified-` repeat the original `after-` captures on 2026-11-17.
The before images and JSON are retained from the interrupted session, based on main
`7fb7280`; they were not re-created during this resumption.

## Measurements at normal zoom

Rounded projected paper width × height in CSS pixels, both lessons at their default pose:

| View      | Lesson  | Before   | After    | Width / height growth |
| --------- | ------- | -------- | -------- | --------------------- |
| 1366×768  | Glacial | 477×319  | 886×419  | 1.86× / 1.31×         |
| 1366×768  | Plates  | 474×300  | 886×419  | 1.87× / 1.40×         |
| 1440×900  | Glacial | 559×373  | 1135×522 | 2.03× / 1.40×         |
| 1440×900  | Plates  | 707×420  | 1135×522 | 1.61× / 1.24×         |
| 1920×1080 | Both    | 1200×579 | 1412×656 | 1.18× / 1.13×         |
| 2560×1440 | Both    | 1741×833 | 2024×930 | 1.16× / 1.12×         |

The design width is 1040 px; the fitted view scales are 0.726882, 0.909057,
1.15018 and 1.64091 respectively. There is no single 1.5× multiplier: the fit
maximizes the book within viewport insets and reserves 280 layout pixels above the
paper for the raised block. In particular, 1.5× growth in both dimensions is **not
met**. This is the brief's fit exception, requiring owner review. Text is not reduced
to force the fit. The plates block has only 19, 10, 14 and 5 px headroom respectively.

The paper is not mathematically centred alone: the boards' midpoint is at 0.578,
0.580, 0.585 and 0.589 of the space between the desk top and navigation top. The
fit centres its conservative book-plus-headroom envelope. This moves the whole
composition upward while protecting the raised scene; exact paper centring remains
a deviation for owner review. JSON records paper/board edges, viewport and desk bounds.

## Visual and accessibility review

Both lessons have before/after captures at four desktop sizes, 390 px phone,
320 CSS px reflow, reduced motion and More contrast. Refreshed captures show no
page errors. Desktop pages, navigation and raised blocks fit. Phone/reflow and
reduced motion use the flat layout and permit vertical scrolling. The desk's
objects disappear in flat layout and More contrast. Decoration is aria-hidden,
not focusable and has pointer-events none. The notebook, pencil, mug and eraser
stay outside the paper; directional light and shadows make the surface read as a
desk without introducing lesson content. Scientific copy and simulations are unchanged.

## Verification and limits

The final repository check passes: 95 test files and 893 tests pass, with 7 capability-dependent skips. Typecheck, lint and formatting pass; the e2e TypeScript check also passes. Production builds pass, and `pnpm check:bundle` reports **6,785,162 / 10,000,000 bytes**. Captures
use Playwright Chromium with SwiftShader; they are not hardware GPU performance
measurements. No frame-rate regression claim is made without a before/after timing
comparison. No new network assets or dependency changes are introduced.

## Handover

> GV4: Drawing → ink → colour transition into a complete, naturally coloured diorama standing on a tilted book page

> PL6: Drawing → ink → colour transition into a naturally coloured block on the tilted book page, reusing lesson 1's stage

6G changes shared fit/desk presentation only; 6H owns entrance timing and effects.
Merge 6G first, then integrate/rebase 6H with both intents retained. Owner review
of the new presentation is pending. Existing author attribution is preserved;
new resumption work uses accurate Codex provenance instead of a Claude-generated footer.

### Browser regression results

The local combined run executed `glacial-acceptance.spec.ts`, `plates-acceptance.spec.ts`,
`glacial-book.spec.ts`, `plates-book.spec.ts`, `book-shell.spec.ts`, `book-acceptance.spec.ts`
and `reader-runtime.spec.ts`: **54 passed, 1 skipped, 1 failed** in 17.4 minutes.
The skip is native WebGPU authored transport, unavailable in bundled Chromium.
The failure was the longest glacial acceptance journey's final granite replay:
`Expected: >= 100; Received: 77.165; Test timeout of 300000ms exceeded`.
The model was still advancing (later snapshot 89.37), rather than failing a state assertion.
Other live-runtime and cross-lesson journeys passed, as did both lessons' new fit assertions.
Brief 6H diagnostics overlapped part of this run, so it is not a clean hardware timing measurement.
The retained log is `validation-browser.txt`; `local-timeout.txt` preserves its failure context.
An earlier concurrent run also timed out an unchanged relief unit test at 5 seconds;
the isolated complete `pnpm check` then passed (`validation-check.txt`).

A focused rerun disables Playwright trace recording only (the failed trace was 124 MB),
with the same assertions and 300-second test budget. It also timed out at the final replay (line 275), reaching **88.365 / 100 model years** at the unchanged 300-second budget; see `validation-retry.txt`. There was no competing 6H browser workload during this rerun. Local browser validation therefore retains a timing failure; do not describe the local suite as fully passing.
The full repository-wide browser suite was not run locally; only the named affected specs.
No hardware frame-rate comparison or native WebGPU run was performed in this resumption.

### Hosted failure and bounded retention fix

Hosted CI on `935785a` passed 115 browser tests (including the long glacial journey),
skipped one native WebGPU test and failed one recorded-fallback disclosure retention
check. The native `details` toggle event is asynchronous: an immediate level change
could render the old cached `flapOpen` value before that event was handled. The scene
now flushes native flap state before a level rerender or disposal. This small
correctness fix is necessary to complete the presentation regression gate; it changes
neither lesson copy nor model state.

The new same-task native-open/level-change regression fails without the two flush
calls (expected `open`, received `null`) and passes with them. All five production
`glacial-fallbacks.spec.ts` tests pass with the fix. `validation-fallback.txt` and
`validation-fallback-red.txt` preserve both sides. Hosted full-suite rerun is required
on the final branch; the earlier green long-journey result is not claimed as a pass
for every test on the updated commit.
