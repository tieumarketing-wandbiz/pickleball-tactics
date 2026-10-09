export const COURT = {
  halfWidth: 3.05,
  halfLength: 6.705,
  kitchen: 2.13,
  netCenter: 0.864,
  netEdge: 0.914,
  netHalfWidth: 3.35,
  ballRadius: 0.037,
  gravity: 9.81,
  snap: 0.1,
} as const;
export const PLAYER_AREA = { halfWidth: 5, halfLength: 8.8 } as const;
export const PLAYER_IDS = ["A1", "A2", "B1", "B2"] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];
export const SHOT_TYPES = [
  "serve",
  "drive",
  "dink",
  "drop",
  "lob",
  "volley",
  "smash",
  "block",
  "punch",
  "reset",
  "speedup",
  "roll",
  "flick",
  "atp",
  "erne",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];
export const DEFAULT_APEX: Record<ShotType, number> = {
  serve: 1.5,
  drive: 1.1,
  dink: 1.2,
  drop: 2.5,
  lob: 5,
  volley: 1.1,
  smash: 2.3,
  block: 1.25,
  punch: 1.1,
  reset: 1.8,
  speedup: 1.1,
  roll: 1.15,
  flick: 1.1,
  atp: 0.45,
  erne: 1.1,
};
export const SHOT_NAMES: Record<ShotType, string> = {
  serve: "Giao bóng",
  drive: "Drive",
  dink: "Dink",
  drop: "Drop",
  lob: "Lob",
  volley: "Volley",
  smash: "Smash",
  block: "Block volley",
  punch: "Punch volley",
  reset: "Reset",
  speedup: "Speed-up",
  roll: "Roll",
  flick: "Flick",
  atp: "ATP",
  erne: "Erne",
};
export const netHeight = (x: number) =>
  COURT.netCenter +
  (COURT.netEdge - COURT.netCenter) *
    Math.min(Math.abs(x) / COURT.halfWidth, 1);
export const inCourt = (x: number, z: number) =>
  Math.abs(x) <= COURT.halfWidth && Math.abs(z) <= COURT.halfLength;
export const inKitchen = (x: number, z: number) =>
  inCourt(x, z) && Math.abs(z) <= COURT.kitchen;
export function snapPlayer(x: number, z: number) {
  const snap = (v: number, limit: number) =>
    Math.max(
      -limit,
      Math.min(limit, Math.round(v / COURT.snap) / (1 / COURT.snap)),
    );
  return {
    x: snap(x, PLAYER_AREA.halfWidth),
    z: snap(z, PLAYER_AREA.halfLength),
  };
}

export const DEFAULT_HEIGHT: Record<ShotType, number> = Object.fromEntries(
  SHOT_TYPES.map((type) => [
    type,
    type === "smash"
      ? 2.2 // guide video: overhead contact 0.3–0.4 m above the head
      : type === "serve"
        ? 0.6 // guide video: underhand contact 0.45–0.6 m (rig arm reach caps it at the top)
        : type === "atp"
          ? 0.25
          : type === "erne"
            ? 1.05
            : 0.8,
  ]),
) as Record<ShotType, number>;
export const VOLLEY_TYPES: ReadonlySet<ShotType> = new Set([
  "volley",
  "smash",
  "block",
  "punch",
  "roll",
  "flick",
  "erne",
]);
export const SHOT_HINTS: Record<ShotType, string> = {
  serve: "Giao bóng mở đầu pha đấu.",
  drive: "Đánh mạnh từ cuối sân hoặc vùng chuyển tiếp.",
  dink: "Đặt điểm rơi sát lưới; vòm dink tự nâng khi cần. Bật Dứt điểm để xem bóng nảy vượt biên.",
  drop: "Đưa bóng từ xa rơi mềm vào kitchen.",
  lob: "Đưa bóng cao qua đối thủ.",
  volley: "Đánh bóng trước khi nảy.",
  smash: "Tiếp xúc cao, đánh xuống để tấn công.",
  block: "Chặn và giảm lực cú đánh của đối thủ.",
  punch: "Volley với động tác đẩy vợt ngắn, chắc.",
  reset: "Đánh mềm để giảm nhịp và lấy lại thế cân bằng.",
  speedup: "Tăng tốc từ pha bóng mềm để tấn công.",
  roll: "Topspin làm bóng chúi xuống và giữ tốc độ khi nảy.",
  flick: "Tấn công bằng cổ tay; bật hoặc tắt Topspin theo ý đồ.",
  atp: "Kéo người ra ngoài biên để đón bóng nảy, rồi chọn điểm trả vòng ngoài cột lưới.",
  erne: "Volley với điểm tiếp xúc ngoài biên cạnh kitchen. Đặt người sát lưới; chưa kiểm tra bước chân/đà nhảy.",
};
export function shotOrigin(
  player: { x: number; z: number },
  type: ShotType,
  y: number,
) {
  const side = player.x < 0 ? -1 : 1;
  return {
    x: type === "atp" || type === "erne" ? player.x + side * 0.55 : player.x,
    y,
    z: player.z,
  };
}
