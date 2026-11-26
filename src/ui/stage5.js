// Bảng Giai đoạn 5: Thị trường điện · Chính trị · Cây công nghệ, và màn hình thua.
import { fmt, esc, clamp } from '../util.js';
import { hourOfDay, nodeById } from '../game.js';
import * as P from '../policy.js';
import * as W from '../world.js';
import * as I from '../infra.js';
import { WEATHERS, WEATHER_ORDER, windFarmMW, setWeather } from '../weather.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
const meter = (id) => `<div class="meter wide"><i id="${id}"></i></div>`;
const tone = (v) => (v < 25 ? 'var(--hot)' : v < 45 ? 'var(--amber)' : 'var(--cool)');

export function createStage5(G) {
  const root = $('s5');
  let tab = 'market';
  root.innerHTML = `
    <div class="s5head"><h2>Điều hành quốc gia</h2>
      <div class="seg" id="s5tabs">${[['market', 'Thị trường điện'], ['politics', 'Chính trị'], ['world', 'Ngoại giao & quân sự'], ['res', 'Tài nguyên & thời tiết'], ['tech', 'Cây công nghệ']].map(([k, l]) => `<button type="button" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="s5body" data-tab="market">
      <div class="cols3">
        <div>
          <h3>Giá bán lẻ trong nước</h3>
          <div class="row"><label for="retail">Giá niêm yết <output id="retailV"></output></label><input type="range" id="retail" min="35" max="120" step="1"></div>
          <p class="note" id="retailNote"></p>
        </div>
        <div>
          <h3>Giá giao ngay khu vực</h3>
          <div class="spot" id="spot"></div>
          <p class="note" id="spotNote"></p>
        </div>
        <div>
          <h3>Hợp đồng xuất khẩu</h3>
          <div class="row"><label for="contract">Công suất hợp đồng <output id="contractV"></output></label><input type="range" id="contract" min="50" max="600" step="25"></div>
          <div class="btns"><button class="btn" id="sign" type="button"></button><button class="btn" id="cancel" type="button">Huỷ hợp đồng</button>
          <button class="btn danger" id="weapon" type="button">Cắt điện gây sức ép</button></div>
          <dl class="mini"><div><dt>Đang giao</dt><dd id="expServed"></dd></div><div><dt>Thu từ xuất khẩu</dt><dd id="expRev"></dd></div></dl>
          <p class="note" id="expNote"></p>
        </div>
      </div>
    </div>
    <div class="s5body" data-tab="politics" hidden>
      <div class="cols3">
        <div>
          <h3>Phe phái</h3>
          <div class="fac"><b>Dân chúng <span id="fP"></span></b>${meter('fPb')}<small>Muốn điện rẻ, không mất điện, không phóng xạ, giá cả ổn định.</small></div>
          <div class="fac"><b>Doanh nghiệp & giới kỹ trị <span id="fB"></span></b>${meter('fBb')}<small>Muốn lợi nhuận, xuất khẩu, điện ổn định cho Bến Cảng; ghét độc quyền và thiết quân luật.</small></div>
          <div class="fac"><b>Quân đội <span id="fM"></span></b>${meter('fMb')}<small>Muốn an ninh năng lượng và ngân sách quốc phòng. Dưới 10% suốt một ngày là đảo chính.</small></div>
          <div class="fac"><b>Uy tín quốc tế <span id="fR"></span></b>${meter('fRb')}<small>Tăng khi giao đủ hợp đồng, giảm khi huỷ hoặc dùng điện làm vũ khí.</small></div>
        </div>
        <div class="span2">
          <h3>Sắc lệnh</h3>
          <div class="decrees">${P.DECREES.map((d) => `<button class="decree" type="button" data-d="${d.id}"><b>${d.name}</b><small>${d.desc}</small></button>`).join('')}</div>
          <p class="danger" id="dangerNote" hidden></p>
        </div>
      </div>
    </div>
    <div class="s5body" data-tab="world" hidden>
      <div class="cols3">
        <div>
          <h3>Bản đồ khu vực</h3>
          <svg class="wmap" viewBox="0 0 300 240" role="img" aria-label="Bản đồ quan hệ với các nước láng giềng">
            <path id="cn-north" d="M20 10H280L250 70H50Z"/><path id="cn-east" d="M255 80L295 30V215L255 165Z"/><path id="cn-south" d="M50 175H250L280 232H20Z"/>
            <path class="home" d="M55 78H245V168H55Z"/>
            <text x="150" y="46">Bắc Sơn</text><text x="276" y="128" class="v">Đông Lâm</text><text x="150" y="210">Nam Hải</text><text x="150" y="128" class="me">Nước ta</text>
          </svg>
          <p class="note">Màu biên giới: xanh là thân thiện, vàng là căng thẳng, đỏ là thù địch hoặc chiến tranh.</p>
        </div>
        <div>
          <h3>Các nước láng giềng</h3>
          <div id="countries">${'' /* điền bên dưới */}</div>
        </div>
        <div>
          <h3>Đề nghị đang chờ</h3>
          <div id="offers"></div>
          <h3 class="sp">Quân đội bảo vệ hạ tầng</h3>
          <p class="note" id="troopNote"></p>
          <div class="btns"><button class="btn" id="recruit" type="button"></button><button class="btn" id="disband" type="button">Giải thể 1 đơn vị</button></div>
          <div class="guards" id="guards"></div>
        </div>
      </div>
    </div>
    <div class="s5body" data-tab="res" hidden>
      <div class="cols3">
        <div>
          <h3>Kho tài nguyên</h3>
          <dl class="mini"><div><dt>Uranium<small id="uNote"></small></dt><dd id="uVal"></dd></div><div><dt>Đất hiếm<small id="reNote"></small></dt><dd id="reVal"></dd></div></dl>
          <div class="btns sp"><button class="btn" id="exportRE" type="button"></button></div>
          <p class="note">Mỏ là một phụ tải 60 MW trong lưới: mất điện thì ngừng khai thác. Mỗi tổ máy chạy định mức đốt khoảng 1 tấn uranium mỗi ngày; hết uranium là lò dừng.</p>
        </div>
        <div>
          <h3>Cây khai thác</h3>
          <div id="mineLv">${I.MINE_LEVELS.map((m, i) => `<div class="tech" data-m="${i}"><b>${m.name}</b><small>${m.desc}</small><button class="btn" type="button" data-m="${i}"></button></div>`).join('')}</div>
        </div>
        <div>
          <h3>Thời tiết</h3>
          <div class="seg" id="wxSeg">${WEATHER_ORDER.map((k) => `<button type="button" data-w="${k}">${WEATHERS[k].name}</button>`).join('')}</div>
          <dl class="mini sp"><div><dt>Không khí</dt><dd id="wTa"></dd></div><div><dt>Gió (trại gió 120 MW phát)</dt><dd id="wWind"></dd></div>
          <div><dt>Nước làm mát lò</dt><dd id="wTin"></dd></div><div><dt>Nước về hồ thủy điện</dt><dd id="wHydro"></dd></div></dl>
          <p class="note" id="wNote"></p>
          <h3 class="sp">Giao thông</h3><p class="note" id="trNote"></p>
        </div>
      </div>
    </div>
    <div class="s5body" data-tab="tech" hidden>
      <div class="techtop">
        <div><span class="lab">Điểm nghiên cứu</span><b class="big" id="rp"></b><small id="rpRate"></small></div>
        <div class="row grow"><label for="rbud">Ngân sách nghiên cứu <output id="rbudV"></output></label><input type="range" id="rbud" min="0" max="1" step="0.05"></div>
      </div>
      <div class="tree">${P.BRANCHES.map(([b, label]) => `<div class="branch"><h3>${label}</h3>${P.TECHS.filter((t) => t.branch === b).map((t) => `
        <div class="tech" data-t="${t.id}"><b>${t.name}</b><small>${t.desc}</small>
        <span class="req">${t.req.length ? `Cần: ${t.req.map((r) => P.TECHS.find((x) => x.id === r).name).join(', ')}` : 'Không cần tiền đề'}</span>
        <button class="btn" type="button" data-t="${t.id}">${t.cost} điểm</button></div>`).join('')}</div>`).join('')}</div>
    </div>`;

  const tabs = $('s5tabs');
  const showTab = (k) => {
    tab = k;
    for (const b of tabs.children) b.setAttribute('aria-pressed', b.dataset.v === k);
    for (const body of root.querySelectorAll('.s5body')) body.hidden = body.dataset.tab !== k;
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.v); });
  showTab('market');

  $('retail').value = G.market.retail; $('contract').value = G.market.contractMW; $('rbud').value = G.researchBudget;
  $('retail').addEventListener('input', (e) => { G.market.retail = +e.target.value; });
  $('contract').addEventListener('input', (e) => { G.market.contractMW = Math.min(P.maxContract(G), +e.target.value); });
  $('rbud').addEventListener('input', (e) => { G.researchBudget = +e.target.value; });
  $('sign').addEventListener('click', () => P.signContract(G, G.market.contractMW));
  $('cancel').addEventListener('click', () => P.cancelContract(G));
  $('weapon').addEventListener('click', () => P.energyWeapon(G));
  root.querySelector('.decrees').addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (b) P.toggleDecree(G, b.dataset.d); });
  root.querySelector('.tree').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) P.research(G, b.dataset.t); });

  // Ngoại giao
  $('countries').innerHTML = G.world.countries.map((c) => `<div class="country" data-c="${c.id}"><b>${c.name} <span data-f="st"></span></b>
    <div class="meter wide"><i data-f="bar"></i></div><small>${c.trait}</small>
    <div class="btns"><button class="btn" type="button" data-a="dele" data-c="${c.id}">Cử phái đoàn (${fmt(W.DELEGATION_COST, 1)} tr)</button>
    <button class="btn danger" type="button" data-a="peace" data-c="${c.id}">Đình chiến (${fmt(W.CEASEFIRE_COST, 0)} tr)</button></div></div>`).join('');
  $('countries').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'dele') W.delegation(G, b.dataset.c); else W.ceasefire(G, b.dataset.c); });
  $('offers').addEventListener('click', (e) => { const b = e.target.closest('[data-o]'); if (b) W.answerOffer(G, b.dataset.o, b.dataset.y === '1'); });
  $('recruit').addEventListener('click', () => W.recruit(G));
  $('disband').addEventListener('click', () => W.disband(G));
  $('guards').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) W.toggleGuard(G, b.dataset.g); });
  let offersKey = '', guardsKey = '';
  $('exportRE').addEventListener('click', () => I.exportRE(G));
  $('mineLv').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) I.upgradeMine(G); });
  $('wxSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (b) setWeather(G, b.dataset.w, ' (đổi thủ công)'); });

  // Biểu đồ giá giao ngay 24 giờ (thanh HTML)
  const spotEl = $('spot');
  spotEl.innerHTML = Array.from({ length: 24 }, (_, h) => `<i data-h="${h}"><span></span></i>`).join('');

  let overShown = false;
  function render() {
    const hour = hourOfDay(G), M = G.market;
    if (tab === 'market') {
      set('retailV', `${fmt(M.retail)} USD/MWh`);
      const eff = P.retailEffective(G);
      set('retailNote', `Thực thu ${fmt(eff)} USD/MWh${G.decrees.subsidy ? ' (đang trợ giá −25%)' : ''}. Trên 60 USD thì lòng dân giảm dần, dưới 60 thì tăng nhưng ngân sách hụt. Trên 70 USD doanh nghiệp hài lòng hơn.`);
      const prices = Array.from({ length: 24 }, (_, h) => P.spotPrice(G, h)), max = Math.max(...prices);
      [...spotEl.children].forEach((el, h) => {
        el.firstChild.style.height = `${(prices[h] / max) * 100}%`;
        el.classList.toggle('now', h === Math.floor(hour));
      });
      const now = P.spotPrice(G, hour);
      set('spotNote', `Lúc này ${fmt(now)} USD/MWh${M.sanctionUntil > G.t ? ' (đang bị cấm vận, giá mua −30%)' : ''}. Giá đỉnh vào 19–20 giờ: bán lúc đó lời nhất.`);
      set('contractV', `${fmt(Math.min(M.contractMW, P.maxContract(G)))} MW`);
      $('contract').max = P.maxContract(G);
      const b = nodeById(G, 'border');
      set('sign', M.exportOn ? 'Cập nhật hợp đồng' : 'Ký hợp đồng');
      $('cancel').disabled = $('weapon').disabled = !M.exportOn;
      set('expServed', M.exportOn ? `${fmt(b.served)} / ${fmt(M.contractMW)} MW` : 'chưa có hợp đồng');
      set('expRev', `${fmt((b.served * now * G.priceLevel) / 1e3, 1)} nghìn USD/giờ`);
      const linked = G.net.lines.some((l) => l.a === 'border' || l.b === 'border');
      set('expNote', !linked ? 'Chưa có đường dây tới Cửa khẩu Đông: dùng “Kéo dây” nối một trạm với cửa khẩu (nên dùng 500 kV).'
        : M.exportOn && b.frac < 0.95 ? 'Đang giao thiếu hợp đồng: uy tín quốc tế giảm. Kiểm tra nguồn phát và đường dây.' : 'Giao đủ hợp đồng giúp uy tín quốc tế tăng dần.');
    }
    if (tab === 'politics') {
      const F = G.factions;
      for (const [k, v] of [['P', G.approval], ['B', F.business], ['M', F.military], ['R', G.reputation]]) {
        set(`f${k}`, `${fmt(v)}%`); const bar = $(`f${k}b`); bar.style.width = `${clamp(v, 0, 100)}%`; bar.style.background = tone(v);
      }
      for (const b of root.querySelectorAll('.decree')) b.setAttribute('aria-pressed', !!G.decrees[b.dataset.d]);
      const d = Object.entries(G.danger).filter(([, v]) => v > 0);
      $('dangerNote').hidden = !d.length;
      if (d.length) set('dangerNote', d.map(([k, v]) => `${{ coup: 'Nguy cơ đảo chính', revolution: 'Nguy cơ cách mạng', default: 'Nguy cơ vỡ nợ' }[k]}: còn ${fmt(Math.max(0, 24 - v / 3600), 1)} giờ để khắc phục.`).join(' '));
    }
    if (tab === 'world') {
      for (const c of G.world.countries) {
        const card = root.querySelector(`.country[data-c="${c.id}"]`);
        const st = card.querySelector('[data-f=st]'), bar = card.querySelector('[data-f=bar]');
        set2(st, `${W.status(c)} · ${fmt(c.relation)}`);
        bar.style.width = `${c.relation}%`; bar.style.background = c.war ? 'var(--hot)' : tone(c.relation);
        card.querySelector('[data-a=peace]').hidden = !c.war;
        const path = $(`cn-${c.id}`); path.style.fill = c.war || c.relation < 25 ? 'var(--hot)' : c.relation < 45 ? 'var(--amber)' : 'var(--cool)'; path.style.fillOpacity = 0.35 + 0.4 * (c.war ? 1 : Math.abs(c.relation - 50) / 50);
      }
      const ok = G.world.offers.map((o) => o.id).join();
      if (ok !== offersKey) {
        offersKey = ok;
        $('offers').innerHTML = G.world.offers.length ? G.world.offers.map((o) => `<div class="offer"><p>${esc(o.text)}</p><div class="btns"><button class="btn" type="button" data-o="${o.id}" data-y="1">Chấp nhận</button><button class="btn" type="button" data-o="${o.id}" data-y="0">Từ chối</button></div></div>`).join('')
          : '<p class="note">Chưa có đề nghị nào. Các nước gửi đề nghị khoảng hai lần mỗi ngày, tuỳ quan hệ.</p>';
      }
      set('troopNote', `${G.world.troops} đơn vị, đang canh ${G.world.guards.length}. Nuôi quân ${fmt(W.TROOP_UPKEEP, 2)} triệu USD/ngày mỗi đơn vị. Nơi có lính gác chặn được phá hoại và 80% tên lửa.`);
      set('recruit', `Tuyển 1 đơn vị (${fmt(W.RECRUIT_COST * G.priceLevel, 1)} tr)`);
      const targets = G.net.nodes.filter((n) => n.type !== 'border');
      const gk = targets.map((n) => n.id + W.isGuarded(G, n.id)).join() + G.world.troops;
      if (gk !== guardsKey) {
        guardsKey = gk;
        $('guards').innerHTML = targets.map((n) => `<button class="btn" type="button" data-g="${n.id}" aria-pressed="${W.isGuarded(G, n.id)}">${esc(n.name)}</button>`).join('');
      }
    }
    if (tab === 'res') {
      const R = G.res, L = I.MINE_LEVELS[R.mineLv - 1], mine = G.net.nodes.find((n) => n.id === 'mine');
      const k = (mine?.frac ?? 0) * (1 + 0.25 * I.count(G, 'road'));
      const burn = [G.reactor, G.reactor2].filter(Boolean).reduce((a, u) => a + u.Pf / 3e9, 0) * (R.mineLv >= 2 ? 0.8 : 1);
      set('uVal', `${fmt(R.U, 1)} tấn`); set('uNote', `khai thác +${fmt(L.U * k, 1)}/ngày, lò đốt −${fmt(burn, 1)}/ngày`);
      set('reVal', `${fmt(R.RE, 1)} tấn`); set('reNote', `khai thác +${fmt(L.RE * k, 1)}/ngày`);
      set('exportRE', `Xuất ${I.RE_LOT} tấn đất hiếm (+${fmt(I.RE_PRICE * (I.count(G, 'port') ? 1.3 : 1) * G.priceLevel, 2)} tr)`);
      for (const card of root.querySelectorAll('#mineLv .tech')) {
        const i = +card.dataset.m, st = i < R.mineLv ? 'done' : i === R.mineLv ? 'ready' : 'locked';
        card.dataset.state = st;
        const b = card.querySelector('button'); b.disabled = st !== 'ready';
        set2(b, st === 'done' ? 'Đã có' : `Nâng cấp · ${fmt(I.MINE_LEVELS[i].cost * G.priceLevel, 1)} tr`);
      }
      const w = WEATHERS[G.weather.id];
      for (const b of $('wxSeg').children) b.setAttribute('aria-pressed', b.dataset.w === G.weather.id);
      set('wTa', `${w.Ta} °C`); set('wWind', `${fmt(G.windNow ?? 0, 1)} m/s → ${fmt(windFarmMW(G.windNow ?? 0))} MW`);
      const towers = Math.min(3, I.count(G, 'tower'));
      set('wTin', `${w.dTin - 3 * towers >= 0 ? '+' : ''}${fmt(w.dTin - 3 * towers)} °C so với chuẩn${towers ? ` (đã trừ ${towers} tháp phụ)` : ''}`);
      set('wHydro', `${fmt(w.hydro * 100)}% → ${fmt(250 * w.hydro)} MW tối đa`);
      set('wNote', { sunny: 'Vận hành bình thường.', windy: 'Gió mạnh: trại gió phát gần định mức, dây dẫn tản nhiệt tốt hơn.', heatwave: 'Nắng nóng: nước làm mát nóng nên lò phải giảm công suất, dây khó tản nhiệt, nhu cầu điều hoà tăng. Tháp làm mát phụ giúp bù lại.', storm: 'Bão: sét đánh cắt tuyến (tự đóng lại sau 30 giây nếu rơ-le bật, cháy dây nếu rơ-le tắt), mưa làm hồ thủy điện đầy hơn. Gió trên 25 m/s thì trại gió ngắt bảo vệ.' }[G.weather.id]);
      set('trNote', `Cao tốc ${I.count(G, 'road')}/2 · Cảng sông ${I.count(G, 'port')} · Sân bay ${I.count(G, 'airport')}. Xây ở nút “Xây dựng ▾” trên bản đồ.`);
    }
    if (tab === 'tech') {
      set('rp', fmt(G.rp, 1)); set('rpRate', `+${fmt(P.rpPerDay(G), 1)} điểm/ngày`);
      set('rbudV', `${fmt(G.researchBudget, 2)} triệu USD/ngày`);
      for (const card of root.querySelectorAll('.tech')) {
        const t = P.TECHS.find((x) => x.id === card.dataset.t), st = P.techState(G, t);
        card.dataset.state = st;
        const btn = card.querySelector('button');
        btn.disabled = st !== 'ready';
        set2(btn, st === 'done' ? 'Đã nghiên cứu' : st === 'locked' ? `Khoá · ${t.cost} điểm` : `Nghiên cứu · ${t.cost} điểm`);
      }
    }
    if (G.over && !overShown) {
      overShown = true;
      const o = document.createElement('div');
      o.className = 'over';
      o.innerHTML = `<div><h2>Kết thúc nhiệm kỳ</h2><p>${esc(G.over)}</p><button class="btn" type="button">Chơi lại</button></div>`;
      o.querySelector('button').addEventListener('click', () => location.reload());
      document.body.appendChild(o);
    }
  }
  const set2 = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  return { render };
}
