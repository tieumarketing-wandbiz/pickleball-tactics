// Theatre.js authoring demo (dev only): one sheet per motion, ~10 high-level props per sheet,
// a self-contained IK rig driver. Open http://localhost:5173/src/debug/theatre/index.html
// Query: ?motion=dink|punch-volley|split-step-shuffle  &t=0.8 (seek, paused)  &cam=34|front|side|back
//        &studio=0 (core only, no editor UI)  &play=0
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRafDriver, getProject, onChange, val, type ISheet } from "@theatre/core";
import stateRaw from "./state.json?raw";
import {
  MOTIONS,
  createObjects,
  readControls,
  type MotionId,
  type MotionObjects,
} from "./controls";
import { loadPlayerRig, type PoseControls, type RigMetrics } from "./rig";

const q = new URLSearchParams(location.search);
const PROJECT_ID = "Pickleball";

// ---- Theatre ---------------------------------------------------------------------------------------
type Studio = (typeof import("@theatre/studio"))["default"];
let studio: Studio | undefined;
if (import.meta.env.DEV && q.get("studio") !== "0") {
  // The studio pings updates.theatrejs.com hourly (blocked by CORS on localhost anyway); answer it
  // locally so the demo makes no third-party request and the console stays clean.
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    String(input instanceof Request ? input.url : input).includes("updates.theatrejs.com")
      ? Promise.resolve(new Response(null, { status: 503 }))
      : realFetch(input, init);
  studio = (await import("@theatre/studio")).default;
  studio.initialize({ persistenceKey: "pickleball-theatre-demo" });
}
const project = getProject(PROJECT_ID, { state: JSON.parse(stateRaw) });
const sheets = new Map<MotionId, { sheet: ISheet; objs: MotionObjects }>();
for (const m of MOTIONS) {
  const sheet = project.sheet(m.id);
  sheets.set(m.id, { sheet, objs: createObjects(sheet) });
}

// ---- scene -----------------------------------------------------------------------------------------
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0x1c2731);
scene.fog = new T.Fog(0x1c2731, 14, 30);
const camera = new T.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 60);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0.2, 0.62, -0.15);

