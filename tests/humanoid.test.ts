import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { playerPose } from "../src/core/player-pose";
import {
  ARM_CLEARANCE,
  FOREARM_RADIUS,
  Humanoid,
  REQUIRED_BONES,
  UPPER_ARM_FREE,
  UPPER_ARM_RADIUS,
  type HumanoidRig,
} from "../src/scene/humanoid";
import { segmentGap } from "../src/scene/rig";
import { PADDLE_GRIP_Y, PADDLE_SUPPORT_OFFSET } from "../src/scene/paddle";
import { SHOT_TYPES, DEFAULT_HEIGHT } from "../src/core/constants";
import { STROKE_MOTION } from "../src/core/stroke-motion";
import type { Player, Shot } from "../src/core/scenario";

let rig: HumanoidRig;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const bytes = readFileSync("public/models/male-rigged.glb");
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  rig = { scene: gltf.scene };
});
const deg = (d: number) => (d * Math.PI) / 180;
const pos = (actor: Humanoid, name: string) =>
  actor.bone(name).getWorldPosition(new T.Vector3());
/** Every shot at a spread of times, plus the idle ready stance, for both teams and hands. */
function* sweep(times = [-0.5, -0.3, -0.15, -0.05, 0, 0.1, 0.25, 0.45, 0.8]) {
  for (const id of ["A1", "B1"] as const)
    for (const hand of ["right", "left"] as const) {
      const facing = id === "A1" ? -1 : 1;
      const player: Player = { id, x: 0, z: -facing * 2.4, hand };
      yield {
        player,
        shot: undefined as Shot | undefined,
        time: undefined as number | undefined,
      };
      for (const type of SHOT_TYPES)
        for (const side of [1, -1])
          for (const time of times) {
            const shot: Shot = {
              hitter: id,
              type,
              from: {
                x: side * 0.3 * -facing,
                y: DEFAULT_HEIGHT[type],
                z: player.z + facing * 0.25,
              },
              to: { x: 0.5, z: facing * 5 },
              apex: 2.5,
            };
            yield { player, shot, time };
          }
    }
}

describe("v2 Mixamo rig", () => {
  it("loads the user's skeleton in app space facing −Z", () => {
    const actor = new Humanoid(rig, "A");
    for (const n of REQUIRED_BONES) expect(actor.bones.has(n), n).toBe(true);
    expect(pos(actor, "LeftHand").x).toBeLessThan(0);
    expect(pos(actor, "LeftToeBase").z).toBeLessThan(pos(actor, "LeftFoot").z);
    actor.mesh.skeleton.update();
    const box = new T.Box3();
    const p = new T.Vector3();
    for (let i = 0; i < actor.mesh.geometry.getAttribute("position").count; i++)
      box.expandByPoint(actor.mesh.getVertexPosition(i, p));
    expect(box.max.y - box.min.y).toBeCloseTo(1.8, 2);
    expect(box.min.y).toBeCloseTo(0, 2);
  });

  it("keeps every vertex finite through all shot poses with feet near the ground", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group(),
      p = { id: "A1" as const, x: 0, z: 0 };
    const count = actor.mesh.geometry.getAttribute("position").count;
    const v = new T.Vector3();
    for (const type of SHOT_TYPES)
      for (const time of [-0.2, 0, 0.22, 0.8]) {
        const shot: Shot = {
          hitter: "A1",
          from: { x: 0.35, y: DEFAULT_HEIGHT[type], z: -0.2 },
          to: { x: 1, z: -4 },
          apex: 3,
          type,
        };
        actor.pose(p, shot, time, paddle);
        let minY = Infinity;
        for (let i = 0; i < count; i += 3) {
          actor.mesh.getVertexPosition(i, v);
          expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
          minY = Math.min(minY, v.y);
        }
        expect(minY, `${type} t=${time}`).toBeGreaterThan(-0.06);
        expect(minY, `${type} t=${time}`).toBeLessThan(
          0.06 + playerPose(p, shot, time).hop,
        );
      }
  });

  it("uses independent skeletons for each player", () => {
    const a = new Humanoid(rig, "A"),
      b = new Humanoid(rig, "B");
    a.pose({ id: "A1", x: 0, z: 0 }, undefined, undefined, new T.Group());
    expect(a.bone("Hips")).not.toBe(b.bone("Hips"));
    expect(b.bone("Hips").position.y).toBeCloseTo(0.995, 2);
  });

  it("holds a stance foot in world coordinates while the body advances", () => {
    const a = new Humanoid(rig, "A"),
      paddle = new T.Group();
    const ankle = pos(a, "LeftFoot").y;
    let held = 0;
    const prior = new Map<string, T.Vector3>();
    for (let i = 0; i < 50; i++) {
      const z = -i / 60;
      a.root.position.set(0, 0, z);
      a.pose({ id: "A1", x: 0, z }, undefined, undefined, paddle, {
        velocity: new T.Vector3(0, 0, -1),
        clock: i / 60,
        dt: 1 / 60,
      });
      for (const name of ["LeftFoot", "RightFoot"]) {
        const point = pos(a, name),
          before = prior.get(name);
        if (
          i > 15 &&
          before &&
          Math.abs(point.y - ankle) < 0.01 &&
          point.distanceTo(before) < 0.005
        )
          held++;
        prior.set(name, point);
      }
    }
    expect(held).toBeGreaterThan(10);
  });

  it("keeps the paddle handle in the dominant palm for both hands and every stroke", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const { player, shot, time } of sweep([-0.18, 0, 0.18, 0.8])) {
      if (player.id !== "A1") continue;
      actor.pose(player, shot, time, paddle);
      const side = player.hand === "left" ? "Left" : "Right";
      const handle = new T.Vector3(0, PADDLE_GRIP_Y, 0)
        .applyQuaternion(paddle.quaternion)
        .add(paddle.position);
      expect(actor.palm(side).distanceTo(handle)).toBeCloseTo(0.032, 3);
      expect(actor.gripWeights[side === "Left" ? 0 : 1]).toBe(1);
    }
  });

  it("puts the support hand above the dominant hand on two-handed backhands", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    const p = { id: "A1" as const, x: 0, z: 0 };
    const shot: Shot = {
      hitter: "A1",
      type: "drive",
      from: { x: -0.35, y: 0.8, z: -0.25 },
      to: { x: 1, z: -4 },
      apex: 3,
    };
    expect(playerPose(p, shot, 0).twoHanded).toBe(true);
    actor.pose(p, shot, 0, paddle);
    const upper = new T.Vector3(0, PADDLE_GRIP_Y + PADDLE_SUPPORT_OFFSET, 0)
      .applyQuaternion(paddle.quaternion)
      .add(paddle.position);
    // (this rig's arms are short: the support hand gets within a few cm of the upper grip)
    expect(actor.palm("Left").distanceTo(upper)).toBeLessThan(0.09);
  });
});

