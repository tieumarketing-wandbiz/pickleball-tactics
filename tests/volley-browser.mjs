import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1440, height: 950 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("courtside.scenario.v1")),
  );
try {
  await page.goto("http://localhost:5173/");
  const players = [
    { id: "A1", x: 1.5, z: 4.9 },
    { id: "A2", x: -1.5, z: 4.9 },
    { id: "B1", x: -1.5, z: -4.9 },
    { id: "B2", x: 1.5, z: -4.9 },
  ];
  const next = structuredClone(players);
  next[2].z = -2.8;
  const scenario = {
    version: 1,
    playerLayout: 2,
    name: "Chặn volley trên không",
    steps: [
      {
        players,
        shot: {
          hitter: "A2",
          from: { x: -1.5, y: 0.8, z: 4.9 },
          to: { x: -1.5, z: -5.7 },
          type: "serve",
          apex: 1.5,
          finish: true,
          volley: false,
        },
      },
      {
        players: next,
        shot: {
          hitter: "B1",
          from: { x: -1.5, y: 0.8, z: -2.8 },
          to: { x: 1, z: 3 },
          type: "drive",
          apex: 1.1,
          volley: false,
        },
      },
    ],
  };
  await page.evaluate(
    (s) => localStorage.setItem("courtside.scenario.v1", JSON.stringify(s)),
    scenario,
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#next").click();
  await page.locator("#volley").check();
  let state = await saved();
  assert.ok(Math.abs(state.steps[1].shot.from.z + 2.8) < 0.001);
  assert.ok(state.steps[1].shot.from.y > 0.2);
  assert.equal(state.steps[1].shot.groundContactHeight, 0.8);
  assert.equal(await page.locator("#height").isDisabled(), true);
  assert.match(
    await page.locator("#result").innerText(),
    /chặn bóng trước nảy/,
  );
  const before = state.steps[1].shot.from;
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(250);
  const rect = await page.locator("canvas").boundingBox(),
    tan = Math.tan((39 * Math.PI) / 360);
  let h = 24;
  for (let i = 0; i < 8; i++) {
    const extent = Math.max(
      3.3 / (h - 2.9) / tan / (rect.width / rect.height),
      6.9 / (h - 2.9) / tan,
    );
    if (extent <= 0.84) break;
    h *= extent / 0.84;
  }
  const project = (x, z, y = 0) => ({
    x: rect.x + rect.width / 2 + ((x / (h - y) / tan) * rect.height) / 2,
    y: rect.y + rect.height / 2 + ((z / (h - y) / tan) * rect.height) / 2,
  });
  const a = project(-1.5, -2.8, 0.6),
    b = project(-1.5, -1.6);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  state = await saved();
  assert.equal(state.steps[1].shot.hitter, "B1");
  assert.ok(state.steps[1].shot.from.z > before.z + 0.8);
  assert.ok(Math.abs(state.steps[1].shot.from.z + 1.6) < 0.02);
  await page.locator("#volley").uncheck();
  assert.equal((await saved()).steps[1].shot.from.y, 0.8);
  assert.ok((await saved()).steps[1].shot.from.z < -5);
  assert.equal(await page.locator("#height").isDisabled(), false);
  await page.locator("#volley").check();
  const latest = await saved();
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await saved(), latest);
  assert.match(
    await page.locator("#result").innerText(),
    /Được chặn trước khi nảy/,
  );
  await page.locator("#preview-shot").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 10000 },
  );
  assert.match(await page.locator("#result").innerText(), /Điểm chặn/);
  await page.waitForTimeout(250);
  const caughtFrame = await page.locator("canvas").screenshot();
  await page.waitForTimeout(250);
  assert.ok(
    (await page.locator("canvas").screenshot()).equals(caughtFrame),
    "Completed source preview must hold the airborne catch",
  );
  await page.locator("#next").click();
  await page.locator('[data-camera="perspective"]').click();
  await page.screenshot({ path: ".playwright/volley-interception.png" });
  await page.locator("#preview-shot").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 10000 },
  );
  await page.locator("#play").click();
  await page.waitForTimeout(750);
  await page.locator("#play").click();
  assert.equal(await page.locator("#play-state").innerText(), "Tạm dừng");
  await page.waitForTimeout(150);
  const paused = await page.locator("canvas").screenshot();
  await page.waitForTimeout(250);
  assert.ok((await page.locator("canvas").screenshot()).equals(paused));
  await page.locator("#play").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 10000 },
  );
  assert.match(await page.locator("#step-counter").innerText(), /02 \/ 02/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: airborne volley, receiver drag, ground toggle/height, reload, single preview, continuous rally and pause/resume.",
  );
} finally {
  await browser.close();
}
