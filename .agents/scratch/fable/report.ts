// Per-shot numerical report on the actual skeleton (A1/right). Run: npx vite-node .agents/scratch/fable/report.ts [spline|solve] [shot...]
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Humanoid } from "../../../src/scene/humanoid";
import { BodyVolume, armGap, makeArmSamples } from "../../../src/scene/body-volume";
import { SHOT_TYPES, DEFAULT_HEIGHT, DEFAULT_APEX, type ShotType } from "../../../src/core/constants";
import type { Player, Shot } from "../../../src/core/scenario";
import { playerPose } from "../../../src/core/player-pose";
import { STROKE_MOTION, strokePreparation, strokeLoadTime } from "../../../src/core/stroke-motion";
import { auditMotion, auditBoundaries } from "../../../src/debug/motion-audit";

const mode = process.argv[2] ?? "solve";
const only = process.argv.slice(3);
await MeshoptDecoder.ready;
const bytes = fs.readFileSync("public/models/male-rigged.glb");
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
gltf.scene.updateMatrixWorld(true);
const actor = new Humanoid({ scene: gltf.scene }, "A");
actor.root.updateMatrixWorld(true);
const paddle = new T.Group();
const body = new BodyVolume(), samples = makeArmSamples();
const rest = new Map<string, T.Quaternion>(), restLen = new Map<string, number>();
const position = (n: string) => actor.bones.get(n)!.getWorldPosition(new T.Vector3());
const rotation = (n: string) => actor.bones.get(n)!.getWorldQuaternion(new T.Quaternion());
for (const [name, b] of actor.bones) { rest.set(name, rotation(name)); if (b.parent && actor.bones.has((b.parent as any).userData?.name?.replace(/^mixamorig\d*[:_]?/i, "") ?? "")) restLen.set(name, b.position.length()); }
const restHipsNeck = position("Hips").distanceTo(position("Neck"));
const a1: Player = { id: "A1", x: 0, z: 3.6, hand: "right" };
const sides = ["Left", "Right"] as const;
function shotFor(type: ShotType): Shot {
  return { hitter: "A1", type, from: { x: 0.4, y: DEFAULT_HEIGHT[type], z: 3.2 }, to: { x: 0, z: -4 }, apex: DEFAULT_APEX[type], volley: ["volley", "block", "punch", "smash", "erne"].includes(type) };
}
function pose(shot: Shot, t: number) {
  actor.root.position.set(0, 0, 0);
  if (mode === "solve") (actor as any).solveDrawing(a1, shot, t, paddle, undefined, undefined);
  else actor.pose(a1, shot, t, paddle);
}
const deg = 180 / Math.PI;
for (const type of SHOT_TYPES) {
  if (only.length && !only.includes(type)) continue;
  const shot = shotFor(type), profile = STROKE_MOTION[type];
  const prep = strokePreparation(type), load = strokeLoadTime(type);
  const names = ["Hips", ...sides.flatMap(s => [s + "ForeArm", s + "Hand", s + "Leg", s + "Foot"])];
  const sample = (t: number) => { pose(shot, t); return Object.fromEntries(names.map(n => [n, position(n)]).concat([["paddle", paddle.position.clone()]])); };
  const t0 = performance.now();
  const report = auditMotion(sample, -prep - 0.1, profile.recover + 0.1);
  const ms = performance.now() - t0;
  const followEnd = profile.followTime + (profile.hold ?? 0);
  const boundaries = [-prep, load, load * .4, load * .55, 0, profile.followTime, followEnd, followEnd + (profile.recover - followEnd) * .72, profile.recover];
  const disc = auditBoundaries(sample, boundaries).filter(b => b.positionJump >= .001 || b.velocityJump >= .05 + .02 * b.speed);
  const acc = Object.entries(report.acceleration).map(([n, a]) => `${n.replace("Right", "R").replace("Left", "L")}=${a.value.toFixed(0)}@${a.time.toFixed(2)}`).join(" ");
  const spikes = Object.entries(report.spikes).filter(([, a]) => a.value > 50).map(([n, a]) => `${n}=${a.value.toFixed(0)}@${a.time.toFixed(2)}`).join(" ");
  // pose sweep
  let minGap = [Infinity, Infinity], gapAt = [0, 0], lenErr = 0, maxHead = 0, hipsNeck = 0, elbow = [Infinity, -Infinity], flex = 0, dev = 0, knee = [Infinity, -Infinity], drift = 0, pelvisDrag = 0, lenErrAt = "";
  for (let t = -prep; t <= profile.recover + 0.05; t += 0.02) {
    pose(shot, t);
    body.update(s => position(s.bone), s => rotation(s.bone).multiply(rest.get(s.bone)!.clone().invert()), [[position("LeftUpLeg"), position("LeftLeg")], [position("RightUpLeg"), position("RightLeg")]]);
    const target = playerPose(a1, shot, t);
    sides.forEach((s, i) => {
      const g = armGap(body, position(s + "Arm"), position(s + "ForeArm"), position(s + "Hand"), samples);
      if (g < minGap[i]) { minGap[i] = g; gapAt[i] = t; }
      const j = actor.jointAngles(s); elbow = [Math.min(elbow[0], j.elbow * deg), Math.max(elbow[1], j.elbow * deg)];
      flex = Math.max(flex, Math.abs(j.flex) * deg); dev = Math.max(dev, Math.abs(j.deviation) * deg);
      const hip = position(s + "UpLeg"), kn = position(s + "Leg"), foot = position(s + "Foot");
      const k = 180 - hip.clone().sub(kn).angleTo(foot.clone().sub(kn)) * deg; knee = [Math.min(knee[0], k), Math.max(knee[1], k)];
      const f = target.feet[s === "Left" ? "L" : "R"]; drift = Math.max(drift, Math.hypot(foot.x - f.x, foot.z - f.z));
    });
    for (const [name, b] of actor.bones) { const l = restLen.get(name); if (l === undefined) continue; const e = Math.abs(b.position.length() - l); if (e > lenErr) { lenErr = e; lenErrAt = `${name}@${t.toFixed(2)}`; } }
    maxHead = Math.max(maxHead, (actor.bones.get("HeadTop_End") ?? actor.bones.get("Head"))!.getWorldPosition(new T.Vector3()).y - target.hop);
    hipsNeck = Math.max(hipsNeck, position("Hips").distanceTo(position("Neck")));
    const hp = position("Hips"); pelvisDrag = Math.max(pelvisDrag, Math.hypot(hp.x - target.hip.x, hp.z - target.hip.z));
  }
  pose(shot, 0);
  const contactErr = paddle.position.distanceTo(new T.Vector3(shot.from.x - a1.x, shot.from.y, shot.from.z - a1.z));
  console.log(`${type.padEnd(8)} peak ${report.peakSpeed.toFixed(2)}m/s@${report.peakTime.toFixed(3)} contactErr ${contactErr.toExponential(1)} | acc ${acc}`);
  console.log(`         spikes>50: ${spikes || "-"} | disc: ${disc.map(d => `${d.name}@${d.time.toFixed(3)} dp=${d.positionJump.toExponential(1)} dv=${d.velocityJump.toFixed(3)}`).join(" ") || "-"}`);
  console.log(`         gapL ${minGap[0].toFixed(3)}@${gapAt[0].toFixed(2)} gapR ${minGap[1].toFixed(3)}@${gapAt[1].toFixed(2)} | len ${(lenErr * 1000).toFixed(2)}mm ${lenErrAt} headTop ${maxHead.toFixed(3)} hipsNeck ${hipsNeck.toFixed(3)}/${restHipsNeck.toFixed(3)} | elbow ${elbow[0].toFixed(0)}-${elbow[1].toFixed(0)} flex ${flex.toFixed(0)} dev ${dev.toFixed(0)} knee ${knee[0].toFixed(0)}-${knee[1].toFixed(0)} drift ${(drift * 1000).toFixed(0)}mm pelvisDrag ${(pelvisDrag * 1000).toFixed(0)}mm | ${ms.toFixed(0)}ms`);
}
