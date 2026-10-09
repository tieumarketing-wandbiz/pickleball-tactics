import type { ShotType } from "./constants";
import { ease, hermite } from "./motion";
export type StrokeVector = [number, number, number]; // shot-forward, hitting-side, vertical
interface StrokeProfile {
  prepare: number;
  followTime: number;
  recover: number;
  load: StrokeVector;
  follow: StrokeVector;
  twist: number;
  squat: number;
  lean: number;
  open: number;
  wrist: number;
  turn: number;
  /** Seconds the finish is held before recovering (punch volley). */
  hold?: number;
  /** Stance is set before the swing starts (serve): body offset/stagger are not eased in. */
  setup?: boolean;
  /** Desired contact distance ahead of the body centre; the body steps back if the contact is closer. */
  reach?: number;
  /** Desired contact distance to the hitting side (serve only); the body shifts sideways to get it. */
  side?: number;
  /** Pelvis drop per unit of "low contact" (default 0.38 = 0.13 squat + 0.25 hip drop). */
  low?: number;
  /** Extra forward hip shift through contact (serve weight transfer). */
  press?: number;
  /** Trunk side-bend (rad) towards the hitting side around contact (underhand serve shoulder dip). */
  dip?: number;
  /** Hips sit back per metre of squat (deep dink). */
  sit?: number;
  /** Ankle-to-ankle stance width (default 0.4 + low contact widening). */
  width?: number;
  /** Forward offset of the dominant foot (negative = non-dominant foot leads). */
  stagger?: number;
  /** Volleys: paddle head above the wrist (tilted out ~30°), lowering only for low contacts. */
  headUp?: boolean;
  /** 0..1 blend of the paddle head towards hanging below the wrist (serve, dink). */
  headDown?: number;
  /** Extra backward paddle tilt while loading (overhead cocked behind the head). */
  cock?: number;
  /** Stance rotation (rad) turning the hitting shoulder back (side-on overhead). */
  sideOn?: number;
  /** Offset of the forward-swing breakdown pose from the load→contact chord (swing arc). */
  arc?: StrokeVector;
  /** Forward-swing duration; preparation also includes the slower ready→load transition. */
  swing?: number;
}
export const STROKE_MOTION: Record<ShotType, StrokeProfile> = {
  serve: {
    // Underhand pendulum: 0.25 s prep + 0.2 s swing, 0.3 s follow, 0.45 s recover.
    prepare: 1.25,
    followTime: 0.3,
    recover: 0.75,
    load: [-0.65, 0.08, -0.16],
    follow: [0.3, 0.04, 1.3],
    twist: 0.62,
    squat: 0.07,
    lean: 0.38,
    open: -0.26,
    wrist: 0.12,
    turn: 0.65,
    setup: true,
    reach: 0.2,
    press: 0.12,
    dip: 0.16,
    side: 0.28,
    low: 0.05,
    width: 0.5,
    stagger: -0.125,
    headDown: 1,
    arc: [0, 0.02, -0.2],
  },
  drive: {
    prepare: 1.05,
    followTime: 0.22,
    recover: 0.75,
    load: [-0.7, 0.05, 0.1],
    follow: [-0.25, -0.75, 0.65],
    twist: 0.95,
    squat: 0.1,
    lean: 0.12,
    open: 0.06,
    wrist: 0.26,
    turn: 0.65,
  },
  dink: {
    // Lower into a dink early; only the final push is fast (research C2/D5).
    prepare: 0.95,
    followTime: 0.2,
    recover: 0.6,
    load: [-0.12, 0.02, 0],
    follow: [0.18, -0.02, 0.28],
    twist: 0.04,
    squat: 0.15,
    lean: 0.72,
    open: -0.7,
    wrist: 0,
    turn: 0.2,
    reach: 0.22,
    low: 0.13,
    sit: 0.3,
    width: 0.78,
    headDown: 1,
  },
  drop: {
    prepare: 1.1,
    followTime: 0.26,
    recover: 0.8,
    load: [-0.5, 0, 0.05],
    follow: [0.25, -0.15, 0.5],
    twist: 0.5,
    squat: 0.1,
    lean: 0.07,
    open: -0.44,
    wrist: 0.06,
    turn: 0.4,
  },
  lob: {
    prepare: 1.25,
    followTime: 0.3,
    recover: 0.85,
    load: [-0.1, 0, 0],
    follow: [0, -0.2, 1.3],
    twist: 0.16,
    squat: 0.11,
    lean: 0.03,
    open: -0.87,
    wrist: 0.07,
    turn: 0.3,
  },
  volley: {
    // Early face set, compact forward push; never behind the torso.
    prepare: 0.85,
    followTime: 0.18,
    recover: 0.53,
    load: [-0.12, 0.03, 0.02],
    follow: [0.25, -0.03, 0.03],
    twist: 0.09,
    squat: 0.09,
    lean: 0.22,
    open: 0,
    wrist: 0.04,
    turn: 0.2,
    reach: 0.36,
    width: 0.56,
    headUp: true,
  },
  smash: {
    // Side-on, paddle cocked behind the head (~0.5 s), contact high in front, finish down across the body.
    prepare: 1.45,
    followTime: 0.35,
    recover: 0.85,
    load: [-0.5, 0.12, -0.5],
    follow: [0.35, -0.75, -1.35],
    twist: 0.65,
    squat: 0.05,
    lean: 0.12,
    open: 0.1,
    wrist: 0.58,
    turn: 0.75,
    reach: 0.3,
    press: 0.04,
    width: 0.52,
    cock: 1.1,
    sideOn: 0.85,
    arc: [-0.04, 0.03, 0.1],
  },
  block: {
    // Half extension, no follow-through.
    prepare: 0.9,
    followTime: 0.14,
    recover: 0.46,
    load: [0.015, 0, 0.015],
    follow: [-0.035, 0, -0.015],
    twist: 0.02,
    squat: 0.1,
    lean: 0.2,
    open: -0.18,
    wrist: 0,
    turn: 0.15,
    reach: 0.24,
    width: 0.56,
    headUp: true,
  },
  punch: {
    // Short push along the target line, finish held ~0.15 s.
    prepare: 0.85,
    followTime: 0.16,
    recover: 0.66,
    load: [-0.1, 0.015, 0],
    follow: [0.26, -0.03, 0.03],
    twist: 0.11,
    squat: 0.09,
    lean: 0.24,
    open: 0,
    wrist: 0.05,
    turn: 0.2,
    hold: 0.15,
    reach: 0.34,
    width: 0.56,
    headUp: true,
  },
  reset: {
    prepare: 1.0,
    followTime: 0.15,
    recover: 0.55,
    load: [-0.25, 0, 0.1],
    follow: [0.1, -0.02, 0.2],
    twist: 0.025,
    squat: 0.15,
    lean: 0.04,
    open: -0.5,
    wrist: 0.01,
    turn: 0.18,
    low: 0.13,
  },
  speedup: {
    prepare: 1.05,
    followTime: 0.16,
    recover: 0.6,
    load: [-0.35, 0, -0.1],
    follow: [0.1, -0.3, 0.55],
    twist: 0.28,
    squat: 0.11,
    lean: 0.1,
    open: 0.08,
    wrist: 0.22,
    turn: 0.3,
  },
  roll: {
    prepare: 1.2,
    followTime: 0.18,
    recover: 0.6,
    load: [-0.25, 0.03, -0.1],
    follow: [0, -0.22, 0.75],
    twist: 0.2,
    squat: 0.1,
    lean: 0.08,
    open: 0.07,
    wrist: 0.42,
    turn: 0.25,
  },
  flick: {
    prepare: 1.0,
    followTime: 0.12,
    recover: 0.5,
    load: [-0.25, 0.05, -0.05],
    follow: [0.15, -0.1, 0.35],
    twist: 0.1,
    squat: 0.08,
    lean: 0.075,
    open: 0.06,
    wrist: 0.62,
    turn: 0.22,
  },
  atp: {
    prepare: 1.1,
    followTime: 0.2,
    recover: 0.6,
    load: [-0.45, 0, 0.1],
    follow: [0.2, -0.25, 0.55],
    twist: 0.37,
    squat: 0.16,
    lean: 0.09,
    open: -0.09,
    wrist: 0.12,
    turn: 0.8,
  },
  erne: {
    prepare: 0.95,
    followTime: 0.1,
    recover: 0.7,
    load: [-0.15, 0.05, 0.05],
    follow: [0.15, -0.05, -0.1],
    twist: 0.28,
    squat: 0.045,
    lean: 0.17,
    open: 0.08,
    wrist: 0.15,
    turn: 0.6,
  },
};
// Technique research C2/D5: takeback is slow, impact is short. Never squeeze the whole ready
// transition into a compact volley backswing. Rally preparation is scheduled before contact.
const SWING_TIMES: Record<ShotType, number> = {
  serve: 0.38, drive: 0.34, dink: 0.24, drop: 0.3, lob: 0.3,
  volley: 0.22, smash: 0.42, block: 0.14, punch: 0.22, reset: 0.24,
  speedup: 0.24, roll: 0.26, flick: 0.22, atp: 0.3, erne: 0.24,
};
for (const type of Object.keys(STROKE_MOTION) as ShotType[]) {
  const p = STROKE_MOTION[type];
  p.swing = SWING_TIMES[type];
  p.prepare = type === "smash" ? 1.45 : type === "block" ? 1.65 : 1.25;
  p.followTime = type === "serve" ? 0.45 : type === "smash" ? 0.5
    : type === "block" ? 0.18 : Math.max(0.28, p.followTime);
  p.recover = p.followTime + (p.hold ?? 0) + (type === "serve" || type === "smash" ? 1.05 : 0.85);
}
export const strokePreparation = (type: ShotType) => STROKE_MOTION[type].prepare;

