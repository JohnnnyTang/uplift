# English / Chinese reading and single-sheet page turns

2026-11-17. Owner-requested sessions 6I and 6J; integration branch
`s1/w6/6i-bilingual-turns`, based on merged main `7556f84`.

## Delivered

The language menu switches between English and Simplified Chinese and remembers
`uplift.language`. Both current lessons include translated lesson text, glossary,
controls, captions, diagrams, accessible descriptions, disclosures and teacher
notes. Citation titles and addresses remain intact. The research example is
explicitly labelled English. Language updates text in place: model owners, WebGL
canvases, run IDs, recorded time, kept runs and plate stages are retained.

Next/previous first settles the outgoing lesson, washes its colour into ink and
lowers the illustration to the paper. A single sheet then turns about the spine,
showing the arriving page on its reverse. The desk and book stay stationary. The
incoming illustration stays flat until the sheet clears, then starts its entrance.
The sheet is decorative inert DOM, hidden from assistive technology; cloned control
associations are removed and SVG IDs are unique. No simulation or solver changed.

The reverse presentation lasts 850 ms and the sheet turn 950 ms. These are artwork
timings, not scientific time. Vertically reflowed pages use a brief 160 ms fade;
reduced motion skips spatial effects. This deliberately uses a rigid sheet with
front/back faces and shading, rather than a physical paper simulation.

## Verification

Combined browser run: **12 passed** using production build, bundled Chromium and
SwiftShader on Windows. Commands (PowerShell environment ports 4293 / 4294):

```text
pnpm exec playwright test e2e/bilingual-navigation.spec.ts e2e/page-turn.spec.ts e2e/book-shell.spec.ts --grep-invert 'viewport evidence|large reading scale'
```

This covers language round trips without canvas replacement; exact retained rock,
run, model-time and plate-stage state; persistence; Chinese phone reflow; both turn
directions; flat-before-leaf ordering; deferred entrance; stationary book bounds
(within 1 px); unique IDs; focus; reduced-motion interruption; coalescing; history;
gestures; failed and delayed mounts; suspension; disposal; disclosures and reset.
Historical screenshot-only tests were excluded to avoid rewriting earlier evidence.

The catalog test inspects compiled lesson content for missing translations and
checks every live-binding token for equality across languages. Reverse transition
unit tests cover endpoints, cancellation, reduced motion and the presentation clock.

Full integrated `pnpm check`: **916 passed, 7 skipped**, typecheck/lint/format pass.
Production build passes; bundle is 6,908,936 bytes against the 10,000,000-byte limit.
The standalone suite passed in 18.32 seconds. A concurrent
browser/unit run timed out in three unchanged CPU-heavy tests; that result is
retained here rather than treated as a code failure or hidden by larger timeouts.

Screenshots: [next sheet](next-leaf.png), [previous sheet](previous-leaf.png),
[Chinese glacier](chinese-glacial.png), [Chinese plates](chinese-plates.png),
[Chinese sheet](chinese-leaf.png), [phone](chinese-phone.png), [320 px](chinese-320.png).
These show a single leaf over a stationary spread with a flat drawing underneath.

## Handover and acceptance anchors

- **GV4:** “Drawing → ink → colour transition into a complete, naturally coloured diorama standing on a tilted book page.” The same presentation now has a reverse departure before the sheet turn.
- **GV6:** “Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as non-colour cue, reflow.” Language and turn checks preserve these guarantees.
- **PL7:** “Keyboard equivalents, text alternatives, reduced motion, glyph and pattern cues for boundary types, reflow and phone.” Chinese controls/alternatives and the phone journey are covered.
- **PL8:** “Two-lesson book: real page turn, contents, deep links; lesson 1 state preserved across turns; research route retained.” The combined navigation checks pass with retained state.

Done: both requested presentation features, separate worktree implementation,
integration and automated browser evidence. Not claimed: new scientific validation,
Chinese expert-language signoff or owner visual acceptance of the revised effect.
Chinese scientific copy retains its expert-review marker and the original sources.

Surprises: removing the copied camera toolbar shifted the snapshot book by the
reserved toolbar height; retaining its layout and hiding the measured incoming
article fixed alignment and overlapping help text. Shared-file conflicts were
limited to localized status writing and scene handle wiring; both were preserved.
Plan implication: future languages must pass the compiled-content and binding-token
coverage tests; future scenes can reuse the optional presentation departure hooks.

Narrow-layout follow-up: visual inspection caught a clipped language selector at 320 px.
The phone bar now uses two rows with full-size controls and reserved bottom space.
The strengthened browser check passes at both 390 px and 320 px for both lessons.
Final visible Chinese pages contained no untranslated English prose; the English
language option remains named English. No browser errors were captured.
