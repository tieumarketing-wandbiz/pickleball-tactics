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
const GRIP = { kSign: 1, faceSign: -1, along: 0 };

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
  foreInHand: T.Vector3; // elbow→wrist direction in hand space (rest)
  /** paddle in hand space when this hand holds the handle (dominant / support) */
  grip: T.Matrix4;
  support: T.Matrix4;
  palm: T.Vector3; // hand local palm centre
  fingers: Finger[];
}
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
  private spineRest: T.Vector3;
  private ankleY: number;
  private arms: Record<Side, ArmRig>;
  private legs: Record<Side, LegRig>;
  private gait = 0;
  private walkPhase = 0;
  private anchors = new Map<string, { point: T.Vector3; swinging: boolean }>();
  private restLocal = new Map<T.Object3D, T.Quaternion>();
  private drawings = new Map<string, PoseSpline>();
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
    this.sampleValues = new Float64Array(4 + this.driven.length * 4);
    this.hipsRest = this.bone("Hips").position.clone();
    this.spineRest = this.bone("Spine").position.clone();
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

  /** Keyed IK drawings remove the discontinuous argmin/pole choices from the frame path.
   * The hand socket stays rigid, and distributed pelvis correction meets the exact paddle
   * path. Sampling is absolute: pause, seek and 24/240 Hz evaluation give the same stroke. */
  private filteredDrawings = new Map<string, PoseSpline>();
  private filteredValues?: Float64Array;
  pose(
    p: Player, shot: Shot | undefined, time: number | undefined, paddle: T.Object3D,
    movement?: { velocity: T.Vector3; clock: number; dt: number }, preparation?: number,
  ) {
    if (!shot || time === undefined || shot.hitter !== p.id)
      return this.poseFrame(p,shot,time,paddle,movement,preparation);
    const prep = preparation ?? strokePreparation(shot.type);
    const key = JSON.stringify([p.id,p.hand,shot,prep]);
    let spline = this.filteredDrawings.get(key);
    const length = 7+this.driven.length*4;
    if (!this.filteredValues) this.filteredValues = new Float64Array(length);
    if (!spline) {
      // Solve constraints only when authoring a seekable drawing sequence. The final curve
      // averages joint rotations symmetrically (zero lag), rather than clamping fast-moving
      // IK inputs anew each rendered frame. This removes secondary solver acceleration spikes.
      const rate=30, radius=10, sigma=4.2;
      const first=Math.floor((-prep-0.4)*rate), last=Math.ceil((STROKE_MOTION[shot.type].recover+0.4)*rate);
      const drawings: RigDrawing[]=[];
      for(let frame=first;frame<=last;frame++) {
        this.poseFrame(p,shot,frame/rate,this.splinePaddle,undefined,prep);
        const values=new Float64Array(length);
        this.bone("Hips").position.toArray(values,0);
        this.bone("Spine").position.toArray(values,3);
        values[6]=this.sampleValues[3];
        this.driven.forEach((b,i)=>b.quaternion.toArray(values,7+i*4));
        drawings.push({time:frame/rate,values});
      }
      const offsets=this.driven.map((_,i)=>7+i*4);
      // Unwrap before averaging: q and -q represent the same rotation, but averaging opposite
      // hemispheres would shrink a quaternion to zero and manufacture a pole flip.
      for(const c of offsets) for(let i=1;i<drawings.length;i++) {
        const a=drawings[i-1].values,b=drawings[i].values;
        if(a[c]*b[c]+a[c+1]*b[c+1]+a[c+2]*b[c+2]+a[c+3]*b[c+3]<0)
          for(let j=0;j<4;j++)b[c+j]*=-1;
      }
      const keys=drawings.map((drawing,i)=>{
        const values=new Float64Array(length); let sum=0;
        for(let j=-radius;j<=radius;j++) {
          const weight=Math.exp(-j*j/(2*sigma*sigma)); sum+=weight;
          const source=drawings[Math.max(0,Math.min(drawings.length-1,i+j))].values;
          for(let c=0;c<length;c++)values[c]+=source[c]*weight;
        }
        for(let c=0;c<length;c++)values[c]/=sum;
        for(const c of offsets) {
          const norm=Math.hypot(values[c],values[c+1],values[c+2],values[c+3]);
          for(let j=0;j<4;j++)values[c+j]/=norm;
        }
        return {time:drawing.time,values};
      });
      spline=new PoseSpline(keys,offsets);
      if(this.filteredDrawings.size>=24)this.filteredDrawings.clear();
      this.filteredDrawings.set(key,spline);
    }
    const values=this.filteredValues;
    spline.sample(time,values);
    this.bone("Hips").position.fromArray(values,0);
    this.bone("Spine").position.fromArray(values,3);
    this.driven.forEach((b,i)=>readQuaternion(b.quaternion,values,7+i*4));
    this.root.updateMatrixWorld(true);
    const inverse=this.root.matrixWorld.clone().invert();
    const main=this.arms[p.hand === "left" ? "Left" : "Right"];
    const held=inverse.clone().multiply(main.hand.matrixWorld).multiply(main.grip)
      .multiply(new T.Matrix4().makeRotationY(-values[6]));
    held.decompose(paddle.position,paddle.quaternion,_a);
    const target=playerPose(p,shot,time,prep), centre=v(target.paddle.x,target.paddle.y,target.paddle.z);
    // A rigid socket and exact authored centre are retained throughout, not just at impact.
    this.bone("Hips").position.add(centre.clone().sub(paddle.position));
    paddle.position.copy(centre); paddle.updateMatrix(); this.root.updateMatrixWorld(true);
    const front=v(target.forward.x,0,target.forward.z), right=v(target.right.x,0,target.right.z);
    let lower=0,raise=0;
    for(const s of SIDES) {
      const leg=this.legs[s],f=target.feet[s === "Left" ? "L" : "R"];
      const hip=worldPos(leg.up,new T.Vector3()).applyMatrix4(inverse);
      const flat=(hip.x-f.x)**2+(hip.z-f.z)**2;
      const positiveRoot=(x:number)=>Math.sqrt((x+Math.hypot(x,0.015))/2);
      const top=this.ankleY+f.lift+target.hop+positiveRoot(((leg.l1+leg.l2)*0.975)**2-flat);
      const bottom=this.ankleY+f.lift+target.hop+positiveRoot(chainReach(leg.l1,leg.l2,42*Math.PI/180)**2-flat);
      const floor=this.postureFloor(shot,target);
      const minimum=(bottom+floor+Math.hypot(bottom-floor,0.02))/2;
      const d=hip.y-top,r=minimum-hip.y;
      const dn=(d+Math.hypot(d,0.035))/2,rn=(r+Math.hypot(r,0.035))/2;
      lower=(lower+dn+Math.hypot(lower-dn,0.008))/2;
      raise=(raise+rn+Math.hypot(raise-rn,0.008))/2;
    }
    lower-=raise;
    this.bone("Hips").position.y-=lower;
    this.bone("Spine").position.add(v(0,lower,0).applyQuaternion(worldQuat(this.bone("Hips"),new T.Quaternion()).invert()));
    this.root.updateMatrixWorld(true);
    for(const s of SIDES) {
      const leg=this.legs[s],f=target.feet[s === "Left" ? "L" : "R"];
      const ankle=v(f.x,this.ankleY+f.lift+target.hop,f.z);
      const hip=worldPos(leg.up,new T.Vector3()).applyMatrix4(inverse), axis=ankle.clone().sub(hip);
      const pole=front.clone().addScaledVector(right,leg.sign*0.14); pole.y=-pole.dot(axis)/axis.y;
      const e=new T.Vector3(),w=new T.Vector3(),bend=new T.Vector3();
      twoBone(hip,ankle,leg.l1,leg.l2,pole,chainReach(leg.l1,leg.l2,40*Math.PI/180),(leg.l1+leg.l2)*0.98,e,w,bend,0);
      aim(leg.aimUp,e.sub(hip),bend); aim(leg.aimLeg,w.sub(hip).sub(e),bend);
      setWorldQuat(leg.foot,new T.Quaternion().setFromAxisAngle(UP,target.stanceYaw).multiply(this.restQ.get(leg.foot)!));
    }
    this.root.updateMatrixWorld(true); this.mesh.skeleton.update();
    this.gripWeights=p.hand === "left" ? [1,target.supportWeight] : [target.supportWeight,1];
    return worldPos(this.bone("Head"),new T.Vector3()).applyMatrix4(inverse).add(v(0,0.19));
  }

  private poseFrame(
    p: Player, shot: Shot | undefined, time: number | undefined, paddle: T.Object3D,
    movement?: { velocity: T.Vector3; clock: number; dt: number }, preparation?: number,
  ) {
    const prep = preparation ?? (shot ? strokePreparation(shot.type) : 1);
    const key = JSON.stringify([p.id, p.hand, shot, prep]);
    let spline = this.drawings.get(key);
    const handSide: Side = p.hand === "left" ? "Left" : "Right";
    const main = this.arms[handSide];
    if (!spline) {
      const profile = shot ? STROKE_MOTION[shot.type] : undefined;
      const load = shot ? strokeLoadTime(shot.type, prep) : -0.5;
      const times = profile ? [-prep, load, 0, profile.followTime,
        ...(profile.hold ? [profile.followTime + profile.hold] : []),
        profile.followTime + (profile.hold ?? 0) + (profile.recover - profile.followTime - (profile.hold ?? 0)) * 0.72,
        profile.recover] : [-1, 1];
      const keys: RigDrawing[] = [];
      let impactVelocity: Float64Array | undefined;
      let impactPose: Float64Array | undefined;
      for (const t of times) {
        // The original iterative constraint pass is a drawing author, not an animation state.
        for (const b of this.driven) b.quaternion.copy(this.restLocal.get(b)!);
        this.bone("Hips").position.copy(this.hipsRest);
        this.bone("Spine").position.copy(this.spineRest);
        this.root.updateMatrixWorld(true);
        this.solvePose(p, shot, t, this.splinePaddle, undefined, prep);
        const values = new Float64Array(this.sampleValues.length);
        this.bone("Hips").position.toArray(values, 0);
        // Socket swivel is unwrapped as an angle; it must not choose a different grip per frame.
        const relative = main.grip.clone().invert()
          .multiply(main.hand.matrixWorld.clone().invert())
          .multiply(this.root.matrixWorld)
          .multiply(this.splinePaddle.matrix);
        let swivel = -Math.atan2(relative.elements[8], relative.elements[0]);
        if (keys.length) swivel = keys.at(-1)!.values[3] + angleDiff(swivel, keys.at(-1)!.values[3]);
        // One socket branch for the entire stroke; even key-time swivel searches must not
        // insert a 180° wrist turn between two nearby drawings.
        values[3] = keys[0]?.values[3] ?? swivel;
        this.driven.forEach((b, i) => b.quaternion.toArray(values, 4 + i * 4));
        keys.push({ time: t, values });
        if (shot && t === 0) {
          impactPose = values.slice();
          // Differentiate the analytic IK at impact with the authored paddle velocity. This
          // carries the whip in the ARM, rather than translating the pelvis up to fake it.
          const h = 0.0001;
          const before = playerPose(p, shot, -h, prep).paddle, after = playerPose(p, shot, h, prep).paddle;
          const velocity = v(after.x - before.x, after.y - before.y, after.z - before.z).divideScalar(2 * h);
          const shoulder = worldPos(main.upper, new T.Vector3());
          const elbow0 = worldPos(main.fore, new T.Vector3()), wrist0 = worldPos(main.hand, new T.Vector3());
          const upperQ = worldQuat(main.upper, new T.Quaternion()), foreQ = worldQuat(main.fore, new T.Quaternion()), handQ = worldQuat(main.hand, new T.Quaternion());
          const axis = wrist0.clone().sub(shoulder).normalize();
          const pole = elbow0.clone().sub(shoulder).addScaledVector(axis, -elbow0.clone().sub(shoulder).dot(axis));
          const samples: Float64Array[] = [];
          for (const sign of [-1, 1]) {
            const e = new T.Vector3(), w = new T.Vector3(), bend = new T.Vector3();
            twoBone(shoulder, wrist0.clone().addScaledVector(velocity, sign * h), main.l1, main.l2, pole,
              chainReach(main.l1, main.l2, ELBOW_MIN), chainReach(main.l1, main.l2, ELBOW_MAX), e, w, bend);
            setWorldQuat(main.upper, new T.Quaternion().setFromUnitVectors(elbow0.clone().sub(shoulder).normalize(), e.clone().sub(shoulder).normalize()).multiply(upperQ));
            setWorldQuat(main.fore, new T.Quaternion().setFromUnitVectors(wrist0.clone().sub(elbow0).normalize(), w.sub(e).normalize()).multiply(foreQ));
            setWorldQuat(main.hand, handQ);
            const q = new Float64Array(values.length);
            this.driven.forEach((b, i) => {
              const c = 4 + i * 4;
              b.quaternion.toArray(q, c);
              if (q[c] * values[c] + q[c+1] * values[c+1] + q[c+2] * values[c+2] + q[c+3] * values[c+3] < 0)
                for (let j=0;j<4;j++) q[c+j] *= -1;
            });
            samples.push(q);
          }
          impactVelocity = new Float64Array(values.length);
          for (const b of [main.upper, main.fore, main.hand]) {
            const c = 4 + this.driven.indexOf(b) * 4;
            for (let j=0;j<4;j++) impactVelocity[c+j] = (samples[1][c+j] - samples[0][c+j]) / (2*h);
          }
        }
      }
      spline = new PoseSpline(keys, this.driven.map((_, i) => 4 + i * 4));

      // Bounded cache: editing a point must not retain old scenarios indefinitely.
      if (this.drawings.size > 32) this.drawings.clear();
      this.drawings.set(key, spline);
    }
    spline.sample(time ?? 0, this.sampleValues);
    this.bone("Spine").position.copy(this.spineRest);
    this.bone("Hips").position.fromArray(this.sampleValues);
    this.driven.forEach((b, i) => readQuaternion(b.quaternion, this.sampleValues, 4 + i * 4));
    this.root.updateMatrixWorld(true);
    // Smooth joint-limit projection after interpolation; no hard corner or branch choice.
    for (const s of [] as Side[]) {
      const arm = this.arms[s];
      const shoulder = worldPos(arm.upper, new T.Vector3()), elbow = worldPos(arm.fore, new T.Vector3()), wrist = worldPos(arm.hand, new T.Vector3());
      const a = shoulder.sub(elbow).normalize(), b = wrist.sub(elbow).normalize();
      const interior = a.angleTo(b), limited = softClamp(interior, ELBOW_MIN, ELBOW_MAX, 0.12);
      const axis = a.clone().cross(b).normalize();
      setWorldQuat(arm.fore, new T.Quaternion().setFromAxisAngle(axis, limited - interior).multiply(worldQuat(arm.fore, new T.Quaternion())));
      const delta = arm.hand.quaternion.clone().multiply(arm.handRest.clone().invert());
      const twist = twistAbout(delta, arm.foreAxis, new T.Quaternion());
      const swing = delta.multiply(twist.clone().invert());
      const ang = 2 * Math.acos(Math.min(1, Math.abs(swing.w)));
      const dir = v(swing.x, swing.y, swing.z).multiplyScalar(Math.sign(swing.w) || 1).normalize();
      const flex = softClamp(ang * dir.dot(arm.flexAxis), -WRIST_LIMITS.flex, WRIST_LIMITS.flex, 0.16);
      const dev = softClamp(ang * dir.dot(arm.devAxis), -WRIST_LIMITS.deviation, WRIST_LIMITS.deviation, 0.12);
      const r = arm.flexAxis.clone().multiplyScalar(flex).addScaledVector(arm.devAxis, dev), len = r.length();
      arm.hand.quaternion.copy(len > 1e-9 ? new T.Quaternion().setFromAxisAngle(r.divideScalar(len), len) : new T.Quaternion())
        .multiply(twist).multiply(arm.handRest);
    }
    this.root.updateMatrixWorld(true);
    const toChar = _m1.copy(this.root.matrixWorld).invert();
    const held = _m2.copy(toChar).multiply(main.hand.matrixWorld).multiply(main.grip);
    held.multiply(new T.Matrix4().makeRotationY(-this.sampleValues[3]));
    held.decompose(paddle.position, paddle.quaternion, _a);
    const target = playerPose(p, shot, time, prep);
    // Continuous analytic IK: the spline authors swivel/roll, never a discrete elbow search.
    // Meet the paddle with the arm, NOT by using a large pelvis translation to fake its whip.
    const invRoot = this.root.matrixWorld.clone().invert();
    const shoulder0 = worldPos(main.upper, new T.Vector3()).applyMatrix4(invRoot);
    const elbow0 = worldPos(main.fore, new T.Vector3()).applyMatrix4(invRoot);
    const wrist0 = worldPos(main.hand, new T.Vector3()).applyMatrix4(invRoot);
    const upperQ0 = worldQuat(main.upper, new T.Quaternion()), foreQ0 = worldQuat(main.fore, new T.Quaternion());
    const upperDir = elbow0.clone().sub(shoulder0).normalize(), foreDir = wrist0.clone().sub(elbow0).normalize();
    const axis0 = wrist0.clone().sub(shoulder0).normalize();
    // Outward pole is explicit in the chest frame: it cannot follow an unstable straight-arm
    // drawing through the shoulder axis and flip the elbow to the other side.
    const chestQ = worldQuat(this.bone("Spine2"), new T.Quaternion()).multiply(this.restQ.get(this.bone("Spine2"))!.clone().invert());
    const pole = v(main.sign, -0.1, 0).applyQuaternion(chestQ).normalize();
    const bodyBack = v(0, 0, 1).applyQuaternion(chestQ);
    this.bone("Hips").position.addScaledVector(bodyBack, 0.18 * (1 - ease(target.readiness)));
    this.root.updateMatrixWorld(true);
    const socketInv = main.grip.clone().invert();
    const swivel = new T.Matrix4().makeRotationY(this.sampleValues[3]);
    const centre = v(target.paddle.x, target.paddle.y, target.paddle.z);
    const qPaddle = new T.Quaternion().setFromEuler(new T.Euler(
      target.paddlePitch, target.paddleYaw, target.paddleRoll, "YXZ"));
    const min = chainReach(main.l1, main.l2, ELBOW_MIN);
    const max = chainReach(main.l1, main.l2, (130+30*ease(target.readiness))*Math.PI/180);
    for (let pass=0;pass<3;pass++) {
      const handTarget = new T.Matrix4().compose(centre, qPaddle, v(1,1,1)).multiply(swivel).multiply(socketInv);
      const goal = new T.Vector3(), handQ = new T.Quaternion();
      handTarget.decompose(goal, handQ, _a);
      const chest = worldPos(this.bone("Spine2"), new T.Vector3()).applyMatrix4(invRoot);
      const right = v(1,0,0).applyQuaternion(chestQ), front = v(0,0,-1).applyQuaternion(chestQ);
      const offset = goal.clone().sub(chest);
      const lateral = offset.dot(right)*main.sign, ahead = offset.dot(front);
      const lateralTarget = softClamp(lateral, target.twoHanded ? -0.14 : 0.40, 0.49, 0.04);
      const forwardTarget = softClamp(ahead, 0.33, 0.39, 0.025);
      this.bone("Hips").position.addScaledVector(right, main.sign*(lateral-lateralTarget));
      this.bone("Hips").position.addScaledVector(front, ahead-forwardTarget);
      this.root.updateMatrixWorld(true);
      for (let k=0;k<2;k++) {
        const shoulder = worldPos(main.upper, new T.Vector3()).applyMatrix4(invRoot);
        const d = goal.clone().sub(shoulder), length = d.length();
        // Preserve lateral/forward clearance; squat/reach vertically instead of undoing it
        // by pulling the sternum into the hand along the entire reach vector.
        const vertical = Math.sqrt(Math.max(0.012, max*max - d.x*d.x - d.z*d.z));
        const boundedY = softClamp(d.y,-vertical,vertical,0.12);
        this.bone("Hips").position.y += d.y - boundedY;
        this.root.updateMatrixWorld(true);
      }
      const shoulder = worldPos(main.upper, new T.Vector3()).applyMatrix4(invRoot);
      const e = new T.Vector3(), w = new T.Vector3(), bend = new T.Vector3();
      const wantedFore = handQ.clone().multiply(main.handRest.clone().invert());
      const handAxis = main.foreAxis.clone().applyQuaternion(wantedFore);
      const gripPole = goal.clone().addScaledVector(handAxis,-main.l2).sub(shoulder)
        .addScaledVector(v(main.sign,0,0).applyQuaternion(chestQ),0.20);
      twoBone(shoulder, goal, main.l1, main.l2, gripPole, min, max, e, w, bend, 0);
      setWorldQuat(main.upper, new T.Quaternion().setFromUnitVectors(upperDir, e.clone().sub(shoulder).normalize()).multiply(upperQ0));
      const foreQ = handQ.clone().multiply(main.handRest.clone().invert());
      const desiredAxis = main.foreAxis.clone().applyQuaternion(foreQ);
      foreQ.premultiply(new T.Quaternion().setFromUnitVectors(desiredAxis, w.sub(e).normalize()));
      setWorldQuat(main.fore, foreQ);
      setWorldQuat(main.hand, handQ);
      for (const s of SIDES) this.limitWrist(this.arms[s]);
      this.root.updateMatrixWorld(true);
      _m2.copy(invRoot).multiply(main.hand.matrixWorld).multiply(main.grip).multiply(new T.Matrix4().makeRotationY(-this.sampleValues[3]));
      _m2.decompose(paddle.position, qPaddle, _a);
    }
    paddle.quaternion.copy(qPaddle);
    this.bone("Hips").position.add(centre.clone().sub(paddle.position));
    this.root.updateMatrixWorld(true);
    // Keep a comfortable knee reserve. Reach above the planted leg's envelope is shared by
    // the spine (small stretch) rather than silently lifting the shoe or locking the knee.
    this.root.updateMatrixWorld(true);
    let lower = 0, raise = 0;
    for (const s of SIDES) {
      const leg = this.legs[s], f = target.feet[s === "Left" ? "L" : "R"];
      const hip = worldPos(leg.up, new T.Vector3()).applyMatrix4(invRoot);
      const minL = chainReach(leg.l1, leg.l2, 42 * Math.PI / 180);
      const maxL = (leg.l1 + leg.l2) * 0.975;
      const flat2 = (hip.x - f.x) ** 2 + (hip.z - f.z) ** 2;
      const rootPositive = (x: number) => Math.sqrt((x + Math.hypot(x, 0.015)) / 2);
      const height = rootPositive(maxL * maxL - flat2);
      const ankleHeight = this.ankleY + f.lift + target.hop;
      const d = hip.y - (ankleHeight + height);
      const positive = (d + Math.hypot(d, 0.035)) / 2;
      lower = (lower + positive + Math.hypot(lower - positive, 0.008)) / 2;
      const minimum = ankleHeight + rootPositive(minL * minL - flat2);
      const postureFloor = this.postureFloor(shot,target);
      const floor = (minimum + postureFloor + Math.hypot(minimum-postureFloor,0.02))/2;
      const r = floor - hip.y;
      const rise = (r + Math.hypot(r, 0.035)) / 2;
      raise = (raise + rise + Math.hypot(raise - rise, 0.008)) / 2;
    }
    lower -= raise;
    this.bone("Hips").position.y -= lower;
    const spine = this.bone("Spine");
    // Local +Y is rest-calibrated along the spine, not an assumed limb Euler axis.
    spine.position.add(v(0, lower, 0).applyQuaternion(worldQuat(this.bone("Hips"), new T.Quaternion()).invert()));
    paddle.position.copy(centre);
    paddle.updateMatrix();
    this.root.updateMatrixWorld(true);
    const forward = v(target.forward.x, 0, target.forward.z), right = v(target.right.x, 0, target.right.z);
    for (const s of SIDES) {
      const leg = this.legs[s], f = target.feet[s === "Left" ? "L" : "R"];
      const ankle = v(f.x, this.ankleY + f.lift + target.hop, f.z);
      if (movement) {
        const cycle = Math.floor((movement.clock + (s === "Left" ? 0.4 : 0)) / 0.8);
        const u = ((movement.clock + (s === "Left" ? 0.4 : 0)) / 0.8 - cycle) * 2;
        const nominal = ankle.clone().add(v(p.x, 0, p.z));
        let foot = this.smoothFeet.get(s);
        if (!foot) {
          foot = { start: nominal.clone(), end: nominal.clone(), cycle: cycle - 1 };
          this.smoothFeet.set(s, foot);
        }
        if (cycle !== foot.cycle) {
          foot.start.copy(foot.end);
          foot.end.copy(nominal).addScaledVector(movement.velocity, 0.35);
          foot.cycle = cycle;
        }
        ankle.copy(foot.start).lerp(foot.end, ease(u)).sub(v(p.x, 0, p.z));
        ankle.y = this.ankleY + target.hop + (u < 1 ? Math.sin(Math.PI * u) ** 2 * Math.min(0.055, foot.start.distanceTo(foot.end) * 0.2) : 0);
      } else this.smoothFeet.clear();
      const hip = worldPos(leg.up, new T.Vector3()).applyMatrix4(_m1.copy(this.root.matrixWorld).invert());
      const knee = new T.Vector3(), end = new T.Vector3(), bend = new T.Vector3();
      const axis = ankle.clone().sub(hip);
      // Solve the sagittal plane explicitly. Its horizontal projection follows the shoe's
      // toe even with a wide side-step; a naive projected forward pole can yaw the knee inward.
      const kneePole = forward.clone().addScaledVector(right, leg.sign * 0.14);
      kneePole.y = -kneePole.dot(axis) / axis.y;
      twoBone(hip, ankle, leg.l1, leg.l2, kneePole,
        chainReach(leg.l1, leg.l2, 40 * Math.PI / 180), (leg.l1 + leg.l2) * 0.98, knee, end, bend, 0);
      aim(leg.aimUp, knee.sub(hip), bend);
      aim(leg.aimLeg, end.sub(hip).sub(knee), bend);
      setWorldQuat(leg.foot, new T.Quaternion().setFromAxisAngle(UP, target.stanceYaw).multiply(this.restQ.get(leg.foot)!));
    }
    this.root.updateMatrixWorld(true);
    // Solve order: planted legs → pelvis envelope → spine/clavicles → arms with clearance
    // → hands/fingers → head. The earlier reach calculation plans the pelvis, not an IK branch.
    this.solveGuard(target,paddle,handSide,chestQ);
    // Capsules follow the smoothed skeleton and distributed correction, not the last bake key.
    const charPos = (n: string) => worldPos(this.bone(n), new T.Vector3()).applyMatrix4(_m1.copy(this.root.matrixWorld).invert());
    const front = v(0, 0, -1).applyQuaternion(worldQuat(this.bone("Spine2"), new T.Quaternion()).multiply(this.restQ.get(this.bone("Spine2"))!.clone().invert()));
    const joints = ["Hips", "Spine", "Spine1", "Spine2"].map(charPos);
    this.torsoCapsules = [
      { a: joints[0].clone().add(v(0, -0.12)), b: joints[0].clone(), radius: 0.175, squash: 1.75, front: front.clone() },
      { a: joints[0].clone(), b: joints[2].clone(), radius: 0.14, squash: 1.5, front: front.clone() },
      { a: joints[2].clone(), b: joints[3].clone().add(v(0, 0.05)), radius: 0.155, squash: 1.2, front: front.clone() },
    ];
    for (const c of this.torsoCapsules) { c.a.addScaledVector(front, 0.045); c.b = c.b.clone().addScaledVector(front, 0.045); }
    this.gripWeights = p.hand === "left" ? [1, target.supportWeight] : [target.supportWeight, 1];
    this.mesh.skeleton.update();
    return charPos("Head").add(v(0, 0.19));
  }

  private postureFloor(shot: Shot | undefined, target: ReturnType<typeof playerPose>) {
    const height=shot?.type === "serve" ? shot.from.y+0.07-0.26*target.loading
      : shot && ["dink","reset","block"].includes(shot.type) ? 0.57+0.06*target.loading : 0;
    return height*(1-ease(target.readiness));
  }
  private solveGuard(target: ReturnType<typeof playerPose>, paddle: T.Object3D, handSide: Side, chestQ: T.Quaternion) {
    const invRoot=this.root.matrixWorld.clone().invert();
    const off=this.arms[handSide === "Left" ? "Right" : "Left"];
    const os=worldPos(off.upper,new T.Vector3()).applyMatrix4(invRoot);
    const oe=worldPos(off.fore,new T.Vector3()).applyMatrix4(invRoot);
    const ow=worldPos(off.hand,new T.Vector3()).applyMatrix4(invRoot);
    const oq=worldQuat(off.hand,new T.Quaternion());
    const oc=worldPos(this.bone("Spine2"),new T.Vector3()).applyMatrix4(invRoot);
    const cr=v(1,0,0).applyQuaternion(chestQ), cf=v(0,0,-1).applyQuaternion(chestQ);
    const og=ow.clone(),rel=og.clone().sub(oc),ol=rel.dot(cr)*off.sign,oa=rel.dot(cf);
    og.addScaledVector(cr,off.sign*(softClamp(ol,0.35,0.43,0.035)-ol));
    og.addScaledVector(cf,softClamp(oa,0.29,0.37,0.035)-oa);
    const hip=worldPos(this.bone("Hips"),new T.Vector3()).applyMatrix4(invRoot);
    const below=hip.y+0.28-og.y;
    og.y+=(below+Math.hypot(below,0.04))/2;
    if(target.supportWeight>0) {
      const support=new T.Matrix4().compose(paddle.position,paddle.quaternion,v(1,1,1)).multiply(off.support.clone().invert());
      og.lerp(new T.Vector3().setFromMatrixPosition(support),target.supportWeight);
      const sq=new T.Quaternion(); support.decompose(_a,sq,_b); oq.slerp(sq,target.supportWeight);
    }
    const e=new T.Vector3(),w=new T.Vector3(),bend=new T.Vector3();
    twoBone(os,og,off.l1,off.l2,v(off.sign,0,0).applyQuaternion(chestQ),chainReach(off.l1,off.l2,ELBOW_MIN),chainReach(off.l1,off.l2,140*Math.PI/180),e,w,bend,0);
    setWorldQuat(off.upper,new T.Quaternion().setFromUnitVectors(oe.sub(os).normalize(),e.clone().sub(os).normalize()).multiply(worldQuat(off.upper,new T.Quaternion())));
    const fq=oq.clone().multiply(off.handRest.clone().invert());
    fq.premultiply(new T.Quaternion().setFromUnitVectors(off.foreAxis.clone().applyQuaternion(fq),w.sub(e).normalize()));
    setWorldQuat(off.fore,fq); setWorldQuat(off.hand,oq); this.limitWrist(off);
    this.root.updateMatrixWorld(true);
  }

  wristDemand: Record<string, { flex: number; dev: number; w: number }> = {};
  private limitWrist(arm: ArmRig) {
    const delta = arm.hand.quaternion.clone().multiply(arm.handRest.clone().invert());
    const twist = twistAbout(delta, arm.foreAxis, new T.Quaternion());
    const swing = delta.multiply(twist.clone().invert());
    const ang = 2 * Math.acos(Math.min(1, Math.abs(swing.w)));
    const dir = v(swing.x, swing.y, swing.z).multiplyScalar(Math.sign(swing.w) || 1).normalize();
    const rawFlex = ang * dir.dot(arm.flexAxis), rawDev = ang * dir.dot(arm.devAxis);
    this.wristDemand[arm.sign] = { flex: rawFlex, dev: rawDev, w: swing.w };
    const saturate = (x: number, limit: number) => x / Math.sqrt(1 + (x / limit) ** 2);
    const flex = saturate(rawFlex, WRIST_LIMITS.flex);
    const dev = saturate(rawDev, WRIST_LIMITS.deviation);
    const r = arm.flexAxis.clone().multiplyScalar(flex).addScaledVector(arm.devAxis, dev), len = r.length();
    arm.hand.quaternion.copy(len > 1e-9 ? new T.Quaternion().setFromAxisAngle(r.divideScalar(len), len) : new T.Quaternion())
      .multiply(twist).multiply(arm.handRest);
  }

  private solvePose(
    p: Player,
    shot: Shot | undefined,
    time: number | undefined,
    paddle: T.Object3D,
    movement?: { velocity: T.Vector3; clock: number; dt: number },
    preparation?: number,
  ) {
    const pose = playerPose(p, shot, time, preparation);
    const root = this.root;
    root.updateMatrixWorld(true);
    // Character (marker) space ↔ world. Markers only translate, so rotations are shared.
    const toWorld = root.matrixWorld.clone(),
      toChar = toWorld.clone().invert();
    const charPos = (o: T.Object3D, out = new T.Vector3()) =>
      worldPos(o, out).applyMatrix4(toChar);
    const bodyQ = new T.Quaternion().setFromEuler(
      new T.Euler(pose.pitch, pose.yaw, pose.roll, "YXZ"),
    );
    const hipQ = new T.Quaternion().setFromEuler(
      new T.Euler(pose.pitch * 0.4, pose.hipYaw, pose.roll * 0.4, "YXZ"),
    );
    const stanceQ = new T.Quaternion().setFromAxisAngle(UP, pose.stanceYaw);
    const forward = v(pose.forward.x, 0, pose.forward.z),
      right = v(pose.right.x, 0, pose.right.z);
    const chestRight = v(1, 0, 0).applyQuaternion(bodyQ),
      chestFront = v(0, 0, -1).applyQuaternion(bodyQ),
      chestUp = v(0, 1, 0).applyQuaternion(bodyQ);
    // ---- pelvis ------------------------------------------------------------------------------
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
    // pose.hip.y + 0.23 is the pelvis height of the reference 0.95 m stance.
    const drop = Math.max(0.43, pose.hip.y + 0.23) - 0.95;
    const ankles = {} as Record<Side, T.Vector3>;
    for (const s of SIDES) {
      const sign = sideSign(s),
        suffix = s === "Left" ? "L" : "R";
      const placed = pose.feet[suffix];
      const legPhase =
        (((phase + (sign < 0 ? Math.PI : 0)) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2);
      const ankle = v(placed.x, this.ankleY + pose.hop + placed.lift, placed.z);
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
          ankle.y =
            this.ankleY + pose.hop + Math.sin(u * Math.PI) * this.gait * 0.42;
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
      ankles[s] = ankle;
    }
    const hipsBase = v(
      this.hipsRest.x + pose.hip.x,
      this.hipsRest.y +
        drop +
        pose.hop +
        this.gait * 0.08 * Math.abs(Math.sin(phase)),
      this.hipsRest.z + pose.hip.z,
    );
    const run = (assist: T.Vector3) => {
      const hipsPos = hipsBase.clone().add(assist);
      const hips = this.bone("Hips");
      hips.position.copy(hipsPos);
      hips.quaternion.copy(hipQ).multiply(this.restQ.get(hips)!);
      hips.updateWorldMatrix(false, false);
      // ---- legs and feet ------------------------------------------------------------------------
      for (const s of SIDES) {
        const leg = this.legs[s],
          sign = leg.sign;
        const ankle = ankles[s];
        leg.up.updateWorldMatrix(false, false);
        const hip = charPos(leg.up);
        const pole = forward.clone().addScaledVector(right, sign * 0.2);
        const knee = new T.Vector3(),
          end = new T.Vector3(),
          bend = new T.Vector3();
        twoBone(
          hip,
          ankle,
          leg.l1,
          leg.l2,
          pole,
          Math.abs(leg.l1 - leg.l2) + 0.01,
          (leg.l1 + leg.l2) * 0.999,
          knee,
          end,
          bend,
        );
        aim(leg.aimUp, knee.clone().sub(hip), bend);
        aim(leg.aimLeg, end.clone().sub(knee), bend);
        setWorldQuat(
          leg.foot,
          _q1.copy(stanceQ).multiply(this.restQ.get(leg.foot)!),
        );
      }
      // ---- spine, neck, head --------------------------------------------------------------------
      const rel = hipQ.clone().invert().multiply(bodyQ);
      ["Spine", "Spine1", "Spine2"].forEach((n, i) => {
        const b = this.bone(n);
        b.updateWorldMatrix(false, false);
        setWorldQuat(
          b,
          _q1
            .copy(hipQ)
            .multiply(_q2.identity().slerp(rel, SPINE_SPLIT[i]))
            .multiply(this.restQ.get(b)!),
        );
      });
      const headQ = bodyQ
        .clone()
        .multiply(new T.Quaternion().setFromAxisAngle(v(1, 0), pose.track));
      const neck = this.bone("Neck"),
        head = this.bone("Head");
      neck.updateWorldMatrix(false, false);
      setWorldQuat(
        neck,
        _q1
          .copy(bodyQ)
          .slerp(headQ, NECK_SHARE)
          .multiply(this.restQ.get(neck)!),
      );
      head.updateWorldMatrix(false, false);
      setWorldQuat(head, _q1.copy(headQ).multiply(this.restQ.get(head)!));
      // ---- torso volume for the arm clearance ---------------------------------------------------
      const spine = ["Hips", "Spine", "Spine1", "Spine2"].map((n) =>
        charPos(this.bone(n)),
      );
      // The mesh torso is centred ~4.5 cm in front of the Tripo spine joints.
      const shift = chestFront.clone().multiplyScalar(0.045);
      const capsule = (
        a: T.Vector3,
        b: T.Vector3,
        radius: number,
        squash: number,
      ): TorsoCapsule => ({
        a: a.clone().add(shift),
        b: b.clone().add(shift),
        radius,
        squash,
        front: chestFront.clone(),
      });
      // Cross-sections measured on the bind mesh (half width × half depth): hips 0.175×0.1,
      // waist 0.14×0.095, chest 0.155×0.13.
      this.torsoCapsules = [
        capsule(
          spine[0].clone().addScaledVector(chestUp, -0.12),
          spine[0],
          0.175,
          1.75,
        ),
        capsule(spine[0], spine[2], 0.14, 1.5),
        capsule(
          spine[2],
          spine[3].clone().addScaledVector(chestUp, 0.05),
          0.155,
          1.2,
        ),
      ];
      // ---- paddle target ------------------------------------------------------------------------
      const handSign = p.hand === "left" ? -1 : 1;
      const main = this.arms[handSign < 0 ? "Left" : "Right"],
        off = this.arms[handSign < 0 ? "Right" : "Left"];
      const paddleQ = new T.Quaternion().setFromEuler(
        new T.Euler(pose.paddlePitch, pose.paddleYaw, pose.paddleRoll, "YXZ"),
      );
      const paddleTarget = new T.Matrix4().compose(
        v(pose.paddle.x, pose.paddle.y, pose.paddle.z),
        paddleQ,
        v(1, 1, 1),
      );
      // The hitting hand is locked to the ball around contact (the paddle must be on the ball).
      const contactLock =
        pose.active && time !== undefined
          ? T.MathUtils.smoothstep(Math.abs(time), 0.01, 0.06)
          : 1;
      const shrugFor = (goalY: number, shoulderY: number) =>
        T.MathUtils.smoothstep(goalY - shoulderY, 0.2, 0.6);
      // ---- arms ---------------------------------------------------------------------------------
      const solveArm = (
        arm: ArmRig,
        wristGoal: T.Vector3,
        handGoalQ: T.Quaternion | undefined,
        movable: number,
        ownSide: boolean,
      ) => {
        const sign = arm.sign;
        // Clavicle: follows the chest, elevates for high hands (scapulohumeral rhythm), protracts
        // when the hand reaches across.
        arm.clavicle.updateWorldMatrix(false, false);
        arm.upper.updateWorldMatrix(false, false);
        const restShoulder = charPos(arm.upper);
        const lift = shrugFor(wristGoal.y, restShoulder.y) * 0.32;
        const across = T.MathUtils.clamp(
          -sign * wristGoal.clone().sub(restShoulder).dot(chestRight) * 1.2,
          0,
          0.35,
        );
        const dir = arm.clavicleDir
          .clone()
          .applyQuaternion(bodyQ)
          .addScaledVector(chestUp, lift)
          .addScaledVector(chestFront, across);
        aim(arm.aimClavicle, dir, chestUp);
        arm.upper.updateWorldMatrix(false, false);
        const shoulder = charPos(arm.upper);
        // Elbow pole: down + outward + slightly back, never into the ribs.
        const pole = chestUp
          .clone()
          .multiplyScalar(-0.6)
          .addScaledVector(chestRight, sign * (0.55 + pose.elbowOut * 0.4))
          .addScaledVector(chestFront, -0.2);
        if (handGoalQ) {
          // Holding the paddle: put the elbow where the forearm lines up with the hand's
          // orientation, so the wrist needs little bend (falls back to the default pole).
          const ideal = wristGoal
            .clone()
            .addScaledVector(
              arm.foreInHand.clone().applyQuaternion(handGoalQ),
              -arm.l2,
            )
            .sub(shoulder);
          if (ideal.lengthSq() > 1e-6)
            pole.normalize().lerp(ideal.normalize(), 0.75);
        }
        const minReach = chainReach(arm.l1, arm.l2, ELBOW_MIN),
          maxReach = chainReach(arm.l1, arm.l2, ELBOW_MAX);
        const goal = wristGoal.clone();
        if (ownSide) {
          // Off arm / ready: the hand stays on its own side of the body midline.
          const lat = goal.clone().sub(spine[3]).dot(chestRight) * sign;
          if (lat < 0.02) goal.addScaledVector(chestRight, sign * (0.02 - lat));
        }
        const elbow = new T.Vector3(),
          wrist = new T.Vector3(),
          bend = new T.Vector3(),
          palm = new T.Vector3();
        const gap = (e: T.Vector3, w: T.Vector3, normal?: T.Vector3) => {
          const from = shoulder.clone().lerp(e, UPPER_ARM_FREE);
          const n1 = new T.Vector3(),
            n2 = new T.Vector3();
          const g1 = segmentGap(
            this.torsoCapsules,
            from,
            e,
            UPPER_ARM_RADIUS,
            5,
            n1,
          );
          palm.copy(w).addScaledVector(w.clone().sub(e).normalize(), 0.07);
          const g2 = segmentGap(
            this.torsoCapsules,
            e,
            palm,
            FOREARM_RADIUS,
            6,
            n2,
          );
          normal?.copy(g1 < g2 ? n1 : n2);
          return Math.min(g1, g2) - ARM_CLEARANCE;
        };
        const solve = (polar: T.Vector3) =>
          twoBone(
            shoulder,
            goal,
            arm.l1,
            arm.l2,
            polar,
            minReach,
            maxReach,
            elbow,
            wrist,
            bend,
          );
        solve(pole);
        // Clearance: (1) swing the elbow about the shoulder→wrist axis to the nearest clear angle;
        // (2) still touching → move the hand out along the torso normal and repeat.
        const push = new T.Vector3();
        for (let pass = 0; pass < 8; pass++) {
          let g = gap(elbow, wrist, push);
          if (g >= 0) break;
          const axis = wrist.clone().sub(shoulder).normalize();
          const u0 = bend.clone(),
            u1 = new T.Vector3().crossVectors(axis, u0);
          let best = u0.clone(),
            bestGap = g;
          for (let k = 1; k <= 12 && bestGap < 0; k++)
            for (const turn of [k, -k]) {
              const angle = (turn * Math.PI) / 18;
              const candidate = u0
                .clone()
                .multiplyScalar(Math.cos(angle))
                .addScaledVector(u1, Math.sin(angle));
              solve(candidate);
              const cg = gap(elbow, wrist);
              if (cg > bestGap + 1e-5) {
                best = candidate;
                bestGap = cg;
              }
            }
          solve(best);
          g = gap(elbow, wrist, push);
          if (g >= 0 || movable <= 0) break;
          goal.copy(wrist).addScaledVector(push, (-g + 0.008) * movable);
          solve(best);
        }
        aim(arm.aimUpper, elbow.clone().sub(shoulder), bend);
        aim(arm.aimFore, wrist.clone().sub(elbow), bend);
        // Hand: target rotation (paddle grip) or a relaxed continuation of the forearm.
        const foreQ = worldQuat(arm.fore, new T.Quaternion());
        const handW = handGoalQ
          ? handGoalQ.clone()
          : foreQ.clone().multiply(arm.handRest);
        // Forearm takes half the twist (swing-twist split, rig-guide §4.2).
        const delta = foreQ
          .clone()
          .invert()
          .multiply(handW)
          .multiply(arm.handRest.clone().invert());
        const twist = twistAbout(delta, arm.foreAxis, new T.Quaternion());
        const angle = T.MathUtils.clamp(
          twistAngle(twist, arm.foreAxis),
          -MAX_TWIST,
          MAX_TWIST,
        );
        arm.fore.quaternion.multiply(
          _q3.setFromAxisAngle(arm.foreAxis, angle * FOREARM_TWIST),
        );
        arm.fore.updateWorldMatrix(false, false);
        // Wrist: limit flexion/extension and deviation of what the hand has left.
        const foreQ2 = worldQuat(arm.fore, new T.Quaternion());
        const local = foreQ2.clone().invert().multiply(handW);
        const rest = local.clone().multiply(arm.handRest.clone().invert()); // forearm frame
        const residual = twistAbout(rest, arm.foreAxis, new T.Quaternion());
        const swing = rest.clone().multiply(residual.clone().invert());
        const sAngle =
          2 * Math.acos(T.MathUtils.clamp(Math.abs(swing.w), -1, 1));
        if (sAngle > 1e-5) {
          const sAxis = v(swing.x, swing.y, swing.z)
            .multiplyScalar(Math.sign(swing.w) || 1)
            .normalize();
          const flex = T.MathUtils.clamp(
            sAngle * sAxis.dot(arm.flexAxis),
            -WRIST_LIMITS.flex,
            WRIST_LIMITS.flex,
          );
          const dev = T.MathUtils.clamp(
            sAngle * sAxis.dot(arm.devAxis),
            -WRIST_LIMITS.deviation,
            WRIST_LIMITS.deviation,
          );
          const r = arm.flexAxis
            .clone()
            .multiplyScalar(flex)
            .addScaledVector(arm.devAxis, dev);
          const len = r.length();
          if (len > 1e-6) swing.setFromAxisAngle(r.divideScalar(len), len);
          else swing.identity();
        }
        const resAngle = T.MathUtils.clamp(
          twistAngle(residual, arm.foreAxis),
          -MAX_TWIST * (1 - FOREARM_TWIST),
          MAX_TWIST * (1 - FOREARM_TWIST),
        );
        residual.setFromAxisAngle(arm.foreAxis, resAngle);
        arm.hand.quaternion
          .copy(swing)
          .multiply(residual)
          .multiply(arm.handRest);
        arm.hand.updateWorldMatrix(false, false);
        return { shoulder, elbow, wrist };
      };
      // hand = paddle · Ry(θ) · socket⁻¹: the hand may orbit the (round) handle so the forearm
      // comes from the shoulder side — the paddle orientation itself stays exact.
      // hand = paddle · Ry(θ) · socket⁻¹: the hand may orbit the round handle. θ is picked so the
      // arm can hold the paddle with the least forearm twist / wrist bend (limits: twist 85°,
      // flexion 60°, deviation 30°); the paddle orientation itself stays exact. A small preference
      // toward the analytic θ₀ keeps the choice stable.
      const handTarget = (
        arm: ArmRig,
        socket: T.Matrix4,
        target = paddleTarget,
      ) => {
        const targetQ = new T.Quaternion().setFromRotationMatrix(target);
        const inv = new T.Matrix4().copy(socket).invert();
        const shoulder = charPos(arm.upper);
        const fore = arm.foreInHand.clone().transformDirection(inv); // paddle space
        const toShoulder = v(0, PADDLE_GRIP_Y, 0)
          .applyMatrix4(target)
          .sub(shoulder)
          .applyQuaternion(targetQ.clone().invert());
        const theta0 = Math.atan2(
          toShoulder.x * fore.z - toShoulder.z * fore.x,
          toShoulder.x * fore.x + toShoulder.z * fore.z,
        );
        const minReach = chainReach(arm.l1, arm.l2, ELBOW_MIN),
          maxReach = chainReach(arm.l1, arm.l2, ELBOW_MAX);
        const m = new T.Matrix4(),
          pos = new T.Vector3(),
          q = new T.Quaternion(),
          elbow = new T.Vector3(),
          wrist = new T.Vector3(),
          bend = new T.Vector3(),
          foreQ = new T.Quaternion(),
          twist = new T.Quaternion(),
          defaultPole = chestUp
            .clone()
            .multiplyScalar(-0.6)
            .addScaledVector(chestRight, arm.sign * 0.6)
            .addScaledVector(chestFront, -0.2);
        let best = theta0,
          bestCost = Infinity;
        for (let k = -6; k <= 6; k++) {
          const theta = theta0 + (k * Math.PI) / 12;
          m.copy(target).multiply(_m2.makeRotationY(theta)).multiply(inv);
          m.decompose(pos, q, _a);
          const ideal = pos
            .clone()
            .addScaledVector(arm.foreInHand.clone().applyQuaternion(q), -arm.l2)
            .sub(shoulder);
          const pole = defaultPole
            .clone()
            .normalize()
            .lerp(ideal.normalize(), 0.75);
          twoBone(
            shoulder,
            pos,
            arm.l1,
            arm.l2,
            pole,
            minReach,
            maxReach,
            elbow,
            wrist,
            bend,
          );
          basisQuat(wrist.clone().sub(elbow), bend, foreQ).multiply(
            arm.aimFore.frameInv,
          );
          const delta = foreQ
            .invert()
            .multiply(q)
            .multiply(arm.handRest.clone().invert());
          twistAbout(delta, arm.foreAxis, twist);
          const tw = Math.abs(twistAngle(twist, arm.foreAxis));
          const swing = delta.multiply(twist.invert());
          const sAngle =
            2 * Math.acos(T.MathUtils.clamp(Math.abs(swing.w), 0, 1));
          const sAxis = v(swing.x, swing.y, swing.z);
          if (sAxis.lengthSq() > 1e-12)
            sAxis.multiplyScalar(Math.sign(swing.w) || 1).normalize();
          const flex = Math.abs(sAngle * sAxis.dot(arm.flexAxis)),
            dev = Math.abs(sAngle * sAxis.dot(arm.devAxis));
          const cost =
            2 * Math.max(0, tw - MAX_TWIST) +
            Math.max(0, flex - WRIST_LIMITS.flex) +
            Math.max(0, dev - WRIST_LIMITS.deviation) +
            0.15 * (tw + flex + dev) +
            0.05 * Math.abs(theta - theta0);
          if (cost < bestCost) {
            bestCost = cost;
            best = theta;
          }
        }
        m.copy(target).multiply(_m2.makeRotationY(best)).multiply(inv);
        const outPos = new T.Vector3(),
          outQ = new T.Quaternion();
        m.decompose(outPos, outQ, _a);
        return { pos: outPos, q: outQ, theta: best };
      };
      const fingersTo = (arm: ArmRig, grip: number) => {
        for (const f of arm.fingers)
          f.bone.quaternion
            .copy(f.rest)
            .multiply(
              _q1.setFromAxisAngle(
                f.hinge,
                T.MathUtils.lerp(f.relaxed, f.grip, grip),
              ),
            );
      };
      const handM = (arm: ArmRig) =>
        _m1.copy(toChar).multiply(arm.hand.matrixWorld);
      // Hitting arm holds the paddle.
      // Pass 1 aims for the authored paddle pose; the wrist limits may not allow its orientation.
      // Pass 2 keeps the paddle centre on target with the orientation the hand can actually hold.
      const first = handTarget(main, main.grip);
      let mainTarget = first;
      const held = (theta: number) =>
        handM(main).multiply(main.grip).multiply(_m2.makeRotationY(-theta));
      const centre = v(pose.paddle.x, pose.paddle.y, pose.paddle.z);
      const missOf = (theta: number) =>
        _b.setFromMatrixPosition(held(theta)).distanceTo(centre);
      solveArm(main, first.pos, first.q, contactLock, !pose.active);
      const miss1 = missOf(first.theta);
      const reachable = new T.Quaternion();
      held(first.theta).decompose(_a, reachable, _b);
      if (reachable.angleTo(paddleQ) > 0.2) {
        const second = handTarget(
          main,
          main.grip,
          new T.Matrix4().compose(centre, reachable, v(1, 1, 1)),
        );
        solveArm(main, second.pos, second.q, contactLock, !pose.active);
        if (missOf(second.theta) < miss1 - 0.005) mainTarget = second;
        else solveArm(main, first.pos, first.q, contactLock, !pose.active);
      }
      // Close the remaining gap: shift the wrist target by the paddle-centre miss (twice at most).
      for (let k = 0; k < 2; k++) {
        const now = missOf(mainTarget.theta);
        if (now < 0.01) break;
        const shifted = {
          ...mainTarget,
          pos: mainTarget.pos.clone().add(centre).sub(_b),
        };
        solveArm(main, shifted.pos, shifted.q, contactLock, !pose.active);
        if (missOf(shifted.theta) < now - 0.003) mainTarget = shifted;
        else {
          solveArm(
            main,
            mainTarget.pos,
            mainTarget.q,
            contactLock,
            !pose.active,
          );
          break;
        }
      }
      fingersTo(main, 1);
      // Paddle follows the hand actually reached.
      held(mainTarget.theta).decompose(paddle.position, paddle.quaternion, _a);
      paddle.scale.set(1, 1, 1);
      paddle.updateMatrix();
      const paddleM = new T.Matrix4().compose(
        paddle.position,
        paddle.quaternion,
        v(1, 1, 1),
      );
      const faceNormal = v(0, 0, 1).applyQuaternion(paddle.quaternion);
      // ---- off arm ------------------------------------------------------------------------------
      const offSign = off.sign,
        clock = time ?? 0;
      const shoulderOff = charPos(off.upper);
      // Ready (video + user): off hand near, not across, the paddle throat.
      const throat = v(0, -0.15, 0)
        .applyMatrix4(paddleM)
        .addScaledVector(right, offSign * 0.04)
        .addScaledVector(
          faceNormal
            .clone()
            .multiplyScalar(Math.sign(faceNormal.dot(forward)) || 1),
          -0.04,
        );
      // Guard: when the paddle is away on the hitting side the off hand stays in front of its own
      // half of the chest instead of chasing it across the body.
      const guard = spine[3]
        .clone()
        .addScaledVector(chestRight, offSign * 0.2)
        .addScaledVector(chestFront, 0.36)
        .addScaledVector(chestUp, -0.1);
      const throatSide = throat.clone().sub(spine[3]).dot(chestRight) * offSign;
      const nearPaddle = throat.lerp(
        guard,
        1 - T.MathUtils.smoothstep(throatSide, -0.12, 0.02),
      );
      let offGoal = hipsPos
        .clone()
        .addScaledVector(right, offSign * 0.3)
        .addScaledVector(forward, 0.25)
        .add(v(0, 0.22));
      const type = pose.active ? shot?.type : undefined;
      if (type === "serve") {
        // Holds the ball in front at the waist, releases it, then extends forward/out at shoulder height.
        const hold = hipsPos
          .clone()
          .addScaledVector(forward, 0.36)
          .addScaledVector(right, offSign * 0.04)
          .add(v(0, 0.05));
        const reach = shoulderOff
          .clone()
          .addScaledVector(forward, 0.4)
          .addScaledVector(right, offSign * 0.25)
          .add(v(0, -0.08));
        offGoal = hold.lerp(reach, T.MathUtils.smoothstep(clock, -0.2, 0.08));
      } else if (type === "dink") {
        // Out to the side and slightly back for balance, not on the paddle.
        offGoal = hipsPos
          .clone()
          .addScaledVector(right, offSign * 0.5)
          .addScaledVector(forward, -0.02)
          .add(v(0, 0.2));
      } else if (type === "volley" || type === "punch" || type === "block") {
        offGoal = nearPaddle.clone();
      } else if (type === "smash" && shot) {
        // Off arm points up at the ball through the load, then folds to the chest on the way down.
        const ball = v(shot.from.x - p.x, shot.from.y + 0.1, shot.from.z - p.z);
        const point = shoulderOff
          .clone()
          .addScaledVector(ball.sub(shoulderOff).normalize(), 0.55);
        const chest = spine[3]
          .clone()
          .addScaledVector(chestRight, offSign * 0.08)
          .addScaledVector(chestFront, 0.3)
          .addScaledVector(chestUp, -0.08);
        offGoal = point.lerp(chest, T.MathUtils.smoothstep(clock, -0.04, 0.26));
      } else if (pose.active && !pose.twoHanded)
        offGoal.addScaledVector(right, offSign * 0.12 * pose.loading);
      offGoal.lerp(nearPaddle, T.MathUtils.clamp(pose.readiness, 0, 1));
      let supportGrip = 0;
      if (pose.twoHanded) {
        const target = handTarget(off, off.support, paddleM);
        solveArm(off, target.pos, target.q, contactLock, false);
        supportGrip =
          1 -
          T.MathUtils.smoothstep(
            charPos(off.hand).distanceTo(target.pos),
            0.018,
            0.075,
          );
      } else {
        // wrist sits ~7 cm behind the palm goal along the reach direction
        const reachDir = offGoal.clone().sub(shoulderOff).normalize();
        solveArm(
          off,
          offGoal.clone().addScaledVector(reachDir, -0.07),
          undefined,
          1,
          true,
        );
      }
      fingersTo(off, supportGrip);
      this.gripWeights = handSign < 0 ? [1, supportGrip] : [supportGrip, 1];
      root.updateMatrixWorld(true);
      const top = this.bones.get("HeadTop_End") ?? head;
      return {
        head: charPos(top).add(v(0, top === head ? 0.15 : 0.04)),
        residual: mainTarget.pos.clone().sub(charPos(main.hand)),
      };
    };
    // Reach assist: when the hand can't get to the paddle target, move the upper body (pelvis)
    // toward it and solve again — feet stay planted.
    const assist = new T.Vector3();
    let solved = run(assist);
    if (pose.active && time !== undefined) {
      // Only around contact (the ball must be met); overheads mostly reach up, not forward.
      const near = 1 - T.MathUtils.smoothstep(Math.abs(time), 0.03, 0.12);
      assist.copy(solved.residual).multiplyScalar(0.9 * near);
      assist.y = T.MathUtils.clamp(assist.y, -0.15, 0.03);
      const flatMax = pose.paddle.y > 1.5 ? 0.05 : 0.2;
      const flat = Math.hypot(assist.x, assist.z);
      if (flat > flatMax) {
        assist.x *= flatMax / flat;
        assist.z *= flatMax / flat;
      }
      solved = run(assist);
    }
    this.mesh.skeleton.update();
    return solved.head;
  }
  /** Elbow interior angle and wrist flexion/deviation/twist (rad) of the current pose. */
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
