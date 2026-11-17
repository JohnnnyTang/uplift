# 6B · Human accessibility checks

## Owner update · Stage 1 release · 2026-11-16

The owner reported that **expert review is done by the project team** and directed that
the group review of the working book be recorded as met, and that Stage 1 be published
and released. H6 (glacier), H7 (plates) and the retained research review are
**passed (owner-reported, team review)**. Reviewer names, reviewed commit, claim-level
answers and requested edits were not supplied and are not invented here. With H1–H5
already passed (D-W6-6E), the Stage 1 exit gate is met and **Stage 1 is released**.
H8's measured multi-device matrix and the narrow 6A latency misses stay recorded as
known limitations, not release blockers. Publication is by GitHub Pages. Stage 2
planning still needs its own owner direction. See D-W6-6F in [DECISIONS](../../../../DECISIONS.md).

Records below this block describe earlier states and keep their original wording.

## Owner update · 2026-11-16

The owner reported **"all passed for human checks"** on the production review at
`83f0ba6`. H1–H5, including F2, are **passed (owner-reported)**. The general pass also
covers human device-usability feedback; it does not supply H8's measured hardware
matrix. Exact setups, tester details and raw observations were not supplied.
Scientific specialist sign-offs H6/H7 and the retained research review remain
separate and pending; no publication or Stage 2 authorization is inferred.
See D-W6-6E in [DECISIONS](../../../../DECISIONS.md).

6D #55 is merged. The requested 1.5× opening-valley refinement follows this review;
the baseline pass is not a claim of human retesting after that change. Earlier
pending-human records below describe the audit before this owner report.

Status: **pending-human**, 2026-11-16. The owner explicitly asked to keep human checks pending with
assigned roles. No participant, screen-reader session, projector check or real browser zoom result is
claimed. A role below is accountable for arranging the check; it is not a claim that someone accepted an
assignment. The project lead names participants before execution. These procedures replace the archived
contour/source and prediction-gated listening flows for the default book.

Use the final reviewed production commit and both lessons, _From V to U_ and _Where plates meet_. Record
pass, fail or unable-to-complete separately for each step. Link a defect and retest when a step fails.
Do not treat a successful axe run, focus assertion or screenshot as listening evidence.

## H1 · Screen-reader listening — accessibility reviewer, coordinated by 6B QA

Record date, tester identifier (with permission), commit, OS, browser/version, screen reader/version,
keyboard configuration, display/zoom, reduced-motion and contrast settings. Use a fresh tab with local
collection off. Suggested first setup is Windows/NVDA with Chrome; add other assistive technology only
when someone actually tests it. Do not write an expected utterance as if it was heard.

1. Open the book and use landmark/heading navigation. Confirm one main landmark, the lesson title and a
   sensible reading order. Describe what the invitation says you can do; do not answer the question first.
2. Tab to a rock choice; change it using arrow keys. Listen for the selected name and resulting scene
   description. Start and pause playback, inspect the timeline, then make a second rock choice. Explain
   which run is live, which is kept, and whether the comparison refers to the same model time. Check that
   announcements are understandable and do not continually interrupt reading.
3. Open the answer before choosing a prediction. Read sources/limits and the university deeper panel.
   Tab to the overflowing equation, scroll it by keyboard, read its MathML, close with Escape, and verify
   focus returns to the panel trigger. Changing depth must preserve the run and comparison.
4. Turn to _Where plates meet_ using the explicit button and, outside an input, PageDown. Listen for the
   new heading and the illustration label. Choose each boundary, play/pause, and scrub early to late.
   Describe the current crust and distinguish each viewed ghost from the selected boundary using the
   spoken name and pattern, without relying on colour.
5. With focus on a range or other control, use its keys and confirm they do not turn the book. Open and
   close the answer and reading panels, use Contents, then PageUp back from the heading. Verify retained
   glacier run, rock, kept comparison and playback intent. Test the pointer-independent route completely.
6. Visit Research example and return. Confirm the recorded comparison, uncalibrated terrain time,
   pending waterfall and collection-off state are distinguishable from the reader lessons.
