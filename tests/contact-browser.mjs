import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("courtside.scenario.v1")),
  );
try {
  await page.goto("http://localhost:5173/");
  await page.locator("canvas").waitFor();
  await page.locator("#note").fill("Rally");
  for (const id of [
    "hand",
    "contact-fixed",
    "pick-contact",
    "contact-x",
    "contact-z",
    "spin-type",
    "spin-strength",
    "bounce",
  ])
    assert.equal(await page.locator("#" + id).count(), 0);
  const previous = (await saved()).steps[0].shot;
  await page.locator("#add-step").click();
  const next = (await saved()).steps[1].shot;
  assert.equal(next.hitter, "B2");
  assert.deepEqual({ x: next.from.x, z: next.from.z }, previous.to);
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(250);
  const rect = await page.locator("canvas").boundingBox(),
    tan = Math.tan((39 * Math.PI) / 360);
  let height = 24;
  for (let i = 0; i < 8; i++) {
    const extent = Math.max(
      3.3 / (height - 2.9) / tan / (rect.width / rect.height),
      6.9 / (height - 2.9) / tan,
    );
    if (extent <= 0.84) break;
    height *= extent / 0.84;
  }
  const project = (x, z, y = 0) => ({
    x: rect.x + rect.width / 2 + ((x / (height - y) / tan) * rect.height) / 2,
    y: rect.y + rect.height / 2 + ((z / (height - y) / tan) * rect.height) / 2,
  });
  const drag = async (x, z, xx, zz) => {
    const a = project(x, z, 0.6),
      b = project(xx, zz);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };
  await drag(1.5, -4.9, 1.9, -4.9);
  assert.equal(await page.locator("#stroke-side").innerText(), "Forehand");
  await drag(1.9, -4.9, 1.1, -4.9);
  assert.equal(await page.locator("#stroke-side").innerText(), "Backhand");
  const players = [
    { id: "A1", x: -1.5, z: 2.3 },
    { id: "A2", x: 1.5, z: 2.3 },
    { id: "B1", x: 3, z: -1.7 },
    { id: "B2", x: -1.5, z: -2.3 },
  ];
  const scene = {
    version: 1,
    name: "Dink → ATP",
    playerLayout: 2,
    steps: [
      {
        players,
        shot: {
          hitter: "A1",
          from: { x: -1.5, y: 0.8, z: 2.3 },
          to: { x: 3, z: -1.5 },
          type: "dink",
          apex: 1.2,
          finish: false,
          topspin: false,
          autoBounce: true,
        },
      },
    ],
  };
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "dink.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(scene)),
    });
  await page.locator("#finish").check();
  assert.match(await page.locator("#result").innerText(), /nảy vượt biên/);
  await page.locator("#add-step").click();
  assert.equal((await saved()).steps[1].shot.hitter, "B1");
  await drag(3, -1.7, 4.2, -2);
  await page.locator('[data-shot="atp"]').click();
  const target = project(2.9, 6);
  await page.mouse.click(target.x, target.y);
  assert.ok(
    (await saved()).steps[1].players.find((p) => p.id === "B1").x > 3.05,
  );
  assert.ok((await saved()).steps[1].shot.from.x > 3.35);
  assert.match(await page.locator("#result").innerText(), /ATP \/ vòng cột/);
  await drag(4.2, -2, 4.2, -3);
  assert.equal(await page.locator("#stroke-side").innerText(), "Backhand");
  assert.match(await page.locator("#result").innerText(), /ATP \/ vòng cột/);
  await page.locator("#topspin").check();
  assert.equal((await saved()).steps[1].shot.topspin, true);
  assert.match(await page.locator("#result").innerText(), /Nảy dự đoán/);
  await page.locator('[data-camera="perspective"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: ".playwright/automatic-return.png" });
  const before = await saved();
  await page.reload();
  assert.deepEqual(await saved(), before);
  assert.equal(await page.locator("#topspin").count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: opponent handoff, removed controls, automatic receiving/FH/BH/ATP, estimated rebound, topspin tick and reload.",
  );
} finally {
  await browser.close();
}
