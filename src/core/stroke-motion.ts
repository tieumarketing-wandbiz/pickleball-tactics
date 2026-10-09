// Keyed stroke timeline for the 15 shots. Pose-to-pose: every channel is a short list of keys
// (time relative to contact, value, velocity) joined by cubic Hermite segments; nothing is
// authored per frame. Key frames, easings and the kinetic-chain order come from
// .agents/reference/tennis-frames.md §3–§4 (24 fps, contact = frame 0); the amplitudes come from
// video-guide.md / technique-research.md E2.
import type { ShotType } from "./constants";
import { hermite, hermiteVelocity, smooth } from "./motion-curve";
export type StrokeVector = [number, number, number]; // shot-forward, hitting-side, vertical
export const FPS = 24;
const F = 1 / FPS;
interface StrokeProfile {
  /** Total ready → contact time (s). */
  prepare: number;
  /** Contact → follow extreme (s). */
  followTime: number;
  /** Contact → back in ready (s). */
  recover: number;
  /** Forward swing duration (s), load → contact. */
  swing: number;
  /** Moving hold after the follow extreme (punch), seconds. */
  hold?: number;
  load: StrokeVector;
  follow: StrokeVector;
  twist: number;
  squat: number;
  lean: number;
  open: number;
  wrist: number;
  turn: number;
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
}
/** Per-shot key frames (24 fps, relative to contact) and chain timing: tennis-frames.md §4.3. */
export interface StrokeKeys {
  R: number; A?: number; L: number; B: number; F: number; H?: number; S: number; Rp: number;
  /** Normalized contact tangent of the paddle path (power curve exponent): §3.2. */
  mIn: number;
  /** Pelvis / chest yaw: [reversal, peak-velocity] frames; "unit" shots move as one piece. */
  pelvis: [number, number]; chest: [number, number];
  /** Weight shift and knee drive peak frames (null = none, stay low). */
  weight: number | null; knee: number | null;
  /** Forearm roll (face closing) peak frame after contact (null = constant face). */
  roll: number | null;
  /** Settle overshoot past ready (fraction of the follow displacement). */
  settle: number;
  /** Vertical hop window [start, end] frames and height (erne jump, smash scissor). */
  hop?: [number, number, number];
}
export const STROKE_KEYS: Record<ShotType, StrokeKeys> = {
  serve:   { R: -12, A: -9, L: -5, B: -2, F: 7, S: 13, Rp: 18, mIn: 2.1, pelvis: [-6, -1.5], chest: [-5, -1], weight: -2.5, knee: -3, roll: null, settle: .06 },
  drive:   { R: -12, A: -9, L: -5, B: -2, F: 5, S: 11, Rp: 16, mIn: 2.3, pelvis: [-6.5, -1.5], chest: [-5, -1], weight: -2, knee: -3, roll: .5, settle: .06 },
  dink:    { R: -6, L: -2.5, B: -1, F: 5, S: 10, Rp: 14, mIn: 1.7, pelvis: [-2.5, -.75], chest: [-2.5, -.75], weight: null, knee: null, roll: null, settle: .05 },
  drop:    { R: -10, A: -8, L: -4.5, B: -2, F: 6, S: 12, Rp: 18, mIn: 2.0, pelvis: [-5.5, -1.5], chest: [-4.5, -1], weight: -2, knee: -2.5, roll: null, settle: .06 },
  lob:     { R: -7, L: -4, B: -1.5, F: 7, S: 14, Rp: 20, mIn: 2.2, pelvis: [-5, -1.25], chest: [-4, -.75], weight: -1.5, knee: -2, roll: null, settle: .06 },
  volley:  { R: -5, L: -2.5, B: -1, F: 3, S: 7, Rp: 12, mIn: 2.0, pelvis: [-3, -.5], chest: [-2.5, -.25], weight: -1, knee: null, roll: null, settle: .05 },
  smash:   { R: -14, A: -11, L: -6, B: -2.5, F: 8, S: 14, Rp: 20, mIn: 2.4, pelvis: [-7, -2], chest: [-6, -1.5], weight: -2, knee: -4, roll: .5, settle: .06, hop: [-5, 3, .07] },
  block:   { R: -4, L: -2, B: -.8, F: 3, S: 7, Rp: 11, mIn: 1.5, pelvis: [-2, -.5], chest: [-2, -.5], weight: null, knee: null, roll: null, settle: .04 },
  punch:   { R: -5, L: -2.5, B: -1, F: 3, H: 6, S: 9, Rp: 12, mIn: 2.2, pelvis: [-3, -.5], chest: [-2.5, -.25], weight: -1, knee: null, roll: null, settle: .05 },
  reset:   { R: -6, L: -2.5, B: -1, F: 4, S: 9, Rp: 13, mIn: 1.7, pelvis: [-2.5, -.75], chest: [-2.5, -.75], weight: null, knee: null, roll: null, settle: .05 },
  speedup: { R: -8, A: -6, L: -3.5, B: -1.5, F: 4, S: 9, Rp: 14, mIn: 2.4, pelvis: [-4.5, -1.25], chest: [-3.5, -.75], weight: -1.5, knee: -2, roll: .5, settle: .06 },
  roll:    { R: -7, L: -4, B: -1.5, F: 4.5, S: 9.5, Rp: 14, mIn: 2.0, pelvis: [-5, -1], chest: [-4, -.5], weight: -1.5, knee: -2, roll: .5, settle: .06 },
  flick:   { R: -5, L: -2, B: -.75, F: 3, S: 7, Rp: 12, mIn: 2.4, pelvis: [-2.5, -.5], chest: [-2, -.5], weight: null, knee: null, roll: .25, settle: .05 },
  atp:     { R: -19, A: -10, L: -4.5, B: -2, F: 5, S: 12, Rp: 19, mIn: 2.3, pelvis: [-5.5, -1.5], chest: [-4.5, -1], weight: -2, knee: -2.5, roll: .5, settle: .06 },
  erne:    { R: -11, A: -6, L: -3.5, B: -1.5, F: 2.5, S: 9, Rp: 17, mIn: 2.0, pelvis: [-3.5, -.25], chest: [-3.5, -.25], weight: null, knee: null, roll: null, settle: .05, hop: [-6, 3, .13] },
};
type Shape = Omit<StrokeProfile, "prepare" | "followTime" | "recover" | "swing" | "hold">;
const SHAPES: Record<ShotType, Shape> = {
  serve: {
    // Underhand pendulum behind the hip, head below the wrist, high finish (video-guide.md).
    load: [-0.5, 0.06, -0.12], follow: [0.3, 0.04, 1.1], twist: 0.62, squat: 0.07, lean: 0.38, open: -0.26,
    wrist: 0.12, turn: 0.65, setup: true, reach: 0.2, press: 0.12, dip: 0.16, side: 0.28, low: 0.05,
    width: 0.5, stagger: -0.125, headDown: 1, arc: [0, 0.02, -0.14],
  },
  drive: { load: [-0.55, 0.05, 0.08], follow: [0.15, -0.6, 0.6], twist: 0.95, squat: 0.1, lean: 0.12, open: 0.06, wrist: 0.26, turn: 0.65, arc: [0.02, 0.02, -0.08] },
  dink: {
    // Already low; only the final push is fast (research C2/D5).
    load: [-0.12, 0.02, 0], follow: [0.18, -0.02, 0.26], twist: 0.04, squat: 0.15, lean: 0.72, open: -0.7,
    wrist: 0, turn: 0.2, reach: 0.22, low: 0.13, sit: 0.3, width: 0.78, headDown: 1, arc: [0, 0.01, -0.025],
  },
  drop: { load: [-0.42, 0, 0.04], follow: [0.25, -0.15, 0.5], twist: 0.5, squat: 0.1, lean: 0.07, open: -0.44, wrist: 0.06, turn: 0.4, arc: [0.02, 0.01, -0.06] },
  // Dink disguise until the load, then a real drop of the hand so the lob can reach the baseline (§4.5).
  lob: { load: [-0.3, 0, -0.26], follow: [0.05, -0.2, 1.1], twist: 0.16, squat: 0.11, lean: 0.03, open: -0.87, wrist: 0.07, turn: 0.3, arc: [0, 0.01, -0.05] },
  volley: {
    // Early face set, compact forward push; never behind the torso.
    load: [-0.12, 0.03, 0.02], follow: [0.25, -0.03, 0.03], twist: 0.09, squat: 0.09, lean: 0.22, open: 0,
    wrist: 0.04, turn: 0.2, reach: 0.36, width: 0.56, headUp: true, arc: [0, 0.01, -0.02],
  },
  smash: {
    // Side-on, paddle cocked behind the head, contact high in front, finish down across the body.
    load: [-0.42, 0.1, -0.42], follow: [0.3, -0.6, -1.1], twist: 0.65, squat: 0.05, lean: 0.12, open: 0.1,
    wrist: 0.58, turn: 0.75, reach: 0.3, press: 0.04, width: 0.52, cock: 1.1, sideOn: 0.85, arc: [-0.06, 0.03, -0.08],
  },
  block: {
    // Half extension, absorb, no follow-through.
    load: [0.015, 0, 0.015], follow: [-0.035, 0, -0.015], twist: 0.02, squat: 0.1, lean: 0.2, open: -0.18,
    wrist: 0, turn: 0.15, reach: 0.24, width: 0.56, headUp: true, arc: [0, 0.004, 0.004],
  },
  punch: {
    // Short push along the target line, finish is a 3-frame moving hold.
    load: [-0.1, 0.015, 0], follow: [0.26, -0.03, 0.03], twist: 0.11, squat: 0.09, lean: 0.24, open: 0,
    wrist: 0.05, turn: 0.2, reach: 0.34, width: 0.56, headUp: true, arc: [0, 0.01, -0.015],
  },
  reset: { load: [-0.22, 0, 0.08], follow: [0.1, -0.02, 0.2], twist: 0.025, squat: 0.15, lean: 0.04, open: -0.5, wrist: 0.01, turn: 0.18, low: 0.13, arc: [0, 0.01, -0.03] },
  speedup: { load: [-0.3, 0, -0.08], follow: [0.1, -0.3, 0.5], twist: 0.28, squat: 0.11, lean: 0.1, open: 0.08, wrist: 0.22, turn: 0.3, arc: [0.01, 0.01, -0.04] },
  roll: { load: [-0.22, 0.03, -0.1], follow: [0, -0.22, 0.65], twist: 0.2, squat: 0.1, lean: 0.08, open: 0.07, wrist: 0.42, turn: 0.25, arc: [0.01, 0.01, -0.05] },
  flick: { load: [-0.22, 0.05, -0.05], follow: [0.15, -0.1, 0.35], twist: 0.1, squat: 0.08, lean: 0.075, open: 0.06, wrist: 0.62, turn: 0.22, arc: [0.01, 0.01, -0.03] },
  atp: { load: [-0.4, 0, 0.25], follow: [0.2, -0.25, 0.5], twist: 0.37, squat: 0.16, lean: 0.09, open: -0.09, wrist: 0.12, turn: 0.8, arc: [0.02, 0.01, -0.06] },
  erne: { load: [-0.15, 0.05, 0.05], follow: [0.15, -0.05, -0.1], twist: 0.28, squat: 0.045, lean: 0.17, open: 0.08, wrist: 0.15, turn: 0.6, arc: [0, 0.01, -0.02] },
};
export const STROKE_MOTION = Object.fromEntries((Object.keys(SHAPES) as ShotType[]).map((type) => {
  const k = STROKE_KEYS[type];
  return [type, { ...SHAPES[type], prepare: -k.R * F, followTime: k.F * F, recover: k.Rp * F, swing: -k.L * F,
    hold: k.H !== undefined ? (k.H - k.F) * F : undefined }];
})) as Record<ShotType, StrokeProfile>;
/** Compatibility view of the key frames in seconds (video-measured phases). */
export const STROKE_TIMING = Object.fromEntries((Object.keys(STROKE_KEYS) as ShotType[]).map((type) => {
  const k = STROKE_KEYS[type];
  return [type, { takeback: (k.L - k.R) * F, swing: -k.L * F, follow: k.F * F, recovery: (k.Rp - (k.H ?? k.F)) * F,
    hold: k.H !== undefined ? (k.H - k.F) * F : undefined }];
})) as Record<ShotType, { takeback: number; swing: number; follow: number; recovery: number; hold?: number }>;
export const strokePreparation = (type: ShotType) => STROKE_MOTION[type].prepare;
export const EXAGGERATION = 1;
/** Key times in seconds for a possibly shortened preparation (tennis-frames.md §6.8: drop A first,
 * compress the takeback next; the forward swing keeps at least its table length minus one frame). */
