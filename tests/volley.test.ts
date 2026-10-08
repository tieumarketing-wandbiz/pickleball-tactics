import { it, expect } from "vitest";
import {
  findVolleyContact,
  receiveContact,
  syncVolleyContacts,
} from "../src/core/contact";
import { initialScenario, parseScenario } from "../src/core/scenario";
import { trajectory } from "../src/core/trajectory";
import {
  buildClips,
  buildPreviewClip,
  sampleClipBall,
  sampleClipPlayers,
} from "../src/core/playback";
const make = () => {
  const s = initialScenario(),
    first = s.steps[0];
  first.shot!.to = { x: -1.5, z: -5.7 };
  first.shot!.finish = true;
  const next = structuredClone(first);
  next.players.find((p) => p.id === "B1")!.z = -2.8;
  next.shot = {
    hitter: "B1",
    from: { x: -1.5, y: 0.8, z: -2.8 },
    to: { x: 1, z: 3 },
    type: "drive",
    apex: 1.1,
    volley: true,
    finish: false,
    topspin: false,
  };
  s.steps.push(next);
  return s;
};
it("intercepts the exact airborne curve on the receiving half before its first bounce", () => {
  const s = make(),
    shot = s.steps[0].shot!,
    p = s.steps[1].players.find((p) => p.id === "B1")!,
    hit = findVolleyContact(shot, p)!;
  expect(hit.time).toBeLessThan(trajectory(shot).flightTime);
  expect(hit.point).toEqual(hit.incoming.at(hit.time));
  expect(hit.point.z).toBeCloseTo(p.z, 5);
  expect(hit.point.y).toBeGreaterThan(0.2);
  expect(hit.reachable).toBe(true);
  expect(receiveContact(shot, p, "drive", 0.8, true)).toEqual(hit.point);
});
it("moving the receiver closer to the net catches the ball earlier", () => {
  const s = make(),
    shot = s.steps[0].shot!,
    p = s.steps[1].players.find((p) => p.id === "B1")!;
  const deep = findVolleyContact(shot, p)!,
    near = findVolleyContact(shot, { ...p, z: -1.2 })!;
  expect(near.time).toBeLessThan(deep.time);
  expect(near.point.z).toBeCloseTo(-1.2, 5);
});
it("continues the original flight during receiver preparation without bouncing or a connector arc", () => {
  const s = make(),
    clips = buildClips(s),
    a = clips[0],
    b = clips[1];
  expect(a.intercepted?.receiver).toBe("B1");
  expect(b.incoming).toBeDefined();
  expect(b.handoff).toBeUndefined();
  expect(a.trajectory!.bouncePoints).toHaveLength(0);
  const hit = findVolleyContact(
    s.steps[0].shot!,
    s.steps[1].players.find((p) => p.id === "B1")!,
  )!;
  expect(a.end + b.move - a.move).toBeCloseTo(hit.time, 8);
  expect(sampleClipBall(a, a.end)).toEqual(sampleClipBall(b, 0));
  for (const u of [0, 0.25, 0.5, 0.9])
    expect(sampleClipBall(b, b.move * u)).toEqual(
      hit.incoming.at(b.incoming!.fromTime + b.move * u),
    );
  expect(sampleClipBall(b, b.move)).toEqual(b.shot!.from);
});
it("recomputes chained origins and persists a stable contact and previous ground height", () => {
  const s = make();
  syncVolleyContacts(s);
  const snapshot = structuredClone(s);
  expect(s.steps[1].shot!.groundContactHeight).toBe(0.8);
  expect(s.steps[1].shot!.from.y).not.toBe(0.8);
  syncVolleyContacts(s);
  expect(s).toEqual(snapshot);
  const loaded = parseScenario(JSON.stringify(s));
  syncVolleyContacts(loaded);
  expect(loaded.steps[1].shot!.from).toEqual(snapshot.steps[1].shot!.from);
  expect(loaded.steps[1].shot!.groundContactHeight).toBe(0.8);
});
it("does not fabricate a volley after a net collision or on the sending team", () => {
  const s = make(),
    p = s.steps[1].players.find((p) => p.id === "B1")!;
  expect(
    findVolleyContact(
      {
        ...s.steps[0].shot!,
        from: { x: 0, y: 0.5, z: 4 },
        to: { x: 0, z: -4 },
        apex: 0.5,
      },
      p,
    ),
  ).toBeUndefined();
  expect(
    findVolleyContact(s.steps[0].shot!, { ...p, id: "A1" }),
  ).toBeUndefined();
});
it("keeps spin and ground-receive behavior separate from volley interception", () => {
  const s = make(),
    p = s.steps[1].players.find((p) => p.id === "B1")!,
    shot = { ...s.steps[0].shot!, topspin: true };
  const hit = findVolleyContact(shot, p)!;
  expect(hit.point).toEqual(
    trajectory({ ...shot, finish: false }).at(hit.time),
  );
  const bounce = receiveContact(shot, p, "drive", 0.8, false);
  expect(bounce.y).toBe(0.8);
  expect(bounce.z).toBeLessThan(-5);
});

