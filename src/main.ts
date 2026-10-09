import {
  fitDink,
  strokeSide,
  receiveContact,
  findVolleyContact,
} from "./core/contact";
import { defaultSpin, shotSpin } from "./core/spin";
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  COURT,
  DEFAULT_APEX,
  DEFAULT_HEIGHT,
  VOLLEY_TYPES,
  SHOT_HINTS,
  shotOrigin,
  SHOT_NAMES,
  snapPlayer,
  type PlayerId,
  type ShotType,
} from "./core/constants";
import {
  clone,
  encodeScenario,
  decodeScenario,
  parseScenario,
  type Player,
  type Shot,
} from "./core/scenario";
import type { Trajectory } from "./core/trajectory";
import {
  buildClips,
  buildPreviewClip,
  sampleClipBall,
  sampleClipPlayers,
  type Clip,
} from "./core/playback";
import { Store } from "./state/store";
import { createCourt } from "./scene/court";
import { Players } from "./scene/players";
import { BallView } from "./scene/ball";
import { PlaybackClock, PlaybackRenderClock, PLAYBACK_FPS } from "./core/render-clock";
import { ShutterGhosts } from "./scene/shutter-ghosts";
import { buildUI, icons, toast } from "./ui/toolbar";
import { renderTimeline } from "./ui/timeline";

