// Thanh "Ván chơi" ở đầu trang: lưu, tải, ván mới, âm thanh, phím tắt; tự lưu mỗi ngày game.
import * as Save from '../save.js';
import { news } from '../news.js';

const $ = (id) => document.getElementById(id);
const when = (at) => new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const SHORTCUTS = [
  ['Space', 'Dừng / chạy tiếp'], ['1–4', 'Tốc độ 1×, 50×, 300×, 1500×'], ['Q', 'Công cụ chọn'], ['L', 'Kéo dây'], ['B', 'Mở menu xây dựng'],
  ['X', 'Bán công trình'], ['Esc', 'Huỷ thao tác / rời thành phố'], ['M', 'Tắt / bật âm thanh'], ['Ctrl + S', 'Lưu ván'], ['?', 'Hiện bảng phím tắt'],
];

export function createGameBar(G, audio, { loaded }) {
  const root = $('gamebar');
  root.innerHTML = `
    <button class="btn" type="button" id="gSave" title="Ctrl + S">Lưu ván</button>
    <button class="btn" type="button" id="gLoad">Tải ván</button>
    <button class="btn" type="button" id="gAuto">Tải bản tự lưu</button>
    <button class="btn" type="button" id="gNew">Ván mới</button>
    <button class="btn" type="button" id="gMute" aria-pressed="false"></button>
    <button class="btn" type="button" id="gKeys" aria-expanded="false" title="?">Phím tắt</button>
    <div class="keys" id="keys" hidden><dl>${SHORTCUTS.map(([k, v]) => `<div><dt><kbd>${k}</kbd></dt><dd>${v}</dd></div>`).join('')}</dl></div>`;

  function refresh() {
    const m = Save.info('manual'), a = Save.info('auto');
    $('gLoad').disabled = !m; $('gLoad').textContent = m ? `Tải ván (ngày ${m.day}, lưu ${when(m.at)})` : 'Chưa có ván lưu';
    $('gAuto').disabled = !a; $('gAuto').textContent = a ? `Tải bản tự lưu (ngày ${a.day})` : 'Chưa có bản tự lưu';
    $('gMute').textContent = audio.muted ? 'Âm thanh: tắt' : 'Âm thanh: bật'; $('gMute').setAttribute('aria-pressed', String(!audio.muted));
  }
  function save() {
    if (G.over) return news(G, 'Ván đã kết thúc, không lưu được.', 'warn');
    news(G, Save.save(G, 'manual') ? 'Đã lưu ván chơi vào trình duyệt.' : 'Không lưu được (trình duyệt chặn bộ nhớ cục bộ?).', Save.info('manual') ? '' : 'warn');
    refresh();
  }
  let leaving = false; // đang tải ván khác: không tự lưu đè lên bản sắp tải
  const load = (slot) => { leaving = true; Save.requestLoad(slot); location.reload(); };
  const toggleKeys = (show = $('keys').hidden) => { $('keys').hidden = !show; $('gKeys').setAttribute('aria-expanded', String(show)); };

  $('gSave').onclick = save;
  $('gLoad').onclick = () => load('manual');
  $('gAuto').onclick = () => load('auto');
  $('gNew').onclick = () => { if (G.over || confirmNew()) { sessionStorage.clear(); location.reload(); } };
  $('gMute').onclick = () => { audio.setMuted(!audio.muted); refresh(); };
  $('gKeys').onclick = () => toggleKeys();
  function confirmNew() { return window.confirm('Bắt đầu ván mới? Tiến độ chưa lưu sẽ mất (bản tự lưu gần nhất vẫn còn).'); }

  // Tự lưu khi sang ngày mới và khi rời trang
  let day = Math.floor(G.t / 86400);
  const auto = () => { if (!leaving && !G.over && G.t > 60) { Save.save(G, 'auto'); refresh(); } };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && auto());
  window.addEventListener('pagehide', auto);

  if (loaded) news(G, loaded === 'auto' ? 'Đã tải bản tự lưu. Chúc Bộ trưởng tiếp tục thành công.' : 'Đã tải ván chơi đã lưu.');
  refresh();
  return {
    save, toggleKeys, refresh,
    update() { const d = Math.floor(G.t / 86400); if (d !== day) { day = d; auto(); } },
  };
}
