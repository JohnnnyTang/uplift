# 1B: GPU compute path and fallback

Session: S1 / W1 / 1B. Evidence recorded 2026-11-07. This is an engineering
benchmark, not a scientific model or a Demo 1 performance acceptance result.

## Run it

From the repository root:

```sh
pnpm install
pnpm --filter @uplift/spike-gpu-compute dev
```

Open the localhost URL in Chrome and activate **Run benchmark**. Download JSON
before closing the tab. Both buttons are keyboard operable; progress is announced
by a status region, and results are available as text. There is no animation.
The canvas is a water-blue WebGL2 preview of the Worker snapshot; colour intensity
represents the fixture's water lane, without physical units.

For an automated local run with installed Chrome, in a fresh browser profile:

```sh
pnpm --filter @uplift/spike-gpu-compute test
pnpm --filter @uplift/spike-gpu-compute measure
pnpm --filter @uplift/spike-gpu-compute build
pnpm check
```

`measure` starts and closes its own Vite server on port 5178 and headless Chrome.
No WebGPU override flags are used. It overwrites
`spikes/gpu-compute/results-local.json`; keep that file with any reported table.
GPU agreement, repeatability or fixed-tree reduction failures make it exit with an
error. WebGL2 compute rejection is a capability finding, recorded separately.
The spike's Node tests run separately from the root Vitest suite.

## Method and scope

Pinned three **0.187.0**, Playwright **1.58.2** and the workspace's Vite version.
CPU: Intel Core Ultra 7 258V. GPU: integrated Intel Arc 140V, adapter vendor
`intel`, architecture `xe-2lpg`, `isFallbackAdapter: false`. Chrome reports
`HeadlessChrome/156.0.0.0` on Windows. The exported JSON includes the exact UTC
timestamp, browser, settings and adapter fields. Driver version is not captured.

Each fixed step dispatches five ordered kernels over a seeded, nonuniform field:
input addition, neighbor stencil and directional differences, velocity-like
normalisation, conservative scalar smoothing, and attenuation. These are workload
analogues, with arbitrary dimensionless coefficients. They do **not** implement
virtual pipes, erosion, deposition, slumping or the approved science model.

Two ping-pong storage buffers each contain one `vec4<f32>` per cell (four lanes).
A step swaps buffers five times; alternate step parities have distinct dispatch
lists. Neighbor indices clamp to the edge. A fixed integer generator seeds the
field; no random browser inputs or elapsed time enter the update. Workgroup size
is 64. Three fresh runs each warm up for 10 steps, then time 80 steps. Reported
values are the median milliseconds per step. Timing includes JavaScript dispatch,
queue submission and GPU completion (`onSubmittedWorkDone`); it is **not** pure
GPU timestamp-query time. Compilation warm-up and readbacks are outside that window.

The TSL variant builds arithmetic nodes. The WGSL variant embeds explicit WGSL
arithmetic functions using `wgslFn`, with the **same TSL neighbor gathers and
WebGPURenderer-managed storage/dispatch**. This tests WGSL through the renderer,
not an independent raw-device command encoder. No claim about raw-device speed
or device-sharing overhead follows from these numbers.

## Results

Raw evidence: [results-local.json](../../spikes/gpu-compute/results-local.json).
Readback medians use seven reads after the queue is idle; this includes allocation,
copy, mapping and synchronization. The full read is all four fixture lanes, **not**
all layers of the future terrain contract. The probe is 64 contiguous cells from
the beginning of the buffer (1 KiB), not a strided rectangle or a long profile.

| Path                | Grid | ms / five-kernel step |      Full readback ms | Probe readback ms | CPU max absolute difference | Bitwise repeat     |
| ------------------- | ---- | --------------------: | --------------------: | ----------------: | --------------------------: | ------------------ |
| TSL / WebGPU        | 256² |                 0.140 |          3.30 (1 MiB) |              3.10 |                     1.42e-7 | yes                |
| WGSL / WebGPU       | 256² |                 0.114 |          3.00 (1 MiB) |              3.40 |                     1.42e-7 | yes                |
| TSL / WebGPU        | 512² |                 0.340 |          4.80 (4 MiB) |              3.20 |                     1.42e-7 | yes                |
| WGSL / WebGPU       | 512² |                 0.310 |          4.60 (4 MiB) |              3.10 |                     1.42e-7 | yes                |
| TSL / forced WebGL2 | 128² |                 0.105 |          not accepted |      not accepted |          **0.00511: fails** | not accepted       |
| CPU Worker          | 128² |                 0.504 | transferable snapshot |               n/a |                   reference | Node replay passes |

Worker throughput is approximately **1,985 steps/s** for this fixture, excluding
snapshot transfer. One 128² RGBA32F snapshot uploads and draws through WebGL2 in
**0.30 ms**, measured with `gl.finish()`. This is a simple full-screen texture
preview, not the ink renderer or a frame-rate benchmark. Worker request-to-response
was 171.9 ms including startup, all warm-up/timed loops and one snapshot transfer;
it must not be interpreted as transfer latency. Continuous transfer/render cadence
and the complete CPU reference solver still need measurement in 2A/3A/5A.

