import type { Scenario, Player, Point3 } from "./scenario";
import { trajectory, type Trajectory } from "./trajectory";
import { COURT, netHeight } from "./constants";
export interface Clip {
  index: number;
  start: number;
  move: number;
  end: number;
  trajectory?: Trajectory;
  handoff?: { from: Point3; to: Point3 };
  heldBall?: Point3;
}
export function buildClips(s: Scenario, first = 0): Clip[] {
  let clock = 0;
  let previousBall: Point3 | undefined;
  return s.steps.slice(first).map((step, i) => {
    const tr = step.shot ? trajectory(step.shot) : undefined;
    const to = step.shot?.from;
    const handoff =
      previousBall && to
        ? { from: { ...previousBall }, to: { ...to } }
        : undefined;
    const distance = handoff
      ? Math.hypot(
          handoff.to.x - handoff.from.x,
          handoff.to.y - handoff.from.y,
          handoff.to.z - handoff.from.z,
        )
      : 0;
    // A continuous illustrative receive/bounce joins independently authored shots.
    // It is presentation interpolation, not a physically validated extra shot.
    const move =
      i === 0
        ? 0
        : handoff
          ? Math.max(0.12, Math.min(0.65, distance / 10))
          : tr
            ? 0
            : 0.8;
    const clip: Clip = {
      index: first + i,
      start: clock,
      move,
      end: clock + move + (tr?.duration ?? 0),
      trajectory: tr,
      handoff,
      heldBall: previousBall ? { ...previousBall } : undefined,
    };
    if (tr) previousBall = tr.at(tr.duration);
    clock = clip.end;
    return clip;
  });
}
export function sampleClipBall(clip: Clip, time: number): Point3 | undefined {
  const t = Math.max(0, Math.min(time, clip.end - clip.start));
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
    const duration = p.id === hitter ? clip.move : clip.end - clip.start;
    const u = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 1;
    const smooth = u * u * (3 - 2 * u);
    const prev = from.find((q) => q.id === p.id) ?? p;
    return {
      ...p,
      id: p.id,
      x: prev.x + (p.x - prev.x) * smooth,
      z: prev.z + (p.z - prev.z) * smooth,
    };
  });
}
