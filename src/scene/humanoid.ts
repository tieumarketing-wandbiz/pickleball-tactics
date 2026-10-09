// Procedural player driven on the user's Mixamo rig (asset contract v2, .agents/README.md).
// playerPose() gives body-level targets (pelvis, chest, feet, paddle); this file turns them into
// bone rotations following .agents/reference/rig-guide.md: rest-calibrated aim frames, analytic
// two-bone IK with explicit poles, spine/neck distribution, swing-twist forearm split, finger grip
// around the handle with the paddle on a hand socket, foot lock — plus limb-volume arm clearance.
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { playerPose } from "../core/player-pose";
import { STROKE_MOTION, strokeLoadTime, strokePreparation } from "../core/stroke-motion";
import { PoseSpline, readQuaternion, type RigDrawing } from "./pose-spline";

import { ease, softClamp } from "../core/motion";
import { PADDLE_GRIP_Y, PADDLE_SUPPORT_OFFSET } from "./paddle";
import type { Player, Shot } from "../core/scenario";
import {
  aim,
  basisQuat,
  chainReach,
  collectBones,
  makeAim,
  segmentGap,
  setWorldQuat,
  twistAbout,
  twistAngle,
  twoBone,
  worldPos,
  worldQuat,
  type Aim,
  type TorsoCapsule,
} from "./rig";

const v = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
const angleDiff = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
const UP = v(0, 1);
type Side = "Left" | "Right";
const SIDES: readonly Side[] = ["Left", "Right"];
const sideSign = (s: Side) => (s === "Left" ? -1 : 1);
const FINGERS = ["Index", "Middle", "Ring", "Pinky"] as const;
/** Bones the runtime needs (end markers are optional). */
export const REQUIRED_BONES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  ...SIDES.flatMap((s) => [
    `${s}Shoulder`,
    `${s}Arm`,
    `${s}ForeArm`,
    `${s}Hand`,
    `${s}UpLeg`,
    `${s}Leg`,
    `${s}Foot`,
    `${s}ToeBase`,
    ...[...FINGERS, "Thumb"].flatMap((f) =>
      [1, 2, 3].map((k) => `${s}Hand${f}${k}`),
    ),
  ]),
];

// ---- tunables (sources: rig-guide §3/§4/§8, user feedback round 2) ----------------------------
/** Spine yaw/pitch/roll distribution from pelvis to chest (cumulative Spine, Spine1, Spine2). */
const SPINE_SPLIT = [0.15, 0.5, 1];
/** Share of the head turn taken by the neck. */
const NECK_SHARE = 0.4;
/** Forearm takes this share of the hand's twist (rest at the wrist). */
const FOREARM_TWIST = 0.5;
const MAX_TWIST = (85 * Math.PI) / 180;
/** Wrist limits (spec: flexion/extension ≤ 60°, radial/ulnar deviation ≤ 30°). */
export const WRIST_LIMITS = {
  flex: (59 * Math.PI) / 180,
  deviation: (29 * Math.PI) / 180,
};
/** Elbow interior angle range. */
const ELBOW_MIN = (25 * Math.PI) / 180,
  ELBOW_MAX = (160 * Math.PI) / 180;
/** Limb radii and the required gap to the torso surface (limb-volume clearance). */
export const UPPER_ARM_RADIUS = 0.05,
  FOREARM_RADIUS = 0.04,
  ARM_CLEARANCE = 0.03;
/** Part of the upper arm next to the shoulder that may touch the torso (deltoid/armpit). */
export const UPPER_ARM_FREE = 0.4;
/** Handle radius + half palm thickness: palm centre → handle axis. */
const HANDLE_OFFSET = 0.032;
/** Paddle face roll about the handle relative to the palm (0 = handshake/eastern). */
/** Socket shape: handle across the palm, tilted toward the fingers by `along`. */
const GRIP = { kSign: 1, faceSign: -1, along: -0.25 };

export interface HumanoidRig {
  scene: T.Object3D;
}
/** Loads the shared rig template; each `Humanoid` clones it. */
export async function loadHumanoidRig(): Promise<HumanoidRig> {
  // The ~25 kB wasm decoder is a separate chunk, fetched in parallel with the model.
  const [{ MeshoptDecoder }, data] = await Promise.all([
    import("three/addons/libs/meshopt_decoder.module.js"),
    fetch(`${import.meta.env.BASE_URL}models/male-rigged.glb`).then((r) => {
      if (!r.ok) throw new Error(`Không tải được mô hình người (${r.status}).`);
      return r.arrayBuffer();
    }),
  ]);
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(data, "");
  return { scene: gltf.scene };
}

interface Finger {
  bone: T.Object3D;
  rest: T.Quaternion;
  hinge: T.Vector3; // local
  grip: number; // rad at full grip
  relaxed: number;
}
interface ArmRig {
  sign: number;
  clavicle: T.Object3D;
  upper: T.Object3D;
  fore: T.Object3D;
  hand: T.Object3D;
  aimClavicle: Aim;
  aimUpper: Aim;
  aimFore: Aim;
  l1: number;
  l2: number;
  clavicleDir: T.Vector3; // char rest
  foreAxis: T.Vector3; // forearm local
  flexAxis: T.Vector3; // forearm local (rest)
  devAxis: T.Vector3; // forearm local (rest)
  handRest: T.Quaternion; // local
  foreZero: T.Quaternion; // forearm in upper-arm space with a straight elbow
  foreInHand: T.Vector3; // elbow→wrist direction in hand space (rest)
  /** paddle in hand space when this hand holds the handle (dominant / support) */
  grip: T.Matrix4;
  support: T.Matrix4;
  palm: T.Vector3; // hand local palm centre
  fingers: Finger[];
}
const mainSocket=(arm:ArmRig,swivel:number)=>arm.hand.matrixWorld.clone().multiply(arm.grip).multiply(new T.Matrix4().makeRotationY(-swivel));
interface LegRig {
  sign: number;
  up: T.Object3D;
  leg: T.Object3D;
  foot: T.Object3D;
  aimUp: Aim;
  aimLeg: Aim;
  l1: number;
  l2: number;
}

