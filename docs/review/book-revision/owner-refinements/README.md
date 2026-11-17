# 6E · Larger, lower opening valley

The owner reported all prepared human checks passed on the production book at
`83f0ba6`, then requested a valley about 1.5× larger and lower on its page. See
D-W6-6E in [DECISIONS](../../../../DECISIONS.md). 6D #55 merged at `6161c74`;
this follow-up branches from that main, with no new Wave 5 launch.

## Presentation change

The glacial scene uses the existing stage `footprintFill: 1.5`. All three scene
axes scale together, preserving the true vertical scale and model state. Its
tilted-page anchor moves down by 4cqi using a layout offset, so the drawing,
projection and gesture hit tests share its position. Book dimensions, caption,
controls and plate scene stay in place. Flat phone, zoom/reflow and reduced-motion
views keep their existing camera fit; no blanket canvas zoom crops those views.

## Visual evidence

Production build, Windows, headless bundled Chromium with SwiftShader. This is
layout/interaction evidence, not another human listening or hardware-performance
pass. [Raw geometry and browser version](visual-review.json).

| View                | Evidence                   | Observation                                                                                                                                            |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1440 × 900 baseline | [Before](before-1440.png)  | Main `83f0ba6` at model time zero                                                                                                                      |
| 1440 × 900 final    | [After](after-1440.png)    | Projected block width 73.5 → 109.5 px (1.49×); height 78.6 → 116.3 px (1.48×); perspective explains the small difference from the uniform 1.5× setting |
| 1366 × 768 final    | [After](after-1366.png)    | Model remains above the caption, with about 15.8 px clearance at the default view                                                                      |
| 390 × 844 phone     | [After](after-phone.png)   | Existing fitted flat scene, vertical reading flow, no horizontal overflow                                                                              |
| Reduced motion      | [After](after-reduced.png) | Existing flat layout and readable scene                                                                                                                |

At 1440 × 900, the final front edge has about 25.7 px clearance above the caption.
Book and caption rectangles are identical to baseline. All captured states have
no page errors or horizontal document overflow. Only the default camera and
starting state are measured here; existing gesture/view regressions exercise the
interactive view. The owner pass predates this presentation change.

## Validation

- Full repository check passed: typecheck, lint, formatting, 886 tests passed / 7 skipped.
- 24 affected browser tests passed: glacial scene, glacial book, accessibility and plates book.
  Includes specimen drop, cut-face dragging, keyboard equivalents, retained state, phone,
  reduced motion and drawing-only fallback.
- Production build passed; 79 local review links resolve; patch whitespace check passed.

## Handover

> GV4: "Drawing → ink → colour transition into a complete, naturally coloured
> diorama standing on a tilted book page"

> GV6: "Keyboard equivalents for every gesture, text alternatives, reduced motion,
> lithology patterns as non-colour cue, reflow"

Done: owner-report reconciliation, 6D merge, larger/lower valley and visual captures.
No solver or scientific wording changes. Specialist science approvals and measured
broader-hardware evidence remain separate. The existing stage primitive supported
the refinement without an engine API change. The earlier owner scene-size approval
is amended by this explicit request, not reopened for unrelated design work.
