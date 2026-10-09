import type { ShotType } from "./constants";
import { ease, hermite } from "./motion";
import { hermite as cubicHermite } from "./motion-curve";
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
    load: [-0.45, 0, 0.3],
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
  p.prepare = type === "smash" ? 1.65 : type === "block" ? 1.65 : 1.45;
  p.followTime = type === "serve" ? 0.5 : type === "smash" ? 0.55
    : type === "lob" ? 0.65 : type === "drive" ? 0.4 : type === "roll" ? 0.42
    : type === "block" ? 0.18 : type === "volley" || type === "punch" || type === "erne" ? 0.3 : Math.max(0.5, p.followTime);
  p.recover = p.followTime + (p.hold ?? 0) + 1.25;
}
export const strokePreparation = (type: ShotType) => STROKE_MOTION[type].prepare;

// Pose-to-pose, including the return: never multiply a lagged follow pose by a separate ease.
// Quintic Hermite carries the same tangent/acceleration into and out of each passing key.
export const EXAGGERATION = 1.1;
const SETTLE = 0.06;
const FORWARD: Record<ShotType, number> = {
  serve: 0.5, drive: 0.65, dink: 0.32, drop: 0.6, lob: 0.55,
  volley: 0.22, smash: 0.65, block: 0.24, punch: 0.22, reset: 0.6,
  speedup: 0.6, roll: 0.6, flick: 0.4, atp: 0.4, erne: 0.3,
};
export function strokeLoadTime(type: ShotType, preparation = strokePreparation(type)) {
  return -Math.min(FORWARD[type], preparation * 0.65);
}
interface Key { t: number; value: number; velocity?: number; acceleration?: number }
function sample(keys: Key[], t: number, cubic = false) {
  if (t <= keys[0].t) return keys[0].value;
  if (t >= keys.at(-1)!.t) return keys.at(-1)!.value;
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], d = b.t - a.t;
  return cubic ? cubicHermite(a.value, b.value, a.velocity ?? 0, b.velocity ?? 0, d, (t - a.t) / d)
    : hermite(a.value, b.value, a.velocity ?? 0, b.velocity ?? 0, d,
      (t - a.t) / d, a.acceleration ?? 0, b.acceleration ?? 0);
}
/** The contact tangent also defines the outgoing spacing: speed only decreases after impact. */
function contactVelocity(type: ShotType): StrokeVector {
  const p = STROKE_MOTION[type];
  if (type === "block") return [1.3, 0, -0.35];
  return p.follow.map((x) => x * EXAGGERATION * 2 / p.followTime) as StrokeVector;
}
/** Final paddle path, not a fast crossfade from a chest-height ready pose to a low contact. */
export function samplePaddlePath(
  type: ShotType, t: number, preparation: number, ready: StrokeVector = [0, 0, 0],
): StrokeVector {
  const p = STROKE_MOTION[type], load = strokeLoadTime(type, preparation);
  const finish = p.followTime, holdEnd = finish + (p.hold ?? 0);
  const settle = holdEnd + (p.recover - holdEnd) * 0.72;
  const velocity = contactVelocity(type);
  return ready.map((r, c) => {
    const f = p.follow[c] * EXAGGERATION;
    // The punch's 3% moving hold drifts into the recovery, rather than stopping dead.
    const drift = p.hold ? -f * 0.03 / p.hold : 0;
    const keys: Key[] = [
      { t: -preparation, value: r },
      { t: load, value: p.load[c] * EXAGGERATION },
      { t: 0, value: 0, velocity: velocity[c] },
      { t: finish, value: f, velocity: drift },
    ];
    if (p.hold) keys.push({ t: holdEnd, value: f * 0.97, velocity: drift });
    keys.push(
      { t: settle, value: r + (r - f) * SETTLE },
      { t: p.recover, value: r },
    );
    return sample(keys, t, true);
  }) as StrokeVector;
}
export function sampleStroke(type: ShotType, time = 0, preparation = strokePreparation(type)) {
  const profile = STROKE_MOTION[type], prepare = Math.max(0.06, preparation);
  const load = strokeLoadTime(type, prepare), t = time;
  const followEnd = profile.followTime + (profile.hold ?? 0);
  const settling = followEnd + (profile.recover - followEnd) * 0.72;
  const recovery = sample([
    { t: followEnd, value: 0 }, { t: settling, value: 1 + SETTLE },
    { t: profile.recover, value: 1 },
  ], t);
  const ready = 1 - ease((t + prepare) / (prepare + load));
  const loading = t < load ? ease((t + prepare) / (prepare + load)) :
    1 - ease((t - load) / -load);
  const follow = ease(t / profile.followTime);
  const big = ["serve", "drive", "smash", "speedup"].includes(type);
  const on = profile.sideOn ?? 0;
  const channel = (a: number, b: number, f: number, lead = 0) => sample([
    { t: -prepare, value: 0 }, { t: load, value: a },
    // Proximal parts pass their breakdown earlier, but never time-warp the contact tangent.
    { t: load * (0.4 + lead), value: a * (lead ? 0.1 : 0.5) + b * (lead ? 0.9 : 0.5),
      velocity: (b - a) / -load * 1.15 },
    { t: 0, value: b, velocity: (f - b) / profile.followTime * 0.7 },
    { t: profile.followTime, value: f },
    { t: settling, value: -f * SETTLE }, { t: profile.recover, value: 0 },
  ], t);
  return {
    profile, offset: samplePaddlePath(type, t, prepare), loading, follow, recovery, ready,
    twist: channel(profile.twist * 1.12 * EXAGGERATION, profile.twist * 0.12 - on * 0.75,
      -0.7 * profile.twist * EXAGGERATION - on * 0.9),
    hipTwist: channel(profile.twist * 0.65, -on * 0.6, -profile.twist * 0.65 - on * 0.8, 0.15),
    facePitch: profile.open + channel(-profile.wrist * 0.35, 0, profile.wrist),
    faceYaw: channel(profile.twist * 0.28, 0, -profile.twist * 0.52),
    weight: channel(-0.115, -0.055 + (profile.press ?? 0), 0.11, 0.15),
    squat: channel(big ? 0.03 : 0.01, big ? -0.015 : 0, 0, 0.15),
    // Squared sine has zero launch/landing velocity (no max(sin, 0) cusp).
    hop: type === "erne" && t > -0.22 && t < 0.26
      ? 0.13 * Math.sin((t + 0.22) / 0.48 * Math.PI) ** 2 : 0,
  };
}
