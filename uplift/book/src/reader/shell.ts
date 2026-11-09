import { createDisplayFormula } from "@hachure/runtime";
import type { Level, ReaderSceneController } from "@hachure/runtime";
import { READER_SCENE_LIMIT } from "./contracts";
import type { ReaderEntry, ReaderNavigation, ReaderShellController, ReaderTarget } from "./contracts";
import "./shell.css";

export interface ReaderShellOptions {
  readonly initialLevel?: Level;
  readonly history?: boolean;
  readonly teacherNotes?: Readonly<Record<string, string>>;
  /** Called only after the visible scene has settled and detached. */
  readonly onResearch?: () => void | Promise<void>;
}
export interface MountedReaderShell extends ReaderShellController {
  suspend(): Promise<void>;
  resume(): Promise<void>;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
};

/** Retained controllers own models; this shell owns only their DOM attachment and reading state. */
export async function createReaderShell(
  host: HTMLElement,
  entries: readonly ReaderEntry[],
  options: ReaderShellOptions = {},
): Promise<MountedReaderShell> {
  if (
    !entries.length ||
    entries.length > READER_SCENE_LIMIT ||
    new Set(entries.map((e) => e.spread.id)).size !== entries.length
  )
    throw new Error("The reader requires one or two uniquely named lessons");
  let level: Level = options.initialLevel ?? "hs";
  const narrow = matchMedia("(max-width: 60rem)");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const root = node("div", undefined, "reader-shell");
  const header = node("header", undefined, "reader-header");
  const brand = node("p", "Uplift", "reader-brand");
  const levelLabel = node("label", "Reading level");
  const levelSelect = node("select");
  levelSelect.id = "reader-level";
  levelLabel.htmlFor = levelSelect.id;
  for (const [value, label] of [
    ["hs", "High school"],
    ["uni", "University"],
  ]) {
    const option = node("option", label);
    option.value = value!;
    levelSelect.append(option);
  }
  levelSelect.value = level;
  header.append(brand, levelLabel, levelSelect);
  const book = node("main", undefined, "reader-book");
  const nav = node("nav", undefined, "reader-navigation");
  nav.setAttribute("aria-label", "Book pages");
  const previous = node("button"),
    next = node("button"),
    position = node("span");
  const live = node("p", undefined, "reader-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  nav.append(previous, position, next);
  const research = node("button", "Research example", "reader-research");
  research.hidden = !options.onResearch;
  header.append(research);
  root.append(header, book, nav, live);
  host.append(root);
  const scenes = new Map<string, ReaderSceneController>();
  let current: ReaderTarget = { spreadId: entries[0]!.spread.id, page: narrow.matches ? "text" : "spread" };
  let turning = false,
    disposed = false,
    suspended = false,
    generation = 0;
  let animation: Animation | undefined;
  let active: ReturnType<typeof makePage> | undefined;
  let queued:
    | {
        target: ReaderTarget;
        resolve: (value: boolean) => void;
        reject: (error: unknown) => void;
        history: boolean;
      }
    | undefined;
  let running: Promise<void> | undefined;
  let depthWork = Promise.resolve();
  const focusMemory = new Map<string, string>();
  const key = (target: ReaderTarget) => `${target.spreadId}:${target.page}`;
  const normalize = (target: ReaderTarget): ReaderTarget => ({
    spreadId: target.spreadId,
    page: narrow.matches ? (target.page === "spread" ? "text" : target.page) : "spread",
  });
  const sceneFor = (id: string) => {
    let scene = scenes.get(id);
    if (!scene) {
      scene = entries.find((e) => e.spread.id === id)!.createScene(level);
      scenes.set(id, scene);
    }
    return scene;
  };
  function rememberFocus() {
    const focused = document.activeElement as HTMLElement | null;
    if (active && focused && active.article.contains(focused) && focused.id)
      focusMemory.set(key(current), focused.id);
  }
  function restoreFocus() {
    const id = focusMemory.get(key(current));
    const saved = id ? active?.article.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
    const visible = saved && saved.getClientRects().length && !saved.closest("[hidden], [inert]");
    (visible ? saved : active?.heading)?.focus({ preventScroll: true });
  }
  function makePage(target: ReaderTarget) {
    const entry = entries.find((e) => e.spread.id === target.spreadId)!;
    const spread = entry.spread,
      scene = sceneFor(spread.id);
    const article = node("article", undefined, "reader-spread");
    article.dataset.spread = spread.id;
    const text = node("section", undefined, "reader-page reader-text");
    const illustration = node("section", undefined, "reader-page reader-illustration");
    const heading = node("h1");
    heading.id = `${spread.id}-title`;
    heading.tabIndex = -1;
    article.setAttribute("aria-labelledby", heading.id);
    const invitation = node("p", undefined, "reader-invitation");
    const question = node("fieldset", undefined, "reader-question");
    const legend = node("legend");
    question.append(legend);
    const answer = node("button", "Reveal explanation");
    answer.id = `${spread.id}-reveal`;
    const panel = node("div", undefined, "reader-answer");
    panel.id = `${spread.id}-answer`;
    answer.setAttribute("aria-controls", panel.id);
    const shortcut = node("button", "Explore the illustration", "reader-phone-link");
    shortcut.onclick = () => {
      void navigate({ spreadId: spread.id, page: "illustration" });
    };
    const depth = node("button", "Sources and depth");
    depth.id = `${spread.id}-depth`;
    const reading = node("section", undefined, "reader-depth");
    reading.hidden = true;
    reading.setAttribute("aria-label", "Sources and depth");
    const close = node("button", "Return to the spread");
    const depthHeading = node("h2", "Sources and depth");
    depthHeading.tabIndex = -1;
    reading.append(close, depthHeading);
    close.onclick = () => {
      close.disabled = true;
      depthWork = depthWork
        .then(async () => {
          if (disposed || active?.article !== article) return;
          reading.hidden = true;
          text.hidden = current.page === "illustration";
          illustration.hidden = current.page === "text";
          if (current.page !== "text" && !suspended && !scene.status().attached) {
            await scene.mount(surface);
            if (!disposed && !suspended) scene.resume();
          }
          close.disabled = false;
          depth.focus();
        })
        .catch(() => {
          close.disabled = false;
          live.textContent = "The illustration could not reopen. Turn the page to continue.";
        });
    };
    depth.onclick = () => {
      depth.disabled = true;
      depthWork = depthWork
        .then(async () => {
          await scene.pauseAndSettle();
          if (disposed || active?.article !== article) return;
          if (scene.status().attached) scene.detach();
          reading.hidden = false;
          text.hidden = true;
          illustration.hidden = true;
          depth.disabled = false;
          depthHeading.focus();
        })
        .catch(() => {
          depth.disabled = false;
          live.textContent = "The reading surface could not open. Try again.";
        });
    };
    const back = node("button", "Read the explanation", "reader-phone-link");
    back.onclick = () => {
      void navigate({ spreadId: spread.id, page: "text" });
    };
    const sceneHeading = node("h2", "Illustration", "reader-sr");
    sceneHeading.tabIndex = -1;
    sceneHeading.id = `${spread.id}-illustration`;
    const surface = node("div", undefined, "reader-scene");
    surface.setAttribute("data-reader-gesture-surface", "");
    const scope = node("p", undefined, "reader-scope");
    scope.textContent = `${spread.tier.replaceAll("-", " ")} · ${scene.scope.kind === "static-geometry" ? "Static geometry; no model clock" : scene.scope.time === "uncalibrated" ? "Simplified model; time is not calibrated" : "Calibrated process model"}`;
    const status = node("p", undefined, "reader-scene-status");
    const reset = node("button", "Reset illustration");
    reset.id = `${spread.id}-reset`;
    reset.onclick = () => {
      void scene
        .reset()
        .then(() => {
          live.textContent = "Illustration reset.";
        })
        .catch(() => {
          live.textContent = "The illustration could not reset. Try again.";
        });
    };
    const folio = entries.indexOf(entry) * 2 + 1;
    text.append(
      heading,
      invitation,
      shortcut,
      question,
      answer,
      panel,
      depth,
      node("span", String(folio), "reader-folio"),
    );
    illustration.append(
      back,
      sceneHeading,
      surface,
      scope,
      status,
      reset,
      node("span", String(folio + 1), "reader-folio"),
    );
    text.hidden = target.page === "illustration";
    illustration.hidden = target.page === "text";
    article.append(text, illustration, reading);
    let unsubscribers: (() => void)[] = [];
    function bind(element: HTMLElement, template: string) {
      template = template.replace(/<!--.*?-->/gs, "").trim();
      element.textContent = scene.bindings.render(template);
      unsubscribers.push(
        scene.bindings.subscribeText(template, (value) => {
          element.textContent = value;
        }),
      );
    }
    function refresh() {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
      const presentation = scene.presentation();
      bind(heading, spread.title[level]);
      bind(invitation, spread.page.body[level]);
      bind(panel, spread.page.flap[level]);
      panel.hidden = !presentation.explanationOpen;
      answer.setAttribute("aria-expanded", String(presentation.explanationOpen));
      answer.textContent = presentation.explanationOpen ? "Close explanation" : "Reveal explanation";
      question.hidden = !spread.page.predict;
      question.replaceChildren(legend);
      if (spread.page.predict) {
        bind(legend, spread.page.predict.question[level]);
        spread.page.predict.options.forEach((option, index) => {
          const label = node("label");
          const input = node("input");
          input.type = "radio";
          input.name = `${spread.id}-prediction`;
          input.id = `${spread.id}-choice-${index}`;
          input.checked =
            presentation.prediction.kind === "answered" && presentation.prediction.optionIndex === index;
          input.onchange = () =>
            scene.present({ ...scene.presentation(), prediction: { kind: "answered", optionIndex: index } });
          const content = node("span");
          bind(content, option[level]);
          label.append(input, content);
          question.append(label);
        });
      }
      reading.replaceChildren(close, depthHeading);
      const ignores = node("h3", "What this model ignores");
      const list = node("ul");
      for (const value of spread.page.ignores[level]) {
        const item = node("li");
        bind(item, value);
        list.append(item);
      }
      reading.append(ignores, list, node("h3", "Teacher note"));
      const note = options.teacherNotes?.[spread.id];
      if (note) {
        const content = node("p", undefined, "reader-teacher-note");
        bind(content, note);
        reading.append(content);
      } else {
        const link = node("a", "Read the teacher note");
        link.href = spread.teacherNotes;
        reading.append(link);
      }
      reading.append(node("h3", "Sources"));
      for (const source of spread.sources) {
        const content = source.url || source.doi ? node("a", source.citation) : node("p", source.citation);
        if (content instanceof HTMLAnchorElement)
          content.href = source.url ?? `https://doi.org/${source.doi}`;
        reading.append(content);
      }
      if (level === "uni" && spread.page.equations)
        for (const equation of spread.page.equations) reading.append(createDisplayFormula(equation));
    }
    answer.onclick = () => {
      scene.present({ ...scene.presentation(), explanationOpen: !scene.presentation().explanationOpen });
      panel.hidden = !scene.presentation().explanationOpen;
      answer.setAttribute("aria-expanded", String(!panel.hidden));
      answer.textContent = panel.hidden ? "Reveal explanation" : "Close explanation";
    };
    let previousPresentation = JSON.stringify(scene.presentation());
    const unsubscribeStatus = scene.subscribe((state) => {
      status.textContent =
        state.readiness.kind === "fallback"
          ? `Flat illustration: ${state.readiness.reason}`
          : state.readiness.kind === "error"
            ? `Illustration unavailable: ${state.readiness.reason}`
            : state.readiness.kind === "loading"
              ? "Preparing the illustration…"
              : "";
      const nextPresentation = JSON.stringify(scene.presentation());
      // Rebuilding focused radio controls on each gesture would interrupt keyboard use.
      if (nextPresentation !== previousPresentation) {
        previousPresentation = nextPresentation;
        const prediction = scene.presentation().prediction;
        question.querySelectorAll<HTMLInputElement>("input").forEach((input, index) => {
          input.checked = prediction.kind === "answered" && prediction.optionIndex === index;
        });
        panel.hidden = !scene.presentation().explanationOpen;
        answer.setAttribute("aria-expanded", String(!panel.hidden));
        answer.textContent = panel.hidden ? "Reveal explanation" : "Close explanation";
      }
      if (state.gesture === "idle" && queued && !turning) pump();
    });
    refresh();
    return {
      article,
      heading: target.page === "illustration" ? sceneHeading : heading,
      surface,
      scene,
      refresh,
      cleanup: () => {
        unsubscribers.forEach((f) => f());
        unsubscribeStatus();
      },
    };
  }
  function destination(direction: "previous" | "next"): ReaderTarget | undefined {
    const index = entries.findIndex((e) => e.spread.id === current.spreadId);
    if (narrow.matches) {
      if (direction === "next" && current.page === "text") return { ...current, page: "illustration" };
      if (direction === "previous" && current.page === "illustration") return { ...current, page: "text" };
    }
    const entry = entries[index + (direction === "next" ? 1 : -1)];
    return entry
      ? {
          spreadId: entry.spread.id,
          page: narrow.matches ? (direction === "next" ? "text" : "illustration") : "spread",
        }
      : undefined;
  }
  function updateNavigation() {
    const label = (target: ReaderTarget | undefined, fallback: string) =>
      target
        ? `${target.page === "text" ? "Read" : target.page === "illustration" ? "Explore" : "Turn to"} ${sceneFor(target.spreadId).bindings.render(entries.find((e) => e.spread.id === target.spreadId)!.spread.title[level])}`
        : fallback;
    previous.disabled = !destination("previous");
    next.disabled = !destination("next");
    previous.textContent = label(destination("previous"), "Beginning of book");
    next.textContent = label(destination("next"), "End of book");
    position.textContent = `${entries.findIndex((e) => e.spread.id === current.spreadId) + 1} / ${entries.length}`;
    root.dataset.page = current.page;
    root.dataset.turning = String(turning);
  }
  function writeHistory(replace = false) {
    if (options.history === false) return;
    const url = new URL(location.href);
    url.searchParams.set("spread", current.spreadId);
    url.searchParams.set("page", current.page);
    history[replace ? "replaceState" : "pushState"]({ ...history.state, reader: current }, "", url);
  }
  async function display(target: ReaderTarget) {
    active?.cleanup();
    current = target;
    active = makePage(target);
    book.replaceChildren(active.article);
    if (target.page !== "text" && !suspended) {
      await active.scene.mount(active.surface);
      if (!disposed && !suspended) active.scene.resume();
    }
    updateNavigation();
  }
  function pump() {
    if (running || disposed || suspended || !queued || active?.scene.status().gesture !== "idle") return;
    running = drain().finally(() => {
      running = undefined;
      if (queued && !disposed && !suspended) pump();
    });
  }
  async function drain() {
    turning = true;
    updateNavigation();
    const token = ++generation;
    let activeRequest: typeof queued;
    try {
      await depthWork;
      rememberFocus();
      await active!.scene.pauseAndSettle();
      if (disposed || suspended || token !== generation) return;
      active!.article.inert = true;
      if (!motion.matches) {
        animation = active!.article.animate(
          [
            { transform: "rotateY(0deg)", opacity: 1 },
            { transform: "rotateY(-78deg)", opacity: 0.25 },
          ],
          { duration: 340, easing: "ease-in", fill: "forwards" },
        );
        await animation.finished.catch(() => {});
      }
      if (active!.scene.status().attached) active!.scene.detach();
      if (disposed || suspended || token !== generation) return;
      const request = queued!;
      activeRequest = request;
      queued = undefined;
      const target = normalize(request.target);
      await display(target);
      if (disposed || suspended || token !== generation) {
        request.resolve(false);
        return;
      }
      if (request.history) writeHistory();
      restoreFocus();
      live.textContent = `${sceneFor(current.spreadId).bindings.render(entries.find((e) => e.spread.id === current.spreadId)!.spread.title[level])}, ${current.page === "spread" ? "spread" : current.page === "text" ? "explanation" : "illustration"}.`;
      request.resolve(true);
    } catch (error) {
      activeRequest?.reject(error);
      if (!activeRequest) {
        queued?.reject(error);
        queued = undefined;
      }
      if (active) active.article.inert = false;
      live.textContent = "This page could not turn. Try again.";
    } finally {
      activeRequest?.resolve(false);
      animation?.cancel();
      animation = undefined;
      turning = false;
      if (active) active.article.inert = false;
      updateNavigation();
    }
  }
  function requestNavigation(target: ReaderTarget, write = true): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (
      !entries.some((e) => e.spread.id === target.spreadId) ||
      !["spread", "text", "illustration"].includes(target.page)
    )
      return Promise.reject(new Error("Unknown book destination"));
    if (!turning && key(normalize(target)) === key(current)) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      queued?.resolve(false);
      queued = { target, resolve, reject, history: write };
      pump();
    });
  }
  const navigate = (target: ReaderTarget) => requestNavigation(target);
  const turn: ReaderShellController["turn"] = (request) => {
    if (active?.scene.status().gesture !== "idle") return Promise.resolve(false);
    const target = destination(request.direction);
    return target ? navigate(target) : Promise.resolve(false);
  };
  previous.onclick = () => {
    void turn({ direction: "previous", via: "button" });
  };
  next.onclick = () => {
    void turn({ direction: "next", via: "button" });
  };
  function keyboard(event: KeyboardEvent) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element) ||
      event.target.closest(
        "input,textarea,select,button,a,summary,[contenteditable],[data-reader-gesture-surface]",
      )
    )
      return;
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      void turn({ direction: event.key === "PageDown" ? "next" : "previous", via: "keyboard" });
    }
  }
  function popstate() {
    const url = new URL(location.href);
    const id = url.searchParams.get("spread");
    const page = url.searchParams.get("page");
    if (id && entries.some((e) => e.spread.id === id))
      void requestNavigation(
        { spreadId: id, page: page === "text" || page === "illustration" ? page : "spread" },
        false,
      );
  }
  function resize() {
    if (key(normalize(current)) !== key(current)) void requestNavigation(normalize(current), false);
  }
  function reduceMotion() {
    if (motion.matches) animation?.finish();
  }
  function setLevel(value: Level) {
    level = value;
    levelSelect.value = value;
    for (const scene of scenes.values()) scene.present({ ...scene.presentation(), level });
    active?.refresh();
    updateNavigation();
  }
  levelSelect.onchange = () => setLevel(levelSelect.value as Level);
  const controller: MountedReaderShell = {
    navigation: (): ReaderNavigation => ({ ...current, turning }),
    turn,
    navigate,
    setLevel,
    async suspend() {
      suspended = true;
      queued?.resolve(false);
      queued = undefined;
      animation?.finish();
      await running;
      await depthWork;
      await active!.scene.pauseAndSettle();
      if (active!.scene.status().attached) active!.scene.detach();
      root.hidden = true;
    },
    async resume() {
      if (disposed) return;
      suspended = false;
      root.hidden = false;
      if (
        current.page !== "text" &&
        active!.surface.getClientRects().length &&
        !active!.scene.status().attached
      ) {
        await active!.scene.mount(active!.surface);
        active!.scene.resume();
      }
      resize();
      restoreFocus();
      pump();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      queued?.resolve(false);
      queued = undefined;
      animation?.cancel();
      root.removeEventListener("keydown", keyboard);
      window.removeEventListener("popstate", popstate);
      narrow.removeEventListener("change", resize);
      motion.removeEventListener("change", reduceMotion);
      await running;
      await depthWork;
      active?.cleanup();
      await Promise.all([...scenes.values()].map((scene) => scene.dispose()));
      root.remove();
    },
  };
  research.onclick = () => {
    void controller.suspend().then(() => options.onResearch?.());
  };
  root.addEventListener("keydown", keyboard);
  window.addEventListener("popstate", popstate);
  narrow.addEventListener("change", resize);
  motion.addEventListener("change", reduceMotion);
  const url = new URL(location.href);
  const initialId = url.searchParams.get("spread"),
    initialPage = url.searchParams.get("page");
  if (initialId && entries.some((e) => e.spread.id === initialId))
    current = normalize({
      spreadId: initialId,
      page: initialPage === "illustration" ? "illustration" : "text",
    });
  try {
    await display(current);
  } catch (error) {
    await controller.dispose();
    throw error;
  }
  writeHistory(true);
  restoreFocus();
  return controller;
}
