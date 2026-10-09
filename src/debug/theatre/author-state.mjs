// Bootstraps state.json (Theatre.js project state) from pose-to-pose key tables.
//   node src/debug/theatre/author-state.mjs
// After the first edit in Theatre studio, the exported JSON is the source of truth; this script
// only exists to show how the initial keys were authored (and to regenerate them from scratch —
// which overwrites any studio edits that were saved back into state.json).
//
// Body frame: x = right, y = up, z = forward (toward the net); metres / degrees.
// Times are frames at 24 fps. Each pose sets some props; a prop gets a key at every pose that sets
// it, shifted by that pose's per-object offset (kinetic chain: hips lead, hand lags).
// `ease` is the curve of the segment that ARRIVES at the pose; a single prop can override it with
// a [value, ease] tuple. Eases become Theatre cubic-bézier keyframe handles.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FPS = 24;
/** cubic-bezier(x1, y1, x2, y2) of a segment: x1/y1 = left key's out handle, x2/y2 = right key's in. */
const EASE = {
  io: [0.42, 0, 0.58, 1], // slow-out / slow-in (pose to pose)
  soft: [0.3, 0, 0.7, 1], // gentler slow-in/out (drift during a held finish)
  in: [0.45, 0, 0.8, 0.6], // accelerate into the key (≈2× average speed at the key)
  out: [0.2, 0.4, 0.55, 1], // leave fast (≈2× average speed), settle slowly
  land: [0.5, 0, 0.9, 0.5], // gravity: accelerate into a landing / foot plant
  start: [0.5, 0, 0.65, 0.6], // from rest up to cruise speed (≈1.15× average at the key)
  stop: [0.35, 0.4, 0.5, 1], // from cruise speed to rest
  lin: [1 / 3, 1 / 3, 2 / 3, 2 / 3], // constant speed (keeps velocity through a key)
};

// Must match the prop defaults in controls.ts (kitchen ready pose).
const P = "Body / Pelvis",
  C = "Body / Chest",
  H = "Body / Head",
  R = "Arms / Paddle hand R",
  L = "Arms / Hand L",
  FL = "Legs / Foot L",
  FR = "Legs / Foot R";
const READY = {
  [P]: { "pos.x": 0, "pos.y": -0.1, "pos.z": -0.02, yaw: 0, pitch: 10 },
  [C]: { yaw: 0, pitch: 12, roll: 0 },
  [H]: { yaw: 0, pitch: 8 },
  // Backhand-ready: paddle in front, head up-forward toward the backhand side (11 o'clock),
  // backhand face toward the net; this is also the low-strain wrist pose for the continental grip.
  [R]: {
    "grip.x": 0.1,
    "grip.y": 1.02,
    "grip.z": 0.3,
    "paddle.yaw": -150,
    "paddle.pitch": -20,
    "paddle.roll": 50,
    elbow: 55,
  },
  [L]: { "wrist.x": -0.12, "wrist.y": 1.0, "wrist.z": 0.3, elbow: 35 },
  [FL]: { x: -0.3, z: 0, yaw: 12, heel: 0, lift: 0 },
  [FR]: { x: 0.3, z: -0.02, yaw: 12, heel: 0, lift: 0 },
};

/**
 * One foot step: planted at `from` until `fs`, swings (peak lift `h` at the midpoint), planted at
 * `to` from `fe`. Horizontal motion is one ease-in-out across the swing; the lift rises fast and
 * falls into the plant.
 */
function step(F, fs, fe, from, to, h) {
  const fp = (fs + fe) / 2;
  const mid = (k) => [(from[k] + to[k]) / 2, "in"];
  return [
    { name: `${F} lift-off`, f: fs, set: { [F]: { x: from.x, z: from.z, yaw: from.yaw, lift: 0 } } },
    {
      name: `${F} swing`,
      f: fp,
      set: { [F]: { x: mid("x"), z: mid("z"), yaw: mid("yaw"), lift: [h, "out"] } },
    },
    {
      name: `${F} plant`,
      f: fe,
      set: { [F]: { x: [to.x, "out"], z: [to.z, "out"], yaw: [to.yaw, "out"], lift: [0, "land"] } },
    },
  ];
}
const planted = (F) => ({ x: READY[F].x, z: READY[F].z, yaw: READY[F].yaw });

