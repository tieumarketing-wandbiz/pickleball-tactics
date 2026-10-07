import { expect, it } from "vitest";
import { initialScenario, type Point3 } from "../src/core/scenario";
import {
  buildClips,
  sampleClipBall,
  sampleClipPlayers,
} from "../src/core/playback";
const distance = (a: Point3, b: Point3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
it("keeps the ball continuous and visible across three independently authored shots", () => {
  const s = initialScenario();
  const next = structuredClone(s.steps[0]);
  next.shot!.hitter = "B1";
  next.shot!.from = { x: 1.5, y: 0.8, z: -4.9 };
  next.shot!.to = { x: -1, z: 3 };
  s.steps.push(next, structuredClone(s.steps[0]));
  const clips = buildClips(s);
  for (let i = 1; i < clips.length; i++) {
    const prev = clips[i - 1],
      current = clips[i];
    expect(current.start).toBe(prev.end);
    const end = sampleClipBall(prev, prev.end - prev.start)!;
    expect(distance(sampleClipBall(current, 0)!, end)).toBeLessThan(1e-9);
    for (let t = 0; t <= current.move; t += 0.005)
      expect(sampleClipBall(current, t)).toBeDefined();
    expect(
      distance(
        sampleClipBall(current, current.move - 1e-6)!,
        current.trajectory!.at(0),
      ),
    ).toBeLessThan(0.0001);
  }
});
it("moves partners during flight while the hitter arrives before striking", () => {
  const s = initialScenario(),
    next = structuredClone(s.steps[0]);
  next.players.forEach((p) => (p.x += 0.3));
  next.shot!.from.x += 0.3;
  s.steps.push(next);
  const clip = buildClips(s)[1];
  const atContact = sampleClipPlayers(
    s.steps[0].players,
    next.players,
    clip,
    clip.move,
    "A1",
  );
  expect(atContact.find((p) => p.id === "A1")).toEqual(
    next.players.find((p) => p.id === "A1"),
  );
  expect(atContact.find((p) => p.id === "A2")!.x).toBeLessThan(
    next.players.find((p) => p.id === "A2")!.x,
  );
  expect(
    sampleClipPlayers(
      s.steps[0].players,
      next.players,
      clip,
      clip.end - clip.start,
      "A1",
    ),
  ).toEqual(next.players);
});
it("holds the ball through a formation-only step without hiding or losing continuity", () => {
  const s = initialScenario(),
    pose = structuredClone(s.steps[0]);
  delete pose.shot;
  s.steps.push(pose, structuredClone(s.steps[0]));
  const clips = buildClips(s);
  const p = sampleClipBall(clips[0], clips[0].end)!;
  expect(sampleClipBall(clips[1], 0.4)).toEqual(p);
  expect(sampleClipBall(clips[2], 0)).toEqual(p);
});
it("keeps a cross-court receive bridge above the net", () => {
  const s = initialScenario(),
    next = structuredClone(s.steps[0]);
  next.shot!.from = { x: 0, y: 0.8, z: 4 };
  s.steps.push(next);
  const clip = buildClips(s)[1];
  const a = clip.handoff!.from,
    b = clip.handoff!.to;
  const crossing = -a.z / (b.z - a.z);
  expect(sampleClipBall(clip, crossing * clip.move)!.y).toBeGreaterThan(0.951);
});