buildUI();
const store = new Store();
function simplifyShots() {
  for (const step of store.scenario.steps)
    if (step.shot) {
      step.shot.topspin = step.shot.topspin ?? step.shot.spin?.type === "top";
      step.shot.autoBounce = true;
    }
}
simplifyShots();
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const container = $<HTMLDivElement>("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111e26);
scene.fog = new THREE.Fog(0x111e26, 32, 75);
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch {
  container.innerHTML =
    '<p class="error-screen">Không khởi tạo được WebGL. Hãy bật tăng tốc phần cứng trong trình duyệt và tải lại trang.</p>';
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.append(renderer.domElement);
renderer.domElement.setAttribute(
  "aria-label",
  "Sân 3D: kéo người chơi trong chế độ chỉnh sửa; xoay và zoom trong chế độ xem",
);
const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.06;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.enablePan = false;
controls.target.set(0, 0, 0);
controls.enableRotate = false;
scene.add(new THREE.HemisphereLight(0xc5e5ee, 0x233631, 2.3));
const key = new THREE.DirectionalLight(0xffedda, 3.0);
key.position.set(-7, 15, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {
  left: -10,
  right: 10,
  top: 12,
  bottom: -12,
  near: 1,
  far: 40,
});
key.shadow.normalBias = 0.02;
key.shadow.bias = -0.0002;
scene.add(key);
const court = createCourt(scene),
  players = new Players(scene, store.step.players),
  ball = new BallView(scene);
const shutter = new ShutterGhosts(scene, players.paddles, ball.ball);
const playbackClock = new PlaybackClock(), renderClock = new PlaybackRenderClock();
let currentTrajectory: Trajectory | undefined;
let shotKey = "";
let lastIncomingKey = "";
let restingTime: number | undefined;
let restingPoseTime: number | undefined;
let restingPlayers: Player[] | undefined;
let dirty = true;
let cameraPreset = "perspective";
let session:
  | {
      clips: Clip[];
      elapsed: number;
      preview: boolean;
      paused: boolean;
      initial: Player[];
    }
  | undefined;
let dragging: PlayerId | undefined;
let pointerStart: { x: number; y: number } | undefined;
let activePointer: number | undefined;
let frame = 0;
let lastTime = 0;
const renderStats = { renders: 0, cpuMs: 0, calls: 0, triangles: 0, elapsed: 0, playing: false };
if (import.meta.env.DEV) Object.assign(window, { __courtDebug: { stats: renderStats, renderer, shutter, fps: PLAYBACK_FPS } });
function invalidate() {
  dirty = true;
  requestFrame();
}
function requestFrame() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
}
controls.addEventListener("change", invalidate);
function fitCourt() {
  camera.updateMatrixWorld();
  const all = store.scenario.steps.flatMap((s) => s.players);
  const boundX = Math.max(3.3, ...all.map((p) => Math.abs(p.x) + 0.4));
  const boundZ = Math.max(6.9, ...all.map((p) => Math.abs(p.z) + 0.4));
  for (let i = 0; i < 8; i++) {
    let extent = 0;
    for (const x of [-boundX, boundX])
      for (const z of [-boundZ, boundZ])
        for (const y of [0, 2.9]) {
          const p = new THREE.Vector3(x, y, z).project(camera);
          extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
        }
    if (extent <= 0.84) break;
    camera.position
      .sub(controls.target)
      .multiplyScalar(extent / 0.84)
      .add(controls.target);
    camera.updateMatrixWorld();
  }
  controls.update();
}
function previewFullscreenActive() {
  return (
    document.fullscreenElement === container.parentElement ||
    container.parentElement?.classList.contains("pseudo-fullscreen") === true
  );
}
function syncPreviewFullscreenButton() {
  const button = $<HTMLButtonElement>("fullscreen-toggle"),
    active = previewFullscreenActive();
  button.innerHTML = active ? icons.compress : icons.expand;
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", active ? "Thoát toàn màn hình" : "Toàn màn hình");
  button.title = active ? "Thoát toàn màn hình" : "Toàn màn hình";
  invalidate();
}
async function togglePreviewFullscreen() {
  const viewport = container.parentElement!;
  if (previewFullscreenActive()) {
    if (document.fullscreenElement === viewport) await document.exitFullscreen();
    else {
      viewport.classList.remove("pseudo-fullscreen");
      document.body.classList.remove("preview-fullscreen");
    }
    syncPreviewFullscreenButton();
    return;
  }
  if (viewport.requestFullscreen) {
    try {
      await viewport.requestFullscreen({ navigationUI: "hide" });
      return;
    } catch {
      // Some mobile browsers deny element fullscreen; use the viewport fallback.
    }
  }
  viewport.classList.add("pseudo-fullscreen");
  document.body.classList.add("preview-fullscreen");
  syncPreviewFullscreenButton();
}
document.addEventListener("fullscreenchange", syncPreviewFullscreenButton);
function preset(name: string) {
  cameraPreset = name;
  const narrow = container.clientWidth < 650;
  const positions: Record<string, number[]> = {
    perspective: narrow ? [13.5, 18, 19] : [11.5, 15.5, 17],
    top: [0, 24, 0.001],
    baseline: [0, 5.5, 20],
    side: [20, 7, 0],
  };
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  camera.position.fromArray(positions[name] ?? positions.perspective);
  controls.target.set(0, 0, 0);
  controls.update();
  fitCourt();
  document.querySelectorAll<HTMLButtonElement>("[data-camera]").forEach((b) => {
    b.classList.toggle("active", b.dataset.camera === name);
    b.setAttribute("aria-pressed", String(b.dataset.camera === name));
  });
  invalidate();
}
new ResizeObserver(() => {
  const w = container.clientWidth,
    h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  fitCourt();
  invalidate();
}).observe(container);
preset("perspective");
function ensureShot(): Shot {
  if (!store.step.shot) {
    const p = store.step.players.find((p) => p.id === store.selected)!;
    store.step.shot = {
      hitter: p.id,
      from: { x: p.x, y: 0.8, z: p.z },
      to: { x: -p.x, z: p.z >= 0 ? -4.3 : 4.3 },
      type: "drive",
      apex: 1.1,
      volley: false,
      finish: false,
      spin: { type: "none", strength: 0 },
      topspin: false,
      autoBounce: true,
    };
  }
  return store.step.shot;
}
function stop() {
  restingTime = undefined;
  restingPoseTime = undefined;
  restingPlayers = undefined;
  session = undefined;
  store.playing = false;
  playbackClock.reset(); shutter.clear();
  lastTime = 0;
  ball.group.visible = !!currentTrajectory;
}
function edit(fn: () => void) {
  stop();
  fn();
}
function fmtTime(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}
function updateClock() {
  const duration =
    session?.clips.at(-1)?.end ?? buildClips(store.scenario).at(-1)?.end ?? 0;
  $("time-readout").textContent =
    `${fmtTime(session?.elapsed ?? 0)} / ${fmtTime(duration)}`;
}
function refresh() {
  simplifyShots();
  const step = store.step;
  if (!session) players.update(restingPlayers ?? step.players);
  if (step.shot) store.selected = step.shot.hitter;
  players.select(store.selected);
  if (!session)
    players.poseShot(
      step.shot,
      restingPlayers ?? step.players,
      restingPoseTime ?? restingTime,
    );
  const activeClip = session?.clips.find((c) => c.index === store.index);
  const standalone = buildPreviewClip(store.scenario, store.index);
  const displayTrajectory = activeClip?.trajectory ?? standalone.trajectory;
  const outgoingCatch = activeClip?.intercepted ?? standalone.intercepted;
  const nextKey = JSON.stringify([
    standalone.shot,
    displayTrajectory?.duration,
    outgoingCatch?.point,
  ]);
  if (nextKey !== shotKey) {
    restingTime = undefined;
    restingPoseTime = undefined;
    restingPlayers = undefined;
    shotKey = nextKey;
    currentTrajectory = displayTrajectory;
    ball.set(currentTrajectory);
  }
  if (!session && currentTrajectory && restingTime === undefined)
    ball.at(currentTrajectory, 0);
  court.setKitchen(!!currentTrajectory?.kitchen);
  if (document.activeElement !== $("scenario-name"))
    $<HTMLInputElement>("scenario-name").value = store.scenario.name;
  if (document.activeElement !== $("note"))
    $<HTMLTextAreaElement>("note").value = step.note ?? "";
  $("step-counter").textContent =
    `${String(store.index + 1).padStart(2, "0")} / ${String(store.scenario.steps.length).padStart(2, "0")}`;
  document.querySelectorAll<HTMLButtonElement>("[data-player]").forEach((b) => {
    b.classList.toggle("active", b.dataset.player === store.selected);
    b.setAttribute("aria-pressed", String(b.dataset.player === store.selected));
    b.disabled = store.playing;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach((b) => {
    b.classList.toggle("active", b.dataset.shot === step.shot?.type);
    b.setAttribute("aria-pressed", String(b.dataset.shot === step.shot?.type));
    b.disabled = store.playing;
  });
  const p = step.players.find((p) => p.id === store.selected)!;
  $("coordinates").textContent =
    `${p.id}  /  X ${p.x.toFixed(2)} m  ·  Z ${p.z.toFixed(2)} m`;
  const s = step.shot;
  const previous =
    store.index > 0 ? store.scenario.steps[store.index - 1].shot : undefined;
  const interception =
    s?.volley && previous ? findVolleyContact(previous, p) : undefined;
  const incomingKey = JSON.stringify([previous, interception?.point]);
  if (incomingKey !== lastIncomingKey) {
    lastIncomingKey = incomingKey;
    ball.setIncoming(interception?.incoming, interception?.time);
  }
  ball.target.visible =
    !!currentTrajectory && currentTrajectory.result !== "NET" && !outgoingCatch;
  ball.setInterceptPoint(interception?.point ?? outgoingCatch?.point);
  const stroke = s ? strokeSide(p, s) : undefined;
  $("stroke-side").textContent =
    stroke?.kind === "forehand"
      ? "Forehand"
      : stroke?.kind === "backhand"
        ? "Backhand"
        : "Chính giữa";
  $("stroke-side").className = `stroke-badge ${stroke?.kind ?? ""}`;
  $("shot-help").textContent = s
    ? SHOT_HINTS[s.type]
    : "Chọn một loại cú để bắt đầu.";
  if (document.activeElement !== $("apex"))
    $<HTMLInputElement>("apex").value = s ? String(s.apex) : "";
  if (document.activeElement !== $("height"))
    $<HTMLInputElement>("height").value = s
      ? interception
        ? s.from.y.toFixed(3)
        : String(s.from.y)
      : "";
  $<HTMLInputElement>("apex").min = String(s?.from.y ?? 0.8);
  $<HTMLInputElement>("volley").checked = s?.volley ?? false;
  $<HTMLInputElement>("finish").checked = s?.finish ?? false;
  $<HTMLInputElement>("topspin").checked = !!s && shotSpin(s).type === "top";
  const result = $("result");
  result.replaceChildren();
  const title = document.createElement("div");
  title.className = "result-title";
  const detail = document.createElement("div");
  detail.className = "result-detail";
  if (currentTrajectory && s) {
    const tr = currentTrajectory;
    title.classList.toggle("bad", tr.result !== "OK");
    const status = document.createElement("span");
    status.textContent =
      tr.result === "OK"
        ? "● Qua lưới / trong sân"
        : tr.result === "NET"
          ? "● Chạm lưới"
          : "● OUT / ngoài sân";
    if (tr.result === "OK" && tr.netClearance === null)
      status.textContent =
        s.type === "atp"
          ? "● ATP / vòng cột lưới"
          : "● Trong sân / không qua lưới";
    if (outgoingCatch) status.textContent = "● Được chặn trước khi nảy";
    const region = document.createElement("span");
    region.textContent = outgoingCatch ? "VOLLEY" : tr.kitchen ? "KITCHEN" : "";
    title.append(status, region);
    detail.textContent = `Điểm rơi  ${s.to.x.toFixed(2)}, ${s.to.z.toFixed(2)} m · Bay ${tr.flightTime.toFixed(2)} s${tr.netClearance !== null ? ` · Lưới ${tr.netClearance >= 0 ? "+" : ""}${(tr.netClearance * 100).toFixed(1)} cm` : ""}`;
    if (outgoingCatch)
      detail.textContent = `Điểm chặn ${outgoingCatch.point.x.toFixed(2)}, ${outgoingCatch.point.z.toFixed(2)} m · cao ${outgoingCatch.point.y.toFixed(2)} m`;
    result.append(title, detail);
    const physics = document.createElement("div");
    physics.className = "result-detail";
    physics.textContent = `${shotSpin(s).type === "top" ? "Topspin · " : ""}${outgoingCatch ? "Bóng được trả trước khi nảy" : `Nảy dự đoán ${tr.bounceHeight.toFixed(2)} m`}`;
    result.append(physics);
    if (interception) {
      const el = document.createElement("div");
      el.className = "result-detail";
      el.textContent = `Volley: chặn bóng trước nảy · cao ${interception.point.y.toFixed(2)} m · cách người ${interception.distance.toFixed(2)} m`;
      result.append(el);
    } else if (s.volley && previous) {
      const el = document.createElement("div");
      el.className = "result-warning";
      el.textContent =
        "Không có điểm volley trên đường bóng tới đội nhận. Kiểm tra cú trước và người đánh.";
      result.append(el);
    }
    if (outgoingCatch) {
      const el = document.createElement("div");
      el.className = "result-detail";
      el.textContent = `${outgoingCatch.receiver} chặn cú này trước khi bóng chạm đất.`;
      result.append(el);
    }
    if (tr.bounceOut && tr.result === "OK") {
      const note = document.createElement("div");
      note.className = "result-warning";
      note.textContent = "Điểm rơi trong sân · bóng nảy vượt biên.";
      result.append(note);
    }
    if (stroke && !stroke.reachable) {
      const note = document.createElement("div");
      note.className = "result-warning";
      note.textContent = "Bóng ngoài tầm với: đưa người gần điểm tiếp xúc hơn.";
      result.append(note);
    }
    if (s.type === "dink" && tr.result === "NET") {
      const note = document.createElement("div");
      note.className = "result-warning";
      note.textContent =
        "Dink quá sát lưới: đưa điểm tiếp xúc gần lưới hoặc tăng chiều cao.";
      result.append(note);
    }
    for (const warning of tr.warnings) {
      const el = document.createElement("div");
      el.className = "result-warning";
      el.textContent = warning;
      result.append(el);
    }
  } else {
    title.textContent = "Chưa có cú đánh";
    detail.textContent = "Chọn loại cú và đặt điểm rơi để bắt đầu.";
    result.append(title, detail);
  }
  $<HTMLButtonElement>("pick-target").classList.toggle("active", store.picking);
  $("hint").textContent = store.playing
    ? session?.preview
      ? "Đang xem cú đánh riêng"
      : "Đang phát kịch bản · bấm Pause để tạm dừng"
    : store.picking
      ? "Chạm sân hoặc vùng ngoài sân để đặt điểm rơi · Esc để hủy"
      : store.mode === "edit"
        ? "Nháy đúp chọn người đánh · kéo người để di chuyển · bấm sân đặt điểm rơi"
        : "Kéo để xoay sân · cuộn hoặc chụm hai ngón để zoom";
  controls.enableRotate = store.mode === "view" && !store.picking && !dragging;
  for (const [id, mode] of [
    ["edit-mode", "edit"],
    ["view-mode", "view"],
  ]) {
    $(id).classList.toggle("active", store.mode === mode);
    $(id).setAttribute("aria-pressed", String(store.mode === mode));
  }
  for (const id of [
    "apex",
    "height",
    "volley",
    "finish",
    "topspin",
    "note",
    "scenario-name",
    "pick-target",
    "clear-shot",
    "import",
  ])
    $<HTMLInputElement>(id).disabled = store.playing;
  $<HTMLInputElement>("height").disabled = store.playing || !!interception;
  if (interception && !store.playing && !store.picking && store.mode === "edit")
    $("hint").textContent =
      "Volley: kéo người nhận để chọn điểm chặn trên đường bóng tới · bấm sân đặt điểm trả";
  $<HTMLButtonElement>("preview-shot").disabled = store.playing || !s;
  const sequencePlaying = store.playing && !session?.preview;
  for (const id of ["play", "preview-play"]) {
    $(id).innerHTML = sequencePlaying ? icons.pause : icons.play;
    $(id).setAttribute(
      "aria-label",
      sequencePlaying ? "Tạm dừng kịch bản" : "Phát toàn bộ kịch bản",
    );
  }
  $("play-state").textContent = store.playing
    ? "Đang phát"
    : session?.paused
      ? "Tạm dừng"
      : "Sẵn sàng";
  $<HTMLButtonElement>("previous").disabled =
    store.playing || store.index === 0;
  $<HTMLButtonElement>("next").disabled =
    store.playing || store.index === store.scenario.steps.length - 1;
  renderTimeline(store, (index) => edit(() => store.select(index)));
  updateClock();
  invalidate();
}
store.subscribe(refresh);
players.ready
  .then(refresh)
  .catch(() => toast("Không tải được mô hình người chơi. Hãy tải lại trang."));
function startPlayback(preview = false) {
  if (store.playing && session?.preview === preview) {
    session.elapsed = Math.min(playbackClock.pause(performance.now()/1000),session.clips.at(-1)!.end);
    shutter.clear();
    store.playing = false;
    if (session) session.paused = true;
    refresh();
    return;
  }
  if (!session || session.preview !== preview) {
    restingTime = undefined;
    if (!preview) store.index = 0;
    const fullClips = buildClips(store.scenario);
    const clips = preview
      ? [buildPreviewClip(store.scenario, store.index)]
      : fullClips;
    playbackClock.reset(); shutter.clear();
    session = {
      clips,
      elapsed: 0,
      preview,
      paused: false,
      initial: clone(store.step.players),
    };
  }
  session.paused = false;
  playbackClock.resume(performance.now()/1000);
  renderClock.reset(performance.now());
  store.playing = true;
  store.picking = false;

  lastTime = 0;
  refresh();
  requestFrame();
}
function tick(time: number) {
  const cpuStart = performance.now();
  frame = 0;
  lastTime = time;
  const cameraMoving = controls.update();
  if (session && store.playing)
    session.elapsed = Math.min(playbackClock.sample(time/1000),session.clips.at(-1)!.end);
  const due = renderClock.due(time,store.playing,dirty || cameraMoving);
  if (!due) { if (store.playing || cameraMoving) requestFrame(); return; }
  if (session && (store.playing || dirty || cameraMoving)) {
    const clip =
      session.clips.find((c) => session!.elapsed < c.end) ??
      session.clips.at(-1)!;
    if (store.index !== clip.index) {
      store.index = clip.index;
      refresh();
      $("steps")
        .querySelector(".active")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    const local = session.elapsed - clip.start;
    const previous =
      clip.startPlayers ??
      (clip.index > session.clips[0].index
        ? store.scenario.steps[clip.index - 1].players
        : session.initial);
    const poses = sampleClipPlayers(
      previous,
      store.step.players,
      clip,
      local,
      store.step.shot?.hitter,
    );
    players.update(poses);
    players.poseShot(
      store.step.shot,
      poses,
      local - clip.move,
      session.elapsed,
      clip.move,
      clip.previousMotion
        ? {
            shot: clip.previousMotion.shot,
            time: session.elapsed - clip.previousMotion.contactClock,
            preparation: clip.previousMotion.preparation,
          }
        : undefined,
    );
    const ballPosition = sampleClipBall(clip, local);
    ball.group.visible = !!ballPosition;
    if (ballPosition)
      ball.ball.position.set(ballPosition.x, ballPosition.y, ballPosition.z);
    if (clip.incoming && local < clip.move)
      ball.rotate(clip.incoming.trajectory, clip.incoming.fromTime + local);
    else ball.rotate(clip.trajectory, Math.max(0, local - clip.move));
    updateClock();
    dirty = true;
    if (session.elapsed >= session.clips.at(-1)!.end) {
      restingTime = clip.trajectory?.duration;
      restingPoseTime = local - clip.move;
      restingPlayers = clone(poses);
      session = undefined;
      store.playing = false;
      playbackClock.reset(); shutter.clear();
      lastTime = 0;
      refresh();
      toast("Đã phát xong.");
    }
  }
  if (dirty || cameraMoving || store.playing) {
    shutter.update(session?.elapsed ?? 0,store.playing);
    renderer.render(scene, camera);
    Object.assign(renderStats, { renders: renderStats.renders + 1, cpuMs: performance.now() - cpuStart,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      elapsed: session?.elapsed ?? 0, playing: store.playing });
    dirty = false;
  }
  if (store.playing || cameraMoving) requestFrame();
  else lastTime = 0;
}
// Pointer capture prevents a drag from sticking when leaving the canvas.
const raycaster = new THREE.Raycaster(),
  plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hit = new THREE.Vector3();
function point(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  return raycaster.ray.intersectPlane(plane, hit);
}
let pointerMoved = false;
let lastPlayerTap:
  { id: PlayerId; time: number; x: number; y: number } | undefined;
function chooseHitter(id: PlayerId) {
  edit(() =>
    store.edit(() => {
      store.selected = id;
      const shot = ensureShot();
      const player = store.step.players.find((p) => p.id === id)!;
      shot.hitter = id;
      const previous =
        store.index > 0
          ? store.scenario.steps[store.index - 1].shot
          : undefined;
      shot.from = receiveContact(
        previous,
        player,
        shot.type,
        shot.groundContactHeight ?? shot.from.y,
        !!shot.volley,
      );
      shot.apex = Math.max(shot.apex, shot.from.y);
      shot.contactFixed = !!previous;
      fitDink(shot);
    }),
  );
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (
    store.playing ||
    e.button !== 0 ||
    activePointer !== undefined ||
    (store.mode !== "edit" && !store.picking)
  )
    return;
  point(e);
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerMoved = false;
  const picked = raycaster.intersectObjects(players.pickables, false)[0];
  dragging = picked?.object.userData.id as PlayerId | undefined;
  activePointer = e.pointerId;
  renderer.domElement.setPointerCapture(e.pointerId);
  controls.enabled = false;
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerId !== activePointer || !pointerStart) return;
  if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) {
    pointerMoved = true;
    lastPlayerTap = undefined;
  }
  if (!pointerMoved || !dragging || store.mode !== "edit") return;
  const p = point(e);
  if (!p) return;
  stop();
  const pos = snapPlayer(p.x, p.z);
  store.edit((step) => {
    Object.assign(
      step.players.find((p) => p.id === dragging)!,
      pos,
    );
    if (step.shot && step.shot.hitter === dragging) {
      const p = step.players.find((p) => p.id === dragging)!;
      const previous =
        store.index > 0
          ? store.scenario.steps[store.index - 1].shot
          : undefined;
      step.shot.from = receiveContact(
        previous,
        p,
        step.shot.type,
        step.shot.groundContactHeight ?? step.shot.from.y,
        !!step.shot.volley,
      );
      step.shot.apex = Math.max(step.shot.apex, step.shot.from.y);
      step.shot.contactFixed = !!previous;
      fitDink(step.shot);
    }
  });
});
function release(e: PointerEvent, cancel = false) {
  if (e.pointerId !== activePointer) return;
  if (!cancel && !pointerMoved && pointerStart) {
    if (dragging) {
      const now = performance.now();
      if (
        lastPlayerTap?.id === dragging &&
        now - lastPlayerTap.time <= 350 &&
        Math.hypot(e.clientX - lastPlayerTap.x, e.clientY - lastPlayerTap.y) <=
          16
      ) {
        chooseHitter(dragging);
        lastPlayerTap = undefined;
      } else {
        lastPlayerTap = { id: dragging, time: now, x: e.clientX, y: e.clientY };
      }
    } else {
      lastPlayerTap = undefined;
      const p = point(e);
      if (p && Math.abs(p.x) <= 30 && Math.abs(p.z) <= 30) {
        const dest = {
          x: Math.round(p.x * 100) / 100,
          z: Math.round(p.z * 100) / 100,
        };
        stop();
        store.picking = false;

        store.edit(() => {
          const s = ensureShot();
          s.to = dest;
          fitDink(s);
        });
      }
    }
  } else lastPlayerTap = undefined;
  if (dragging) fitCourt();
  dragging = undefined;
  pointerStart = undefined;
  activePointer = undefined;
  controls.enabled = true;
  if (renderer.domElement.hasPointerCapture(e.pointerId))
    renderer.domElement.releasePointerCapture(e.pointerId);
  refresh();
}
renderer.domElement.addEventListener("pointerup", (e) => release(e));
renderer.domElement.addEventListener("pointercancel", (e) => release(e, true));
renderer.domElement.addEventListener("lostpointercapture", () => {
  dragging = undefined;
  activePointer = undefined;
  pointerStart = undefined;
  controls.enabled = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (container.parentElement?.classList.contains("pseudo-fullscreen"))
      void togglePreviewFullscreen();
    store.picking = false;

    refresh();
  }
});
document.addEventListener("visibilitychange", () => {
  lastTime = 0;
  if (!document.hidden) invalidate();
});
document
  .querySelectorAll<HTMLButtonElement>("[data-camera]")
  .forEach((b) => (b.onclick = () => preset(b.dataset.camera!)));
