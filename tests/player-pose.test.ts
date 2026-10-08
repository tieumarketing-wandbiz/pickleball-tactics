import { describe, it, expect } from "vitest";
import { playerPose } from "../src/core/player-pose";
import { SHOT_TYPES } from "../src/core/constants";
import type { Player, Shot } from "../src/core/scenario";
const p: Player = { id: "A1", x: -1, z: 3 };
const shot: Shot = {
  hitter: "A1",
  from: { x: -0.5, y: 0.7, z: 2.7 },
  to: { x: 1, z: -4 },
  type: "drive",
  apex: 1.5,
};
describe("player posture", () => {
  it("keeps the paddle at the authored contact at the strike frame", () => {
    const pose = playerPose(p, shot, 0);
    expect(pose.paddle).toEqual({ x: 0.5, y: 0.7, z: expect.closeTo(-0.3, 8) });
  });
  it("leans toward either side of a reachable ball and lowers the hips for low contact", () => {
    const right = playerPose(p, { ...shot, from: { x: -0.2, y: 0.3, z: 3 } });
    const left = playerPose(p, { ...shot, from: { x: -1.8, y: 0.3, z: 3 } });
    expect(right.roll).toBeLessThan(0);
    expect(left.roll).toBeGreaterThan(0);
    expect(right.hip.y).toBeLessThan(
      playerPose(p, { ...shot, from: { ...shot.from, y: 1.5 } }).hip.y,
    );
  });
  it("turns the body toward the landing direction while keeping dinks more square", () => {
    const cross = { ...shot, to: { x: 5, z: -1 } };
    expect(
      Math.abs(playerPose(p, { ...cross, type: "dink" }).stanceYaw),
    ).toBeLessThan(Math.abs(playerPose(p, cross).stanceYaw));
    expect(playerPose(p, cross).stanceYaw).not.toBe(
      playerPose(p, { ...cross, to: { x: -5, z: -1 } }).stanceYaw,
    );
  });
  it("moves from backswing through contact and follows through before recovering", () => {
    const prepare = playerPose(p, shot, -0.24),
      contact = playerPose(p, shot, 0),
      follow = playerPose(p, shot, 0.22),
      ready = playerPose(p, shot, 1.2);
    expect(prepare.paddle.z).toBeGreaterThan(contact.paddle.z);
    expect(follow.paddle.z).toBeLessThan(contact.paddle.z);
    expect(ready.paddle.y).toBe(1.12);
    expect(ready.roll).toBeCloseTo(0, 8);
  });
  it("points the paddle down from the hand for low contact", () => {
    expect(
      playerPose(p, { ...shot, from: { ...shot.from, y: 0.337 } }, 0)
        .paddleRoll,
    ).toBe(Math.PI);
    expect(
      playerPose(p, { ...shot, from: { ...shot.from, y: 2.3 } }, 0).paddleRoll,
    ).toBeCloseTo(0, 8);
    expect(playerPose(p, shot, 1.2).paddleRoll).toBeCloseTo(0, 8);
  });
  it("stays finite for every shot, zero travel and unreachable contacts", () => {
    for (const type of SHOT_TYPES)
      for (const t of [-2, 0, 0.2, 10]) {
        const pose = playerPose(
          p,
          {
            ...shot,
            type,
            from: { x: 30, y: 12, z: -30 },
            to: { x: 30, z: -30 },
          },
          t,
        );
        expect(
          [
            pose.pitch,
            pose.roll,
            pose.yaw,
            ...Object.values(pose.hip),
            ...Object.values(pose.paddle),
          ].every(Number.isFinite),
        ).toBe(true);
        expect(pose.hip.y).toBeGreaterThan(0.4);
        expect(Math.abs(pose.roll)).toBeLessThanOrEqual(0.32);
      }
  });
});
