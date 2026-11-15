// <!-- expert-review -->
// Rewrites the sentence register at the end of README.md (after "## Sentence register" and its intro
// paragraph) from the lesson copy, using the spread's register.ts. lesson.test.ts fails when the README is
// stale; run this, then `pnpm format`.
//
//   node docs/science/plates/lesson/register.mjs
//
// Needs Node 24 (type stripping, to import the spread's .ts modules).
/* global URL, console -- Node script */
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL("./", import.meta.url);
const spread = new URL("../../../../uplift/spreads/tectonics.plate-boundaries/", import.meta.url);
const { buildRegister, registerTable } = await import(new URL("register.ts", spread));
const lesson = await import(new URL("lesson.ts", spread));
const { claims } = await import(new URL("claims.ts", spread));
const names = ["deeper.uni.md", "flap.hs.md", "flap.uni.md", "page.hs.md", "page.uni.md", "teacher-notes.md"];
const files = Object.fromEntries(names.map((f) => [f, readFileSync(new URL(f, spread), "utf8")]));
const rows = buildRegister(files, lesson.textGroups, lesson.textClaims, claims);

const readmeUrl = new URL("README.md", here);
const readme = readFileSync(readmeUrl, "utf8");
const at = readme.indexOf("| Where | Level |");
const marker = readme.search(/\n\| *Where *\| *Level *\|/);
const cut = marker >= 0 ? marker + 1 : at;
if (cut < 0) throw new Error("README.md has no sentence register table to replace");
writeFileSync(readmeUrl, `${readme.slice(0, cut)}${registerTable(rows).join("\n")}\n`);
console.log(`${rows.length} sentences written to the register`);
