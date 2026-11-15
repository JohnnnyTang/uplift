// <!-- expert-review -->
// Session 7E layout check: renders the lesson copy of "Where plates meet" into the 7R review spread (7C's
// review.css, the layout the owner approved in D-W7-7R) and captures it at desktop and phone sizes. The
// figure frame is an empty placeholder: the block is 7D's. Bindings are filled from the parameter table
// (the same values the host serves) so the captured text is the text a reader sees.
//
//   node docs/review/plates/content/layout.mjs        # rewrites layout-*.html and the PNGs here
//
// Needs Node 24 (type stripping, to import the spread's lesson.ts) and Playwright's Chromium.
/* global URL, console, document, window, getComputedStyle -- Node script; the DOM names run only inside page.evaluate */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = new URL("./", import.meta.url);
const repo = new URL("../../../../", import.meta.url);
const spread = new URL("uplift/spreads/tectonics.plate-boundaries/", repo);
const lesson = await import(new URL("lesson.ts", spread));
const params = JSON.parse(readFileSync(new URL("docs/science/plates/parameters.json", repo), "utf8"));

const values = {
  reliefScale: String(params.display.surfaceVerticalExaggeration),
  crustScale: String(params.display.crustVerticalExaggeration),
  airyRatio: String(params.crust.airyRootPerMetreOfUplift),
  boundaryName: "Convergent",
  stageLabel: "middle",
  ghostNames: "Divergent and Transform",
  scaleBar: "20 km",
};
const bind = (t) => t.replace(/\{\{probe\.(\w+)\}\}/g, (_, k) => values[k] ?? `[${k}]`);
const md = (name) =>
  readFileSync(new URL(name, spread), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const p = (cls, text) => `<p class="${cls}">${esc(bind(text))}</p>`;

function page(level, { flapOpen, boundary }) {
  const L = (t) => t[level];
  const body = md(`page.${level}.md`)
    .map((t) => p("pc-body", t))
    .join("");
  const flap = md(`flap.${level}.md`)
    .map((t) => p("pc-flap-text", t))
    .join("");
  const keyWords = lesson.keyWords
    .map((k) => `<dt>${esc(L(k.term))}</dt><dd>${esc(L(k.definition))}</dd>`)
    .join("");
  const options = lesson.predict.options
    .map(
      (o, i) =>
        `<label class="pr-choice"><input type="radio" name="q" ${i === 0 && flapOpen ? "checked" : ""}/> ${esc(L(o))}</label>`,
    )
    .join("");
  const b = lesson.boundaries.find((x) => x.id === boundary);
  const choices = lesson.boundaries
    .map(
      (x) =>
        `<label class="pr-choice"><input type="radio" name="b" ${x.id === boundary ? "checked" : ""}/><span class="pr-glyph" aria-hidden="true">${x.glyph}</span><span>${esc(L(x.name))}</span></label>`,
    )
    .join("");
  const c = lesson.controlsCopy;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Where plates meet, 7E layout check (${level})</title>
<link rel="stylesheet" href="../../../../uplift/book/src/scenes/plates/relief/review/review.css"/>
<style>
.pc-body{margin:0 0 1cqi;max-width:34em;line-height:1.55}
.pc-predict{margin:1.2cqi 0 0;border:0;padding:0;display:flex;flex-wrap:wrap;gap:.5cqi .8cqi;font-size:max(12px,1.05cqi)}
.pc-predict legend{margin-bottom:.4cqi;font-style:italic;color:var(--pr-ink-soft)}
.pc-flap{margin:1cqi 0 0;font-size:max(12px,1.05cqi)}
.pc-flap summary{cursor:pointer;color:var(--pr-pen)}
.pc-flap-text{margin:.5cqi 0 0;max-width:36em}
.pc-key{margin:1.4cqi 0 0;display:grid;grid-template-columns:max-content 1fr;gap:.2cqi 1cqi;font-size:max(11px,1cqi)}
.pc-key dt{font-weight:bold}.pc-key dd{margin:0;color:var(--pr-ink-soft)}
.pc-help{margin:.8cqi 0 0;font-size:max(11px,1cqi);color:var(--pr-ink-soft);max-width:40em}
</style></head>
<body><main class="pr-review"><div class="pr-desk"><div class="pr-book"><div class="pr-boards" aria-hidden="true"></div>
<article class="pr-spread" aria-labelledby="pr-title">
<section class="pr-page pr-page-text">
<p class="pr-running-head">Lesson ${lesson.LESSON_NUMBER} · ${esc(L(lesson.runningHeads.text))}</p>
<h1 id="pr-title">${esc(L(lesson.title))}</h1>
${body}
<p class="pr-label">${esc(L(lesson.figure.label))}</p>
<fieldset class="pc-predict"><legend>${esc(L(lesson.predict.question))}</legend>${options}</fieldset>
<details class="pc-flap" ${flapOpen ? "open" : ""}><summary>Lift the flap</summary>${flap}</details>
<dl class="pc-key">${keyWords}</dl>
<p class="pr-folio">44</p>
</section>
<section class="pr-page pr-page-figure">
<p class="pr-running-head">${esc(L(lesson.runningHeads.figure))}</p>
<figure class="pr-figure" aria-labelledby="pr-caption"><div class="pr-frame"><p class="pr-fallback">3D block (7D)</p></div>
<figcaption id="pr-caption"><b>Fig. ${lesson.FIGURE_NUMBER}</b> ${esc(L(lesson.figure.caption))} ${esc(bind(L(lesson.figure.scaleNote)))}</figcaption></figure>
<fieldset class="pr-picker"><legend>${esc(L(c.boundaryLegend))}</legend>${choices}</fieldset>
<p class="pc-help">${b ? `${esc(L(b.motion))} ${esc(L(b.help))} ${esc(L(b.example))}` : esc(L(c.boundaryHelp))}</p>
<fieldset class="pr-stage"><legend>${esc(L(c.stageLegend))}</legend><button class="pr-play" type="button">${esc(L(c.play))}</button>
<div class="pr-ruler"><input type="range" min="0" max="1" step="0.01" value="0.5" aria-label="${esc(L(c.stageLegend))}, ${esc(L(c.stageEarly))} to ${esc(L(c.stageLate))}"/><span class="pr-ends" aria-hidden="true"><span>${esc(L(c.stageEarly))}</span><span>${esc(L(c.stageLate))}</span></span></div></fieldset>
<div class="pr-view"><label><span>${esc(L(c.frontFace))}</span><input type="range"/></label><span>${esc(L(c.ghostLegend))}</span><button type="button">${esc(L(c.reset))}</button></div>
<p class="pr-folio">45</p>
</section></article></div></div></main></body></html>`;
}

const variants = [
  { name: "hs", level: "hs", flapOpen: false, boundary: "convergent" },
  { name: "hs-flap", level: "hs", flapOpen: true, boundary: "transform" },
  { name: "uni-flap", level: "uni", flapOpen: true, boundary: "divergent" },
];
for (const v of variants) writeFileSync(new URL(`layout-${v.name}.html`, here), page(v.level, v));

const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
];
const browser = await chromium.launch();
const report = [];
for (const v of variants)
  for (const s of sizes) {
    const pageCtx = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    await pageCtx.goto(new URL(`layout-${v.name}.html`, here).href);
    // Overflow check: no text page content spills past the page, and no horizontal scroll.
    const m = await pageCtx.evaluate(() => {
      const text = document.querySelector(".pr-page-text");
      const figure = document.querySelector(".pr-page-figure");
      const spread = document.querySelector(".pr-spread");
      const last = [...text.children].filter((e) => !e.classList.contains("pr-folio")).at(-1);
      return {
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        textPageHeight: Math.round(text.getBoundingClientRect().height),
        figurePageHeight: Math.round(figure.getBoundingClientRect().height),
        textContentBottom: Math.round(last.getBoundingClientRect().bottom - text.getBoundingClientRect().top),
        spreadMinHeight: Math.round(parseFloat(getComputedStyle(spread).minHeight)),
        stacked: getComputedStyle(spread).gridTemplateColumns.split(" ").length === 1,
      };
    });
    await pageCtx.screenshot({
      path: fileURLToPath(new URL(`layout-${v.name}-${s.name}.png`, here)),
      fullPage: true,
    });
    report.push({ variant: v.name, size: s.name, ...m });
    await pageCtx.close();
  }
await browser.close();
writeFileSync(new URL("layout.json", here), `${JSON.stringify(report, null, 2)}\n`);
console.table(report);
