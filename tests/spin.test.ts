import { expect, it } from "vitest";
import {
  initialScenario,
  parseScenario,
  encodeScenario,
  decodeScenario,
} from "../src/core/scenario";
import { trajectory } from "../src/core/trajectory";
import { planeCrossings, SPIN_TYPES } from "../src/core/spin";
const base = () => initialScenario().steps[0].shot!;
it.each(SPIN_TYPES)("preserves the authored landing with %s spin", (type) => {
  const s = { ...base(), spin: { type, strength: 0.85 } };
  const tr = trajectory(s);
  expect(tr.result).toBe("OK");
  expect(tr.at(tr.flightTime)).toEqual({ ...s.to, y: 0.037 });
  expect(tr.points.every((p) => Object.values(p).every(Number.isFinite))).toBe(
    true,
  );
});
it("sidespin bends the path in opposite directions", () => {
  const left = trajectory({ ...base(), spin: { type: "left", strength: 0.8 } }),
    right = trajectory({ ...base(), spin: { type: "right", strength: 0.8 } });
  const a = left.at(left.flightTime / 2),
    b = right.at(right.flightTime / 2);
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.2);
  expect(left.spinAxis.y).toBe(-right.spinAxis.y);
});
it("topspin flies faster, backspin floats longer, and spin changes ground retention", () => {
  const plain = trajectory({ ...base(), finish: true });
  const top = trajectory({
    ...base(),
    finish: true,
    spin: { type: "top", strength: 1 },
  });
  const back = trajectory({
    ...base(),
    finish: true,
    spin: { type: "back", strength: 1 },
  });
  expect(top.flightTime).toBeLessThan(plain.flightTime);
  expect(back.flightTime).toBeGreaterThan(plain.flightTime);
  const travel = (tr: ReturnType<typeof trajectory>) => {
    const p = tr.at(tr.flightTime + 0.05);
    return Math.hypot(p.x - 1.5, p.z + 4.3);
  };
  expect(travel(top)).toBeGreaterThan(travel(back));
});
it("uses restitution squared for first bounce height and stays above ground", () => {
  const a = trajectory({
      ...base(),
      finish: true,
      bounce: 0.35,
      autoBounce: false,
    }),
    b = trajectory({ ...base(), finish: true, bounce: 0.7, autoBounce: false });
  expect(b.bounceHeight / a.bounceHeight).toBeCloseTo(4, 10);
  expect(b.duration).toBeGreaterThan(a.duration);
  for (let t = 0; t <= b.duration; t += 0.005)
    expect(b.at(t).y).toBeGreaterThanOrEqual(0.037 - 1e-8);
  expect(
    trajectory({ ...base(), finish: true, bounce: 0, autoBounce: false })
      .duration,
  ).toBeCloseTo(a.flightTime);
});
it("finds two net-plane crossings for a curved same-side path", () => {
  const roots = planeCrossings(1, -4, 4, 0, 2);
  expect(roots).toHaveLength(2);
  expect(roots[0]).toBeCloseTo(1 - Math.SQRT1_2, 8);
  expect(roots[1]).toBeCloseTo(1 + Math.SQRT1_2, 8);
});
it("checks curved net contact continuously and clips at the collision", () => {
  const s = {
    ...base(),
    from: { x: 0, y: 0.1, z: 1 },
    to: { x: 0, z: -1 },
    apex: 0.4,
    spin: { type: "left" as const, strength: 0.9 },
  };
  const tr = trajectory(s);
  expect(tr.result).toBe("NET");
  expect(tr.at(tr.collisionTime!).z).toBeCloseTo(0, 8);
  expect(tr.at(tr.duration).y).toBeCloseTo(0.037);
});
it("roundtrips spin and bounce and supplies defaults for older JSON", () => {
  const s = initialScenario();
  s.steps[0].shot!.spin = { type: "back", strength: 0.75 };
  s.steps[0].shot!.bounce = 0.55;
  expect(decodeScenario(encodeScenario(s))).toEqual(s);
  delete s.steps[0].shot!.spin;
  delete s.steps[0].shot!.bounce;
  const loaded = parseScenario(JSON.stringify(s));
  expect(loaded.steps[0].shot!.spin).toEqual({ type: "none", strength: 0 });
  expect(loaded.steps[0].shot!.bounce).toBe(0.7);
  for (const spin of [
    { type: "unknown", strength: 0.5 },
    { type: "top", strength: 2 },
  ])
    expect(() =>
      parseScenario(
        JSON.stringify({
          ...s,
          steps: [{ ...s.steps[0], shot: { ...s.steps[0].shot, spin } }],
        }),
      ),
    ).toThrow();
  expect(() => trajectory({ ...base(), bounce: 1 })).toThrow();
});
