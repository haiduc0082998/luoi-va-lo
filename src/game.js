// Trạng thái quốc gia: thời gian, ngân sách, lòng dân, lạm phát, tham nhũng, kỹ sư, xây dựng, bản tin.
import {
  createNode, createLine, stepNetwork, lineLengthKm, connectedToOtherSource, findIslands,
} from './physics/network.js';
import { createReactor, stepReactor } from './physics/reactor.js';
import { rollEngineer, runEngineer } from './engineers.js';
import { buildable, PADS } from './map.js';
import { fmt } from './util.js';

export const START_HOUR = 8;
export const PRICE_USD_MWH = 60;
export const COAL_USD_MWH = 35;
export const COAL_MAX = 600;
// Giá xây dựng đã thu nhỏ cho nhịp chơi nhanh (triệu USD); giá điện giữ thật.
export const LINE_COST_KM = { 10.5: 0.01, 110: 0.03, 220: 0.05, 500: 0.1 }; // ở 400 mm²
export const SUB_COST = 2, GACHA_COST = 1.5, INSPECT_COST = 1, PRINT_AMOUNT = 5, NODE_REPAIR = 1;

const WORLD_NEWS = [
  'Giá than nhập khẩu tăng 6% do bão ở cảng xuất khẩu.',
  'Nước láng giềng đề nghị mua điện dư vào giờ cao điểm.',
  'Giá uranium giao ngay giảm nhẹ trên thị trường quốc tế.',
  'Hội nghị khu vực bàn về lưới điện xuyên biên giới.',
  'Viện Năng lượng công bố vật liệu dây dẫn chịu nhiệt mới.',
  'Báo chí điều tra các gói thầu dây dẫn kém chất lượng.',
];
const DIRS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];

const INITIAL_NODES = [
  { id: 'nuc', name: 'Nhà máy hạt nhân Sông Lam', type: 'nuclear', x: 4, z: -28 },
  { id: 'coal', name: 'Nhiệt điện Đồi Than', type: 'coal', x: -56, z: 8 },
  { id: 'subE', name: 'Trạm Đông', type: 'sub', x: 30, z: -4 },
  { id: 'subW', name: 'Trạm Tây', type: 'sub', x: -28, z: 24 },
  { id: 'capital', name: 'Thủ phủ', type: 'city', x: 58, z: 24, demandBase: 560 },
  { id: 'port', name: 'Bến Cảng', type: 'city', x: -46, z: 58, demandBase: 260 },
];
const INITIAL_LINES = [
  { a: 'nuc', b: 'subE', kv: 500, A: 630 },
  { a: 'coal', b: 'subW', kv: 220, A: 400 },
  { a: 'subE', b: 'capital', kv: 500, A: 630 },
  { a: 'subW', b: 'port', kv: 220, A: 630 },
  { a: 'subW', b: 'subE', kv: 220, A: 400 },
];
for (const n of INITIAL_NODES) PADS.push([n.x, n.z, n.type === 'city' ? 14 : n.type === 'nuclear' ? 16 : 9]);

export function createGame() {
  const nodes = INITIAL_NODES.map((n) => createNode(n));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines = INITIAL_LINES.map((l) => createLine({ ...l, L: lineLengthKm(byId.get(l.a), byId.get(l.b)), Tw: 30 }));
  return {
    t: 0, speed: 60, approval: 62, budget: 20, inflation: 2, corruption: 15, priceLevel: 1, Ta: 30,
    news: [], listeners: new Set(), protest: false, newsAcc: 0, engAcc: 0,
    net: { nodes, lines }, reactor: createReactor(), coalMax: COAL_MAX, gridFault: false, wasOffsite: true,
    engineer: null, engAuto: true, version: 1, subCount: 2,
  };
}

