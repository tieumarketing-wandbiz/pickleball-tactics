import type { ShotType } from "./constants";
export const SPIN_TYPES = ["none", "top", "back", "left", "right"] as const;
export type SpinType = (typeof SPIN_TYPES)[number];
export interface Spin {
  type: SpinType;
  strength: number;
}
export const SPIN_NAMES: Record<SpinType, string> = {
  none: "Không xoáy",
  top: "Topspin / xoáy trên",
  back: "Backspin / xoáy dưới",
  left: "Sidespin trái",
  right: "Sidespin phải",
};
export function defaultSpin(type: ShotType): Spin {
  const strength: Partial<Record<ShotType, number>> = {
    roll: 0.65,
    flick: 0.45,
    speedup: 0.35,
    punch: 0.2,
    drive: 0.3,
  };
  return strength[type]
    ? { type: "top", strength: strength[type]! }
    : { type: "none", strength: 0 };
}
// Exact response of v' = a - drag*v. expm1 avoids cancellation for weak spin.
export const travel = (t: number, drag: number) =>
  drag > 1e-8 ? -Math.expm1(-drag * t) / drag : t;
export const forcedTravel = (t: number, drag: number) =>
  drag > 1e-6 ? (t - travel(t, drag)) / drag : (t * t) / 2;
export const horizontal = (
  p: number,
  v: number,
  a: number,
  drag: number,
  t: number,
) => p + v * travel(t, drag) + a * forcedTravel(t, drag);
export const speed = (v: number, a: number, drag: number, t: number) =>
  v * Math.exp(-drag * t) + a * travel(t, drag);
// z(t) has at most one extremum. Bracket each monotone interval, then refine
// crossings independently of render frame rate; no sampled collision test.
export function planeCrossings(
  z: number,
  v: number,
  a: number,
  drag: number,
  duration: number,
): number[] {
  const knots = [0, duration];
  let turning: number | undefined;
  if (drag > 1e-8) {
    const ratio = -a / (drag * v - a);
    if (ratio > 0) turning = -Math.log(ratio) / drag;
  } else if (Math.abs(a) > 1e-10) turning = -v / a;
  if (turning !== undefined && turning > 0 && turning < duration)
    knots.splice(1, 0, turning);
  const roots: number[] = [];
  const f = (t: number) => horizontal(z, v, a, drag, t);
  for (let i = 0; i < knots.length - 1; i++) {
    let lo = knots[i],
      hi = knots[i + 1];
    let a0 = f(lo),
      b0 = f(hi);
    if (Math.abs(a0) < 1e-10) roots.push(lo);
    if (a0 * b0 < 0) {
      for (let j = 0; j < 50; j++) {
        const mid = (lo + hi) / 2,
          value = f(mid);
        if (a0 * value <= 0) hi = mid;
        else {
          lo = mid;
          a0 = value;
        }
      }
      roots.push((lo + hi) / 2);
    }
    if (Math.abs(b0) < 1e-10) roots.push(knots[i + 1]);
  }
  return [...new Set(roots.map((t) => Math.round(t * 1e10) / 1e10))].sort(
    (a, b) => a - b,
  );
}

export function shotSpin(shot: {
  type: ShotType;
  topspin?: boolean;
  spin?: Spin;
}): Spin {
  if (shot.topspin === undefined)
    return shot.spin ?? { type: "none", strength: 0 };
  if (!shot.topspin) return { type: "none", strength: 0 };
  return { type: "top", strength: defaultSpin(shot.type).strength || 0.45 };
}
export function predictRestitution(
  type: ShotType,
  impactSpeed: number,
  topspin: number,
): number {
  const baseline: Record<ShotType, number> = {
    serve: 0.68,
    drive: 0.72,
    dink: 0.6,
    drop: 0.64,
    lob: 0.7,
    volley: 0.66,
    smash: 0.74,
    block: 0.62,
    punch: 0.7,
    reset: 0.58,
    speedup: 0.71,
    roll: 0.68,
    flick: 0.7,
    atp: 0.62,
    erne: 0.65,
  };
  return Math.max(
    0.5,
    Math.min(
      0.8,
      baseline[type] - 0.0015 * Math.max(0, impactSpeed - 6) + 0.02 * topspin,
    ),
  );
}