$("fullscreen-toggle").onclick = () => void togglePreviewFullscreen();
$("preview-play").onclick = () => startPlayback(false);
$("edit-mode").onclick = () => {
  store.mode = "edit";
  refresh();
};
$("view-mode").onclick = () => {
  store.mode = "view";
  store.picking = false;

  refresh();
};
document
  .querySelectorAll<HTMLButtonElement>("[data-player]")
  .forEach(
    (b) => (b.onclick = () => chooseHitter(b.dataset.player as PlayerId)),
  );
document.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach(
  (b) =>
    (b.onclick = () =>
      edit(() =>
        store.edit(() => {
          const s = ensureShot();
          s.type = b.dataset.shot as ShotType;
          const p = store.step.players.find((p) => p.id === s.hitter)!;
          const previous =
            store.index > 0
              ? store.scenario.steps[store.index - 1].shot
              : undefined;
          s.volley = VOLLEY_TYPES.has(s.type);
          s.groundContactHeight = DEFAULT_HEIGHT[s.type];
          s.from = receiveContact(
            previous,
            p,
            s.type,
            DEFAULT_HEIGHT[s.type],
            !!s.volley,
          );
          s.contactFixed = !!previous;
          s.apex = Math.max(DEFAULT_APEX[s.type], s.from.y);
          s.volley = VOLLEY_TYPES.has(s.type);
          s.topspin = defaultSpin(s.type).type === "top";
          s.autoBounce = true;
          fitDink(s);
        }),
      )),
);
$("pick-target").onclick = () =>
  edit(() => {
    store.picking = !store.picking;

    refresh();
    if (store.picking && window.matchMedia("(max-width: 700px)").matches) {
      container.parentElement?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    }
  });
