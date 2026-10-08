import { it, expect } from "vitest";
import {
  STROKE_MOTION,
  sampleStroke,
  strokePreparation,
} from "../src/core/stroke-motion";
import { SHOT_TYPES } from "../src/core/constants";
import { playerPose } from "../src/core/player-pose";
import { initialScenario } from "../src/core/scenario";
import { buildClips, sampleClipBall } from "../src/core/playback";
it("preserves contact and nonzero continuous paddle velocity through impact", () => {
  for (const type of SHOT_TYPES) {
    const before = sampleStroke(type, -0.00001).offset,
      at = sampleStroke(type, 0).offset,
      after = sampleStroke(type, 0.00001).offset;
    expect(at).toEqual([0, 0, 0]);
    for (let j = 0; j < 3; j++)
      expect((at[j] - before[j]) / 0.00001).toBeCloseTo(
        (after[j] - at[j]) / 0.00001,
        2,
      );
    expect(Math.hypot(...after)).toBeGreaterThan(1e-8);
  }
});
it("distinguishes compact blocking, high drive finish, overhead downswing and lifting lob", () => {
  expect(Math.hypot(...sampleStroke("block", 0.14).offset)).toBeLessThan(0.05);
  expect(sampleStroke("drive", 0.26).offset[2]).toBeGreaterThan(0.6);
  expect(sampleStroke("smash", 0.3).offset[2]).toBeLessThan(-1);
  expect(sampleStroke("lob", 0.32).offset[2]).toBeGreaterThan(0.5);
  expect(sampleStroke("punch", 0.16).offset[0]).toBeGreaterThan(0.2);
});
it("uses a stronger wrist roll for flick and roll than for dink", () => {
  expect(STROKE_MOTION.flick.wrist).toBeGreaterThan(STROKE_MOTION.roll.wrist);
  expect(STROKE_MOTION.roll.wrist).toBeGreaterThan(
    STROKE_MOTION.dink.wrist * 5,
  );
});
it("turns the hitting shoulder back to load and forwards on a forehand finish", () => {
  const p = { id: "A1" as const, x: 0, z: 0 },
    shot = {
      ...initialScenario().steps[0].shot!,
      hitter: "A1" as const,
      type: "drive" as const,
      from: { x: 0.35, y: 0.8, z: -0.25 },
      to: { x: 0, z: -4 },
    };
  const load = playerPose(p, shot, -0.198),
    follow = playerPose(p, shot, 0.26);
  expect(load.yaw).toBeLessThan(load.stanceYaw);
  expect(follow.yaw).toBeGreaterThan(follow.stanceYaw);
  expect(
    playerPose(p, { ...shot, from: { ...shot.from, x: -0.35 } }, 0).twoHanded,
  ).toBe(true);
  expect(playerPose(p, shot, 0).twoHanded).toBe(false);
});
it("provides preparation before the first ball flight with no discontinuity at release", () => {
  const s = initialScenario(),
    clip = buildClips(s)[0];
  expect(clip.move).toBe(strokePreparation("serve"));
  expect(sampleClipBall(clip, clip.move / 2)).toEqual(s.steps[0].shot!.from);
  expect(sampleClipBall(clip, clip.move)).toEqual(clip.trajectory!.at(0));
  expect(sampleClipBall(clip, clip.move + 0.05)!.z).not.toBe(
    s.steps[0].shot!.from.z,
  );
});
it("returns to a shared ready stance after each shot", () => {
  for (const type of SHOT_TYPES) {
    const m = sampleStroke(type, 2);
    expect(m.recovery).toBe(1);
    expect(Math.hypot(...m.offset)).toBe(0);
    expect(m.hop).toBe(0);
  }
});
