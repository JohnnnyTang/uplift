import { packageName as ink } from "@hachure/ink";
import { packageName as runtime } from "@hachure/runtime";
import { packageName as terrain } from "@hachure/terrain";
import { spreadIds } from "@uplift/spreads";

// Placeholder shell: proves the workspace wiring. Stage 1 replaces it with the open book.
const app = document.querySelector<HTMLElement>("#app");
if (app) {
  app.innerHTML = `
    <h1>Uplift</h1>
    <p>Scaffold only. Engine packages linked: ${[terrain, ink, runtime].join(", ")}.</p>
    <p>Spreads registered: ${spreadIds.length}.</p>
  `;
}
