import { mountApp } from "./app/routes";
const app = document.querySelector<HTMLElement>("#app");
if (app)
  void mountApp(app).catch((error: unknown) => {
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = `The book could not start: ${error instanceof Error ? error.message : String(error)}`;
    app.append(message);
  });