// ---------------------------------------------------------------------------------------------------
// (a) Forehand dink at the kitchen line: right foot steps toward the ball, deep knee bend, short
// low backswing (≤ 0.15 m), push/lift from the shoulder, pelvis does not rise through contact.
// Timing (technique-research E1, contact = f20): load −0.21 s, contact, follow +0.21, settle +0.38.
const DINK_STEP = { x: 0.42, z: 0.18, yaw: 22 };
const dink = {
  length: 40,
  poses: [
    { name: "ready", f: 0, set: READY },
    {
      name: "anticipation",
      f: 5,
      set: {
        [P]: { "pos.x": 0.03, "pos.y": -0.14, "pos.z": -0.03, yaw: 6, pitch: 13 },
        [C]: { yaw: 6, pitch: 18, roll: 2 },
        [H]: { pitch: 14 },
        [R]: {
          "grip.x": 0.26,
          "grip.y": 0.9,
          "grip.z": 0.38,
          "paddle.yaw": -40,
          "paddle.pitch": 10,
          "paddle.roll": 40,
          elbow: 20,
        },
        [L]: { "wrist.x": -0.22, "wrist.y": 0.95, "wrist.z": 0.3, elbow: 30 },
      },
      offsets: { [R]: 1, [L]: 1 },
    },
    // Right foot steps forward-right toward the ball and plants before the load.
    ...step(FR, 4, 12, planted(FR), DINK_STEP, 0.05),
    {
      name: "load",
      f: 15,
      set: {
        [P]: { "pos.x": 0.09, "pos.y": -0.25, "pos.z": 0.03, yaw: 9, pitch: 17 },
        [C]: { yaw: 10, pitch: 26, roll: 5 },
        [H]: { yaw: 6, pitch: 30 },
        [R]: {
          "grip.x": 0.35,
          "grip.y": 0.7,
          "grip.z": 0.42,
          "paddle.yaw": -10,
          "paddle.pitch": 30,
          "paddle.roll": -30,
          elbow: 5,
        },
        [L]: { "wrist.x": -0.4, "wrist.y": 0.86, "wrist.z": 0.22, elbow: 28 },
        [FL]: { heel: 8 },
      },
      offsets: { [P]: -1, [R]: 1 },
    },
    {
      name: "contact",
      f: 20,
      ease: "in",
      set: {
        [P]: { "pos.x": 0.1, "pos.y": -0.25, "pos.z": 0.07, yaw: 0, pitch: 18 },
        [C]: { yaw: -3, pitch: 27, roll: 5 },
        [H]: { yaw: 4, pitch: 32 },
        [R]: {
          "grip.x": 0.31,
          "grip.y": 0.72,
          "grip.z": 0.53,
          "paddle.yaw": -10,
          "paddle.pitch": 35,
          "paddle.roll": -20,
          elbow: 0,
        },
        [L]: { "wrist.x": -0.42, "wrist.y": 0.87, "wrist.z": 0.24 },
      },
      // Kinetic chain: hips arrive 2 frames early, chest 1 frame early, the hand on the key.
      offsets: { [P]: -2, [C]: -1 },
    },
    {
      name: "follow",
      f: 25,
      ease: "out",
      set: {
        [P]: { "pos.y": -0.23, "pos.z": 0.08, yaw: -3 },
        [C]: { yaw: -6, pitch: 23 },
        [H]: { yaw: 0, pitch: 24 },
        [R]: {
          "grip.x": 0.26,
          "grip.y": 0.86,
          "grip.z": 0.63,
          "paddle.yaw": -10,
          "paddle.pitch": 20,
          "paddle.roll": 10,
          elbow: 0,
        },
        [L]: { "wrist.x": -0.38, "wrist.y": 0.9, "wrist.z": 0.25 },
        [FL]: { heel: 10 },
      },
      offsets: { [P]: -1, [L]: 1 },
    },
    {
      name: "settle",
      f: 30,
      ease: "io",
      set: {
        [P]: { "pos.x": 0.04, "pos.y": -0.16, "pos.z": 0.02, yaw: 2, pitch: 12 },
        [C]: { yaw: -1, pitch: 15, roll: 1 },
        [H]: { pitch: 12 },
        [R]: {
          "grip.x": 0.15,
          "grip.y": 1.0,
          "grip.z": 0.38,
          "paddle.yaw": -130,
          "paddle.pitch": -5,
          "paddle.roll": 60,
          elbow: 50,
        },
        [L]: { "wrist.x": -0.16, "wrist.y": 0.97, "wrist.z": 0.31, elbow: 32 },
        [FL]: { heel: 0 },
      },
      offsets: { [R]: 1, [L]: 2 },
    },
    // Two-beat recovery: the right foot steps back to the line.
    ...step(FR, 28, 34, DINK_STEP, planted(FR), 0.04),
    { name: "ready", f: 40, ease: "io", set: READY },
  ],
};

