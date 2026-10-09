// QA for the Theatre.js demo: loads the page in Playwright (system Chrome, no browser download),
// checks the console, samples every motion for IK/clearance/foot-slide metrics and writes
// contact sheets + studio screenshots to .agents/qa/theatre-demo/.
//   PW_CHANNEL=chrome node src/debug/theatre/qa-shots.mjs [motion ...]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.DEMO_URL ?? "http://localhost:5173/src/debug/theatre/index.html";
const outDir = process.env.QA_OUT ?? ".agents/qa/theatre-demo";
mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);

// ~5 moments per motion (frames @24 fps): ready, anticipation/load, contact, follow, settle.
const MOMENTS = {
  dink: [
    [0, "ready"],
    [12, "step plant"],
    [15, "load"],
    [20, "contact"],
    [25, "follow"],
    [31, "settle"],
  ],
  "punch-volley": [
    [0, "ready"],
    [10, "load"],
    [13, "contact"],
    [17, "held finish"],
    [24, "settle"],
  ],
  "split-step-shuffle": [
    [0, "ready"],
    [9, "split (air)"],
    [13, "land/absorb"],
    [18, "R1 step"],
    [23, "L1 step"],
    [34, "L2 plant"],
  ],
};
const CAMS = (process.env.QA_CAMS ?? "34;side;front").split(";");