for (const field of ["apex", "height"])
  $<HTMLInputElement>(field).onchange = () => {
    const input = $<HTMLInputElement>(field),
      value = Number(input.value);
    if (
      !input.value ||
      !Number.isFinite(value) ||
      value > 12 ||
      value <
        (field === "apex"
          ? (store.step.shot?.from.y ?? 0.8)
          : COURT.ballRadius) ||
      (field === "apex" && value <= COURT.ballRadius)
    ) {
      toast("Chiều cao không hợp lệ (tối đa 12 m).");
      input.value = String(
        field === "apex"
          ? (store.step.shot?.apex ?? 1.1)
          : (store.step.shot?.from.y ?? 0.8),
      );
      return;
    }
    edit(() =>
      store.edit(() => {
        const s = ensureShot();
        if (field === "apex") s.apex = value;
        else {
          s.from.y = value;
          s.groundContactHeight = value;
          s.apex = Math.max(s.apex, value);
          fitDink(s);
        }
      }),
    );
  };
$<HTMLInputElement>("volley").onchange = () =>
  edit(() =>
    store.edit(() => {
      const s = ensureShot(),
        checked = $<HTMLInputElement>("volley").checked;
      if (checked && !s.volley) s.groundContactHeight = s.from.y;
      s.volley = checked;
      const previous =
        store.index > 0
          ? store.scenario.steps[store.index - 1].shot
          : undefined;
      const player = store.step.players.find((p) => p.id === s.hitter)!;
      s.from = receiveContact(
        previous,
        player,
        s.type,
        s.groundContactHeight ?? DEFAULT_HEIGHT[s.type],
        checked,
      );
      s.apex = Math.max(s.apex, s.from.y);
      fitDink(s);
    }),
  );
