import { COURT, inCourt, inKitchen, netHeight } from "./constants";
import type { Point3, Shot } from "./scenario";
import {
  SPIN_TYPES,
  shotSpin,
  predictRestitution,
  horizontal,
  speed,
  travel,
  forcedTravel,
  planeCrossings,
} from "./spin";
export interface Trajectory {
  duration: number;
  flightTime: number;
  points: Point3[];
  landing: Point3;
  result: "OK" | "NET" | "OUT";
  kitchen: boolean;
  warnings: string[];
  netClearance: number | null;
  collisionTime: number | null;
  spinAxis: Point3;
  spinSpeed: number;
  spinAngle: (time: number) => number;
  bounceHeight: number;
  restitution: number;
  bounceOut: boolean;
  bouncePoints: Point3[];
  at: (time: number) => Point3;
}
export function trajectory(shot: Shot): Trajectory {
  const { gravity: g, ballRadius: r } = COURT;
  const spin = shotSpin(shot);
  let restitution = shot.bounce ?? 0.7;
  if (
    ![
      shot.from.x,
      shot.from.y,
      shot.from.z,
      shot.to.x,
      shot.to.z,
      shot.apex,
    ].every(Number.isFinite) ||
    shot.from.y < r ||
    shot.apex < Math.max(shot.from.y, r)
  )
    throw new Error("Đỉnh quỹ đạo phải cao hơn điểm đánh và điểm rơi.");
  if (
    !SPIN_TYPES.includes(spin.type) ||
    !Number.isFinite(spin.strength) ||
    spin.strength < 0 ||
    spin.strength > 1 ||
    !Number.isFinite(restitution) ||
    restitution < 0 ||
    restitution > 0.95
  )
    throw new Error("Spin hoặc độ nảy không hợp lệ.");
  const strength = spin.type === "none" ? 0 : spin.strength;
  const dx = shot.to.x - shot.from.x,
    dz = shot.to.z - shot.from.z,
    dist = Math.hypot(dx, dz);
  const hx = dist > 1e-8 ? dx / dist : 0,
    hz = dist > 1e-8 ? dz / dist : 1;
  const side = spin.type === "left" ? 1 : spin.type === "right" ? -1 : 0;
  const vertical = spin.type === "top" ? 1 : spin.type === "back" ? -0.8 : 0;
  // Frozen-heading Magnus approximation: lift/downforce, lateral force and
  // linear horizontal drag. Coefficients are illustrative, not measured RPM.
  const effectiveG = g * (1 + 0.22 * vertical * strength),
    drag = 0.3 * strength;
  const ax = -hz * side * 4.5 * strength,
    az = hx * side * 4.5 * strength;
  const vy = Math.sqrt(2 * effectiveG * (shot.apex - shot.from.y));
  const T = vy / effectiveG + Math.sqrt((2 * (shot.apex - r)) / effectiveG);
  if (T <= 0) throw new Error("Cú đánh phải có thời gian bay lớn hơn 0.");
  const vx = (dx - ax * forcedTravel(T, drag)) / travel(T, drag),
    vz = (dz - az * forcedTravel(T, drag)) / travel(T, drag);
  const flight = (t: number): Point3 => ({
    x: horizontal(shot.from.x, vx, ax, drag, t),
    y: shot.from.y + vy * t - (effectiveG * t * t) / 2,
    z: horizontal(shot.from.z, vz, az, drag, t),
  });
  if (shot.autoBounce === true || shot.bounce === undefined) {
    const impact = Math.hypot(
      speed(vx, ax, drag, T),
      vy - effectiveG * T,
      speed(vz, az, drag, T),
    );
    restitution = predictRestitution(
      shot.type,
      impact,
      spin.type === "top" ? strength : 0,
    );
  }
  let collisionTime: number | null = null,
    netClearance: number | null = null;
  const crossings = planeCrossings(shot.from.z, vz, az, drag, T);
  if (
    Math.abs(shot.from.z) < r &&
    Math.abs(shot.from.x) <= COURT.netHalfWidth &&
    shot.from.y <= netHeight(shot.from.x) + r
  )
    crossings.unshift(0);
  for (const t of crossings) {
    const p = flight(t);
    if (Math.abs(p.x) <= COURT.netHalfWidth + r) {
      const clearance = p.y - netHeight(p.x) - r;
      netClearance =
        netClearance === null ? clearance : Math.min(netClearance, clearance);
      if (clearance <= 0) {
        collisionTime = t;
        break;
      }
    }
  }
  const kitchen = inKitchen(shot.to.x, shot.to.z);
  const result =
    collisionTime !== null
      ? "NET"
      : !inCourt(shot.to.x, shot.to.z)
        ? "OUT"
        : "OK";
  const warnings: string[] = [];
  if (shot.type === "serve" && kitchen)
    warnings.push("Giao bóng rơi vào kitchen là lỗi.");
  if (shot.volley && inKitchen(shot.from.x, shot.from.z))
    warnings.push("Volley từ kitchen: kiểm tra lỗi non-volley zone.");
  if (shot.from.z * shot.to.z >= 0)
    warnings.push("Điểm rơi đang cùng phía với điểm đánh.");
  const end = collisionTime ?? T,
    contact = flight(end);
  const segments: {
    start: number;
    end: number;
    from: Point3;
    vx: number;
    vz: number;
    vy: number;
    ax: number;
    az: number;
    drag: number;
  }[] = [];
  let duration = end,
    bounceHeight =
      collisionTime === null
        ? ((vy - effectiveG * T) * restitution) ** 2 / (2 * g)
        : 0;
  if (collisionTime !== null) {
    const fall = Math.sqrt((2 * Math.max(0, contact.y - r)) / g);
    segments.push({
      start: end,
      end: end + fall,
      from: contact,
      vx: 0,
      vz: 0,
      vy: 0,
      ax: 0,
      az: 0,
      drag: 0,
    });
    duration += fall;
  } else if (shot.finish) {
    let bounceVy = -(vy - effectiveG * T) * restitution;
    const friction =
      0.8 +
      (spin.type === "top"
        ? 0.2 * strength
        : spin.type === "back"
          ? -0.35 * strength
          : 0);
    let bx = speed(vx, ax, drag, T) * friction - hz * side * 0.8 * strength;
    let bz = speed(vz, az, drag, T) * friction + hx * side * 0.8 * strength;
    let origin: Point3 = { x: shot.to.x, y: r, z: shot.to.z },
      remainingSpin = strength * 0.68;
    bounceHeight = (bounceVy * bounceVy) / (2 * g);
    while (bounceVy >= 0.5 && segments.length < 80) {
      const length = (2 * bounceVy) / g,
        bd = 0.3 * remainingSpin,
        bax = -hz * side * 4.5 * remainingSpin,
        baz = hx * side * 4.5 * remainingSpin;
      segments.push({
        start: duration,
        end: duration + length,
        from: origin,
        vx: bx,
        vz: bz,
        vy: bounceVy,
        ax: bax,
        az: baz,
        drag: bd,
      });
      duration += length;
      origin = {
        x: horizontal(origin.x, bx, bax, bd, length),
        y: r,
        z: horizontal(origin.z, bz, baz, bd, length),
      };
      bx = speed(bx, bax, bd, length) * 0.8;
      bz = speed(bz, baz, bd, length) * 0.8;
      bounceVy *= restitution;
      remainingSpin *= 0.68;
    }
  }
  const landing = { x: shot.to.x, y: r, z: shot.to.z };
  const at = (time: number): Point3 => {
    const t = Math.max(0, Math.min(time, duration));
    if (
      collisionTime === null &&
      ((!shot.finish && t >= T) || Math.abs(t - T) < 1e-10)
    )
      return { ...landing };
    if (t <= end) return flight(t);
    const seg = segments.find((s) => t <= s.end) ?? segments.at(-1);
    if (!seg) return { ...landing };
    const u = Math.max(0, Math.min(t - seg.start, seg.end - seg.start));
    return {
      x: horizontal(seg.from.x, seg.vx, seg.ax, seg.drag, u),
      y: Math.max(r, seg.from.y + seg.vy * u - (g * u * u) / 2),
      z: horizontal(seg.from.z, seg.vz, seg.az, seg.drag, u),
    };
  };
  const bouncePoints =
    collisionTime === null && shot.finish && duration > T
      ? Array.from({ length: 161 }, (_, i) =>
          at(T + ((duration - T) * i) / 160),
        )
      : [];
  const bounceOut =
    collisionTime === null &&
    !!shot.finish &&
    segments.some((seg) => {
      const length = seg.end - seg.start;
      const cuts = [0, length];
      for (const bound of [-COURT.halfWidth, COURT.halfWidth])
        cuts.push(
          ...planeCrossings(
            seg.from.x - bound,
            seg.vx,
            seg.ax,
            seg.drag,
            length,
          ),
        );
      for (const bound of [-COURT.halfLength, COURT.halfLength])
        cuts.push(
          ...planeCrossings(
            seg.from.z - bound,
            seg.vz,
            seg.az,
            seg.drag,
            length,
          ),
        );
      cuts.sort((a, b) => a - b);
      return cuts.some((t, i) => {
        const u = i < cuts.length - 1 ? (t + cuts[i + 1]) / 2 : t;
        return !inCourt(
          horizontal(seg.from.x, seg.vx, seg.ax, seg.drag, u),
          horizontal(seg.from.z, seg.vz, seg.az, seg.drag, u),
        );
      });
    });
  const points = Array.from({ length: 101 }, (_, i) => flight((end * i) / 100));
  const spinAxis =
    spin.type === "top"
      ? { x: hz, y: 0, z: -hx }
      : spin.type === "back"
        ? { x: -hz, y: 0, z: hx }
        : side
          ? { x: 0, y: -side, z: 0 }
          : { x: 1, y: 0, z: 0 };
  return {
    duration,
    flightTime: T,
    points,
    landing,
    result,
    kitchen,
    warnings,
    netClearance,
    collisionTime,
    spinAxis,
    spinSpeed: strength * 36,
    spinAngle: (time: number) => {
      const t = Math.max(0, Math.min(time, duration));
      let angle = Math.min(t, end) * strength * 36;
      segments.forEach((segment, i) => {
        angle +=
          Math.max(
            0,
            Math.min(t - segment.start, segment.end - segment.start),
          ) *
          strength *
          36 *
          0.68 ** (i + 1);
      });
      return angle;
    },
    bounceHeight,
    restitution,
    bounceOut,
    bouncePoints,
    at,
  };
}
