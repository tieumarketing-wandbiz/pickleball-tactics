// Body and limb volumes for the arm clearance (rig-guide §8, animation-principles §3).
// Numbers are measured on public/models/male-rigged.glb in app space (1.8 m, facing −Z) from the
// bind-pose mesh: .agents/scratch/sonnet/measure*.ts, summarised in .agents/status/sonnet.md.
import * as T from "three";

/**
 * Torso cross-section attached to a spine bone. All values are rest-pose character-space numbers
 * measured by casting rays at the bind mesh (.agents/scratch/sonnet/rays.ts; sections are ellipses,
 * wider than deep): `along` = offset up the bone's own height, `fwd` = how far in front of the
 * joint the section's centre lies (the Tripo spine joints sit 4–6 cm behind the mesh centre),
 * `hx`/`hz` = half width / half depth. Pelvis 0.152×0.104, waist 0.133×0.097, chest 0.16×0.134.
 */
export interface SectionSpec {
  bone: string;
  along: number;
  fwd: number;
  hx: number;
  hz: number;
}
export const TORSO_SECTIONS: readonly SectionSpec[] = [
  { bone: "Hips", along: 0, fwd: 0.039, hx: 0.152, hz: 0.104 },
  { bone: "Spine", along: 0, fwd: 0.057, hx: 0.133, hz: 0.097 },
  { bone: "Spine1", along: 0, fwd: 0.06, hx: 0.139, hz: 0.114 },
  { bone: "Spine2", along: 0, fwd: 0.047, hx: 0.16, hz: 0.134 },
  { bone: "Spine2", along: 0.09, fwd: 0.023, hx: 0.155, hz: 0.105 },
];
/** Thigh capsules (UpLeg → Leg joint): radius at the hip and at the knee. */
export const THIGH_RADIUS = [0.095, 0.065] as const;
/** Limb radii measured on the mesh (p90 of the vertex distance to the bone segment). */
export const UPPER_ARM_RADIUS = [0.075, 0.075, 0.07, 0.06] as const; // u = 0.5, 0.7, 0.85, 1
export const FOREARM_RADIUS = [0.055, 0.048, 0.041, 0.037] as const; // u = 0, 0.35, 0.7, 1
export const HAND_RADIUS = 0.045;
/** Upper-arm samples start here (the first half is the deltoid, which merges into the shoulder). */
export const UPPER_ARM_SAMPLES = [0.5, 0.7, 0.85, 1] as const;
export const FOREARM_SAMPLES = [0, 0.35, 0.7, 1] as const;
/** Distance from the wrist joint to the palm centre along the forearm direction. */
export const PALM_REACH = 0.055;
/** Required free space between the limb surface and the body surface. */
export const ARM_CLEARANCE = 0.03;

interface Section {
  c: T.Vector3;
  q: T.Quaternion;
  hx: number;
  hz: number;
}
const _p = new T.Vector3(),
  _l = new T.Vector3(),
  _q = new T.Quaternion(),
  _qi = new T.Quaternion(),
  _ab = new T.Vector3(),
  _n = new T.Vector3(),
  _best = new T.Vector3();

/** Approximate signed distance to an ellipse (negative inside) and the outward normal (x, z). */
function ellipse(x: number, z: number, hx: number, hz: number, out: T.Vector2) {
  const e = Math.hypot(x / hx, z / hz);
  const gx = x / (hx * hx),
    gz = z / (hz * hz);
  const g = Math.hypot(gx, gz);
  if (e < 1e-6 || g < 1e-9) {
    out.set(1, 0);
    return -Math.min(hx, hz);
  }
  out.set(gx / g, gz / g);
  return ((e - 1) * e) / g;
}
const _e = new T.Vector2();

/**
 * Torso (chain of elliptical sections along the spine) plus both thighs, in the space of the
 * joint positions given to `update`. `gap` is the signed distance from a point to the surface.
 */