// scratch
const _a = new T.Vector3(),
  _b = new T.Vector3(),
  _q1 = new T.Quaternion(),
  _q2 = new T.Quaternion(),
  _q3 = new T.Quaternion(),
  _m1 = new T.Matrix4(),
  _m2 = new T.Matrix4();

export class Humanoid {
  /** Cloned rig scene: add this to the player's marker. */
  root: T.Object3D;
  /** The skinned body (pickable). */
  mesh: T.SkinnedMesh;
  bones: Map<string, T.Object3D>;
  /** Torso capsules of the last pose (marker space) used by the arm clearance. */
  torsoCapsules: TorsoCapsule[] = [];
  private restQ = new Map<T.Object3D, T.Quaternion>();
  private hipsRest: T.Vector3;

  private ankleY: number;
  private arms: Record<Side, ArmRig>;
  private legs: Record<Side, LegRig>;
  private gait = 0;
  private walkPhase = 0;
  private anchors = new Map<string, { point: T.Vector3; swinging: boolean }>();
  private restLocal = new Map<T.Object3D, T.Quaternion>();

  private driven: T.Object3D[] = [];
  private sampleValues = new Float64Array(0);
  private splinePaddle = new T.Group();
  private smoothFeet = new Map<string, { start: T.Vector3; end: T.Vector3; cycle: number }>();

