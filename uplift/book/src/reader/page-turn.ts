import "./page-turn.css";

/** Decorative DOM only: the live incoming page remains the sole accessible book. */
let copySerial = 0;
function paperCopy(source: HTMLElement): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement;
  copy.inert = true;
  copy.setAttribute("aria-hidden", "true");
  const ids = new Map<string, string>();
  let serial = 0;
  const prefix = "turn-ink-" + ++copySerial + "-";
  // SVG paint servers need unique IDs even though copied form controls need none.
  for (const element of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    if (element.id) {
      if (element instanceof SVGElement) {
        const renamed = prefix + ++serial;
        ids.set(element.id, renamed);
        element.id = renamed;
      } else element.removeAttribute("id");
    }
    for (const name of ["name", "for", "aria-controls", "aria-labelledby", "aria-describedby", "autofocus"])
      element.removeAttribute(name);
  }
  for (const element of copy.querySelectorAll("*"))
    for (const attribute of [...element.attributes]) {
      let value = attribute.value;
      for (const [id, renamed] of ids) {
        if (value === "#" + id) value = "#" + renamed;
        value = value.replaceAll("url(#" + id + ")", "url(#" + renamed + ")");
      }
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    }
  copy.querySelectorAll("canvas, .gs-drop-overlay, .ps-overlay").forEach((el) => el.remove());
  return copy;
}

export interface PageTurnSnapshot {
  readonly element: HTMLElement;
  play(incoming: HTMLElement, direction: "next" | "previous"): Animation | undefined;
  dispose(): void;
}

/** Freeze the already-flat page while the incoming scene mounts behind it. No renderer is copied. */
export function createPageTurnSnapshot(article: HTMLElement): PageTurnSnapshot {
  const element = document.createElement("div");
  element.className = "reader-turn-snapshot";
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
  const copy = paperCopy(article);
  element.append(copy);
  return {
    element,
    play(incoming, direction) {
      const stageSpread = copy.querySelector<HTMLElement>(".gs-spread");
      const spread = stageSpread ?? copy;
      const pageClass = stageSpread ? ".gs-page" : ".reader-page";
      const pages = [...spread.querySelectorAll<HTMLElement>(pageClass)];
      const arriving = [...incoming.querySelectorAll<HTMLElement>(pageClass)];
      if (pages.length < 2 || arriving.length < 2) return undefined;
      const side = direction === "next" ? 1 : 0;
      const departing = pages[side]!;
      const landing = arriving[1 - side]!;
      // Reflow is a reading surface, not a miniature desktop spread.
      if (Math.abs(pages[0]!.offsetTop - pages[1]!.offsetTop) > 5)
        return element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
      const leaf = document.createElement("div");
      leaf.className = "reader-turn-leaf";
      leaf.dataset.direction = direction;
      leaf.style.left = departing.offsetLeft + "px";
      leaf.style.top = departing.offsetTop + "px";
      leaf.style.width = departing.offsetWidth + "px";
      leaf.style.height = departing.offsetHeight + "px";
      const face = (source: HTMLElement, name: string) => {
        const surface = document.createElement("div");
        surface.className = "reader-turn-face reader-turn-" + name;
        surface.append(paperCopy(source));
        return surface;
      };
      leaf.append(face(departing, "front"), face(landing, "back"));
      departing.replaceWith(paperCopy(arriving[side]!));
      spread.classList.add("reader-turn-spread");
      copy.querySelector(".gs-book")?.classList.add("reader-turn-book");
      spread.append(leaf);
      element.dataset.direction = direction;
      return leaf.animate(
        [
          { transform: "rotateY(0deg)" },
          { transform: "rotateY(" + (direction === "next" ? -180 : 180) + "deg)" },
        ],
        { duration: 950, easing: "cubic-bezier(.32,.08,.22,1)", fill: "forwards" },
      );
    },
    dispose: () => element.remove(),
  };
}