export function strokeKeyTimes(type: ShotType, preparation = strokePreparation(type)) {
  const k = STROKE_KEYS[type], prep = Math.max(0.06, preparation);
  const nominal = -k.R * F;
  const scale = Math.min(1, prep / nominal);
  const swing = Math.min(-k.L * F, Math.max((-k.L - 1) * F, prep * 0.9));
  const takeback = prep - swing, nominalTakeback = (k.L - k.R) * F;
  const A = k.A !== undefined && takeback >= 3 * F ? -swing - takeback * (k.L - k.A) / (k.L - k.R) : undefined;
  return {
    R: -prep, A, L: -swing, B: -swing * (1 - (k.B - k.L) / -k.L), C: 0, F: k.F * F, H: k.H !== undefined ? k.H * F : undefined,
    S: k.S * F, Rp: k.Rp * F, scale, takeback, nominalTakeback,
  };
}
export function strokeLoadTime(type: ShotType, preparation = strokePreparation(type)) {
  return strokeKeyTimes(type, preparation).L;
}
/** Time of a chain key frame (< 0) when the takeback or the swing has been compressed. */
function frameTime(type: ShotType, preparation: number, frame: number) {
  const k = STROKE_KEYS[type], t = strokeKeyTimes(type, preparation);
  if (frame >= 0) return frame * F;
  if (frame >= k.L) return t.L * (frame / k.L);
  return t.L - (k.L - frame) * F * (t.takeback / t.nominalTakeback);
}
interface Key { t: number; value: number; velocity?: number }
export function sampleKeys(keys: Key[], t: number) {
  if (t <= keys[0].t) return keys[0].value;
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].value;
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], d = b.t - a.t;
  return hermite(a.value, b.value, a.velocity ?? 0, b.velocity ?? 0, d, (t - a.t) / d);
}
function sampleKeysVelocity(keys: Key[], t: number) {
  if (t <= keys[0].t || t >= keys[keys.length - 1].t) return 0;
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1], d = b.t - a.t;
  return hermiteVelocity(a.value, b.value, a.velocity ?? 0, b.velocity ?? 0, d, (t - a.t) / d);
}
/** Normalized power swing 0 → 1 over the forward swing: start slope 0.1, contact slope m. */
const swingShape = (u: number, m: number) => hermite(0, 1, 0.1, m, 1, Math.max(0, Math.min(1, u)));

