import { valleySpread, valleyTeacherNotes } from "@uplift/spreads";
import { mountLesson } from "./app/book";
const app = document.querySelector<HTMLElement>("#app");
if (app)
  void mountLesson(app, valleySpread, valleyTeacherNotes).catch((error: unknown) => {
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = `The model could not start: ${error instanceof Error ? error.message : String(error)}`;
    app.append(message);
  });
