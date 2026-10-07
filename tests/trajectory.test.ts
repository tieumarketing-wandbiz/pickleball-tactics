import { describe, expect, it } from "vitest";
import {
  COURT,
  DEFAULT_APEX,
  DEFAULT_HEIGHT,
  shotOrigin,
  netHeight,
  snapPlayer,
  type ShotType,
} from "../src/core/constants";
import { initialScenario, type Shot } from "../src/core/scenario";
import { trajectory } from "../src/core/trajectory";
const shot = (changes: Partial<Shot> = {}): Shot => ({
  ...initialScenario().steps[0].shot!,
  ...changes,
});
describe("court coordinates", () => {
  it("keeps regulation scale and net sag", () => {
    expect(COURT.halfWidth * 2).toBeCloseTo(6.1);
    expect(COURT.halfLength * 2).toBeCloseTo(13.41);
    expect(netHeight(0)).toBeCloseTo(0.864);
    expect(netHeight(3.05)).toBeCloseTo(0.914);
    expect(netHeight(-3.05)).toBeCloseTo(0.914);
  });
  it("snaps and clamps all drag positions", () => {
    expect(snapPlayer(1.24, -4.16)).toEqual({ x: 1.2, z: -4.2 });
    expect(snapPlayer(100, -100)).toEqual({ x: 5, z: -8.8 });
  });
});
describe("analytic ball path", () => {
  it.each(Object.keys(DEFAULT_APEX) as ShotType[])(
    "lands within 1cm with %s",
    (type) => {
      const player =
        type === "atp" || type === "erne"
          ? { x: 3.05, z: 0.3 }
          : { x: -1.5, z: 4.9 };
      const s = shot({
        type,
        apex: DEFAULT_APEX[type],
        from: shotOrigin(player, type, DEFAULT_HEIGHT[type]),
      });
      const tr = trajectory(s);
      expect(tr.result).toBe("OK");
      const p = tr.at(tr.flightTime);
      expect(Math.hypot(p.x - s.to.x, p.z - s.to.z)).toBeLessThan(0.01);
      expect(p.y).toBeCloseTo(COURT.ballRadius, 10);
    },
  );
  it("hits its specified apex", () => {
    const s = shot({ apex: 5 });
    const tr = trajectory(s);
    const t = Math.sqrt(2 * COURT.gravity * (5 - s.from.y)) / COURT.gravity;
    expect(tr.at(t).y).toBeCloseTo(5, 10);
  });
  it("detects NET analytically and stops at the mesh", () => {
    const s = shot({
      from: { x: 0, y: 0.1, z: 1 },
      to: { x: 0, z: -1 },
      apex: 0.4,
    });
    const tr = trajectory(s);
    expect(tr.result).toBe("NET");
    expect(tr.collisionTime).not.toBeNull();
    expect(tr.at(tr.duration).z).toBeCloseTo(0);
    expect(tr.at(tr.duration).y).toBeCloseTo(COURT.ballRadius);
    expect(tr.points.at(-1)!.z).toBeCloseTo(0);
  });
  it("reports OUT and honors lines as in bounds", () => {
    expect(trajectory(shot({ to: { x: 3.1, z: -4 } })).result).toBe("OUT");
    expect(trajectory(shot({ to: { x: 3.05, z: -6.705 } })).result).toBe("OK");
  });
  it("treats kitchen as a region and warns for serve and volley origin", () => {
    const tr = trajectory(
      shot({
        type: "dink",
        from: { x: 0, y: 0.8, z: 2.13 },
        to: { x: 0, z: -1 },
        apex: 1.2,
      }),
    );
    expect(tr.kitchen).toBe(true);
    expect(tr.result).toBe("OK");
    expect(tr.warnings).toEqual([]);
    expect(trajectory(shot({ to: { x: 0, z: -1 } })).warnings).toContain(
      "Giao bóng rơi vào kitchen là lỗi.",
    );
    expect(
      trajectory(
        shot({ volley: true, from: { x: 0, y: 0.8, z: 1 } }),
      ).warnings.some((w) => w.includes("Volley")),
    ).toBe(true);
  });
  it("ignores the infinitely extended net beyond its posts", () => {
    const tr = trajectory(
      shot({ from: { x: 4, y: 0.1, z: 1 }, to: { x: 4, z: -1 }, apex: 0.4 }),
    );
    expect(tr.result).toBe("OUT");
    expect(tr.netClearance).toBeNull();
  });
  it("handles no net crossing and rejects impossible apex", () => {
    expect(trajectory(shot({ to: { x: 0, z: 3 } })).netClearance).toBeNull();
    expect(() => trajectory(shot({ apex: 0.2 }))).toThrow();
    expect(() => trajectory(shot({ apex: NaN }))).toThrow();
  });
  it("keeps bounces above ground and eventually comes to rest", () => {
    const tr = trajectory(shot({ finish: true }));
    expect(tr.duration).toBeGreaterThan(tr.flightTime);
    for (let t = tr.flightTime; t < tr.duration; t += 0.01)
      expect(tr.at(t).y).toBeGreaterThanOrEqual(COURT.ballRadius - 1e-8);
    expect(tr.at(tr.duration + 5)).toEqual(tr.at(tr.duration));
  });
});

it("stops at the exact destination unless finish is checked", () => {
  const s = shot({ finish: false });
  const tr = trajectory(s);
  expect(tr.duration).toBe(tr.flightTime);
  expect(tr.at(tr.duration + 5)).toEqual({ ...s.to, y: COURT.ballRadius });
  const finisher = trajectory({ ...s, finish: true });
  expect(finisher.duration).toBeGreaterThan(finisher.flightTime);
  expect(finisher.at(finisher.duration).z).not.toBe(s.to.z);
});
