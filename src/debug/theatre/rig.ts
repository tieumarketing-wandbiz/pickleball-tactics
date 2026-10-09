// Self-contained rig driver for the Theatre.js demo (dev only). It turns ~10 high-level controls
// (pelvis, chest, head, paddle-hand IK + paddle orientation, off-hand IK, two feet) into bone
// rotations on the Mixamo skeleton of public/models/male-rigged.glb.
//
// Method: .agents/reference/rig-guide.md §2–§8. Everything is absolute and computed from rest data
// cached at load (aim frames, sole frames, finger hinges), so nothing drifts.
// - local = inverse(parentWorld) * world, solved top-down
// - analytic two-bone IK with explicit pole vectors (arms and legs)
// - chest rotation split over Spine / Spine1 / Spine2 (yaw 0.15/0.35/0.50)
// - 50 % of the hand twist moved onto the forearm
// - feet: sole frame, heel lift pivots about the ball, toes stay flat
// The loader's bind matrices are kept; skeleton.calculateInverses() is never called.
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createPaddle, PADDLE } from "./paddle";

// ---- control types (body frame: x = right, y = up, z = forward; metres and degrees) ------------
export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface FootControl {
  /** ankle ground position (m) */
  x: number;
  z: number;
  /** toe-out (deg, + = toes point away from the body midline) */
  yaw: number;
  /** heel lift about the ball of the foot (deg) */
  heel: number;
  /** whole-foot lift off the ground (m) */
  lift: number;
}
export interface PoseControls {
  /** pos = offset of the hips from rest; yaw + = turn right; pitch + = tip forward */
  pelvis: { pos: V3; yaw: number; pitch: number };
  /** relative to the pelvis; yaw + right, pitch + forward, roll + lean right */
  chest: { yaw: number; pitch: number; roll: number };
  /** world look direction; yaw + right, pitch + down */
  head: { yaw: number; pitch: number };
  /**
   * grip = grip centre on the handle (body frame, ground origin).
   * paddle.yaw = face aim (+ right), pitch = face open (+ sky), roll = head angle in the face plane
   * (0 = head to the right / 3 o'clock, 90 = straight up, 180 = left). elbow = pole swivel (+ out).
   */
  handR: {
    grip: V3;
    paddle: { yaw: number; pitch: number; roll: number };
    elbow: number;
  };
  handL: { wrist: V3; elbow: number };
  footL: FootControl;
  footR: FootControl;
}

// ---- tunables -------------------------------------------------------------------------------------
/** Cumulative share of the chest rotation reached at Spine, Spine1, Spine2 (rig-guide §3). */
const SPLIT = {
  yaw: [0.15, 0.5, 1],
  pitch: [0.4, 0.75, 1],
  roll: [0.3, 0.65, 1],
};
const NECK_SHARE = 0.4;
const HEAD_MAX = T.MathUtils.degToRad(75);
const FOREARM_TWIST = 0.5;
const MAX_TWIST = T.MathUtils.degToRad(100);
/** Palm centre → handle axis (handle radius + half palm thickness). */
const HANDLE_OFFSET = 0.03;
/**
 * Paddle grip ("hammer"/continental): handle along the knuckle line, forehand face rotated 45° from
 * the palm. Chosen by a wrist-strain search over the authored key poses (see README); an eastern
 * grip (tilt 40, bevel 0) needed ~90° of wrist extension for a square-faced forehand punch.
 */
const GRIP = { tilt: 0, bevel: -45 };
/** Finger curl (rad) for MCP, PIP, DIP; per-finger extra index → pinky (tighter toward pinky). */
const GRIP_CURL = [0.9, 1.3, 0.8];
const GRIP_EXTRA = [-0.18, 0, 0.08, 0.16];
const THUMB_GRIP = [0.6, 0.7, 0.6];
const RELAX_CURL = [0.25, 0.4, 0.25];
const THUMB_RELAX = [0.05, 0.15, 0.1];
const MAX_HEEL = T.MathUtils.degToRad(60);

const FINGERS = ["Index", "Middle", "Ring", "Pinky"] as const;
const MIXAMO_PREFIX = /^mixamorig\d*[:_]?/i;
const canonical = (o: T.Object3D) =>
  String(o.userData?.name ?? o.name).replace(MIXAMO_PREFIX, "");

