/** Seekable motion curves; tangents are velocities in units/second, not per-segment offsets. */
export const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
export const smooth = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
export const smoother = (u: number) => {
  const x = clamp01(u);
  return x ** 3 * (10 + x * (-15 + 6 * x));
};
export function hermite(a: number, b: number, va: number, vb: number, duration: number, u: number) {
  return (2 * u ** 3 - 3 * u * u + 1) * a + (u ** 3 - 2 * u * u + u) * duration * va
    + (-2 * u ** 3 + 3 * u * u) * b + (u ** 3 - u * u) * duration * vb;
}
export function hermiteVelocity(a: number, b: number, va: number, vb: number, duration: number, u: number) {
  return ((6 * u * u - 6 * u) * a + (3 * u * u - 4 * u + 1) * duration * va
    + (-6 * u * u + 6 * u) * b + (3 * u * u - 2 * u) * duration * vb) / duration;
}
/** 5–6% settle overshoot, with zero velocity at BOTH ends (unlike easeOutBack). */
export function settle(u: number) {
  const x = clamp01(u);
  return smoother(x) + 5 * x ** 3 * (1 - x) ** 2;
}
