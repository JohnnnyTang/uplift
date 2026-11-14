/* global window, document, performance, PerformanceObserver, MutationObserver, MessageChannel, requestAnimationFrame */
/**
 * Session 6A page instrumentation. Injected with Playwright `addInitScript` before any app code runs; it only
 * observes. It keeps, in `window.__perf`:
 *
 * - `frames`: the timestamp of every animation frame (one rAF loop for the whole session);
 * - `loaf`: Long Animation Frame entries (frames whose work took more than 50 ms), with the top scripts;
 * - `events`: Event Timing entries of 16 ms or longer (input delay, processing, next paint);
 * - `inputs`: every trusted pointerdown / pointerup / keydown / click, with its event timestamp;
 * - `marks`: every change of the app's own state attributes (`data-*` on `.gs-desk` and the research `.book`),
 *   the time the change was observed, and the time the frame after it was produced (`painted`).
 *
 * "Visible response" in the README is `mark.painted - input.t`: from the reader's input event to the end of the
 * first frame produced after the app put the new state in the DOM (the stage renders in that same frame). All
 * times are `performance.now()` milliseconds since navigation start.
 *
 * Cost of observing: one rAF callback per frame (a timestamp push) and one microtask per watched attribute
 * change. The rAF loop keeps Chrome producing frames on every vsync, which an idle page would not do; this is
 * why idle CPU figures are not reported as a reader's idle cost.
 */
(() => {
  const ATTRS = [
    "data-transition",
    "data-source",
    "data-ready",
    "data-live-rock",
    "data-run-id",
    "data-model-years",
    "data-ghost",
    "data-view",
    "data-playing",
    "data-run-status",
    "data-cut-column",
    "data-backend-ready",
    "data-step",
    "data-view-step",
  ];
  const perf = {
    frames: [],
    loaf: [],
    events: [],
    inputs: [],
    marks: [],
    paints: {},
    lcp: [],
    drawingAt: null,
  };
  window.__perf = perf;

  const afterPaint = (record) => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        record.painted = performance.now();
      };
      channel.port2.postMessage(0);
    });
  };

  const tick = (t) => {
    perf.frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  for (const type of ["pointerdown", "pointerup", "keydown", "click"])
    window.addEventListener(
      type,
      (e) => {
        if (e.isTrusted) perf.inputs.push({ type, t: e.timeStamp, key: e.key ?? null });
      },
      { capture: true },
    );

  const observe = (type, fn, extra = {}) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({
        type,
        buffered: true,
        ...extra,
      });
    } catch {
      /* unsupported entry type: recorded as absent */
    }
  };
  observe("long-animation-frame", (e) =>
    perf.loaf.push({
      start: e.startTime,
      duration: e.duration,
      blocking: e.blockingDuration,
      render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
      scripts: [...e.scripts]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map((s) => ({
          invoker: s.invoker,
          duration: Math.round(s.duration),
          source: (s.sourceURL || "").replace(/^.*\/assets\//, ""),
          fn: s.sourceFunctionName,
        })),
    }),
  );
  observe(
    "event",
    (e) =>
      perf.events.push({
        name: e.name,
        start: e.startTime,
        duration: e.duration,
        delay: e.processingStart - e.startTime,
        processing: e.processingEnd - e.processingStart,
        interactionId: e.interactionId,
      }),
    { durationThreshold: 16 },
  );
  observe("paint", (e) => {
    perf.paints[e.name] = e.startTime;
  });
  observe("largest-contentful-paint", (e) =>
    perf.lcp.push({ t: e.startTime, size: e.size, el: e.element?.className ?? e.element?.tagName ?? null }),
  );

  const start = () => {
    new MutationObserver((records) => {
      const t = performance.now();
      for (const r of records) {
        if (r.type === "attributes") {
          const value = r.target.getAttribute(r.attributeName);
          if (value === r.oldValue) continue;
          const mark = { t, attr: r.attributeName, value, el: r.target.className };
          perf.marks.push(mark);
          afterPaint(mark);
        } else if (perf.drawingAt === null && document.querySelector(".gs-drawing svg")) {
          const mark = { t };
          perf.drawingAt = mark;
          afterPaint(mark);
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ATTRS,
      childList: true,
    });
  };
  start();

  const pct = (sorted, p) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null;
  const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);

  /** Frame, long-frame and attribute statistics between two `performance.now()` times. */
  perf.window = (t0, t1, attr = "data-model-years") => {
    const frames = perf.frames.filter((t) => t >= t0 && t <= t1);
    const intervals = [];
    for (let i = 1; i < frames.length; i++) intervals.push(frames[i] - frames[i - 1]);
    const sorted = [...intervals].sort((a, b) => a - b);
    const loaf = perf.loaf.filter((l) => l.start >= t0 && l.start <= t1);
    const updates = perf.marks.filter((m) => m.attr === attr && m.t >= t0 && m.t <= t1);
    const span = (t1 - t0) / 1000;
    return {
      origin: performance.timeOrigin,
      t0: Math.round(t0),
      t1: Math.round(t1),
      spanS: r1(span),
      fps: frames.length > 1 ? r1((frames.length - 1) / ((frames.at(-1) - frames[0]) / 1000)) : null,
      frameMs: {
        p50: r1(pct(sorted, 50)),
        p95: r1(pct(sorted, 95)),
        p99: r1(pct(sorted, 99)),
        max: r1(sorted.at(-1)),
      },
      over33: intervals.filter((x) => x > 1000 / 30).length,
      over50: intervals.filter((x) => x > 50).length,
      over100: intervals.filter((x) => x > 100).length,
      frames: intervals.length,
      loafCount: loaf.length,
      loafMaxMs: r1(Math.max(0, ...loaf.map((l) => l.duration))),
      loafBlockingMs: r1(loaf.reduce((s, l) => s + l.blocking, 0)),
      loafTop: loaf
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map((l) => ({ duration: r1(l.duration), render: r1(l.render), scripts: l.scripts })),
      updates: updates.length,
      updatesPerS: r1(updates.length / span),
    };
  };

  /** Finds the first watched-attribute change since `since` that satisfies `test`, once its frame is produced. */
  perf.findMark = (since, attr, test) => {
    for (let i = since; i < perf.marks.length; i++) {
      const m = perf.marks[i];
      if (m.attr !== attr) continue;
      const ok =
        test.kind === "any" ||
        (test.kind === "eq" && m.value === test.value) ||
        (test.kind === "ne" && m.value !== test.value) ||
        (test.kind === "gt" && Number(m.value) > test.value);
      if (ok) return m.painted === undefined ? "pending" : { index: i, ...m };
    }
    return null;
  };
  perf.inputSince = (since, types) => perf.inputs.slice(since).find((e) => types.includes(e.type)) ?? null;
})();
