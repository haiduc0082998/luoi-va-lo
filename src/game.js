// Trạng thái quốc gia: thời gian, ngân sách, lòng dân, lạm phát, tham nhũng, kỹ sư, xây dựng, bản tin.
import {
  createNode, createLine, stepNetwork, lineLengthKm, connectedToOtherSource, findIslands,
} from './physics/network.js';
import { createReactor, stepReactor } from './physics/reactor.js';
import { rollEngineer, runEngineer } from './engineers.js';
import { worldStep, createWorld } from './world.js';
import { createWeather, weatherStep, current as weatherNow, windNow, windFarmMW, hConv, setWeather, airTemp } from './weather.js';
import { createResources, infraStep, count as infraCount } from './infra.js';
import { citiesStep } from './city.js';
import { buildable, PADS } from './map.js';
import { fmt } from './util.js';
import { news } from './news.js';
import { missionsStep } from './missions.js';
import { createStaff, crewFactor, staffRatio, staffStep } from './workforce.js';
import { capMul, subRated, level } from './upgrade.js';
import { startupStep } from './startup.js';
const newsRaw = news;
import { applyTech, netParams, politicsStep, spotPrice, retailEffective, rpPerDay, has } from './policy.js';

export const START_HOUR = 8;
export const PRICE_USD_MWH = 60;
export const COAL_USD_MWH = 35;
export const COAL_MAX = 600;
// Giá xây dựng đã thu nhỏ cho nhịp chơi nhanh (triệu USD); giá điện giữ thật.
export const LINE_COST_KM = { 10.5: 0.01, 110: 0.03, 220: 0.05, 500: 0.1, 750: 0.15 }; // ở 400 mm²
export const HYDRO_MAX = 250;
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
  { id: 'hydro', name: 'Thủy điện Sông Lam', type: 'hydro', x: -12.8, z: -8 },
  { id: 'border', name: 'Cửa khẩu Đông (nước láng giềng)', type: 'border', x: 104, z: -14 },
  { id: 'mine', name: 'Mỏ uranium & đất hiếm', type: 'mine', x: 34, z: -62, demandBase: 60 },
  // Vùng đất mở rộng (bản đồ 380 × 380): đồng bằng phía nam và miền duyên hải phía tây
  { id: 'south', name: 'Nam Bình', type: 'city', x: 46, z: 146, demandBase: 150 },
  { id: 'west', name: 'Tây Hải', type: 'city', x: -128, z: 118, demandBase: 110 },
];
const INITIAL_LINES = [
  { a: 'nuc', b: 'subE', kv: 500, A: 630 },
  { a: 'coal', b: 'subW', kv: 220, A: 400 },
  { a: 'subE', b: 'capital', kv: 500, A: 630 },
  { a: 'subW', b: 'port', kv: 220, A: 630 },
  { a: 'subW', b: 'subE', kv: 500, A: 630 }, // trục 500 kV đông – tây: đủ tải cho cả miền tây và duyên hải
  { a: 'hydro', b: 'subW', kv: 220, A: 400 },
  { a: 'mine', b: 'subE', kv: 220, A: 240 },
  { a: 'capital', b: 'south', kv: 220, A: 400 },
  { a: 'port', b: 'west', kv: 220, A: 400 },
];
for (const n of INITIAL_NODES.filter((x) => x.type !== 'hydro')) PADS.push([n.x, n.z, n.type === 'city' ? 14 : n.type === 'nuclear' ? 16 : n.type === 'coal' ? 20 : 9]); // nhiệt điện: mặt bằng rộng cho tấm nền mô hình

