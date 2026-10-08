import type { ShotType } from "./constants";
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
}
// Authored coaching-inspired poses, not motion capture or measured joint angles.
export const STROKE_MOTION: Record<ShotType, StrokeProfile> = {
  serve: {
    prepare: 0.48,
    followTime: 0.3,
    recover: 0.88,
    load: [-0.4, 0.26, -0.22],
    follow: [0.24, -0.58, 0.78],
    twist: 0.62,
    squat: 0.06,
    lean: 0.08,
    open: -0.1,
    wrist: 0.12,
    turn: 0.65,
  },
  drive: {
    prepare: 0.36,
    followTime: 0.26,
    recover: 0.82,
    load: [-0.34, 0.32, -0.14],
    follow: [0.22, -0.6, 0.72],
    twist: 0.74,
    squat: 0.1,
    lean: 0.12,
    open: 0.06,
    wrist: 0.26,
    turn: 0.65,
  },
  dink: {
    prepare: 0.26,
    followTime: 0.22,
    recover: 0.6,
    load: [-0.1, 0.025, -0.06],
    follow: [0.14, -0.025, 0.1],
    twist: 0.045,
    squat: 0.13,
    lean: 0.055,
    open: -0.28,
    wrist: 0.025,
    turn: 0.2,
  },
  drop: {
    prepare: 0.32,
    followTime: 0.27,
    recover: 0.72,
    load: [-0.23, 0.12, -0.1],
    follow: [0.26, -0.12, 0.27],
    twist: 0.24,
    squat: 0.1,
    lean: 0.07,
    open: -0.24,
    wrist: 0.06,
    turn: 0.4,
  },
  lob: {
    prepare: 0.34,
    followTime: 0.32,
    recover: 0.84,
    load: [-0.18, 0.06, -0.16],
    follow: [0.2, -0.06, 0.62],
    twist: 0.16,
    squat: 0.11,
    lean: 0.03,
    open: -0.4,
    wrist: 0.07,
    turn: 0.3,
  },
  volley: {
    prepare: 0.19,
    followTime: 0.16,
    recover: 0.48,
    load: [-0.065, 0.015, 0],
    follow: [0.17, -0.025, 0.035],
    twist: 0.09,
    squat: 0.1,
    lean: 0.1,
    open: 0.04,
    wrist: 0.04,
    turn: 0.2,
  },
  smash: {
    prepare: 0.45,
    followTime: 0.3,
    recover: 0.9,
    load: [-0.3, 0.22, -0.4],
    follow: [0.32, -0.46, -1.3],
    twist: 0.65,
    squat: 0.015,
    lean: -0.04,
    open: 0.04,
    wrist: 0.58,
    turn: 0.75,
  },
  block: {
    prepare: 0.16,
    followTime: 0.14,
    recover: 0.46,
    load: [0.015, 0, 0.015],
    follow: [-0.035, 0, -0.015],
    twist: 0.02,
    squat: 0.12,
    lean: 0.07,
    open: -0.18,
    wrist: 0,
    turn: 0.15,
  },
  punch: {
    prepare: 0.17,
    followTime: 0.16,
    recover: 0.48,
    load: [-0.04, 0.01, 0],
    follow: [0.24, -0.035, 0.035],
    twist: 0.11,
    squat: 0.095,
    lean: 0.12,
    open: 0.035,
    wrist: 0.05,
    turn: 0.2,
  },
  reset: {
    prepare: 0.24,
    followTime: 0.2,
    recover: 0.58,
    load: [-0.065, 0.015, -0.045],
    follow: [0.07, 0, 0.055],
    twist: 0.025,
    squat: 0.15,
    lean: 0.04,
    open: -0.26,
    wrist: 0.01,
    turn: 0.18,
  },
  speedup: {
    prepare: 0.21,
    followTime: 0.19,
    recover: 0.62,
    load: [-0.11, 0.08, -0.1],
    follow: [0.28, -0.18, 0.24],
    twist: 0.28,
    squat: 0.11,
    lean: 0.1,
    open: 0.08,
    wrist: 0.22,
    turn: 0.3,
  },
  roll: {
    prepare: 0.22,
    followTime: 0.2,
    recover: 0.6,
    load: [-0.09, 0.055, -0.2],
    follow: [0.18, -0.18, 0.38],
    twist: 0.2,
    squat: 0.1,
    lean: 0.08,
    open: 0.07,
    wrist: 0.42,
    turn: 0.25,
  },
  flick: {
    prepare: 0.17,
    followTime: 0.15,
    recover: 0.5,
    load: [-0.035, 0.045, -0.065],
    follow: [0.13, -0.12, 0.2],
    twist: 0.1,
    squat: 0.08,
    lean: 0.075,
    open: 0.06,
    wrist: 0.62,
    turn: 0.22,
  },
  atp: {
    prepare: 0.32,
    followTime: 0.24,
    recover: 0.76,
    load: [-0.22, 0.18, -0.035],
    follow: [0.3, -0.26, 0.12],
    twist: 0.37,
    squat: 0.16,
    lean: 0.09,
    open: -0.09,
    wrist: 0.12,
    turn: 0.8,
  },
  erne: {
    prepare: 0.24,
    followTime: 0.18,
    recover: 0.64,
    load: [-0.08, 0.1, 0.015],
    follow: [0.24, -0.17, -0.08],
    twist: 0.28,
    squat: 0.045,
    lean: 0.17,
    open: 0.08,
    wrist: 0.15,
    turn: 0.6,
  },
};
export const strokePreparation = (type: ShotType) =>
  STROKE_MOTION[type].prepare;
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const hermite = (
  a: StrokeVector,
  b: StrokeVector,
  va: StrokeVector,
  vb: StrokeVector,
  u: number,
  duration: number,
): StrokeVector =>
  a.map(
    (v, i) =>
      (2 * u ** 3 - 3 * u * u + 1) * v +
      (u ** 3 - 2 * u * u + u) * duration * va[i] +
      (-2 * u ** 3 + 3 * u * u) * b[i] +
      (u ** 3 - u * u) * duration * vb[i],
  ) as StrokeVector;