// Character axes (the model faces −Z).
const UP = new T.Vector3(0, 1, 0);
const RIGHT = new T.Vector3(1, 0, 0);
const FWD = new T.Vector3(0, 0, -1);
const D2R = Math.PI / 180;

// ---- math helpers (module temporaries, no per-frame allocation) ----------------------------------
const _bx = new T.Vector3(),
  _by = new T.Vector3(),
  _bz = new T.Vector3(),
  _bm = new T.Matrix4();
/** Rotation whose +Y = y and whose +Z = z made perpendicular to y. */
function basisQuat(y: T.Vector3, z: T.Vector3, out: T.Quaternion) {
  _by.copy(y).normalize();
  _bz.copy(z).addScaledVector(_by, -z.dot(_by));
  if (_bz.lengthSq() < 1e-10) {
    _bz.set(Math.abs(_by.x) < 0.9 ? 1 : 0, Math.abs(_by.x) < 0.9 ? 0 : 1, 0);
    _bz.addScaledVector(_by, -_bz.dot(_by));
  }
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  return out.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz));
}
const _wp = new T.Vector3(),
  _wq = new T.Quaternion(),
  _ws = new T.Vector3();
/** World rotation → local; the parent's matrixWorld must be current (solve top-down). */
function setWorldQuat(bone: T.Object3D, qW: T.Quaternion) {
  bone.parent!.matrixWorld.decompose(_wp, _wq, _ws);
  bone.quaternion.copy(_wq.invert().multiply(qW));
  bone.updateWorldMatrix(false, false);
}
const worldPos = (o: T.Object3D, out: T.Vector3) =>
  out.setFromMatrixPosition(o.matrixWorld);
function worldQuat(o: T.Object3D, out: T.Quaternion) {
  o.matrixWorld.decompose(_wp, out, _ws);
  return out;
}
/** Twist part of `q` about unit `axis` (swing-twist decomposition). */
function twistAbout(q: T.Quaternion, axis: T.Vector3, out: T.Quaternion) {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  out.set(axis.x * d, axis.y * d, axis.z * d, q.w);
  if (out.lengthSq() < 1e-12) return out.identity();
  out.normalize();
  if (out.w < 0) out.set(-out.x, -out.y, -out.z, -out.w);
  return out;
}
const _aq = new T.Quaternion();
const axisQ = (axis: T.Vector3, deg: number, out = _aq) =>
  out.setFromAxisAngle(axis, deg * D2R);
/** Yaw (+ = turn toward the character's right) about UP. */
const yawQ = (deg: number, out: T.Quaternion) => out.setFromAxisAngle(UP, -deg * D2R);
/** Pitch (+ = tip forward) about RIGHT. */
const pitchQ = (deg: number, out: T.Quaternion) =>
  out.setFromAxisAngle(RIGHT, -deg * D2R);
/** Roll (+ = lean right) about FWD. */
const rollQ = (deg: number, out: T.Quaternion) => out.setFromAxisAngle(FWD, deg * D2R);
/** Body frame (x right, y up, z fwd) → character space. */
const bw = (v: V3, out: T.Vector3) => out.set(v.x, v.y, -v.z);

interface Aim {
  bone: T.Object3D;
  frameInv: T.Quaternion;
  length: number;
}
/** Aim calibrated in rest: the bone axis toward `child`, `refRest` (world) fixes the roll. */
function makeAim(bone: T.Object3D, child: T.Object3D, refRest: T.Vector3): Aim {
  const a = worldPos(bone, new T.Vector3()),
    b = worldPos(child, new T.Vector3());
  const dir = b.sub(a);
  const restW = worldQuat(bone, new T.Quaternion());
  const frameInv = basisQuat(dir, refRest, new T.Quaternion()).invert().multiply(restW);
  return { bone, frameInv, length: dir.length() };
}
const _amq = new T.Quaternion();
function aim(a: Aim, dir: T.Vector3, ref: T.Vector3) {
  setWorldQuat(a.bone, basisQuat(dir, ref, _amq).multiply(a.frameInv));
}
const _d = new T.Vector3();
/**
 * Analytic two-bone IK with an explicit pole (rig-guide §2.4). Writes the middle joint to `mid`,
 * the reach-clamped end to `end`, the unit bend direction to `bend`. Returns the reach shortfall.
 */
