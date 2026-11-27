// Bảng Nhân công (cửa sổ Quốc gia) và cửa sổ Cố vấn (lời khuyên theo tình huống + mẹo chơi).
import { fmt, esc, clamp } from '../util.js';
import { needed, laborPool, staffRatio, crewFactor, dailyWage, hire, dismiss, hireToNeed } from '../workforce.js';
import { advice, GENERAL_TIPS } from '../tips.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };

export function createExtras(G, drawers) {
  $('hireNeed').addEventListener('click', () => hireToNeed(G));
  $('staffBox').addEventListener('click', (e) => { const b = e.target.closest('[data-hire]'); if (!b) return; const k = +b.dataset.hire; if (k > 0) hire(G, k); else dismiss(G, -k); });
  $('tipList').innerHTML = GENERAL_TIPS.map((t) => `<li>${esc(t)}</li>`).join('');

  let tips = [], tipsKey = '', acc = 1;
  $('advice').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    tips[+b.dataset.i]?.act?.(); acc = 1; // làm mới ngay
  });

  function render(dt = 0.016) {
    // Nhân công
    const need = needed(G), r = staffRatio(G), pool = laborPool(G);
    const dl = `<div><dt>Đang thuê</dt><dd>${fmt(G.staff.hired)} người</dd></div><div><dt>Cần cho mọi công trình</dt><dd>${fmt(need)} người</dd></div><div><dt>Lực lượng lao động</dt><dd>${fmt(pool)} người</dd></div><div><dt>Lương</dt><dd>${fmt(dailyWage(G) * 1000)} nghìn USD/ngày</dd></div>`;
    if ($('staffDl').innerHTML !== dl) $('staffDl').innerHTML = dl;
    const bar = $('staffBar'); bar.style.width = `${clamp(r * 100, 0, 100)}%`; bar.style.background = r < 0.7 ? 'var(--hot)' : r < 0.95 ? 'var(--amber)' : 'var(--cool)';
    set('staffNote', r >= 0.999 ? 'Đủ người: nhà máy chạy hết công suất, công trường đúng tiến độ.' : `Thiếu người: nhà máy chỉ chạy ${fmt(crewFactor(G) * 100)}% công suất, công trường và sửa chữa chậm hơn, nâng cấp dễ thất bại.`);
    $('hireNeed').disabled = G.staff.hired >= need;

    // Cố vấn: tính lại mỗi giây là đủ
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    tips = advice(G);
    const urgent = tips.filter((t) => t.lvl === 'bad').length;
    const btn = $('tipsBtn');
    let badge = btn.querySelector('.badge');
    if (urgent && drawers.current !== 'tips') { if (!badge) { badge = document.createElement('i'); badge.className = 'badge'; btn.append(badge); } badge.textContent = urgent; }
    else badge?.remove();
    const key = tips.map((t) => t.text + t.label).join('|');
    if (key === tipsKey) return;
    tipsKey = key;
    $('advice').innerHTML = tips.length
      ? tips.map((t, i) => `<li class="${t.lvl}">${esc(t.text)}${t.label ? `<button class="btn${t.lvl === 'bad' ? ' primary' : ''}" type="button" data-i="${i}">${esc(t.label)}</button>` : ''}</li>`).join('')
      : '<li>Mọi thứ đang ổn. Hãy nghĩ tới bước tiếp theo: nâng cấp nhà máy, mở rộng lưới tới vùng đất mới, hoặc làm nhiệm vụ.</li>';
  }
  return { render };
}
