import type { Scenario, Player, Point3, Shot } from "./scenario";
import { trajectory, type Trajectory } from "./trajectory";
import { COURT, netHeight } from "./constants";
import { findVolleyContact, syncVolleyContacts } from "./contact";
import { strokePreparation, STROKE_MOTION } from "./stroke-motion";
export interface Clip {
  index: number;
  start: number;
  move: number;
  end: number;
  trajectory?: Trajectory;
  handoff?: { from: Point3; to: Point3 };
  heldBall?: Point3;
  incoming?: { trajectory: Trajectory; fromTime: number; toTime: number };
  intercepted?: { point: Point3; time: number; receiver: string };
  shot?: Shot;
  startPlayers?: Player[];
  receivingPlayers?: Player[];
  previousMotion?: { shot: Shot; contactClock: number; preparation: number };
}
function trimFlight(tr: Trajectory, time: number): Trajectory {
  return {
    ...tr,
    duration: time,
    landing: tr.at(time),
    bounceHeight: 0,
    flightTime: Math.min(time, tr.flightTime),
    points: Array.from({ length: 101 }, (_, i) => tr.at((time * i) / 100)),
    bouncePoints: [],
    bounceOut: false,
    kitchen: false,
    result: "OK",
    collisionTime: null,
    at: (t) => tr.at(Math.max(0, Math.min(time, t))),
    spinAngle: (t) => tr.spinAngle(Math.max(0, Math.min(time, t))),
  };
}
export function buildClips(s: Scenario, first = 0): Clip[] {
  const resolved = structuredClone(s);
  syncVolleyContacts(resolved);
  const steps = resolved.steps.slice(first);
  const interceptions = steps.map((step, i) =>
    i > 0 && step.shot?.volley && steps[i - 1].shot
      ? findVolleyContact(
          steps[i - 1].shot!,
          step.players.find((p) => p.id === step.shot!.hitter)!,
        )
      : undefined,
  );
  const receiveTimes = interceptions.map((hit, i) =>
    hit
      ? Math.min(strokePreparation(steps[i].shot!.type) * 0.75, hit.time * 0.45)
      : 0,
  );
  let clock = 0,
    previousBall: Point3 | undefined;
  const clips = steps.map((step, i) => {
    const full = step.shot ? trajectory(step.shot) : undefined;
    const nextHit = interceptions[i + 1];
    const tr =
      full && nextHit
        ? trimFlight(full, nextHit.time - receiveTimes[i + 1])
        : full;
    const hit = interceptions[i];
    // The receiver prepares during the final part of the ORIGINAL incoming flight.
    const incoming = hit
      ? {
          trajectory: hit.incoming,
          fromTime: hit.time - receiveTimes[i],
          toTime: hit.time,
        }
      : undefined;
    const handoff =
      !incoming && previousBall && step.shot
        ? { from: { ...previousBall }, to: { ...step.shot.from } }
        : undefined;
    const distance = handoff
      ? Math.hypot(
          handoff.to.x - handoff.from.x,
          handoff.to.y - handoff.from.y,
          handoff.to.z - handoff.from.z,
        )
      : 0;
    const move = incoming
      ? receiveTimes[i]
      : i === 0
        ? step.shot
          ? strokePreparation(step.shot.type)
          : 0
        : handoff
          ? Math.max(
              step.shot ? strokePreparation(step.shot.type) * 0.75 : 0.12,
              Math.min(0.65, distance / 10),
            )
          : tr
            ? 0
            : 0.8;
    const clip: Clip = {
      index: first + i,
      start: clock,
      move,
      end: clock + move + (tr?.duration ?? 0),
      trajectory: tr,
      incoming,
      handoff,
      shot: step.shot,
      receivingPlayers: nextHit ? steps[i + 1].players : undefined,
      intercepted: nextHit
        ? {
            point: nextHit.point,
            time: nextHit.time,
            receiver: steps[i + 1].shot!.hitter,
          }
        : undefined,
      heldBall: previousBall
        ? { ...previousBall }
        : step.shot
          ? { ...step.shot.from }
          : undefined,
    };
    if (tr) previousBall = tr.at(tr.duration);
    clock = clip.end;
    return clip;
  });
  let boundary = structuredClone(steps[0]?.players ?? []);
  clips.forEach((clip, i) => {
    clip.startPlayers = structuredClone(boundary);
    const previous = clips[i - 1];
    if (previous?.shot)
      clip.previousMotion = {
        shot: previous.shot,
        contactClock: previous.start + previous.move,
        preparation: previous.move,
      };
    boundary = sampleClipPlayers(
      boundary,
      steps[i].players,
      clip,
      clip.end - clip.start,
      clip.shot?.hitter,
    );
  });
  return clips;
}
// Editor and single-shot preview use the same effective endpoint as the rally.
// The receive-tail allocation is a timeline detail; a standalone shot reaches the catch itself.
export function buildPreviewClip(s: Scenario, index: number): Clip {
  const source = buildClips(s).find((c) => c.index === index);
  if (!source) throw new Error("Bước không tồn tại.");
  const full = source.shot ? trajectory(source.shot) : undefined;
  const tr =
    full && source.intercepted
      ? trimFlight(full, source.intercepted.time)
      : full;
  const move = source.shot ? strokePreparation(source.shot.type) : 0;
  return {
    ...source,
    start: 0,
    move,
    end:
      move +
      Math.max(
        tr?.duration ?? 0,
        source.shot ? STROKE_MOTION[source.shot.type].recover : 0,
      ),
    trajectory: tr,
    incoming: undefined,
    handoff: undefined,
    previousMotion: undefined,
    heldBall: source.shot ? { ...source.shot.from } : undefined,
    startPlayers: structuredClone(s.steps[index].players),
  };
}
export function sampleClipBall(clip: Clip, time: number): Point3 | undefined {
  const t = Math.max(0, Math.min(time, clip.end - clip.start));
  if (clip.incoming && t < clip.move)
    return clip.incoming.trajectory.at(clip.incoming.fromTime + t);
  if (clip.handoff && clip.move > 0 && t < clip.move) {
    const u = t / clip.move,
      v = 1 - u;
    const { from: a, to: b } = clip.handoff;
    let top = Math.max(a.y, b.y) + 0.25;
    // A receive animation crossing the net must visibly clear its finite span.
    const cross = b.z !== a.z ? -a.z / (b.z - a.z) : -1;
    if (cross > 0 && cross < 1) {
      const x = a.x + (b.x - a.x) * cross;
      if (Math.abs(x) <= COURT.netHalfWidth + COURT.ballRadius) {
        const height = netHeight(x) + COURT.ballRadius + 0.05;
        top = Math.max(
          top,
          (height - (1 - cross) ** 2 * a.y - cross ** 2 * b.y) /
            (2 * cross * (1 - cross)),
        );
      }
    }
    return {
      x: a.x + (b.x - a.x) * u,
      z: a.z + (b.z - a.z) * u,
      y: v * v * a.y + 2 * v * u * top + u * u * b.y,
    };
  }
  if (t < clip.move && !clip.handoff) return clip.heldBall;
  return clip.trajectory?.at(t - clip.move) ?? clip.heldBall;
}
export function interpolatePlayers(
  from: Player[],
  to: Player[],
  alpha: number,
): Player[] {
  const t = Math.max(0, Math.min(1, alpha));
  return to.map((p) => {
    const prev = from.find((q) => q.id === p.id) ?? p;
    return {
      ...p,
      id: p.id,
      x: prev.x + (p.x - prev.x) * t,
      z: prev.z + (p.z - prev.z) * t,
    };
  });
}
export function sampleClipPlayers(
  from: Player[],
  to: Player[],
  clip: Clip,
  time: number,
  hitter?: string,
): Player[] {
  // The hitter reaches contact during reception; partners keep moving during flight.
  return to.map((p) => {
    const receiving =
      clip.intercepted?.receiver === p.id
        ? clip.receivingPlayers?.find((q) => q.id === p.id)
        : undefined;
    const duration = receiving
      ? clip.move + clip.intercepted!.time
      : p.id === hitter
        ? clip.move
        : clip.end - clip.start;
    const u = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 1;
    const smooth = u * u * (3 - 2 * u);
    const prev = from.find((q) => q.id === p.id) ?? p;
    return {
      ...p,
      id: p.id,
      x: prev.x + ((receiving ?? p).x - prev.x) * smooth,
      z: prev.z + ((receiving ?? p).z - prev.z) * smooth,
    };
  });
}
