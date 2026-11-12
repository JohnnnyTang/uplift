import {
  ReaderLifecycle,
  SimHost,
  createFlap,
  createPredict,
  WorkerTransport,
  SolverTransport,
} from "../../hachure/runtime/src/index";
import { createCpuSolver } from "../../hachure/terrain/src/index";
import type { AuthoredTerrainInitial, Level } from "../../hachure/runtime/src/index";
const initial: AuthoredTerrainInitial = {
  id: "fixture",
  gridSize: 8,
  metresPerCell: 2,
  outlet: { x: 4, y: 7 },
  bedrockM: Float32Array.from({ length: 64 }, (_, i) => 8 - Math.floor(i / 8)),
  sedimentM: new Float32Array(64),
  hardness: new Float32Array(64).fill(0.5),
  sources: [{ kind: "spring", id: "reader", at: { xM: 7, yM: 3 }, flowM3PerS: 1 }],
};
const params = new URLSearchParams(location.search);
const transport =
  params.get("backend") === "gpu"
    ? new SolverTransport((config, preset) =>
        import("../../hachure/terrain/src/gpu/index").then((m) => m.createGpuTerrainSolver(config, preset)),
      )
    : params.get("backend") === "worker"
      ? new WorkerTransport(
          new Worker(new URL("../../hachure/runtime/src/sim-host/backend/worker.ts", import.meta.url), {
            type: "module",
          }),
        )
      : new SolverTransport(createCpuSolver);
const host = new SimHost(transport, 30);
const reader = new ReaderLifecycle({ questionOptionCount: 2, challenge: "pending" });
const flap = createFlap(
  "answer",
  "An explanation can be opened before playing or answering. No result is claimed about this fixture run.",
);
const predict = createPredict(
  "question",
  {
    question: { hs: "What would you like to try?", uni: "What would you like to try?" },
    options: [
      { hs: "Explore first", uni: "Explore first" },
      { hs: "Reflect first", uni: "Reflect first" },
    ],
    answer: null,
  },
  "hs",
  (optionIndex) =>
    reader.present({ ...reader.presentation(), prediction: { kind: "answered", optionIndex } }),
);
document.querySelector("#learning")!.append(predict.root, flap.root);
const output = document.querySelector<HTMLOutputElement>("#state")!;
function status() {
  output.value = JSON.stringify({
    step: host.sample?.snapshot.step,
    prediction: reader.presentation().prediction.kind,
    level: reader.presentation().level,
    playing: host.playing,
    incision: host.sample?.probes.incisionDepth,
  });
}
flap.reveal.addEventListener("click", () =>
  reader.present({ ...reader.presentation(), explanationOpen: !flap.panel.hidden }),
);
document.querySelector("#level")!.addEventListener("change", (e) => {
  const level = (e.target as HTMLSelectElement).value as Level;
  reader.present({ ...reader.presentation(), level });
  predict.update(level);
  status();
});
document.querySelector("#step")!.addEventListener("click", () => void host.step(1));
document.querySelector("#settle")!.addEventListener(
  "click",
  () =>
    void host.pauseAndSettle().then(() => {
      (document.querySelector("#step") as HTMLButtonElement).disabled = true;
      status();
    }),
);
document.querySelector("#resume")!.addEventListener("click", () => {
  host.resume();
  (document.querySelector("#step") as HTMLButtonElement).disabled = false;
  status();
});
document.querySelector("#reset")!.addEventListener(
  "click",
  () =>
    void host.reset().then(() => {
      reader.reset();
      predict.reset();
      flap.reset();
      status();
    }),
);
host.subscribe(status);
await host.initialize({ gridSize: 8, metresPerCell: 2, pipeAreaM2: 0.1, rainMmPerHr: 0 }, undefined, initial);
reader.setReadiness({ kind: "ready" });
reader.setAttached(true);
status();
Object.assign(window, { readerFixture: { host, initial, snapshot: () => host.sample!.snapshot } });
