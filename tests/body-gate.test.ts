import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Humanoid, type HumanoidRig } from "../src/scene/humanoid";
import { BodyVolume, armGap, makeArmSamples } from "../src/scene/body-volume";
import { SHOT_TYPES, DEFAULT_HEIGHT, DEFAULT_APEX, type ShotType } from "../src/core/constants";
import type { Player, Shot } from "../src/core/scenario";
import { initialScenario } from "../src/core/scenario";
import { playerPose } from "../src/core/player-pose";
import { STROKE_MOTION, strokePreparation, strokeLoadTime } from "../src/core/stroke-motion";
import { buildClips, sampleClipPlayers } from "../src/core/playback";
import { auditMotion, auditBoundaries } from "../src/debug/motion-audit";

// Numerical acceptance gate, not a screenshot approval. Uses actual retargeted joints and
// measured limb volumes in ONE coordinate space. The visual review remains A1/right only.
let template: HumanoidRig;
let actor: Humanoid;
const paddle = new T.Group();
const body = new BodyVolume(), samples = makeArmSamples();
const rest = new Map<string, T.Quaternion>();
const sides = ["Left", "Right"] as const;
const position = (name: string) => actor.bones.get(name)!.getWorldPosition(new T.Vector3());
const rotation = (name: string) => actor.bones.get(name)!.getWorldQuaternion(new T.Quaternion());
const a1: Player = { id: "A1", x: 0, z: 3.6, hand: "right" };
function shotFor(type: ShotType, p = a1, backhand = false): Shot {
  const team = p.id.startsWith("A") ? 1 : -1, hand = p.hand === "left" ? -1 : 1;
  return { hitter: p.id, type, from: { x: p.x + 0.4 * hand * team * (backhand ? -1 : 1),
    y: DEFAULT_HEIGHT[type], z: p.z - 0.4 * team }, to: { x: 0, z: -4 * team },
    apex: DEFAULT_APEX[type], volley: ["volley", "block", "punch", "smash", "erne"].includes(type) };
}
function pose(p: Player, shot?: Shot, time?: number) {
  // All measurements are marker-space; root translation is tested separately in the rally.
  actor.root.position.set(0, 0, 0);
  actor.pose(p, shot, time, paddle);
}
function refreshBody() {
  body.update(s => position(s.bone), s => rotation(s.bone).multiply(rest.get(s.bone)!.clone().invert()),
    [[position("LeftUpLeg"), position("LeftLeg")], [position("RightUpLeg"), position("RightLeg")]]);
}
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const bytes = fs.readFileSync("public/models/male-rigged.glb");
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  template = { scene: gltf.scene };
  actor = new Humanoid(template, "A");
  actor.root.updateMatrixWorld(true);
  for (const [name] of actor.bones) rest.set(name, rotation(name));
}, 20_000);

describe("STEP 0 body gate — all 15 shots, A1/right", () => {
  for (const type of SHOT_TYPES) {
    it(`${type}: 240 Hz paddle, pelvis, elbows, wrists, knees, feet; contact and speed peak`, () => {
      const shot = shotFor(type), profile = STROKE_MOTION[type];
      const sample=(t:number)=>{
        pose(a1,shot,t);
        return Object.fromEntries(["Hips",...sides.flatMap(s=>[s+"ForeArm",s+"Hand",s+"Leg",s+"Foot"])]
          .map(n=>[n,position(n)]).concat([["paddle",paddle.position.clone()]]));
      };
      const report=auditMotion(sample,-strokePreparation(type)-.1,profile.recover+.1);
      const caps=(name:string)=>name==="paddle" ? 1500 : name==="Hips" || name.endsWith("Foot") ? 60 : name.endsWith("Hand") ? 600 : undefined;
      const failures=Object.entries(report.acceleration).filter(([name,a])=>caps(name)!==undefined && a.value>caps(name)!);
      expect(failures,`${type} physiological acceleration (m/s²): ${JSON.stringify(failures)}`).toEqual([]);
      const spikes=Object.entries(report.spikes).filter(([name,a])=>a.value>(caps(name) ?? 600)*.4);
      expect(spikes,`${type} 9-sample median residual (m/s²): ${JSON.stringify(spikes)}`).toEqual([]);
      const prep=strokePreparation(type),load=strokeLoadTime(type),followEnd=profile.followTime+(profile.hold ?? 0);
      const boundaries=[-prep,load,load*.4,load*.55,0,profile.followTime,followEnd,
        followEnd+(profile.recover-followEnd)*.72,profile.recover];
      if(type==="smash")boundaries.push(-.28,.28);if(type==="erne")boundaries.push(-.22,.26);
      const discontinuities=auditBoundaries(sample,boundaries).filter(b=>b.positionJump>=.001 || b.velocityJump>=.05+.02*b.speed);
      expect(discontinuities,`${type} C0/C1 limits: ${JSON.stringify(discontinuities)}`).toEqual([]);
      expect(Math.abs(report.peakTime)).toBeLessThanOrEqual(0.04);
      pose(a1, shot, 0);
      expect(paddle.position.distanceTo(new T.Vector3(shot.from.x-a1.x, shot.from.y, shot.from.z-a1.z))).toBeLessThan(1e-8);
    });
    it(`${type}: volume clearance, midline, joint limits, planted/flat feet and knees`, () => {
      const shot = shotFor(type), profile = STROKE_MOTION[type];
      const errors: string[] = [];
      for (let t = -strokePreparation(type); t <= profile.recover + 0.05; t += 0.1) {
        pose(a1, shot, t); refreshBody();
        const target = playerPose(a1, shot, t), right = new T.Vector3(target.right.x,0,target.right.z);
        const front = new T.Vector3(target.forward.x,0,target.forward.z);
        const chestRight = new T.Vector3(1,0,0).applyQuaternion(rotation("Spine2").multiply(rest.get("Spine2")!.clone().invert()));
        for (const s of sides) {
          const sign = s === "Left" ? -1 : 1;
          const shoulder = position(s+"Arm"), elbow = position(s+"ForeArm"), wrist = position(s+"Hand");
          const gap = armGap(body, shoulder, elbow, wrist, samples);
          if (gap < 0.029) errors.push(`${t.toFixed(2)} ${s} arm gap ${gap.toFixed(3)}m`);
          // Elbows cannot fold across the sternum on a forehand. Backhands have a separate mirrored sweep.
          if (elbow.clone().sub(position("Spine2")).dot(chestRight)*sign < -0.005)
            errors.push(`${t.toFixed(2)} ${s} elbow crosses midline`);
          const angles = actor.jointAngles(s), deg = 180/Math.PI;
          if (angles.elbow*deg < 24 || angles.elbow*deg > 161 || Math.abs(angles.flex)*deg > 61 || Math.abs(angles.deviation)*deg > 31)
            errors.push(`${t.toFixed(2)} ${s} arm limits ${JSON.stringify(angles)}`);
          const hip = position(s+"UpLeg"), knee = position(s+"Leg"), foot = position(s+"Foot");
          const flex = 180 - hip.clone().sub(knee).angleTo(foot.clone().sub(knee))*deg;
          if (flex < -1e-6 || flex > 140.01) errors.push(`${t.toFixed(2)} ${s} knee flex ${flex}`);
          const bend = knee.clone().sub(hip.clone().lerp(foot, 0.5)); bend.y = 0;
          if (bend.lengthSq() > 1e-5 && bend.normalize().dot(front) < Math.cos(Math.PI/5))
            errors.push(`${t.toFixed(2)} ${s} knee doesn't follow toe`);
          const delta = rotation(s+"Foot").multiply(rest.get(s+"Foot")!.clone().invert());
          if (new T.Vector3(0,1,0).applyQuaternion(delta).y < 0.9999) errors.push(`${t.toFixed(2)} ${s} shoe not flat`);
          const f = target.feet[s === "Left" ? "L" : "R"];
          if (Math.hypot(foot.x-f.x, foot.z-f.z) > 0.01) errors.push(`${t.toFixed(2)} ${s} foot drift`);
        }
        if (position("RightFoot").sub(position("LeftFoot")).dot(right) <= 0 ||
            position("RightLeg").sub(position("LeftLeg")).dot(right) <= 0) errors.push(`${t.toFixed(2)} crossed legs`);
      }
      expect(errors, errors.slice(0, 16).join("\n")).toEqual([]);
    });
  }
});