// ---------------------------------------------------------------------------------------------------
// (b) Forehand punch volley: compact (≤ 0.2 m backswing, never behind the torso plane), shoulders
// shift forward, elbow 150–170° at contact 0.45–0.6 m in front of the chest, held finish ~0.17 s.
// Timing (E1 punch, contact = f13): load −0.125, contact, follow +0.08, hold to +0.25, settle +0.46.
const punch = {
  length: 32,
  poses: [
    { name: "ready", f: 0, set: READY },
    {
      name: "anticipation",
      f: 6,
      set: {
        [P]: { "pos.y": -0.12, "pos.z": -0.03, yaw: 5 },
        [C]: { yaw: 8, pitch: 11 },
        [R]: { "grip.x": 0.24, "grip.y": 1.08, "grip.z": 0.31, elbow: 20 },
        [L]: { "wrist.x": -0.17, "wrist.y": 1.0, "wrist.z": 0.31 },
      },
      offsets: { [R]: -1 }, // the paddle leads the unit turn on the takeback
    },
    {
      name: "load",
      f: 10,
      set: {
        [P]: { "pos.x": -0.01, "pos.y": -0.125, "pos.z": -0.035, yaw: 8, pitch: 10 },
        [C]: { yaw: 14, pitch: 10 },
        [H]: { yaw: 3, pitch: 8 },
        [R]: {
          "grip.x": 0.35,
          "grip.y": 1.12,
          "grip.z": 0.27,
          "paddle.yaw": -10,
          "paddle.pitch": 10,
          "paddle.roll": 60,
          elbow: -10,
        },
        [L]: { "wrist.x": -0.24, "wrist.y": 1.0, "wrist.z": 0.32, elbow: 30 },
      },
      offsets: { [P]: -1 },
    },
    {
      name: "contact",
      f: 13,
      ease: "in",
      set: {
        [P]: { "pos.x": 0.01, "pos.y": -0.11, "pos.z": 0.05, yaw: -4, pitch: 12 },
        [C]: { yaw: -2, pitch: 14 },
        [H]: { yaw: 2, pitch: 9 },
        [R]: {
          "grip.x": 0.33,
          "grip.y": 1.08,
          "grip.z": 0.54,
          "paddle.yaw": -10,
          "paddle.pitch": 5,
          "paddle.roll": 50,
          elbow: -10,
        },
        [L]: { "wrist.x": -0.3, "wrist.y": 0.98, "wrist.z": 0.28 },
      },
      offsets: { [P]: -2, [C]: -1 },
    },
    {
      name: "follow",
      f: 15,
      ease: "out",
      set: {
        [P]: { "pos.z": 0.07, yaw: -6 },
        [C]: { yaw: -6, pitch: 15 },
        [R]: {
          "grip.x": 0.31,
          "grip.y": 1.04,
          "grip.z": 0.59,
          "paddle.yaw": -10,
          "paddle.pitch": 10,
          "paddle.roll": 30,
          elbow: -10,
        },
        [L]: { "wrist.x": -0.32, "wrist.y": 0.97, "wrist.z": 0.26 },
      },
      offsets: { [P]: -1, [L]: 1 },
    },
    {
      name: "hold",
      f: 19,
      ease: "soft",
      set: {
        [P]: { "pos.z": 0.065, yaw: -5 },
        [C]: { yaw: -5 },
        [R]: { "grip.x": 0.305, "grip.y": 1.03, "grip.z": 0.595, "paddle.pitch": 5, "paddle.roll": 32 },
      },
    },
    {
      name: "settle",
      f: 24,
      ease: "io",
      set: {
        [P]: { "pos.x": 0, "pos.y": -0.095, "pos.z": -0.025, yaw: 1, pitch: 10 },
        [C]: { yaw: 1, pitch: 12 },
        [H]: { yaw: 0, pitch: 8 },
        [R]: {
          "grip.x": 0.13,
          "grip.y": 1.06,
          "grip.z": 0.33,
          "paddle.yaw": -120,
          "paddle.pitch": 5,
          "paddle.roll": 60,
          elbow: 35,
        },
        [L]: { "wrist.x": -0.14, "wrist.y": 1.0, "wrist.z": 0.3, elbow: 35 },
      },
      // Recovery reverses the chain: the paddle leads back to ready, the hips follow.
      offsets: { [P]: 1, [R]: -1 },
    },
    { name: "ready", f: 32, ease: "io", set: READY },
  ],
};

