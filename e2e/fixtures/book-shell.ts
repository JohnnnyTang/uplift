import type { MountedReaderShell } from "../../uplift/book/src/reader/shell";
import { createReaderShell } from "../../uplift/book/src/reader/shell";
import { createSceneFixture } from "../../uplift/book/src/reader/fixtures/scene";
import type { ReaderEntry } from "../../uplift/book/src/reader/contracts";
import type { ReaderSpread } from "../../hachure/runtime/src/index";
const both = (value: string) => ({ hs: value, uni: value });
const fixtures: ReturnType<typeof createSceneFixture>[] = [];
let release: (() => void) | undefined;
let mountFailure = false,
  mountGate: Promise<void> | undefined,
  mountRelease: (() => void) | undefined;
const entries: ReaderEntry[] = ["ink", "paper"].map((id, index) => {
  const spread: ReaderSpread = {
    schemaVersion: 0,
    id: `fixture.${id}`,
    title: both(index ? "Follow another line" : "Lift the drawing"),
    tags: { domain: [], courses: [], levels: ["hs", "uni"] },
    tier: "physical-law",
    engine: "scene",
    scene: {
      preset: "fixture",
      seed: 1,
      modelScope: { kind: "static-geometry" },
      camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 40 },
    },
    controls: [],
    probes: [],
    page: {
      body: both(
        "Explore the ink specimen. This fixture checks the book’s pages and controls; it makes no scientific claim.",
      ),
      flap: both(
        "The explanation is available before you touch the drawing or answer the optional question. Returning to this page keeps its state.",
      ),
      predict: {
        question: both("Which part will you explore?"),
        options: [both("The drawing"), both("The explanation")],
        answer: null,
      },
      ignores: {
        hs: ["Illustrative specimen, not a simulation."],
        uni: ["Illustrative specimen, not a simulation."],
      },
      keyWords: [],
    },
    teacherNotes: "#teacher",
    sources: [{ citation: "Fixture notes; no science demonstrated." }],
  };
  return {
    spread,
    createScene(level) {
      const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      drawing.setAttribute("viewBox", "0 0 500 420");
      drawing.setAttribute("role", "img");
      drawing.setAttribute("aria-label", "Ink specimen of nested irregular contours; fixture only");
      drawing.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
      for (let i = 0; i < 13; i++) {
        const path = document.createElementNS(drawing.namespaceURI, "path");
        let d = "";
        for (let j = 0; j <= 80; j++) {
          const a = (j / 80) * Math.PI * 2;
          const r = 155 - i * 9 + Math.sin(a * 3 + i * 0.1) * 12 + Math.cos(a * 5) * 8;
          const x = 250 + Math.cos(a) * r * 1.24;
          const y = 230 + Math.sin(a) * r * 0.72 - i * 2;
          d += `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
        }
        path.setAttribute("d", d + "Z");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#292b2c");
        path.setAttribute("stroke-width", i === 6 ? "2.5" : "1");
        drawing.append(path);
      }
      const control = document.createElement("button");
      control.textContent = "Lift ink specimen";
      control.style.cssText = "position:absolute;bottom:0;left:0";
      control.id = `${id}-lift`;
      const f = createSceneFixture({
        scope: { kind: "static-geometry" },
        presentation: {
          level,
          prediction: { kind: "unanswered" },
          explanationOpen: false,
          liftFraction: 0,
          selection: { kind: "none" },
        },
        attach(container) {
          container.append(drawing, control);
        },
        detach() {
          drawing.remove();
          control.remove();
        },
      });
      control.onclick = () => {
        const p = f.controller.presentation();
        f.controller.present({ ...p, liftFraction: p.liftFraction ? 0 : 1 });
        drawing.style.transform = p.liftFraction ? "" : "skewY(-8deg)";
      };
      if (index === 1) {
        const mount = f.controller.mount;
        f.controller.mount = async (container) => {
          if (mountFailure) {
            mountFailure = false;
            throw new Error("Fixture mount failure");
          }
          await mountGate;
          return mount(container);
        };
      }
      fixtures[index] = f;
      return f.controller;
    },
  };
});
const shell = await createReaderShell(document.querySelector<HTMLElement>("#shell")!, entries, {
  teacherNotes: {
    "fixture.ink": "Teaching notes remain readable in the separate reading surface. ".repeat(12),
  },
  onResearch: () => {},
});
Object.assign(window, {
  failMount: () => {
    mountFailure = true;
  },
  holdMount: () => {
    mountGate = new Promise<void>((resolve) => {
      mountRelease = resolve;
    });
  },
  releaseMount: () => {
    mountRelease?.();
    mountGate = undefined;
  },
  shell,
  fixtures,
  hold: () => {
    const f = fixtures[0]!;
    return f.mutate(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
  },
  release: () => release?.(),
});

declare global {
  interface Window {
    failMount: () => void;
    holdMount: () => void;
    releaseMount: () => void;
    shell: MountedReaderShell;
    fixtures: ReturnType<typeof createSceneFixture>[];
    hold: () => Promise<void>;
    release: () => void;
    results: boolean[];
  }
}