it("cheap team/hand mirroring, backhands and idle preserve contact and limits", () => {
  const errors: string[] = [];
  for (const id of ["A1", "A2", "B1", "B2"] as const) for (const hand of ["right", "left"] as const) {
    const p = { ...a1, id, hand, z: id.startsWith("A") ? 3.6 : -3.6 };
    for (const type of SHOT_TYPES) for (const backhand of [false, true]) {
      const shot = shotFor(type, p, backhand);
      pose(p, shot, 0);
      if (paddle.position.distanceTo(new T.Vector3(shot.from.x-p.x, shot.from.y,shot.from.z-p.z)) > 1e-8) errors.push(`${id} ${hand} ${type} contact`);
      for (const s of sides) {
        const j = actor.jointAngles(s);
        if (j.elbow < 24*Math.PI/180 || j.elbow > 161*Math.PI/180 || Math.abs(j.flex)>61*Math.PI/180 || Math.abs(j.deviation)>31*Math.PI/180)
          errors.push(`${id} ${hand} ${type} ${backhand ? "BH" : "FH"} ${s} limits`);
      }
    }
    pose(p);
    for (const s of sides) if (Math.abs(actor.jointAngles(s).deviation)>31*Math.PI/180) errors.push(`${id} ${hand} ready wrist`);
  }
  expect(errors, errors.slice(0,16).join("\n")).toEqual([]);
});

it("three-step rally keeps player/root motion C1 across clip boundaries", () => {
  const scenario = initialScenario();
  scenario.steps = ["serve", "drive", "dink"].map((type, i) => {
    const step = structuredClone(scenario.steps[0]);
    step.players.forEach(p => { p.x += i * 0.25; p.z -= (p.id.startsWith("A") ? 1 : -1) * i * 0.15; });
    const p = step.players.find(p => p.id === "A1")!;
    step.shot = shotFor(type as ShotType, p);
    return step;
  });
  const clips = buildClips(scenario), end = clips.at(-1)!.end;
  const report = auditMotion(t => {
    const clip = clips.find(c => t < c.end) ?? clips.at(-1)!;
    const ps = sampleClipPlayers(clip.startPlayers!, scenario.steps[clip.index].players, clip, t-clip.start, clip.shot?.hitter);
    return Object.fromEntries(ps.map(p => [p.id, new T.Vector3(p.x,0,p.z)]));
  }, 0, end);
  expect(Object.values(report.acceleration).every(r => r.value <= 60), JSON.stringify(report)).toBe(true);
  expect(auditBoundaries(t=>{
    const clip=clips.find(c=>t<c.end) ?? clips.at(-1)!;
    return Object.fromEntries(sampleClipPlayers(clip.startPlayers!,scenario.steps[clip.index].players,clip,t-clip.start,clip.shot?.hitter).map(p=>[p.id,new T.Vector3(p.x,0,p.z)]));
  },clips.slice(1).map(c=>c.start)).filter(b=>b.positionJump>=.001 || b.velocityJump>=.05+.02*b.speed)).toEqual([]);
});