describe("arms (user feedback round 2)", () => {
  it("keeps upper arm and forearm volumes off the torso", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const { player, shot, time } of sweep()) {
      actor.root.position.set(player.x, 0, player.z);
      actor.pose(player, shot, time, paddle);
      // Around contact the hitting hand is locked to the ball.
      const locked = time !== undefined && Math.abs(time) < 0.06;
      for (const side of ["Left", "Right"] as const) {
        const hitting = (player.hand === "left") === (side === "Left");
        const s = pos(actor, `${side}Arm`),
          e = pos(actor, `${side}ForeArm`),
          w = pos(actor, `${side}Hand`);
        const caps = actor.torsoCapsules;
        const upper = segmentGap(
          caps,
          s.clone().lerp(e, UPPER_ARM_FREE),
          e,
          UPPER_ARM_RADIUS,
        );
        const fore = segmentGap(caps, e, w, FOREARM_RADIUS);
        const limit = locked && hitting ? -0.04 : ARM_CLEARANCE - 0.012;
        const label = `${player.id} ${player.hand} ${shot?.type ?? "idle"} t=${time} ${side}`;
        expect(upper, label + " upper").toBeGreaterThan(limit);
        expect(fore, label + " fore").toBeGreaterThan(limit);
      }
    }
  });

  it("keeps elbows and wrists inside their joint limits", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const { player, shot, time } of sweep()) {
      actor.root.position.set(player.x, 0, player.z);
      actor.pose(player, shot, time, paddle);
      for (const side of ["Left", "Right"] as const) {
        const j = actor.jointAngles(side);
        const label = `${player.id} ${player.hand} ${shot?.type ?? "idle"} t=${time} ${side}`;
        expect(j.elbow, label).toBeGreaterThan(deg(24));
        expect(j.elbow, label).toBeLessThan(deg(161));
        expect(Math.abs(j.flex), label).toBeLessThan(deg(61));
        expect(Math.abs(j.deviation), label).toBeLessThan(deg(31));
      }
    }
  });

  it("ready: paddle in front of the chest, head up 45–70°, elbows off the ribs, no arm across the midline", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const id of ["A1", "B1"] as const)
      for (const hand of ["right", "left"] as const) {
        const player: Player = { id, x: 0, z: id === "A1" ? 2.4 : -2.4, hand };
        actor.root.position.set(player.x, 0, player.z);
        actor.pose(player, undefined, undefined, paddle);
        const root = new T.Vector3(player.x, 0, player.z);
        const fwd = new T.Vector3(0, 0, id === "A1" ? -1 : 1);
        const right = new T.Vector3(id === "A1" ? 1 : -1, 0, 0);
        const chest = pos(actor, "Spine2");
        const centre = paddle.position.clone().add(root);
        expect(centre.y).toBeGreaterThan(1.1);
        expect(centre.y).toBeLessThan(1.45);
        expect(centre.clone().sub(chest).dot(fwd)).toBeGreaterThan(0.25);
        const head = new T.Vector3(0, 1, 0).applyQuaternion(paddle.quaternion);
        const elevation = Math.asin(head.y);
        expect(elevation, `${id} ${hand}`).toBeGreaterThan(deg(42));
        expect(elevation, `${id} ${hand}`).toBeLessThan(deg(72));
        // face toward the net (within 30°)
        const face = new T.Vector3(0, 0, 1).applyQuaternion(paddle.quaternion);
        expect(Math.abs(face.dot(fwd))).toBeGreaterThan(Math.cos(deg(30)));
        for (const side of ["Left", "Right"] as const) {
          const sign = side === "Left" ? -1 : 1;
          const elbow = pos(actor, `${side}ForeArm`),
            wrist = pos(actor, `${side}Hand`);
          // elbow 0.12–0.2 m beyond the rib surface (~0.15 from the spine), not into the ribs
          const out = elbow.clone().sub(chest).dot(right) * sign;
          expect(out, `${id} ${hand} ${side} elbow out`).toBeGreaterThan(
            0.15 + 0.1,
          );
          // no forearm across the body midline
          expect(
            wrist.clone().sub(chest).dot(right) * sign,
            `${id} ${hand} ${side} wrist`,
          ).toBeGreaterThan(-0.01);
        }
      }
  });

  it("follows the guide-video rules for the serve and the dink", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const hand of ["right", "left"] as const) {
      const p = { id: "A1" as const, x: -1.5, z: 4.9, hand };
      const root = new T.Vector3(p.x, 0, p.z);
      actor.root.position.copy(root);
      const serve: Shot = {
        hitter: "A1",
        type: "serve",
        from: { x: -1.5, y: DEFAULT_HEIGHT.serve, z: 4.9 },
        to: { x: 1.5, z: -4.3 },
        apex: 1.5,
      };
      const wrist = hand === "left" ? "LeftHand" : "RightHand";
      actor.pose(p, serve, 0, paddle);
      // Underhand: contact below the waist and the paddle head below the wrist.
      expect(paddle.position.y).toBeLessThan(pos(actor, "Hips").y);
      expect(
        new T.Vector3(0, 0.12, 0)
          .applyQuaternion(paddle.quaternion)
          .add(paddle.position)
          .add(root).y,
      ).toBeLessThan(pos(actor, wrist).y);
      // High finish: the hitting hand ends at least at head height.
      actor.pose(p, serve, STROKE_MOTION.serve.followTime, paddle);
      expect(pos(actor, wrist).y).toBeGreaterThanOrEqual(1.55);
      // Dink: deep squat (pelvis −20 cm or more) with the paddle head below the wrist.
      const dink: Shot = {
        hitter: "A1",
        type: "dink",
        from: { x: -1.3, y: 0.45, z: 2.2 },
        to: { x: 0, z: -1.5 },
        apex: 1.2,
      };
      actor.root.position.set(p.x, 0, 2.4);
      actor.pose({ ...p, z: 2.4 }, dink, 0, paddle);
      expect(pos(actor, "Hips").y).toBeLessThan(0.995 - 0.2);
      expect(paddle.position.y).toBeLessThan(pos(actor, wrist).y);
    }
  });
});

