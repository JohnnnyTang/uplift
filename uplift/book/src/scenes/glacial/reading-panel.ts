/** Upright reading panel. Moves the original DOM so live bindings and disclosures stay intact. */
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
  let active: { source: HTMLElement; marker: Comment; button: HTMLButtonElement } | null = null;
  const restore = () => {
    if (!active) return;
    const { source, marker, button } = active;
    marker.parentElement?.style.removeProperty("min-height");
    marker.replaceWith(source);
    button.setAttribute("aria-expanded", "false");
    active = null;
    button.focus({ preventScroll: true });
  };
  close.onclick = () => panel.close();
  panel.addEventListener("close", restore);
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      panel.close();
    }
  });
  return {
    add(source: HTMLElement, title: string) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gs-read-trigger";
      button.textContent = `Read ${title.toLowerCase()} ↗`;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      source.before(button);
      button.onclick = () => {
        restore();
        const marker = document.createComment("Reading panel source");
        source.replaceWith(marker);
        active = { source, marker, button };
        heading.textContent = title;
        content.replaceChildren(source);
        button.setAttribute("aria-expanded", "true");
        if (!panel.open) panel.show();
        close.focus({ preventScroll: true });
      };
    },
    dispose() {
      restore();
      panel.remove();
    },
  };
}
