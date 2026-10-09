import { SPIN_TYPES, type Spin } from "./spin";
import {
  COURT,
  PLAYER_AREA,
  PLAYER_IDS,
  SHOT_TYPES,
  type PlayerId,
  type ShotType,
} from "./constants";
export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export interface Player {
  hand?: "right" | "left";
  id: PlayerId;
  x: number;
  z: number;
}
export interface Shot {
  hitter: PlayerId;
  from: Point3;
  to: { x: number; z: number };
  type: ShotType;
  apex: number;
  volley?: boolean;
  finish?: boolean;
  spin?: Spin;
  bounce?: number;
  topspin?: boolean;
  autoBounce?: boolean;
  contactFixed?: boolean;
  groundContactHeight?: number;
}
export interface Step {
  players: Player[];
  shot?: Shot;
  note?: string;
}
export interface Scenario {
  version: 1;
  playerLayout?: 2;
  name: string;
  steps: Step[];
}
export const clone = <T>(value: T): T => structuredClone(value);
export function initialScenario(): Scenario {
  return {
    version: 1,
    name: "Chiến thuật của tôi",
    playerLayout: 2,
    steps: [
      {
        players: [
          { id: "A1", x: 1.5, z: 4.9 },
          { id: "A2", x: -1.5, z: 4.9 },
          { id: "B1", x: -1.5, z: -4.9 },
          { id: "B2", x: 1.5, z: -4.9 },
        ],
        note: "",
        shot: {
          hitter: "A2",
          from: { x: -1.5, y: 0.6, z: 4.9 },
          to: { x: 1.5, z: -4.3 },
          type: "serve",
          apex: 1.5,
          volley: false,
          finish: false,
          spin: { type: "none", strength: 0 },
          bounce: 0.7,
          autoBounce: true,
        },
      },
    ],
  };
}
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
export function validateScenario(input: unknown): Scenario {
  if (!input || typeof input !== "object")
    throw new Error("JSON phải chứa một kịch bản.");
  const data = input as Record<string, unknown>;
  if (data.playerLayout !== undefined && data.playerLayout !== 2)
    throw new Error("Bố trí nhãn người chơi không hợp lệ.");
  if (data.version !== undefined && data.version !== 1)
    throw new Error("Phiên bản kịch bản chưa được hỗ trợ.");
  if (
    typeof data.name !== "string" ||
    data.name.length > 160 ||
    !Array.isArray(data.steps) ||
    !data.steps.length ||
    data.steps.length > 100
  )
    throw new Error("Cần tên kịch bản và từ 1 đến 100 bước.");
  for (const step of data.steps as Step[]) {
    if (
      !step ||
      !Array.isArray(step.players) ||
      step.players.length !== 4 ||
      new Set(step.players.map((p) => p?.id)).size !== 4
    )
      throw new Error("Mỗi bước cần đủ 4 người A1, A2, B1, B2.");
    for (const p of step.players)
      if (
        !p ||
        !PLAYER_IDS.includes(p.id) ||
        !finite(p.x) ||
        !finite(p.z) ||
        (p.hand !== undefined && p.hand !== "left" && p.hand !== "right") ||
        Math.abs(p.x) > PLAYER_AREA.halfWidth ||
        Math.abs(p.z) > PLAYER_AREA.halfLength
      )
        throw new Error("Vị trí người chơi không hợp lệ.");
    if (
      step.note !== undefined &&
      (typeof step.note !== "string" || step.note.length > 4000)
    )
      throw new Error("Ghi chú tối đa 4000 ký tự.");
    const s = step.shot;
    if (
      s &&
      (!PLAYER_IDS.includes(s.hitter) ||
        !SHOT_TYPES.includes(s.type) ||
        !s.from ||
        !s.to ||
        ![s.from.x, s.from.y, s.from.z, s.to.x, s.to.z, s.apex].every(finite) ||
        s.from.y < COURT.ballRadius ||
        s.from.y > 12 ||
        s.apex < Math.max(s.from.y, COURT.ballRadius) ||
        s.apex <= COURT.ballRadius ||
        s.apex > 12 ||
        Math.max(
          Math.abs(s.from.x),
          Math.abs(s.from.z),
          Math.abs(s.to.x),
          Math.abs(s.to.z),
        ) > 30 ||
        (s.volley !== undefined && typeof s.volley !== "boolean") ||
        (s.finish !== undefined && typeof s.finish !== "boolean") ||
        (s.topspin !== undefined && typeof s.topspin !== "boolean") ||
        (s.autoBounce !== undefined && typeof s.autoBounce !== "boolean") ||
        (s.contactFixed !== undefined && typeof s.contactFixed !== "boolean") ||
        (s.bounce !== undefined &&
          (!finite(s.bounce) || s.bounce < 0 || s.bounce > 0.95)) ||
        (s.spin !== undefined &&
          (!s.spin ||
            !SPIN_TYPES.includes(s.spin.type) ||
            !finite(s.spin.strength) ||
            s.spin.strength < 0 ||
            s.spin.strength > 1)))
    )
      throw new Error(
        "Thông số cú đánh không hợp lệ (đỉnh phải cao hơn điểm đánh).",
      );
  }
  // Reconstruct the public model, discarding unrelated input fields.
  for (const step of data.steps as Step[]) {
    const height = step.shot?.groundContactHeight;
    if (
      height !== undefined &&
      (!finite(height) || height < COURT.ballRadius || height > 12)
    )
      throw new Error("Chiều cao đón bóng không hợp lệ.");
  }
  return {
    version: 1,
    ...(data.playerLayout === 2 ? { playerLayout: 2 as const } : {}),
    name: data.name,
    steps: (data.steps as Step[]).map((s) => ({
      players: s.players.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        ...(p.hand ? { hand: p.hand } : {}),
      })),
      note: s.note ?? "",
      ...(s.shot
        ? {
            shot: {
              hitter: s.shot.hitter,
              from: { x: s.shot.from.x, y: s.shot.from.y, z: s.shot.from.z },
              to: { x: s.shot.to.x, z: s.shot.to.z },
              type: s.shot.type,
              apex: s.shot.apex,
              volley: s.shot.volley ?? false,
              finish: s.shot.finish ?? false,
              spin: s.shot.spin
                ? { type: s.shot.spin.type, strength: s.shot.spin.strength }
                : { type: "none", strength: 0 },
              bounce: s.shot.bounce ?? 0.7,
              ...(s.shot.topspin !== undefined
                ? { topspin: s.shot.topspin }
                : {}),
              ...(s.shot.autoBounce !== undefined
                ? { autoBounce: s.shot.autoBounce }
                : {}),
              ...(s.shot.groundContactHeight !== undefined
                ? { groundContactHeight: s.shot.groundContactHeight }
                : {}),
              ...(s.shot.contactFixed !== undefined
                ? { contactFixed: s.shot.contactFixed }
                : {}),
            },
          }
        : {}),
    })),
  };
}
export function parseScenario(json: string): Scenario {
  if (json.length > 1_000_000) throw new Error("Kịch bản vượt quá 1 MB.");
  try {
    return validateScenario(JSON.parse(json));
  } catch (e) {
    if (e instanceof SyntaxError)
      throw new Error("Tệp JSON không đúng định dạng.");
    throw e;
  }
}
export function encodeScenario(s: Scenario): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeScenario(hash: string): Scenario {
  const value = hash.replace(/^#(?:s=)?/, "");
  if (value.length > 1_400_000) throw new Error("Link kịch bản quá dài.");
  try {
    const decoded = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    return parseScenario(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
      ),
    );
  } catch (e) {
    throw new Error(
      `Không đọc được link: ${e instanceof Error ? e.message : "dữ liệu không hợp lệ"}`,
    );
  }
}

export function migratePlayerLayout(scenario: Scenario): Scenario {
  if (scenario.playerLayout === 2) return scenario;
  const next = clone(scenario);
  const swap: Record<PlayerId, PlayerId> = {
    A1: "A2",
    A2: "A1",
    B1: "B2",
    B2: "B1",
  };
  for (const step of next.steps) {
    for (const player of step.players) player.id = swap[player.id];
    if (step.shot) step.shot.hitter = swap[step.shot.hitter];
  }
  next.playerLayout = 2;
  return next;
}
