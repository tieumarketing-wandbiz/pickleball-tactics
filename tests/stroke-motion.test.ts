import { describe, it, expect } from "vitest";
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

describe("pose-to-pose timeline (animation-principles.md)", () => {
  const loadTime = (type: (typeof SHOT_TYPES)[number]) =>
    -STROKE_MOTION[type].prepare * 0.55;
  it("eases out of the load and accelerates monotonically into contact", () => {
    for (const type of ["serve", "drive", "dink", "volley", "smash"] as const) {
      // From the breakdown on (before it the lagging paddle may still be finishing the takeback
      // while the hips already drive forward — that's the kinetic chain, tested below).
      const start = loadTime(type) * 0.4;
      let previous = -Infinity,
        speed = 0;
      for (let t = start; t <= 0; t += 0.005) {
        const along = sampleStroke(type, t).offset[0];
        expect(along).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = along;
      }
      // fastest close to contact: velocity just before contact beats the early forward swing
      const v = (t: number) =>
        (sampleStroke(type, t + 0.001).offset[0] -
          sampleStroke(type, t - 0.001).offset[0]) /
        0.002;
      speed = v(-0.005);
      expect(speed).toBeGreaterThan(v(start));
    }
  });
  it("leads the forward swing with the hips while the paddle lags (kinetic chain)", () => {
    const type = "drive",
      load = sampleStroke(type, loadTime(type)),
      t = loadTime(type) * 0.45,
      mid = sampleStroke(type, t);
    const hips = (mid.hipTwist - load.hipTwist) / (0 - load.hipTwist);
    const paddle = (mid.offset[0] - load.offset[0]) / (0 - load.offset[0]);
    expect(hips).toBeGreaterThan(paddle);
  });
  it("swings on an arc, not a straight line, from load through contact", () => {
    for (const type of ["serve", "drive", "smash"] as const) {
      const a = sampleStroke(type, loadTime(type)).offset,
        b = sampleStroke(type, loadTime(type) * 0.4).offset;
      // distance of the breakdown from the load→contact chord
      const len = Math.hypot(...a),
        dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len * len);
      const off = Math.hypot(
        b[0] - a[0] * dot,
        b[1] - a[1] * dot,
        b[2] - a[2] * dot,
      );
      expect(off).toBeGreaterThan(0.03);
    }
  });
  it("settles back into ready with a small overshoot", () => {
    const p = STROKE_MOTION.volley;
    let peak = 0;
    for (let t = p.followTime; t <= p.recover; t += 0.01)
      peak = Math.max(peak, sampleStroke("volley", t).recovery);
    expect(peak).toBeGreaterThan(1.03);
    expect(peak).toBeLessThan(1.1);
    expect(sampleStroke("volley", p.recover + 0.01).recovery).toBe(1);
  });
  it("holds the punch-volley finish before recovering", () => {
    const p = STROKE_MOTION.punch;
    expect(sampleStroke("punch", p.followTime + p.hold! * 0.9).offset).toEqual(
      sampleStroke("punch", p.followTime).offset,
    );
  });
});
