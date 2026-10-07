import { expect, it } from "vitest";
import { fitDink, strokeSide } from "../src/core/contact";
import {
  initialScenario,
  parseScenario,
  encodeScenario,
  decodeScenario,
} from "../src/core/scenario";
import { trajectory } from "../src/core/trajectory";
import { snapPlayer } from "../src/core/constants";
it("allows player movement outside the court and persists ATP positioning", () => {
  expect(snapPlayer(3.67, -7.21)).toEqual({ x: 3.7, z: -7.2 });
  expect(snapPlayer(100, 100)).toEqual({ x: 5, z: 8.8 });
  const s = initialScenario();
  s.steps[0].players[0] = { id: "A1", x: 3.6, z: 0.3, hand: "left" };
  s.steps[0].shot = {
    hitter: "A1",
    type: "atp",
    from: { x: 3.6, y: 0.25, z: 0.3 },
    to: { x: 2.7, z: -3 },
    apex: 0.45,
    contactFixed: true,
  };
  const loaded = decodeScenario(encodeScenario(s));
  expect(loaded.steps[0].players[0].x).toBe(3.6);
  expect(loaded.steps[0].players[0].hand).toBe("left");
  expect(loaded.steps[0].shot!.contactFixed).toBe(true);
  expect(trajectory(loaded.steps[0].shot!).result).toBe("OK");
  expect(trajectory(loaded.steps[0].shot!).netClearance).toBeNull();
  s.steps[0].players[0].x = 5.1;
  expect(() => parseScenario(JSON.stringify(s))).toThrow();
});
it("distinguishes forehand and backhand for both teams and dominant hands", () => {
  const shot = initialScenario().steps[0].shot!;
  shot.from.x = 0;
  expect(strokeSide({ id: "A1", x: -0.4, z: 4.9 }, shot).kind).toBe("forehand");
  expect(strokeSide({ id: "A1", x: 0.4, z: 4.9 }, shot).kind).toBe("backhand");
  expect(strokeSide({ id: "B1", x: -0.4, z: 4.9 }, shot).kind).toBe("backhand");
  expect(strokeSide({ id: "B1", x: 0.4, z: 4.9 }, shot).kind).toBe("forehand");
  expect(
    strokeSide({ id: "A1", x: -0.4, z: 4.9, hand: "left" }, shot).kind,
  ).toBe("backhand");
  expect(strokeSide({ id: "A1", x: 3, z: 4.9 }, shot).reachable).toBe(false);
});
it("fits a near-net dink without changing its landing point", () => {
  const shot = {
    ...initialScenario().steps[0].shot!,
    type: "dink" as const,
    from: { x: 0, y: 0.8, z: 1.2 },
    to: { x: 0, z: -0.25 },
    apex: 1.2,
  };
  expect(trajectory(shot).result).toBe("NET");
  fitDink(shot);
  const tr = trajectory(shot);
  expect(tr.result).toBe("OK");
  expect(tr.netClearance!).toBeGreaterThanOrEqual(0.04);
  expect(tr.at(tr.flightTime)).toEqual({ x: 0, y: 0.037, z: -0.25 });
});
it("keeps impossible near-net targets visibly NET instead of moving the destination", () => {
  const shot = {
    ...initialScenario().steps[0].shot!,
    type: "dink" as const,
    from: { x: 0, y: 0.8, z: 2.4 },
    to: { x: 0, z: -0.01 },
    apex: 1.2,
  };
  fitDink(shot);
  expect(trajectory(shot).result).toBe("NET");
  expect(shot.to.z).toBe(-0.01);
});
it("separates in-bounds first landing from a long dink bouncing out", () => {
  const shot = {
    ...initialScenario().steps[0].shot!,
    type: "dink" as const,
    from: { x: -1.5, y: 0.8, z: 2.3 },
    to: { x: 3, z: -1.5 },
    apex: 1.2,
    finish: true,
  };
  const tr = trajectory(shot);
  expect(tr.result).toBe("OK");
  expect(tr.bounceOut).toBe(true);
  expect(tr.bouncePoints.length).toBeGreaterThan(0);
  expect(tr.kitchen).toBe(true);
  expect(tr.at(tr.duration).x).toBeGreaterThan(3.05);
  const stopped = trajectory({ ...shot, finish: false });
  expect(stopped.bounceOut).toBe(false);
  expect(stopped.bouncePoints).toEqual([]);
});