// ---- Pose-to-pose timeline (.agents/reference/animation-principles.md) ----------------------
// Each stroke is a few authored key poses (start → [anticipation] → load → breakdown → contact →
// follow [→ hold]) interpolated with cubic Hermite segments: extremes ease in/out (zero tangent),
// passing keys (breakdown, contact) carry the swing through so it accelerates into contact with
// continuous velocity. Body parts sample the timeline with kinetic-chain lags, and the return to
// the shared ready stance settles with a small overshoot.

/** Readability exaggeration of the authored swing extremes at tactics-camera distance. */
export const EXAGGERATION = 1.1;
/** Overshoot of the settle back into ready. */
const SETTLE = 0.06;
// Shots with an anticipation key (technique-research.md E1; lob hides behind a dink set-up).
const BIG_SHOTS: ReadonlySet<ShotType> = new Set([
  "serve",
  "drive",
  "drop",
  "smash",
  "speedup",
  "atp",
  "erne",
]);
// Channel layout of a key pose.
const PADDLE = 0, // 0..2 paddle offset from the contact [along, across, lift]
  TWIST = 3, // chest turn (+ = hitting shoulder back)
  HIP = 4, // pelvis turn
  FACE = 5, // paddle face pitch (− = open)
  FACE_YAW = 6,
  WEIGHT = 7, // pelvis shift along the stance forward (m)
  SQUAT = 8, // extra pelvis drop (m): anticipation dip / load compression / contact extension
  LOADING = 9, // 0..1 phase weights still used by player-pose
  FOLLOW = 10;