$<HTMLInputElement>("finish").onchange = () =>
  edit(() =>
    store.edit(() => {
      ensureShot().finish = $<HTMLInputElement>("finish").checked;
    }),
  );
$<HTMLInputElement>("topspin").onchange = () =>
  edit(() =>
    store.edit(() => {
      const s = ensureShot();
      s.topspin = $<HTMLInputElement>("topspin").checked;
      s.autoBounce = true;
      fitDink(s);
    }),
  );
$<HTMLTextAreaElement>("note").oninput = () =>
  edit(() =>
    store.edit((s) => (s.note = $<HTMLTextAreaElement>("note").value)),
  );
$<HTMLInputElement>("scenario-name").oninput = () =>
  edit(() => {
    store.scenario.name = $<HTMLInputElement>("scenario-name").value;
    store.emit(true);
  });
$("clear-shot").onclick = () => edit(() => store.edit((s) => delete s.shot));
$("preview-shot").onclick = () => startPlayback(true);
$("play").onclick = () => startPlayback(false);
$("previous").onclick = () => edit(() => store.select(store.index - 1));
$("next").onclick = () => edit(() => store.select(store.index + 1));
$("reset").onclick = () => edit(() => store.select(0));
$("add-step").onclick = () => edit(() => store.add());
$("duplicate").onclick = () => edit(() => store.add(true));
$("delete-step").onclick = () => edit(() => store.remove());
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(store.scenario, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${store.scenario.name.replace(/[^\p{L}\p{N}_-]+/gu, "-") || "courtside"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Đã xuất kịch bản JSON.");
};
$("import").onclick = () => $<HTMLInputElement>("file-input").click();
$<HTMLInputElement>("file-input").onchange = async () => {
  const input = $<HTMLInputElement>("file-input"),
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error("Tệp vượt quá 1 MB.");
    const data = parseScenario(await file.text());
    edit(() => store.load(data));
    toast("Đã tải kịch bản.");
  } catch (e) {
    toast((e as Error).message);
  } finally {
    input.value = "";
  }
};
$("share").onclick = () => {
  const hash = `#s=${encodeScenario(store.scenario)}`;
  history.replaceState(null, "", location.pathname + location.search + hash);
  $<HTMLTextAreaElement>("share-url").value = location.href;
  $<HTMLDialogElement>("share-dialog").showModal();
};
$("copy-link").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      $<HTMLTextAreaElement>("share-url").value,
    );
    toast("Đã sao chép link.");
  } catch {
    $<HTMLTextAreaElement>("share-url").select();
    toast("Hãy sao chép link đã chọn.");
  }
};
window.addEventListener("hashchange", () => {
  if (!location.hash) return;
  try {
    const data = decodeScenario(location.hash);
    edit(() => store.load(data));
    toast("Đã mở kịch bản từ link.");
  } catch (e) {
    toast((e as Error).message);
  }
});
refresh();
if (store.startupMessage) toast(store.startupMessage);
