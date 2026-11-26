// Giai đoạn 4: các nước láng giềng có AI riêng, đề nghị ngoại giao, phá hoại, chiến tranh; quân đội canh gác.
import { news } from './news.js';
import { fmt } from './util.js';

export const COUNTRIES = [
  { id: 'east', name: 'Cộng hoà Đông Lâm', trait: 'Khách mua điện qua Cửa khẩu Đông. Ưa hợp đồng ổn định.', rel: 60 },
  { id: 'north', name: 'Vương quốc Bắc Sơn', trait: 'Giàu than, hay gây sức ép. Dễ thù địch nếu bạn yếu thế.', rel: 45 },
  { id: 'south', name: 'Liên bang Nam Hải', trait: 'Ôn hoà, giàu vốn và công nghệ, rất sợ phóng xạ.', rel: 65 },
];
export const RECRUIT_COST = 1.5, TROOP_UPKEEP = 0.08, DELEGATION_COST = 1.5, CEASEFIRE_COST = 5;
const DAY = 86400;

export function createWorld() {
  return {
    countries: COUNTRIES.map((c) => ({ ...c, relation: c.rel, war: false, lastDelegation: -DAY })),
    troops: 2, guards: [], offers: [], eventAcc: 0, coalDealUntil: 0, loanUntil: 0, strikeFx: [],
    get war() { return this.countries.some((c) => c.war); },
  };
}

const country = (G, id) => G.world.countries.find((c) => c.id === id);
const clamp = (x) => Math.max(0, Math.min(100, x));
export const status = (c) => (c.war ? 'Chiến tranh' : c.relation < 25 ? 'Thù địch' : c.relation < 45 ? 'Căng thẳng' : c.relation < 70 ? 'Bình thường' : 'Đồng minh');
export const isGuarded = (G, nodeId) => G.world.guards.includes(nodeId);

/** Đổi quan hệ với một nước (hoặc tất cả khi id = null). */
export function shiftRelation(G, id, d) {
  for (const c of G.world.countries) if (!id || c.id === id) c.relation = clamp(c.relation + d);
}

// ---------- Hành động của người chơi ----------
const pay = (G, cost, what) => {
  if (G.budget < cost) { news(G, `Không đủ ngân sách cho ${what}.`, 'warn'); return false; }
  G.budget -= cost; return true;
};
export function recruit(G) {
  if (!pay(G, RECRUIT_COST * G.priceLevel, 'tuyển quân')) return;
  G.world.troops++; G.factions.military = Math.min(100, G.factions.military + 2);
  news(G, `Thành lập thêm một đơn vị bảo vệ hạ tầng (tổng ${G.world.troops}).`);
}
export function disband(G) {
  if (G.world.troops <= 0) return;
  G.world.troops--; G.world.guards = G.world.guards.slice(0, G.world.troops);
  G.factions.military = Math.max(0, G.factions.military - 4);
  news(G, 'Giải thể một đơn vị bảo vệ. Quân đội không hài lòng.', 'warn');
}
export function toggleGuard(G, nodeId) {
  const W = G.world;
  if (W.guards.includes(nodeId)) W.guards = W.guards.filter((x) => x !== nodeId);
  else if (W.guards.length < W.troops) W.guards.push(nodeId);
  else news(G, 'Không còn đơn vị rảnh: tuyển thêm hoặc rút quân khỏi công trình khác.', 'warn');
}
export function delegation(G, id) {
  const c = country(G, id);
  if (G.t - c.lastDelegation < DAY) { news(G, `Phái đoàn vừa sang ${c.name}, chờ một ngày nữa.`, 'warn'); return; }
  if (!pay(G, DELEGATION_COST * G.priceLevel, 'phái đoàn ngoại giao')) return;
  c.lastDelegation = G.t; shiftRelation(G, id, 10);
  news(G, `Phái đoàn ngoại giao sang ${c.name}: quan hệ cải thiện.`);
}
export function ceasefire(G, id) {
  const c = country(G, id);
  if (!c.war || !pay(G, CEASEFIRE_COST * G.priceLevel, 'đàm phán đình chiến')) return;
  c.war = false; c.relation = Math.max(c.relation, 30); G.reputation = clamp(G.reputation + 5);
  news(G, `Ký hiệp định đình chiến với ${c.name} (−${fmt(CEASEFIRE_COST * G.priceLevel, 1)} triệu USD).`);
}
export function answerOffer(G, offerId, accept) {
  const W = G.world, o = W.offers.find((x) => x.id === offerId);
  if (!o) return;
  W.offers = W.offers.filter((x) => x !== o);
  const c = country(G, o.country);
  if (!accept) { shiftRelation(G, o.country, o.kind === 'demand' ? -10 : -2); news(G, `Từ chối đề nghị của ${c.name}.`); return; }
  switch (o.kind) {
    case 'coal': W.coalDealUntil = G.t + 5 * DAY; shiftRelation(G, o.country, 5); break;
    case 'loan': G.budget += 8; W.loanUntil = G.t + 10 * DAY; shiftRelation(G, o.country, 5); break;
    case 'tech': G.rp += 25; shiftRelation(G, o.country, 5); break;
    case 'demand': if (!pay(G, 4 * G.priceLevel, 'nhượng quyền')) return; shiftRelation(G, o.country, 15); break;
    case 'more':
      if (G.market.exportOn) G.market.contractMW = Math.min(600, G.market.contractMW + 100);
      shiftRelation(G, o.country, 5); break;
  }
  news(G, `Chấp nhận: ${o.text}`);
}

