import {
  DEFAULT_HEIGHT,
  DEFAULT_APEX,
  VOLLEY_TYPES,
  shotOrigin,
} from "./constants";
import { trajectory } from "./trajectory";
import type { Player, Shot } from "./scenario";
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
) {
  if (!previous) return shotOrigin(player, type, height);
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
