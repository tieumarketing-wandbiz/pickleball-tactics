/** Shared by the 240 Hz regression tests and .agents/scratch/jerk.ts; not imported by the app. */
export const AUDIT_DT = 1 / 240;
export type AuditPoint = { x: number; y: number; z: number };
export interface MotionAudit { jumps: Record<string, { value: number; time: number }>; peakSpeed: number; peakTime: number }
export function auditMotion(sample: (t: number) => Record<string, AuditPoint>, start: number, end: number): MotionAudit {
  const result: MotionAudit = { jumps: {}, peakSpeed: 0, peakTime: 0 };
  let before: Record<string, AuditPoint> | undefined, priorVelocity: Record<string, AuditPoint> | undefined;
  for (let i = Math.floor(start / AUDIT_DT); i <= Math.ceil(end / AUDIT_DT); i++) {
    const t = i * AUDIT_DT, points = sample(t), velocity: Record<string, AuditPoint> = {};
    if (before) for (const [name, p] of Object.entries(points)) {
      const a = before[name]; if (!a) continue;
      const v = { x: (p.x - a.x) / AUDIT_DT, y: (p.y - a.y) / AUDIT_DT, z: (p.z - a.z) / AUDIT_DT };
      velocity[name] = v;
      const speed = Math.hypot(v.x, v.y, v.z);
      if (name === 'paddle' && speed > result.peakSpeed) { result.peakSpeed = speed; result.peakTime = t - AUDIT_DT / 2; }
      const old = priorVelocity?.[name]; if (!old) continue;
      const jump = Math.hypot(v.x - old.x, v.y - old.y, v.z - old.z);
      if (jump > (result.jumps[name]?.value ?? -1)) result.jumps[name] = { value: jump, time: t - AUDIT_DT };
    }
    before = points; priorVelocity = velocity;
  }
  return result;
}
