import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.PREVIEW_URL ?? "http://localhost:5173/";
const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("courtside.scenario.v1")),
  );
try {
  await page.goto(base);
  await page.locator("canvas").waitFor();
  await page.locator('[data-player="A1"]').click();
  await page.locator("#scenario-name").fill("Bài kiểm tra chiến thuật 🏓");
  await page.locator("#note").fill("Bước một: giao bóng");
  assert.equal(await page.locator("[data-shot]").count(), 15);
  for (const type of [
    "volley",
    "smash",
    "block",
    "punch",
    "reset",
    "speedup",
    "roll",
    "flick",
    "atp",
    "erne",
  ]) {
    await page.locator(`[data-shot="${type}"]`).click();
    assert.equal((await saved()).steps[0].shot.type, type);
  }
  await page.locator('[data-shot="serve"]').click();
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
  await page.locator("#topspin").check();
  assert.equal((await saved()).steps[0].shot.topspin, true);
  await page.locator("#topspin").uncheck();
  assert.equal((await saved()).steps[0].shot.topspin, false);
  const canvasBounds = await page.locator("canvas").boundingBox();
  await page.locator("#view-mode").click();
  const beforeOrbit = await page.locator("canvas").screenshot();
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.5,
    canvasBounds.y + canvasBounds.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.58,
    canvasBounds.y + canvasBounds.height * 0.55,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(600);
  assert.notDeepEqual(
    await page.locator("canvas").screenshot(),
    beforeOrbit,
    "View mode must rotate the court",
  );
  await page.locator("#edit-mode").click();
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: ".playwright/top.png" });
  // Known top preset; derive its fit distance using the same view bounds, then
  // project independent world points to screen coordinates for pointer input.
  const rect = await page.locator("canvas").boundingBox();
  const tan = Math.tan((39 * Math.PI) / 360);
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
  let state = await saved();
  for (const player of state.steps[0].players) {
    const from = project(player.x, player.z, 0.6),
      to = project(player.x + 0.3, player.z + (player.z > 0 ? -0.3 : 0.3));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    const afterDrag = (await saved()).steps[0];
    assert.equal(afterDrag.shot.hitter, "A1", "Dragging must keep the hitter");
    const hitter = afterDrag.players.find((p) => p.id === "A1");
    assert.equal(afterDrag.shot.from.x, hitter.x);
    assert.equal(afterDrag.shot.from.z, hitter.z);
    const next = (await saved()).steps[0].players.find(
      (p) => p.id === player.id,
    );
    assert.ok(
      Math.hypot(next.x - player.x, next.z - player.z) > 0.15,
      `${player.id} must drag`,
    );
  }
  const b1 = (await saved()).steps[0].players.find((p) => p.id === "B1");
  const b1Screen = project(b1.x, b1.z, 0.6);
  const beforeSingle = (await saved()).steps[0].shot;
  await page.mouse.click(b1Screen.x, b1Screen.y);
  assert.deepEqual(
    (await saved()).steps[0].shot,
    beforeSingle,
    "Single click on a player changes neither hitter nor target",
  );
  await page.waitForTimeout(400);
  await page.mouse.dblclick(b1Screen.x, b1Screen.y);
  assert.equal(
    (await saved()).steps[0].shot.hitter,
    "B1",
    "Double-click selects hitter",
  );
  const directTarget = project(0, 3);
  await page.mouse.click(directTarget.x, directTarget.y);
  const directShot = (await saved()).steps[0].shot;
  assert.equal(directShot.hitter, "B1");
  assert.ok(
    Math.abs(directShot.to.z - 3) < 0.05,
    "Court clicks immediately set the fixed hitter target",
  );
  await page.locator('[data-player="A1"]').click();
  const out = project(4, -4);
  await page.mouse.click(out.x, out.y);
  assert.match(await page.locator("#result").innerText(), /OUT/);
  const inside = project(1, -4);
  await page.mouse.click(inside.x, inside.y);
  assert.match(await page.locator("#result").innerText(), /Qua lưới/);
  const previousShot = (await saved()).steps[0].shot;
  await page.locator("#add-step").click();
  assert.equal((await saved()).steps.length, 2);
  const added = (await saved()).steps[1].shot;
  assert.notEqual(added.hitter[0], previousShot.hitter[0]);
  assert.deepEqual({ x: added.from.x, z: added.from.z }, previousShot.to);
  await page.screenshot({ path: ".playwright/next-step-ready.png" });
  assert.equal((await saved()).steps[1].note, "");
  assert.match(await page.locator("#result").innerText(), /Qua lưới/);
  await page.locator('[data-player="B1"]').click();
  await page.locator('[data-shot="drop"]').click();
  assert.equal((await saved()).steps[1].shot.contactFixed, true);
  const returnTarget = project(-1.2, 4.3);
  await page.mouse.click(returnTarget.x, returnTarget.y);
  assert.deepEqual(
    (await saved()).steps[0].shot,
    previousShot,
    "Editing the new step must not change the previous shot",
  );
  await page.locator("#note").fill("Bước hai: trả bóng");
  await page.locator("#duplicate").click();
  assert.equal((await saved()).steps.length, 3);
  await page.locator("#note").fill("Bước ba: di chuyển");
  await page.locator("#delete-step").click();
  assert.equal((await saved()).steps.length, 2);
  await page.locator("#duplicate").click();
  await page.locator('[data-player="A1"]').click();
  const thirdTarget = project(1.8, -1.4);
  await page.mouse.click(thirdTarget.x, thirdTarget.y);
  assert.equal(await page.locator("#finish").isChecked(), false);
  await page.locator("#preview-shot").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 7000 },
  );
  assert.match(await page.locator("#step-counter").innerText(), /03 \/ 03/);
  await page.waitForTimeout(250); // Let the completion toast finish its CSS transition.
  const stoppedLanding = await page.locator("canvas").screenshot();
  await page.waitForTimeout(250);
  assert.ok(
    (await page.locator("canvas").screenshot()).equals(stoppedLanding),
    "Single-shot preview holds its final ball position",
  );
  await page.locator("#finish").check();
  assert.equal((await saved()).steps[2].shot.finish, true);
  await page.locator("#preview-shot").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 10000 },
  );
  assert.match(await page.locator("#step-counter").innerText(), /03 \/ 03/);
  await page.waitForTimeout(250);
  assert.ok(
    !(await page.locator("canvas").screenshot()).equals(stoppedLanding),
    "Finisher ends beyond the original landing point",
  );
  await page.locator("#finish").uncheck();
  await page.locator("#play").click();
  assert.match(
    await page.locator("#step-counter").innerText(),
    /01 \/ 03/,
    "Timeline Play starts at step 1 even when step 3 was selected",
  );
  await page.waitForTimeout(700);
  await page.locator("#play").click();
  assert.equal(await page.locator("#play-state").innerText(), "Tạm dừng");
  const clock = await page.locator("#time-readout").innerText();
  await page.waitForTimeout(150);
  const paused = await page.locator("canvas").screenshot();
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#time-readout").innerText(), clock);
  assert.deepEqual(
    await page.locator("canvas").screenshot(),
    paused,
    "Pause must freeze the rendered ball",
  );
  await page.locator("#play").click();
  await page.waitForFunction(
    () => document.querySelector("#play-state").textContent === "Sẵn sàng",
    null,
    { timeout: 25000 },
  );
  assert.equal(await page.locator("#play-state").innerText(), "Sẵn sàng");
  assert.match(await page.locator("#step-counter").innerText(), /03 \/ 03/);
  const before = await saved();
  await page.reload();
  assert.deepEqual(await saved(), before);
  await page.locator("#share").click();
  const url = await page.locator("#share-url").inputValue();
  assert.ok(url.includes("#s="));
  const shared = await browser.newPage();
  await shared.goto(url);
  await shared.locator("canvas").waitFor();
  assert.equal(
    await shared.locator("#scenario-name").inputValue(),
    before.name,
  );
  assert.equal(await shared.locator("#steps .step").count(), 3);
  await shared.close();
  await page.locator('#share-dialog button[value="close"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith(".json"));
  await page.locator("#file-input").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await page.waitForTimeout(150);
  assert.match(await page.locator("#toast").innerText(), /định dạng/);
  assert.deepEqual(await saved(), before);
  const importData = structuredClone(before);
  importData.name = "Kịch bản nhập";
  await page.locator("#file-input").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importData)),
  });
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator("#scenario-name").inputValue(),
    "Kịch bản nhập",
  );
  for (const name of ["baseline", "side", "perspective"]) {
    await page.locator(`[data-camera="${name}"]`).click();
    assert.ok(
      (await page
        .locator(`[data-camera="${name}"]`)
        .getAttribute("aria-pressed")) === "true",
    );
  }
  await page.screenshot({ path: ".playwright/desktop-final.png" });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.goto(base);
  await mobile.locator("canvas").waitFor();
  await mobile.waitForTimeout(400);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mobile.locator('[data-camera="top"]').tap();
  const touchRect = await mobile.locator("canvas").boundingBox();
  let touchHeight = 24;
  for (let i = 0; i < 8; i++) {
    const extent = Math.max(
      3.3 / (touchHeight - 2.9) / tan / (touchRect.width / touchRect.height),
      6.9 / (touchHeight - 2.9) / tan,
    );
    if (extent <= 0.84) break;
    touchHeight *= extent / 0.84;
  }
  const touchX =
    touchRect.x +
    touchRect.width / 2 +
    ((1.5 / (touchHeight - 0.6) / tan) * touchRect.height) / 2;
  const touchY =
    touchRect.y +
    touchRect.height / 2 -
    ((4.9 / (touchHeight - 0.6) / tan) * touchRect.height) / 2;
  await mobile.touchscreen.tap(touchX, touchY);
  assert.equal(
    await mobile.locator('[data-player="A2"]').getAttribute("aria-pressed"),
    "true",
  );
  await mobile.touchscreen.tap(touchX, touchY);
  assert.equal(
    await mobile.locator('[data-player="B2"]').getAttribute("aria-pressed"),
    "true",
    "Double-tap selects the hitter on mobile",
  );

  await mobile.locator("#pick-target").tap();
  const mobileRect = await mobile.locator("canvas").boundingBox();
  await mobile.touchscreen.tap(
    mobileRect.x + mobileRect.width / 2,
    mobileRect.y + mobileRect.height * 0.36,
  );
  assert.equal(
    await mobile.locator("#pick-target").getAttribute("class"),
    "target-button",
  );
  await mobile.locator('[data-camera="perspective"]').tap();
  await mobile.locator("#view-mode").tap();
  assert.equal(
    await mobile.locator("#view-mode").getAttribute("aria-pressed"),
    "true",
  );
  await mobile.locator("#edit-mode").tap();
  await mobile.screenshot({
    path: ".playwright/mobile-final.png",
    fullPage: true,
  });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 4 player drags, OUT/OK targeting, 3 steps, copy/delete, pause/resume, reload, shared link, JSON import/export, camera presets and mobile layout.",
  );
} finally {
  await browser.close();
}
