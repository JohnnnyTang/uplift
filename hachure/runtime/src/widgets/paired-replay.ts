import { el, button } from "./controls";
import { formatBoundNumber } from "../bindings/index";

/** A measured series, never a generator or interpolator of terrain states. */
export interface PairedReplayData {
  readonly playbackSeconds: number;
  readonly dtSimSeconds: number;
  readonly maxValue: number;
  readonly pairs: readonly {
    readonly seed: number;
    readonly inputs: readonly number[];
    readonly samples: readonly { readonly step: number; readonly values: readonly number[] }[];
  }[];
}
export interface PairedReplayOptions {
  readonly id: string;
  readonly data: PairedReplayData;
  readonly title: string;
  readonly labels: readonly [string, string];
  readonly inputUnit: string;
  readonly valueUnit: string;
  readonly description: string;
  readonly onEndpoint: (atEndpoint: boolean) => void;
}

/** Shared zero/scale for both arms, all frames and every seed. */
export function createPairedReplay(options: PairedReplayOptions) {
  const { data, labels, id } = options;
  if (!(data.maxValue > 0) || !(data.playbackSeconds > 0) || data.pairs.length === 0)
    throw new RangeError("A comparison needs a positive scale, duration and recorded pairs");
  const root = el("section", undefined, "paired-replay");
  root.setAttribute("aria-labelledby", id + "-title");
  const title = el("h2", options.title);
  title.id = id + "-title";
  const description = el("p", options.description, "supporting-text");
  const seedLabel = el("label", "Recorded landscape");
  const seed = el("select");
  seed.id = id + "-seed";
  seedLabel.htmlFor = seed.id;
  for (const [i, pair] of data.pairs.entries()) {
    const option = el("option", "Seed " + pair.seed);
    option.value = String(i);
    seed.append(option);
  }
  const seedRow = el("div", undefined, "comparison-seed");
  seedRow.append(seedLabel, seed);
  const bars = labels.map((label, i) => {
    const row = el("div", undefined, "comparison-row");
    const heading = el("div", undefined, "comparison-label");
    const name = el("span", label),
      value = el("span");
    heading.append(name, value);
    const track = el("div", undefined, "comparison-track");
    const bar = el("div", undefined, "comparison-bar");
    bar.dataset.arm = String(i);
    track.setAttribute("aria-hidden", "true");
    track.append(bar);
    row.append(heading, track);
    return { row, name, value, bar };
  });
  const scale = el(
    "p",
    `Shared scale: ${formatBoundNumber(0, options.valueUnit)} to ${formatBoundNumber(data.maxValue, options.valueUnit)}. Ochre measures material; outlined is ${labels[0].toLowerCase()}, striped is ${labels[1].toLowerCase()}.`,
    "supporting-text",
  );
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 480 145");
  svg.classList.add("comparison-trace");
  svg.setAttribute("aria-hidden", "true");
  const lines = labels.map((_, i) => {
    const line = document.createElementNS(svg.namespaceURI, "polyline");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2");
    if (i === 0) line.setAttribute("stroke-dasharray", "6 4");
    svg.append(line);
    return line;
  });
  const axes = document.createElementNS(svg.namespaceURI, "path");
  axes.setAttribute("d", "M 4 4 V 140 H 476");
  axes.setAttribute("fill", "none");
  axes.setAttribute("stroke", "currentColor");
  svg.prepend(axes);
  const traceCaption = el(
    "p",
    `Over model time: dashed is ${labels[0].toLowerCase()}; solid is ${labels[1].toLowerCase()}. Both traces share the bar scale.`,
    "supporting-text",
  );
  const timelineLabel = el("label", "Recorded model step");
  const timeline = el("input");
  timeline.type = "range";
  timeline.id = id + "-timeline";
  timeline.min = "0";
  timeline.step = "1";
  timelineLabel.htmlFor = timeline.id;
  const clock = el("output");
  clock.setAttribute("aria-live", "off");
  clock.htmlFor = timeline.id;
  const status = el("p", "Commit your prediction to compare the recorded runs.", "comparison-description");
  status.setAttribute("role", "status");
  status.setAttribute("aria-atomic", "true");
  let pairIndex = 0,
    index = 0,
    unlocked = false,
    playing = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = 0,
    from = 0,
    lastAnnounced = -Infinity;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const play = button("Play comparison", () => (playing ? pause() : start()));
  const end = button("Show result", () => {
    pause();
    index = pair().samples.length - 1;
    render(true);
  });
  const actions = el("div", undefined, "comparison-actions");
  actions.append(play, end);
  root.append(
    title,
    description,
    seedRow,
    ...bars.map((b) => b.row),
    scale,
    svg,
    traceCaption,
    timelineLabel,
    timeline,
    clock,
    actions,
    status,
  );
  const pair = () => data.pairs[pairIndex]!;
  function render(announce = false) {
    const p = pair(),
      sample = p.samples[index]!,
      last = p.samples.at(-1)!;
    timeline.max = String(p.samples.length - 1);
    timeline.value = String(index);
    timeline.setAttribute(
      "aria-valuetext",
      `Model step ${sample.step}; ${formatBoundNumber(sample.step * data.dtSimSeconds, "hydraulic s")}`,
    );
    clock.textContent = `Step ${sample.step} of ${last.step} · ${formatBoundNumber(sample.step * data.dtSimSeconds, "hydraulic s")} · not geological time`;
    for (const [i, bar] of bars.entries()) {
      bar.name.textContent = `${labels[i]} · ${formatBoundNumber(p.inputs[i]!, options.inputUnit)}`;
      bar.value.textContent = formatBoundNumber(sample.values[i]!, options.valueUnit);
      bar.bar.style.width = `${(100 * sample.values[i]!) / data.maxValue}%`;
      bar.bar.style.visibility = sample.values[i] === 0 ? "hidden" : "visible";
      lines[i]!.setAttribute(
        "points",
        p.samples
          .slice(0, index + 1)
          .map((s) => `${4 + (472 * s.step) / last.step},${140 - (136 * s.values[i]!) / data.maxValue}`)
          .join(" "),
      );
    }
    root.dataset.seed = String(p.seed);
    root.dataset.step = String(sample.step);
    root.dataset.values = JSON.stringify(sample.values);
    root.dataset.playing = String(playing);
    play.textContent = playing
      ? "Pause comparison"
      : index === p.samples.length - 1
        ? "Replay comparison"
        : "Play comparison";
    for (const control of [seed, timeline, play, end]) control.disabled = !unlocked;
    if (unlocked && (announce || performance.now() - lastAnnounced >= 5000)) {
      status.textContent = `At model step ${sample.step}, ${labels[0].toLowerCase()}: ${formatBoundNumber(sample.values[0]!, options.valueUnit)}; ${labels[1].toLowerCase()}: ${formatBoundNumber(sample.values[1]!, options.valueUnit)}.`;
      lastAnnounced = performance.now();
    }
    options.onEndpoint(unlocked && index === p.samples.length - 1);
  }
  function pause() {
    playing = false;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    render(true);
  }
  function start() {
    if (!unlocked || playing) return;
    if (index === pair().samples.length - 1) index = 0;
    playing = true;
    from = index;
    started = performance.now();
    render();
    timer = setInterval(() => {
      const count = pair().samples.length - 1;
      index = Math.min(
        count,
        from + Math.floor(((performance.now() - started) * count) / (data.playbackSeconds * 1000)),
      );
      if (index === count) pause();
      else render();
    }, 50);
  }
  seed.addEventListener("change", () => {
    pause();
    pairIndex = Number(seed.value);
    index = 0;
    render(true);
  });
  timeline.addEventListener("input", () => {
    const next = Number(timeline.value);
    pause();
    index = next;
    render(true);
  });
  const motionChanged = () => {
    if (motion.matches) pause();
  };
  motion.addEventListener("change", motionChanged);
  render();
  return {
    root,
    unlock() {
      unlocked = true;
      render(true);
      if (!motion.matches) start();
    },
    reset() {
      pause();
      unlocked = false;
      pairIndex = 0;
      seed.value = "0";
      index = 0;
      status.textContent = "Commit your prediction to compare the recorded runs.";
      render();
    },
    dispose() {
      if (timer !== undefined) clearInterval(timer);
      motion.removeEventListener("change", motionChanged);
    },
  };
}