export function createGame() {
  const nodes = INITIAL_NODES.map((n) => createNode(n));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines = INITIAL_LINES.map((l) => createLine({ ...l, L: lineLengthKm(byId.get(l.a), byId.get(l.b)), Tw: 30 }));
  return {
    t: 0, speed: 300 /* mặc định 300×: một ngày game ≈ 4,8 phút thực */, approval: 62, budget: 20, inflation: 2, corruption: 15, priceLevel: 1, Ta: 30,
    news: [], listeners: new Set(), protest: false, newsAcc: 0, engAcc: 0,
    net: { nodes, lines }, reactor: createReactor(), reactor2: null, unit2: { state: 'none', progress: 0 },
    coalMax: COAL_MAX, gridFault: false, wasOffsite: true,
    engineer: null, engAuto: true, version: 1, subCount: 2,
    // Giai đoạn 5
    market: { retail: 60, contractMW: 200, exportOn: false, sanctionUntil: 0, pressureAt: 0 },
    reputation: 60, factions: { business: 55, military: 55 },
    decrees: { subsidy: false, monopoly: false, defense: false, martial: false },
    world: createWorld(), weather: createWeather(), res: createResources(), infra: [], cities: {}, happiness: 55, cityAcc: 60, cityVersion: 0,
    tech: new Set(), rp: 0, researchBudget: 0.2, danger: {}, over: null, lastBudget: 20, profitPerH: 0,
    missions: { done: [], held: {} },
    staff: createStaff(), repair: {},
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
  return (day + evening) * (1 + Math.max(0, Ta - 30) * 0.012 + Math.max(0, 16 - Ta) * 0.015); // điều hoà khi nóng, sưởi khi rét
}

export { news };
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
/** Các tổ máy đang tồn tại (tổ 1 luôn có, tổ 2 khi đã xây xong). */
export const units = (G) => (G.reactor2 ? [G.reactor, G.reactor2] : [G.reactor]);
export const maxRelease = (G) => Math.max(...units(G).map((r) => r.release));

function reactorEvent(G, type, unit = 1) {
  const R = unit === 2 ? G.reactor2 : G.reactor;
  const pre = G.reactor2 ? `Tổ máy ${unit}: ` : '';
  const news = (G2, text, lvl) => newsRaw(G2, pre + text, lvl);
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
  const h = dt / 3600, day = dt / 86400;
  const border = nodeById(G, 'border'), port = nodeById(G, 'port');
  const domestic = G.net.nodes.filter((n) => n.type === 'city').reduce((s2, n) => s2 + n.served, 0);
  const coalGen = nodeById(G, 'coal').gen, sanction = G.market.sanctionUntil > G.t;
  const b0 = G.budget;
  G.budget += (domestic * retailEffective(G) * (G.decrees.monopoly ? 1.15 : 1) * G.priceLevel * h * (1 - G.corruption / 200)) / 1e6;
  G.budget += (border.served * spotPrice(G, hourOfDay(G)) * G.priceLevel * h) / 1e6;
  G.budget -= (coalGen * COAL_USD_MWH * (sanction ? 1.3 : 1) * (G.world.coalDealUntil > G.t ? 0.75 : 1) * G.priceLevel * h) / 1e6;
  if (G.engineer) G.budget -= G.engineer.salary * G.priceLevel * day;
  G.budget -= (G.researchBudget + (G.decrees.defense ? 0.25 : 0)) * G.priceLevel * day;
  G.rp += rpPerDay(G) * day;
  G.profitPerH += ((G.budget - b0) / h - G.profitPerH) * Math.min(1, dt / 3600);

  const cityDem = G.net.nodes.filter((n) => n.type === 'city').reduce((s2, n) => s2 + n.demand, 0);
  const fw = cityDem > 0 ? domestic / cityDem : 1;
  G.inflation += ((2 - G.inflation) * day) / 3 + (1 - fw) * 0.5 * day;
  G.priceLevel *= 1 + (G.inflation / 100) * (day / 5);
  G.corruption = Math.min(80, G.corruption + 0.5 * day * (has(G, 'audit') ? 0.5 : 1) * (G.decrees.monopoly ? 2 : 1));

  let dA = fw > 0.999 ? (G.approval < 85 ? 2 : 0) : -14 * (1 - fw);
  dA -= maxRelease(G) * 25;
  dA += (G.happiness - 55) * 0.05; // dịch vụ đô thị tốt → dân hài lòng
  dA += staffStep(G, dt);          // trả lương; có việc làm thì dân vui hơn
  dA -= (G.propaganda ?? 0) * 0.012; // tuyên truyền chống phá làm xói mòn lòng tin
  if (G.inflation > 6) dA -= (G.inflation - 6) * 0.4;
  if (G.corruption > 35) dA -= (G.corruption - 35) * 0.05;
  G.approval = Math.max(0, Math.min(100, G.approval + dA * h));
  politicsStep(G, dt, { secFrac: fw, portFrac: port.demand > 0 ? port.frac : 1, profitPerH: G.profitPerH, exportFrac: border.demand > 0 ? border.frac : 1 });
  if (G.approval < 25 && !G.protest && !G.decrees.martial) {
    G.protest = true;
    news(G, 'Biểu tình lan rộng: người dân đòi chính phủ chịu trách nhiệm về điện, giá cả và an toàn.', 'bad');
  }
  if (G.approval > 35) G.protest = false;
  G.newsAcc += dt;
  if (G.newsAcc > 7200) { G.newsAcc = 0; news(G, WORLD_NEWS[Math.floor(Math.random() * WORLD_NEWS.length)]); }
}

/**
 * Mô phỏng đa nhịp: tiến thời gian thực dtReal giây × tốc độ game.
 *  - Nhịp nhanh 0,05 s game: lò phản ứng (động học neutron, nhiệt lõi), quy trình khởi động, kỹ sư.
 *  - Nhịp chậm H = 0,25–1 s game: lưới điện, thời tiết, hạ tầng, đô thị, ngoại giao, kinh tế – chính trị.
 *    Các hằng số thời gian ở đây tính bằng phút đến ngày (nhiệt dây, dầu máy biến áp, lạm phát…) nên bước
 *    chậm vẫn chính xác, mà ở tốc độ cao chỉ tốn khoảng 1/5–1/20 thời gian tính so với chạy mọi thứ ở 0,05 s.
 */
export const FAST_DT = 0.05;
export const slowTick = (speed) => Math.min(1, Math.max(0.25, speed / 1200));

function slowStep(G, h) {
  const U = units(G);
  applyTech(G);
  const nuc = nodeById(G, 'nuc'), coal = nodeById(G, 'coal'), hyd = nodeById(G, 'hydro');
  nuc.rated = G.reactor2 ? 2400 : 1200;
  weatherStep(G, h);
  const W = weatherNow(G), wind = windNow(G);
  G.Ta = airTemp(G); G.windNow = wind;
  const towers = Math.min(3, infraCount(G, 'tower'));
  U.forEach((r) => (r.dTin = W.dTin - 3 * towers));
  U.forEach((r) => (r.eff += 0.02 * (level(nuc) - 1))); // nâng cấp tua-bin
  for (const n of G.net.nodes) if (n.type === 'sub') n.rated = subRated(n);
  // Thiếu nhân công thì nhà máy không chạy hết công suất (lò hạt nhân vẫn sinh nhiệt, nhưng tua-bin giảm tải)
  const crew = crewFactor(G);
  G.repairK = 0.4 + 0.6 * staffRatio(G); // tốc độ sửa chữa theo nhân công (dùng ở nhịp nhanh)
  const cap = { nuc: nuc.state === 'ok' ? (U.reduce((s, r) => s + r.Pe, 0) / 1e6) * crew : 0, coal: coal.state === 'ok' ? G.coalMax * capMul(coal) * crew : 0, hydro: hyd.state === 'ok' ? HYDRO_MAX * W.hydro * capMul(hyd) * crew : 0 };
  for (const n of G.net.nodes) if (n.type === 'wind' && n.state === 'ok') cap[n.id] = windFarmMW(wind) * capMul(n) * crew;
  const exportMW = G.market.exportOn ? G.market.contractMW : 0;
  stepNetwork(G.net, h, { cap, exportMW, demandMul: demandMul(hourOfDay(G), G.Ta), Ta: G.Ta, hConv: hConv(wind), ...netParams(G) }, (t, d) => netEvent(G, t, d));
  autoReclose(G, h);
  const offsite = !G.gridFault && nuc.state === 'ok' && connectedToOtherSource(G.net, 'nuc');
  if (offsite !== G.wasOffsite) {
    G.wasOffsite = offsite;
    news(G, offsite ? 'Nhà máy hạt nhân có lại điện lưới ngoài.' : 'Nhà máy hạt nhân mất điện lưới ngoài! Bơm cần máy phát diesel.', offsite ? '' : 'bad');
  }
  U.forEach((R) => (R.offsite = offsite));
  buildProgress(G, h);
  infraStep(G, h, U);
  G.cityAcc += h;
  if (G.cityAcc >= 60) { citiesStep(G, G.cityAcc); G.cityAcc = 0; }
  worldStep(G, h);
  politics(G, h);
}

export function advance(G, dtReal) {
  if (G.over) return;
  const total = dtReal * G.speed, n = Math.ceil(total / FAST_DT), H = slowTick(G.speed);
  if (G.slowAcc === undefined) { G.slowAcc = 0; slowStep(G, 1e-3); }
  for (let i = 0; i < n; i++) {
    const h = total / n, U = units(G);
    U.forEach((R, k) => stepReactor(R, h, (t) => reactorEvent(G, t, k + 1)));
    startupStep(G, h, G.repairK ?? 1);
    if (G.engineer && G.engAuto) {
      G.engAcc += h;
      if (G.engAcc >= 1) {
        G.engAcc = 0;
        const want = nuclearWant(G) / U.length;
        U.forEach((R, k) => runEngineer(G.engineer, R, want, Math.random, (txt, lvl) => news(G, (U.length > 1 ? `Tổ máy ${k + 1}: ` : '') + txt, lvl)));
      }
    }
    G.t += h; G.slowAcc += h;
    if (G.slowAcc >= H - 1e-9) { slowStep(G, G.slowAcc); G.slowAcc = 0; }
    if (G.over) { news(G, G.over, 'bad'); break; }
  }
  if (!G.over && total > 0) missionsStep(G, total);
}

// ---------- Tổ máy số 2 ----------
export const UNIT2_COST = 30, UNIT2_DAYS = 3;
export const unit2Cost = (G) => UNIT2_COST * costMul(G);
export function startUnit2(G) {
  if (!has(G, 'unit2') || G.unit2.state !== 'none') return;
  if (!spend(G, unit2Cost(G), 'tổ máy số 2')) return;
  G.unit2 = { state: 'building', progress: 0 };
  news(G, `Khởi công tổ máy số 2 (−${fmt(unit2Cost(G), 1)} triệu USD). Dự kiến hoàn thành sau ${UNIT2_DAYS} ngày.`);
}
function buildProgress(G, dt) {
  if (G.unit2.state !== 'building') return;
  G.unit2.progress = Math.min(1, G.unit2.progress + (dt * staffRatio(G)) / (UNIT2_DAYS * 86400)); // thiếu người thì công trường chậm
  if (G.unit2.progress >= 1) {
    G.unit2.state = 'done';
    G.reactor2 = createReactor({ wind: G.reactor.wind });
    G.version++;
    news(G, 'Tổ máy số 2 hoà lưới: thêm khoảng 1 000 MW điện. Máy biến áp nhà máy nâng lên 2 400 MVA.');
  }
}

// ---------- Hành động của người chơi ----------
export const lineCost = (G, L, kv, A, sc = false) => L * LINE_COST_KM[kv] * Math.sqrt(A / 400) * costMul(G) * (sc ? 4 : 1);
export const gachaCost = (G) => GACHA_COST * G.priceLevel * (has(G, 'academy') ? 0.5 : 1) * (infraCount(G, 'airport') ? 0.7 : 1);
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

export function buildLine(G, aId, bId, kv, A, sc = false) {
  if (aId === bId) return null;
  if (G.net.lines.some((l) => (l.a === aId && l.b === bId) || (l.a === bId && l.b === aId))) {
    news(G, 'Hai công trình này đã có đường dây nối với nhau.', 'warn'); return null;
  }
  const a = nodeById(G, aId), b = nodeById(G, bId), L = lineLengthKm(a, b), cost = lineCost(G, L, kv, A, sc);
  if (!spend(G, cost, 'đường dây')) return null;
  const quality = sc ? 0.02 : 1 + (0.6 * G.corruption) / 100;
  const l = createLine({ a: aId, b: bId, kv, A, L, quality, Tw: G.Ta, sc });
  G.net.lines.push(l); G.version++;
  news(G, `Đã kéo tuyến ${sc ? 'siêu dẫn ' : ''}${a.name} – ${b.name}: ${fmt(L)} km, ${fmt(kv, kv === 10.5 ? 1 : 0)} kV, ${A} mm² (−${fmt(cost, 1)} triệu USD).${quality > 1.05 ? ` Tham nhũng làm điện trở cao hơn thiết kế ${fmt((quality - 1) * 100)}%.` : ''}`);
  return l;
}

/** Tua nhanh đồng hồ tới 20:00 (nếu đang ban ngày) hoặc 07:00 hôm sau. Mô phỏng không chạy trong khoảng nhảy. */
export function skipDayNight(G) {
  const h = hourOfDay(G), target = h >= 7 && h < 20 ? 20 : 7;
  G.t += ((target - h + 24) % 24) * 3600;
  news(G, target === 20 ? 'Tua nhanh tới 20:00: giờ cao điểm buổi tối, thành phố lên đèn.' : 'Tua nhanh tới 07:00 sáng.');
}

/** Đóng lại máy cắt khi dây đã nguội: sự cố sét tự đóng lại sau 30 giây như lưới thật;
 *  sự cố quá tải do điều độ viên đóng lại sau 30 phút, hoặc 2 phút khi có trạm thông minh / AI điều độ. */
function autoReclose(G, dt) {
  const fast = has(G, 'smartsub') || has(G, 'dispatchAI');
  for (const l of G.net.lines) {
    if (l.state !== 'tripped' && l.state !== 'collapse') { l.wait = 0; l.transient = false; continue; }
    l.wait = (l.wait || 0) + dt;
    const delay = l.transient ? 30 : fast ? 120 : 1800;
    if (l.wait > delay && l.Tw < 70) {
      l.state = 'ok'; l.trip = 0; l.wait = 0;
      news(G, `${l.transient ? 'Tự đóng lại sau sự cố sét' : fast ? 'AI điều độ đóng lại' : 'Điều độ viên đóng lại'} tuyến ${nodeById(G, l.a).name} – ${nodeById(G, l.b).name}.`);
      l.transient = false;
    }
  }
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
  if (!spend(G, gachaCost(G), 'tuyển kỹ sư')) return;
  G.engineer = rollEngineer(has(G, 'academy') ? -60 : G.corruption);
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
  ['Khởi động lại lò', (G) => { G.reactor = createReactor({ wind: G.reactor.wind }); if (G.reactor2) G.reactor2 = createReactor({ wind: G.reactor.wind }); G.gridFault = false; news(G, 'Các tổ máy được nạp lại, vận hành định mức.'); }],
  ['Nắng nóng cực đoan', (G) => setWeather(G, 'heatwave', ' (kịch bản)')],
  ['Bão tố, sấm sét', (G) => setWeather(G, 'storm', ' (kịch bản)')],
  ['Sóng thần (mất lưới + ngập diesel)', (G) => { G.gridFault = true; units(G).forEach((r) => (r.diesel = false)); news(G, 'Sóng thần giả định: cắt điện lưới ngoài của nhà máy, máy phát diesel bị ngập.', 'bad'); }],
  ['Lò kiểu RBMK, tắt bảo vệ', (G) => { G.reactor = createReactor({ rbmk: true, rps: false }); news(G, 'Lò RBMK: hệ số rỗng dương, SCRAM chậm 20 giây, đầu thanh than chì (AZ-3). Bảo vệ tự động bị tắt.', 'warn'); }],
];
