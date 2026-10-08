import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { playerPose } from "../core/player-pose";
import { gripFrame, closeGripVertex, handGripBasis } from "./grip";
import { PADDLE_GRIP_Y, PADDLE_SUPPORT_OFFSET } from "./paddle";
import type { Player, Shot } from "../core/scenario";

const v = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
// Landmarks fitted to the supplied A-pose mesh after height/axis normalization.
const rest = {
  pelvis: v(0, 0.95),
  chest: v(0, 1.12),
  head: v(0, 1.58),
  clavicleL: v(-0.11, 1.43, 0.13),
  fingerL: v(-0.668, 1.045, 0.085),
  upperL: v(-0.235, 1.43, 0.13),
  lowerL: v(-0.46, 1.24, 0.13),
  handL: v(-0.625, 1.105, 0.085),
  clavicleR: v(0.11, 1.43, 0.13),
  fingerR: v(0.668, 1.045, 0.085),
  upperR: v(0.235, 1.43, 0.13),
  lowerR: v(0.46, 1.24, 0.13),
  handR: v(0.625, 1.105, 0.085),
  thighL: v(-0.125, 0.94),
  shinL: v(-0.14, 0.48),
  footL: v(-0.14, 0.12),
  thighR: v(0.125, 0.94),
  shinR: v(0.14, 0.48),
  footR: v(0.14, 0.12),
};
type Joint = keyof typeof rest;
const names = Object.keys(rest) as Joint[];
const ends: Record<Joint, T.Vector3> = {
  pelvis: rest.chest,
  chest: rest.head,
  head: v(0, 1.79),
  clavicleL: rest.upperL,
  fingerL: v(-0.7, 0.985, 0.085),
  upperL: rest.lowerL,
  lowerL: rest.handL,
  handL: rest.fingerL,
  clavicleR: rest.upperR,
  fingerR: v(0.7, 0.985, 0.085),
  upperR: rest.lowerR,
  lowerR: rest.handR,
  handR: rest.fingerR,
  thighL: rest.shinL,
  shinL: rest.footL,
  footL: v(-0.14, 0.055, -0.12),
  thighR: rest.shinR,
  shinR: rest.footR,
  footR: v(0.14, 0.055, -0.12),
};
const segmentDistance = (p: T.Vector3, a: T.Vector3, b: T.Vector3) => {
  const d = b.clone().sub(a);
  const u = T.MathUtils.clamp(p.clone().sub(a).dot(d) / d.lengthSq(), 0, 1);
  return p.distanceToSquared(a.clone().addScaledVector(d, u));
};
export async function loadHumanoidGeometry() {
  const gltf = await new GLTFLoader().loadAsync("/models/male-base.glb");
  gltf.scene.updateMatrixWorld(true);
  let source: T.Mesh | undefined;
  gltf.scene.traverse((o) => {
    if ((o as T.Mesh).isMesh) source = o as T.Mesh;
  });
  if (!source) throw new Error("GLB không có mesh người.");
  return prepareHumanoidGeometry(source as T.Mesh);
}
export function prepareHumanoidGeometry(mesh: T.Mesh) {
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, 0);
  geometry.scale(1.8 / height, 1.8 / height, 1.8 / height);
  geometry.rotateY(Math.PI); // File faces +z; court rig faces -z.
  const pos = geometry.getAttribute("position");
  const index = new Uint16Array(pos.count * 4),
    weights = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const p = new T.Vector3().fromBufferAttribute(pos, i);
    let candidates = names.filter((n) =>
      p.y < 0.94
        ? [
            "pelvis",
            "thighL",
            "shinL",
            "footL",
            "thighR",
            "shinR",
            "footR",
          ].includes(n)
        : !n.startsWith("thigh") &&
          !n.startsWith("shin") &&
          !n.startsWith("foot"),
    );
    // Separate left/right limbs while retaining torso influence at the shoulder/hip.
    candidates = candidates.filter((n) => !n.endsWith(p.x < 0 ? "R" : "L"));
    const nearest = candidates
      .map((n) => ({ n, d: segmentDistance(p, rest[n], ends[n]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
    const scores = nearest.map((e) => Math.exp(-(e.d - nearest[0].d) / 0.005));
    const total = scores.reduce((a, b) => a + b, 0);
    nearest.forEach((e, k) => {
      index[i * 4 + k] = names.indexOf(e.n);
      weights[i * 4 + k] = scores[k] / total;
    });
    // Keep the closed fingers rigidly attached to the palm, then blend only
    // across the wrist so forearm IK cannot stretch the finger curl.
    if (Math.abs(p.x) > 0.55 && p.y < 1.16 && p.y > 0.94) {
      const sign = p.x < 0 ? -1 : 1;
      const b = handGripBasis(sign);
      const along = p.clone().sub(b.wrist).dot(b.length);
      const handWeight = T.MathUtils.smoothstep(along, 0.0, 0.035);
      if (handWeight > 0) {
        let otherTotal = 0;
        const handIndex = names.indexOf(sign < 0 ? "handL" : "handR");
        for (let k = 0; k < 4; k++) {
          weights[i * 4 + k] *= 1 - handWeight;
          otherTotal += weights[i * 4 + k];
        }
        // Replace the weakest contributor, then renormalize the remaining blend.
        let weakest = 0;
        for (let k = 1; k < 4; k++)
          if (weights[i * 4 + k] < weights[i * 4 + weakest]) weakest = k;
        otherTotal -= weights[i * 4 + weakest];
        index[i * 4 + weakest] = handIndex;
        weights[i * 4 + weakest] = handWeight;
        const sum = otherTotal + handWeight;
        for (let k = 0; k < 4; k++) weights[i * 4 + k] /= sum;
      }
    }
  }
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(index, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
  geometry.morphAttributes.position = [-1, 1].map((sign) => {
    const target = pos.clone();
    for (let i = 0; i < pos.count; i++) {
      const point = closeGripVertex(
        new T.Vector3().fromBufferAttribute(pos, i),
        sign,
      );
      target.setXYZ(i, point.x, point.y, point.z);
    }
    return target;
  });
  geometry.morphAttributes.normal = geometry.morphAttributes.position.map(
    (target) => {
      const surface = geometry.clone();
      surface.setAttribute("position", target.clone());
      surface.computeVertexNormals();
      const normal = surface.getAttribute("normal").clone();
      surface.dispose();
      return normal;
    },
  );
  geometry.computeVertexNormals();
  return geometry;
}
export class Humanoid {
  mesh: T.SkinnedMesh;
  private bones = new Map<Joint, T.Bone>();
  private gait = 0;
  private walkPhase = 0;
  private anchors = new Map<string, { point: T.Vector3; swinging: boolean }>();
  constructor(geometry: T.BufferGeometry, team: "A" | "B") {
    const g = geometry.clone();
    const pos = g.getAttribute("position"),
      colors = new Float32Array(pos.count * 3);
    const shirt = new T.Color(team === "A" ? 0xf2a274 : 0x70d9c1),
      skin = new T.Color(0xc4a28b),
      shorts = new T.Color(0x203b47),
      shoe = new T.Color(0xe4e9df);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i),
        x = Math.abs(pos.getX(i));
      const c =
        x > 0.48 && y > 0.9
          ? skin
          : y < 0.16
            ? shoe
            : y < 0.72
              ? skin
              : y < 1.04
                ? shorts
                : y > 1.53 || x > 0.48
                  ? skin
                  : shirt;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    this.mesh = new T.SkinnedMesh(
      g,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0,
        side: T.DoubleSide,
      }),
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    const root = new T.Bone();
    this.mesh.add(root);
    for (const n of names) {
      const bone = new T.Bone();
      bone.name = n;
      bone.position.copy(rest[n]);
      root.add(bone);
      this.bones.set(n, bone);
    }
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new T.Skeleton(names.map((n) => this.bones.get(n)!)));
    // Conservative bounds permit picking limbs in every pose without CPU skinning per frame.
    this.mesh.boundingSphere = new T.Sphere(v(0, 1), 2.2);
  }
  private joint(n: Joint, p: T.Vector3, q: T.Quaternion) {
    const b = this.bones.get(n)!;
    b.position.copy(p);
    b.quaternion.copy(q);
  }
  private segment(n: Joint, a: T.Vector3, b: T.Vector3, frame: T.Quaternion) {
    const axis = ends[n]
      .clone()
      .sub(rest[n])
      .normalize()
      .applyQuaternion(frame);
    const target = b.clone().sub(a).normalize();
    const q = new T.Quaternion()
      .setFromUnitVectors(axis, target)
      .multiply(frame);
    this.joint(n, a, q);
    return q;
  }
  private solve(
    a: T.Vector3,
    target: T.Vector3,
    l1: number,
    l2: number,
    bend: T.Vector3,
  ) {
    const d = target.clone().sub(a),
      length = T.MathUtils.clamp(
        d.length(),
        Math.abs(l1 - l2) + 0.005,
        l1 + l2 - 0.003,
      );
    d.normalize();
    const end = a.clone().addScaledVector(d, length);
    const along = (l1 * l1 - l2 * l2 + length * length) / (2 * length);
    bend.addScaledVector(d, -bend.dot(d));
    if (bend.lengthSq() < 0.0001) bend.set(1, 0, 0).addScaledVector(d, -d.x);
    const elbow = a
      .clone()
      .addScaledVector(d, along)
      .addScaledVector(
        bend.normalize(),
        Math.sqrt(Math.max(0, l1 * l1 - along * along)),
      );
    return { elbow, end };
  }
  pose(
    p: Player,
    shot: Shot | undefined,
    time: number | undefined,
    paddle: T.Group,
    movement?: { velocity: T.Vector3; clock: number; dt: number },
    preparation?: number,
  ) {
    const pose = playerPose(p, shot, time, preparation),
      bodyQ = new T.Quaternion().setFromEuler(
        new T.Euler(pose.pitch, pose.yaw, pose.roll, "YXZ"),
      );
    const stanceQ = new T.Quaternion().setFromAxisAngle(
      v(0, 1),
      pose.stanceYaw,
    );
    const forward = v(pose.forward.x, 0, pose.forward.z),
      right = v(pose.right.x, 0, pose.right.z);
    const low =
      pose.active && shot
        ? T.MathUtils.clamp((0.85 - shot.from.y) / 0.75, 0, 1)
        : 0;
    const hips = v(
      pose.hip.x,
      Math.max(0.43, pose.hip.y + 0.23 - low * 0.25) + pose.hop,
      pose.hip.z,
    );
    const targetGait = movement
      ? T.MathUtils.clamp(movement.velocity.length() * 0.07, 0, 0.18)
      : 0;
    this.gait = movement
      ? T.MathUtils.lerp(this.gait, targetGait, Math.min(1, movement.dt * 12))
      : 0;
    const direction =
      movement && movement.velocity.lengthSq() > 0.001
        ? movement.velocity.clone().normalize()
        : forward;
    if (movement)
      this.walkPhase +=
        movement.dt * (7 + Math.min(movement.velocity.length(), 3) * 3.5);
    const phase = this.walkPhase + (p.id.charCodeAt(1) - 49) * Math.PI;
    hips.y += this.gait * 0.08 * Math.abs(Math.sin(phase));
    const torso = (point: T.Vector3) =>
      point.clone().sub(rest.pelvis).applyQuaternion(bodyQ).add(hips);
    const hipQ = new T.Quaternion().setFromEuler(
      new T.Euler(pose.pitch * 0.4, pose.hipYaw, pose.roll * 0.4, "YXZ"),
    );
    this.joint("pelvis", hips, hipQ);
    this.joint("chest", torso(rest.chest), bodyQ);
    this.joint(
      "head",
      torso(rest.head),
      bodyQ
        .clone()
        .multiply(new T.Quaternion().setFromAxisAngle(v(1, 0), pose.track)),
    );
    for (const [suffix, sign] of [
      ["L", -1],
      ["R", 1],
    ] as const) {
      const hip = hips.clone().addScaledVector(right, sign * 0.125);
      const legPhase =
        (((phase + (sign < 0 ? Math.PI : 0)) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2);
      const ankle = right
        .clone()
        .multiplyScalar((sign * pose.stanceWidth) / 2)
        .addScaledVector(forward, sign * pose.stagger);
      ankle.y = 0.12 + pose.hop;
      const nominal = ankle.clone().add(v(p.x, 0, p.z));
      let anchor = this.anchors.get(suffix);
      if (!anchor) {
        anchor = { point: nominal.clone(), swinging: false };
        this.anchors.set(suffix, anchor);
      }
      if (movement && this.gait > 0.015 && movement.velocity.length() > 0.04) {
        const swing = legPhase < Math.PI;
        const landing = nominal
          .clone()
          .addScaledVector(direction, this.gait * 0.65);
        if (swing) {
          const u = legPhase / Math.PI,
            ease = u * u * (3 - 2 * u);
          ankle
            .copy(anchor.point)
            .lerp(landing, ease)
            .sub(v(p.x, 0, p.z));
          ankle.y = 0.12 + pose.hop + Math.sin(u * Math.PI) * this.gait * 0.42;
        } else {
          if (anchor.swinging) anchor.point.copy(landing);
          ankle.copy(anchor.point).sub(v(p.x, 0, p.z));
        }
        anchor.swinging = swing;
      } else {
        if (movement) anchor.point.lerp(nominal, Math.min(1, movement.dt * 12));
        else anchor.point.copy(nominal);
        ankle.copy(anchor.point).sub(v(p.x, 0, p.z));
        anchor.swinging = false;
      }
      const thigh = ("thigh" + suffix) as Joint,
        shin = ("shin" + suffix) as Joint,
        foot = ("foot" + suffix) as Joint;
      const solved = this.solve(
        hip,
        ankle,
        rest[thigh].distanceTo(rest[shin]),
        rest[shin].distanceTo(rest[foot]),
        forward.clone(),
      );
      this.segment(thigh, hip, solved.elbow, stanceQ);
      this.segment(shin, solved.elbow, solved.end, stanceQ);
      this.joint(foot, solved.end, stanceQ);
    }
    paddle.rotation.set(
      pose.paddlePitch,
      pose.paddleYaw,
      pose.paddleRoll,
      "YXZ",
    );
    const gripOffset = v(0, PADDLE_GRIP_Y).applyQuaternion(paddle.quaternion);
    const handleAxis = v(0, 1).applyQuaternion(paddle.quaternion);
    const normal = v(0, 0, 1).applyQuaternion(paddle.quaternion);
    const gripGoal = v(pose.paddle.x, pose.paddle.y, pose.paddle.z)
      .addScaledVector(normal, -0.044)
      .add(gripOffset);
    const handSign = p.hand === "left" ? -1 : 1;
    let hittingGrip = gripGoal.clone();
    const arm = (
      sign: number,
      goal: T.Vector3,
      gripping = false,
      primary = false,
    ) => {
      const suffix = sign < 0 ? "L" : "R";
      const upper = ("upper" + suffix) as Joint,
        lower = ("lower" + suffix) as Joint,
        hand = ("hand" + suffix) as Joint;
      const clavicle = ("clavicle" + suffix) as Joint,
        finger = ("finger" + suffix) as Joint;
      const shoulder = torso(rest[upper]);
      const shrug = gripping
        ? T.MathUtils.smoothstep(goal.y - shoulder.y, 0.35, 0.65) * 0.075
        : 0;
      shoulder.y += shrug;
      const collar = torso(rest[clavicle]);
      collar.y += shrug * 0.35;
      this.segment(clavicle, collar, shoulder, bodyQ);
      const handDirection = gripping
        ? handleAxis.clone()
        : goal.clone().sub(shoulder).normalize();
      const fitted = gripping
        ? gripFrame(
            sign,
            goal,
            handleAxis,
            shoulder,
            right.clone().multiplyScalar(sign),
          )
        : undefined;
      const wristGoal =
        fitted?.wrist ?? goal.clone().addScaledVector(handDirection, -0.055);
      const solved = this.solve(
        shoulder,
        wristGoal,
        rest[upper].distanceTo(rest[lower]),
        rest[lower].distanceTo(rest[hand]),
        pose.active && shot?.type !== "smash"
          ? v(0, -0.35)
              .addScaledVector(forward, 0.85)
              .addScaledVector(right, sign * pose.elbowOut)
          : v(0, -1).addScaledVector(right, sign * pose.elbowOut),
      );
      this.segment(upper, shoulder, solved.elbow, bodyQ);
      const lowerQ = this.segment(lower, solved.elbow, solved.end, bodyQ);
      if (fitted) {
        // Spread pronation through the forearm rather than concentrating the
        // entire racket-facing twist at the wrist.
        const forearm = solved.end.clone().sub(solved.elbow).normalize();
        const delta = fitted.rotation.clone().multiply(lowerQ.clone().invert());
        const projection =
          delta.x * forearm.x + delta.y * forearm.y + delta.z * forearm.z;
        const twist = new T.Quaternion(
          forearm.x * projection,
          forearm.y * projection,
          forearm.z * projection,
          delta.w,
        );
        if (twist.lengthSq() > 0.0001) {
          twist.normalize();
          lowerQ.premultiply(new T.Quaternion().slerp(twist, 0.7));
          this.joint(lower, solved.elbow, lowerQ);
        }
      }
      const handAxis = rest[finger]
        .clone()
        .sub(rest[hand])
        .normalize()
        .applyQuaternion(lowerQ);
      if (!gripping)
        handDirection.copy(solved.end).sub(solved.elbow).normalize();
      const handQ =
        fitted?.rotation ??
        new T.Quaternion()
          .setFromUnitVectors(handAxis, handDirection)
          .multiply(lowerQ);
      if (this.mesh.morphTargetInfluences)
        this.mesh.morphTargetInfluences[sign < 0 ? 0 : 1] = gripping
          ? primary
            ? 1
            : 1 -
              T.MathUtils.smoothstep(
                solved.end.distanceTo(wristGoal),
                0.018,
                0.075,
              )
          : 0;
      this.joint(hand, solved.end, handQ);
      const fingerPoint = rest[finger]
        .clone()
        .sub(rest[hand])
        .applyQuaternion(handQ)
        .add(solved.end);
      const curl = new T.Quaternion().setFromAxisAngle(
        v(1, 0),
        gripping ? 0 : -0.12,
      );
      this.joint(finger, fingerPoint, handQ.clone().multiply(curl));
      return fitted
        ? solved.end.clone().add(fitted.offset)
        : solved.end.clone().addScaledVector(handDirection, 0.055);
    };
    hittingGrip = arm(handSign, gripGoal, true, true);
    paddle.position.copy(hittingGrip).sub(gripOffset);
    const head = torso(v(0, 1.76));
    let offGoal = hips
      .clone()
      .addScaledVector(right, -handSign * 0.28)
      .addScaledVector(forward, 0.25)
      .add(v(0, 0.27));
    if (pose.twoHanded)
      offGoal = hittingGrip
        .clone()
        .addScaledVector(handleAxis, PADDLE_SUPPORT_OFFSET);
    if (pose.active && shot?.type === "smash") {
      const guide = head.clone().add(v(0, 0.12)).addScaledVector(forward, 0.15);
      offGoal.lerp(guide, 1 - T.MathUtils.smoothstep(time ?? 0, -0.02, 0.3));
    }
    if (pose.active && shot?.type === "serve") {
      const held = v(shot.from.x - p.x, shot.from.y + 0.06, shot.from.z - p.z);
      offGoal.lerp(held, 1 - T.MathUtils.smoothstep(time ?? 0, -0.08, 0.2));
    }
    if (
      pose.active &&
      !pose.twoHanded &&
      shot?.type !== "smash" &&
      shot?.type !== "serve"
    )
      offGoal.addScaledVector(right, -handSign * 0.12 * pose.loading);
    arm(-handSign, offGoal, pose.twoHanded);
    this.mesh.updateMatrixWorld(true);
    this.mesh.skeleton.update();
    return head;
  }
}