export function sampleStroke(
  type: ShotType,
  time = 0,
  preparation = strokePreparation(type),
) {
  const profile = STROKE_MOTION[type],
    prepare = Math.max(0.06, preparation),
    loadTime = -prepare * 0.55;
  const t = Math.max(-prepare, time);
  const zero: StrokeVector = [0, 0, 0];
  const velocity = profile.follow.map(
    (v, i) => ((v - profile.load[i]) / (profile.followTime - loadTime)) * 0.8,
  ) as StrokeVector;
  let offset: StrokeVector = zero,
    loading = 0,
    follow = 0,
    recovery = 0;
  if (t < loadTime) {
    loading = smooth((t + prepare) / (loadTime + prepare));
    offset = profile.load.map((v) => v * loading) as StrokeVector;
  } else if (t < 0) {
    const u = (t - loadTime) / -loadTime;
    loading = 1 - smooth(u);
    offset = hermite(profile.load, zero, zero, velocity, u, -loadTime);
  } else if (t < profile.followTime) {
    const u = t / profile.followTime;
    follow = smooth(u);
    offset = hermite(
      zero,
      profile.follow,
      velocity,
      zero,
      u,
      profile.followTime,
    );
  } else {
    follow = 1;
    recovery = smooth(
      (t - profile.followTime) / (profile.recover - profile.followTime),
    );
    offset = profile.follow.map((v) => v * (1 - recovery)) as StrokeVector;
  }
  return {
    profile,
    offset,
    loading,
    follow,
    recovery,
    ready: t < loadTime ? 1 - loading : 0,
    twist: profile.twist * (loading + 0.12 - follow * 0.82) * (1 - recovery),
    hipTwist: profile.twist * (loading * 0.65 - follow * 0.65) * (1 - recovery),
    // Wrist pronation is strongest on Roll/Flick and through the overhead snap.
    facePitch:
      profile.open + profile.wrist * (follow - loading * 0.35) * (1 - recovery),
    faceYaw: (loading * 0.28 - follow * 0.52) * profile.twist * (1 - recovery),
    weight: mix(-0.055, 0.11, follow) * (1 - recovery) - loading * 0.06,
    hop:
      type === "erne"
        ? (1 - recovery) *
          0.13 *
          Math.max(0, Math.sin(((t + prepare * 0.3) / 0.48) * Math.PI))
        : 0,
  };
}