// ---- paddle path: centripetal Catmull–Rom through the key drawings, arc-length timing (§3.3) ----
interface Path { points: StrokeVector[]; knots: number[]; lengths: number[]; us: Float64Array; ss: Float64Array; total: number }
const SEG_SAMPLES = 48;
function catmull(p0: StrokeVector, p1: StrokeVector, p2: StrokeVector, p3: StrokeVector, k: number[], t: number, out: StrokeVector) {
  // Barry–Goldman pyramid with centripetal knots k[0..3]; t ∈ [k[1], k[2]].
  for (let c = 0; c < 3; c++) {
    const a1 = (k[1] - t) / (k[1] - k[0]) * p0[c] + (t - k[0]) / (k[1] - k[0]) * p1[c];
    const a2 = (k[2] - t) / (k[2] - k[1]) * p1[c] + (t - k[1]) / (k[2] - k[1]) * p2[c];
    const a3 = (k[3] - t) / (k[3] - k[2]) * p2[c] + (t - k[2]) / (k[3] - k[2]) * p3[c];
    const b1 = (k[2] - t) / (k[2] - k[0]) * a1 + (t - k[0]) / (k[2] - k[0]) * a2;
    const b2 = (k[3] - t) / (k[3] - k[1]) * a2 + (t - k[1]) / (k[3] - k[1]) * a3;
    out[c] = (k[2] - t) / (k[2] - k[1]) * b1 + (t - k[1]) / (k[2] - k[1]) * b2;
  }
  return out;
}
const dist = (a: StrokeVector, b: StrokeVector) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const extend = (pts: StrokeVector[]) => {
  const n = pts.length;
  return [pts[0].map((x, c) => 2 * x - pts[1][c]) as StrokeVector, ...pts, pts[n - 1].map((x, c) => 2 * x - pts[n - 2][c]) as StrokeVector];
};
function buildPath(pts: StrokeVector[]): Path {
  const n = pts.length, ext = extend(pts);
  const knots = [0];
  for (let i = 1; i < ext.length; i++) knots.push(knots[i - 1] + Math.max(1e-4, Math.sqrt(dist(ext[i], ext[i - 1]))));
  // One global (parameter, arc length) table: the inverse stays C1 across the key points.
  const count = (n - 1) * SEG_SAMPLES + 1, us = new Float64Array(count), ss = new Float64Array(count), lengths = [0];
  const tmp: StrokeVector = [0, 0, 0];
  let prev: StrokeVector = [pts[0][0], pts[0][1], pts[0][2]], total = 0, m = 0;
  for (let i = 0; i < n - 1; i++) {
    const k = knots.slice(i, i + 4);
    for (let s = i === 0 ? 0 : 1; s <= SEG_SAMPLES; s++) {
      const u = k[1] + (k[2] - k[1]) * s / SEG_SAMPLES;
      const p = catmull(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], k, u, tmp);
      total += dist(p, prev);
      prev = [p[0], p[1], p[2]];
      us[m] = u; ss[m] = total; m++;
    }
    lengths.push(total);
  }
  return { points: pts, knots, lengths, us, ss, total };
}
/** Point on the path at arc length s (monotone cubic inverse of the length table, C1 in s). */
function pathAt(path: Path, s: number, out: StrokeVector) {
  const { us, ss, knots, points } = path, last = us.length - 1;
  s = Math.max(0, Math.min(path.total, s));
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ss[mid] <= s) lo = mid; else hi = mid; }
  const cell = (a: number) => (us[a + 1] - us[a]) / Math.max(1e-9, ss[a + 1] - ss[a]);
  const slope = (a: number) => {
    const l = a > 0 ? cell(a - 1) : cell(a), r = a < last ? cell(a) : cell(a - 1);
    return 2 / (1 / l + 1 / r);
  };
  const ds = Math.max(1e-9, ss[hi] - ss[lo]);
  const u = hermite(us[lo], us[hi], slope(lo), slope(hi), ds, (s - ss[lo]) / ds);
  let i = 0;
  while (i < points.length - 2 && u > knots[i + 2]) i++;
  const ext = extend(points);
  return catmull(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], knots.slice(i, i + 4), u, out);
}
const pathCache = new Map<string, { path: Path; timing: Key[]; readyIndex: number }>();
/**
 * Paddle face centre relative to the contact point, in the stroke frame. One spatial curve through
 * ready → (anticipation) → load → breakdown → contact → follow → settle → ready, timed along its
 * arc length so the speed profile IS the easing: slow out of ready, soft arrival into the load
 * (never a dead stop), power curve into contact (peak speed exactly at contact), decelerating
 * follow, settle overshoot, ease back to ready.
 */
