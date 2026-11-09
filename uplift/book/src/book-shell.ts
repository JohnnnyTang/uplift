import {
  BOOK_PALETTE,
  createColourLegend,
  createDisplayFormula,
  createFlap,
  createIgnores,
  createKeyWords,
  createPlayback,
  createPredict,
  createScaleBar,
  createSlider,
  createTierBadge,
  createTimeScale,
  createToggle,
  el,
} from "@hachure/runtime";
import type { Level } from "@hachure/runtime";
import { createFixtureAdapter, fixtureLabels } from "./fixture-adapter";
import { drawFixture } from "./fixture-drawing";
import { mockSpread as spread } from "./mock-spread";
import "./book.css";

export function mountBook(host: HTMLElement) {
  for (const [key, value] of Object.entries(BOOK_PALETTE)) host.style.setProperty(`--${key}`, value);
  const adapter = createFixtureAdapter();
  let level: Level = "hs",
    unlocked = false,
    showWater = true,
    disposed = false;
  const skip = el("a", "Skip to the spread", "skip-link");
  skip.href = "#spread";
  const header = el("header", undefined, "book-header");
  const brand = el("p", "Uplift", "book-brand");
  const levelLabel = el("label", "Reading level");
  levelLabel.htmlFor = "reading-level";
  const levelSelect = el("select");
  levelSelect.id = "reading-level";
  for (const [value, label] of [
    ["hs", "High school"],
    ["uni", "University"],
  ]) {
    const option = el("option", label);
    option.value = value;
    levelSelect.append(option);
  }
  header.append(brand, levelLabel, levelSelect);
  const notice = el(
    "p",
    "Widget test fixture — not a geography lesson. The fake solver scripts its surface; no science is demonstrated.",
    "fixture-notice",
  );
  const book = el("article", undefined, "book");
  book.id = "spread";
  book.tabIndex = -1;
  book.setAttribute("aria-labelledby", "spread-title");
  const left = el("section", undefined, "page page-left"),
    right = el("section", undefined, "page page-right");
  left.setAttribute("aria-label", "Question and explanation");
  right.setAttribute("aria-label", "Drawing and test controls");
  const title = el("h1", spread.title[level]);
  title.id = "spread-title";
  const body = el("p", spread.page.body[level], "reading-text");
  const flap = createFlap("explanation", spread.page.flap[level]);
  const predict = createPredict("prediction", spread.page.predict, level, () => {
    unlocked = true;
    rain.input.disabled = false;
    speed.input.disabled = false;
    flap.reveal.disabled = false;
    playback.update(adapter.playing, false);
  });
  const words = createKeyWords(spread.page.keyWords, level);
  const university = el("section");
  university.hidden = true;
  university.append(
    el("h2", "Formula specimen"),
    el("p", "This equation tests accessible typesetting only; it makes no claim about this fixture."),
    ...spread.page.equations!.map(createDisplayFormula),
  );
  left.append(title, body, predict.root, flap.root, words.root, university);
  const modelHeading = el("h2", "Inspect the fixture");
  const tier = createTierBadge(spread.tier);
  const tierNote = el(
    "p",
    "Tier badge specimen only: the fake solver is not a process model.",
    "supporting-text",
  );
  const time = createTimeScale("Uncalibrated fixture");
  const figure = el("figure"),
    canvas = el("canvas");
  canvas.id = "terrain";
  canvas.width = 900;
  canvas.height = 430;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Fake solver row profiles, not scientific terrain");
  canvas.setAttribute("aria-describedby", "drawing-description");
  const caption = el(
    "figcaption",
    "Ink lines trace rows from the fake snapshot. Blue marks water in the fixture channel; sediment is reserved in the legend.",
  );
  figure.append(canvas, caption);
  const scale = createScaleBar("Fixture distance", 0.21);
  const description = el("p", undefined, "snapshot-description");
  description.id = "drawing-description";
  const live = el("p", undefined, "visually-hidden");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  const rainSpec = spread.controls.find((control) => control.kind === "slider")!;
  const speedSpec = spread.controls.find((control) => control.kind === "speed")!;
  const rain = createSlider(
    { ...rainSpec, label: rainSpec.label[level] },
    adapter.solver.config.rainMmPerHr,
    (value) => adapter.setRain(value),
  );
  const speed = createSlider(
    { ...speedSpec, label: speedSpec.label[level], unit: "×" },
    adapter.speed,
    (value) => {
      adapter.setSpeed(value);
      void refresh();
    },
  );
  rain.input.disabled = true;
  speed.input.disabled = true;
  const water = createToggle("show-water", "Show water overlay", true, (value) => {
    showWater = value;
    void refresh();
  });
  const playback = createPlayback(
    () => {
      adapter.play();
      playback.update(true, !unlocked);
      live.textContent = "Fixture playing.";
    },
    () => {
      adapter.pause();
      playback.update(false, !unlocked);
      void refresh(true);
    },
    () => {
      adapter.reset();
      unlocked = false;
      predict.reset();
      flap.reset();
      rain.update(adapter.solver.config.rainMmPerHr);
      speed.update(adapter.speed);
      rain.input.disabled = true;
      speed.input.disabled = true;
      playback.update(false, true);
      live.textContent = "Fixture reset. Commit a new prediction to unlock the test.";
      void refresh();
    },
  );
  const controls = el("section", undefined, "test-controls");
  controls.setAttribute("aria-label", "Test controls");
  controls.append(playback.root, rain.root, speed.root, water.root);
  const ignores = createIgnores(spread.page.ignores[level]);
  const teacher = el("details");
  teacher.append(el("summary", "Teacher note and sources"), el("p", spread.teacherNotes));
  for (const source of spread.sources) {
    const link = el("a", source.citation);
    link.href = source.url!;
    teacher.append(link);
  }
  right.append(
    modelHeading,
    tier,
    tierNote,
    time.root,
    figure,
    scale.root,
    createColourLegend("Ink lines: fixture surface"),
    description,
    controls,
    ignores.root,
    teacher,
    live,
  );
  book.append(left, right);
  host.replaceChildren(skip, header, notice, book);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const pauseForMotion = () => {
    if (motion.matches) {
      adapter.pause();
      playback.update(false, !unlocked);
      live.textContent = "Reduced motion enabled. Playback paused; Play starts it when you choose.";
    }
  };
  motion.addEventListener("change", pauseForMotion);
  levelSelect.addEventListener("change", () => {
    level = levelSelect.value as Level;
    title.textContent = spread.title[level];
    body.textContent = spread.page.body[level];
    predict.update(level);
    flap.panel.textContent = spread.page.flap[level];
    words.update(level);
    ignores.update(spread.page.ignores[level]);
    university.hidden = level !== "uni";
    live.textContent = `${level === "uni" ? "University" : "High school"} reading level. The fixture state is unchanged.`;
  });
  let refreshing = false;
  async function refresh(announce = false) {
    if (refreshing || disposed) return;
    refreshing = true;
    try {
      const snapshot = await adapter.snapshot();
      if (disposed) return;
      const labels = fixtureLabels(snapshot, adapter.speed, spread.scene.stepsPerRealSecond);
      time.update(labels.time);
      scale.update(labels.scale, 0.21);
      description.textContent = labels.description;
      book.dataset.step = String(snapshot.step);
      book.dataset.stateHash = await adapter.solver.hash();
      drawFixture(canvas, snapshot, showWater);
      if (announce) live.textContent = labels.description;
    } finally {
      refreshing = false;
    }
  }
  let last = performance.now(),
    lastRead = 0;
  function frame(now: number) {
    if (disposed) return;
    adapter.advance((now - last) / 1000);
    last = now;
    if (now - lastRead >= 250) {
      lastRead = now;
      void refresh();
    }
    request = requestAnimationFrame(frame);
  }
  let request = requestAnimationFrame(frame);
  void refresh();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      motion.removeEventListener("change", pauseForMotion);
      adapter.solver.dispose();
      host.replaceChildren();
    },
  };
}
export { createReaderShell } from "./reader/shell";
export type { MountedReaderShell, ReaderShellOptions } from "./reader/shell";
