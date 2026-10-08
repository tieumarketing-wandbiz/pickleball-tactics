import type { Player, Shot } from "./scenario";
import { strokeSide } from "./contact";
import { sampleStroke } from "./stroke-motion";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
export function playerPose(
  player: Player,
  shot?: Shot,
  time?: number,
  preparation?: number,
) {
  const baseYaw = player.id.startsWith("A") ? 0 : Math.PI,
    active = shot?.hitter === player.id;
  const type = active && shot ? shot.type : "volley";
  const motion = sampleStroke(type, time ?? 0, preparation),
    profile = motion.profile;
  let dx = active && shot ? shot.to.x - shot.from.x : -Math.sin(baseYaw),
    dz = active && shot ? shot.to.z - shot.from.z : -Math.cos(baseYaw);
  const length = Math.hypot(dx, dz);
  if (length < 0.001) {
    dx = -Math.sin(baseYaw);
    dz = -Math.cos(baseYaw);
  } else {
    dx /= length;
    dz /= length;
  }
  const aimYaw = Math.atan2(-dx, -dz),
    stanceYaw = baseYaw + angle(aimYaw - baseYaw) * (active ? profile.turn : 0);
  const rightX = Math.cos(stanceYaw),
    rightZ = -Math.sin(stanceYaw),
    forwardX = -Math.sin(stanceYaw),
    forwardZ = -Math.cos(stanceYaw);
  const cx = active && shot ? shot.from.x - player.x : 0,
    cz = active && shot ? shot.from.z - player.z : 0,
    height = active && shot ? shot.from.y : 1;
  const hand = player.hand === "left" ? -1 : 1,
    kind = active && shot ? strokeSide(player, shot).kind : "center";
  const side = kind === "backhand" ? -hand : hand;
  const low = active ? clamp((0.85 - height) / 0.75, 0, 1) : 0,
    effort = active ? 1 - motion.recovery : 0;
  const lateral = cx * rightX + cz * rightZ,
    ahead = cx * forwardX + cz * forwardZ;
  const lateralLean =
    clamp(
      lateral * 0.24 +
        (active && type === "atp"
          ? Math.sign(lateral || player.x * rightX) * 0.09
          : 0),
      -0.32,
      0.32,
    ) * effort;
  const forwardLean = active
    ? clamp(
        profile.lean +
          ahead * 0.12 +
          motion.follow * 0.13 -
          motion.loading * 0.05,
        -0.18,
        0.3,
      ) * effort
    : 0.04;
  const squat = active
    ? (profile.squat + low * 0.13) * (1 - motion.recovery)
    : 0.08;
  const hipY = 0.72 - squat;
  const weight = active
    ? motion.weight - 0.12 * effort * (1 - clamp(ahead / 0.35, 0, 1))
    : 0;
  const hipX =
      rightX * lateralLean * 0.28 +
      forwardX * (forwardLean * 0.24 - 0.06 + weight),
    hipZ =
      rightZ * lateralLean * 0.28 +
      forwardZ * (forwardLean * 0.24 - 0.06 + weight);
  const [along, across, lift] = motion.offset;
  // Across-body finish reverses naturally for a backhand and for left-handed players.
  const lateralX = -dz * side,
    lateralZ = dx * side;
  let paddleX = cx + dx * along + lateralX * across,
    paddleY = height + lift,
    paddleZ = cz + dz * along + lateralZ * across;
  const ready = { x: forwardX * 0.42, y: 1.12, z: forwardZ * 0.42 };
  if (!active) {
    paddleX = ready.x;
    paddleY = ready.y;
    paddleZ = ready.z;
  } else if (motion.recovery || motion.ready) {
    const u = Math.max(motion.recovery, motion.ready);
    paddleX += (ready.x - paddleX) * u;
    paddleY += (ready.y - paddleY) * u;
    paddleZ += (ready.z - paddleZ) * u;
  }
  const twoHanded =
    kind === "backhand" &&
    ["drive", "drop", "lob", "speedup", "roll", "flick", "reset"].includes(
      type,
    ) &&
    motion.recovery < 0.7;
  return {
    active,
    stanceYaw,
    yaw: stanceYaw - (active ? side * motion.twist : 0),
    hipYaw: stanceYaw - (active ? side * motion.hipTwist : 0),
    pitch: -forwardLean,
    roll: -lateralLean,
    hip: { x: hipX, y: hipY, z: hipZ },
    stanceWidth: 0.4 + low * 0.14 + (active && type === "atp" ? 0.12 : 0),
    stagger: active ? profile.twist * 0.22 : 0,
    forward: { x: forwardX, z: forwardZ },
    right: { x: rightX, z: rightZ },
    paddle: { x: paddleX, y: Math.max(0.09, paddleY), z: paddleZ },
    paddleYaw: aimYaw + Math.PI + (active ? side * motion.faceYaw : 0),
    paddleRoll: active
      ? ((height < 0.35
          ? side * Math.PI
          : height < 1.1
            ? side * (Math.PI / 2 + 0.3 * clamp((0.7 - height) / 0.4, -1, 1))
            : 0) -
          side * motion.follow * profile.wrist * 0.35) *
        (1 - motion.recovery)
      : 0.15 * hand,
    paddlePitch: height < 0.25 ? -0.95 : active ? motion.facePitch : 0,
    twoHanded,
    loading: motion.loading,
    follow: motion.follow,
    recovery: motion.recovery,
    hop: active ? motion.hop : 0,
    elbowOut:
      active && type === "smash"
        ? 0.75
        : active && ["drive", "serve"].includes(type)
          ? 0.38
          : 0.12,
    track: active ? clamp((height - 1.4) * 0.25, -0.25, 0.22) : 0,
  };
}
