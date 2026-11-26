// Trạng thái quốc gia: thời gian, ngân sách, lòng dân, bản tin. Nối sự kiện vật lý với chính trị.
import { createGrid, stepGrid, isPowered, repairCost, restoreGrid } from './physics/grid.js';
import { createReactor, stepReactor } from './physics/reactor.js';
import { fmt } from './util.js';

const WORLD_NEWS = [
  'Giá than nhập khẩu tăng 6% do bão ở cảng xuất khẩu.',
  'Nước láng giềng đề nghị mua 300 MW điện dư vào giờ cao điểm.',
  'Giá uranium giao ngay giảm nhẹ trên thị trường quốc tế.',
  'Hội nghị khu vực bàn về lưới điện xuyên biên giới.',
  'Nắng nóng kéo dài, nhu cầu điều hoà dự báo tăng mạnh.',
  'Viện Năng lượng công bố vật liệu dây dẫn chịu nhiệt mới.',
];
const DIRS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
export const START_HOUR = 8;
export const PRICE_USD_MWH = 60;

export function createGame() {
  const G = {
    t: 0, speed: 5, approval: 62, budget: 120, news: [], protest: false, newsAcc: 0,
    grid: createGrid(), reactor: createReactor(), listeners: new Set(),
  };
  return G;
}

