import type { mountLesson } from "./book";
import "../book.css";
import "./reader-layout.css";
import { BOOK_PALETTE, WorkerTransport } from "@hachure/runtime";
import { createReaderShell, type MountedReaderShell } from "../reader/shell";
import { createPlayableEntries } from "../scenes/entries";
import waterNotes from "../../../spreads/hydrology.water-path/teacher.md?raw";

/** Retain both model owners while only the visible route is attached and active. */
export async function mountApp(root: HTMLElement) {
  // Bounded review route (5H, R1 owner review): the glacial book stage on fixture or captured runs.
  if (new URLSearchParams(location.search).get("review") === "glacial-stage") {
    const { mountGlacialStageReview } = await import("../scenes/glacial/review");
    return mountGlacialStageReview(root, location.search);
  }
  for (const [key, value] of Object.entries(BOOK_PALETTE)) root.style.setProperty(`--${key}`, value);
  const readerRoot = document.createElement("div");
  const researchRoot = document.createElement("div");
  root.replaceChildren(readerRoot, researchRoot);
  let reader: MountedReaderShell | undefined;
  let research: Awaited<ReturnType<typeof mountLesson>> | undefined;
  let work = Promise.resolve();
  const route = async (isResearch: boolean, write: boolean) => {
    root.dataset.view = isResearch ? "research" : "reader";
    if (isResearch) {
      readerRoot.inert = true;
      await reader?.suspend();
      readerRoot.remove();
      root.append(researchRoot);
      researchRoot.hidden = false;
      researchRoot.inert = false;
      if (!research) {
        const [{ mountLesson }, { valleySpread, valleyTeacherNotes }] = await Promise.all([
          import("./book"),
          import("@uplift/spreads"),
        ]);
        research = await mountLesson(researchRoot, valleySpread, valleyTeacherNotes);
        const back = document.createElement("button");
        back.textContent = "Return to the book";
        back.onclick = () => {
          void navigate(false);
        };
        researchRoot.querySelector("header")!.append(back);
      } else research.resume();
    } else {
      researchRoot.inert = true;
      await research?.suspend();
      researchRoot.remove();
      root.append(readerRoot);
      readerRoot.hidden = false;
      readerRoot.inert = false;
      if (!reader) {
        reader = await createReaderShell(
          readerRoot,
          createPlayableEntries({
            search: location.search,
            createWorkerTransport: () =>
              new WorkerTransport(
                new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" }),
              ),
          }),
          {
            teacherNotes: { "hydrology.water-path": waterNotes },
            onResearch: () => navigate(true),
          },
        );
      } else await reader.resume();
    }
    if (write) {
      const url = new URL(location.href);
      if (isResearch) url.searchParams.set("view", "research");
      else url.searchParams.delete("view");
      history.pushState(history.state, "", url);
    }
    (isResearch
      ? researchRoot.querySelector<HTMLElement>("h1")
      : readerRoot.querySelector<HTMLElement>("h1")
    )?.focus();
  };
  function navigate(isResearch: boolean, write = true) {
    work = work.then(() => route(isResearch, write));
    return work;
  }
  const popstate = () => {
    void navigate(new URLSearchParams(location.search).get("view") === "research", false);
  };
  window.addEventListener("popstate", popstate);
  await navigate(new URLSearchParams(location.search).get("view") === "research", false);
  return {
    async dispose() {
      await work;
      window.removeEventListener("popstate", popstate);
      research?.dispose();
      await reader?.dispose();
    },
  };
}