function twoBone(
  root: T.Vector3,
  target: T.Vector3,
  l1: number,
  l2: number,
  pole: T.Vector3,
  mid: T.Vector3,
  end: T.Vector3,
  bend: T.Vector3,
) {
  _d.copy(target).sub(root);
  const want = _d.length();
  if (want < 1e-6) _d.set(0, -1, 0);
  _d.normalize();
  const L = T.MathUtils.clamp(want, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9995);
  const cosA = T.MathUtils.clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
  bend.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (bend.lengthSq() < 1e-8) bend.copy(FWD).addScaledVector(_d, -FWD.dot(_d));
  bend.normalize();
  mid
    .copy(root)
    .addScaledVector(_d, l1 * cosA)
    .addScaledVector(bend, l1 * Math.sqrt(1 - cosA * cosA));
  end.copy(root).addScaledVector(_d, L);
  return Math.max(0, want - L);
}

// ---- rig ------------------------------------------------------------------------------------------
interface Finger {
  bone: T.Object3D;
  rest: T.Quaternion;
  hinge: T.Vector3; // bone-local
  curl: number; // rad
}
interface Arm {
  side: number; // +1 right, −1 left
  clavicle: T.Object3D;
  upper: Aim;
  fore: Aim;
  hand: T.Object3D;
  foreAxis: T.Vector3; // forearm-local axis toward the wrist
  handRest: T.Quaternion; // hand local rest
  fingers: Finger[];
  /** paddle frame in hand space (right hand only, see setGrip) */
  socket: T.Matrix4;
  palmFrame: { k: T.Vector3; along: T.Vector3; n: T.Vector3; centre: T.Vector3 };
}
interface Leg {
  side: number;
  hip: Aim;
  knee: Aim;
  foot: T.Object3D;
  toe: T.Object3D;
  soleOffset: T.Quaternion;
  toeOffset: T.Quaternion;
  ballLocal: T.Vector3; // toe joint in foot space
  ankleHeight: number;
  restToeOut: number; // deg
}
export interface RigMetrics {
  /** IK shortfall (m): target farther than the chain can reach */
  reachR: number;
  reachL: number;
  footL: number;
  footR: number;
  /** elbow distance outside the rib surface (m), from a torso half-width measured at load */
  elbowGapR: number;
  elbowGapL: number;
  /** auto heel lift added to avoid a straight-locked knee (deg) */
  autoHeelL: number;
  autoHeelR: number;
  /** paddle wrist: swing (flexion/deviation) and twist relative to the rest pose (deg) */
  wristSwingR: number;
  wristTwistR: number;
  /** world positions for QA */
  ballL: [number, number, number];
  ballR: [number, number, number];
  paddleFace: [number, number, number];
  /** paddle forehand-face normal and handle→head direction (world) */
  paddleNormal: [number, number, number];
  paddleHead: [number, number, number];
}

export async function loadPlayerRig(url: string) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return new PlayerRig(gltf.scene);
}

const _v1 = new T.Vector3(),
  _v2 = new T.Vector3(),
  _v3 = new T.Vector3(),
  _v4 = new T.Vector3(),
  _v5 = new T.Vector3(),
  _mid = new T.Vector3(),
  _hip = new T.Vector3(),
  _end = new T.Vector3(),
  _bend = new T.Vector3(),
  _q1 = new T.Quaternion(),
  _q2 = new T.Quaternion(),
  _q3 = new T.Quaternion(),
  _q4 = new T.Quaternion(),
  _qP = new T.Quaternion(),
  _qChest = new T.Quaternion(),
  _m1 = new T.Matrix4(),
  _m2 = new T.Matrix4(),
  _qI = new T.Quaternion();

export class PlayerRig {
  readonly root: T.Object3D;
  readonly mesh: T.SkinnedMesh;
  readonly bones = new Map<string, T.Object3D>();
  readonly paddle: T.Object3D;
  readonly metrics: RigMetrics = {
    reachR: 0,
    reachL: 0,
    footL: 0,
    footR: 0,
    elbowGapR: 0,
    elbowGapL: 0,
    autoHeelL: 0,
    autoHeelR: 0,
    wristSwingR: 0,
    wristTwistR: 0,
    ballL: [0, 0, 0],
    ballR: [0, 0, 0],
    paddleFace: [0, 0, 0],
    paddleNormal: [0, 0, 1],
    paddleHead: [0, 1, 0],
  };
  /** Debug targets (world) for the overlay. */
  readonly targets = {
    grip: new T.Vector3(),
    wristR: new T.Vector3(),
    wristL: new T.Vector3(),
    ankleL: new T.Vector3(),
    ankleR: new T.Vector3(),
  };
  private restW = new Map<T.Object3D, T.Quaternion>();
  private hipsRest = new T.Vector3();
  private torsoHalfWidth = 0.15;
  private spine: T.Object3D[];
  private arms: { L: Arm; R: Arm };
  private legs: { L: Leg; R: Leg };
  private socketInv = new T.Matrix4();
  private paddleW = new T.Matrix4();

