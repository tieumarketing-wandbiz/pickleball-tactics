import { SHOT_TYPES, SHOT_NAMES } from "../core/constants";
export const icons = {
  play: '<svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>',
  compress: '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3m13-5v3a2 2 0 0 0 2 2h3M3 16h3a2 2 0 0 1 2 2v3m13-5h-3a2 2 0 0 0-2 2v3"/></svg>',
};
export function buildUI() {
  document.querySelector("#app")!.innerHTML = `
  <header class="header"><div class="brand"><span class="brand-mark">C<span>↗</span></span><div>COURTSIDE<small>PICKLEBALL TACTICS / 3D</small></div></div><div class="header-tag"><span class="live-dot"></span> TACTICS LAB <span class="version">01—04</span></div><div class="file-actions"><button id="import">Nhập JSON</button><button id="export">Xuất JSON</button><button id="share" class="outline-accent">↗ Chia sẻ</button></div></header>
  <main class="workspace"><section class="viewport" aria-label="Sân pickleball 3D"><div id="scene"></div>
  <div class="view-top"><div class="scene-title"><span class="eyebrow">SÂN ĐÔI / 6.10 × 13.41 M</span><h1>Đọc trận đấu.<br><span>Vẽ nước đi.</span></h1></div><div class="view-controls"><div class="camera-bar" role="group" aria-label="Góc camera"><button data-camera="perspective" class="active">3D</button><button data-camera="top">Top</button><button data-camera="baseline">Baseline</button><button data-camera="side">Side</button></div><button id="preview-play" class="preview-play" type="button" aria-label="Phát toàn bộ kịch bản">${icons.play}</button><button id="fullscreen-toggle" class="fullscreen-toggle" type="button" aria-label="Toàn màn hình" title="Toàn màn hình">${icons.expand}</button></div></div>
  <div class="scene-bottom"><div class="legend"><span><i class="team-a"></i> Đội A</span><span><i class="team-b"></i> Đội B</span><span><i class="ball-dot"></i> Quỹ đạo</span></div><div class="mode-switch"><button id="edit-mode" class="active">✥ Chỉnh sửa</button><button id="view-mode">◎ Xoay sân</button></div></div>
  <div class="scene-hint" id="hint" role="status">Nháy đúp chọn người đánh · kéo để di chuyển · bấm sân đặt điểm rơi</div>
  </section>
  <aside class="inspector"><div class="panel-heading"><span class="eyebrow">BẢNG CHIẾN THUẬT</span><span class="step-counter" id="step-counter">01 / 01</span></div>
  <label class="name-label" for="scenario-name">Tên kịch bản</label><input id="scenario-name" class="scenario-name" maxlength="160" aria-label="Tên kịch bản">
  <div class="section-label"><span>01</span> NGƯỜI ĐÁNH</div><div class="player-buttons" role="group" aria-label="Người đánh">${["A1", "A2", "B1", "B2"].map((id) => `<button data-player="${id}" class="${id.startsWith("A") ? "a" : "b"}">${id}</button>`).join("")}</div>
  <div class="coordinates" id="coordinates"></div>
  <div id="stroke-side" class="stroke-badge">Chính giữa</div>
  <div class="section-label"><span>02</span> CÚ ĐÁNH</div><div class="shot-types" role="group" aria-label="Loại cú đánh">${SHOT_TYPES.map((type) => `<button data-shot="${type}">${SHOT_NAMES[type]}</button>`).join("")}</div>
  <p class="shot-help" id="shot-help"></p>
  <button id="pick-target" class="target-button"><span>⊕</span> Đặt điểm rơi trên sân <span>↗</span></button>
  <div class="number-row"><label>Đỉnh quỹ đạo <span>m</span><input id="apex" type="number" min="0.8" max="12" step="0.1"></label><label>Điểm đánh <span>m</span><input id="height" type="number" min="0.037" max="12" step="0.1"></label></div>
  <label class="checkbox"><input type="checkbox" id="volley"> Volley (đánh trước khi bóng nảy)</label>
  <label class="checkbox"><input type="checkbox" id="finish"> Dứt điểm (bóng tiếp tục nảy / trượt)</label>
  <label class="checkbox"><input type="checkbox" id="topspin"> Topspin</label>
  <p class="model-note">Độ nảy tự dự đoán theo cú đánh, đỉnh quỹ đạo và điểm đánh.</p>
  <div class="result-card" id="result" aria-live="polite"></div>
  <div class="shot-actions"><button id="preview-shot">${icons.play} Xem cú đánh</button><button id="clear-shot" aria-label="Xóa cú đánh">Xóa cú</button></div>
  <div class="section-label"><span>03</span> GHI CHÚ CHIẾN THUẬT</div><textarea id="note" rows="3" maxlength="4000" placeholder="Ý đồ của bước này…" aria-label="Ghi chú chiến thuật"></textarea>
  <p class="model-note">Spin và độ nảy mô phỏng · giữ điểm rơi đã chọn.<br>Kitchen là vùng thông tin, không tự động là lỗi.</p>
  </aside></main>
  <footer class="timeline"><div class="transport"><button id="previous" aria-label="Bước trước">${icons.prev}</button><button id="play" class="play-button" aria-label="Phát kịch bản">${icons.play}</button><button id="next" aria-label="Bước sau">${icons.next}</button><button id="reset" aria-label="Về bước đầu">↺</button><div class="transport-label"><strong id="play-state">Sẵn sàng</strong><small id="time-readout">00:00 / 00:00</small></div></div><div class="steps" id="steps" role="group" aria-label="Các bước kịch bản"></div><div class="step-actions"><button id="add-step">＋ Thêm bước</button><button id="duplicate" aria-label="Sao chép bước">⧉</button><button id="delete-step" aria-label="Xóa bước">−</button></div></footer>
  <div id="toast" class="toast" role="status"></div><input id="file-input" type="file" accept=".json,application/json" hidden>
  <dialog id="share-dialog"><form method="dialog"><div class="eyebrow">CHIA SẺ KỊCH BẢN</div><h2>Cùng đọc một trận đấu.</h2><p>Link chứa toàn bộ vị trí, cú đánh và ghi chú.</p><textarea id="share-url" readonly aria-label="Link kịch bản"></textarea><div class="dialog-actions"><button value="close">Đóng</button><button id="copy-link" type="button" class="outline-accent">Sao chép link</button></div></form></dialog>`;
}
export function toast(message: string) {
  const el = document.querySelector<HTMLElement>("#toast")!;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 4500);
}
let toastTimer = 0;
