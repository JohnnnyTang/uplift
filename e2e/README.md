# Session 4E: browser regressions and diagnostics

Run `pnpm install`, `pnpm exec playwright install chromium`, then `pnpm test:e2e`.
The suite builds the book and starts a strict production preview on port 4173.
A second Vite server on port 4174 serves only the explicitly unscored fixture;
it imports the real book rather than replacing its Worker or model with a fake.
Both servers are owned and stopped by Playwright. Ports must be free.

Chromium uses its software WebGL2 adapter for reproducible rendering in CI. This
is a CPU-worker smoke suite, not evidence of WebGPU performance or target hardware
frame rate. The production lift test inspects screenshot pixel variation, retains
its rendered canvas in the HTML report, and checks for browser page errors.

The replay tests check every sample and seed against the exact public recorded
artifact at desktop and mobile widths. Both traces and bar widths must use the
same axes across arms, steps and seeds. They cover keyboard timeline controls,
endpoint-only feedback, correct and incorrect committed answers, replay, pause,
reset, reduced motion and live/recorded state preservation across reading levels.
The fixture keeps null-answer predictions unscored, years suppressed and the
pending challenge unstamped through commit, endpoint, reset and level changes.

`pnpm check:bundle` fails at **10,000,000 bytes or more**, counting every generated
file recursively and uncompressed (including assets, Worker and lazy chunks).
It fails if no build exists. The boundary and recursive accounting are tested.
CI builds before checking the budget and runs Chromium with its OS dependencies;
HTML reports, failure screenshots, traces and videos are uploaded on every run.

Append `?debug` to show the runtime overlay. Page fps means the page's request-
animation-frame cadence, not completed GPU draw throughput. ms/step is the latest
Worker compute batch divided by its actual step count, excluding transport and
snapshot cost; it stays pending until a batch exists. Grid and seed come from the
current atomic host sample. Solver backend and renderer are labelled separately.
When backend selection lands in 4A, wire the chosen solver identifier into this
existing overlay and adjust the CPU128-specific smoke assertion.

Human screen-reader listening, classroom legibility, scientific sign-off and
hardware performance remain separate Stage 1 gates. An automated pass does not
close them. No remote CI run is claimed before this branch is published.
