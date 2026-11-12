# Book shell — session 5C

The shell mechanics are implemented against the frozen 5A controller fixtures.
These images and the recording show an illustrative ink specimen, not a terrain
simulation, scientific validation, or acceptance of the integrated book. The real
scenes and default route are integrated by 5E and reviewed by 5F.

## Evidence

- [Desktop, 1366 × 768](desktop.png): the complete shell, labelled fixture banner,
  scene and navigation fit the viewport without shrinking the type. The test
  asserts document height does not exceed the viewport height.
- [Expanded explanation, 1440 × 900](desktop-explanation.png).
- [Tablet, 900 × 1100](tablet.png).
- [Phone explanation, 390 × 844](phone.png) and
  [phone illustration and controls](phone-illustration.png).
- [Narrow reflow, 320 CSS pixels](reflow.png).
- [200% equivalent layout](zoom-200-equivalent.png): 683 × 384 CSS viewport at
  device scale factor two, equivalent layout space to a 1366 × 768 display at
  200% browser zoom. This is a layout emulation, not a browser chrome zoom test.
- [Paging recording](paging-fixture.webm): reveal, manipulate, turn and return;
  the outgoing specimen stays attached to the paper through the settled turn.

Visual inspection confirmed readable type, quiet controls, a dominant drawing,
usable phone controls and an explanation that remains inside the ordinary spread.
The actual scenes may have different intrinsic control heights; 5E must repeat
this inspection with their final copy, model scope and keyboard controls.

## Integration API

`createReaderShell(host, entries, options)` is exported from `book-shell.ts` and
`reader/shell.ts`. It returns a promise for `MountedReaderShell`, an additive
extension of the frozen `ReaderShellController`. It preserves existing `mountBook`
widget-fixture mounting. Reader styles are scoped under `.reader-shell`, so legacy
research remains unchanged. The host supplies the neutral desk and outer padding;
`reader/shell.css` supplies the paper, ink, bounded spread and responsive reflow.

Pass the two actual `ReaderEntry` values. Their factories retain the real scene
controllers; the shell never reconstructs a model from a visible sample. A factory
may be called before first entry to obtain presentation bindings, so initialization
must not start hidden stepping. Only a visible illustration is mounted/resumed.

Options:

- `initialLevel`: defaults to high school.
- `teacherNotes`: a map from spread id to the loaded teacher-note text. Supply the
  actual imported note content; without it the shell links to `spread.teacherNotes`.
  Notes preserve line breaks as accessible text, matching the legacy reading view.
- `onResearch`: the shell settles/detaches before calling this callback and hides
  itself. The app owns the research route and its mounting. Call `resume()` on
  return; use `suspend()` for other app-owned route departures.
- `history: false`: disables URL writes for an embedded reader. Normally the shell
  owns `spread` and `page` query parameters, preserving `backend`, `debug` and other
  app-owned parameters. `popstate` restores an absolute destination without adding
  another history entry. The app still owns `view=research`.

The shell retains at most two controllers, serializes settlement, presentation
attachment and turns, and coalesces to the newest absolute destination. Relative
requests are calculated from the displayed page. Active object gestures defer
absolute history navigation and reject relative shortcuts until release. Wheel
and swipe are intentionally omitted to preserve scrolling and zoom.

The narrow sequence is text → illustration → next lesson's text. Resizing remaps
the current page while retaining controllers. A text page, a full reading surface
or an app-owned research view settles and detaches the hidden illustration.
Reduced motion replaces pages after settlement without the physical fold.

## Validation

- `pnpm check`: typecheck, lint, format and 56 files / 495 unit tests pass.
- `pnpm build`: passes, with the existing large Three.js chunk advisory.
- `pnpm exec tsc -p e2e/tsconfig.json`: passes.
- Nine browser tests cover settlement ordering and attached page animation;
  retained model/presentation and focus; repeated-request coalescing; field/gesture
  arbitration and history; phone attachment and resize; reduced motion and
  suspension/disposal; rejected/delayed mounts; reading-surface departure; large
  reading scale; visible unanswered/reset state without moving reset focus.

Run the committed spec through the standard repository Playwright configuration:
`pnpm exec playwright test e2e/book-shell.spec.ts`. The fixture defaults to port 4174. `BOOK_SHELL_FIXTURE_ORIGIN` can override only the fixture origin for concurrent
sessions. This session used an uncommitted config on port 4374, installed Chrome,
and the matching Playwright FFmpeg revision for video capture; no harness,
package, lockfile or browser dependency change is committed.

## PR-ready handover

Stage / wave / session: S1 / W5 / 5C book shell.

Done: bounded composition, attached physical page turns after quiescence, retained
controllers, independent answer reveal and optional question, navigation/history,
focus restoration, phone pages, depth reading surface, reset synchronization,
reduced motion, interruption handling, fixture tests and evidence.

Not done: default app migration, actual scene integration, scientific acceptance,
human discoverability study, target-hardware performance and browser chrome zoom
inspection. Those remain with 5E/5F and the release reviewers.

Surprise: intrinsic fixture SVG height initially expanded the paper despite the
correct spread budget. The specimen now fits its attached scene container. The
same intrinsic-size check must be repeated with the actual scene controls.

Approved lead decisions: keep the restrained ink/Georgia composition; use a native
page fold rather than adding an animation library; expose additive suspend/resume
for retained research navigation; settle the illustration for full depth reading;
place the secondary research entry in the existing header and compact navigation
spacing so the complete book fits at 768 pixels. The lead records these in the
shared decision log. No frozen contract revision was needed.

- [x] Stayed within session-owned paths.
- [x] `pnpm check` passes.
- [x] No solver or scientific model changed; no scripted landform was introduced.
- [x] Page quantities render and subscribe through controller bindings.
- [x] CPU/GPU comparison is unchanged because solvers are unchanged.
- [x] No new scientific claims; fixture is explicitly labelled.
- [x] Decisions coordinated with lead for the shared `DECISIONS.md` entry.
