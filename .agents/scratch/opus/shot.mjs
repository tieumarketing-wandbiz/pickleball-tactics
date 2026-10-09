// usage: node shot.mjs out.png "type=serve&times=..."
import { chromium } from "@playwright/test";
const [out, query = ""] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => (m.type()==="error" || m.text().startsWith("t=")) && errs.push(m.text()));
await page.goto(`http://localhost:5173/src/debug/pose-lab.html?${query}`);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 60000 }).catch(e => errs.push(String(e)));
import("node:fs").then(fs => 0); const buf = await page.screenshot(); (await import("node:fs")).writeFileSync(out, buf);
if (errs.length) console.log(errs.join("\n"));
await b.close();
