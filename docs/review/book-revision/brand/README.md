# Localized book identity · 6K

Owner-requested follow-up, 2026-11-17. Base: merged `origin/main` at `940a155`.
Branch: `s1/w6/6k-brand`. Owned paths: reader branding and shell integration,
minimal scene/camera layout glue, UI translation keys, bilingual navigation
regression, book HTML metadata, README, the two product-development prompt
documents, this review note and append-only `DECISIONS.md`.

The existing checkout contains unrelated work. This session uses an isolated
worktree under the ignored `.worktrees/` directory: the sibling location required
by the normal workflow was not writable inside the sandbox. No peer branch is a
dependency. This is an owner-requested follow-up, not a new lesson or Stage 2.

## Design and owner revision

Retain the book's materials: walnut `#4a3324`, paper `#faf8f2`, graphite `#292b2c`,
soft ink `#5d5f5c`, and annotation blue `#27477a`. The lettering is warm ivory
`#fff9e9`. Use bold Songti/SimSun for Chinese and Palatino for English, with a
restrained lower-edge shadow suggesting shallow relief against the walnut.
Enhanced contrast and forced colours remove the text effect. No new motion or
font download.

The first design put both languages in a masthead above the controls. The owner
rejected that composition and specified the final placement and language behavior:

```text
一页山河                  [existing camera controls]
                       翻开一页，看山河生长。
                       [existing playable book]
                       [existing navigation]
Contents → lessons, research, 岩墨引擎 + engine line
```

The name occupies the upper-left corner. The slogan is centered below the camera
controls and above the book. Names and slogans show only the chosen language,
using the same text bindings as the lessons. The tab title follows the language,
too. The engine name and line sit in Contents as a quiet colophon.

On phones the name enters normal flow above the controls; the slogan wraps below
them. The existing camera ResizeObserver measures toolbar and slogan together so
the tilted book keeps its viewport budget. The lesson retains its sole h1. No
simulation, scientific copy, authored relief or model-state behavior changed.

## Local editorial materials

The owner requested that the reconstructed development-prompt documents stay local.
Both files are gitignored and excluded from the publication branch's history.
The English revision and native Chinese rewrite remain on disk in the session
worktree; they are not release assets or part of the public book.

## Verification

Visual checks used local Chromium 158 and SwiftShader on Windows. Checked both
reading languages, title and slogan language round trips, engine credit, contents
keyboard dismissal, reduced motion, enhanced contrast and navigation to lesson 2.
At 1366 × 900, 1280 × 720, 1024 × 768, 390 × 844 and 320 × 640: no horizontal
overflow, name clear of toolbar, slogan below controls and above the book, and
Contents within the viewport. No captured browser errors. See
[layout measurements](layout-checks.json).

Screenshots: [English desktop](desktop-en.png), [Chinese desktop](desktop-zh.png),
[Chinese Contents](contents-zh.png), [Chinese phone](phone-zh.png).

Final checks after the owner's placement revision:

- `pnpm check`: typecheck, lint and formatting pass; 916 tests pass, 7 skipped.
- Production build passes. Bundle: 6,912,437 / 10,000,000 bytes.
- Production Chromium: 13 browser tests pass (bilingual navigation, reader
  lifecycle and page-turn suites). Covers exact retained model/plate state,
  language-specific branding, single-sheet turns, reduced-motion interruption,
  browser Back during a turn, focus and phone reflow.
- Prompt structure/source checks: 65 matching numbered prompts, 12 historical
  phases per language, identical external source URLs; final formatting passes.

Browser command (PowerShell ports 4323/4324, installed Chromium):

```text
pnpm exec playwright test e2e/bilingual-navigation.spec.ts e2e/book-shell.spec.ts e2e/page-turn.spec.ts --grep-invert 'viewport evidence|large reading scale'
```

The excluded tests generate earlier sessions' screenshot evidence. New screenshots
and layout measurements above cover this revision without rewriting that history.

## Handover

Relevant acceptance anchors:

- **GV6:** “Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as non-colour cue, reflow.”
- **PL7:** “Keyboard equivalents, text alternatives, reduced motion, glyph and pattern cues for boundary types, reflow and phone.”
- **PL8:** “Two-lesson book: real page turn, contents, deep links; lesson 1 state preserved across turns; research route retained.”

Done: localized book/engine identity, local editorial revisions and responsive
visual review. The owner subsequently authorized commit, push, release update and
GitHub Pages publication. No new scientific or hardware validation or native-reader
user study is claimed. Release and deployment results are recorded on GitHub.
Surprise: the supplied prompt document was untracked in the original checkout;
its original stays untouched and the edited versions live in this session worktree.
Plan implication: brand copy belongs to the existing language system, and any
future text between the camera controls and book must be included in stage sizing.
