/**
 * The book on its study desk (6G, D-W6-6G): how large the tilted book sits in the view, and the wooden desk
 * under it. Shared by both lessons so they are the same size and stand on the same desk.
 */
import { createStudyDesk, woodTextureUrl } from "@hachure/ink/desk";
import type { BookStageFit } from "@hachure/ink/stage";

/**
 * Layout width of the tilted book (unit: CSS pixels); `--gs-book-width` in review.css must match. The page
 * is always laid out at this width, where every text size is at or above its floor, and the stage scales
 * the whole book to the view, so text grows and shrinks with the book and is never squeezed.
 */
export const BOOK_DESIGN_WIDTH_PX = 1040;

/** Seed of the desk's boards: one desk for the whole book. */
const DESK_SEED = 7;

/**
 * Room kept above the paper's far edge (unit: book layout pixels) for the 3D block, which stands on the right
 * page and rises past the page top on screen (most for lesson 2's tipped block). Without it the larger book
 * would push the block's top under the view controls, where the desk clips it.
 */
const BLOCK_HEADROOM_PX = 280;

/** The cloth boards and the page block around the paper (review.css `.gs-boards`; the binding's depth). */
const BOOK_FURNITURE = { sidePx: 40, topPx: BLOCK_HEADROOM_PX, bottomPx: 18, depthPx: 54 } as const;

/**
 * The tilted book fills the desk (the stage host, which already lies between the view controls and the
 * bottom bar) less a small margin, centred on it, at both lessons.
 */
export const BOOK_FIT: BookStageFit = {
  // A little desk shows at the sides on wide-but-short laptop views, where the width would otherwise bind.
  insets: () => {
    const side = Math.max(28, Math.round(window.innerWidth * 0.045));
    return { top: 14, bottom: 14, left: side, right: side };
  },
  furniture: BOOK_FURNITURE,
  centre: true,
  minScale: 0.4,
  maxScale: 2,
};

/**
 * Puts the study desk under the book. On the tilted book it is 3D furniture that follows the view; the flat
 * page (phones, reduced motion, large zoom) shows the same boards from above as a plain background, through
 * `--uplift-desk-wood` on the document. Decoration: hidden from assistive technology, takes no input.
 */
export function mountStudyDesk(book: HTMLElement): { dispose(): void } {
  void woodTextureUrl(DESK_SEED).then((url) => {
    if (url) document.documentElement.style.setProperty("--uplift-desk-wood", `url("${url}")`);
  });
  return createStudyDesk(book, {
    seed: DESK_SEED,
    designWidthPx: BOOK_DESIGN_WIDTH_PX,
    depthPx: BOOK_FURNITURE.depthPx + 2,
    boards: { sidePx: 38, topPx: 14, bottomPx: 16 },
  });
}