  constructor(rig: HumanoidRig, team: "A" | "B") {
    this.root = cloneSkinned(rig.scene);
    let mesh: T.SkinnedMesh | undefined;
    this.root.traverse((o) => {
      if ((o as T.SkinnedMesh).isSkinnedMesh) mesh ??= o as T.SkinnedMesh;
    });
    if (!mesh) throw new Error("GLB không có mesh người đã gắn xương.");
    this.mesh = mesh;
    this.bones = collectBones(this.root);
    const missing = REQUIRED_BONES.filter((n) => !this.bones.has(n));
    if (missing.length) throw new Error(`Thiếu xương: ${missing.join(", ")}`);
    this.root.updateMatrixWorld(true);
    this.colorize(team);
    mesh.castShadow = mesh.receiveShadow = true;
    // Skinned bounds follow the pose; never cull (rig-guide §2.1) and keep picking bounds large.
    mesh.frustumCulled = false;
    mesh.boundingSphere = new T.Sphere(v(0, 1), 2.2);
    for (const [, b] of this.bones) {
      this.restQ.set(b, worldQuat(b, new T.Quaternion()));
      this.restLocal.set(b, b.quaternion.clone());
      this.driven.push(b);
    }
    this.sampleValues = new Float64Array(4 + this.driven.length * 4 + 16);
    this.hipsRest = this.bone("Hips").position.clone();

    this.ankleY =
      (worldPos(this.bone("LeftFoot"), _a).y +
        worldPos(this.bone("RightFoot"), _b).y) /
      2;
    this.legs = {
      Left: this.calibrateLeg("Left"),
      Right: this.calibrateLeg("Right"),
    };
    this.arms = {
      Left: this.calibrateArm("Left"),
      Right: this.calibrateArm("Right"),
    };
  }
  bone(name: string) {
    return this.bones.get(name)!;
  }
  /** Rest (bind) world position of a bone, character space. */
  private restPos(name: string) {
    return worldPos(this.bone(name), new T.Vector3());
  }
  private colorize(team: "A" | "B") {
    const mesh = this.mesh,
      geometry = mesh.geometry.clone();
    const pos = geometry.getAttribute("position"),
      colors = new Float32Array(pos.count * 3);
    mesh.skeleton.update();
    const shirt = new T.Color(team === "A" ? 0xf2a274 : 0x70d9c1),
      skin = new T.Color(0xc4a28b),
      shorts = new T.Color(0x203b47),
      shoe = new T.Color(0xe4e9df);
    const p = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, p); // bind pose, app space (dequantized)
      const y = p.y,
        x = Math.abs(p.x);
      const c =
        x > 0.48 && y > 0.9
          ? skin
          : y < 0.16
            ? shoe
            : y < 0.72
              ? skin
              : y < 1.04
                ? shorts
                : y > 1.53 || x > 0.42
                  ? skin
                  : shirt;
      c.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    mesh.geometry = geometry;
    mesh.material = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
      side: T.DoubleSide,
    });
  }
  private calibrateLeg(s: Side): LegRig {
    const up = this.bone(`${s}UpLeg`),
      leg = this.bone(`${s}Leg`),
      foot = this.bone(`${s}Foot`);
    const knee = v(0, 0, -1); // knees bend forward (character faces −Z)
    const aimUp = makeAim(up, leg, knee),
      aimLeg = makeAim(leg, foot, knee);
    return {
      sign: sideSign(s),
      up,
      leg,
      foot,
      aimUp,
      aimLeg,
      l1: aimUp.length,
      l2: aimLeg.length,
    };
  }
  private calibrateArm(s: Side): ArmRig {
    const sign = sideSign(s);
    const clavicle = this.bone(`${s}Shoulder`),
      upper = this.bone(`${s}Arm`),
      fore = this.bone(`${s}ForeArm`),
      hand = this.bone(`${s}Hand`);
    const S = this.restPos(`${s}Arm`),
      E = this.restPos(`${s}ForeArm`),
      W = this.restPos(`${s}Hand`);
    // Rest bend direction of the elbow (backward in the A-pose).
    const axis = W.clone().sub(S).normalize();
    const pole = E.clone().sub(S);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.length() < 0.005) pole.set(0, 0, 1);
    pole.normalize();
    const aimUpper = makeAim(upper, fore, pole),
      aimFore = makeAim(fore, hand, pole);
    const aimClavicle = makeAim(clavicle, upper, UP);
    // Palm frame (rig-guide §6.1).
    const H = W,
      I = this.restPos(`${s}HandIndex1`),
      P = this.restPos(`${s}HandPinky1`),
      M = this.restPos(`${s}HandMiddle1`);
    const k = P.clone().sub(I).normalize(); // index → pinky
    const along = I.clone().add(P).multiplyScalar(0.5).sub(H).normalize(); // wrist → knuckles
    const n =
      sign > 0
        ? I.clone().sub(H).cross(P.clone().sub(H))
        : P.clone().sub(H).cross(I.clone().sub(H));
    n.addScaledVector(along, -n.dot(along)).normalize(); // out of the palm
    const palmW = H.clone().lerp(M, 0.55);
    const handW = worldQuat(hand, new T.Quaternion());
    const handM = new T.Matrix4().compose(H, handW, v(1, 1, 1));
    const handInv = handM.clone().invert();
    // Paddle on the palm: handle diagonal across the palm (pinky heel → index base), head past
    // the index/thumb side, face roughly parallel to the palm (rig-guide §6.3).
    const socket = (supportGrip: boolean) => {
      const head = k
        .clone()
        .multiplyScalar(-GRIP.kSign)
        .addScaledVector(along, GRIP.along);
      head.addScaledVector(n, -head.dot(n)).normalize();
      // Paddle +Z points back at the hitter (paddleYaw = aim + π), so the hitting palm faces −Z.
      const face = n
        .clone()
        .multiplyScalar((supportGrip ? 1 : -1) * GRIP.faceSign);
      const x = head.clone().cross(face).normalize();
      face.crossVectors(x, head);
      const gripY = PADDLE_GRIP_Y + (supportGrip ? PADDLE_SUPPORT_OFFSET : 0);
      const origin = palmW
        .clone()
        .addScaledVector(n, HANDLE_OFFSET)
        .addScaledVector(head, -gripY);
      const paddleW = new T.Matrix4()
        .makeBasis(x, head, face)
        .setPosition(origin);
      return handInv.clone().multiply(paddleW);
    };
    // Forearm axes for twist split and wrist limits (forearm local, rest).
    const foreW = worldQuat(fore, new T.Quaternion()),
      foreInv = foreW.clone().invert();
    const foreAxis = W.clone().sub(E).normalize().applyQuaternion(foreInv);
    // Orthonormal to the forearm axis so swing (flex/deviation) and twist separate exactly.
    const flexAxis = k.clone().applyQuaternion(foreInv);
    flexAxis.addScaledVector(foreAxis, -flexAxis.dot(foreAxis)).normalize();
    const devAxis = new T.Vector3()
      .crossVectors(foreAxis, flexAxis)
      .normalize();
    if (devAxis.dot(n.clone().applyQuaternion(foreInv)) < 0) devAxis.negate();
    // Finger hinges from rest geometry (§6.1): curl moves each tip toward the palm normal.
    const fingers: Finger[] = [];
    const addFinger = (
      name: string,
      child: string,
      ref: T.Vector3,
      grip: number,
      relaxed: number,
    ) => {
      const bone = this.bone(name),
        tipObj = this.bones.get(child);
      const a = this.restPos(name);
      const dir = (
        tipObj ? worldPos(tipObj, new T.Vector3()) : a.clone().add(along)
      )
        .sub(a)
        .normalize();
      const hinge = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
      if (dir.clone().applyAxisAngle(hinge, 0.2).sub(dir).dot(n) < 0)
        hinge.negate();
      const restW = this.restQ.get(bone)!;
      fingers.push({
        bone,
        rest: bone.quaternion.clone(),
        hinge: hinge.applyQuaternion(restW.clone().invert()),
        grip,
        relaxed,
      });
    };
    const curl = [0.95, 1.15, 0.75];
    FINGERS.forEach((f, i) => {
      const extra = [-0.12, 0, 0.08, 0.16][i];
      for (let j = 1; j <= 3; j++)
        addFinger(
          `${s}Hand${f}${j}`,
          `${s}Hand${f}${j + 1}`,
          k,
          curl[j - 1] + extra,
          [0.2, 0.25, 0.12][j - 1],
        );
    });
    for (let j = 1; j <= 3; j++) {
      const a = this.restPos(`${s}HandThumb${j}`);
      const tip = this.bones.get(`${s}HandThumb${j + 1}`);
      const dir = (tip ? worldPos(tip, new T.Vector3()) : a.clone().add(along))
        .sub(a)
        .normalize();
      addFinger(
        `${s}HandThumb${j}`,
        `${s}HandThumb${j + 1}`,
        dir.clone().cross(n),
        [0.45, 0.4, 0.35][j - 1],
        [0.1, 0.1, 0.08][j - 1],
      );
    }
    return {
      sign,
      clavicle,
      upper,
      fore,
      hand,
      aimClavicle,
      aimUpper,
      aimFore,
      l1: aimUpper.length,
      l2: aimFore.length,
      clavicleDir: S.clone()
        .sub(this.restPos(`${s}Shoulder`))
        .normalize(),
      foreAxis,
      flexAxis,
      devAxis,
      handRest: hand.quaternion.clone(),
      foreZero: new T.Quaternion().setFromUnitVectors(foreAxis.clone().applyQuaternion(fore.quaternion),fore.position.clone().normalize()).multiply(fore.quaternion),
      foreInHand: W.clone()
        .sub(E)
        .normalize()
        .applyQuaternion(handW.clone().invert()),
      grip: socket(false),
      support: socket(true),
      palm: palmW.clone().applyMatrix4(handInv),
      fingers,
    };
  }

  private drawings = new Map<string, PoseSpline>();
  private drawingSwivel = 0;

  /** Authored constraint solves are confined to drawings, not re-selected every frame.
   * Playback interpolates ONLY rotations and Hips/root placement; never bone translations.
   * Feet are re-planted with analytic IK. This is seekable and has shared C1 key tangents. */
  pose(p: Player, shot: Shot | undefined, time: number | undefined, paddle: T.Object3D,
    movement?: { velocity: T.Vector3; clock: number; dt: number }, preparation?: number) {
    if (!shot || shot.hitter!==p.id || time===undefined) return this.solveDrawing(p,shot,time,paddle,movement,preparation);
    const prep=preparation ?? strokePreparation(shot.type), profile=STROKE_MOTION[shot.type];
    // Positions belong in the cache key: moving a player must not reuse the old relative contact.
    const key=JSON.stringify([p,shot,prep]);
    let spline=this.drawings.get(key);
    if(!spline) {
      const follow=profile.followTime+(profile.hold ?? 0), settle=follow+(profile.recover-follow)*.72;
      const times=[-prep,strokeLoadTime(shot.type,prep),0,profile.followTime];
      if(profile.hold)times.push(follow);
      times.push(settle,profile.recover);
      const keys:RigDrawing[]=times.map(t=>{
        this.solveDrawing(p,shot,t,this.splinePaddle,undefined,prep);
        const values=new Float64Array(4+this.driven.length*4+16);
        this.bone("Hips").position.toArray(values,0); values[1]-=playerPose(p,shot,t,prep).hop; values[3]=this.drawingSwivel;
        this.driven.forEach((b,i)=>b.quaternion.toArray(values,4+i*4));
        SIDES.forEach((side,i)=>{
          const arm=this.arms[side],c=4+this.driven.length*4+i*8;
          const delta=arm.foreZero.clone().invert().multiply(arm.fore.quaternion),twist=twistAbout(delta,arm.foreAxis,new T.Quaternion());
          const swing=delta.multiply(twist.clone().invert()),angle=2*Math.acos(Math.min(1,Math.abs(swing.w)));
          v(swing.x,swing.y,swing.z).multiplyScalar(Math.sign(swing.w)||1).normalize().toArray(values,c);
          values[c+3]=angle;values[c+4]=twistAngle(twist,arm.foreAxis);
          const wrist=this.jointAngles(side); values[c+5]=wrist.flex;values[c+6]=wrist.deviation;values[c+7]=wrist.twist;
        });
        // Calibrate the root against the actual playback representation (normalized quaternions
        // and anatomical channels), so contact is exact down to floating-point precision.
        this.restoreRotations(values); this.root.updateMatrixWorld(true);
        const held=mainSocket(this.arms[p.hand==="left" ? "Left" : "Right"],values[3]);
        const actual=new T.Vector3().setFromMatrixPosition(held);
        const desired=playerPose(p,shot,t,prep).paddle;
        this.bone("Hips").position.add(v(desired.x,desired.y,desired.z).add(this.root.getWorldPosition(new T.Vector3())).sub(actual));
        this.bone("Hips").position.toArray(values,0);values[1]-=playerPose(p,shot,t,prep).hop;
        return {time:t,values};
      });
      const jointBase=4+this.driven.length*4;
      for(const c of [3,jointBase+4,jointBase+7,jointBase+12,jointBase+15])
        for(let i=1;i<keys.length;i++)keys[i].values[c]=keys[i-1].values[c]+angleDiff(keys[i].values[c],keys[i-1].values[c]);
      spline=new PoseSpline(keys,this.driven.map((_,i)=>4+i*4));
      // Monotone anatomical angles cannot overshoot the solved elbow/wrist limits.
      for(const c of [jointBase+3,jointBase+5,jointBase+6,jointBase+11,jointBase+13,jointBase+14])spline.monotoneChannel(c);
      // A passing contact tangent carries the proximal whip; no low-acceleration time dilation.
      const index=this.driven.indexOf(this.bone(p.hand==="left" ? "LeftArm" : "RightArm"));
      const whip={serve:6,drive:3,dink:2.25,drop:2.5,lob:6,volley:6,smash:4,block:4,punch:6,reset:6,speedup:3,roll:4,flick:6,atp:2.5,erne:4}[shot.type];
      for(let c=4+index*4;c<8+index*4;c++) {
        if(shot.type==="smash")spline.setVelocity(2,c,(keys[3].values[c]-keys[2].values[c])/profile.followTime*3);
        else spline.scaleVelocity(2,c,whip);
      }
      for(const c of [0,1,2])spline.monotoneChannel(c);
      if(this.drawings.size>=24)this.drawings.clear(); this.drawings.set(key,spline);
    }
    spline.sample(time,this.sampleValues);
    const hips=this.bone("Hips"); hips.position.fromArray(this.sampleValues,0);
    hips.position.y+=playerPose(p,shot,time,prep).hop;
    this.restoreRotations(this.sampleValues);
    this.root.updateMatrixWorld(true);
    const target=playerPose(p,shot,time,prep), rootPosition=this.root.getWorldPosition(new T.Vector3());
    const front=v(target.forward.x,0,target.forward.z), stance=new T.Quaternion().setFromAxisAngle(UP,target.stanceYaw);
    // Legs → pelvis envelope → spine/clavicles → arms → hands/fingers → head.
    for(const s of SIDES) {
      const leg=this.legs[s], f=target.feet[s==="Left" ? "L" : "R"];
      const ankle=v(f.x,this.ankleY+target.hop+f.lift,f.z).add(rootPosition),hip=worldPos(leg.up,new T.Vector3());
      const axis=ankle.clone().sub(hip).normalize(),pole=front.clone(); pole.y=-(pole.x*axis.x+pole.z*axis.z)/axis.y;
      const knee=new T.Vector3(),end=new T.Vector3(),bend=new T.Vector3();
      twoBone(hip,ankle,leg.l1,leg.l2,pole,chainReach(leg.l1,leg.l2,40*Math.PI/180),(leg.l1+leg.l2)*.995,knee,end,bend,.004);
      aim(leg.aimUp,knee.clone().sub(hip),bend); aim(leg.aimLeg,end.sub(knee),bend);
      setWorldQuat(leg.foot,stance.clone().multiply(this.restQ.get(leg.foot)!));
    }

    this.root.updateMatrixWorld(true);
    const main=this.arms[p.hand==="left" ? "Left" : "Right"];
    const held=main.hand.matrixWorld.clone().multiply(main.grip).multiply(new T.Matrix4().makeRotationY(-this.sampleValues[3]));
    held.decompose(paddle.position,paddle.quaternion,_a); paddle.position.sub(rootPosition); paddle.updateMatrix();
    this.gripWeights=p.hand==="left" ? [1,target.supportWeight] : [target.supportWeight,1];
    const chestQ=worldQuat(this.bone("Spine2"),new T.Quaternion()).multiply(this.restQ.get(this.bone("Spine2"))!.clone().invert());
    const cf=v(0,0,-1).applyQuaternion(chestQ), joints=["Hips","Spine","Spine1","Spine2"].map(n=>worldPos(this.bone(n),new T.Vector3()).sub(rootPosition));
    this.torsoCapsules=[
      {a:joints[0].clone().add(v(0,-.12)),b:joints[0].clone(),radius:.175,squash:1.75,front:cf.clone()},
      {a:joints[0].clone(),b:joints[2].clone(),radius:.14,squash:1.5,front:cf.clone()},
      {a:joints[2].clone(),b:joints[3].clone().add(v(0,.05)),radius:.155,squash:1.2,front:cf.clone()},
    ];
    for(const c of this.torsoCapsules){c.a.addScaledVector(cf,.045);c.b=c.b.clone().addScaledVector(cf,.045);}
    this.mesh.skeleton.update();
    return worldPos(this.bone("Head"),new T.Vector3()).sub(rootPosition).add(v(0,.19));
  }

  private restoreRotations(values:Float64Array) {
    this.driven.forEach((b,i)=>readQuaternion(b.quaternion,values,4+i*4));
    // Monotone elbow/wrist channels preserve limits without per-frame branch selection.
    SIDES.forEach((s,i)=>{
      const arm=this.arms[s],c=4+this.driven.length*4+i*8;
      const axis=v(values[c],values[c+1],values[c+2]).normalize();
      arm.fore.quaternion.copy(arm.foreZero).multiply(new T.Quaternion().setFromAxisAngle(axis,values[c+3]))
        .multiply(new T.Quaternion().setFromAxisAngle(arm.foreAxis,values[c+4]));
      const wrist=arm.flexAxis.clone().multiplyScalar(values[c+5]).addScaledVector(arm.devAxis,values[c+6]),angle=wrist.length();
      arm.hand.quaternion.copy(new T.Quaternion().setFromAxisAngle(wrist.normalize(),angle))
        .multiply(new T.Quaternion().setFromAxisAngle(arm.foreAxis,values[c+7])).multiply(arm.handRest);
    });
  }

  /** Rotation-only drawing author: there is no bone stretch.
   * Plan planted feet/pelvis first; then spine/clavicles, arms, hands/fingers, and head.
   * Only Hips may translate. Rest-calibrated segment lengths are never changed. */
  private solveDrawing(p: Player, shot: Shot | undefined, time: number | undefined, paddle: T.Object3D,
    movement?: { velocity: T.Vector3; clock: number; dt: number }, preparation?: number) {
    const target = playerPose(p, shot, time, preparation);
    this.root.updateMatrixWorld(true);
    const rootPosition = this.root.getWorldPosition(new T.Vector3());
    const hips = this.bone("Hips");
    const hipQ = new T.Quaternion().setFromEuler(new T.Euler(target.pitch*.4, target.hipYaw, target.roll*.4, "YXZ"));
    const bodyQ = new T.Quaternion().setFromEuler(new T.Euler(target.pitch, target.yaw, target.roll, "YXZ"));
    const stanceQ = new T.Quaternion().setFromAxisAngle(UP, target.stanceYaw);
    const front = v(target.forward.x,0,target.forward.z), right = v(target.right.x,0,target.right.z);
    const side: Side = p.hand === "left" ? "Left" : "Right";
    const main = this.arms[side], off = this.arms[side === "Left" ? "Right" : "Left"];
    const centre = v(target.paddle.x,target.paddle.y,target.paddle.z).add(rootPosition);
    const paddleQ = new T.Quaternion().setFromEuler(new T.Euler(target.paddlePitch,target.paddleYaw,target.paddleRoll,"YXZ"));
    const ankles = {} as Record<Side,T.Vector3>;
    for (const s of SIDES) {
      const f=target.feet[s === "Left" ? "L" : "R"];
      const ankle=v(f.x,this.ankleY+target.hop+f.lift,f.z).add(rootPosition);
      // Foot anchors are world-space. A moving player lifts each foot once per .8s cycle.
      if (movement && movement.velocity.lengthSq()>.0016) {
        const phase=movement.clock/.8+(s === "Left" ? 0 : .5), cycle=Math.floor(phase), u=phase-cycle;
        const key=p.id+s;
        let anchor=this.smoothFeet.get(key);
        if (!anchor) { anchor={start:ankle.clone(),end:ankle.clone(),cycle:cycle-1}; this.smoothFeet.set(key,anchor); }
        if (anchor.cycle!==cycle) {
          anchor.start.copy(anchor.end); anchor.end.copy(ankle).addScaledVector(movement.velocity,.4);
          anchor.end.y=this.ankleY+rootPosition.y+target.hop; anchor.cycle=cycle;
        }
        ankle.copy(anchor.start);
        if(u<.5) { ankle.lerp(anchor.end,ease(u*2)); ankle.y+=.05*Math.sin(Math.PI*u*2)**2; }
        else ankle.copy(anchor.end);
      } else if (!movement) this.smoothFeet.delete(p.id+s);
      ankles[s]=ankle;
    }
    hips.position.set(this.hipsRest.x+target.hip.x,
      this.hipsRest.y+Math.max(.43,target.hip.y+.23)-.95+target.hop,
      this.hipsRest.z+target.hip.z);
    hips.quaternion.copy(hipQ).multiply(this.restQ.get(hips)!);
    hips.updateWorldMatrix(true,true);
    // Pelvis placement respects the planted-leg envelope, rather than translating Spine.
    let upper=Infinity, lower=-Infinity;
    for (const s of SIDES) {
      const leg=this.legs[s], hip=worldPos(leg.up,new T.Vector3()), ankle=ankles[s];
      const dy=hip.y-(hips.position.y+rootPosition.y), flat=(hip.x-ankle.x)**2+(hip.z-ankle.z)**2;
      const max=(leg.l1+leg.l2)*.985, min=chainReach(leg.l1,leg.l2,40*Math.PI/180);
      upper=Math.min(upper,ankle.y-rootPosition.y-dy+Math.sqrt(Math.max(.0001,max*max-flat)));
      lower=Math.max(lower,ankle.y-rootPosition.y-dy+Math.sqrt(Math.max(.0001,min*min-flat)));
    }
    hips.position.y=softClamp(hips.position.y,lower,upper,.008);
    const plantLegs=()=>{
      hips.updateWorldMatrix(true,true);
      for(const s of SIDES) {
        const leg=this.legs[s], hip=worldPos(leg.up,new T.Vector3()), ankle=ankles[s];
        const axis=ankle.clone().sub(hip).normalize(), pole=front.clone();
        // Preserve the toe's sagittal plane (axis.y is bounded away from zero by the leg envelope).
        pole.y=-(pole.x*axis.x+pole.z*axis.z)/axis.y;
        const knee=new T.Vector3(),end=new T.Vector3(),bend=new T.Vector3();
        twoBone(hip,ankle,leg.l1,leg.l2,pole,chainReach(leg.l1,leg.l2,40*Math.PI/180),
          (leg.l1+leg.l2)*.99,knee,end,bend,0);
        aim(leg.aimUp,knee.clone().sub(hip),bend);
        aim(leg.aimLeg,end.sub(knee),bend);
        setWorldQuat(leg.foot,stanceQ.clone().multiply(this.restQ.get(leg.foot)!));
      }
    };
    plantLegs();
    const applyTorso=()=>{
      const rel=hipQ.clone().invert().multiply(bodyQ);
      ["Spine","Spine1","Spine2"].forEach((n,i)=>{
        const bone=this.bone(n);
        setWorldQuat(bone,hipQ.clone().multiply(new T.Quaternion().slerp(rel,SPINE_SPLIT[i])).multiply(this.restQ.get(bone)!));
      });
      for(const a of [main,off]) setWorldQuat(a.clavicle,bodyQ.clone().multiply(this.restQ.get(a.clavicle)!));
      this.root.updateMatrixWorld(true);
    };
    applyTorso();
    const gripInverse=main.grip.clone().invert(), socketQ=new T.Quaternion();
    main.grip.decompose(_a,socketQ,_b);
    let swivel=0;
    const request=new T.Matrix4(), goal=new T.Vector3(), handQ=new T.Quaternion();
    const solveArm=(arm:ArmRig,point:T.Vector3,q:T.Quaternion,pole:T.Vector3)=>{
      const shoulder=worldPos(arm.upper,new T.Vector3()),e=new T.Vector3(),w=new T.Vector3(),bend=new T.Vector3();
      twoBone(shoulder,point,arm.l1,arm.l2,pole,chainReach(arm.l1,arm.l2,ELBOW_MIN),
        chainReach(arm.l1,arm.l2,ELBOW_MAX),e,w,bend,0);
      aim(arm.aimUpper,e.clone().sub(shoulder),bend);
      const fq=q.clone().multiply(arm.handRest.clone().invert());
      fq.premultiply(new T.Quaternion().setFromUnitVectors(arm.foreAxis.clone().applyQuaternion(fq),w.sub(e).normalize()));
      setWorldQuat(arm.fore,fq); setWorldQuat(arm.hand,q); this.limitWrist(arm);
    };
    // Socket swivel is an analytic azimuth, not a discrete best-candidate search. Wrist/arm
    // orientation converges while the face centre remains the authored trajectory target.
    for(let pass=0;pass<24;pass++) {
      request.compose(centre,paddleQ,v(1,1,1)).multiply(new T.Matrix4().makeRotationY(swivel)).multiply(gripInverse);
      request.decompose(goal,handQ,_a);
      // Unreachable arm targets are shared by trunk FLEXION, never by elongating the spine.
      const shoulder=worldPos(main.upper,new T.Vector3()), pelvis=worldPos(hips,new T.Vector3());
      const d=shoulder.distanceTo(goal), reach=chainReach(main.l1,main.l2,150*Math.PI/180);
      const blend=ease((d-reach+.015)/.075);
      if(blend>0) {
        const proposed=new T.Vector3(),end=new T.Vector3(),bend=new T.Vector3();
        const torso=shoulder.clone().sub(pelvis), pole=UP.clone().addScaledVector(right,-main.sign*.12).addScaledVector(front,-.12);
        twoBone(pelvis,goal,torso.length(),reach,pole,.02,torso.length()+reach-.001,proposed,end,bend,.015);
        const correction=new T.Quaternion().setFromUnitVectors(torso.normalize(),proposed.sub(pelvis).normalize());
        bodyQ.premultiply(new T.Quaternion().slerp(correction,blend*.45));
        applyTorso();
      }
      const chestRight=v(1,0,0).applyQuaternion(bodyQ), chestFront=v(0,0,-1).applyQuaternion(bodyQ);
      const overhead=shot?.type==="smash" && target.active ? 1-ease(target.readiness) : 0;
      const pole=chestRight.multiplyScalar(main.sign).addScaledVector(chestFront,-.08).add(v(0,-.12+1.62*overhead,0));
      solveArm(main,goal,handQ,pole);
      const fore=worldPos(main.hand,new T.Vector3()).sub(worldPos(main.fore,new T.Vector3())).normalize().applyQuaternion(paddleQ.clone().invert());
      const atZero=main.foreInHand.clone().applyQuaternion(socketQ.clone().invert());
      // The small rest-direction bias keeps the azimuth well-defined near the handle axis.
      fore.addScaledVector(atZero,.04);
      swivel=Math.atan2(atZero.z*fore.x-atZero.x*fore.z,atZero.x*fore.x+atZero.z*fore.z);
      paddleQ.copy(worldQuat(main.hand,new T.Quaternion())).multiply(socketQ).multiply(new T.Quaternion().setFromAxisAngle(UP,-swivel));
    }
    this.root.updateMatrixWorld(true);
    const held=main.hand.matrixWorld.clone().multiply(main.grip).multiply(new T.Matrix4().makeRotationY(-swivel));
    const actual=new T.Vector3(); held.decompose(actual,paddle.quaternion,_a);
    // Root/pelvis correction keeps contact and the rigid socket exact, with no bone stretch.
    // The numerical body gate also measures this correction's acceleration.
    hips.position.add(centre.clone().sub(actual));
    plantLegs(); this.root.updateMatrixWorld(true);
    held.copy(main.hand.matrixWorld).multiply(main.grip).multiply(new T.Matrix4().makeRotationY(-swivel));
    held.decompose(paddle.position,paddle.quaternion,_a);
    paddle.position.sub(rootPosition); paddle.updateMatrix();
    const cr=v(1,0,0).applyQuaternion(bodyQ), cf=v(0,0,-1).applyQuaternion(bodyQ), cu=v(0,1,0).applyQuaternion(bodyQ);
    const guard=worldPos(this.bone("Spine2"),new T.Vector3()).addScaledVector(cr,off.sign*.38).addScaledVector(cf,.34).addScaledVector(cu,-.18);
    if(shot?.type==="smash" && target.active) guard.lerp(worldPos(this.bone("Neck"),new T.Vector3()).add(v(0,.23)).addScaledVector(cr,off.sign*.17),target.loading);
    const guardQ=bodyQ.clone().multiply(this.restQ.get(off.hand)!);
    if(target.supportWeight>0) {
      const support=held.clone().multiply(off.support.clone().invert()), sp=new T.Vector3(),sq=new T.Quaternion(); support.decompose(sp,sq,_a);
      guard.lerp(sp,target.supportWeight); guardQ.slerp(sq,target.supportWeight);
    }
    solveArm(off,guard,guardQ,cr.clone().multiplyScalar(off.sign).addScaledVector(cf,-.05));
    this.gripWeights=p.hand==="left" ? [1,target.supportWeight] : [target.supportWeight,1];
    for(const a of [main,off]) for(const f of a.fingers) f.bone.quaternion.copy(f.rest).multiply(new T.Quaternion().setFromAxisAngle(f.hinge,
      T.MathUtils.lerp(f.relaxed,f.grip,a===main ? 1 : target.supportWeight)));
    const headQ=bodyQ.clone().multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),target.track));
    setWorldQuat(this.bone("Neck"),bodyQ.clone().slerp(headQ,NECK_SHARE).multiply(this.restQ.get(this.bone("Neck"))!));
    setWorldQuat(this.bone("Head"),headQ.multiply(this.restQ.get(this.bone("Head"))!));
    this.root.updateMatrixWorld(true);
    const joints=["Hips","Spine","Spine1","Spine2"].map(n=>worldPos(this.bone(n),new T.Vector3()).sub(rootPosition));
    this.torsoCapsules=[
      {a:joints[0].clone().add(v(0,-.12)),b:joints[0].clone(),radius:.175,squash:1.75,front:cf.clone()},
      {a:joints[0].clone(),b:joints[2].clone(),radius:.14,squash:1.5,front:cf.clone()},
      {a:joints[2].clone(),b:joints[3].clone().add(v(0,.05)),radius:.155,squash:1.2,front:cf.clone()},
    ];
    for(const c of this.torsoCapsules){c.a.addScaledVector(cf,.045);c.b=c.b.clone().addScaledVector(cf,.045);}
    this.mesh.skeleton.update(); this.drawingSwivel=swivel;
    return worldPos(this.bone("Head"),new T.Vector3()).sub(rootPosition).add(v(0,.19));
  }

  wristDemand: Record<string,{flex:number;dev:number;w:number}> = {};
  private limitWrist(arm:ArmRig, playback=false) {
    const delta=arm.hand.quaternion.clone().multiply(arm.handRest.clone().invert());
    const twist=twistAbout(delta,arm.foreAxis,new T.Quaternion()), swing=delta.multiply(twist.clone().invert());
    const angle=2*Math.acos(Math.min(1,Math.abs(swing.w)));
    const dir=v(swing.x,swing.y,swing.z).multiplyScalar(Math.sign(swing.w)||1).normalize();
    const rawFlex=angle*dir.dot(arm.flexAxis),rawDev=angle*dir.dot(arm.devAxis);
    this.wristDemand[arm.sign]={flex:rawFlex,dev:rawDev,w:swing.w};
    const flexLimit=playback ? Math.PI/3 : WRIST_LIMITS.flex, devLimit=playback ? Math.PI/6 : WRIST_LIMITS.deviation;
    const width=playback ? .004 : .04;
    const flex=softClamp(rawFlex,-flexLimit,flexLimit,width), dev=softClamp(rawDev,-devLimit,devLimit,width);
    const axis=arm.flexAxis.clone().multiplyScalar(flex).addScaledVector(arm.devAxis,dev), a=axis.length();
    arm.hand.quaternion.copy(new T.Quaternion().setFromAxisAngle(axis.normalize(),a)).multiply(twist).multiply(arm.handRest);
    arm.hand.updateWorldMatrix(false,true);
  }

  jointAngles(side: Side) {
    const arm = this.arms[side];
    const s = worldPos(arm.upper, new T.Vector3()),
      e = worldPos(arm.fore, new T.Vector3()),
      w = worldPos(arm.hand, new T.Vector3());
    const foreQ = worldQuat(arm.fore, new T.Quaternion()),
      handQ = worldQuat(arm.hand, new T.Quaternion());
    const rest = foreQ
      .invert()
      .multiply(handQ)
      .multiply(arm.handRest.clone().invert());
    const twist = twistAbout(rest, arm.foreAxis, new T.Quaternion());
    const swing = rest.clone().multiply(twist.clone().invert());
    const angle = 2 * Math.acos(T.MathUtils.clamp(Math.abs(swing.w), 0, 1));
    const axis = v(swing.x, swing.y, swing.z);
    if (axis.lengthSq() > 1e-12)
      axis.multiplyScalar(Math.sign(swing.w) || 1).normalize();
    return {
      elbow: s.sub(e).angleTo(w.clone().sub(e)),
      flex: angle * axis.dot(arm.flexAxis),
      deviation: angle * axis.dot(arm.devAxis),
      twist: twistAngle(twist, arm.foreAxis),
    };
  }
  /** Finger grip amount of the last pose, [left, right] (1 = closed on the handle). */
  gripWeights: [number, number] = [0, 0];
  /** Palm centre of a hand in character space (tests / debugging). */
  palm(side: Side, out = new T.Vector3()) {
    const arm = this.arms[side];
    return out
      .copy(arm.palm)
      .applyMatrix4(arm.hand.matrixWorld)
      .applyMatrix4(_m1.copy(this.root.matrixWorld).invert());
  }
  /** Paddle pose that `side` would hold (character space), from the current hand. */
  heldPaddle(side: Side, support = false) {
    const arm = this.arms[side];
    return _m1
      .copy(this.root.matrixWorld)
      .invert()
      .multiply(arm.hand.matrixWorld)
      .multiply(support ? arm.support : arm.grip)
      .clone();
  }
}