// Body part that drives each channel: 0 pelvis, 1 chest, 2 arm (paddle path), 3 hand (paddle face).
const CHANNEL_PART = [2, 2, 2, 1, 0, 3, 3, 0, 0, 2, 2];
// Kinetic-chain lags (s) for a 0.45 s preparation: hands lead the takeback, hips lead the forward
// swing (chest +0.04, arm +0.07, paddle head +0.10). Lags shrink to zero exactly at contact and
// mirror after it, so lagging parts whip through contact fastest and then overtake.
const LAG_TAKEBACK = [0.05, 0.03, 0.01, 0],
  LAG_FORWARD = [-0.02, 0.04, 0.07, 0.1];
/** Contact tangent = this × the incoming breakdown→contact chord (accelerate into contact). */
const WHIP = 1.8;
interface Key {
  t: number;
  v: number[];
  /** Passing key: velocity carries through (Catmull-Rom tangent); otherwise an eased extreme. */
  pass?: boolean;
}
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Eases out of the follow-through, overshoots ready by SETTLE, then settles back to exactly 1. */
const settle = (u: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u < 0.8
    ? (1 + SETTLE) * smooth(u / 0.8)
    : 1 + SETTLE - SETTLE * smooth((u - 0.8) / 0.2);
};
function strokeKeys(type: ShotType, prepare: number): Key[] {
  const p = STROKE_MOTION[type],
    X = EXAGGERATION,
    tw = p.twist,
    press = p.press ?? 0,
    // A side-on stance (overhead) unwinds through the swing: hips lead, chest square at contact.
    on = p.sideOn ?? 0;
  const big = BIG_SHOTS.has(type);
  const loadT = -prepare * 0.55;
  const pose = (
    paddle: StrokeVector,
    twist: number,
    hip: number,
    face: number,
    faceYaw: number,
    weight: number,
    squat: number,
    loading: number,
    follow: number,
  ) => [...paddle, twist, hip, face, faceYaw, weight, squat, loading, follow];
  const load = p.load.map((v) => v * X) as StrokeVector;
  const follow = p.follow.map((v) => v * X) as StrokeVector;
  // Breakdown: 45 % of the way from load to contact (60 % of the time: the swing accelerates),
  // pushed off the chord by the swing arc.
  const arc = p.arc ?? [0, 0, big ? -0.06 : 0];
  const breakdown = load.map((v, i) => v * 0.55 + arc[i]) as StrokeVector;
  const keys: Key[] = [
    {
      t: -prepare,
      v: pose([0, 0, 0], tw * 0.12, 0, p.open, 0, -0.055 + press, 0, 0, 0),
    },
  ];
  if (big)
    // Anticipation: weight back and a small knee dip as the unit turn starts.
    keys.push({
      t: -prepare * 0.8,
      v: pose(
        load.map((v) => v * 0.12) as StrokeVector,
        tw * 0.4,
        tw * 0.15,
        p.open - p.wrist * 0.1,
        tw * 0.1,
        -0.09,
        0.025,
        0.2,
        0,
      ),
    });
  keys.push(
    {
      t: loadT,
      v: pose(
        load,
        tw * 1.12 * X,
        tw * 0.65,
        p.open - p.wrist * 0.35,
        tw * 0.28,
        -0.115,
        big ? 0.03 : 0.01, // spine/leg compression at the load
        1,
        0,
      ),
    },
    {
      t: loadT * 0.4,
      pass: true,
      // Hips already open (negative turn) while the chest and paddle still lag behind.
      v: pose(
        breakdown,
        tw * 0.45 - on * 0.35,
        -tw * 0.1 - on * 0.5,
        p.open - p.wrist * 0.12,
        tw * 0.08,
        -0.03 + press * 0.6,
        big ? 0.012 : 0.004,
        0.4,
        0,
      ),
    },
    {
      t: 0,
      pass: true,
      v: pose(
        [0, 0, 0],
        tw * 0.12 - on * 0.75,
        -on * 0.6,
        p.open,
        0,
        -0.055 + press,
        big ? -0.015 : 0, // slight extension through contact
        0,
        0,
      ),
    },
  );
  const finish = pose(
    follow,
    -0.7 * tw * X - on * 0.9,
    -0.65 * tw - on * 0.8,
    p.open + p.wrist,
    -0.52 * tw,
    0.11,
    0,
    0,
    1,
  );
  keys.push({ t: p.followTime, v: finish });
  if (p.hold) keys.push({ t: p.followTime + p.hold, v: finish });
  return keys;
}
function sampleKeys(keys: Key[], t: number, channel: number) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v[channel];
  if (t >= keys[n - 1].t) return keys[n - 1].v[channel];
  let i = 0;
  while (t >= keys[i + 1].t) i++;
  const tangent = (k: number) => {
    if (!keys[k].pass || k === 0 || k === n - 1) return 0;
    const before = keys[k - 1],
      here = keys[k],
      after = keys[k + 1];
    // Breakdown: a little under the average speed, so the swing keeps accelerating.
    if (here.t !== 0)
      return (
        (0.8 * (after.v[channel] - before.v[channel])) / (after.t - before.t)
      );
    // Contact: keep accelerating along the incoming chord (the follow-through may overshoot its
    // key a little and settle back, like a real swing turning upward).
    return (WHIP * (here.v[channel] - before.v[channel])) / -before.t;
  };
  const a = keys[i],
    b = keys[i + 1],
    d = b.t - a.t,
    u = (t - a.t) / d;
  return (
    (2 * u ** 3 - 3 * u * u + 1) * a.v[channel] +
    (u ** 3 - 2 * u * u + u) * d * tangent(i) +
    (-2 * u ** 3 + 3 * u * u) * b.v[channel] +
    (u ** 3 - u * u) * d * tangent(i + 1)
  );
}
export function sampleStroke(
  type: ShotType,
  time = 0,
  preparation = strokePreparation(type),
) {
  const profile = STROKE_MOTION[type],
    prepare = Math.max(0.06, preparation),
    loadTime = -prepare * 0.55;
  const t = Math.max(-prepare, time);
  const keys = strokeKeys(type, prepare);
  // Chain lags, scaled with the stroke length. They ease to zero exactly at contact (every part
  // hits its contact key at t = 0, velocity stays continuous) and are mirrored after it.
  const scale = Math.min(1, prepare / 0.45),
    reach = 0.2 * scale,
    x = Math.min(1, Math.abs(t) / reach),
    fade = 1 - (1 - x) * (1 - x),
    forward = smooth((t - loadTime + 0.125 * scale) / (0.25 * scale));
  const partTime = [0, 1, 2, 3].map((part) => {
    const lag =
      t < 0
        ? mix(LAG_TAKEBACK[part], LAG_FORWARD[part], forward)
        : -LAG_FORWARD[part];
    return Math.max(-prepare, t - lag * scale * fade);
  });
  const v = CHANNEL_PART.map((part, c) => sampleKeys(keys, partTime[part], c));
  const followEnd = profile.followTime + (profile.hold ?? 0);
  const recovery = settle((t - followEnd) / (profile.recover - followEnd));
  const keep = 1 - recovery;
  const loading = Math.max(0, Math.min(1, v[LOADING])),
    follow = t >= followEnd ? 1 : Math.max(0, Math.min(1, v[FOLLOW]));
  return {
    profile,
    offset: [0, 1, 2].map((i) => v[PADDLE + i] * keep) as StrokeVector,
    loading,
    follow,
    recovery,
    ready: t < loadTime ? 1 - smooth((t + prepare) / (loadTime + prepare)) : 0,
    twist: v[TWIST] * keep,
    hipTwist: v[HIP] * keep,
    facePitch: profile.open + (v[FACE] - profile.open) * keep,
    faceYaw: v[FACE_YAW] * keep,
    weight: v[WEIGHT] * keep,
    squat: v[SQUAT] * keep,
    hop:
      type === "erne"
        ? Math.max(0, keep) *
          0.13 *
          Math.max(0, Math.sin(((t + prepare * 0.3) / 0.48) * Math.PI))
        : 0,
  };
}
