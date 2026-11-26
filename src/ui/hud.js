// Giao diện HTML: thanh chỉ số quốc gia, công cụ xây dựng, bảng thanh tra công trình được chọn, bảng quốc gia.
import { fmt, esc, clamp, ramp, rgb, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import * as Game from '../game.js';
import { has, spotPrice } from '../policy.js';
import { lineUsable, WIRE_FIRE_T, TX_FIRE_T, RHO_AL } from '../physics/network.js';
import { RATED, C_CORE, FLOW_NOM, outletTemp, T_IN, mwDisplay, dieselRunning, busPower, gridFeeds } from '../physics/reactor.js';
import * as World from '../world.js';
import * as Infra from '../infra.js';
import { current as weatherNow, cycleWeather } from '../weather.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
const kvText = (v) => `${fmt(v, v === 10.5 ? 1 : 0)} kV`;
const money = (v) => `${fmt(v, 1)} tr USD`;
const STATE_TEXT = { ok: 'Đang vận hành', tripped: 'Rơ-le đã cắt', collapse: 'Cắt do sụp đổ điện áp', fire: 'Cháy, đứt dây' };
const TYPE_TEXT = { nuclear: 'Nhà máy hạt nhân', coal: 'Nhà máy nhiệt điện than', sub: 'Trạm biến áp', city: 'Thành phố', hydro: 'Nhà máy thủy điện', border: 'Đường dây liên kết quốc tế' };

const REACTOR_LAMPS = [
  ['SCRAM', (R) => R.scram, 'warn'], ['Mất lưới ngoài', (R) => !R.offsite, 'warn'],
  ['Diesel chạy', (R) => dieselRunning(R), 'info'],
  ['Lưu lượng thấp', (R) => R.flow < 0.6, 'warn'], ['Van xả mở', (R) => R.porvOpen, 'warn'],
  ['Hiệu ứng AZ-3', (R) => R.az > 1, 'bad'], ['Hư hại nhiên liệu', (R) => R.dmg, 'bad'],
  ['Hydro >50%', (R) => R.H2 > 50, 'bad'], ['Mất nước (LOCA)', (R) => R.loca, 'bad'],
  ['Nóng chảy lõi', (R) => R.melt, 'bad'], ['Rò phóng xạ', (R) => R.release > 0, 'bad'],
];
const SYSTEMS = [['diesel', 'Diesel sẵn sàng'], ['porv', 'Van xả áp'], ['rps', 'Tự động SCRAM'], ['rbmk', 'Kiểu RBMK']];
const bar = (id, marks = []) => `<div class="bar"><i id="${id}"></i>${marks.map((m) => `<b style="left:${m}%"></b>`).join('')}</div>`;
const row = (label, sub, id, extra = '') => `<div><dt>${label}${sub ? `<small id="${id}s">${sub}</small>` : ''}</dt><dd id="${id}"></dd>${extra}</div>`;

export function createHud(G, { onTool, onView, onSelect, onQuality }) {
  const ui = { tool: 'select', selection: null, newKv: 220, newA: 400, sc: false, quality: true, inspKey: '', unit: 1 };
  const curR = () => (ui.unit === 2 && G.reactor2 ? G.reactor2 : G.reactor);

  const seg = (id, values, label, get, setv) => {
    const el = $(id);
    el.innerHTML = values.map((v) => `<button type="button" data-v="${v}">${label(v)}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setv(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); syncSegs(); } });
    el._get = get;
  };
  const syncSegs = () => {
    for (const id of ['speed', 'tools', 'views', 'newKv', 'newA']) for (const b of $(id).children) b.setAttribute('aria-pressed', String(b.dataset.v) === String($(id)._get()));
    for (const b of $('buildMenu').querySelectorAll('[data-b]')) b.setAttribute('aria-pressed', ui.tool === `build:${b.dataset.b}`);
  };
  seg('speed', [1, 10, 60, 300, 0], (v) => (v ? `${v}×` : 'Dừng'), () => G.speed, (v) => (G.speed = v));
  seg('tools', ['select', 'build', 'line', 'sell'], (v) => ({ select: 'Chọn', build: 'Xây dựng ▾', line: 'Kéo dây', sell: 'Bán' }[v]), () => (ui.tool.startsWith('build') ? 'build' : ui.tool),
    (v) => { if (v === 'build') { $('buildMenu').hidden = !$('buildMenu').hidden; return; } $('buildMenu').hidden = true; ui.tool = v; onTool(v); });
  $('buildMenu').innerHTML = `<p class="lab">Năng lượng & đô thị</p>${['sub', 'wind', 'tower', 'city'].map((k) => `<button class="bitem" type="button" data-b="${k}"><b>${Infra.BUILDS[k].name}</b><small>${Infra.BUILDS[k].desc}</small><span data-cost="${k}"></span></button>`).join('')}
    <p class="lab">Giao thông</p>${['road', 'port', 'airport'].map((k) => `<button class="bitem" type="button" data-b="${k}"><b>${Infra.BUILDS[k].name}</b><small>${Infra.BUILDS[k].desc}</small><span data-cost="${k}"></span></button>`).join('')}`;
  $('buildMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (!b) return; ui.tool = `build:${b.dataset.b}`; $('buildMenu').hidden = true; onTool(ui.tool); });
  $('weatherBtn').addEventListener('click', () => cycleWeather(G));
  let view = 'overview';
  seg('views', ['overview', 'nuclear', 'capital', 'west'], (v) => ({ overview: 'Toàn cảnh', nuclear: 'Hạt nhân', capital: 'Thủ phủ', west: 'Miền Tây' }[v]), () => view, (v) => { view = v; onView(v); });
  seg('newKv', [10.5, 110, 220, 500, 750], kvText, () => ui.newKv, (v) => (ui.newKv = v));
  $('sc').addEventListener('click', () => { ui.sc = !ui.sc; });
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
    if (s.kind === 'infra') {
      const it = G.infra.find((x) => x.id === s.id);
      return `<h2>${esc(it.name)}</h2><p class="tag2">${esc(Infra.BUILDS[it.type].desc)}</p><dl>${row('Giá đã xây', '', 'xC')}${row('Hiệu lực hiện tại', '', 'xE')}</dl>
        <div class="btns"><button class="btn danger" data-act="sellInfra" type="button">Bán (thu hồi 70%)</button></div>`;
    }
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
    const head = `<h2>${esc(n.name)}</h2><p class="tag2">${TYPE_TEXT[n.type]} · máy biến áp ${fmt(n.rated)} MVA</p>${n.type === 'border' ? '' : '<div class="btns"><button class="btn" data-act="guard" type="button"></button></div>'}`;
    const tx = row('Nhiệt độ dầu máy biến áp', 'cháy ở 150 °C', 'nT', bar('nTb', [93.7]));
    const repair = `<div class="btns"><button class="btn" data-act="repairNode" type="button" ${n.state === 'fire' ? '' : 'hidden'}>Thay máy biến áp (${money(Game.NODE_REPAIR * G.priceLevel)})</button>${n.sellable ? `<button class="btn danger" data-act="sellNode" type="button">Bán (thu hồi ${money(0.7 * n.cost)})</button>` : ''}</div>`;
    if (n.type === 'wind') return `${head}<dl>${row('Đang phát', 'theo lập phương tốc độ gió, định mức 12 m/s', 'wG')}${row('Gió lúc này', 'ngắt bảo vệ khi trên 25 m/s', 'wW')}${tx}</dl>${repair}`;
    if (n.type === 'mine') return `${head}<dl>${row('Điện cấp cho mỏ', 'mất điện thì ngừng khai thác', 'mP')}${row('Uranium trong kho', '', 'mU')}${row('Đất hiếm trong kho', '', 'mR')}${tx}</dl>${repair}`;
    if (n.type === 'city') return `${head}<dl>${row('Nhu cầu lúc này', 'theo giờ trong ngày và nhiệt độ', 'cD')}${row('Được cấp', '', 'cS')}${row('Tần số tại chỗ', '', 'cH')}${tx}</dl>${repair}`;
    if (n.type === 'hydro') return `${head}<dl>${row('Đang phát', 'chạy sau hạt nhân, trước nhiệt điện; không tốn nhiên liệu', 'hG')}${row('Công suất tối đa', '', 'hM')}${tx}</dl>${repair}`;
    if (n.type === 'border') return `${head}<dl>${row('Hợp đồng xuất khẩu', 'quản lý ở bảng Thị trường điện bên dưới', 'bC')}${row('Đang giao', '', 'bS')}${row('Giá giao ngay', 'cao nhất 19–20 giờ', 'bP')}${tx}</dl>${repair}`;
    if (n.type === 'sub') return `${head}<dl>${row('Công suất đi qua', '', 'sP')}${row('Số tuyến nối vào', '', 'sN')}${tx}</dl>${repair}`;
    if (n.type === 'coal') return `${head}<dl>${row('Đang phát', 'điều độ tự động bù phần hạt nhân thiếu', 'kG')}${row('Chi phí than', `${Game.COAL_USD_MWH} USD/MWh × chỉ số giá`, 'kC')}${tx}</dl>
      <div class="row sp"><label for="kMax">Công suất khả dụng <output id="kMaxV"></output></label><input type="range" id="kMax" min="0" max="600" step="10" value="${G.coalMax}"></div>${repair}`;
    const u2 = G.unit2, tabs = G.reactor2 ? `<div class="seg sp" id="unitTabs"><button type="button" data-act="unit" data-u="1">Tổ máy 1</button><button type="button" data-act="unit" data-u="2">Tổ máy 2</button></div>` : '';
    const proj = G.reactor2 ? '' : u2.state === 'building'
      ? `<div class="proj sp"><b>Đang xây tổ máy số 2</b><div class="meter wide"><i id="u2bar"></i></div><small id="u2txt"></small></div>`
      : `<div class="proj sp"><b>Tổ máy số 2</b><small>${has(G, 'unit2') ? `Đã có thiết kế. Xây trong ${Game.UNIT2_DAYS} ngày.` : 'Cần nghiên cứu “Thiết kế tổ máy số 2” ở cây công nghệ.'}</small>
         <button class="btn" data-act="unit2" type="button" ${has(G, 'unit2') ? '' : 'disabled'}>Khởi công (${money(Game.unit2Cost(G))})</button></div>`;
    return `${head}${tabs}${proj}
      <div class="screen" id="rScreen"></div>
      <div class="row sp"><label for="rod">Thanh điều khiển rút ra <output id="rodV"></output></label><input type="range" id="rod" min="0" max="100" step="0.5"></div>
      <div class="btns"><button class="btn scram" data-act="scram" type="button"></button></div>
      <p class="lab sp">Bơm làm mát</p><div class="btns" id="pumps">${[0, 1, 2, 3].map((i) => `<button class="btn" data-act="pump" data-i="${i}" type="button">Bơm ${i + 1}</button>`).join('')}</div>
      <p class="lab sp">Lớp 3 · Sơ đồ điện tự dùng (bấm máy cắt để đóng/mở)</p>
      <svg class="sld" viewBox="0 0 360 176" role="img" aria-label="Sơ đồ thanh cái và máy cắt cấp điện cho bơm">
        <rect x="8" y="6" width="96" height="26" rx="5" class="src"/><text x="56" y="24">Lưới ngoài</text>
        <rect x="256" y="6" width="96" height="26" rx="5" class="src"/><text x="304" y="24">Diesel</text>
        <path id="wG" d="M56 32V50M56 70V86"/><path id="wD" d="M304 32V50M304 70V86"/>
        <path id="busA" class="bus" d="M16 86H166"/><path id="busB" class="bus" d="M194 86H344"/>
        <path id="wT" d="M166 86H170M190 86H194"/>
        ${[['cb1', 46, 50], ['cb2', 294, 50], ['cb3', 170, 76]].map(([k, x, y]) => `<g class="cb" data-act="cb" data-k="${k}"><rect id="${k}" x="${x}" y="${y}" width="20" height="20" rx="3"/><text x="${x + 10}" y="${y - 4}" class="sm">${k.toUpperCase()}</text></g>`).join('')}
        ${[46, 126, 234, 314].map((x, i) => `<path id="wP${i}" d="M${x} 86V128"/><circle id="pP${i}" cx="${x}" cy="142" r="14"/><text x="${x}" y="147" class="pt">B${i + 1}</text>`).join('')}
        <text x="91" y="104" class="sm">Thanh cái A</text><text x="269" y="104" class="sm">Thanh cái B</text>
      </svg>
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
    const s = ui.selection, R = curR(), act = b.dataset.act;
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
    if (act === 'cb') R.cb[b.dataset.k] = !R.cb[b.dataset.k];
    if (act === 'unit') { ui.unit = +b.dataset.u; ui.inspKey = ''; }
    if (act === 'unit2') { Game.startUnit2(G); ui.inspKey = ''; }
    if (act === 'guard') World.toggleGuard(G, s.id);
    if (act === 'sellNode' && Infra.sell(G, 'node', s.id)) select(null);
    if (act === 'sellInfra' && Infra.sell(G, 'infra', s.id)) select(null);
  });
  insp.addEventListener('input', (e) => {
    const s = ui.selection;
    if (e.target.id === 'iImax') Game.lineById(G, s.id).Imax = +e.target.value;
    if (e.target.id === 'kMax') G.coalMax = +e.target.value;
    if (e.target.id === 'rod' && !curR().scram) curR().rodCmd = +e.target.value;
  });

  const barSet = (id, pct, color) => { const b = $(id); if (b) { b.style.width = `${clamp(pct, 0, 100)}%`; b.style.background = color; } };
  const press = (sel, on) => { const e = insp.querySelector(sel); if (e) e.setAttribute('aria-pressed', on); };

  function renderInspector() {
    const s = ui.selection;
    if (s && ((s.kind === 'line' && !Game.lineById(G, s.id)) || (s.kind === 'node' && !Game.nodeById(G, s.id)) || (s.kind === 'infra' && !G.infra.some((x) => x.id === s.id)))) { ui.selection = null; ui.inspKey = ''; }
    const key = s ? `${s.kind}:${s.id}:${s.kind === 'line' ? Game.lineById(G, s.id)?.state : s.kind === 'infra' ? '' : Game.nodeById(G, s.id)?.state}:${ui.unit}:${G.unit2.state}:${has(G, 'unit2')}` : 'none';
    if (key !== ui.inspKey) { ui.inspKey = key; insp.innerHTML = inspectorHtml(); }
    if (!s) return;
    if (s.kind === 'infra') {
      const it = G.infra.find((x) => x.id === s.id);
      set('xC', money(it.cost));
      const eff = { tower: `nước làm mát −${3 * Math.min(3, Infra.count(G, 'tower'))} °C`, road: `mỏ +${25 * Infra.count(G, 'road')}% sản lượng`, port: 'đất hiếm +30% giá, phí cảng 0,3 tr/ngày', airport: 'gacha −30%, nghiên cứu +15%' }[it.type];
      set('xE', eff);
      return;
    }
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
    const gb = insp.querySelector('[data-act=guard]');
    if (gb) { const on = World.isGuarded(G, n.id); gb.textContent = on ? `Rút quân canh gác (${G.world.guards.length}/${G.world.troops})` : `Điều quân canh gác (${G.world.guards.length}/${G.world.troops})`; gb.setAttribute('aria-pressed', on); }
    set('nT', `${fmt(n.Tt)} °C`); barSet('nTb', (n.Tt / 160) * 100, rgb(ramp(WIRE_RAMP, 30 + (n.Tt - 40) * 2)));
    if (n.type === 'city') {
      set('cD', `${fmt(n.demand)} MW`); set('cS', `${fmt(n.served)} MW (${fmt(n.frac * 100)}%)`);
      set('cH', n.frac > 0 ? `${fmt(n.hz, 2)} Hz` : 'mất điện');
    } else if (n.type === 'wind') {
      set('wG', `${fmt(n.gen)} / ${fmt(n.cap)} MW`); set('wW', `${fmt(G.windNow ?? 0, 1)} m/s`);
    } else if (n.type === 'mine') {
      set('mP', n.frac > 0 ? `${fmt(n.served)} MW (${fmt(n.frac * 100)}%)` : 'mất điện'); set('mU', `${fmt(G.res.U, 1)} tấn`); set('mR', `${fmt(G.res.RE, 1)} tấn`);
    } else if (n.type === 'hydro') {
      set('hG', `${fmt(n.gen)} MW`); set('hM', `${fmt(Game.HYDRO_MAX)} MW`);
    } else if (n.type === 'border') {
      set('bC', G.market.exportOn ? `${fmt(G.market.contractMW)} MW` : 'chưa ký'); set('bS', `${fmt(n.served)} MW`);
      set('bP', `${fmt(spotPrice(G, Game.hourOfDay(G)))} USD/MWh`);
    } else if (n.type === 'sub') {
      set('sP', `${fmt(n.through)} MW`); set('sN', `${G.net.lines.filter((l) => l.a === n.id || l.b === n.id).length}`);
    } else if (n.type === 'coal') {
      set('kG', `${fmt(n.gen)} MW`); set('kC', `${fmt((n.gen * Game.COAL_USD_MWH * G.priceLevel) / 1e3, 1)} nghìn USD/giờ`);
      set('kMaxV', `${fmt(G.coalMax)} MW`);
    } else {
      const R = curR();
      [...($('unitTabs')?.children ?? [])].forEach((b) => b.setAttribute('aria-pressed', +b.dataset.u === ui.unit));
      if (G.unit2.state === 'building' && $('u2bar')) { $('u2bar').style.width = `${G.unit2.progress * 100}%`; $('u2bar').style.background = 'var(--amber)'; set('u2txt', `${fmt(G.unit2.progress * 100)}% · còn ${fmt((1 - G.unit2.progress) * Game.UNIT2_DAYS * 24, 1)} giờ`); }
      const bus = busPower(R), live = (id, on) => { const e = $(id); if (e) e.classList.toggle('live', !!on); };
      live('wG', R.offsite); live('wD', dieselRunning(R)); live('busA', bus.A); live('busB', bus.B); live('wT', bus.A && bus.B && R.cb.cb3);
      for (const k of ['cb1', 'cb2', 'cb3']) $(k)?.classList.toggle('closed', R.cb[k]);
      for (let i = 0; i < 4; i++) { live(`wP${i}`, bus[i < 2 ? 'A' : 'B']); const c = $(`pP${i}`); if (c) c.classList.toggle('run', !!(R.pumps[i] && bus[i < 2 ? 'A' : 'B'])); }
      void gridFeeds;
      const pct = (R.Pf / RATED) * 100, m = R.flow * FLOW_NOM, dT = outletTemp(R) - (T_IN + R.dTin);
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
    set('rep', `${fmt(G.reputation)}%`); $('rep').className = G.reputation < 30 ? 'bad' : '';
    { const w = weatherNow(G); set('wx', `${w.name} · ${fmt(G.windNow ?? 0, 0)} m/s`); $('wx').className = G.weather.id === 'storm' || G.weather.id === 'heatwave' ? 'bad' : ''; set('weatherBtn', `Thời tiết: ${w.name}`); }
    set('resU', `${fmt(G.res.U, 1)} t U · ${fmt(G.res.RE, 1)} t ĐH`); $('resU').className = G.res.U < 5 ? 'bad' : '';
    for (const el of $('buildMenu').querySelectorAll('[data-cost]')) { const k = el.dataset.cost, B = Infra.BUILDS[k]; el.textContent = `${money(Infra.buildCost(G, k))}${B.re ? ` + ${B.re} t đất hiếm` : ''}`; }
    for (const b of $('newKv').children) b.hidden = b.dataset.v === '750' && !has(G, 'uhv');
    if (ui.newKv === 750 && !has(G, 'uhv')) ui.newKv = 500;
    $('scWrap').hidden = !has(G, 'supercond'); if (!has(G, 'supercond')) ui.sc = false;
    $('sc').setAttribute('aria-pressed', ui.sc);
    set('gDem', `${fmt(S.demand)} / ${fmt(S.served)} MW`); set('gGen', `${fmt(Game.units(G).reduce((a, r) => a + r.Pe, 0) / 1e6)} + ${fmt(Game.nodeById(G, 'hydro').gen)} + ${fmt(Game.nodeById(G, 'coal').gen)} MW`);
    set('gLoss', `${fmt(S.loss, 1)} MW`);
    set('costNote', `Giá tuyến mới ≈ ${fmt(Game.lineCost(G, 1, ui.newKv, ui.newA, ui.sc) * 1000)} nghìn USD/km · trạm ${money(Game.subCost(G))} (đã gồm lạm phát và tham nhũng ${fmt(G.corruption)}%).`);
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
    set('gacha', `Gacha kỹ sư (${money(Game.gachaCost(G))})`);
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
