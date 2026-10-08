import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { playerPose } from "../src/core/player-pose";
import { Humanoid, prepareHumanoidGeometry } from "../src/scene/humanoid";
import { SHOT_TYPES, DEFAULT_HEIGHT } from "../src/core/constants";
import type { Shot } from "../src/core/scenario";
let geometry: T.BufferGeometry;
beforeAll(async () => {
  const bytes = readFileSync("public/models/male-base.glb");
  const g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  g.scene.updateMatrixWorld(true);
  let mesh: T.Mesh | undefined;
  g.scene.traverse((o) => {
    if ((o as T.Mesh).isMesh) mesh = o as T.Mesh;
  });
  geometry = prepareHumanoidGeometry(mesh!);
});
it("normalizes the provided mesh and assigns finite normalized skin weights", () => {
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.max.y).toBeCloseTo(1.8, 5);
  expect(geometry.getAttribute("position").count).toBe(5087);
  const weights = geometry.getAttribute("skinWeight");
  for (let i = 0; i < weights.count; i++)
    expect(
      weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i),
    ).toBeCloseTo(1, 5);
});
it("keeps every vertex finite through all shot poses with feet near the ground", () => {
  const actor = new Humanoid(geometry, "A"),
    paddle = new T.Group(),
    p = { id: "A1" as const, x: 0, z: 0 };
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
      for (let i = 0; i < 5087; i++) {
        const v = actor.mesh.getVertexPosition(i, new T.Vector3());
        expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
        minY = Math.min(minY, v.y);
      }
      expect(minY).toBeGreaterThan(-0.06);
      expect(minY).toBeLessThan(0.06 + playerPose(p, shot, time).hop);
    }
});
it("uses independent skeletons for each player", () => {
  const a = new Humanoid(geometry, "A"),
    b = new Humanoid(geometry, "B");
  a.pose({ id: "A1", x: 0, z: 0 }, undefined, undefined, new T.Group());
  expect(a.mesh.skeleton.bones[0]).not.toBe(b.mesh.skeleton.bones[0]);
  expect(b.mesh.skeleton.bones[0].position.y).toBe(0.95);
});
it("holds a stance foot in world coordinates while the body advances", () => {
  const a = new Humanoid(geometry, "A"),
    paddle = new T.Group();
  let held = 0,
    prior = new Map<string, T.Vector3>();
  for (let i = 0; i < 50; i++) {
    const z = -i / 60;
    a.pose({ id: "A1", x: 0, z }, undefined, undefined, paddle, {
      velocity: new T.Vector3(0, 0, -1),
      clock: i / 60,
      dt: 1 / 60,
    });
    for (const bone of a.mesh.skeleton.bones.filter((b) =>
      b.name.startsWith("foot"),
    )) {
      const point = bone.position.clone().add(new T.Vector3(0, 0, z)),
        before = prior.get(bone.name);
      if (
        i > 15 &&
        before &&
        Math.abs(point.y - 0.12) < 0.003 &&
        point.distanceTo(before) < 0.005
      )
        held++;
      prior.set(bone.name, point);
    }
  }
  expect(held).toBeGreaterThan(10);
});

it("retains the paddle in the dominant palm across both handednesses and every stroke", async () => {
  const { handGripBasis } = await import("../src/scene/grip");
  const { PADDLE_GRIP_Y } = await import("../src/scene/paddle");
  const actor = new Humanoid(geometry, "A"),
    paddle = new T.Group();
  for (const hand of ["left", "right"] as const) {
    const sign = hand === "left" ? -1 : 1;
    const p = { id: "A1" as const, x: 0, z: 0, hand };
    for (const type of SHOT_TYPES)
      for (const time of [-0.18, 0, 0.18, 0.8]) {
        actor.pose(
          p,
          {
            hitter: "A1",
            type,
            from: { x: sign * 0.35, y: DEFAULT_HEIGHT[type], z: -0.25 },
            to: { x: 1, z: -4 },
            apex: 3,
          },
          time,
          paddle,
        );
        const wrist = actor.mesh.skeleton.bones.find(
          (b) => b.name === (sign < 0 ? "handL" : "handR"),
        )!;
        const palm = wrist.position
          .clone()
          .add(handGripBasis(sign).center.applyQuaternion(wrist.quaternion));
        const handle = new T.Vector3(0, PADDLE_GRIP_Y, 0)
          .applyQuaternion(paddle.quaternion)
          .add(paddle.position);
        expect(palm.distanceTo(handle)).toBeLessThan(0.00001);
        expect(actor.mesh.morphTargetInfluences![sign < 0 ? 0 : 1]).toBe(1);
      }
  }
});

it("places the supporting backhand above the dominant hand and opens it while approaching an unreachable grip", async () => {
  const { handGripBasis } = await import("../src/scene/grip");
  const { PADDLE_GRIP_Y, PADDLE_SUPPORT_OFFSET } =
    await import("../src/scene/paddle");
  const actor = new Humanoid(geometry, "A"),
    paddle = new T.Group();
  const p = { id: "A1" as const, x: 0, z: 0 };
  const shot: Shot = {
    hitter: "A1",
    type: "drive",
    from: { x: -0.35, y: 0.8, z: -0.25 },
    to: { x: 1, z: -4 },
    apex: 3,
  };
  actor.pose(p, shot, 0, paddle);
  const wrist = actor.mesh.skeleton.bones.find((b) => b.name === "handL")!;
  const palm = wrist.position
    .clone()
    .add(handGripBasis(-1).center.applyQuaternion(wrist.quaternion));
  const upperGrip = new T.Vector3(0, PADDLE_GRIP_Y + PADDLE_SUPPORT_OFFSET, 0)
    .applyQuaternion(paddle.quaternion)
    .add(paddle.position);
  expect(palm.distanceTo(upperGrip)).toBeLessThan(0.00001);
  expect(PADDLE_SUPPORT_OFFSET).toBeGreaterThan(0.065);
  expect(actor.mesh.morphTargetInfluences![0]).toBe(1);
  actor.pose(
    p,
    { ...shot, type: "flick", from: { ...shot.from, y: DEFAULT_HEIGHT.flick } },
    -0.18,
    paddle,
  );
  expect(actor.mesh.morphTargetInfluences![0]).toBeLessThan(0.1);
});