// ---------------------------------------------------------------------------------------------------
// (c) Ready → split step (5–10 cm hop, land wide and low) → two lateral shuffle steps to the right
// (lead foot first, no crossover) → ready. Upper body stays quiet; arms lag the pelvis by 1 frame.
const PY = -0.14; // athletic pelvis height while shuffling
const W = 0.33; // half stance after the split step
const at = (F, x) => ({ x, z: READY[F].z, yaw: READY[F].yaw });
const shuffle = {
  length: 44,
  poses: [
    { name: "ready", f: 0, set: READY },
    { name: "dip", f: 4, set: { [P]: { "pos.y": -0.13, pitch: 11 } } },
    {
      name: "takeoff",
      f: 7,
      ease: "out",
      set: {
        [P]: { "pos.y": -0.07 },
        [FL]: { x: READY[FL].x, heel: 18, lift: 0 },
        [FR]: { x: READY[FR].x, heel: 18, lift: 0 },
      },
    },
    {
      name: "air",
      f: 9,
      ease: "out",
      set: {
        [P]: { "pos.y": -0.045 },
        [FL]: { x: -0.32, heel: 10, lift: 0.06 },
        [FR]: { x: 0.32, heel: 10, lift: 0.06 },
        [R]: { "grip.y": 1.04 },
        [L]: { "wrist.y": 1.02 },
      },
    },
    {
      name: "land",
      f: 11,
      ease: "land",
      set: {
        [P]: { "pos.y": -0.12, pitch: 11 },
        [FL]: { x: -W, heel: 0, lift: 0 },
        [FR]: { x: W, heel: 0, lift: 0 },
        [R]: { "grip.y": 1.03 },
        [L]: { "wrist.y": 1.01 },
      },
    },
    {
      name: "absorb",
      f: 13,
      ease: "out",
      set: {
        [P]: { "pos.y": -0.165, pitch: 13 },
        [C]: { pitch: 14 },
        [R]: { "grip.y": 0.97, elbow: 60 },
        [L]: { "wrist.y": 0.96, elbow: 40 },
      },
      offsets: { [R]: 1, [L]: 1 },
    },
    // Shuffle 1: trailing (left) leg pushes, lead (right) foot steps 0.31 m, then the left follows.
    { name: "push 1", f: 15, ease: "io", set: { [P]: { "pos.x": 0, "pos.y": PY }, [FL]: { heel: 12 } } },
    ...step(FR, 15, 19, at(FR, W), at(FR, 0.64), 0.045),
    {
      name: "R1 down",
      f: 19,
      set: { [P]: { "pos.x": [0.16, "start"], "pos.y": PY + 0.012 }, [FL]: { heel: 16 } },
    },
    ...step(FL, 20, 24, at(FL, -W), at(FL, 0.0), 0.04),
    { name: "L1 down", f: 24, set: { [P]: { "pos.x": [0.32, "lin"], "pos.y": PY }, [FL]: { heel: 0 } } },
    // Shuffle 2.
    { name: "push 2", f: 25, set: { [FL]: { heel: 10 } } },
    ...step(FR, 25, 29, at(FR, 0.64), at(FR, 0.97), 0.045),
    {
      name: "R2 down",
      f: 29,
      set: { [P]: { "pos.x": [0.48, "lin"], "pos.y": PY + 0.012 }, [FL]: { heel: 16 } },
    },
    ...step(FL, 30, 34, at(FL, 0.0), at(FL, 0.34), 0.04),
    {
      name: "L2 down",
      f: 34,
      set: { [P]: { "pos.x": [0.64, "lin"], "pos.y": PY - 0.01 }, [FL]: { heel: 0 } },
    },
    {
      name: "settle",
      f: 38,
      ease: "out",
      set: {
        [P]: { "pos.x": [0.655, "stop"], "pos.y": -0.115, pitch: 10 },
        [C]: { pitch: 12 },
      },
    },
    {
      name: "ready",
      f: 44,
      ease: "io",
      set: {
        [P]: { ...READY[P], "pos.x": 0.655 },
        [C]: READY[C],
        [H]: READY[H],
        [R]: READY[R],
        [L]: READY[L],
      },
    },
  ],
};
// Arms ride with the pelvis during the shuffle (lagging 1 frame): derive their x keys.
for (const pose of shuffle.poses) {
  const px = pose.set[P]?.["pos.x"];
  if (px === undefined) continue;
  const shift = (v0) => (Array.isArray(px) ? [v0 + px[0], px[1]] : v0 + px);
  pose.set[R] = { ...(pose.set[R] ?? {}), "grip.x": shift(READY[R]["grip.x"]) };
  pose.set[L] = { ...(pose.set[L] ?? {}), "wrist.x": shift(READY[L]["wrist.x"]) };
  if (pose.name !== "ready") pose.offsets = { ...(pose.offsets ?? {}), [R]: 1, [L]: 1 };
}