export class BodyVolume {
  readonly sections: Section[] = TORSO_SECTIONS.map(() => ({
    c: new T.Vector3(),
    q: new T.Quaternion(),
    hx: 0,
    hz: 0,
  }));
  readonly thigh = [0, 1].map(() => ({ a: new T.Vector3(), b: new T.Vector3() }));
  /** Chest front direction (unit), for callers that need "forward of the torso". */
  readonly front = new T.Vector3(0, 0, -1);
  /**
   * @param joint position of a spine bone in character space
   * @param delta rotation of that bone away from its rest orientation (character space)
   */
  update(
    joint: (spec: SectionSpec) => T.Vector3,
    delta: (spec: SectionSpec) => T.Quaternion,
    thighs: readonly [[T.Vector3, T.Vector3], [T.Vector3, T.Vector3]],
  ) {
    TORSO_SECTIONS.forEach((spec, i) => {
      const s = this.sections[i],
        d = delta(spec);
      s.q.copy(d);
      s.c.copy(joint(spec)).add(_l.set(0, spec.along, -spec.fwd).applyQuaternion(d));
      s.hx = spec.hx;
      s.hz = spec.hz;
    });
    this.front.set(0, 0, -1).applyQuaternion(this.sections[3].q);
    this.thigh.forEach((t, i) => {
      t.a.copy(thighs[i][0]);
      t.b.copy(thighs[i][1]);
    });
  }
  /** Signed distance from `p` to the body surface (negative inside); `normal` = outward direction. */
  gap(p: T.Vector3, normal?: T.Vector3) {
    let best = Infinity;
    const n = this.sections.length;
    for (let i = 0; i < n - 1; i++) {
      const a = this.sections[i],
        b = this.sections[i + 1];
      _ab.copy(b.c).sub(a.c);
      const len2 = _ab.lengthSq();
      const raw = _l.copy(p).sub(a.c).dot(_ab) / len2;
      const u = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      _q.copy(a.q).slerp(b.q, u);
      // point relative to the section centre, in the section frame
      _p.copy(a.c).lerp(b.c, u);
      _l.copy(p).sub(_p).applyQuaternion(_qi.copy(_q).invert());
      const d2 = ellipse(_l.x, _l.z, a.hx + (b.hx - a.hx) * u, a.hz + (b.hz - a.hz) * u, _e);
      // beyond the ends of the chain: distance to the flat cap
      const end = (i === 0 && raw < 0) || (i === n - 2 && raw > 1);
      let d = d2;
      if (end) {
        const axial = (raw < 0 ? -raw : raw - 1) * Math.sqrt(len2);
        d = d2 > 0 ? Math.hypot(d2, axial) : axial;
      }
      if (d < best) {
        best = d;
        if (normal) {
          if (end && d2 <= 0)
            normal.copy(_ab).multiplyScalar(raw < 0 ? -1 : 1).normalize();
          else normal.set(_e.x, 0, _e.y).applyQuaternion(_q);
        }
      }
    }
    for (const t of this.thigh) {
      _ab.copy(t.b).sub(t.a);
      const u = Math.max(0, Math.min(1, _l.copy(p).sub(t.a).dot(_ab) / _ab.lengthSq()));
      _p.copy(t.a).addScaledVector(_ab, u);
      const d = p.distanceTo(_p) - (THIGH_RADIUS[0] + (THIGH_RADIUS[1] - THIGH_RADIUS[0]) * u);
      if (d < best) {
        best = d;
        if (normal) normal.copy(p).sub(_p).normalize();
      }
    }
    return best;
  }
}

/** Limb sample points (marker/character space) and radii of one arm. */
export interface ArmSamples {
  points: T.Vector3[];
  radii: number[];
}
export function makeArmSamples(): ArmSamples {
  const n = UPPER_ARM_SAMPLES.length + FOREARM_SAMPLES.length + 1;
  return { points: Array.from({ length: n }, () => new T.Vector3()), radii: new Array(n).fill(0) };
}
/** Fills the sample points for the arm shoulder → elbow → wrist (character space). */
export function sampleArm(
  s: T.Vector3,
  e: T.Vector3,
  w: T.Vector3,
  out: ArmSamples,
) {
  let k = 0;
  for (let i = 0; i < UPPER_ARM_SAMPLES.length; i++, k++) {
    out.points[k].lerpVectors(s, e, UPPER_ARM_SAMPLES[i]);
    out.radii[k] = UPPER_ARM_RADIUS[i];
  }
  for (let i = 0; i < FOREARM_SAMPLES.length; i++, k++) {
    out.points[k].lerpVectors(e, w, FOREARM_SAMPLES[i]);
    out.radii[k] = FOREARM_RADIUS[i];
  }
  _n.copy(w).sub(e).normalize();
  out.points[k].copy(w).addScaledVector(_n, PALM_REACH);
  out.radii[k] = HAND_RADIUS;
  return out;
}
/** Smallest limb-surface-to-body-surface distance of the arm (negative = penetration). */
export function armGap(
  body: BodyVolume,
  s: T.Vector3,
  e: T.Vector3,
  w: T.Vector3,
  samples: ArmSamples,
  normal?: T.Vector3,
) {
  sampleArm(s, e, w, samples);
  let best = Infinity;
  for (let i = 0; i < samples.points.length; i++) {
    const g = body.gap(samples.points[i], normal ? _best : undefined) - samples.radii[i];
    if (g < best) {
      best = g;
      if (normal) normal.copy(_best);
    }
  }
  return best;
}
