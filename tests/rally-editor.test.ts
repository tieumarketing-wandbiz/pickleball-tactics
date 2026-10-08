import { expect, it } from "vitest";
import { initialScenario } from "../src/core/scenario";
import { nextRallyStep, receiveContact, strokeSide } from "../src/core/contact";
import { trajectory } from "../src/core/trajectory";
it("adding a step hands the ball to the nearest opposing receiver", () => {
  const old = initialScenario().steps[0],
    snapshot = structuredClone(old);
  const next = nextRallyStep(old, "A1");
  expect(next.shot!.hitter).toBe("B2");
  expect(next.shot!.from.x).toBe(old.shot!.to.x);
  expect(next.shot!.from.z).toBe(old.shot!.to.z);
  const sender = old.players.find((p) => p.id === old.shot!.hitter)!;
  expect(next.shot!.to).toEqual({ x: sender.x, z: sender.z });
  expect(next.shot!.type).toBe("drive");
  expect(next.shot!.autoBounce).toBe(true);
  expect(old).toEqual(snapshot);
  old.shot!.to.x = -1.5;
  expect(nextRallyStep(old, "A1").shot!.hitter).toBe("B1");
  const returned = nextRallyStep(next, "B1");
  expect(returned.shot!.hitter[0]).toBe("A");
});
it("an empty formation still creates a ready ball on the opposing side", () => {
  const old = initialScenario().steps[0];
  delete old.shot;
  const next = nextRallyStep(old, "A1");
  expect(next.shot!.hitter[0]).toBe("B");
  expect(next.shot!.from.z).toBeLessThan(0);
});
it("automatic rebound responds to shot type, apex and contact height, ignoring a legacy manual value", () => {
  const s = { ...initialScenario().steps[0].shot!, autoBounce: true };
  const plain = trajectory(s),
    higher = trajectory({ ...s, apex: 2.5 }),
    contact = trajectory({ ...s, from: { ...s.from, y: 1.4 } }),
    soft = trajectory({ ...s, type: "dink" as const });
  expect(higher.bounceHeight).toBeGreaterThan(plain.bounceHeight);
  expect(contact.restitution).not.toBe(plain.restitution);
  expect(soft.restitution).toBeLessThan(plain.restitution);
  expect(trajectory({ ...s, bounce: 0.1 }).bounceHeight).toBe(
    trajectory({ ...s, bounce: 0.9 }).bounceHeight,
  );
  expect(plain.bounceHeight).toBeGreaterThan(0);
  expect(plain.duration).toBe(plain.flightTime);
});
it("a boolean topspin applies preset strength or switches spin off completely", () => {
  const s = initialScenario().steps[0].shot!;
  const plain = trajectory({
      ...s,
      topspin: false,
      spin: { type: "left", strength: 1 },
    }),
    top = trajectory({ ...s, topspin: true });
  expect(plain.spinSpeed).toBe(0);
  expect(top.spinSpeed).toBeGreaterThan(0);
  expect(top.flightTime).toBeLessThan(plain.flightTime);
});
it("receiving contact follows the incoming bounce so moving across it changes FH/BH without controls", () => {
  const previous = initialScenario().steps[0].shot!;
  const right = { id: "B1" as const, x: 1.9, z: -4.9 },
    left = { ...right, x: 1.1 };
  const shot = {
    ...previous,
    hitter: "B1" as const,
    from: receiveContact(previous, right, "drive", 0.8),
  };
  expect(strokeSide(right, shot).kind).toBe("forehand");
  shot.from = receiveContact(previous, left, "drive", 0.8);
  expect(strokeSide(left, shot).kind).toBe("backhand");
});