export const nodeById = (G, id) => G.net.nodes.find((n) => n.id === id);
export const lineById = (G, id) => G.net.lines.find((l) => l.id === id);
export const windName = (R) => DIRS[Math.round(R.wind / 45) % 8];
export const hourOfDay = (G) => ((START_HOUR * 3600 + G.t) % 86400) / 3600;
export const costMul = (G) => G.priceLevel * (1 + G.corruption / 100);
export function clockText(t) {
  const s = START_HOUR * 3600 + t;
  const d = Math.floor(s / 86400) + 1, h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `Ngày ${d}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Hệ số nhu cầu theo giờ: thấp ban đêm, đỉnh tối 19–20 h; nắng nóng tăng điều hoà. */
export function demandMul(hour, Ta) {
  const day = 0.75 + 0.2 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  const evening = 0.18 * Math.exp(-((hour - 19.5) ** 2) / 3);
  return (day + evening) * (1 + Math.max(0, Ta - 30) * 0.012);
}

export function news(G, text, level = '') {
  G.news.unshift({ t: G.t, text, level });
  G.news.length = Math.min(G.news.length, 8);
  G.listeners.forEach((fn) => fn(G.news));
}
const spend = (G, cost, what) => {
  if (cost > G.budget) { news(G, `Không đủ ngân sách cho ${what} (cần ${fmt(cost, 1)} triệu USD).`, 'warn'); return false; }
  G.budget -= cost; return true;
};

function netEvent(G, type, d) {
  const lname = (l) => `${nodeById(G, l.a).name} – ${nodeById(G, l.b).name}`;
  switch (type) {
    case 'collapse': G.approval -= 2; return news(G, `Sụp đổ điện áp trên tuyến ${lname(d.line)} (${fmt(d.MW)} MW ở ${fmt(d.line.kv, d.line.kv === 10.5 ? 1 : 0)} kV). Tuyến bị cắt.`, 'bad');
    case 'trip': return news(G, `Rơ-le cắt tuyến ${lname(d.line)}: ${fmt(d.I)} A vượt ngưỡng ${fmt(d.line.Imax)} A.`, 'warn');
    case 'lineFire': G.approval -= 5; return news(G, `Tuyến ${lname(d.line)} quá nhiệt ${fmt(d.line.Tw)} °C, võng chạm cây và bốc cháy!`, 'bad');
    case 'txFire': G.approval -= 6; return news(G, `Máy biến áp tại ${d.node.name} quá tải, dầu cách điện bốc cháy.`, 'bad');
  }
}
function reactorEvent(G, type) {
  const R = G.reactor;
  switch (type) {
    case 'dieselOn': return news(G, 'Máy phát diesel dự phòng đã chạy, cấp điện cho bơm.');
    case 'scram': return news(G, 'SCRAM tự động: thanh điều khiển rơi vào lõi.', 'warn');
    case 'loca': G.approval -= 10; return news(G, 'Áp suất vượt giới hạn: vỡ đường ống sơ cấp (LOCA).', 'bad');
    case 'promptExplosion': G.approval -= 35; return news(G, `Màn hình báo 99999 MW! Công suất vọt hơn 10 lần định mức${R.az > 0 ? ' ngay khi SCRAM – hiệu ứng đầu thanh than chì AZ-3' : ''}. Nổ hơi nước phá tung nắp lò.`, 'bad');
    case 'fuelDamage': return news(G, 'Vỏ thanh nhiên liệu vỡ, chất phóng xạ lọt vào nước làm mát.', 'bad');
    case 'h2Explosion': G.approval -= 15; return news(G, 'Nổ hydro trong nhà lò! Phóng xạ thoát ra ngoài.', 'bad');
    case 'meltdown': G.approval -= 30; return news(G, `Nóng chảy lõi. Đám mây phóng xạ trôi về phía ${windName(R)}.`, 'bad');
  }
}

/** Công suất lưới cần từ nhà máy hạt nhân (để kỹ sư bám tải). */
function nuclearWant(G) {
  const isl = findIslands(G.net).find((i) => i.nodes.some((n) => n.id === 'nuc'));
  if (!isl) return 0;
  return isl.nodes.reduce((s, n) => s + n.demand, 0) + isl.lines.reduce((s, l) => s + (l.lossPrev ?? 0), 0);
}

function politics(G, dt) {
  const h = dt / 3600, day = dt / 86400, S = G.net.summary, R = G.reactor;
  const sold = S.served;
  const coalGen = nodeById(G, 'coal').gen;
  G.budget += (sold * PRICE_USD_MWH * G.priceLevel * h * (1 - G.corruption / 200)) / 1e6;
  G.budget -= (coalGen * COAL_USD_MWH * G.priceLevel * h) / 1e6;
  if (G.engineer) G.budget -= G.engineer.salary * G.priceLevel * day;

  const fw = S.demand > 0 ? S.served / S.demand : 1;
  G.inflation += ((2 - G.inflation) * day) / 3 + (1 - fw) * 0.5 * day;
  G.priceLevel *= 1 + (G.inflation / 100) * (day / 5);
  G.corruption = Math.min(80, G.corruption + 0.5 * day);

  let dA = fw > 0.999 ? (G.approval < 85 ? 2 : 0) : -14 * (1 - fw);
  dA -= R.release * 25;
  if (G.inflation > 6) dA -= (G.inflation - 6) * 0.4;
  if (G.corruption > 35) dA -= (G.corruption - 35) * 0.05;
  G.approval = Math.max(0, Math.min(100, G.approval + dA * h));
  if (G.approval < 25 && !G.protest) {
    G.protest = true;
    news(G, 'Biểu tình lan rộng: người dân đòi chính phủ chịu trách nhiệm về điện, giá cả và an toàn.', 'bad');
  }
  if (G.approval > 35) G.protest = false;
  G.newsAcc += dt;
  if (G.newsAcc > 7200) { G.newsAcc = 0; news(G, WORLD_NEWS[Math.floor(Math.random() * WORLD_NEWS.length)]); }
}

/** Tiến thời gian thực dtReal giây, chia bước 0,05 s. */
export function advance(G, dtReal) {
  const total = dtReal * G.speed, n = Math.ceil(total / 0.05);
  const R = G.reactor;
  for (let i = 0; i < n; i++) {
    const h = total / n;
    const nuc = nodeById(G, 'nuc'), coal = nodeById(G, 'coal');
    const cap = { nuc: nuc.state === 'ok' ? R.Pe / 1e6 : 0, coal: coal.state === 'ok' ? G.coalMax : 0 };
    stepNetwork(G.net, h, { cap, demandMul: demandMul(hourOfDay(G), G.Ta), Ta: G.Ta }, (t, d) => netEvent(G, t, d));
    R.offsite = !G.gridFault && nuc.state === 'ok' && connectedToOtherSource(G.net, 'nuc');
    if (R.offsite !== G.wasOffsite) {
      G.wasOffsite = R.offsite;
      news(G, R.offsite ? 'Nhà máy hạt nhân có lại điện lưới ngoài.' : 'Nhà máy hạt nhân mất điện lưới ngoài! Bơm cần máy phát diesel.', R.offsite ? '' : 'bad');
    }
    stepReactor(R, h, (t) => reactorEvent(G, t));
    if (G.engineer && G.engAuto) {
      G.engAcc += h;
      if (G.engAcc >= 1) { G.engAcc = 0; runEngineer(G.engineer, R, nuclearWant(G), Math.random, (txt, lvl) => news(G, txt, lvl)); }
    }
    politics(G, h);
    G.t += h;
  }
}

// ---------- Hành động của người chơi ----------
export const lineCost = (G, L, kv, A) => L * LINE_COST_KM[kv] * Math.sqrt(A / 400) * costMul(G);
export const subCost = (G) => SUB_COST * costMul(G);

export function buildSubstation(G, x, z) {
  const why = buildable(x, z, G.net.nodes);
  if (why) { news(G, `Không xây được trạm: ${why}.`, 'warn'); return null; }
  if (!spend(G, subCost(G), 'trạm biến áp')) return null;
  const n = createNode({ name: `Trạm ${String.fromCharCode(65 + (G.subCount++ % 26))}${G.subCount > 26 ? G.subCount : ''}`, type: 'sub', x, z });
  G.net.nodes.push(n); G.version++;
  news(G, `Đã xây ${n.name} (−${fmt(subCost(G), 1)} triệu USD). Hãy kéo đường dây nối vào.`);
  return n;
}

export function buildLine(G, aId, bId, kv, A) {
  if (aId === bId) return null;
  if (G.net.lines.some((l) => (l.a === aId && l.b === bId) || (l.a === bId && l.b === aId))) {
    news(G, 'Hai công trình này đã có đường dây nối với nhau.', 'warn'); return null;
  }
  const a = nodeById(G, aId), b = nodeById(G, bId), L = lineLengthKm(a, b), cost = lineCost(G, L, kv, A);
  if (!spend(G, cost, 'đường dây')) return null;
  const quality = 1 + (0.6 * G.corruption) / 100;
  const l = createLine({ a: aId, b: bId, kv, A, L, quality, Tw: G.Ta });
  G.net.lines.push(l); G.version++;
  news(G, `Đã kéo tuyến ${a.name} – ${b.name}: ${fmt(L)} km, ${fmt(kv, kv === 10.5 ? 1 : 0)} kV, ${A} mm² (−${fmt(cost, 1)} triệu USD).${quality > 1.05 ? ` Tham nhũng làm điện trở cao hơn thiết kế ${fmt((quality - 1) * 100)}%.` : ''}`);
  return l;
}

/** Tua nhanh đồng hồ tới 20:00 (nếu đang ban ngày) hoặc 07:00 hôm sau. Mô phỏng không chạy trong khoảng nhảy. */
export function skipDayNight(G) {
  const h = hourOfDay(G), target = h >= 7 && h < 20 ? 20 : 7;
  G.t += ((target - h + 24) % 24) * 3600;
  news(G, target === 20 ? 'Tua nhanh tới 20:00: giờ cao điểm buổi tối, thành phố lên đèn.' : 'Tua nhanh tới 07:00 sáng.');
}

export function demolishLine(G, id) {
  G.net.lines = G.net.lines.filter((l) => l.id !== id); G.version++;
  news(G, 'Đã tháo dỡ một tuyến dây.');
}
export function toggleBreaker(G, id) {
  const l = lineById(G, id);
  if (l.state === 'tripped' || l.state === 'collapse') { l.state = 'ok'; l.closed = true; l.trip = 0; news(G, 'Đóng lại máy cắt, tuyến có điện trở lại.'); return; }
  l.closed = !l.closed;
}
export function repairLine(G, id) {
  const l = lineById(G, id);
  if (l.state !== 'fire') return;
  if (!spend(G, 0.2 * lineCost(G, l.L, l.kv, l.A), 'sửa đường dây')) return;
  l.state = 'ok'; l.Tw = G.Ta; l.trip = 0;
  news(G, 'Đội kỹ thuật đã thay dây cháy và đóng điện lại.');
}
export function repairNode(G, id) {
  const n = nodeById(G, id);
  if (n.state !== 'fire' || !spend(G, NODE_REPAIR * G.priceLevel, 'thay máy biến áp')) return;
  n.state = 'ok'; n.Tt = 45;
  news(G, `Đã thay máy biến áp mới tại ${n.name}.`);
}

export function gacha(G) {
  if (!spend(G, GACHA_COST * G.priceLevel, 'tuyển kỹ sư')) return;
  G.engineer = rollEngineer(G.corruption);
  const msg = { fake: ['Tuyển nhầm kỹ sư thiếu kinh nghiệm! Coi chừng họ bấm SCRAM bừa.', 'warn'],
    rare: ['Đã thuê chuyên gia quốc tế tiếp quản phòng điều khiển.', ''],
    legend: ['Chiêu mộ được Tiến sĩ hạt nhân – huyền thoại vận hành lò!', ''] }[G.engineer.tier];
  news(G, `Gacha: ${msg[0]}`, msg[1]);
}
export function fireEngineer(G) { if (G.engineer) news(G, `Đã cho ${G.engineer.name} nghỉ việc.`); G.engineer = null; }
export function antiCorruption(G) {
  if (!spend(G, INSPECT_COST * G.priceLevel, 'thanh tra')) return;
  G.corruption = Math.max(0, G.corruption - 8); G.approval = Math.min(100, G.approval + 4);
  news(G, 'Thanh tra các dự án lưới điện: tham nhũng giảm, vật tư mới đạt chuẩn hơn.');
}
export function printMoney(G) {
  G.budget += PRINT_AMOUNT; G.inflation += 3.5; G.approval = Math.max(0, G.approval - 5);
  news(G, `Ngân hàng trung ương in thêm ${PRINT_AMOUNT} triệu USD. Lạm phát tăng, giá vật tư leo thang.`, 'warn');
}

export const SCENARIOS = [
  ['Khởi động lại lò', (G) => { G.reactor = createReactor(); G.gridFault = false; news(G, 'Lò phản ứng được nạp lại, vận hành định mức.'); }],
  ['Nắng nóng 44 °C', (G) => { G.Ta = 44; news(G, 'Đợt nóng 44 °C: điều hoà chạy hết công suất, dây dẫn khó tản nhiệt.', 'warn'); }],
  ['Thời tiết bình thường', (G) => { G.Ta = 30; news(G, 'Thời tiết dịu lại, 30 °C.'); }],
  ['Sóng thần (mất lưới + ngập diesel)', (G) => { G.gridFault = true; G.reactor.diesel = false; news(G, 'Sóng thần giả định: cắt điện lưới ngoài của nhà máy, máy phát diesel bị ngập.', 'bad'); }],
  ['Lò kiểu RBMK, tắt bảo vệ', (G) => { G.reactor = createReactor({ rbmk: true, rps: false }); news(G, 'Lò RBMK: hệ số rỗng dương, SCRAM chậm 20 giây, đầu thanh than chì (AZ-3). Bảo vệ tự động bị tắt.', 'warn'); }],
];