const MOTIONS = { dink, "punch-volley": punch, "split-step-shuffle": shuffle };

// ---------------------------------------------------------------------------------------------------
const id = (...parts) =>
  createHash("sha1").update(parts.join("|")).digest("base64url").slice(0, 10);

function buildSheet(name, motion) {
  /** objKey → propPath → [{f, v, ease}] */
  const tracks = {};
  for (const pose of motion.poses) {
    for (const [obj, props] of Object.entries(pose.set)) {
      const off = pose.offsets?.[obj] ?? 0;
      for (const [path, raw] of Object.entries(props)) {
        const [v, ease] = Array.isArray(raw) ? raw : [raw, pose.ease ?? "io"];
        ((tracks[obj] ??= {})[path] ??= []).push({
          f: Math.min(motion.length, Math.max(0, pose.f + off)),
          v,
          ease,
        });
      }
    }
  }
  const tracksByObject = {};
  for (const [obj, props] of Object.entries(tracks)) {
    const trackIdByPropPath = {},
      trackData = {};
    for (const [path, keys0] of Object.entries(props)) {
      keys0.sort((a, b) => a.f - b.f);
      // Merge keys that landed on the same frame (the later pose wins).
      const keys = [];
      for (const k of keys0) {
        if (keys.length && keys[keys.length - 1].f === k.f) keys[keys.length - 1] = k;
        else keys.push(k);
      }
      // Skip tracks that never change (they stay at the prop default = ready).
      if (keys.every((k) => Math.abs(k.v - keys[0].v) < 1e-9)) continue;
      const encoded = JSON.stringify(path.split("."));
      const trackId = id(name, obj, path);
      trackIdByPropPath[encoded] = trackId;
      trackData[trackId] = {
        type: "BasicKeyframedTrack",
        __debugName: `${obj}:${encoded}`,
        keyframes: keys.map((k, i) => {
          const into = EASE[k.ease] ?? EASE.io; // segment arriving here
          const next = keys[i + 1];
          const out = next ? (EASE[next.ease] ?? EASE.io) : EASE.io; // segment leaving here
          return {
            id: id(name, obj, path, i, k.f),
            // 3 decimals, like the studio: editing at a frame then updates this key instead of adding one
            position: Number((k.f / FPS).toFixed(3)),
            connectedRight: !!next,
            handles: [into[2], into[3], out[0], out[1]],
            type: "bezier",
            value: Number(k.v.toFixed(4)),
          };
        }),
      };
    }
    if (Object.keys(trackIdByPropPath).length) tracksByObject[obj] = { trackIdByPropPath, trackData };
  }
  return {
    staticOverrides: { byObject: {} },
    sequence: {
      type: "PositionalSequence",
      length: Number((motion.length / FPS).toFixed(3)),
      subUnitsPerUnit: FPS,
      tracksByObject,
    },
  };
}

const sheetsById = {};
for (const [name, motion] of Object.entries(MOTIONS)) sheetsById[name] = buildSheet(name, motion);
const body = JSON.stringify(sheetsById);
const state = {
  sheetsById,
  definitionVersion: "0.4.0",
  revisionHistory: [id("authored", body)],
};
const out = join(dirname(fileURLToPath(import.meta.url)), "state.json");
writeFileSync(out, JSON.stringify(state, null, 2) + "\n");
const tracks = Object.values(sheetsById)
  .flatMap((s) => Object.values(s.sequence.tracksByObject))
  .flatMap((o) => Object.values(o.trackData));
console.log(
  `wrote ${out}: ${Object.keys(sheetsById).length} sheets, ${tracks.length} tracks, ${tracks.reduce((n, t) => n + t.keyframes.length, 0)} keys`,
);
