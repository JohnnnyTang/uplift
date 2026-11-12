# R2 camera and reading-panel handover

The reader can lower and turn the entire book and attached diorama about a point above
the spine, using the View angle sliders or drag pad. Arrow keys operate the pad; Home
and Reset view restore the initial pose. Tilt is bounded to 20–68 degrees (nominal sight
height 70–22 degrees), turn to ±24 degrees. These are presentation settings only.
The raised pivot, paper, binding and model share the projection; automatic fitting reserves
space around the book. On phones and under reduced motion, paper stays flat and the figure
uses the same bounded view controls without easing or inertia.

Click lesson text or its Read button to open an upright copy. Original content remains on
paper. Live notes and the question disclosure synchronize. Outside pointer actions dismiss;
Escape and Back to the book dismiss and restore trigger focus. IDs in the copy are unique.

Validation: `pnpm check` and `pnpm build`; headed Chromium/WebGL2 checks at 1440 × 1000,
390 × 844, and emulated reduced motion. Browser checks covered rotation bounds, drag,
keyboard reset, unchanged model notes after camera changes, simultaneous text, unique IDs,
click-away, Escape, synchronized disclosure and live notes during recorded playback.
Projection unit tests cover combined tilt/turn limits and a scaled scene with a fixed pivot.
Screenshots and browser check scripts are in the worktree's `output/playwright/` directory.

Done: requested stage controls and simultaneous reading content on the glacial review route.
Not done: later 5J–5N integration, new scientific claims, human classroom/accessibility sign-off.
Surprise: moving the DOM caused the original blank page; cloning a disclosure also required
preserving keyboard focus when its synchronized state refreshed.
Plan implication: carry the stage view API and simultaneous reading-copy behavior into 5K/5M.
Relevant acceptance rows:

- GV4: “Drawing → ink → colour transition into a complete, naturally coloured diorama standing on a tilted book page.” This change preserves the attached scene while changing its view.
- GV5: “Margin notes, caption, front face, ghost and explanation all refer to the same run, time and config.” The reading copy mirrors the existing bound notes.
- GV6: “Keyboard equivalents for every gesture, text alternatives, reduced motion, lithology patterns as non-colour cue, reflow.” The new gesture has keyboard controls and retains flat fallbacks.

Evidence is scoped to the changed mechanics and does not close these entire rows.

Owned paths: shared Ink stage, glacial review scene and stage review notes; DECISIONS.md is
append-only shared session bookkeeping. Based on R1 commit 7f78dd4, branch s1/w5/r2-camera.

## Follow-up: zoom, gestures and resize (2026-11-12)

The toolbar now has View height, Turn, Zoom and Reset view, in normal flow with
responsive columns. Zoom is clamped to 1–1.5; 1 restores the default fitted size.
Drag directly on the scene or desk with the primary mouse button to turn it;
wheel over that surface to zoom. In flat mode wheel capture is restricted to the
illustration, so the surrounding page scrolls. Ctrl/Meta wheel is left to the browser.
Native range inputs provide keyboard access. Reset restores all three view settings.

The stage observes book size as well as host/anchor size, and listens for browser
and visual viewport resizing. The canvas backing size and projection are recalculated.
The toolbar reserves its measured height, fixed figure height is removed, and paper
height accommodates lesson content before the book is fitted. No model state changes.

Browser evidence: direct mouse drag, both wheel clamps, keyboard zoom/reset,
unchanged notes, unique simultaneous reading content, repeated widths 390/800/1100/
1440/1920, canvas buffer resizing, contained toolbar controls and no horizontal
page overflow. Check scripts and screenshots: `output/playwright/zoom-*.cjs.txt`,
`resized-*.png` and `zoom-final.png`. Reduced-motion/flat mode and browser-wheel
pass-through checked separately. Full project checks and production build rerun.

GV4/GV5/GV6 scope remains as above; no human/expert acceptance is inferred.
