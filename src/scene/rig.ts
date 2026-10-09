// Rig math for driving the Mixamo skeleton from world-space targets
// (.agents/reference/rig-guide.md §1.5, §2.3, §2.4, §4.2). All solves are absolute: every frame is
// computed from rest data cached at load, so nothing drifts.
import * as T from "three";
import { softClamp } from "../core/motion";

const MIXAMO_PREFIX = /^mixamorig\d*[:_]?/i;
/** "mixamorig:LeftHand" / "mixamorigLeftHand" / "mixamorig1_LeftHand" → "LeftHand". */
export const canonicalBoneName = (o: T.Object3D) =>
  String(o.userData?.name ?? o.name).replace(MIXAMO_PREFIX, "");
/** Every Mixamo node below `root` (bones and the pruned end markers) by canonical name. */
export function collectBones(root: T.Object3D) {
  const map = new Map<string, T.Object3D>();
  root.traverse((o) => {
    if (MIXAMO_PREFIX.test(String(o.userData?.name ?? o.name)))
      map.set(canonicalBoneName(o), o);
  });
  return map;
}

const _m = new T.Matrix4(),
  _x = new T.Vector3(),
  _y = new T.Vector3(),
  _z = new T.Vector3(),
  _p = new T.Vector3(),
  _s = new T.Vector3(),
  _pq = new T.Quaternion(),
  _q = new T.Quaternion();

/** Rotation whose +Y = fwd and whose +Z = ref made perpendicular to fwd. */
export function basisQuat(
  fwd: T.Vector3,
  ref: T.Vector3,
  out: T.Quaternion,
): T.Quaternion {
  _y.copy(fwd).normalize();
  _z.copy(ref).addScaledVector(_y, -ref.dot(_y));
  if (_z.lengthSq() < 1e-10) {
    // ref parallel to fwd: any perpendicular will do
    _z.set(Math.abs(_y.x) < 0.9 ? 1 : 0, Math.abs(_y.x) < 0.9 ? 0 : 1, 0);
    _z.addScaledVector(_y, -_z.dot(_y));
  }
  _z.normalize();
  _x.crossVectors(_y, _z);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}
/** Sets a bone's world rotation; the parent's matrixWorld must be current (solve top-down). */
export function setWorldQuat(bone: T.Object3D, qW: T.Quaternion) {
  bone.parent!.matrixWorld.decompose(_p, _pq, _s);
  bone.quaternion.copy(_pq.invert().multiply(qW));
  bone.updateWorldMatrix(false, false);
}
/** World rotation of an object from its (current) matrixWorld. */
export function worldQuat(o: T.Object3D, out: T.Quaternion) {
  o.matrixWorld.decompose(_p, out, _s);
  return out;
}
export const worldPos = (o: T.Object3D, out: T.Vector3) =>
  out.setFromMatrixPosition(o.matrixWorld);

/** Aim constraint calibrated in the rest pose: bone axis toward its child, `ref` fixes the roll. */
export interface Aim {
  bone: T.Object3D;
  frameInv: T.Quaternion;
  length: number;
}
/** Calibrate in rest (world matrices current). `refWorldRest` is the anatomical reference direction. */
export function makeAim(
  bone: T.Object3D,
  child: T.Object3D,
  refWorldRest: T.Vector3,
): Aim {
  const a = worldPos(bone, new T.Vector3()),
    b = worldPos(child, new T.Vector3());
  const dirW = b.clone().sub(a);
  const restW = worldQuat(bone, new T.Quaternion());
  // world frame(dir, ref) = restW · local frame  ⇒ frameInv = inverse(frame) · restW
  const frameInv = basisQuat(dirW, refWorldRest, new T.Quaternion())
    .invert()
    .multiply(restW);
  return { bone, frameInv, length: dirW.length() };
}
export function aim(a: Aim, dirW: T.Vector3, refW: T.Vector3) {
  setWorldQuat(a.bone, basisQuat(dirW, refW, _q).multiply(a.frameInv));
}
/** Twist part of `q` about the unit `axis` (swing-twist decomposition). */
export function twistAbout(
  q: T.Quaternion,
  axis: T.Vector3,
  out: T.Quaternion,
): T.Quaternion {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  out.set(axis.x * d, axis.y * d, axis.z * d, q.w);
  if (out.lengthSq() < 1e-12) return out.identity();
  out.normalize();
  if (out.w < 0) out.set(-out.x, -out.y, -out.z, -out.w);
  return out;
}
/** Signed angle (rad) of a pure twist quaternion about `axis`. */
export const twistAngle = (q: T.Quaternion, axis: T.Vector3) =>
  2 * Math.atan2(q.x * axis.x + q.y * axis.y + q.z * axis.z, q.w);

