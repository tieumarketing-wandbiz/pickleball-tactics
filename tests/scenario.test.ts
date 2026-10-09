import { expect, it } from "vitest";
import {
  initialScenario,
  encodeScenario,
  decodeScenario,
  parseScenario,
  validateScenario,
} from "../src/core/scenario";
import { buildClips, interpolatePlayers } from "../src/core/playback";
import { strokePreparation } from "../src/core/stroke-motion";
it("roundtrips unicode names, notes and multiple steps through JSON and URL", () => {
  const s = initialScenario();
  s.name = "Chiến thuật đôi 🏓";
  s.steps[0].note = "Tiến lên kitchen";
  s.steps.push(structuredClone(s.steps[0]));
  expect(parseScenario(JSON.stringify(s))).toEqual(s);
  expect(decodeScenario("#s=" + encodeScenario(s))).toEqual(s);
});
it("accepts the original model without a version", () => {
  const s = initialScenario();
  const { version, ...old } = s;
  expect(validateScenario(old).version).toBe(1);
});
it("rejects corrupt JSON, empty steps, unsupported versions and missing players", () => {
  expect(() => parseScenario("{")).toThrow("định dạng");
  expect(() => validateScenario({ name: "A", steps: [] })).toThrow();
  expect(() => validateScenario({ ...initialScenario(), version: 2 })).toThrow(
    "Phiên bản",
  );
  const s = initialScenario();
  s.steps[0].players.pop();
  expect(() => validateScenario(s)).toThrow("4 người");
});
it("rejects non-finite positions and malformed shots without changing source", () => {
  const s = initialScenario();
  s.steps[0].players[0].x = Infinity;
  expect(() => validateScenario(s)).toThrow();
  const other = initialScenario();
  other.steps[0].shot!.apex = 0.2;
  expect(() => validateScenario(other)).toThrow();
  expect(() => decodeScenario("#s=wrong??")).toThrow();
});
it("retains a step with no shot", () => {
  const s = initialScenario();
  delete s.steps[0].shot;
  expect(parseScenario(JSON.stringify(s)).steps[0].shot).toBeUndefined();
});
it("builds ordered transitions and interpolates by player identity", () => {
  const s = initialScenario();
  const next = structuredClone(s.steps[0]);
  next.players.reverse();
  next.players.find((p) => p.id === "A1")!.x = -1.5;
  s.steps.push(next);
  const clips = buildClips(s);
  expect(clips[0].move).toBe(strokePreparation(s.steps[0].shot!.type));
  expect(clips[0].end).toBe(clips[0].move + clips[0].trajectory!.duration);
  expect(clips[1].move).toBeGreaterThan(0);
  expect(clips[1].move).toBeLessThanOrEqual(Math.max(0.65, strokePreparation(next.shot!.type) * 0.75));
  expect(clips[1].start).toBe(clips[0].end);
  expect(
    interpolatePlayers(s.steps[0].players, next.players, 0.5).find(
      (p) => p.id === "A1",
    )!.x,
  ).toBe(0);
  expect(interpolatePlayers(s.steps[0].players, next.players, 2)).toEqual(
    next.players,
  );
});

it("rejects a zero-duration ground shot before importing", () => {
  const s = initialScenario();
  s.steps[0].shot!.from.y = 0.037;
  s.steps[0].shot!.apex = 0.037;
  expect(() => validateScenario(s)).toThrow("Thông số");
});

it("saves finisher choice and accepts older shots without it", () => {
  const s = initialScenario();
  s.steps[0].shot!.finish = true;
  expect(decodeScenario(encodeScenario(s)).steps[0].shot!.finish).toBe(true);
  delete s.steps[0].shot!.finish;
  expect(parseScenario(JSON.stringify(s)).steps[0].shot!.finish).toBe(false);
  expect(() =>
    validateScenario({
      ...s,
      steps: [{ ...s.steps[0], shot: { ...s.steps[0].shot, finish: "yes" } }],
    }),
  ).toThrow();
});

it("swaps legacy teammate identities once while retaining authored ball paths", async () => {
  const { migratePlayerLayout } = await import("../src/core/scenario");
  const old = initialScenario();
  delete old.playerLayout;
  const original = structuredClone(old),
    converted = migratePlayerLayout(old);
  expect(converted.steps[0].players.find((p) => p.id === "A1")!.x).toBe(
    original.steps[0].players.find((p) => p.id === "A2")!.x,
  );
  expect(converted.steps[0].players.find((p) => p.id === "B1")!.x).toBe(
    original.steps[0].players.find((p) => p.id === "B2")!.x,
  );
  expect(converted.steps[0].shot!.hitter).toBe("A1");
  expect(converted.steps[0].shot!.from).toEqual(original.steps[0].shot!.from);
  expect(migratePlayerLayout(parseScenario(JSON.stringify(converted)))).toEqual(
    converted,
  );
  expect(old).toEqual(original);
});