describe("technique-research E3 checks", () => {
  const shotFor = (
    type: Shot["type"],
    y = DEFAULT_HEIGHT[type],
    x = 0.3,
  ): Shot => ({
    hitter: "A1",
    type,
    from: { x, y, z: 2.35 },
    to: { x: 0.5, z: -5 },
    apex: 2.5,
  });
  const p: Player = { id: "A1", x: 0, z: 2.6 };
  const loadTime = (type: Shot["type"]) => -STROKE_MOTION[type].prepare * 0.55;
  it("contact is in front of the pelvis for every shot", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    actor.root.position.set(p.x, 0, p.z);
    for (const type of SHOT_TYPES) {
      if (type === "atp" || type === "erne") continue; // played beside the body by design
      actor.pose(p, shotFor(type), 0, paddle);
      const pelvis = pos(actor, "Hips").z - p.z;
      expect(paddle.position.z, type).toBeLessThan(pelvis);
    }
  });
  it("dink, reset and block keep the pelvis from rising into contact", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    for (const type of ["dink", "reset", "block"] as const) {
      const shot = shotFor(type, type === "block" ? 1 : 0.4);
      actor.pose(p, shot, loadTime(type), paddle);
      const load = pos(actor, "Hips").y;
      actor.pose(p, shot, 0, paddle);
      expect(pos(actor, "Hips").y, type).toBeLessThan(load + 0.02);
    }
  });
  it("lob finishes high; smash points the off hand up and finishes on the off side", () => {
    const actor = new Humanoid(rig, "A"),
      paddle = new T.Group();
    actor.root.position.set(p.x, 0, p.z);
    actor.pose(p, shotFor("lob", 0.5), STROKE_MOTION.lob.followTime, paddle);
    expect(pos(actor, "RightHand").y).toBeGreaterThan(1.45);
    const smash = shotFor("smash");
    actor.pose(p, smash, loadTime("smash"), paddle);
    expect(pos(actor, "LeftHand").y).toBeGreaterThan(pos(actor, "Head").y);
    actor.pose(p, smash, STROKE_MOTION.smash.followTime, paddle);
    // follow-through crosses to the non-dominant side (the paddle; the hand stops at the
    // clearance margin in front of the belly)
    expect(paddle.position.x).toBeLessThan(0);
  });
});