The WebGL2 backend **does implement compute emulation**, including transform
feedback and PBO-based neighbor access. It is incorrect to say that three exposes
no compute at all there. However, this exact five-stage neighbor-reading workload
fails agreement after 80 steps. Its apparent speed is not usable evidence for a
solver. The cause has not been isolated; this is not a claim that every WebGL2
compute program fails. Keep the CPU Worker fallback.

## Choice and ergonomics

Use **explicit WGSL arithmetic via `wgslFn` and WebGPURenderer-managed dispatch**
for 3C, retaining the TSL wrapper for buffers, indices and scheduling. WGSL reads
like the CPU stencil and makes evaluation order easier to audit. TSL avoids shader
strings and can target GLSL, but nested arithmetic chains were harder to compare
with CPU equations. Both are viable on WebGPU. The WGSL samples are modestly
faster here, but order, clock resolution and device load are not controlled enough
to infer a general speed advantage. Correctness and auditability decide the choice.

Do not introduce a second GPUDevice yet. If the real solver needs raw-device
control (binding limits, reductions, or profiling), benchmark that separately and
share the device explicitly with the renderer. The r187 backend accepts a provided
device; public buffer interop and lifetime handling still need validation before
that escape hatch is adopted.

## Readback strategy

Start with **2 Hz** asynchronous probe updates; permit **4 Hz** only after measuring
the full solver and renderer together. Idle probe reads already cost around
3 ms, even for 1 KiB. Keep state resident for drawing, pack/reduce probe values on
the GPU, and allow at most one readback in flight. Skip a probe sample when busy;
do not queue old samples or block the animation loop. Read full snapshots for
explicit diagnostics, reset/replay verification and comparison tests, not per frame.
The 2–4 Hz recommendation is provisional; this fixture does not measure overlapped
readback, all contract layers or reduction-plus-readback cost.

## Determinism and budgets

Every WebGPU variant passes absolute CPU tolerance **1e-5** after 80 steps (observed
maximum 1.42e-7), and two fresh initializations produce bitwise-identical results on
this device. This is a same-process/device/driver observation, not a cross-driver
guarantee. CPU arithmetic uses JavaScript intermediates and f32 storage; comparison
is tolerant rather than bitwise across CPU/GPU.

A separate GPU binary-tree reduction sums the four lanes: pair adjacent indices,
store each pair once, then halve the count until one cell remains. Pass boundaries
synchronize each level, every output has one writer, and there are no float atomics.
Two GPU reductions match bitwise and match an explicitly f32-rounded CPU tree
bitwise at both sizes. This establishes ordering, not float64 accuracy: production
budget counters require error analysis and the mass-budget test. The experiment
uploads the snapshot for reduction, so it does not measure resident budget overhead.
Non-power-of-two domains need deterministic zero padding; this spike uses powers
of two. Leave CPU budget accumulation in float64 as specified by 1A.

## Fallback tiers and corrections for later sessions

- **3C:** use WGSL via the managed dispatch wrapper. Port 1E's equations, not these
  fixture kernels. Include CPU/GPU field comparisons in real Chrome with explicit
  absolute/relative tolerances, fixed inputs and device/driver metadata. Preserve
  pass boundaries and single-writer rules. Add actual solver profiling.
- **4A:** WebGPU starts at 256²; 512² is an experiment, not a default promise. Use
  fixed-tree budgets and prove mass closure and same-device replay. Use a CPU Worker
  at 128² plus WebGL2 rendering when WebGPU is unavailable. Degrade to 64² if the real
  solver misses its frame budget, then flat drawing only if rendering is unavailable.
  Do not substitute WebGL2 compute without a passing neighbor-stencil comparison.
- **3A:** start probes at 2 Hz, one readback in flight, stale samples dropped. Measure
  Worker snapshot transfer independently before choosing the fallback render cadence.
- **5A:** repeat on the target classroom hardware in visible Chrome stable, recording
  driver, thermal/power conditions, complete rendering, steps/frame and frame times.
  This headless fixture does not close AC1.

These are proposed brief corrections for the lead; the shared stage plan is not
edited by this parallel session. Other sessions' owned paths are untouched.

## Implementation references

- [r187 WebGPU renderer](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js):
  ordered compute dispatch and partial `getArrayBufferAsync` reads.
- [r187 WGSL function node](https://github.com/mrdoob/three.js/blob/r187/src/nodes/code/FunctionNode.js):
  shader functions through `wgslFn`.
- [r187 WebGL backend](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl-fallback/WebGLBackend.js)
  and [GLSL node builder](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl-fallback/nodes/GLSLNodeBuilder.js):
  compute emulation and PBO access; inspected in the installed pinned package.
- [r187 WebGPU backend](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js):
  external device option.

## Handover

Done: runnable page, CPU Worker/WebGL2 preview, TSL/WGSL comparisons, readback
measurements, replay checks, fixed-tree budget-order prototype, evidence and decision.
Not done: full terrain solver, visible-browser classroom acceptance, raw-device
interop benchmark, independent transfer timing, cross-driver tests or physical
mass-budget validation. Surprise: three's WebGL2 backend can emulate compute, but
this neighbor pipeline fails agreement. Plan impact: retain CPU fallback, specify
WGSL through managed dispatch, and budget probe synchronization separately.
