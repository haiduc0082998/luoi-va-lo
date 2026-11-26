// Bảng Giai đoạn 5: Thị trường điện · Chính trị · Cây công nghệ, và màn hình thua.
import { fmt, esc, clamp } from '../util.js';
import { hourOfDay, nodeById } from '../game.js';
import * as P from '../policy.js';

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
const meter = (id) => `<div class="meter wide"><i id="${id}"></i></div>`;
const tone = (v) => (v < 25 ? 'var(--hot)' : v < 45 ? 'var(--amber)' : 'var(--cool)');

export function createStage5(G) {
  const root = $('s5');
  let tab = 'market';
  root.innerHTML = `
    <div class="s5head"><h2>Điều hành quốc gia</h2>
      <div class="seg" id="s5tabs">${[['market', 'Thị trường điện'], ['politics', 'Chính trị'], ['tech', 'Cây công nghệ']].map(([k, l]) => `<button type="button" data-v="${k}">${l}</button>`).join('')}</div></div>
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
