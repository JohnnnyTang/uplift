# Stage 1 follow-up: bilingual reader and single-sheet turns

Owner request, 2026-11-17. These are two presentation follow-ups to merged 6G/6H,
not a new lesson or a reopened Wave 5. Base and eventual PR target: main
(verified origin/main 7556f84). Existing checkout edits are left in place.

## 6I — English and Simplified Chinese

Reader action: choose English or 简体中文; both current lessons and book controls
change language while lesson state stays intact. Remember the preference; set the
page language and provide Chinese font fallbacks. Translate lesson text, controls,
accessible names, status messages, diagrams, disclosures and teacher/source context.
Retain original citation titles/URLs and scientific qualifications. No new science;
translated scientific drafts retain expert-review provenance. No model reset or
new run on language switch. Bindings and units remain sourced from live state.

Owned paths: new uplift/book/src/i18n/**, localized content under uplift/spreads/**,
lesson copy/words/reading-panel/notes modules, localization tests. Minimal text-only
wiring in shell and scene modules is permitted and reviewed by integration.
Do not alter transition behavior or shell navigation lifecycle.

## 6J — Return to ink, then turn one page

Reader action: next/previous first settles the current model, lowers/fades the scene
back into flat ink, then turns a single paper leaf about the spine in the requested
direction. The desk, book cover and other page stay still. Incoming content is
revealed beneath the leaf, then its existing entrance can run. This is a visual
transition, not a physical book simulation or a scientific process animation.
Use the existing paper/ink palette and typography; a front/back leaf, edge shading
and restrained moving shadow provide depth. Keep accessible content as live DOM;
any duplicated transition face is inert and hidden from assistive technology.
Reduced motion skips spatial animation. Rapid requests, history, detach, disposal,
scene gestures and keyboard focus must remain safe; exact retained state survives.

Owned paths: reader turn-effect modules/CSS and navigation lifecycle, generic ink
transition primitive, minimal runtime controller contract, scene transition adapters,
transition unit/browser tests. Do not translate or rewrite content.

## Integration and verification

Separate sibling worktrees and session branches from the same merged base. Shared
file edits are narrow wiring only; integrate 6I then 6J and resolve glue centrally.
Lead owns this brief, DECISIONS.md and final evidence/handover. Run pnpm check and
pnpm build, relevant navigation/state/browser checks, then visually inspect normal,
Chinese, phone and reduced-motion journeys in both directions. Record actual
results and limitations; no inferred expert or human acceptance.

Acceptance anchors to quote in the handover:
- GV4: Drawing → ink → colour transition into a complete, naturally coloured diorama standing on a tilted book page.
- GV6: Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as non-colour cue, reflow.
- PL7: Keyboard equivalents, text alternatives, reduced motion, glyph and pattern cues for boundary types, reflow and phone.
- PL8: Two-lesson book: real page turn, contents, deep links; lesson 1 state preserved across turns; research route retained.

The new reverse transition and single-leaf visual supersede the whole-article
rotation. English/Simplified Chinese switching is confirmed by the owner. Research
solver internals, historical evidence and repository documentation need not be
translated as reader lessons; any exposed research-language boundary must be clear.
