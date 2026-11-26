// Giao diện HTML: thanh chỉ số quốc gia, công cụ xây dựng, bảng thanh tra công trình được chọn, bảng quốc gia.
import { fmt, esc, clamp, ramp, rgb, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import * as Game from '../game.js';
import { lineUsable, WIRE_FIRE_T, TX_FIRE_T, RHO_AL } from '../physics/network.js';
import { RATED, C_CORE, FLOW_NOM, outletTemp, T_IN, DIESEL_START, mwDisplay } from '../physics/reactor.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
const kvText = (v) => `${fmt(v, v === 10.5 ? 1 : 0)} kV`;
const money = (v) => `${fmt(v, 1)} tr USD`;
const STATE_TEXT = { ok: 'Đang vận hành', tripped: 'Rơ-le đã cắt', collapse: 'Cắt do sụp đổ điện áp', fire: 'Cháy, đứt dây' };
const TYPE_TEXT = { nuclear: 'Nhà máy hạt nhân', coal: 'Nhà máy nhiệt điện than', sub: 'Trạm biến áp', city: 'Thành phố' };

const REACTOR_LAMPS = [
  ['SCRAM', (R) => R.scram, 'warn'], ['Mất lưới ngoài', (R) => !R.offsite, 'warn'],
  ['Diesel chạy', (R) => !R.offsite && R.diesel && R.dieselT >= DIESEL_START, 'info'],
  ['Lưu lượng thấp', (R) => R.flow < 0.6, 'warn'], ['Van xả mở', (R) => R.porvOpen, 'warn'],
  ['Hiệu ứng AZ-3', (R) => R.az > 1, 'bad'], ['Hư hại nhiên liệu', (R) => R.dmg, 'bad'],
  ['Hydro >50%', (R) => R.H2 > 50, 'bad'], ['Mất nước (LOCA)', (R) => R.loca, 'bad'],
  ['Nóng chảy lõi', (R) => R.melt, 'bad'], ['Rò phóng xạ', (R) => R.release > 0, 'bad'],
];
const SYSTEMS = [['diesel', 'Diesel sẵn sàng'], ['porv', 'Van xả áp'], ['rps', 'Tự động SCRAM'], ['rbmk', 'Kiểu RBMK']];
const bar = (id, marks = []) => `<div class="bar"><i id="${id}"></i>${marks.map((m) => `<b style="left:${m}%"></b>`).join('')}</div>`;
const row = (label, sub, id, extra = '') => `<div><dt>${label}${sub ? `<small id="${id}s">${sub}</small>` : ''}</dt><dd id="${id}"></dd>${extra}</div>`;

export function createHud(G, { onTool, onView, onSelect, onQuality }) {
  const ui = { tool: 'select', selection: null, newKv: 220, newA: 400, quality: true, inspKey: '' };

  const seg = (id, values, label, get, setv) => {
    const el = $(id);
    el.innerHTML = values.map((v) => `<button type="button" data-v="${v}">${label(v)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setv(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); syncSegs(); } });
    el._get = get;
  };
  const syncSegs = () => {
    for (const id of ['speed', 'tools', 'views', 'newKv', 'newA']) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v) === String($(id)._get()));
  };
  seg('speed', [1, 10, 60, 300, 0], (v) => (v ? `${v}×` : 'Dừng'), () => G.speed, (v) => (G.speed = v));
  seg('tools', ['select', 'sub', 'line'], (v) => ({ select: 'Chọn', sub: 'Xây trạm', line: 'Kéo dây' }[v]), () => ui.tool, (v) => { ui.tool = v; onTool(v); });
  let view = 'overview';
  seg('views', ['overview', 'nuclear', 'capital', 'west'], (v) => ({ overview: 'Toàn cảnh', nuclear: 'Hạt nhân', capital: 'Thủ phủ', west: 'Miền Tây' }[v]), () => view, (v) => { view = v; onView(v); });
  seg('newKv', [10.5, 110, 220, 500], kvText, () => ui.newKv, (v) => (ui.newKv = v));
  seg('newA', [95, 150, 240, 400, 630], (v) => v, () => ui.newA, (v) => (ui.newA = v));
  $('skipDN').addEventListener('click', () => Game.skipDayNight(G));
  $('quality').addEventListener('click', () => { ui.quality = !ui.quality; $('quality').textContent = `Đồ hoạ: ${ui.quality ? 'cao' : 'thấp'}`; onQuality(ui.quality); });

  // ---------- Bảng quốc gia ----------
  $('gacha').addEventListener('click', () => Game.gacha(G));
  $('engAuto').addEventListener('click', () => { G.engAuto = !G.engAuto; });
  $('engFire').addEventListener('click', () => Game.fireEngineer(G));
  $('inspect').addEventListener('click', () => Game.antiCorruption(G));
  $('print').addEventListener('click', () => Game.printMoney(G));
  $('scenarios').innerHTML = Game.SCENARIOS.map(([l], i) => `<button class="btn" type="button" data-i="${i}">${l}</button>`).join('');
  $('scenarios').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { Game.SCENARIOS[+b.dataset.i][1](G); ui.inspKey = ''; } });
  G.listeners.add((items) => {
    const html = items.map((n) => `<span class="${n.level}">${esc(Game.clockText(n.t))} · ${esc(n.text)}</span>`).join('');
    $('track').innerHTML = html + html;
    $('log').innerHTML = items.map((n) => `<li class="${n.level}"><time>${esc(Game.clockText(n.t).slice(-5))}</time> ${esc(n.text)}</li>`).join('');
  });
  $('lineRows').addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) select({ kind: 'line', id: tr.dataset.id }); });

  // ---------- Bảng thanh tra ----------
  const insp = $('inspector');
  function select(sel) { ui.selection = sel; ui.inspKey = ''; onSelect(sel); }

  function inspectorHtml() {
    const s = ui.selection;
    if (!s) return `<h2>Thanh tra công trình</h2><p class="note">Bấm vào nhà máy, trạm biến áp, thành phố hoặc đường dây trên bản đồ để xem thông số và điều khiển.</p><p class="note">Dùng <b>Xây trạm</b> để đặt trạm mới lên mặt đất, <b>Kéo dây</b> để nối hai công trình: chọn điểm đầu rồi điểm cuối. Chiều dài và điện trở R = ρ·L/A được tính tự động.</p>`;
    if (s.kind === 'line') {
      const l = Game.lineById(G, s.id), a = Game.nodeById(G, l.a), b = Game.nodeById(G, l.b);
      return `<h2>${esc(a.name)} – ${esc(b.name)}</h2>
        <p class="tag2">${kvText(l.kv)} · ${l.A} mm² · ${fmt(l.L)} km${l.quality > 1.01 ? ` · <span class="badq">vật tư kém +${fmt((l.quality - 1) * 100)}% điện trở</span>` : ''}</p>
        <dl>${row('Điện trở R = ρ·L/A', `${fmt(RHO_AL * 1e8, 2)}·10⁻⁸ × ${fmt(l.L * 1000)} m ÷ ${l.A}·10⁻⁶ m²${l.quality > 1.01 ? ` × ${fmt(l.quality, 2)}` : ''}, tính cả nóng lên`, 'iR')}
        ${row('Công suất truyền', '', 'iP')}
        ${row('Dòng điện I', 'ngưỡng rơ-le', 'iI')}
        ${row('Tổn hao I²R', '', 'iL')}
        ${row('Sụt áp I·R / U', '', 'iU')}
        ${row('Nhiệt độ dây', 'võng ở 80 °C · cháy ở 250 °C', 'iT', bar('iTb', [26.7, 83.3]))}
        ${row('Trạng thái', '', 'iS')}</dl>
        <div class="row sp"><label for="iImax">Ngưỡng cắt rơ-le <output id="iImaxV"></output></label><input type="range" id="iImax" min="200" max="4000" step="50" value="${l.Imax}"></div>
        <div class="btns"><button class="btn" data-act="breaker" type="button"></button><button class="btn" data-act="relay" type="button"></button>
        <button class="btn" data-act="repair" type="button" ${l.state === 'fire' ? '' : 'hidden'}>Sửa (${money(0.2 * Game.lineCost(G, l.L, l.kv, l.A))})</button>
        <button class="btn danger" data-act="demolish" type="button">Tháo dỡ</button></div>`;
    }
    const n = Game.nodeById(G, s.id);
    const head = `<h2>${esc(n.name)}</h2><p class="tag2">${TYPE_TEXT[n.type]} · máy biến áp ${fmt(n.rated)} MVA</p>`;
    const tx = row('Nhiệt độ dầu máy biến áp', 'cháy ở 150 °C', 'nT', bar('nTb', [93.7]));
    const repair = `<div class="btns"><button class="btn" data-act="repairNode" type="button" ${n.state === 'fire' ? '' : 'hidden'}>Thay máy biến áp (${money(Game.NODE_REPAIR * G.priceLevel)})</button></div>`;
    if (n.type === 'city') return `${head}<dl>${row('Nhu cầu lúc này', 'theo giờ trong ngày và nhiệt độ', 'cD')}${row('Được cấp', '', 'cS')}${row('Tần số tại chỗ', '', 'cH')}${tx}</dl>${repair}`;
    if (n.type === 'sub') return `${head}<dl>${row('Công suất đi qua', '', 'sP')}${row('Số tuyến nối vào', '', 'sN')}${tx}</dl>${repair}`;
    if (n.type === 'coal') return `${head}<dl>${row('Đang phát', 'điều độ tự động bù phần hạt nhân thiếu', 'kG')}${row('Chi phí than', `${Game.COAL_USD_MWH} USD/MWh × chỉ số giá`, 'kC')}${tx}</dl>
      <div class="row sp"><label for="kMax">Công suất khả dụng <output id="kMaxV"></output></label><input type="range" id="kMax" min="0" max="600" step="10" value="${G.coalMax}"></div>${repair}`;
    return `${head}
      <div class="screen" id="rScreen"></div>
      <div class="row sp"><label for="rod">Thanh điều khiển rút ra <output id="rodV"></output></label><input type="range" id="rod" min="0" max="100" step="0.5"></div>
      <div class="btns"><button class="btn scram" data-act="scram" type="button"></button></div>
      <p class="lab sp">Bơm làm mát</p><div class="btns" id="pumps">${[0, 1, 2, 3].map((i) => `<button class="btn" data-act="pump" data-i="${i}" type="button">Bơm ${i + 1}</button>`).join('')}</div>
      <p class="lab">Hệ thống</p><div class="btns" id="sys">${SYSTEMS.map(([k, l]) => `<button class="btn" data-act="sys" data-k="${k}" type="button">${l}</button>`).join('')}<button class="btn" data-act="gridFault" type="button">Sự cố lưới ngoài</button></div>
      <div class="lamps sp" id="rLamps">${REACTOR_LAMPS.map(([l, , k]) => `<div class="lamp ${k}">${l}</div>`).join('')}</div>
      <dl>${row('Công suất phân hạch', '', 'rPf')}${row('Nhiệt phân rã', 'vẫn sinh nhiệt sau khi dập lò', 'rDh')}
      ${row('Nước mang nhiệt đi Q = m·c·ΔT', '', 'rQ')}${row('Cân bằng nhiệt', 'Q sinh − Q tản', 'rBal')}
      ${row('Độ phản ứng ρ', 'thanh − nhiệt độ + hơi (RBMK) + AZ-3', 'rRho')}${row('Điện phát lên lưới', 'hiệu suất chu trình hơi 33%', 'rPe')}
      ${row('Nhiệt độ lõi', 'hư hại 1 100 °C · nóng chảy 2 800 °C', 'rT', bar('rTb', [39.3]))}
      ${row('Áp suất sơ cấp', 'van xả 17 MPa · vỡ ống 22 MPa', 'rP', bar('rPb', [68, 88]))}
      ${row('Hydro trong nhà lò', 'nổ khi đạt 100%', 'rH', bar('rHb'))}</dl>
      <p class="note" id="rWind"></p>`;
  }

  insp.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = ui.selection, R = G.reactor, act = b.dataset.act;
    if (act === 'breaker') Game.toggleBreaker(G, s.id);
    if (act === 'relay') { const l = Game.lineById(G, s.id); l.relay = !l.relay; }
    if (act === 'repair') { Game.repairLine(G, s.id); ui.inspKey = ''; }
    if (act === 'demolish') { Game.demolishLine(G, s.id); select(null); }
    if (act === 'repairNode') { Game.repairNode(G, s.id); ui.inspKey = ''; }
    if (act === 'scram') {
      R.scram = !R.scram;
      if (R.scram) Game.news(G, 'Người vận hành nhấn SCRAM bằng tay.', 'warn'); else R.rodCmd = R.rod;
    }
    if (act === 'pump') { const i = +b.dataset.i; R.pumps[i] = R.pumps[i] ? 0 : 1; }
    if (act === 'sys') R[b.dataset.k] = !R[b.dataset.k];
    if (act === 'gridFault') G.gridFault = !G.gridFault;
  });
  insp.addEventListener('input', (e) => {
    const s = ui.selection;
    if (e.target.id === 'iImax') Game.lineById(G, s.id).Imax = +e.target.value;
    if (e.target.id === 'kMax') G.coalMax = +e.target.value;
    if (e.target.id === 'rod' && !G.reactor.scram) G.reactor.rodCmd = +e.target.value;
  });

  const barSet = (id, pct, color) => { const b = $(id); if (b) { b.style.width = `${clamp(pct, 0, 100)}%`; b.style.background = color; } };
  const press = (sel, on) => { const e = insp.querySelector(sel); if (e) e.setAttribute('aria-pressed', on); };

  function renderInspector() {
    const s = ui.selection;
    if (s && ((s.kind === 'line' && !Game.lineById(G, s.id)) || (s.kind === 'node' && !Game.nodeById(G, s.id)))) { ui.selection = null; ui.inspKey = ''; }
    const key = s ? `${s.kind}:${s.id}:${s.kind === 'line' ? Game.lineById(G, s.id)?.state : Game.nodeById(G, s.id)?.state}` : 'none';
    if (key !== ui.inspKey) { ui.inspKey = key; insp.innerHTML = inspectorHtml(); }
    if (!s) return;
    if (s.kind === 'line') {
      const l = Game.lineById(G, s.id);
      set('iR', `${fmt(l.R, 2)} Ω`); set('iP', `${fmt(Math.abs(l.P))} MW`);
      set('iI', `${fmt(l.I)} A`); set('iIs', `ngưỡng rơ-le ${fmt(l.Imax)} A${l.relay ? '' : ' (đang tắt)'}`);
      set('iL', `${fmt(l.loss / 1e6, 1)} MW`); set('iU', `${fmt(l.drop * 100, 1)}%`);
      set('iT', `${fmt(l.Tw)} °C`); barSet('iTb', (l.Tw / 300) * 100, rgb(ramp(WIRE_RAMP, l.Tw)));
      set('iS', l.state === 'ok' && !l.closed ? 'Máy cắt đang mở' : STATE_TEXT[l.state]);
      set('iImaxV', `${fmt(l.Imax)} A`);
      const br = insp.querySelector('[data-act=breaker]');
      if (br) br.textContent = l.state === 'tripped' || l.state === 'collapse' ? 'Đóng lại máy cắt' : l.closed ? 'Mở máy cắt' : 'Đóng máy cắt';
      const rl = insp.querySelector('[data-act=relay]');
      if (rl) { rl.textContent = l.relay ? 'Rơ-le: bật' : 'Rơ-le: tắt'; rl.setAttribute('aria-pressed', l.relay); }
      return;
    }
    const n = Game.nodeById(G, s.id);
    set('nT', `${fmt(n.Tt)} °C`); barSet('nTb', (n.Tt / 160) * 100, rgb(ramp(WIRE_RAMP, 30 + (n.Tt - 40) * 2)));
    if (n.type === 'city') {
      set('cD', `${fmt(n.demand)} MW`); set('cS', `${fmt(n.served)} MW (${fmt(n.frac * 100)}%)`);
      set('cH', n.frac > 0 ? `${fmt(n.hz, 2)} Hz` : 'mất điện');
    } else if (n.type === 'sub') {
      set('sP', `${fmt(n.through)} MW`); set('sN', `${G.net.lines.filter((l) => l.a === n.id || l.b === n.id).length}`);
    } else if (n.type === 'coal') {
      set('kG', `${fmt(n.gen)} MW`); set('kC', `${fmt((n.gen * Game.COAL_USD_MWH * G.priceLevel) / 1e3, 1)} nghìn USD/giờ`);
      set('kMaxV', `${fmt(G.coalMax)} MW`);
    } else {
      const R = G.reactor, pct = (R.Pf / RATED) * 100, m = R.flow * FLOW_NOM, dT = outletTemp(R) - T_IN;
      const sc = $('rScreen');
      if (sc) { sc.textContent = `${mwDisplay(R)} MW`; sc.classList.toggle('alarm', R.Pf > 1.2 * RATED || R.boom); }
      set('rodV', `${fmt(R.rod, 1)}%`);
      const rod = $('rod'); if (rod && document.activeElement !== rod) { rod.value = R.scram ? 0 : R.rodCmd; rod.disabled = R.scram; }
      const sb = insp.querySelector('[data-act=scram]'); if (sb) sb.textContent = R.scram ? 'Giải trừ SCRAM' : 'SCRAM';
      R.pumps.forEach((p, i) => press(`[data-act=pump][data-i="${i}"]`, !!p));
      SYSTEMS.forEach(([k]) => press(`[data-k=${k}]`, !!R[k]));
      press('[data-act=gridFault]', G.gridFault);
      [...($('rLamps')?.children ?? [])].forEach((el, i) => el.classList.toggle('on', !!REACTOR_LAMPS[i][1](R)));
      set('rPf', `${fmt(R.Pf / 1e6)} MWt`); set('rPfs', `${fmt(pct, pct < 1 ? 2 : 0)}% định mức 3 000 MWt`);
      set('rDh', `${fmt((R.D1 + R.D2) / 1e6)} MW`);
      set('rQ', `${fmt(R.Qout / 1e6)} MW`); set('rQs', m > 1 ? `${fmt(m)} kg/s × 5,5 kJ/kg·K × ${fmt(dT, 1)} K` : 'không có dòng chảy, nhiệt bị giữ trong lõi');
      const bal = ((R.Qgen - R.Qout) / C_CORE) * 60;
      set('rBal', `${bal >= 0 ? '+' : ''}${fmt(bal, 1)} K/phút`); $('rBal').style.color = bal > 5 ? 'var(--hot)' : '';
      set('rRho', `${R.rho >= 0 ? '+' : ''}${fmt(R.rho, 1)}${R.az > 0.5 ? ` (AZ-3 +${fmt(R.az, 0)})` : ''}`);
      set('rPe', `${fmt(R.Pe / 1e6)} MWe`);
      set('rT', `${fmt(R.T)} °C`); barSet('rTb', (R.T / 2800) * 100, rgb(ramp(FUEL_RAMP, R.T)));
      set('rP', `${fmt(R.p, 1)} MPa`); barSet('rPb', (R.p / 25) * 100, R.p > 17 ? 'var(--hot)' : 'var(--amber)');
      set('rH', `${fmt(R.H2)}%`); barSet('rHb', R.H2, 'var(--hot)');
      set('rWind', `Gió thổi về phía ${Game.windName(R)}.${R.release > 0 ? ` Đám mây phóng xạ đã lan khoảng ${fmt(R.plume * 60)} km.` : ''}${R.rbmk ? ' Lò RBMK: SCRAM khi lõi đã quá ~375 °C sẽ kích hoạt bẫy AZ-3.' : ''}`);
    }
  }

  let rowsKey = '';
  function render() {
    const S = G.net.summary ?? { demand: 0, served: 0, gen: 0, loss: 0, hz: 0 };
    set('clock', Game.clockText(G.t));
    { const h = Game.hourOfDay(G); set('skipDN', h >= 7 && h < 20 ? 'Tua tới tối' : 'Tua tới sáng'); } set('budget', money(G.budget));
    set('apV', `${fmt(G.approval)}%`); barSet('apBar', G.approval, G.approval < 30 ? 'var(--hot)' : G.approval < 50 ? 'var(--amber)' : 'var(--cool)');
    const secPct = S.demand > 0 ? (S.served / S.demand) * 100 : 100;
    set('sec', `${fmt(secPct)}%`); $('sec').className = secPct < 99 ? 'bad' : '';
    set('hz', S.hz ? `${fmt(S.hz, 2)} Hz` : '—'); $('hz').className = S.hz && Math.abs(S.hz - 50) > 0.5 ? 'bad' : '';
    set('infl', `${fmt(G.inflation, 1)}%`); $('infl').className = G.inflation > 6 ? 'bad' : '';
    set('corr', `${fmt(G.corruption)}%`); $('corr').className = G.corruption > 35 ? 'bad' : '';
    set('gDem', `${fmt(S.demand)} / ${fmt(S.served)} MW`); set('gGen', `${fmt(G.reactor.Pe / 1e6)} + ${fmt(Game.nodeById(G, 'coal').gen)} MW`);
    set('gLoss', `${fmt(S.loss, 1)} MW`);
    set('costNote', `Giá tuyến mới ≈ ${fmt(Game.lineCost(G, 1, ui.newKv, ui.newA) * 1000)} nghìn USD/km · trạm ${money(Game.subCost(G))} (đã gồm lạm phát và tham nhũng ${fmt(G.corruption)}%).`);
    const key = G.net.lines.map((l) => l.id).join() + (ui.selection?.id ?? '');
    if (key !== rowsKey) {
      rowsKey = key;
      $('lineRows').innerHTML = G.net.lines.map((l) => `<tr data-id="${l.id}" class="${ui.selection?.id === l.id ? 'sel' : ''}"><td>${esc(Game.nodeById(G, l.a).name)} – ${esc(Game.nodeById(G, l.b).name)}<small>${kvText(l.kv)} · ${l.A} mm²</small></td><td data-c="P"></td><td data-c="I"></td><td data-c="T"></td></tr>`).join('');
    }
    for (const tr of $('lineRows').children) {
      const l = Game.lineById(G, tr.dataset.id); if (!l) continue;
      const c = tr.children;
      c[1].textContent = lineUsable(l) ? fmt(Math.abs(l.P)) : '—';
      c[2].textContent = lineUsable(l) ? fmt(l.I) : STATE_TEXT[l.state] && l.state !== 'ok' ? '✕' : 'mở';
      c[3].textContent = fmt(l.Tw);
      tr.classList.toggle('hot', l.Tw > 80 || l.state === 'fire');
    }
    const E = G.engineer;
    const ek = E ? `${E.tier}${G.engAuto}` : 'none';
    if ($('engCard').dataset.k !== ek) {
      $('engCard').dataset.k = ek;
      $('engCard').innerHTML = E
        ? `<b class="t-${E.tier}">${esc(E.name)}</b><span>Chuyên môn ${E.skill}/100 · lương ${money(E.salary)}/ngày</span><small>${esc(E.desc)}</small>`
        : '<b>Chưa thuê kỹ sư</b><small>Bạn đang tự vận hành lò. Gacha để thuê người tự động bám tải, giữ nhiệt độ an toàn. Tham nhũng cao thì dễ trúng kỹ sư rởm.</small>';
    }
    set('gacha', `Gacha kỹ sư (${money(Game.GACHA_COST * G.priceLevel)})`);
    set('engAuto', G.engAuto ? 'Kỹ sư: tự vận hành' : 'Kỹ sư: tạm dừng');
    $('engAuto').disabled = $('engFire').disabled = !E;
    set('inspect', `Thanh tra tham nhũng (${money(Game.INSPECT_COST * G.priceLevel)})`);
    set('print', `In thêm tiền (+${Game.PRINT_AMOUNT} tr, +lạm phát)`);
    renderInspector();
  }

  function setModeHint(text) { set('modeHint', text); $('modeHint').hidden = !text; }

  syncSegs();
  return { ui, render, select, setModeHint, syncSegs };
}
