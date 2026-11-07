import { chromium } from "playwright";
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";
const server = await createServer({
  root: import.meta.dirname,
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: [] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => process.stderr.write(`${e}\n`));
  page.on("console", (m) => {
    if (m.type() === "error") process.stderr.write(`${m.text()}\n`);
  });
  await page.goto("http://127.0.0.1:5178");
  const result = await page.evaluate(() => globalThis.runBenchmark());
  result.execution = "Automated headless Chrome; no WebGPU override flags; not the classroom acceptance run";
  await writeFile(new URL("./results-local.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.rows.some((r) => r.error)) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