  constructor(scene: T.Object3D) {
    this.root = scene;
    let mesh: T.SkinnedMesh | undefined;
    scene.traverse((o) => {
      if ((o as T.SkinnedMesh).isSkinnedMesh) mesh ??= o as T.SkinnedMesh;
      if (MIXAMO_PREFIX.test(String(o.userData?.name ?? o.name)))
        this.bones.set(canonical(o), o);
    });
    if (!mesh) throw new Error("male-rigged.glb: no skinned mesh");
    this.mesh = mesh;
    const need = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"];
    for (const s of ["Left", "Right"])
      for (const b of ["Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase"])
        need.push(s + b);
    const missing = need.filter((n) => !this.bones.has(n));
    if (missing.length) throw new Error(`missing bones: ${missing.join(", ")}`);

    scene.updateMatrixWorld(true);
    for (const b of this.bones.values()) this.restW.set(b, worldQuat(b, new T.Quaternion()));
    worldPos(this.b("Hips"), this.hipsRest);
    this.spine = ["Spine", "Spine1", "Spine2"].map((n) => this.b(n));
    this.measureTorso();
    this.styleMesh();
    this.legs = { L: this.calibrateLeg("Left"), R: this.calibrateLeg("Right") };
    this.arms = { L: this.calibrateArm("Left"), R: this.calibrateArm("Right") };
    this.paddle = createPaddle();
    this.b("RightHand").add(this.paddle);
    this.setGrip(GRIP);
  }

  /**
   * Paddle socket (rig-guide §6.3): the handle lies across the palm from the pinky heel toward the
   * index base, tilted `tilt`° from the knuckle line toward the fingers; `bevel`° rotates the
   * forehand face about the handle away from the palm normal (0 = eastern "palm on the face",
   * −45 = continental).
   */
  setGrip(g: { tilt: number; bevel: number }) {
    const f = this.arms.R.palmFrame;
    const head = new T.Vector3()
      .addScaledVector(f.k, -Math.cos(g.tilt * D2R))
      .addScaledVector(f.along, Math.sin(g.tilt * D2R));
    head.addScaledVector(f.n, -head.dot(f.n)).normalize();
    const face = f.n.clone().applyAxisAngle(head, g.bevel * D2R);
    const x = head.clone().cross(face).normalize();
    this.arms.R.socket.makeBasis(x, head, face).setPosition(f.centre);
    this.arms.R.socket.decompose(this.paddle.position, this.paddle.quaternion, this.paddle.scale);
    this.socketInv.copy(this.arms.R.socket).invert();
  }

  private b(name: string) {
    return this.bones.get(name)!;
  }
  private rest(name: string) {
    return worldPos(this.b(name), new T.Vector3());
  }