scene.add(new T.HemisphereLight(0xe4f0ff, 0x3b4a3a, 1.25));
const sun = new T.DirectionalLight(0xffffff, 2.4);
sun.position.set(2.5, 6, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
sun.shadow.camera.right = sun.shadow.camera.top = 3;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// Court: the player stands in the right service court, toes just behind the kitchen line (−Z = net).
const KITCHEN_Z = -0.2;
function court() {
  const g = new T.Group();
  const plane = (w: number, d: number, color: number, x: number, z: number, y = 0) => {
    const m = new T.Mesh(
      new T.PlaneGeometry(w, d),
      new T.MeshStandardMaterial({ color, roughness: 0.92 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  plane(30, 30, 0x355e3f, 0, 0); // surround
  plane(6.1, 13.41, 0x2f5d96, -1.5, KITCHEN_Z - 2.13 + 13.41 / 2 - 6.7, 0.001); // court
  const line = (w: number, d: number, x: number, z: number) => plane(w, d, 0xf3f5f7, x, z, 0.002);
  line(6.1, 0.05, -1.5, KITCHEN_Z); // kitchen (NVZ) line
  line(0.05, 4.57, -1.5, KITCHEN_Z + 4.57 / 2); // centre line
  line(0.05, 6.71, 1.55, KITCHEN_Z - 2.13 + 6.71 / 2); // sideline
  line(0.05, 6.71, -4.55, KITCHEN_Z - 2.13 + 6.71 / 2);
  // Net.
  const netZ = KITCHEN_Z - 2.13;
  const net = new T.Mesh(
    new T.PlaneGeometry(6.7, 0.88),
    new T.MeshStandardMaterial({
      color: 0x101418,
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
    }),
  );
  net.position.set(-1.5, 0.44, netZ);
  const tape = new T.Mesh(
    new T.BoxGeometry(6.7, 0.05, 0.02),
    new T.MeshStandardMaterial({ color: 0xffffff }),
  );
  tape.position.set(-1.5, 0.89, netZ);
  for (const x of [-4.85, 1.85]) {
    const post = new T.Mesh(
      new T.CylinderGeometry(0.03, 0.03, 0.92, 10),
      new T.MeshStandardMaterial({ color: 0x222222 }),
    );
    post.position.set(x, 0.46, netZ);
    g.add(post);
  }
  g.add(net, tape);
  const grid = new T.GridHelper(4, 16, 0x9fb7c9, 0x6d8597);
  (grid.material as T.Material).transparent = true;
  (grid.material as T.Material).opacity = 0.25;
  grid.position.y = 0.004;
  g.add(grid);
  return g;
}
scene.add(court());

const rig = await loadPlayerRig(`${import.meta.env.BASE_URL}models/male-rigged.glb`);
scene.add(rig.root);
const skeleton = new T.SkeletonHelper(rig.root);
skeleton.visible = false;
scene.add(skeleton);
// IK target markers.
const markers = new T.Group();
markers.visible = false;
const marker = (color: number, r = 0.022) => {
  const m = new T.Mesh(
    new T.SphereGeometry(r, 14, 8),
    new T.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }),
  );
  m.renderOrder = 10;
  markers.add(m);
  return m;
};
const mk = {
  grip: marker(0xffe14d),
  wristR: marker(0xff7a3d, 0.015),
  wristL: marker(0x4dd2ff, 0.018),
  ankleL: marker(0x4dd2ff),
  ankleR: marker(0xff7a3d),
};
scene.add(markers);

// ---- cameras ---------------------------------------------------------------------------------------
const CAMS: Record<string, [number, number, number]> = {
  "34": [2.7, 1.4, -2.1],
  front: [0.1, 1.15, -2.2],
  side: [3.4, 1.0, -0.35],
  back: [-1.9, 1.7, 2.7],
};
type V = [number, number, number];
/** When set, the camera rides with the paddle grip target (QA close-ups of the hand). */
let follow: { pos: V; target: V } | undefined;
function setCamera(name: string | { pos: V; target: V; follow?: boolean }) {
  follow = typeof name !== "string" && name.follow ? name : undefined;
  if (follow) return;
  if (typeof name === "string") {
    camera.position.set(...(CAMS[name] ?? CAMS["34"]));
    orbit.target.set(0.2, 0.62, -0.15);
  } else {
    camera.position.set(...name.pos);
    orbit.target.set(...name.target);
  }
  orbit.update();
}
setCamera(q.get("cam") ?? "34");

// ---- playback --------------------------------------------------------------------------------------
let current: MotionId = MOTIONS.some((m) => m.id === q.get("motion"))
  ? (q.get("motion") as MotionId)
  : "dink";
let loop = true,
  rate = 1,
  fps24 = false,
  acc24 = 0;
const driver24 = createRafDriver({ name: "24 fps" });
const seq = () => sheets.get(current)!.sheet.sequence;
const seqLength = () => val(seq().pointer.length);
function play() {
  const s = seq();
  if (!loop && s.position >= seqLength() - 1e-4) s.position = 0;
  void s.play({
    iterationCount: loop ? Infinity : 1,
    rate,
    rafDriver: fps24 ? driver24 : undefined,
  });
}
const pause = () => seq().pause();
const isPlaying = () => val(seq().pointer.playing);
function restartIfPlaying() {
  if (isPlaying()) {
    pause();
    play();
  }
}
function setMotion(id: MotionId) {
  const was = isPlaying();
  pause();
  current = id;
  seq().position = 0;
  studio?.setSelection([sheets.get(id)!.objs["Arms / Paddle hand R"]]);
  if (was) play();
  syncUi();
}

// ---- UI --------------------------------------------------------------------------------------------
const ui = document.getElementById("ui")!;
ui.innerHTML = `
  <div class="row" id="motions">${MOTIONS.map(
    (m) => `<button data-motion="${m.id}">${m.label}</button>`,
  ).join("")}</div>
  <div class="row">
    <button id="play">Pause</button>
    <label><input type="checkbox" id="loop" checked> loop</label>
    <span class="sep"></span>
    <button data-rate="0.25">0.25×</button><button data-rate="0.5">0.5×</button><button data-rate="1">1×</button>
    <span class="sep"></span>
    <label title="Sample the sequence at 24 fps (stepped, like film)"><input type="checkbox" id="fps24"> 24 fps</label>
  </div>
  <div class="row">
    <label><input type="checkbox" id="skel"> skeleton</label>
    <label><input type="checkbox" id="targets"> IK targets</label>
    <span class="sep"></span>
    ${Object.keys(CAMS)
      .map((c) => `<button data-cam="${c}">${c === "34" ? "3/4" : c}</button>`)
      .join("")}
    <span class="sep"></span>
    <button id="export" title="Download the Theatre project state (same as the studio's own export)">Export state JSON</button>
  </div>
  <div class="row mono" id="time"></div>
  <div class="row mono" id="qa"></div>`;
const $ = <E extends HTMLElement>(sel: string) => ui.querySelector(sel) as E;
ui.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach((b) =>
  b.addEventListener("click", () => setMotion(b.dataset.motion as MotionId)),
);
$("#play").addEventListener("click", () => (isPlaying() ? pause() : play()));
$<HTMLInputElement>("#loop").addEventListener("change", (e) => {
  loop = (e.target as HTMLInputElement).checked;
  restartIfPlaying();
});
ui.querySelectorAll<HTMLButtonElement>("[data-rate]").forEach((b) =>
  b.addEventListener("click", () => {
    rate = Number(b.dataset.rate);
    restartIfPlaying();
    syncUi();
  }),
);
$<HTMLInputElement>("#fps24").addEventListener("change", (e) => {
  fps24 = (e.target as HTMLInputElement).checked;
  restartIfPlaying();
});
$<HTMLInputElement>("#skel").addEventListener("change", (e) => {
  skeleton.visible = (e.target as HTMLInputElement).checked;
});
$<HTMLInputElement>("#targets").addEventListener("change", (e) => {
  markers.visible = (e.target as HTMLInputElement).checked;
});
ui.querySelectorAll<HTMLButtonElement>("[data-cam]").forEach((b) =>
  b.addEventListener("click", () => setCamera(b.dataset.cam!)),
);
function exportState() {
  if (!studio) throw new Error("studio not loaded (?studio=0)");
  return JSON.stringify(studio.createContentOfSaveFile(PROJECT_ID), null, 2);
}
const exportBtn = $<HTMLButtonElement>("#export");
exportBtn.disabled = !studio;
exportBtn.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([exportState()], { type: "application/json" }));
  a.download = "state.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
function syncUi() {
  ui.querySelectorAll<HTMLButtonElement>("[data-motion]").forEach((b) =>
    b.classList.toggle("on", b.dataset.motion === current),
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-rate]").forEach((b) =>
    b.classList.toggle("on", Number(b.dataset.rate) === rate),
  );
  $("#play").textContent = isPlaying() ? "Pause" : "Play";
}
for (const { sheet } of sheets.values()) onChange(sheet.sequence.pointer.playing, syncUi);

const fmt = (v: number) => (v >= 0 ? " " : "") + v.toFixed(3);
function hud(m: RigMetrics) {
  const t = seq().position,
    len = seqLength();
  $("#time").textContent = `t ${t.toFixed(3)} / ${len.toFixed(3)} s   frame ${Math.round(t * 24)}/${Math.round(len * 24)} @24`;
  const warn = (v: number, bad: boolean, digits = 3) =>
    `<b class="${bad ? "bad" : ""}">${digits === 3 ? fmt(v) : v.toFixed(digits)}</b>`;
  $("#qa").innerHTML =
    `elbow gap R ${warn(m.elbowGapR, m.elbowGapR < 0.08)} L ${warn(m.elbowGapL, m.elbowGapL < 0.05)} m · ` +
    `reach short R ${warn(m.reachR, m.reachR > 0.005)} L ${warn(m.reachL, m.reachL > 0.005)} · ` +
    `foot short ${warn(Math.max(m.footL, m.footR), Math.max(m.footL, m.footR) > 0.005)} · ` +
    `auto heel L ${m.autoHeelL.toFixed(0)}° R ${m.autoHeelR.toFixed(0)}°
` +
    `paddle wrist: swing ${warn(m.wristSwingR, m.wristSwingR > 50, 0)}° (flex/deviation) ` +
    `twist ${warn(m.wristTwistR, m.wristTwistR > 100, 0)}° (pro/supination)`;
}

// ---- frame loop ------------------------------------------------------------------------------------
/** QA override: solve these controls instead of the sheet's values. */
let override: PoseControls | undefined;
function frame() {
  rig.solve(override ?? readControls(sheets.get(current)!.objs));
  for (const k of Object.keys(mk) as (keyof typeof mk)[]) mk[k].position.copy(rig.targets[k]);
  hud(rig.metrics);
  if (follow) {
    const g = rig.targets.grip;
    camera.position.set(g.x + follow.pos[0], g.y + follow.pos[1], g.z + follow.pos[2]);
    orbit.target.set(g.x + follow.target[0], g.y + follow.target[1], g.z + follow.target[2]);
  }
  orbit.update();
  renderer.render(scene, camera);
}
const clock = new T.Clock();
renderer.setAnimationLoop(() => {
  acc24 += clock.getDelta();
  if (acc24 >= 1 / 24) {
    acc24 %= 1 / 24;
    driver24.tick(performance.now());
  }
  frame();
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await project.ready;
setMotion(current);
if (q.has("t")) {
  pause();
  seq().position = Number(q.get("t"));
} else if (q.get("play") !== "0") play();
syncUi();

// ---- QA hook (used by qa-shots.mjs) ----------------------------------------------------------------
const api = {
  ready: true,
  motions: MOTIONS.map((m) => m.id),
  studio: !!studio,
  setMotion,
  length: seqLength,
  position: () => seq().position,
  play,
  pause,
  /** Pause, jump to t and render synchronously; returns the rig metrics + controls. */
  seek(t: number) {
    pause();
    seq().position = t;
    frame();
    return structuredClone({ metrics: rig.metrics, controls: readControls(sheets.get(current)!.objs) });
  },
  setCamera,
  /** Solve explicit controls (merged over the current values); pass null to go back to the sheet. */
  pose(c: Partial<PoseControls> | null) {
    override = c ? { ...readControls(sheets.get(current)!.objs), ...c } : undefined;
    frame();
    return structuredClone(rig.metrics);
  },
  /** Re-seat the paddle in the hand (QA grip experiments). */
  setGrip(tilt: number, bevel: number) {
    rig.setGrip({ tilt, bevel });
  },
  /** Solve explicit full controls without rendering (QA parameter searches). */
  solveOnly(c: PoseControls) {
    rig.solve(c);
    return structuredClone(rig.metrics);
  },
  showStudio(show: boolean) {
    if (!studio) return;
    if (show) studio.ui.restore();
    else studio.ui.hide();
  },
  options(o: { skeleton?: boolean; targets?: boolean; hud?: boolean }) {
    if (o.skeleton !== undefined) skeleton.visible = o.skeleton;
    if (o.targets !== undefined) markers.visible = o.targets;
    if (o.hud !== undefined) ui.style.display = o.hud ? "" : "none";
    frame();
  },
  exportState,
  /** three objects for console debugging */
  three: { scene, camera, orbit, renderer, rig },
  theatre: { studio, project, sheets },
};
(window as unknown as { __theatreDemo: typeof api }).__theatreDemo = api;
