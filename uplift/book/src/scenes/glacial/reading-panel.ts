/** An upright, live reading copy; the original always stays on the book. */
export function createReadingPanel(host: HTMLElement) {
  const panel = document.createElement("dialog");
  panel.className = "gs-reading-panel";
  panel.setAttribute("aria-labelledby", "gs-reading-title");
  const heading = document.createElement("h2");
  heading.id = "gs-reading-title";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Back to the book";
  const content = document.createElement("div");
  content.className = "gs-reading-content";
  panel.append(heading, close, content);
  host.append(panel);
  let active: { source: HTMLElement; button: HTMLButtonElement } | null = null;
  const cleanups: (() => void)[] = [];
  const sync = () => {
    if (!active) return;
    const copy = active.source.cloneNode(true) as HTMLElement;
    // Keep document IDs unique, including references within any copied SVG or disclosure.
    const nodes = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
    const ids = new Map<string, string>();
    for (const node of nodes) if (node.id) ids.set(node.id, `reading-copy-${node.id}`);
    for (const node of nodes) {
      if (node.id) node.id = ids.get(node.id)!;
      for (const attr of Array.from(node.attributes)) {
        if (attr.name === "id") continue;
        let value = attr.value;
        for (const [from, to] of ids) {
          value = value.replaceAll(`url(#${from})`, `url(#${to})`);
          if (["aria-labelledby", "aria-describedby", "for"].includes(attr.name))
            value = value
              .split(" ")
              .map((id) => (id === from ? to : id))
              .join(" ");
          if (attr.name === "href" && value === `#${from}`) value = `#${to}`;
        }
        if (value !== attr.value) node.setAttribute(attr.name, value);
      }
    }
    const focusables = "summary, a, button, input, select, textarea, [tabindex]";
    const focusIndex = Array.from(content.querySelectorAll(focusables)).indexOf(document.activeElement!);
    content.replaceChildren(copy);
    if (focusIndex >= 0)
      content.querySelectorAll<HTMLElement>(focusables)[focusIndex]?.focus({ preventScroll: true });
    // Details are the only interactive lesson content. Both copies share disclosure state.
    const originals = [active.source, ...active.source.querySelectorAll("details")].filter(
      (node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement,
    );
    const copies = [copy, ...copy.querySelectorAll("details")].filter(
      (node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement,
    );
    copies.forEach((details, index) =>
      details.addEventListener("toggle", () => {
        const original = originals[index];
        if (original && original.open !== details.open) original.open = details.open;
      }),
    );
  };
  const observer = new MutationObserver(sync);
  const restore = (focus = true) => {
    observer.disconnect();
    if (!active) return;
    const { button } = active;
    active = null;
    button.setAttribute("aria-expanded", "false");
    content.replaceChildren();
    if (focus) button.focus({ preventScroll: true });
  };
  const dismiss = (focus = true) => {
    restore(focus);
    panel.close();
  };
  close.onclick = () => dismiss();
  panel.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  const onKey = (event: KeyboardEvent) => {
    if (panel.open && event.key === "Escape") {
      event.preventDefault();
      dismiss();
    }
  };
  document.addEventListener("keydown", onKey);
  const outside = (event: PointerEvent) => {
    if (panel.open && event.target instanceof Node && !panel.contains(event.target)) dismiss(false);
  };
  document.addEventListener("pointerdown", outside);
  return {
    add(source: HTMLElement, title: string) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gs-read-trigger";
      button.textContent = `Read ${title.toLowerCase()} ↗`;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      source.before(button);
      const open = () => {
        restore(false);
        active = { source, button };
        heading.textContent = title;
        sync();
        observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true });
        button.setAttribute("aria-expanded", "true");
        if (!panel.open) panel.show();
        close.focus({ preventScroll: true });
      };
      const onContentClick = (event: MouseEvent) => {
        if (event.target instanceof Element && event.target.closest("a,button,input,select,textarea,summary"))
          return;
        open();
      };
      button.onclick = open;
      source.addEventListener("click", onContentClick);
      cleanups.push(() => {
        button.remove();
        source.removeEventListener("click", onContentClick);
      });
    },
    dispose() {
      restore(false);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
      cleanups.forEach((cleanup) => cleanup());
      panel.remove();
    },
  };
}