it("positions the receiver during incoming flight and preserves player positions across the cut", () => {
  const s = make(),
    [a, b] = buildClips(s);
  const before = sampleClipPlayers(
    a.startPlayers!,
    s.steps[0].players,
    a,
    a.end - a.start,
    a.shot?.hitter,
  );
  const after = sampleClipPlayers(
    b.startPlayers!,
    s.steps[1].players,
    b,
    0,
    b.shot?.hitter,
  );
  expect(after).toEqual(before);
  const receiver = before.find((p) => p.id === "B1")!;
  expect(receiver.z).toBeGreaterThan(
    s.steps[0].players.find((p) => p.id === "B1")!.z,
  );
  expect(receiver.z).toBeLessThan(
    s.steps[1].players.find((p) => p.id === "B1")!.z,
  );
  expect(
    sampleClipPlayers(
      b.startPlayers!,
      s.steps[1].players,
      b,
      b.move,
      b.shot?.hitter,
    ).find((p) => p.id === "B1"),
  ).toEqual(s.steps[1].players.find((p) => p.id === "B1"));
});

it("ends a standalone intercepted shot in midair, including when finisher is enabled", () => {
  const s = make(),
    planned = structuredClone(s.steps[0].shot!.to),
    clip = buildPreviewClip(s, 0);
  const hit = findVolleyContact(
    s.steps[0].shot!,
    s.steps[1].players.find((p) => p.id === "B1")!,
  )!;
  expect(clip.trajectory!.duration).toBeCloseTo(hit.time, 8);
  expect(sampleClipBall(clip, clip.end)).toEqual(hit.point);
  expect(clip.trajectory!.points.at(-1)).toEqual(hit.point);
  expect(clip.trajectory!.landing).toEqual(hit.point);
  expect(clip.trajectory!.bouncePoints).toHaveLength(0);
  expect(s.steps[0].shot!.to).toEqual(planned);
});
it("starts the reply at the catch instead of replaying the incoming flight or visiting the old landing", () => {
  const s = make(),
    previous = buildPreviewClip(s, 0),
    reply = buildPreviewClip(s, 1);
  const caught = sampleClipBall(previous, previous.end)!;
  expect(reply.incoming).toBeUndefined();
  expect(reply.handoff).toBeUndefined();
  expect(sampleClipBall(reply, 0)).toEqual(caught);
  expect(sampleClipBall(reply, reply.move)).toEqual(caught);
  expect(sampleClipBall(reply, reply.move + 0.02)).not.toEqual(caught);
});
it("restores the original ground landing when the following volley is removed", () => {
  const s = make();
  s.steps[1].shot!.volley = false;
  const clip = buildPreviewClip(s, 0);
  expect(clip.intercepted).toBeUndefined();
  expect(clip.trajectory!.flightTime).toBe(
    trajectory(s.steps[0].shot!).flightTime,
  );
  expect(clip.trajectory!.bouncePoints.length).toBeGreaterThan(0);
});
