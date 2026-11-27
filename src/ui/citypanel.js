// Bảng điều khiển khi đang ở trong một thành phố: hạnh phúc, dịch vụ, công cụ xây, vẽ metro.
import { fmt, esc, clamp } from '../util.js';
import { SERVICES, CATS, serviceCost, finishLine, lotAt, trackLength, TRACK_COST, THREATS, CAMPAIGNS, campaign } from '../city.js';
import { UPGRADES, canUpgrade, upgradeCost, upgradeChance, upgrade, level } from '../upgrade.js';
import { skipDayNight, hourOfDay } from '../game.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
const TOOLS = [['look', 'Xem'], ...Object.entries(SERVICES).filter(([k]) => k !== 'station').map(([k, s]) => [k, s.name]), ['metro', 'Vẽ tuyến metro'], ['demolish', 'Phá dỡ']];
const LOT_TEXT = { res: 'Khu dân cư', com: 'Khu thương mại', empty: 'Đất trống' };

export function createCityPanel(G, { onExit }) {
  const el = $('cityPanel');
  const ui = { tool: 'look', lot: null };
  el.innerHTML = `
    <div class="cp-head"><button class="btn" id="cpExit" type="button">← Bản đồ quốc gia</button><button class="btn" id="cpSkip" type="button"></button><h2 id="cpName"></h2></div>
    <div class="cp-big"><div><span class="lab">Hạnh phúc</span><b id="cpHappy"></b></div><div><span class="lab">Dân số</span><b id="cpPop"></b></div><div><span class="lab">Tắc đường</span><b id="cpJam"></b></div></div>
    <div id="cpParts">${CATS.map(([k, label]) => `<div class="cp-row"><span>${label}</span><div class="meter wide"><i data-k="${k}"></i></div></div>`).join('')}</div>
    <p class="note" id="cpCost"></p>
    <p class="lab sp">Mối nguy</p>
    <div id="cpThreats">${Object.entries(THREATS).map(([k, t]) => `<div class="cp-row threat" title="${t.desc}"><span>${t.name}</span><div class="meter wide"><i data-th="${k}"></i></div><button class="btn sm" type="button" data-camp="${k}">${CAMPAIGNS[k].name}</button></div>`).join('')}</div>
    <p class="note" id="cpThreatNote">Cảnh sát giảm ma tuý và khủng bố, bệnh viện giảm ma tuý, đài truyền hình chặn tuyên truyền. Chiến dịch có hiệu lực trên cả nước.</p>
    <div class="proj sp"><b id="cpUpT"></b><small id="cpUpD"></small><button class="btn" id="cpUp" type="button"></button></div>
    <div class="seg cp-tools" id="cpTools">${TOOLS.map(([k, l]) => `<button type="button" data-t="${k}">${l}</button>`).join('')}</div>
    <p class="note" id="cpHint"></p>
    <div class="btns" id="cpMetro" hidden><button class="btn" id="cpFinish" type="button">Hoàn tất tuyến</button></div>
    <p class="note" id="cpLot"></p>`;
  $('cpExit').addEventListener('click', onExit);
  $('cpSkip').addEventListener('click', () => skipDayNight(G));
  $('cpTools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const C = G.cities[ui.city];
    if (ui.tool === 'metro' && b.dataset.t !== 'metro' && C) finishLine(G, C);
    ui.tool = b.dataset.t;
  });
  $('cpFinish').addEventListener('click', () => { const C = G.cities[ui.city]; if (C) finishLine(G, C); });
  $('cpThreats').addEventListener('click', (e) => { const b = e.target.closest('[data-camp]'); if (b) campaign(G, b.dataset.camp); });
  $('cpUp').addEventListener('click', () => { const n = G.net.nodes.find((x) => x.id === ui.city); if (n) upgrade(G, n); });

  function hint(C) {
    if (ui.tool === 'look') return 'Bấm vào một lô để xem. Mỗi dịch vụ phủ sóng các lô quanh nó; khu dân cư được phủ đủ loại thì hạnh phúc tăng.';
    if (ui.tool === 'metro') return C.draft ? `Đang vẽ tuyến: ${C.draft.stops.length} ga. Bấm lô tiếp theo để kéo ray (${fmt(TRACK_COST * G.priceLevel * (1 + G.corruption / 100), 2)} tr/lô), xong bấm “Hoàn tất tuyến”.` : `Bấm lô đầu tiên để đặt ga (${fmt(serviceCost(G, 'station'), 1)} tr). Ga chỉ hoạt động khi tuyến có từ 2 ga. Metro giảm tắc đường nhưng tốn điện.`;
    if (ui.tool === 'demolish') return 'Bấm vào công trình công cộng để phá dỡ (không hoàn tiền).';
    const s = SERVICES[ui.tool];
    return `${s.name}: ${fmt(serviceCost(G, ui.tool), 1)} triệu USD, vận hành ${fmt(s.upkeep * 1000)} nghìn USD/ngày, tiêu thụ ${fmt(s.MW, 1)} MW, phủ bán kính ${s.radius} lô. Xây trên đất trống, hoặc trên nhà cũ (giá ×1,5).`;
  }

  function render(cityId) {
    ui.city = cityId;
    const C = G.cities[cityId], n = G.net.nodes.find((x) => x.id === cityId);
    if (!C || !n) return;
    set('cpName', n.name);
    { const h = hourOfDay(G); set('cpSkip', h >= 7 && h < 20 ? 'Tua tới tối' : 'Tua tới sáng'); }
    set('cpHappy', `${fmt(C.happiness)}%`); $('cpHappy').style.color = C.happiness < 40 ? 'var(--hot)' : C.happiness < 60 ? 'var(--amber)' : 'var(--cool)';
    set('cpPop', `${fmt(n.demandBase * 1000)} dân`);
    set('cpJam', C.congestion > 0.9 ? 'Nặng' : C.congestion > 0.5 ? 'Vừa' : 'Thông thoáng');
    for (const i of el.querySelectorAll('#cpParts i')) { const v = C.parts[i.dataset.k] ?? 0; i.style.width = `${clamp(v * 100, 0, 100)}%`; i.style.background = v < 0.4 ? 'var(--hot)' : v < 0.7 ? 'var(--amber)' : 'var(--cool)'; }
    set('cpCost', `Dịch vụ tiêu thụ ${fmt(C.extraMW, 1)} MW từ lưới, chi phí vận hành ${fmt(C.upkeep * G.priceLevel, 2)} triệu USD/ngày. ${C.lines.filter((l) => l.stops.length >= 2).length} tuyến metro, tổng ${fmt(C.lines.reduce((a, l) => a + trackLength(C, l), 0), 1)} lô ray.${C.bankIncome > 0.001 ? ` Ngân hàng mang về ${fmt(C.bankIncome * G.priceLevel * 1000)} nghìn USD/ngày.` : ''}`);
    for (const i of el.querySelectorAll('#cpThreats i')) { const v = C.threat?.[i.dataset.th] ?? 0; i.style.width = `${clamp(v, 0, 100)}%`; i.style.background = v >= 60 ? 'var(--hot)' : v >= 35 ? 'var(--amber)' : 'var(--cool)'; }
    for (const b of el.querySelectorAll('[data-camp]')) { const c = CAMPAIGNS[b.dataset.camp].cost * G.priceLevel * (1 + G.corruption / 100); const t = `${CAMPAIGNS[b.dataset.camp].name} (${fmt(c, 1)} tr)`; if (b.textContent !== t) b.textContent = t; b.disabled = c > G.budget; }
    const lv = level(n);
    set('cpUpT', `Quy mô thành phố: cấp ${lv}/${UPGRADES.city.max}`);
    set('cpUpD', canUpgrade(n) ? `${UPGRADES.city.what(lv)}. Tỉ lệ thành công ${fmt(upgradeChance(G, n) * 100)}%.` : 'Đã đạt quy mô tối đa.');
    set('cpUp', canUpgrade(n) ? `Nâng cấp (${fmt(upgradeCost(G, n), 1)} triệu USD)` : 'Tối đa'); $('cpUp').disabled = !canUpgrade(n) || upgradeCost(G, n) > G.budget;
    for (const b of $('cpTools').children) b.setAttribute('aria-pressed', b.dataset.t === ui.tool);
    set('cpHint', hint(C));
    $('cpMetro').hidden = !(ui.tool === 'metro' && C.draft);
    const L = ui.lot && lotAt(C, ui.lot[0], ui.lot[1]);
    set('cpLot', L ? `Lô (${ui.lot[0] + 1}, ${ui.lot[1] + 1}): ${SERVICES[L.type]?.name ?? LOT_TEXT[L.type]}${SERVICES[L.type] ? ` · phủ bán kính ${SERVICES[L.type].radius} lô` : ''}` : '');
  }
  void esc;
  return { ui, render, show: (on) => { el.hidden = !on; } };
}
