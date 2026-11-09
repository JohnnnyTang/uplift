/** Measurements supplied by the active host, never a separately configured model. */
export interface DebugSample {
  readonly gridSize: number | undefined;
  readonly seed: number | undefined;
  readonly backend: string;
  readonly renderer: string;
  readonly batchSteps: number;
  readonly batchMs: number;
}

/** Opt-in readout. Page rAF cadence is not a target-hardware rendering benchmark. */
export function createDebugOverlay(parent: HTMLElement, sample: () => DebugSample) {
  const root = document.createElement("aside");
  root.className = "runtime-debug";
  root.setAttribute("aria-label", "Runtime diagnostics");
  root.style.cssText =
    "position:fixed;bottom:0.5rem;right:0.5rem;z-index:10;padding:0.5rem;border:1px solid currentColor;background:#f4efdf;color:#28251f;font:12px monospace;pointer-events:none;max-width:calc(100vw - 2rem)";
  // No live region: changing diagnostics must not interrupt the lesson.
  const output = document.createElement("p");
  output.style.margin = "0";
  root.append(output);
  parent.append(root);
  let started: number | undefined,
    frames = 0,
    disposed = false;
  return {
    root,
    frame(now: number) {
      if (disposed) return;
      if (started === undefined) started = now;
      frames++;
      const elapsed = now - started;
      if (elapsed < 1000) return;
      const s = sample();
      const fps = (1000 * (frames - 1)) / elapsed;
      const msPerStep = s.batchSteps > 0 ? s.batchMs / s.batchSteps : undefined;
      output.textContent = `Page fps ${fps.toFixed(1)} · ms/step ${msPerStep?.toFixed(3) ?? "pending"} · grid ${s.gridSize ?? "pending"} · backend ${s.backend} · renderer ${s.renderer} · seed ${s.seed ?? "pending"}`;
      root.dataset.fps = String(fps);
      root.dataset.msPerStep = msPerStep === undefined ? "pending" : String(msPerStep);
      root.dataset.grid = String(s.gridSize ?? "pending");
      root.dataset.backend = s.backend;
      root.dataset.seed = String(s.seed ?? "pending");
      started = now;
      frames = 1;
    },
    dispose() {
      disposed = true;
      root.remove();
    },
  };
}
