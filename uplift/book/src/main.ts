import { mountBook } from "./book-shell";
const app = document.querySelector<HTMLElement>("#app");
if (app) mountBook(app);
