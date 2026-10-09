import type { Player, Shot } from "./scenario";
import { strokeSide } from "./contact";
import { sampleStroke, samplePaddlePath, strokePreparation } from "./stroke-motion";
import { ease, softClamp } from "./motion";
import { COURT, VOLLEY_TYPES } from "./constants";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = ease;
/** Contact distance ahead of the body the arm comfortably reaches (shots without their own). */
const DEFAULT_REACH = 0.32;
/** Ready paddle face centre relative to the player marker (forward, to the dominant side, up). */
export const READY_PADDLE = { ahead: 0.4, side: 0.07, height: 1.3 };
/** Ready stance elbow flare: elbows clearly off the ribs (animation-principles.md §3). */
const READY_ELBOW_OUT = 1;
/** Distance from the ankle joint to the shoe tip along the foot. */
export const TOE_REACH = 0.14;
/**
 * Ready stance from the guide video. At the kitchen: knees bent, torso ~18° forward,
 * pelvis −9 cm, stance ~1.3× shoulder width, paddle head up ~65°, off hand on the throat.
 * Further back (serving/returning team at the baseline) the same stance is a little taller.
 */
export function readyStance(player: Player) {
  const kitchen = 1 - smooth((Math.abs(player.z) - 3) / 1.2);
  return {
    squat: mix(0.06, 0.09, kitchen),
    lean: mix(0.14, 0.32, kitchen),
    width: mix(0.48, 0.56, kitchen),
    paddleRoll: -0.6 * (player.hand === "left" ? -1 : 1),
  };
}
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
  const ready = readyStance(player);
  // 0 = fully in the stroke, 1 = fully in the shared ready stance (start of preparation / recovered).
  // Every stroke, including the serve, has the same position AND velocity at the ready seam.
  // The body is set by the load key (feet planted from the load to the settle); the recovery
  // channel overshoots ready by a few percent and comes back (tennis-frames.md §3.3).
  const readiness = active ? Math.max(motion.recovery, motion.ready) : 1;
  const engaged = 1 - readiness;
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
  const hand = player.hand === "left" ? -1 : 1,
    kind = active && shot ? strokeSide(player, shot).kind : "center";
  const side = kind === "backhand" ? -hand : hand;
  const aimYaw = Math.atan2(-dx, -dz);
  // Stance the stroke turns into (side-on for the overhead), eased in from / out to the ready stance.
  const shotYaw = active
    ? baseYaw +
      angle(aimYaw - baseYaw) * profile.turn -
      side * (profile.sideOn ?? 0)
    : baseYaw;
  const stanceYaw = baseYaw + angle(shotYaw - baseYaw) * engaged;
  const rightX = Math.cos(stanceYaw),
    rightZ = -Math.sin(stanceYaw),
    forwardX = -Math.sin(stanceYaw),
    forwardZ = -Math.cos(stanceYaw);
  const cx = active && shot ? shot.from.x - player.x : 0,
    cz = active && shot ? shot.from.z - player.z : 0,
    height = active && shot ? shot.from.y : 1;
  const low = active ? clamp((0.85 - height) / 0.75, 0, 1) : 0,
    effort = active ? engaged : 0;
  // Step the body back (and for the serve, sideways) so the contact lands in front of the
  // body as in the video, instead of inside it when the contact sits on the player marker.
  const shotRight = { x: Math.cos(shotYaw), z: -Math.sin(shotYaw) },
    shotForward = { x: -Math.sin(shotYaw), z: -Math.cos(shotYaw) };
  const ahead0 = cx * shotForward.x + cz * shotForward.z,
    lateral0 = cx * shotRight.x + cz * shotRight.z;
  // Step so the contact lands where the arm can reach it (in front of the lead foot / chest, on
  // the hitting side): back if the ball is inside the body, toward it if it is out of reach.
  let shiftAhead = 0,
    shiftSide = 0;
  if (active) {
    shiftAhead = ahead0 - (profile.reach ?? DEFAULT_REACH);
    shiftSide = lateral0 - (profile.side !== undefined ? hand : side) * (profile.side ?? 0.3);
    const limit = profile.setup ? 0.7 : 0.45,
      length = Math.hypot(shiftAhead, shiftSide);
    if (length > limit) {
      shiftAhead *= limit / length;
      shiftSide *= limit / length;
    }
  }
  const shift = {
    x: shotForward.x * shiftAhead + shotRight.x * shiftSide,
    z: shotForward.z * shiftAhead + shotRight.z * shiftSide,
  };
  const bodyShift = active ? engaged : 0;
  const lateral = (cx - shift.x) * rightX + (cz - shift.z) * rightZ,
    ahead = (cx - shift.x) * forwardX + (cz - shift.z) * forwardZ;
  const lateralLean =
    softClamp(
      lateral * 0.24 +
        (active && type === "atp"
          ? Math.sign(lateral || player.x * rightX) * 0.09
          : 0) +
        side * (profile.dip ?? 0) * (1 - motion.loading) * (1 - motion.follow),
      -0.32,
      0.32,
      0.04,
    ) * engaged;
  const shotLean = softClamp(
    profile.lean + ahead * 0.12 + motion.follow * 0.13 - motion.loading * 0.05,
    -0.18,
    Math.max(0.3, profile.lean + 0.15),
    0.03,
  );
  const forwardLean = mix(shotLean, ready.lean, readiness);
  const shotSquat = profile.squat + low * (profile.low ?? 0.38) + motion.squat;
  const squat = mix(shotSquat, ready.squat, readiness);
  const weight = active
    ? motion.weight - 0.12 * effort * (1 - softClamp(ahead / 0.35, 0, 1, 0.08))
    : 0;
  const hipForward =
    softClamp(forwardLean, -0.5, 0.3, 0.025) * 0.24 -
    0.06 +
    weight -
    (profile.sit ?? 0) * shotSquat * engaged;
  const hipX =
      rightX * lateralLean * 0.28 + forwardX * hipForward + shift.x * bodyShift,
    hipZ =
      rightZ * lateralLean * 0.28 + forwardZ * hipForward + shift.z * bodyShift;
  const width = mix(
    profile.width ?? 0.4 + low * 0.14 + (active && type === "atp" ? 0.12 : 0),
    ready.width,
    readiness,
  );
  const stagger = active
    ? profile.stagger !== undefined
      ? hand * profile.stagger * bodyShift
      : profile.twist * 0.22 * engaged
    : 0;
  // Each foot steps with the body shift; the dominant (rear) foot leads the recovery step.
  const shiftLength = Math.hypot(shift.x, shift.z);
  // C1 step bump: zero height and zero slope at both ends, so the settle overshoot
  // (readiness > 1) cannot push a shoe through the floor.
  const bump = (g: number) => 4 * smooth(g) * smooth(1 - g);
  const foot = (sign: -1 | 1) => {
    const g = bodyShift;
    return {
      x:
        rightX * ((sign * width) / 2) + forwardX * sign * stagger + shift.x * g,
      z:
        rightZ * ((sign * width) / 2) + forwardZ * sign * stagger + shift.z * g,
      lift: bump(g) * 0.025 * Math.min(1, shiftLength / 0.2),
    };
  };
  const feet = { L: foot(-1), R: foot(1) };
  // Volleys/overheads: no foot on or over the kitchen line (rules), so pull both feet back.
  if (
    active &&
    shot &&
    (shot.volley || VOLLEY_TYPES.has(type)) &&
    Math.abs(player.z) > COURT.kitchen
  ) {
    const courtSide = Math.sign(player.z);
    let deficit = 0;
    for (const f of [feet.L, feet.R]) {
      const toe = player.z + f.z + forwardZ * TOE_REACH;
      const d = COURT.kitchen + 0.01 - courtSide * toe;
      deficit = (deficit + d + Math.hypot(deficit - d, 0.012)) / 2;
    }
    if (deficit > 0)
      for (const f of [feet.L, feet.R]) f.z += courtSide * deficit;
  }
  // One authored path includes ready, load, impact, finish and settle. Never crossfade an
  // already moving paddle a second time: that changes spacing and adds recovery acceleration.
  const lateralX = -dz * side, lateralZ = dx * side;
  const readyPaddle = {
    x: -Math.sin(baseYaw) * READY_PADDLE.ahead + Math.cos(baseYaw) * hand * READY_PADDLE.side,
    y: READY_PADDLE.height,
    z: -Math.cos(baseYaw) * READY_PADDLE.ahead - Math.sin(baseYaw) * hand * READY_PADDLE.side,
  };
  const rx = readyPaddle.x - cx, rz = readyPaddle.z - cz;
  const [along, across, lift] = samplePaddlePath(type, time ?? 0,
    preparation ?? strokePreparation(type),
    [rx * dx + rz * dz, rx * lateralX + rz * lateralZ, readyPaddle.y - height]);
  const paddleX = active ? cx + dx * along + lateralX * across : readyPaddle.x,
    paddleY = active ? height + lift : readyPaddle.y,
    paddleZ = active ? cz + dz * along + lateralZ * across : readyPaddle.z;
  const twoHanded =
    kind === "backhand" &&
    ["drive", "drop", "lob", "speedup", "roll", "flick", "reset"].includes(
      type,
    );
  // Paddle face: head hangs below the wrist for serve/dink and cocks back behind the head while
  // loading an overhead.
  let shotRoll =
    height < 0.35
      ? side * Math.PI
      : height < 1.1
        ? side * (Math.PI / 2 + 0.3 * clamp((0.7 - height) / 0.4, -1, 1))
        : 0;
  if (profile.headUp)
    // A low lifting contact still keeps the wrist above the face centre; "head up" is
    // a finish cue, not a reason to put the wrist below the knee during anticipation.
    shotRoll = mix(height < 0.95 ? side * (Math.PI / 2 + 0.35 + 0.6 * clamp((0.95 - height) / 0.5, 0, 1)) : -side * 0.35,
      -side * 0.35, motion.follow);
  shotRoll = mix(shotRoll, side * (Math.PI - 0.45), profile.headDown ?? 0);
  shotRoll -= side * motion.follow * profile.wrist * 0.35;
  let shotPitch =
    height < 0.25
      ? -0.95
      : motion.facePitch - (profile.cock ?? 0) * motion.loading;
  // Serve finish: the paddle keeps swinging in the stroke plane, head down -> forward -> up, so
  // the face ends up looking back over the server's head (as in the video's high finish).
  if (type === "serve") shotPitch = mix(shotPitch, -2.8, motion.follow);
  // Backhands: extra unit turn so the hitting shoulder leads and the arm doesn't cross the chest.
  // (Two-handed backhands are held square by the support arm.)
  const unitTurn = kind === "backhand" && !twoHanded ? 0.4 * engaged : 0;
  const idleYaw = baseYaw + Math.PI,
    shotPaddleYaw = aimYaw + Math.PI + (active ? side * motion.faceYaw : 0);
  return {
    active,
    readiness,
    stanceYaw,
    yaw: stanceYaw - (active ? side * (motion.twist + unitTurn) : 0)
      + (active && type === "drive" && kind !== "backhand" ? side * 0.35 * motion.follow * engaged : 0),
    hipYaw:
      stanceYaw - (active ? side * (motion.hipTwist + unitTurn * 0.5) : 0),
    pitch: -forwardLean,
    roll: -lateralLean,
    /** Pelvis target relative to the player marker; y + 0.23 = pelvis joint height. */
    hip: { x: hipX, y: 0.72 - squat, z: hipZ },
    /** Ankle targets relative to the player marker; lift = height above the 0.12 m rest. */
    feet,
    forward: { x: forwardX, z: forwardZ },
    right: { x: rightX, z: rightZ },
    paddle: { x: paddleX, y: softClamp(paddleY, 0.09, 20, 0.03), z: paddleZ },
    paddleYaw: active
      ? shotPaddleYaw + angle(idleYaw - shotPaddleYaw) * readiness
      : idleYaw,
    paddleRoll: active
      ? mix(shotRoll, ready.paddleRoll, readiness)
      : ready.paddleRoll,
    paddlePitch: active ? shotPitch * engaged : 0,
    twoHanded,
    supportWeight: twoHanded ? (1 - smooth(readiness)) : 0,
    loading: motion.loading,
    follow: motion.follow,
    recovery: motion.recovery,
    hop: active ? motion.hop : 0,
    elbowOut: mix(
      active && type === "smash"
        ? 0.75
        : active && ["drive", "serve"].includes(type)
          ? 0.38
          : 0.12,
      READY_ELBOW_OUT,
      readiness,
    ),
    track: active ? clamp((height - 1.4) * 0.25, -0.25, 0.22) * engaged : 0,
  };
}