7. Repeat essential controls with reduced motion enabled before opening and changed while open.
   Record actual announcements, interruptions, missing labels, focus losses and recovery steps.

## H2 · Real zoom and text legibility — accessibility reviewer + classroom reviewer, coordinated by 6B QA

Record physical display size/resolution, OS scale, browser version and actual browser UI zoom. Start at
100%, then set the browser's own zoom control to 200%; record its displayed value and effective viewport.
A viewport resize or device-scale-factor override does not complete this check.

For each lesson, test school/university, answer open, sources/deeper panel, figure controls, Contents and
page turn. Read every passage and reach every control without two-dimensional text scrolling, clipping or
focus loss. Vertical reflow is allowed; equations may scroll horizontally when keyboard reachable. Test a
390 px phone and 320 CSS px reflow separately. Inspect the current run and ghost keys at ordinary reading
size, not only magnified captures. Record any need to lean in, zoom further or leave the intended flow.

## H3 · Colour, captions and projector — classroom reviewer + accessibility reviewer, coordinated by 6B QA

Record projector/display model, native resolution, browser zoom, screen size, room lighting and viewing
distance. Read both invitations, scales, limitation labels, front-face profiles and ghost keys from the
intended back-row distance. Compare default and More contrast. Inspect the ordinary desktop, phone and
reduced-motion views. Ask a reviewer using non-colour cues to identify the selected and kept rock or
boundary; record which name, glyph, dash or pattern supplied the distinction.

The axe report lists unresolved `color-contrast` nodes under `incomplete` (overlapping drawing/SVG and
pseudo-element backgrounds). Review the exact nodes in [axe-results.json](axe-results.json) against their
rendered backgrounds. Record measured foreground/background contrast where measurable and observations
separately. An incomplete rule is neither a pass nor a confirmed contrast failure.

## Result record (copy per actual session)

- Check ID and status: pending until performed.
- Tester / accountable coordinator / date:
- Commit, route and exact setup:
- Steps actually completed (and not completed):
- What was heard or seen (verbatim observations where useful):
- Defects, severity, reproduction and workaround:
- Evidence link / permission to retain recording:
- Retest result and commit:
- Reviewer decision and remaining scope:

## Other release checks handed to 6C

| ID  | Pending work                                                                                       | Accountable role                       | Evidence required                                                                                          |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| H4  | First-time discovery, ghost interpretation, willingness to continue                                | Product researcher + 6C lead           | Observed fresh-reader journey; assistance recorded; no learning-gain inference                             |
| H5  | F2: landforms recognisable at ordinary laptop size                                                 | Product owner + 6C lead                | Explicit judgement at 1366 × 768 and 1440 × 900; approved 7G labels/tip/F1 stay approved                   |
| H6  | Glacier scientific claims and limitations                                                          | Glaciologist/geomorphologist + 6C lead | Decisions on [existing expert questions](../../glacial/acceptance/expert-review.md), exact reviewed commit |
| H7  | Plate scientific claims and authored-relief disclosure                                             | Geologist/geophysicist + 6C lead       | Decisions on [existing expert questions](../../plates/acceptance/expert-review.md), exact reviewed commit  |
| H8  | Other GPUs/browsers/mobile/classroom machines; CPU page-turn performance and two-lesson cold loads | Performance QA + project lead          | Actual configurations, raw measurements, observed usability and explicit scope                             |

The retained research comparison also awaits a geomorphology/hydrology reviewer, coordinated by the
6C SCI lead. Review only the supported gross-erosion claim, preserving failed morphology and the
unvalidated waterfall. The 6C review packet records this separately from the two shipped lessons.

The existing single-adapter performance evidence remains valid for its recorded setup. Historical narrow
latency misses and perceived startup/update cadence are still for performance QA and the product reviewer;
headless automation does not resolve them. See [6A/6A2](../../../perf/README.md) and
[7F's scoped two-lesson measurements](../../../perf/plates/README.md).
