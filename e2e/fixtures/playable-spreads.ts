import { WorkerTransport } from "../../hachure/runtime/src/index";
import { createHostedWaterDriver } from "../../uplift/book/src/scenes/water-driver";
import { createPlayableScene } from "../../uplift/book/src/scenes/playable-scene";
import { contourSpread, waterSpread } from "../../uplift/book/src/scenes/content";
import { realCpuFixtureDriver } from "./playable-spreads-driver";
const container = document.querySelector<HTMLElement>("#scene")!;
const params = new URLSearchParams(location.search);
const scenes = {
  contour: createPlayableScene("contour", { flat: params.has("flat"), inkBackend: "webgl2" }),
  water: createPlayableScene("water", {
    flat: params.has("flat"),
    inkBackend: "webgl2",
    createWaterDriver: params.has("host")
      ? () =>
          createHostedWaterDriver({
            search: location.search,
            createWorkerTransport: () =>
              new WorkerTransport(
                new Worker(new URL("./playable-spreads.worker.ts", import.meta.url), { type: "module" }),
              ),
          })
      : realCpuFixtureDriver,
  }),
};
let active: "contour" | "water" = "contour",
  mounted = false;
async function show(kind: typeof active) {
  if (mounted) {
    await scenes[active].pauseAndSettle();
    scenes[active].detach();
  }
  active = kind;
  const spread = kind === "water" ? waterSpread : contourSpread;
  document.querySelector("#title")!.textContent = spread.title.hs;
  document.querySelector("#invite")!.textContent = spread.page.body.hs;
  await scenes[active].mount(container);
  scenes[active].resume();
  document.querySelector("#explanation")!.textContent = scenes[active].bindings.render(
    spread.page.flap.hs.replace("<!-- expert-review -->", ""),
  );
  mounted = true;
}
document.querySelector("#contour")!.addEventListener("click", () => void show("contour"));
document.querySelector("#water")!.addEventListener("click", () => void show("water"));
document.querySelector("#reset")!.addEventListener("click", () => void scenes[active].reset());
document.querySelector("#level")!.addEventListener("click", () => {
  const scene = scenes[active],
    s = scene.presentation();
  scene.present({ ...s, level: s.level === "hs" ? "uni" : "hs" });
});
Object.assign(window, {
  playable: {
    scenes,
    show,
    async disposalRace() {
      const driver = await realCpuFixtureDriver();
      let release!: () => void;
      let releases = 0;
      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
      const scene = createPlayableScene("water", {
        inkBackend: "webgl2",
        createWaterDriver: async () => {
          await waiting;
          return {
            ...driver,
            dispose() {
              releases++;
              driver.dispose();
            },
          };
        },
      });
      const target = document.createElement("div");
      document.body.append(target);
      const mount = scene.mount(target),
        dispose = scene.dispose();
      release();
      await Promise.all([mount, dispose]);
      const result = { ...scene.status(), releases };
      target.remove();
      return result;
    },
  },
});
void show("contour");