export const windName = (R) => DIRS[Math.round(R.wind / 45) % 8];
export const hourOfDay = (G) => ((START_HOUR * 3600 + G.t) % 86400) / 3600;
export function clockText(t) {
  const s = START_HOUR * 3600 + t;
  const d = Math.floor(s / 86400) + 1, h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `Ngày ${d}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function news(G, text, level = '') {
  G.news.unshift({ t: G.t, text, level });
  G.news.length = Math.min(G.news.length, 7);
  G.listeners.forEach((fn) => fn(G.news));
}

function gridEvent(G, type, d) {
  const kv = (v) => fmt(v, v === 10.5 ? 1 : 0);
  switch (type) {
    case 'collapse': G.approval -= 3; return news(G, `Sụp đổ điện áp: đường dây ${fmt(d.L)} km không thể tải ${fmt(d.P)} MW ở ${kv(d.kv)} kV. Thành phố mất điện.`, 'bad');
    case 'trip': return news(G, `Rơ-le cắt đường dây: dòng ${fmt(d.I)} A vượt ngưỡng ${fmt(d.Imax)} A.`, 'warn');
    case 'lineFire': G.approval -= 6; return news(G, `Dây dẫn ${d.A} mm² đỏ rực ở ${fmt(d.Tw)} °C, võng chạm cây và bốc cháy. Mất điện diện rộng.`, 'bad');
    case 'txFire': G.approval -= 8; return news(G, 'Máy biến áp quá tải, dầu cách điện bốc cháy tại trạm hạ áp.', 'bad');
  }
}

function reactorEvent(G, type) {
  const R = G.reactor;
  switch (type) {
    case 'dieselOn': return news(G, 'Máy phát diesel dự phòng đã chạy, cấp điện cho bơm.');
    case 'scram': return news(G, 'SCRAM tự động: toàn bộ thanh điều khiển rơi vào lõi.', 'warn');
    case 'loca': G.approval -= 10; return news(G, 'Áp suất vượt giới hạn: vỡ đường ống sơ cấp, mất nước làm mát (LOCA).', 'bad');
    case 'promptExplosion': G.approval -= 35; return news(G, 'Công suất vọt gấp 10 lần định mức trong vài giây: nổ hơi nước phá tung nắp lò.', 'bad');
    case 'fuelDamage': return news(G, 'Vỏ thanh nhiên liệu vỡ, chất phóng xạ lọt vào nước làm mát.', 'bad');
    case 'h2Explosion': G.approval -= 15; return news(G, 'Nổ hydro trong nhà lò! Vỏ bọc hư hại, phóng xạ thoát ra ngoài.', 'bad');
    case 'meltdown': G.approval -= 30; return news(G, `Nóng chảy lõi. Đám mây phóng xạ trôi về phía ${windName(R)}.`, 'bad');
  }
}

function economy(G, dt) {
  const h = dt / 3600, C = G.grid, R = G.reactor, on = isPowered(C);
  const soldMW = (on ? C.P : 0) + R.Pe / 1e6;
  G.budget += (soldMW * PRICE_USD_MWH * h) / 1e6; // triệu USD
  G.approval += on ? (C.drop > 0.1 ? -3 : G.approval < 85 ? 2 : 0) * h : -12 * h;
  G.approval = Math.max(0, Math.min(100, G.approval - R.release * 25 * h));
  if (G.approval < 25 && !G.protest) {
    G.protest = true;
    news(G, 'Biểu tình lan rộng: người dân đòi chính phủ chịu trách nhiệm về điện và an toàn.', 'bad');
  }
  if (G.approval > 35) G.protest = false;
  G.newsAcc += dt;
  if (G.newsAcc > 7200) { G.newsAcc = 0; news(G, WORLD_NEWS[Math.floor(Math.random() * WORLD_NEWS.length)]); }
}

/** Tiến thời gian thực dtReal giây, chia bước nhỏ 0,05 s để mô hình lò ổn định. */
export function advance(G, dtReal) {
  const total = dtReal * G.speed, n = Math.ceil(total / 0.05);
  for (let i = 0; i < n; i++) {
    const h = total / n;
    stepGrid(G.grid, h, (t, d) => gridEvent(G, t, d));
    stepReactor(G.reactor, h, (t, d) => reactorEvent(G, t, d));
    economy(G, h);
    G.t += h;
  }
}

export function repair(G) {
  const cost = repairCost(G.grid);
  if (cost > G.budget) return news(G, 'Ngân sách không đủ để sửa chữa.', 'warn');
  G.budget -= cost;
  restoreGrid(G.grid);
  news(G, cost ? `Đội kỹ thuật sửa xong hạ tầng (−${fmt(cost, 1)} triệu USD) và đóng điện lại.` : 'Đóng lại máy cắt, cấp điện trở lại.');
}

export const GRID_SCENARIOS = [
  ['Truyền tải 220 kV chuẩn', {}, 'Kịch bản: lưới 220 kV vận hành bình thường.', ''],
  ['Thử: 10,5 kV đi 100 km', { kv: 10.5, L: 100, A: 240, P: 120 }, 'Kịch bản: truyền thẳng điện áp máy phát, không qua biến áp tăng thế.', 'warn'],
  ['Dây mảnh, tắt rơ-le', { kv: 110, L: 15, A: 95, P: 300, relay: false, Ta: 38, Tw: 40 }, 'Kịch bản: dây 95 mm² gánh 300 MW, rơ-le bị vô hiệu hoá. Chuyện gì sẽ xảy ra?', 'warn'],
  ['Nắng nóng, quá tải trạm', { P: 560, Ta: 44, A: 630, Imax: 3500 }, 'Kịch bản: đợt nóng 44 °C, nhu cầu vượt công suất máy biến áp.', 'warn'],
];
export const REACTOR_SCENARIOS = [
  ['Vận hành định mức', {}, 'Kịch bản: lò nước áp lực 3 000 MWt chạy định mức.', ''],
  ['Mất điện toàn trạm', { offsite: false, diesel: false }, 'Kịch bản: sóng thần giả định cắt điện lưới và làm ngập máy phát diesel.', 'bad'],
  ['Lò kiểu RBMK, tắt bảo vệ', { rbmk: true, rps: false }, 'Kịch bản: lò có hệ số rỗng dương, bảo vệ tự động bị tắt. Thử rút thêm thanh điều khiển…', 'warn'],
];
export function loadScenario(G, kind, i) {
  const [, o, text, lvl] = (kind === 'grid' ? GRID_SCENARIOS : REACTOR_SCENARIOS)[i];
  if (kind === 'grid') G.grid = createGrid(o); else G.reactor = createReactor(o);
  news(G, text, lvl);
}