export function samplePaddlePath(type: ShotType, t: number, preparation: number, ready: StrokeVector = [0, 0, 0]): StrokeVector {
  const k = STROKE_KEYS[type], p = STROKE_MOTION[type], times = strokeKeyTimes(type, preparation);
  const key = `${type}|${preparation.toFixed(5)}|${ready.map((x) => x.toFixed(4)).join(",")}`;
  let entry = pathCache.get(key);
  if (!entry) {
    const load = p.load.map((x) => x * EXAGGERATION) as StrokeVector;
    const follow = p.follow.map((x) => x * EXAGGERATION) as StrokeVector;
    const contact: StrokeVector = [0, 0, 0];
    // Under time pressure the backswing amplitude shrinks with the takeback (§6.8 step 3).
    const amp = 0.55 + 0.45 * times.scale;
    const L = load.map((x) => x * amp) as StrokeVector;
    const B = L.map((x, c) => x * (1 - 0.32) + (p.arc?.[c] ?? 0)) as StrokeVector;
    // The anticipation is a body key (coil, weight, knee dip): the paddle leaves ready straight
    // into its takeback, otherwise the 0.6–1.0 m ready → load travel is crammed into A → L.
    const H = p.hold ? follow.map((x) => x * 1.03) as StrokeVector : undefined;
    const S = ready.map((r, c) => r + (r - follow[c]) * k.settle) as StrokeVector;
    const authored = [ready, L, B, contact, follow, H, S, ready].filter((x): x is StrokeVector => !!x);
    // Drop coincident neighbours (centripetal knots need distinct points); keys map to the kept point.
    const index = new Map<StrokeVector, number>(), points: StrokeVector[] = [];
    for (const pt of authored) {
      if (!points.length || dist(pt, points[points.length - 1]) > 1e-5) points.push(pt);
      index.set(pt, points.length - 1);
    }
    const path = buildPath(points);
    const at = (pt: StrokeVector) => path.lengths[index.get(pt)!];
    const sL = at(L), sC = at(contact), sF = at(follow), sS = at(S), sEnd = path.total;
    const lenLC = sC - sL, vC = k.mIn * lenLC / -times.L;
    const timing: Key[] = [{ t: times.R, value: 0, velocity: 0 }];
    timing.push({ t: times.L, value: sL, velocity: 0.1 * lenLC / -times.L });
    timing.push({ t: 0, value: sC, velocity: vC });
    if (H && times.H !== undefined) {
      const drift = (at(H) - sF) / (times.H - times.F);
      timing.push({ t: times.F, value: sF, velocity: drift }, { t: times.H, value: at(H), velocity: drift });
    } else timing.push({ t: times.F, value: sF, velocity: 0 });
    timing.push({ t: times.S, value: sS, velocity: 0 }, { t: times.Rp, value: sEnd, velocity: 0 });
    entry = { path, timing, readyIndex: 0 };
    if (pathCache.size > 64) pathCache.clear();
    pathCache.set(key, entry);
  }
  const out: StrokeVector = [0, 0, 0];
  if (t <= times.R || t >= times.Rp) return [ready[0], ready[1], ready[2]];
  return pathAt(entry.path, sampleKeys(entry.timing, t), out);
}
/** Diagnostics: speed along the path (m/s) and the follow's normalized tangent m_out (§3.2). */
export function paddlePathStats(type: ShotType, preparation = strokePreparation(type), ready: StrokeVector = [0, 0, 0]) {
  samplePaddlePath(type, 0, preparation, ready);
  const key = `${type}|${preparation.toFixed(5)}|${ready.map((x) => x.toFixed(4)).join(",")}`;
  const { timing } = pathCache.get(key)!, times = strokeKeyTimes(type, preparation);
  const c = timing.find((x) => x.t === 0)!, f = timing.find((x) => x.t === times.F)!, l = timing.find((x) => x.t === times.L)!;
  return { vC: c.velocity!, lenLC: c.value - l.value, lenCF: f.value - c.value, mOut: c.velocity! * times.F / (f.value - c.value),
    speed: (t: number) => sampleKeysVelocity(timing, t) };
}
export function sampleStroke(type: ShotType, time = 0, preparation = strokePreparation(type)) {
  const profile = STROKE_MOTION[type], k = STROKE_KEYS[type], times = strokeKeyTimes(type, preparation);
  const t = time, { R, L, F: Fk, S, Rp } = times, H = times.H ?? Fk;
  const swing = swingShape((t - L) / -L, k.mIn);
  const recovery = sampleKeys([{ t: H, value: 0 }, { t: S, value: 1 + k.settle }, { t: Rp, value: 1 }], t);
  // Body preparation finishes at the load (feet planted from the load to the settle).
  const ready = 1 - smooth((t - R) / (L - R));
  const loading = t < L ? smooth((t - R) / (L - R)) : 1 - swing;
  const follow = smooth(t / profile.followTime);
  const big = ["serve", "drive", "smash", "speedup"].includes(type);
  const on = profile.sideOn ?? 0;
  const key = (frame: number) => frameTime(type, preparation, frame);
  // One in-out segment from the reversal to the finish key; its peak velocity lands on the table
  // frame by symmetry (finish = reversal + 2·(peak − reversal)); the settle starts right after.
  const chain = (rev: [number, number], a: number, f: number, antic: number) => {
    const keys: Key[] = [{ t: R, value: 0 }];
    if (times.A !== undefined) keys.push({ t: times.A, value: antic });
    const tRev = key(rev[0]), tOpen = Math.max(key(rev[1]) + (key(rev[1]) - tRev), tRev + F);
    keys.push({ t: tRev, value: a }, { t: tOpen, value: f });
    if (tOpen < S - F) keys.push({ t: S, value: -f * k.settle });
    keys.push({ t: Rp, value: 0 });
    return sampleKeys(keys, t);
  };
  const twistA = profile.twist * 1.12 * EXAGGERATION, twistF = -0.7 * profile.twist * EXAGGERATION - on * 0.9;
  const hipA = profile.twist * 0.65, hipF = -profile.twist * 0.65 - on * 0.8;
  // Weight: anticipation moves away, loads onto the back foot, drives to the front by about +1–2 f.
  const weightAmp = k.weight === null ? 0 : ["volley", "punch"].includes(type) ? 0.05 : 0.115;
  const weight = k.weight === null ? 0 : chain([k.L, k.weight], -weightAmp, weightAmp + (profile.press ?? 0), 0.02);
  // Knee: dip at the anticipation, deepen into the load, drive from L−1 f, extend only on power shots.
  const squat = k.knee === null ? 0 : chain([k.L - 1, k.knee], big ? 0.03 : 0.012, big ? -0.015 : 0, 0.008);
  const hop = k.hop && t > key(k.hop[0]) && t < k.hop[1] * F
    ? k.hop[2] * Math.sin((t - key(k.hop[0])) / (k.hop[1] * F - key(k.hop[0])) * Math.PI) ** 2 : 0;
  // Face: opens slightly on the takeback; power shots roll closed with the peak just after contact.
  const w = profile.wrist;
  const facePitch = profile.open + sampleKeys([
    { t: R, value: 0 }, { t: L, value: -w * 0.35 },
    { t: 0, value: 0, velocity: (k.roll === null ? 1 : 2) * 1.35 * w / (profile.followTime - L) },
    { t: profile.followTime, value: w }, { t: S, value: -w * k.settle }, { t: Rp, value: 0 },
  ], t);
  const faceYaw = sampleKeys([
    { t: R, value: 0 }, { t: L, value: profile.twist * 0.28 },
    { t: 0, value: 0, velocity: -0.8 * profile.twist / (profile.followTime - L) },
    { t: profile.followTime, value: -profile.twist * 0.52 }, { t: S, value: profile.twist * 0.52 * k.settle }, { t: Rp, value: 0 },
  ], t);
  return {
    profile, offset: samplePaddlePath(type, t, preparation), loading, follow, recovery, ready, swing,
    twist: chain(k.chest, twistA, twistF, twistA * 0.3),
    hipTwist: chain(k.pelvis, hipA, hipF, hipA * 0.25),
    facePitch, faceYaw, weight, squat, hop,
  };
}
