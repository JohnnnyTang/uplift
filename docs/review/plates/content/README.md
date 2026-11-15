<!-- expert-review -->

# Where plates meet: copy layout check (session 7E)

The lesson copy of `uplift/spreads/tectonics.plate-boundaries/` set in the 7R review spread: 7C's
`review.css`, the flat book layout the owner reviewed in D-W7-7R. The figure frame is an empty placeholder
(the block is 7D's). Bindings are filled from `docs/science/plates/parameters.json`, the values the host
serves, so the text is what a reader sees. The words are 7E's; the arrangement of the controls is a sketch
for 7D, not a design.

```sh
node docs/review/plates/content/layout.mjs   # rewrites layout-*.html, the PNGs and layout.json
pnpm format                                  # the generated HTML is then formatted
```

| Variant  | Viewport   | Layout   | Text page (px) | Figure page (px) | Text content bottom (px) | Horizontal scroll |
| -------- | ---------- | -------- | -------------- | ---------------- | ------------------------ | ----------------- |
| hs       | 1440 × 900 | spread   | 867            | 867              | 631                      | no                |
| hs       | 1280 × 720 | spread   | 847            | 847              | 615                      | no                |
| hs       | 390 × 844  | one page | 567            | 662              | 531                      | no                |
| hs-flap  | 1440 × 900 | spread   | 867            | 867              | 745                      | no                |
| hs-flap  | 1280 × 720 | spread   | 847            | 847              | 726                      | no                |
| hs-flap  | 390 × 844  | one page | 696            | 662              | 660                      | no                |
| uni-flap | 1440 × 900 | spread   | 905            | 905              | 848                      | no                |
| uni-flap | 1280 × 720 | spread   | 882            | 882              | 827                      | no                |
| uni-flap | 390 × 844  | one page | 786            | 645              | 750                      | no                |

**Reading.** At school level the left page fits inside the spread's height with the flap open (the figure
page sets the height). At university level with the flap open the left page sets it, about 4 % taller than
the school spread; nothing clips and the flat layout grows. On the phone each page reflows to one column
with no horizontal scroll. Glyphs (→ ←, ← →, ⇅) render beside each boundary name.

**For 7F.** On the fixed-height tilted page, let the left page scroll, or collapse the key words, when the
university flap is open.

Captures: `layout-<variant>-<desktop|laptop|phone>.png`.