const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
});
page.on("console", (m) => {
  if (m.text().includes("Studio is hidden")) return; // expected after studio.ui.hide()
  if (m.type() === "error" || m.type() === "warning") problems.push(`console.${m.type()}: ${m.text()}`);
});
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__theatreDemo?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500); // let the studio UI mount
  const info = await page.evaluate(() => ({
    studio: window.__theatreDemo.studio,
    motions: window.__theatreDemo.motions,
  }));
  console.log("studio:", info.studio, "motions:", info.motions.join(", "));
  const exported = await page.evaluate(() => JSON.parse(window.__theatreDemo.exportState()));
  console.log("export sheets:", Object.keys(exported.sheetsById).join(", "));

  for (const motion of info.motions) {
    if (only.length && !only.includes(motion)) continue;
    await page.evaluate((m) => window.__theatreDemo.setMotion(m), motion);
    // Studio overview screenshot (UI visible, contact frame).
    if (!process.env.QA_NO_STUDIO_SHOT) {
    const contact = MOMENTS[motion].find(([, n]) => n.startsWith("contact"))?.[0] ?? 13;
    await page.evaluate(
      ([t]) => {
        window.__theatreDemo.showStudio(true);
        window.__theatreDemo.setCamera("34");
        window.__theatreDemo.options({ skeleton: false, targets: false, hud: true });
        window.__theatreDemo.seek(t);
      },
      [contact / 24],
    );
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/${motion}-studio.png` });
    }

    // Metrics over the whole sequence (1/48 s steps).
    const samples = await page.evaluate(() => {
      const d = window.__theatreDemo,
        len = d.length(),
        out = [];
      for (let t = 0; t <= len + 1e-9; t += 1 / 48) out.push({ t, ...d.seek(Math.min(t, len)) });
      return out;
    });
    const m = {
      maxReachR: 0,
      maxReachL: 0,
      maxFoot: 0,
      minGapR: Infinity,
      minGapL: Infinity,
      maxAutoHeel: 0,
      slideL: 0,
      slideR: 0,
    };
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i],
        x = s.metrics;
      if (x.reachR > m.maxReachR) m.worstReachAt = `f${(s.t * 24).toFixed(1)}`;
      m.maxReachR = Math.max(m.maxReachR, x.reachR);
      if (x.elbowGapR < m.minGapR) m.worstGapAt = `f${(s.t * 24).toFixed(1)}`;
      m.maxReachL = Math.max(m.maxReachL, x.reachL);
      m.maxFoot = Math.max(m.maxFoot, x.footL, x.footR);
      m.minGapR = Math.min(m.minGapR, x.elbowGapR);
      m.minGapL = Math.min(m.minGapL, x.elbowGapL);
      m.maxAutoHeel = Math.max(m.maxAutoHeel, x.autoHeelL, x.autoHeelR);
      m.maxWrist = Math.max(m.maxWrist ?? 0, x.wristSwingR);
      m.maxTwist = Math.max(m.maxTwist ?? 0, x.wristTwistR);
      if (i) {
        const p = samples[i - 1];
        for (const [side, key, ctl] of [
          ["L", "ballL", "footL"],
          ["R", "ballR", "footR"],
        ]) {
          if (s.controls[ctl].lift < 1e-4 && p.controls[ctl].lift < 1e-4) {
            const a = x[key],
              b = p.metrics[key];
            m["slide" + side] += Math.hypot(a[0] - b[0], a[2] - b[2]);
          }
        }
      }
    }
    const r = (v) => (Number.isFinite(v) ? v.toFixed(3) : v);
    console.log(
      `${motion}: len ${samples.at(-1).t.toFixed(2)}s  reach-short R ${r(m.maxReachR)} L ${r(m.maxReachL)}  ` +
        `foot-short ${r(m.maxFoot)}  min elbow gap R ${r(m.minGapR)} L ${r(m.minGapL)}  ` +
        `auto-heel ${m.maxAutoHeel.toFixed(1)}°  planted slide L ${r(m.slideL)} R ${r(m.slideR)} m` +
        `  max wrist swing ${m.maxWrist.toFixed(0)}° twist ${m.maxTwist.toFixed(0)}°` +
        `  (worst reach ${m.worstReachAt ?? "-"}, worst gapR ${m.worstGapAt ?? "-"})`,
    );
    for (const [f, name] of MOMENTS[motion]) {
      const s = samples.find((x) => Math.abs(x.t - f / 24) < 1e-6) ?? samples[Math.round((f / 24) * 48)];
      const x = s.metrics;
      console.log(
        `  f${String(f).padStart(2)} ${name.padEnd(12)} gapR ${r(x.elbowGapR)} gapL ${r(x.elbowGapL)} ` +
          `reachR ${r(x.reachR)} wrist swing ${x.wristSwingR.toFixed(0)}° twist ${x.wristTwistR.toFixed(0)}° ` +
          `face [${x.paddleFace.map((v) => v.toFixed(2)).join(", ")}]`,
      );
    }

    // Contact sheet: rows = cameras, columns = moments (studio hidden, clean frames).
    const sheet = await page.evaluate(
      async ([moments, cams, title, tile]) => {
        const d = window.__theatreDemo;
        d.showStudio(false);
        d.options({ hud: false, targets: true });
        const src = document.querySelector("canvas");
        const w = Number(tile),
          h = Math.round((w * src.height) / src.width);
        const out = document.createElement("canvas");
        out.width = w * moments.length;
        out.height = h * cams.length + 26;
        const g = out.getContext("2d");
        g.fillStyle = "#111";
        g.fillRect(0, 0, out.width, out.height);
        g.font = "15px sans-serif";
        g.fillStyle = "#fff";
        g.fillText(title, 8, 18);
        for (let r = 0; r < cams.length; r++) {
          d.setCamera(cams[r].startsWith("{") ? JSON.parse(cams[r]) : cams[r]);
          for (let c = 0; c < moments.length; c++) {
            const [f, name] = moments[c];
            d.seek(f / 24); // renders synchronously
            const img = new Image();
            img.src = src.toDataURL("image/png");
            await img.decode();
            g.drawImage(img, c * w, 26 + r * h, w, h);
            g.fillStyle = "rgba(0,0,0,0.55)";
            g.fillRect(c * w, 26 + r * h, 150, 20);
            g.fillStyle = "#fff";
            g.fillText(`f${f} ${name} · ${cams[r].slice(0, 12)}`, c * w + 4, 26 + r * h + 15);
          }
        }
        d.options({ hud: true, targets: false });
        d.showStudio(true);
        return out.toDataURL("image/png");
      },
      [MOMENTS[motion], CAMS, motion, process.env.QA_TILE ?? 400],
    );
    writeFileSync(`${outDir}/${motion}-${process.env.QA_SHEET ?? "sheet"}.png`, Buffer.from(sheet.split(",")[1], "base64"));
  }
  // UI smoke test through the real buttons: motion picker, speed, 24 fps, skeleton, play/pause.
  const ui = await page.evaluate(async () => {
    const d = window.__theatreDemo;
    const click = (sel) => document.querySelector(sel).click();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    d.showStudio(true);
    d.setCamera("34");
    click('[data-motion="punch-volley"]');
    out.length = d.length().toFixed(3);
    d.seek(0);
    click('[data-rate="0.25"]');
    click("#play");
    await wait(800);
    out.rateQuarter = d.position().toFixed(3); // ≈ 0.2 after 0.8 s
    click("#play"); // pause
    click('[data-rate="1"]');
    document.querySelector("#fps24").click();
    d.seek(0);
    click("#play");
    const seen = new Set();
    const t0 = performance.now();
    while (performance.now() - t0 < 1000) {
      seen.add(d.position().toFixed(4));
      await new Promise((r) => requestAnimationFrame(r));
    }
    out.distinctPositions24 = seen.size; // ≈ 24 per second when stepped
    click("#play");
    document.querySelector("#fps24").click();
    document.querySelector("#skel").click();
    out.skeleton = d.three.scene.children.some((c) => c.type === "SkeletonHelper" && c.visible);
    document.querySelector("#skel").click();
    out.playLabel = document.querySelector("#play").textContent;
    click('[data-motion="dink"]');
    return out;
  });
  console.log("UI:", JSON.stringify(ui));
  if (!(Number(ui.rateQuarter) > 0.1 && Number(ui.rateQuarter) < 0.35)) problems.push("0.25x rate looks wrong");
  if (!(ui.distinctPositions24 >= 18 && ui.distinctPositions24 <= 30)) problems.push("24 fps stepping looks wrong");
  if (!ui.skeleton) problems.push("skeleton toggle failed");
  await page.screenshot({ path: `${outDir}/ui-overview.png` });

  // Playback smoke test: play 1 s at 1× and check the playhead moved.
  const moved = await page.evaluate(async () => {
    const d = window.__theatreDemo;
    d.seek(0);
    d.play();
    await new Promise((r) => setTimeout(r, 700));
    const p = d.position();
    d.pause();
    return p;
  });
  console.log(`playback check: playhead at ${moved.toFixed(3)} s after 0.7 s of play`);
  if (!(moved > 0.3)) problems.push("playback did not advance");
} finally {
  await browser.close();
}
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.join("\n  ")}` : "console: clean");
