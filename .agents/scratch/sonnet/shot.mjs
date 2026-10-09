// usage: PW_CHANNEL=chrome node shot.mjs out.png "type=serve&times=..."  [w h]
// batch: node shot.mjs --batch jobs.json   (jobs: [{out, query}])
import { chromium } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
const args = process.argv.slice(2);
let jobs;
if (args[0] === "--batch") jobs = JSON.parse(readFileSync(args[1], "utf8"));
else jobs = [{ out: args[0], query: args[1] ?? "" }];
const b = await chromium.launch({
  headless: true,
  channel: process.env.PW_CHANNEL || "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const job of jobs) {
  const w = Number(new URLSearchParams(job.query).get("w") ?? 1600),
    h = Number(new URLSearchParams(job.query).get("h") ?? 900);
  const page = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => (m.type() === "error" || m.text().startsWith("t=") || m.text().startsWith("J ")) && errs.push(m.text()));
  await page.goto(`http://localhost:5173/src/debug/pose-lab.html?${job.query}`);
  await page
    .waitForFunction(() => document.title === "ready", null, { timeout: 90000 })
    .catch((e) => errs.push(String(e)));
  writeFileSync(job.out, await page.screenshot());
  if (errs.length) console.log(job.out + "\n" + errs.join("\n"));
  await page.close();
}
await b.close();