const OFFERS = {
  coal: (c) => ({ kind: 'coal', text: `${c.name} bán than giá rẻ hơn 25% trong 5 ngày.` }),
  loan: (c) => ({ kind: 'loan', text: `${c.name} cho vay ưu đãi 8 triệu USD, trả 0,1 triệu USD/ngày trong 10 ngày.` }),
  tech: (c) => ({ kind: 'tech', text: `${c.name} chia sẻ công nghệ lưới điện: +25 điểm nghiên cứu.` }),
  demand: (c) => ({ kind: 'demand', text: `${c.name} đòi 4 triệu USD tiền nhượng quyền khai thác, nếu không quan hệ xấu đi.` }),
  more: (c) => ({ kind: 'more', text: `${c.name} muốn mua thêm 100 MW theo hợp đồng xuất khẩu.` }),
};

// ---------- Mô phỏng ----------
const TARGETS = ['subE', 'subW', 'coal', 'hydro', 'capital', 'port'];
function pickTarget(G, withNuclear) {
  const ids = [...TARGETS, ...G.net.nodes.filter((n) => n.type === 'sub' && !TARGETS.includes(n.id)).map((n) => n.id), ...(withNuclear ? ['nuc'] : [])];
  const id = ids[Math.floor(Math.random() * ids.length)];
  return G.net.nodes.find((n) => n.id === id);
}
function hit(G, n, how) {
  if (!n || n.state !== 'ok') return;
  n.state = 'fire';
  G.world.strikeFx.push({ id: n.id, t: G.t });
  if (n.type === 'nuclear') {
    for (const R of [G.reactor, G.reactor2]) if (R && Math.random() < 0.3) { R.loca = true; R.release = Math.max(R.release, 0.4); R.flash = 1; }
  }
  news(G, `${how} đánh trúng ${n.name}! Máy biến áp bốc cháy.`, 'bad');
}

export function worldStep(G, dt) {
  const W = G.world, day = dt / DAY, rel = Math.max(G.reactor.release, G.reactor2?.release ?? 0);
  // Chi phí
  G.budget -= W.troops * TROOP_UPKEEP * G.priceLevel * day;
  if (W.loanUntil > G.t) G.budget -= 0.1 * day;
  // Quan hệ trôi về mức theo uy tín; phóng xạ làm mọi nước lo ngại, Nam Hải nhất
  for (const c of W.countries) {
    const target = 25 + G.reputation * 0.6 - (c.id === 'north' ? 10 : 0);
    c.relation = clamp(c.relation + ((target - c.relation) * 0.3 - rel * (c.id === 'south' ? 40 : 15)) * day);
    if (!c.war && c.relation < 8) {
      c.war = true;
      news(G, `${c.name} tuyên chiến! Tên lửa có thể tấn công nhà máy và trạm điện. Hãy điều quân bảo vệ.`, 'bad');
    }
    if (c.war && c.relation >= 30) { c.war = false; news(G, `${c.name} chấp nhận đình chiến.`); }
  }
  W.offers = W.offers.filter((o) => o.expires > G.t);
  // Sự kiện: hai lần mỗi ngày
  W.eventAcc += dt;
  if (W.eventAcc < DAY / 2) return;
  W.eventAcc = 0;
  for (const c of W.countries) {
    const r = Math.random();
    if (c.war) {
      const n = pickTarget(G, true);
      if (isGuarded(G, n.id) && Math.random() < 0.8) news(G, `Phòng không bắn hạ tên lửa của ${c.name} nhắm vào ${n.name}.`);
      else hit(G, n, `Tên lửa của ${c.name}`);
      continue;
    }
    if (c.relation < 25 && r < 0.4) {
      const n = pickTarget(G, false);
      if (isGuarded(G, n.id)) { news(G, `Lính gác bắt được nhóm phá hoại của ${c.name} tại ${n.name}.`); G.factions.military = Math.min(100, G.factions.military + 2); }
      else hit(G, n, `Nhóm phá hoại do ${c.name} hậu thuẫn`);
      continue;
    }
    if (W.offers.length >= 3 || r > 0.45) continue;
    const kind = c.id === 'north' ? (c.relation < 40 ? 'demand' : c.relation > 50 ? 'coal' : null)
      : c.id === 'south' ? (c.relation > 70 ? 'tech' : c.relation > 55 ? 'loan' : null)
      : c.relation > 40 && G.market.exportOn ? 'more' : null;
    if (!kind) continue;
    const o = { id: `${c.id}-${Math.round(G.t)}`, country: c.id, expires: G.t + DAY, ...OFFERS[kind](c) };
    W.offers.push(o);
    news(G, `Đề nghị mới: ${o.text}`, kind === 'demand' ? 'warn' : '');
  }
}
