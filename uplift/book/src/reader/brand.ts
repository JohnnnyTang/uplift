import { writeText } from "../i18n";
import "./brand.css";

function line(className: string, source: string): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  writeText(paragraph, source);
  return paragraph;
}

/** Brand copy uses the same state-preserving language bindings as the lessons. */
export function createBookBrand() {
  const masthead = document.createElement("header");
  masthead.className = "reader-brand";
  masthead.append(line("reader-brand-name", "Uplift"));
  const colophon = document.createElement("div");
  colophon.className = "reader-colophon";
  colophon.append(
    line("reader-colophon-name", "Hachure"),
    line("reader-colophon-slogan", "From marks on paper to landscapes before you."),
  );
  return { masthead, colophon };
}

/** Sits between the camera toolbar and the book, including in the flat fallback. */
export function createBookSlogan(): HTMLParagraphElement {
  return line("reader-brand-slogan", "Turn a page. Watch a landscape grow.");
}
