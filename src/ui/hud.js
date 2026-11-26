// Giao diện HTML phủ lên cảnh 3D: điều khiển, số liệu kèm công thức, đèn báo, bản tin, bản đồ gió.
import { fmt, esc, clamp, ramp, rgb, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import { clockText, windName, repair, loadScenario, news, GRID_SCENARIOS, REACTOR_SCENARIOS } from '../game.js';
import { hasTransformer, isPowered, RHO_AL } from '../physics/grid.js';
import { RATED, C_CORE, FLOW_NOM, outletTemp, DIESEL_START, T_IN } from '../physics/reactor.js';

const $ = (id) => document.getElementById(id);
const kvText = (v) => `${fmt(v, v === 10.5 ? 1 : 0)} kV`;

const GRID_LAMPS = [
  ['Sụt áp >10%', (C) => isPowered(C) && C.drop > 0.1, 'warn'],
  ['Dây >80 °C', (C) => C.Tw > 80, 'warn'],
  ['MBA quá tải', (C) => hasTransformer(C) && isPowered(C) && C.P > 400, 'warn'],
  ['Rơ-le cắt', (C) => C.line === 'tripped', 'warn'],
  ['Sụp đổ điện áp', (C) => C.line === 'collapse', 'bad'],
  ['Cháy đường dây', (C) => C.line === 'fire', 'bad'],
  ['Cháy MBA', (C) => C.tx === 'fire', 'bad'],
  ['Mất điện', (C) => !isPowered(C), 'bad'],
];
const REACTOR_LAMPS = [
  ['SCRAM', (R) => R.scram, 'warn'],
  ['Mất điện ngoài', (R) => !R.offsite, 'warn'],
  ['Diesel chạy', (R) => !R.offsite && R.diesel && R.dieselT >= DIESEL_START, 'info'],
  ['Lưu lượng thấp', (R) => R.flow < 0.6, 'warn'],
  ['Van xả mở', (R) => R.porvOpen, 'warn'],
  ['Hư hại nhiên liệu', (R) => R.dmg, 'bad'],
  ['Hydro >50%', (R) => R.H2 > 50, 'bad'],
  ['Mất nước (LOCA)', (R) => R.loca, 'bad'],
  ['Nóng chảy lõi', (R) => R.melt, 'bad'],
  ['Rò phóng xạ', (R) => R.release > 0, 'bad'],
];
const SYSTEMS = [['offsite', 'Điện lưới ngoài'], ['diesel', 'Diesel dự phòng sẵn sàng'], ['porv', 'Van xả áp hoạt động'], ['rps', 'Tự động SCRAM'], ['rbmk', 'Hệ số rỗng dương']];
const SLIDERS = [['L', (v) => `${fmt(v)} km`], ['P', (v) => `${fmt(v)} MW`], ['Ta', (v) => `${fmt(v)} °C`], ['Imax', (v) => `${fmt(v)} A`]];

export function createHud(G, { onTab }) {
  const segs = [];
  const seg = (id, values, label, get, set) => {
    const el = $(id);
    el.innerHTML = values.map((v) => `<button type="button" data-v="${v}">${label(v)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { set(+b.dataset.v); sync(); } });
    segs.push([el, get]);
  };
  seg('speed', [1, 5, 20, 60, 0], (v) => (v ? `${v}×` : 'Dừng'), () => G.speed, (v) => (G.speed = v));
  seg('kv', [10.5, 110, 220, 500], kvText, () => G.grid.kv, (v) => (G.grid.kv = v));
  seg('sec', [95, 150, 240, 400, 630], (v) => v, () => G.grid.A, (v) => (G.grid.A = v));
  for (const [id] of SLIDERS) $(id).addEventListener('input', (e) => { G.grid[id] = +e.target.value; sync(); });
  $('relay').addEventListener('click', () => { G.grid.relay = !G.grid.relay; sync(); });
  $('restore').addEventListener('click', () => repair(G));

  $('rod').addEventListener('input', (e) => { if (!G.reactor.scram) G.reactor.rodCmd = +e.target.value; });
  $('scram').addEventListener('click', () => {
    const R = G.reactor;
    R.scram = !R.scram;
    if (R.scram) news(G, 'Người vận hành nhấn SCRAM bằng tay.', 'warn'); else R.rodCmd = R.rod = 0;
    sync();
  });
  $('pumps').innerHTML = [0, 1, 2, 3].map((i) => `<button class="btn" type="button" data-i="${i}">Bơm ${i + 1}</button>`).join('');
  $('pumps').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i, R = G.reactor;
    R.pumps[i] = R.pumps[i] ? 0 : 1;
    if (!R.pumps[i]) news(G, `Bơm ${i + 1} dừng.`, 'warn');
    sync();
  });
  $('sys').innerHTML = SYSTEMS.map(([k, l]) => `<button class="btn" type="button" data-k="${k}">${l}</button>`).join('');
  $('sys').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const R = G.reactor, k = b.dataset.k;
    R[k] = !R[k];
    if (k === 'offsite') news(G, R.offsite ? 'Điện lưới ngoài được khôi phục.' : 'Mất điện lưới ngoài cấp cho nhà máy.', 'warn');
    sync();
  });
  const presets = (id, list, kind) => {
    $(id).innerHTML = list.map((p, i) => `<button class="btn" type="button" data-i="${i}">${p[0]}</button>`).join('');
    $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { loadScenario(G, kind, +b.dataset.i); sync(); } });
  };
  presets('cPresets', GRID_SCENARIOS, 'grid');
  presets('rPresets', REACTOR_SCENARIOS, 'reactor');

  const lamps = (id, list) => { $(id).innerHTML = list.map(([l, , k]) => `<div class="lamp ${k}">${l}</div>`).join(''); };
  lamps('cLamps', GRID_LAMPS); lamps('rLamps', REACTOR_LAMPS);

  for (const tab of ['grid', 'reactor', 'overview']) $(`tab-${tab}`).addEventListener('click', () => { location.hash = tab; });
  const fromHash = () => {
    const tab = ['reactor', 'overview'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'grid';
    for (const t of ['grid', 'reactor', 'overview']) $(`tab-${t}`).setAttribute('aria-selected', t === tab);
    $('panel-grid').hidden = tab === 'reactor';
    $('panel-reactor').hidden = tab === 'grid';
    onTab(tab);
  };
  window.addEventListener('hashchange', fromHash);

  G.listeners.add((items) => {
    const html = items.map((n) => `<span class="${n.level}">${esc(clockText(n.t))} · ${esc(n.text)}</span>`).join('');
    $('track').innerHTML = html + html;
  });

  function sync() {
    const C = G.grid, R = G.reactor;
    for (const [el, get] of segs) for (const b of el.children) b.setAttribute('aria-pressed', +b.dataset.v === get());
    for (const [id, f] of SLIDERS) { $(id).value = C[id]; $(`${id}V`).textContent = f(C[id]); }
    $('relay').setAttribute('aria-pressed', C.relay);
    $('relay').textContent = C.relay ? 'Đang bật' : 'Đang tắt';
    $('Imax').disabled = !C.relay;
    $('rod').value = R.scram ? 0 : R.rodCmd;
    $('rod').disabled = R.scram;
    $('scram').textContent = R.scram ? 'Giải trừ SCRAM' : 'SCRAM';
    [...$('pumps').children].forEach((b, i) => b.setAttribute('aria-pressed', !!R.pumps[i]));
    [...$('sys').children].forEach((b) => b.setAttribute('aria-pressed', !!R[b.dataset.k]));
  }

  const setLamps = (id, list, obj) => [...$(id).children].forEach((n, i) => n.classList.toggle('on', !!list[i][1](obj)));
  const bar = (id, pct, color) => { const b = $(id); b.style.width = `${clamp(pct, 0, 100)}%`; b.style.background = color; };
  let lastScram = null;

  function render() {
    const C = G.grid, R = G.reactor;
    if (R.scram !== lastScram) { lastScram = R.scram; sync(); }
    $('clock').textContent = clockText(G.t);
    $('budget').textContent = `${fmt(G.budget, 2)} tr USD`;
    $('apV').textContent = `${fmt(G.approval)}%`;
    bar('apBar', G.approval, G.approval < 30 ? 'var(--hot)' : G.approval < 50 ? 'var(--amber)' : 'var(--cool)');

    if (!$('panel-grid').hidden) {
      setLamps('cLamps', GRID_LAMPS, C);
      const on = isPowered(C), wireCol = rgb(ramp(WIRE_RAMP, C.Tw));
      $('rRf').textContent = `${fmt(RHO_AL * 1e8, 2)}·10⁻⁸ Ω·m × ${fmt(C.L * 1000)} m ÷ ${C.A}·10⁻⁶ m², tính cả nóng lên`;
      $('rR').textContent = `${fmt(C.R, 2)} Ω`;
      $('rI').textContent = `${fmt(C.I)} A`;
      $('rL').textContent = `${fmt(C.loss / 1e6, 1)} MW`;
      $('rLf').textContent = on ? `${fmt(C.loss / 1e4 / C.P, 1)}% công suất bị đốt nóng dây` : 'không có dòng';
      $('rU').textContent = `${fmt(C.U2 / 1e3, 1)} kV`;
      $('rUf').textContent = on ? `sụt ${fmt(C.drop * 100, 1)}% so với ${kvText(C.kv)}` : 'mất điện';
      $('rTw').textContent = `${fmt(C.Tw)} °C`; bar('bTw', (C.Tw / 300) * 100, wireCol);
      $('rTt').textContent = hasTransformer(C) ? `${fmt(C.Tt)} °C` : 'không dùng';
      bar('bTt', (C.Tt / 160) * 100, rgb(ramp(WIRE_RAMP, 30 + (C.Tt - 40) * 2)));
    }
    if (!$('panel-reactor').hidden) {
      setLamps('rLamps', REACTOR_LAMPS, R);
      const pct = (R.Pf / RATED) * 100, m = R.flow * FLOW_NOM, dT = outletTemp(R) - T_IN;
      $('rodV').textContent = `${fmt(R.rod, 1)}%`;
      $('rPf').textContent = `${fmt(R.Pf / 1e6)} MWt`;
      $('rPf2').textContent = `${fmt(pct, pct < 1 ? 2 : 0)}% công suất định mức 3 000 MWt`;
      $('rDh').textContent = `${fmt((R.D1 + R.D2) / 1e6)} MW`;
      $('rQf').textContent = m > 1 ? `${fmt(m)} kg/s × 5,5 kJ/kg·K × ${fmt(dT, 1)} K` : 'không có dòng chảy, nhiệt bị giữ trong lõi';
      $('rQ').textContent = `${fmt(R.Qout / 1e6)} MW`;
      const bal = ((R.Qgen - R.Qout) / C_CORE) * 60;
      $('rBal').textContent = `${bal >= 0 ? '+' : ''}${fmt(bal, 1)} K/phút`;
      $('rBal').style.color = bal > 5 ? 'var(--hot)' : '';
      $('rVoid').textContent = R.rbmk ? ' + hệ số rỗng dương (RBMK)' : '';
      $('rRho').textContent = `${R.rho >= 0 ? '+' : ''}${fmt(R.rho, 1)}`;
      $('rT').textContent = `${fmt(R.T)} °C`; bar('bT', (R.T / 2800) * 100, rgb(ramp(FUEL_RAMP, R.T)));
      $('rP').textContent = `${fmt(R.p, 1)} MPa`; bar('bP', (R.p / 25) * 100, R.p > 17 ? 'var(--hot)' : 'var(--amber)');
      $('rH').textContent = `${fmt(R.H2)}%`; bar('bH', R.H2, 'var(--hot)');
      $('rPe').textContent = `${fmt(R.Pe / 1e6)} MWe`;
      const len = 10 + R.plume * 120, pl = $('plume');
      pl.setAttribute('rx', len); pl.setAttribute('ry', 6 + R.plume * 26);
      pl.setAttribute('transform', `translate(120 105) rotate(${R.wind - 90}) translate(${len} 0)`);
      pl.setAttribute('opacity', R.release > 0 ? 0.2 + R.plume * 0.45 : 0);
      $('windArrow').setAttribute('transform', `rotate(${R.wind})`);
      $('windTxt').textContent = `Gió thổi về phía ${windName(R)}, 6 m/s.${R.release > 0 ? ` Đám mây phóng xạ đã lan khoảng ${fmt(R.plume * 60)} km.` : ' Chưa ghi nhận phóng xạ ra môi trường.'}`;
    }
    $('tag-line').textContent = `Đường dây ${fmt(C.L)} km · ${kvText(C.kv)}`;
  }

  return { sync, render, start: fromHash };
}
