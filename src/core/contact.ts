import {
  DEFAULT_HEIGHT,
  DEFAULT_APEX,
  VOLLEY_TYPES,
  shotOrigin,
  COURT,
} from "./constants";
import { trajectory } from "./trajectory";
import type { Player, Shot, Scenario } from "./scenario";
export function strokeSide(player: Player, shot: Shot) {
  // A faces -z, B faces +z. Right-hand side therefore reverses across the net.
  const facing = player.id.startsWith("A") ? -1 : 1;
  const relative =
    (shot.from.x - player.x) * -facing * (player.hand === "left" ? -1 : 1);
  const reach = Math.hypot(shot.from.x - player.x, shot.from.z - player.z);
  return {
    kind:
      Math.abs(relative) < 0.08
        ? "center"
        : relative > 0
          ? "forehand"
          : "backhand",
    reach,
    reachable: reach <= 1.1,
  } as const;
}
export function fitDink(shot: Shot) {
  if (shot.type !== "dink") return;
  const current = trajectory({ ...shot, finish: false });
  if (current.netClearance === null || current.netClearance >= 0.04) return;
  let low = Math.max(shot.apex, shot.from.y),
    high = 12;
  const clears = (apex: number) => {
    const tr = trajectory({ ...shot, apex, finish: false });
    return (
      tr.result !== "NET" &&
      (tr.netClearance === null || tr.netClearance >= 0.04)
    );
  };
  if (!clears(high)) return; // Keep the actual NET result for an impossible placement.
  for (let i = 0; i < 25; i++) {
    const mid = (low + high) / 2;
    if (clears(mid)) high = mid;
    else low = mid;
  }
  shot.apex = Math.ceil(high * 100) / 100;
}
export function nextRallyStep(
  previous: import("./scenario").Step,
  selected: string,
): import("./scenario").Step {
  const step = structuredClone(previous);
  const old = previous.shot;
  const sender =
    previous.players.find((p) => p.id === (old?.hitter ?? selected)) ??
    previous.players[0];
  const landing = old?.to ?? { x: sender.x, z: sender.z };
  const receiver = previous.players
    .filter((p) => p.id[0] !== sender.id[0])
    .sort(
      (a, b) =>
        Math.hypot(a.x - landing.x, a.z - landing.z) -
        Math.hypot(b.x - landing.x, b.z - landing.z),
    )[0];
  const type = old?.type === "serve" ? "drive" : (old?.type ?? "drive");
  const from = old
    ? { ...landing, y: DEFAULT_HEIGHT[type] }
    : shotOrigin(receiver, type, DEFAULT_HEIGHT[type]);
  step.note = "";
  step.shot = {
    hitter: receiver.id,
    from,
    to: { x: sender.x, z: sender.z },
    type,
    apex: Math.max(DEFAULT_APEX[type], from.y),
    volley: VOLLEY_TYPES.has(type),
    finish: false,
    contactFixed: !!old,
    topspin: old?.topspin ?? old?.spin?.type === "top",
    autoBounce: true,
  };
  fitDink(step.shot);
  return step;
}
export function receiveContact(
  previous: Shot | undefined,
  player: Player,
  type: Shot["type"],
  height: number,
  volley = false,
) {
  if (!previous) return shotOrigin(player, type, height);
  if (volley)
    return (
      findVolleyContact(previous, player)?.point ??
      shotOrigin(player, type, height)
    );
  const incoming = trajectory({ ...previous, finish: true, autoBounce: true });
  const start =
    incoming.collisionTime === null ? incoming.flightTime : incoming.duration;
  const end = Math.min(
    incoming.duration,
    start + 2 * Math.sqrt((2 * incoming.bounceHeight) / 9.81),
  );
  let best = incoming.at(start),
    distance = Infinity;
  for (let i = 0; i <= 100; i++) {
    const point = incoming.at(start + ((end - start) * i) / 100);
    const d = Math.hypot(point.x - player.x, point.z - player.z);
    if (d < distance) {
      distance = d;
      best = point;
    }
  }
  return { x: best.x, y: height, z: best.z };
}

export function findVolleyContact(previous: Shot, player: Player) {
  if (previous.hitter[0] === player.id[0]) return undefined;
  const incoming = trajectory({ ...previous, finish: false });
  const end =
    Math.min(incoming.flightTime, incoming.collisionTime ?? Infinity) - 0.0001;
  const ownSide = player.id.startsWith("A") ? 1 : -1;
  const cost = (time: number) => {
    const point = incoming.at(time);
    if (point.z * ownSide < COURT.ballRadius || point.y < 0.2 || point.y > 2.5)
      return Infinity;
    return (point.x - player.x) ** 2 + (point.z - player.z) ** 2;
  };
  if (end <= 0) return undefined;
  const count = 160;
  let time = 0,
    best = Infinity;
  for (let i = 1; i <= count; i++) {
    const t = (end * i) / count,
      d = cost(t);
    if (d < best) {
      time = t;
      best = d;
    }
  }
  if (!Number.isFinite(best)) return undefined;
  // Refine on the actual curve, independently of rendered samples or frame rate.
  let lo = Math.max(0, time - end / count),
    hi = Math.min(end, time + end / count);
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = hi - (hi - lo) * ratio,
    b = lo + (hi - lo) * ratio;
  for (let i = 0; i < 45; i++) {
    if (cost(a) < cost(b)) {
      hi = b;
      b = a;
      a = hi - (hi - lo) * ratio;
    } else {
      lo = a;
      a = b;
      b = lo + (hi - lo) * ratio;
    }
  }
  const refined = (lo + hi) / 2;
  if (cost(refined) < best) time = refined;
  const point = incoming.at(time),
    distance = Math.hypot(point.x - player.x, point.z - player.z);
  return { point, time, distance, reachable: distance <= 1.1, incoming };
}
export function syncVolleyContacts(scenario: Scenario) {
  for (let i = 1; i < scenario.steps.length; i++) {
    const shot = scenario.steps[i].shot,
      previous = scenario.steps[i - 1].shot;
    if (!shot?.volley || !previous) continue;
    const player = scenario.steps[i].players.find((p) => p.id === shot.hitter)!;
    const intercept = findVolleyContact(previous, player);
    if (!intercept) continue;
    shot.groundContactHeight ??= shot.from.y;
    shot.from = { ...intercept.point };
    shot.apex = Math.max(shot.apex, Math.ceil(shot.from.y * 100) / 100);
    fitDink(shot);
  }
}