/** Interior joint angle (rad) ↔ distance between the outer ends of a two-bone chain. */
export const chainReach = (l1: number, l2: number, interior: number) =>
  Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(interior));
/**
 * Analytic two-bone IK with an explicit pole (rig-guide §2.4). Writes the middle joint into
 * `mid` and the (reach-clamped) end into `end`; returns the unit bend direction in `bend`.
 */
export function twoBone(
  root: T.Vector3,
  target: T.Vector3,
  l1: number,
  l2: number,
  pole: T.Vector3,
  minReach: number,
  maxReach: number,
  mid: T.Vector3,
  end: T.Vector3,
  bend: T.Vector3,
  rounding = 0.06,
) {
  const d = _x.copy(target).sub(root);
  let L = d.length();
  if (L < 1e-6) d.set(0, -1, 0), (L = 1e-6);
  d.divideScalar(L);
  L = softClamp(L, minReach, maxReach, rounding);
  const cosA = T.MathUtils.clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  bend.copy(pole).addScaledVector(d, -pole.dot(d));
  if (bend.lengthSq() < 1e-8) {
    bend.set(0, 0, 1).addScaledVector(d, -d.z);
    if (bend.lengthSq() < 1e-8) bend.set(1, 0, 0).addScaledVector(d, -d.x);
  }
  bend.normalize();
  mid
    .copy(root)
    .addScaledVector(d, l1 * cosA)
    .addScaledVector(bend, l1 * Math.sqrt(1 - cosA * cosA));
  end.copy(root).addScaledVector(d, L);
}

/**
 * Torso volume: capsule with an elliptical cross-section (wider than deep), described in the
 * chest frame. Used by the limb-volume clearance (rig-guide §8, animation-principles §3).
 */
export interface TorsoCapsule {
  a: T.Vector3;
  b: T.Vector3;
  /** half width (lateral) */
  radius: number;
  /** width / depth of the cross-section */
  squash: number;
  /** unit depth axis (front) of the cross-section */
  front: T.Vector3;
}
const _o = new T.Vector3(),
  _ab = new T.Vector3();
/**
 * Approximate signed distance from `p` to the capsule surface (negative inside), and the outward
 * push direction in `normal` (if given).
 */
export function capsuleGap(c: TorsoCapsule, p: T.Vector3, normal?: T.Vector3) {
  _ab.copy(c.b).sub(c.a);
  const u = T.MathUtils.clamp(_o.copy(p).sub(c.a).dot(_ab) / _ab.lengthSq(), 0, 1);
  _o.copy(p).sub(c.a).addScaledVector(_ab, -u);
  const depth = _o.dot(c.front);
  const plain = _o.length();
  const scaledSq = plain * plain + depth * depth * (c.squash * c.squash - 1);
  const scaled = Math.sqrt(Math.max(scaledSq, 1e-12));
  if (normal) {
    normal.copy(_o).addScaledVector(c.front, depth * (c.squash * c.squash - 1));
    if (normal.lengthSq() < 1e-10) normal.copy(c.front);
    normal.normalize();
  }
  return ((scaled - c.radius) * plain) / scaled;
}
/** Smallest gap between a sampled segment (radius `r`) and a set of capsules. */
export function segmentGap(
  capsules: TorsoCapsule[],
  from: T.Vector3,
  to: T.Vector3,
  r: number,
  samples = 6,
  normal?: T.Vector3,
) {
  let best = Infinity;
  const p = new T.Vector3(),
    n = new T.Vector3();
  for (let i = 0; i <= samples; i++) {
    p.lerpVectors(from, to, i / samples);
    for (const c of capsules) {
      const gap = capsuleGap(c, p, n) - r;
      if (gap < best) {
        best = gap;
        normal?.copy(n);
      }
    }
  }
  return best;
}
