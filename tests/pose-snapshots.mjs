import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.PREVIEW_URL ?? "http://localhost:5173/";
const out = path.resolve(process.argv[2] ?? ".agents/qa/snapshots");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
const metrics = { url: base, startedAt: new Date().toISOString(), glbResponses: [], shots: {} };
page.on("response", async (response) => {
  if (/\.glb(?:\?|$)/i.test(response.url())) {
    const headers = response.headers();
    let bytes = Number(headers["content-length"]);
    if (!Number.isFinite(bytes)) try { bytes = (await response.body()).byteLength; } catch {}
    metrics.glbResponses.push({ url: response.url(), bytes: Number.isFinite(bytes) ? bytes : null });
  }
});
try {
  const navStart = Date.now();
  await page.goto(base);
  const canvas = page.locator("canvas");
  await canvas.waitFor();
  await page.waitForTimeout(1200);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  metrics.humanoidsVisibleMs = Date.now() - navStart;
  await canvas.screenshot({ path: path.join(out, "loaded.png") });
  await page.locator('[data-camera="side"]').click();
  await page.locator("#view-mode").click();
  const initialBounds = await canvas.boundingBox();
  await page.mouse.move(initialBounds.x + initialBounds.width * 0.33, initialBounds.y + initialBounds.height * 0.58);
  await page.mouse.wheel(0, -720);
  await page.waitForTimeout(500);
  await page.locator("#edit-mode").click();
  // Configure the authored shot types through the same shot controls exposed by the editor.
  for (const kind of ["serve", "dink", "volley", "smash"]) {
    await page.locator(`[data-shot="${kind}"]`).click();
    const target = page.locator("#pick-target");
    if (await target.count()) {
      const cls = await target.getAttribute("class");
      if (cls?.includes("active")) {
        const box = await canvas.boundingBox();
        await page.mouse.click(box.x + box.width * 0.58, box.y + box.height * 0.43);
      }
    }
    const shots = {};
    const phaseImages = [];
    for (const [phase, delay] of [["backswing", 100], ["contact", 300], ["follow-through", 500]]) {
      // A reload creates a fresh playback session at t=0; completed previews otherwise remain at their endpoint.
      await page.reload();
      await canvas.waitFor();
      await page.locator(`[data-shot="${kind}"]`).click();
      const play = page.locator("#preview-shot");
      await play.click();
      await page.locator('[data-camera="side"]').click();
      await page.waitForFunction(() => document.querySelector("#play-state")?.textContent === "Đang phát", null, { timeout: 5000 });
      await page.waitForTimeout(delay);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const file = `${kind}-${phase.replaceAll(" ", "-")}.png`;
      const bounds = await canvas.boundingBox();
      const cssClip = { x: bounds.x + bounds.width * 0.27, y: bounds.y + bounds.height * 0.25, width: bounds.width * 0.12, height: bounds.height * 0.31 };
      const phaseImage = await page.screenshot({ path: path.join(out, file), clip: cssClip });
      phaseImages.push(phaseImage);
      const stateText = await page.locator("#play-state").innerText();
      shots[phase] = { file, playbackState: stateText, delayMs: delay };
      if (phase === "contact") {
        await page.locator('[data-camera="baseline"]').click();
        await page.waitForTimeout(250);
        await canvas.screenshot({ path: path.join(out, `${kind}-contact-3d.png`) });
      }
    }
    shots.phasesVisiblyDiffer = phaseImages.slice(1).every((image, i) => !image.equals(phaseImages[i]));
    if (!shots.phasesVisiblyDiffer) throw new Error(`${kind} phase screenshots are not visibly distinct`);
    metrics.shots[kind] = shots;
  }
  // Reset via reload so the default rally is independent from the pose probes.
  await page.reload();
  await canvas.waitFor();
  await page.waitForTimeout(500);
  const playButton = page.locator("#play");
  await playButton.click();
  const start = Date.now();
  const samples = await page.evaluate(async () => {
    const d = [];
    let last;
    const until = performance.now() + 5000;
    await new Promise((resolve) => {
      const tick = (now) => { if (last !== undefined) d.push(now - last); last = now; if (now < until) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    });
    return d;
  });
  metrics.frameTimesMs = {
    samples: samples.length,
    mean: samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length),
    p95: [...samples].sort((a, b) => a - b)[Math.floor(samples.length * 0.95)] ?? null,
    max: Math.max(...samples, 0),
    durationMs: Date.now() - start,
  };
  // Restart after frame timing and take six spaced screenshots during one active playback.
  await page.reload();
  await canvas.waitFor();
  await page.waitForTimeout(300);
  await playButton.click();
  await page.waitForFunction(() => document.querySelector("#play-state")?.textContent === "Đang phát", null, { timeout: 5000 });
  const durationText = (await page.locator("#time-readout").innerText()).split(" / ")[1] ?? "00:00";
  const [dm, ds] = durationText.split(":").map(Number);
  const durationSeconds = dm * 60 + ds;
  metrics.rallyDuration = durationText;
  const intervalMs = Math.max(70, (durationSeconds || 4) * 1000 / 8);
  const rallyShots = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(intervalMs);
    let image = await canvas.screenshot();
    for (let retry = 0; rallyShots.length && image.equals(rallyShots.at(-1).image) && retry < 20; retry++) {
      await page.waitForTimeout(100);
      image = await canvas.screenshot();
    }
    if (rallyShots.length && image.equals(rallyShots.at(-1).image)) {
      // The authored default scenario can finish before all six capture slots; restart playback for remaining samples.
      await page.reload();
      await canvas.waitFor();
      await page.waitForTimeout(250);
      await playButton.click();
      await page.waitForFunction(() => document.querySelector("#play-state")?.textContent === "Đang phát", null, { timeout: 5000 });
      await page.waitForTimeout(300);
      image = await canvas.screenshot();
    }
    if (rallyShots.length && image.equals(rallyShots.at(-1).image)) throw new Error(`Rally screenshot ${i + 1} did not advance during playback`);
    const clock = (await page.locator("#time-readout").innerText()).split(" / ")[0];
    await fs.writeFile(path.join(out, `rally-${i + 1}.png`), image);
    rallyShots.push({ clock, image });
  }
  metrics.rallyCaptureClocks = rallyShots.map((shot) => shot.clock);
  metrics.rallyConsecutiveImagesDiffer = rallyShots.slice(1).every((shot, i) => !shot.image.equals(rallyShots[i].image));
  for (const preset of ["top", "side"]) {
    await page.locator(`[data-camera="${preset}"]`).click();
    await page.waitForTimeout(350);
    await canvas.screenshot({ path: path.join(out, `camera-${preset}.png`) });
  }
  metrics.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "metrics.json"), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
