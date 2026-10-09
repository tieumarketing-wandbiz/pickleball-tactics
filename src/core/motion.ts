/** Time-domain quintic Hermite: shared position, velocity and acceleration at every key. */
export function hermite(
  a: number, b: number, va: number, vb: number, duration: number, u: number,
  aa = 0, ab = 0,
) {
  const c0 = a, c1 = va * duration, c2 = aa * duration * duration / 2;
  const d = b - c0 - c1 - c2, v = vb * duration - c1 - 2 * c2;
  const acc = ab * duration * duration - 2 * c2;
  const c3 = 10 * d - 4 * v + acc / 2;
  const c4 = -15 * d + 7 * v - acc;
  const c5 = 6 * d - 3 * v + acc / 2;
  return c0 + u * (c1 + u * (c2 + u * (c3 + u * (c4 + u * c5))));
}
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => {
  const u = clamp01(x);
  return u * u * u * (10 + u * (-15 + 6 * u));
};
/** Exact C1 clamp; rounds each corner over `width`, without violating the outer bounds. */
export function softClamp(x: number, lo: number, hi: number, width: number) {
  const w = Math.min(width, (hi - lo) / 2);
  if (x <= lo) return lo;
  if (x < lo + w) {
    const u = (x - lo) / w;
    return lo + w * u * u * (2 - u);
  }
  if (x >= hi) return hi;
  if (x > hi - w) {
    const u = (hi - x) / w;
    return hi - w * u * u * (2 - u);
  }
  return x;
}
/** Compact inertial offset: preserves the old position/velocity, vanishes exactly at the end. */
export const inertialOffset = (offset: number, velocity: number, t: number, duration: number) =>
  t >= duration ? 0 : hermite(offset, 0, velocity, 0, duration, clamp01(t / duration));
