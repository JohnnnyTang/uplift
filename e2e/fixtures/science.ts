import { valleySpread, valleyTeacherNotes } from "../../uplift/spreads/index";
import { mountLesson } from "../../uplift/book/src/app/book";

// Exercise the actual book with an explicitly unscored legacy scientific question.
const root = document.querySelector<HTMLElement>("#app")!;
const spread = {
  ...valleySpread,
  page: {
    ...valleySpread.page,
    predict: { ...valleySpread.page.predict, answer: null },
  },
};
void mountLesson(root, spread, valleyTeacherNotes);