  /** Half-width of the rib cage from the bind-pose mesh (for the elbow-gap readout). */
  private measureTorso() {
    const m = this.mesh,
      p = new T.Vector3();
    m.skeleton.update();
    const n = m.geometry.getAttribute("position").count;
    let w = 0;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, p);
      p.applyMatrix4(m.matrixWorld);
      if (p.y > 1.05 && p.y < 1.3 && Math.abs(p.x) < 0.24) w = Math.max(w, Math.abs(p.x));
    }
    if (w > 0.05) this.torsoHalfWidth = w;
  }

  /** Simple vertex-colour outfit so the silhouette reads (shirt / shorts / skin / shoes). */
  private styleMesh() {
    const m = this.mesh;
    const g = m.geometry.clone();
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const shirt = new T.Color(0xf08a4b),
      shorts = new T.Color(0x1f3442),
      skin = new T.Color(0xd2a58a),
      shoe = new T.Color(0xf2f2ee),
      sock = new T.Color(0xe8e8e8);
    // Colour by the dominant skin joint (robust to the A-pose: hands hang below the waist).
    const p = new T.Vector3();
    const si = g.getAttribute("skinIndex"),
      sw = g.getAttribute("skinWeight");
    const joints = m.skeleton.bones.map((b) => canonical(b).replace(/^(Left|Right)/, ""));
    const shoulderY = this.rest("RightArm").y;
    for (let i = 0; i < pos.count; i++) {
      m.getVertexPosition(i, p);
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
      const j = joints[si.getComponent(i, best)] ?? "";
      const c = /^(Foot|ToeBase)/.test(j)
        ? p.y < 0.11
          ? shoe
          : sock
        : j === "Leg"
          ? p.y < 0.2
            ? sock
            : skin
        : j === "UpLeg" || j === "Hips"
          ? p.y > 0.6
            ? shorts
            : skin
        : j === "Arm"
          ? p.y > shoulderY - 0.12
            ? shirt
            : skin
        : /^(Spine|Shoulder)/.test(j)
          ? p.y < 1.0
            ? shorts
            : shirt
        : skin; // forearm, hand, fingers, neck, head
      c.toArray(col, i * 3);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    m.geometry = g;
    m.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }

  private calibrateLeg(s: "Left" | "Right"): Leg {
    const up = this.b(`${s}UpLeg`),
      leg = this.b(`${s}Leg`),
      foot = this.b(`${s}Foot`),
      toe = this.b(`${s}ToeBase`);
    const H = this.rest(`${s}UpLeg`),
      K = this.rest(`${s}Leg`),
      A = this.rest(`${s}Foot`),
      B = this.rest(`${s}ToeBase`);
    // Rest bend direction of the knee (forward in this rig).
    const axis = A.clone().sub(H).normalize();
    const pole = K.clone().sub(H);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.length() < 0.003) pole.copy(FWD);
    pole.normalize();
    const fwdRest = B.clone().sub(A).setY(0).normalize();
    const sole = basisQuat(UP, fwdRest, new T.Quaternion()).invert();
    const side = s === "Right" ? 1 : -1;
    // Toe-out of the rest pose, + = away from the midline.
    const restToeOut = Math.atan2(side * fwdRest.x, -fwdRest.z) / D2R;
    return {
      side,
      hip: makeAim(up, leg, pole),
      knee: makeAim(leg, foot, pole),
      foot,
      toe,
      soleOffset: sole.clone().multiply(this.restW.get(foot)!),
      toeOffset: sole.clone().multiply(this.restW.get(toe)!),
      ballLocal: toe.position.clone(),
      ankleHeight: A.y,
      restToeOut,
    };
  }

  private calibrateArm(s: "Left" | "Right"): Arm {
    const side = s === "Right" ? 1 : -1;
    const clavicle = this.b(`${s}Shoulder`),
      upper = this.b(`${s}Arm`),
      fore = this.b(`${s}ForeArm`),
      hand = this.b(`${s}Hand`);
    const S = this.rest(`${s}Arm`),
      E = this.rest(`${s}ForeArm`),
      W = this.rest(`${s}Hand`);
    const axis = W.clone().sub(S).normalize();
    const pole = E.clone().sub(S);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.length() < 0.003) pole.set(0, 0, 1);
    pole.normalize();
    // Palm frame (rig-guide §6.1): k = index → pinky knuckle line, along = wrist → knuckles,
    // n = palm normal (out of the palm).
    const I = this.rest(`${s}HandIndex1`),
      P = this.rest(`${s}HandPinky1`),
      M = this.rest(`${s}HandMiddle1`);
    const k = P.clone().sub(I).normalize();
    const along = I.clone().add(P).multiplyScalar(0.5).sub(W).normalize();
    const n =
      side > 0
        ? I.clone().sub(W).cross(P.clone().sub(W))
        : P.clone().sub(W).cross(I.clone().sub(W));
    n.addScaledVector(along, -n.dot(along)).normalize();
    const handW = this.restW.get(hand)!;
    const handInv = new T.Matrix4().compose(W, handW, new T.Vector3(1, 1, 1)).invert();
    // Palm frame in hand space, for the paddle socket (see setGrip).
    const handQInv = handW.clone().invert();
    const palmFrame = {
      k: k.clone().applyQuaternion(handQInv),
      along: along.clone().applyQuaternion(handQInv),
      n: n.clone().applyQuaternion(handQInv),
      centre: W.clone().lerp(M, 0.55).addScaledVector(n, HANDLE_OFFSET).applyMatrix4(handInv),
    };
    // Forearm twist axis (forearm local).
    const foreAxis = hand.position.clone().normalize();
    // Fingers: hinge from rest geometry; + curls each tip toward the palm normal.
    const fingers: Finger[] = [];
    const grip = side > 0;
    const addFinger = (name: string, child: string, ref: T.Vector3, curl: number) => {
      const bone = this.bones.get(name),
        tip = this.bones.get(child);
      if (!bone) return;
      const a = this.rest(name);
      const dir = (tip ? worldPos(tip, new T.Vector3()) : a.clone().add(along)).sub(a).normalize();
      const hinge = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
      if (dir.clone().applyAxisAngle(hinge, 0.2).sub(dir).dot(n) < 0) hinge.negate();
      hinge.applyQuaternion(this.restW.get(bone)!.clone().invert());
      fingers.push({ bone, rest: bone.quaternion.clone(), hinge, curl });
    };
    FINGERS.forEach((f, i) => {
      for (let j = 1; j <= 3; j++)
        addFinger(
          `${s}Hand${f}${j}`,
          `${s}Hand${f}${j + 1}`,
          k,
          grip ? GRIP_CURL[j - 1] + GRIP_EXTRA[i] : RELAX_CURL[j - 1] + 0.05 * i,
        );
    });
    for (let j = 1; j <= 3; j++) {
      const a = this.rest(`${s}HandThumb${j}`);
      const tipBone = this.bones.get(`${s}HandThumb${j + 1}`);
      const dir = (tipBone ? worldPos(tipBone, new T.Vector3()) : a.clone().add(along)).sub(a).normalize();
      addFinger(
        `${s}HandThumb${j}`,
        `${s}HandThumb${j + 1}`,
        dir.clone().cross(n),
        grip ? THUMB_GRIP[j - 1] : THUMB_RELAX[j - 1],
      );
    }
    for (const f of fingers) f.bone.quaternion.copy(f.rest).multiply(axisQ(f.hinge, f.curl / D2R));
    return {
      side,
      clavicle,
      upper: makeAim(upper, fore, pole),
      fore: makeAim(fore, hand, pole),
      hand,
      foreAxis,
      handRest: hand.quaternion.clone(),
      fingers,
      socket: new T.Matrix4(),
      palmFrame,
    };
  }

  /** Solve the whole body from the controls. */
  solve(c: PoseControls) {
    const mt = this.metrics;
    this.root.updateMatrixWorld();
    // 1. Pelvis.
    const hips = this.b("Hips");
    yawQ(c.pelvis.yaw, _qP).multiply(pitchQ(c.pelvis.pitch, _q1));
    bw(c.pelvis.pos, _v1).add(this.hipsRest);
    _m1.copy(hips.parent!.matrixWorld).invert();
    hips.position.copy(_v1).applyMatrix4(_m1);
    setWorldQuat(hips, _q2.copy(_qP).multiply(this.restW.get(hips)!));
    // 2. Legs.
    this.solveLeg(this.legs.L, c.footL);
    this.solveLeg(this.legs.R, c.footR);
    // 3. Spine split.
    for (let i = 0; i < 3; i++) {
      const bone = this.spine[i];
      _q1
        .copy(_qP)
        .multiply(yawQ(c.chest.yaw * SPLIT.yaw[i], _q2))
        .multiply(pitchQ(c.chest.pitch * SPLIT.pitch[i], _q2))
        .multiply(rollQ(c.chest.roll * SPLIT.roll[i], _q2));
      if (i === 2) _qChest.copy(_q1);
      setWorldQuat(bone, _q1.multiply(this.restW.get(bone)!));
    }
    // 4. Neck + head: absolute look, capped relative to the chest.
    yawQ(c.head.yaw, _q3).multiply(pitchQ(c.head.pitch, _q1)); // target delta
    _q4.copy(_qChest).invert().multiply(_q3); // relative to the chest
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_q4.w)));
    if (ang > HEAD_MAX) _q4.slerp(_qI, 1 - HEAD_MAX / ang);
    const neck = this.b("Neck"),
      head = this.b("Head");
    _q1.copy(_qI).slerp(_q4, NECK_SHARE);
    setWorldQuat(neck, _q2.copy(_qChest).multiply(_q1).multiply(this.restW.get(neck)!));
    setWorldQuat(head, _q2.copy(_qChest).multiply(_q4).multiply(this.restW.get(head)!));
    // 5. Arms.
    this.solvePaddleArm(c);
    this.solveOffArm(c);
    // 6. Elbow-gap QA (distance from the elbow to the Hips→Spine2 axis minus rib half-width).
    const a = worldPos(this.b("Spine"), _v4),
      bpt = worldPos(this.b("Spine2"), _v5);
    mt.elbowGapR = segDist(worldPos(this.arms.R.fore.bone, _v1), a, bpt) - this.torsoHalfWidth;
    mt.elbowGapL = segDist(worldPos(this.arms.L.fore.bone, _v1), a, bpt) - this.torsoHalfWidth;
    worldPos(this.legs.L.toe, _v1).toArray(mt.ballL);
    worldPos(this.legs.R.toe, _v1).toArray(mt.ballR);
    _v1.set(0, PADDLE.faceCentre, 0).applyMatrix4(this.paddleW).toArray(mt.paddleFace);
    _v1.setFromMatrixColumn(this.paddleW, 2).toArray(mt.paddleNormal);
    _v1.setFromMatrixColumn(this.paddleW, 1).toArray(mt.paddleHead);
  }

  private solveLeg(leg: Leg, f: FootControl) {
    const s = leg.side;
    leg.hip.bone.updateWorldMatrix(false, false);
    const hip = worldPos(leg.hip.bone, _hip);
    // Flat foot frame from the controls.
    const fwd = _v2.copy(FWD).applyQuaternion(yawQ(s * (f.yaw), _q1));
    const qFlat = basisQuat(UP, fwd, _q2).multiply(leg.soleOffset);
    const ankleFlat = _v3.set(f.x, leg.ankleHeight + f.lift, -f.z);
    const ball = _v4.copy(leg.ballLocal).applyQuaternion(qFlat).add(ankleFlat);
    const lat = _v5.crossVectors(UP, fwd).normalize();
    const maxL = (leg.hip.length + leg.knee.length) * 0.993;
    // Heel lift pivots about the ball (rig-guide §7); add more if the knee would lock straight.
    let heel = Math.max(0, f.heel * D2R);
    const ankleAt = (phi: number, out: T.Vector3, q: T.Quaternion) => {
      q.setFromAxisAngle(lat, phi).multiply(qFlat);
      return out.copy(leg.ballLocal).applyQuaternion(q).negate().add(ball);
    };
    const ankle = ankleAt(heel, this.targets[s > 0 ? "ankleR" : "ankleL"], _q3);
    let auto = 0;
    if (ankle.distanceTo(hip) > maxL && heel < MAX_HEEL) {
      let lo = heel,
        hi = MAX_HEEL;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (ankleAt(mid, ankle, _q3).distanceTo(hip) > maxL) lo = mid;
        else hi = mid;
      }
      auto = hi - heel;
      heel = hi;
      ankleAt(heel, ankle, _q3);
    }
    const qFoot = _q3;
    // Knee pole: along the foot plus a little outward.
    const pole = _bend.copy(fwd).addScaledVector(RIGHT, s * 0.18).normalize();
    const short = twoBone(hip, ankle, leg.hip.length, leg.knee.length, pole, _mid, _end, _bend);
    aim(leg.hip, _v1.copy(_mid).sub(hip), _bend);
    aim(leg.knee, _v1.copy(_end).sub(_mid), _bend);
    setWorldQuat(leg.foot, qFoot);
    setWorldQuat(leg.toe, basisQuat(UP, fwd, _q1).multiply(leg.toeOffset));
    if (s > 0) {
      this.metrics.footR = short;
      this.metrics.autoHeelR = auto / D2R;
    } else {
      this.metrics.footL = short;
      this.metrics.autoHeelL = auto / D2R;
    }
  }

  /** Elbow pole: down + out + slightly back in the chest frame, swivelled about shoulder→wrist. */
  private armPole(arm: Arm, shoulder: T.Vector3, wrist: T.Vector3, swivelDeg: number, out: T.Vector3) {
    out.set(arm.side * 0.45, -1, 0.35).normalize().applyQuaternion(_qChest);
    const axis = _v5.copy(wrist).sub(shoulder).normalize();
    return out.applyAxisAngle(axis, -arm.side * swivelDeg * D2R);
  }

  private solvePaddleArm(c: PoseControls) {
    const arm = this.arms.R;
    // Paddle world frame: yaw · pitch(open) · roll(head angle) · neutral (face → FWD, head → RIGHT).
    const p = c.handR.paddle;
    _q1
      .setFromAxisAngle(UP, -p.yaw * D2R)
      .multiply(_q2.setFromAxisAngle(RIGHT, p.pitch * D2R))
      .multiply(_q3.setFromAxisAngle(FWD, -p.roll * D2R))
      .multiply(PADDLE_NEUTRAL);
    bw(c.handR.grip, this.targets.grip);
    this.paddleW.compose(this.targets.grip, _q1, _ws.set(1, 1, 1));
    // Hand world = paddle · socket⁻¹.
    _m2.multiplyMatrices(this.paddleW, this.socketInv);
    const wrist = this.targets.wristR.setFromMatrixPosition(_m2);
    const qHand = _q4.setFromRotationMatrix(_m2);
    this.metrics.reachR = this.solveArm(arm, wrist, c.handR.elbow);
    // Forearm takes half of the hand's twist (rig-guide §4.2), then the hand gets the exact rotation.
    const qFore = worldQuat(arm.fore.bone, _q1);
    _q2.copy(qFore).invert().multiply(qHand).multiply(_q3.copy(arm.handRest).invert());
    twistAbout(_q2, arm.foreAxis, _q3);
    let tw = 2 * Math.acos(Math.min(1, _q3.w));
    // QA: wrist swing (flexion/deviation) = delta without its twist; twist relative to rest.
    _q1.copy(_q3).invert().premultiply(_q2);
    this.metrics.wristSwingR = (2 * Math.acos(Math.min(1, Math.abs(_q1.w)))) / D2R;
    this.metrics.wristTwistR = tw / D2R;
    if (tw > MAX_TWIST) _q3.slerp(_qI, 1 - MAX_TWIST / tw), (tw = MAX_TWIST);
    arm.fore.bone.quaternion.multiply(_q2.copy(_qI).slerp(_q3, FOREARM_TWIST));
    arm.fore.bone.updateWorldMatrix(false, false);
    setWorldQuat(arm.hand, qHand);
  }

  private solveOffArm(c: PoseControls) {
    const arm = this.arms.L;
    const wrist = bw(c.handL.wrist, this.targets.wristL);
    this.metrics.reachL = this.solveArm(arm, wrist, c.handL.elbow);
    arm.hand.quaternion.copy(arm.handRest);
    arm.hand.updateWorldMatrix(false, false);
  }

  private solveArm(arm: Arm, wrist: T.Vector3, swivel: number) {
    arm.clavicle.updateWorldMatrix(false, false);
    arm.upper.bone.updateWorldMatrix(false, false);
    const shoulder = worldPos(arm.upper.bone, _v1).clone();
    const pole = this.armPole(arm, shoulder, wrist, swivel, _v2);
    const short = twoBone(shoulder, wrist, arm.upper.length, arm.fore.length, pole, _mid, _end, _bend);
    aim(arm.upper, _v3.copy(_mid).sub(shoulder), _bend);
    aim(arm.fore, _v3.copy(_end).sub(_mid), _bend);
    return short;
  }

  /** Rest toe-out of each foot (deg), for sensible defaults. */
  restToeOut() {
    return { L: this.legs.L.restToeOut, R: this.legs.R.restToeOut };
  }
}

/** Neutral paddle orientation: face normal (+Z) → FWD, handle (+Y) → RIGHT, +X → UP. */
const PADDLE_NEUTRAL = new T.Quaternion().setFromRotationMatrix(
  new T.Matrix4().makeBasis(UP, RIGHT, FWD),
);

const _sd = new T.Vector3();
function segDist(p: T.Vector3, a: T.Vector3, b: T.Vector3) {
  _sd.copy(b).sub(a);
  const t = T.MathUtils.clamp(_v2.copy(p).sub(a).dot(_sd) / _sd.lengthSq(), 0, 1);
  return _v2.copy(a).addScaledVector(_sd, t).distanceTo(p);
}
