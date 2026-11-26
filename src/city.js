// Mô phỏng đô thị (kiểu Cities: Skylines, giản lược): mỗi thành phố là lưới lô phố N×N.
// Dịch vụ công phủ sóng theo bán kính → hạnh phúc → tăng trưởng dân số và lòng dân cả nước.
// Dịch vụ và metro tiêu thụ điện thật trong lưới và tốn chi phí vận hành mỗi ngày.
import { news } from './news.js';
import { fmt } from './util.js';
import { seeded } from './rng.js';

export const N = 9; // 9 × 9 lô
export const SERVICES = {
  school: { name: 'Trường học', cat: 'edu', cost: 1.2, upkeep: 0.03, MW: 1, radius: 2 },
  hospital: { name: 'Bệnh viện', cat: 'health', cost: 2.5, upkeep: 0.06, MW: 4, radius: 3 },
  police: { name: 'Đồn cảnh sát', cat: 'police', cost: 1, upkeep: 0.025, MW: 0.5, radius: 2 },
  fire: { name: 'Trạm cứu hoả', cat: 'fire', cost: 1, upkeep: 0.025, MW: 0.5, radius: 2 },
  park: { name: 'Công viên', cat: 'leisure', cost: 0.6, upkeep: 0.01, MW: 0, radius: 1 },
  station: { name: 'Ga metro', cat: 'transit', cost: 3, upkeep: 0.05, MW: 2, radius: 2 },
};
export const CATS = [
  ['edu', 'Giáo dục', 0.15], ['health', 'Y tế', 0.2], ['police', 'An ninh', 0.1], ['fire', 'Phòng cháy', 0.1],
  ['leisure', 'Giải trí', 0.1], ['transit', 'Giao thông công cộng', 0.15], ['power', 'Điện ổn định', 0.2],
];
export const TRACK_COST = 0.4, TRACK_MW = 0.4; // mỗi lô chiều dài tuyến metro
export const LINE_COLORS = ['#e74c3c', '#2e86de', '#27ae60', '#f39c12', '#8e44ad'];

const idx = (i, j) => i * N + j;

/** Sinh thành phố có sẵn vài dịch vụ cơ bản; mật độ cao ở trung tâm. */
export function createCity(node) {
  const r = seeded(`city-${node.id}`), lots = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const d = Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2) / (N / 2);
    const k = r();
    lots.push({ i, j, type: k < 0.16 ? 'empty' : d < 0.45 ? 'com' : 'res', h: Math.max(0.2, 1 - d + r() * 0.35) });
  }
  const C = { id: node.id, lots, lines: [], draft: null, happiness: 55, parts: {}, congestion: 0, extraMW: 0, upkeep: 0, cars: 0 };
  // Dịch vụ ban đầu: phủ một phần, để còn chỗ cho người chơi cải thiện
  for (const [type, i, j] of [['school', 2, 2], ['hospital', 4, 5], ['police', 6, 3], ['fire', 2, 6], ['park', 4, 3]]) lots[idx(i, j)].type = type;
  return C;
}
export const lotAt = (C, i, j) => (i >= 0 && j >= 0 && i < N && j < N ? C.lots[idx(i, j)] : null);
export const stationsOn = (C, line) => line.map((k) => C.lots[k]);
const isService = (lot) => !!SERVICES[lot.type];

/** Một ga chỉ phục vụ khi nằm trên tuyến có ít nhất 2 ga. */
export function servedStations(C) {
  const s = new Set();
  for (const l of C.lines) if (l.stops.length >= 2) l.stops.forEach((k) => s.add(k));
  return s;
}
export const trackLength = (C, line) => line.stops.slice(1).reduce((a, k, n) => {
  const p = C.lots[line.stops[n]], q = C.lots[k];
  return a + Math.hypot(p.i - q.i, p.j - q.j);
}, 0);

/** Tính phủ sóng, tắc đường, hạnh phúc, điện tiêu thụ và chi phí; không đổi trạng thái ngoài C. */
export function evaluate(C, powerFrac, pop) {
  const live = servedStations(C);
  const providers = C.lots.filter((l) => isService(l) && (l.type !== 'station' || live.has(idx(l.i, l.j))));
  const homes = C.lots.filter((l) => l.type === 'res' || l.type === 'com');
  const parts = {};
  for (const [cat] of CATS) {
    if (cat === 'power') { parts.power = powerFrac; continue; }
    const ps = providers.filter((p) => SERVICES[p.type].cat === cat);
    parts[cat] = homes.length ? homes.filter((h) => ps.some((p) => Math.max(Math.abs(p.i - h.i), Math.abs(p.j - h.j)) <= SERVICES[p.type].radius)).length / homes.length : 0;
  }
  // Tắc đường: dân số lớn, ít metro → kẹt xe
  C.congestion = Math.max(0, Math.min(1.3, (pop / 450) * (1 - 0.6 * parts.transit)));
  const base = CATS.reduce((s, [c, , w]) => s + w * parts[c], 0) * 100;
  C.happiness = Math.max(0, Math.min(100, base + 18 - 14 * C.congestion));
  C.parts = parts;
  C.extraMW = C.lots.reduce((s, l) => s + (SERVICES[l.type]?.MW ?? 0), 0) + C.lines.reduce((s, l) => s + trackLength(C, l) * TRACK_MW, 0);
  C.upkeep = C.lots.reduce((s, l) => s + (SERVICES[l.type]?.upkeep ?? 0), 0) + C.lines.reduce((s, l) => s + trackLength(C, l) * 0.01, 0);
  C.cars = Math.round(30 + 50 * Math.min(1, C.congestion));
  return C;
}

// ---------- Hành động ----------
const cost = (G, base) => base * G.priceLevel * (1 + G.corruption / 100);
export const serviceCost = (G, type) => cost(G, SERVICES[type].cost);

export function buildService(G, C, i, j, type) {
  const lot = lotAt(C, i, j);
  if (!lot) return false;
  if (lot.type !== 'empty' && !(lot.type === 'res' || lot.type === 'com')) { news(G, 'Lô này đã có công trình công cộng.', 'warn'); return false; }
  const c = serviceCost(G, type) * (lot.type === 'empty' ? 1 : 1.5); // phá nhà cũ để xây thì đắt hơn
  if (G.budget < c) { news(G, `Không đủ ngân sách xây ${SERVICES[type].name.toLowerCase()} (cần ${fmt(c, 1)} triệu USD).`, 'warn'); return false; }
  G.budget -= c; lot.type = type; G.cityVersion = (G.cityVersion || 0) + 1;
  news(G, `Đã xây ${SERVICES[type].name.toLowerCase()} (−${fmt(c, 1)} triệu USD).`);
  return true;
}

export function demolish(G, C, i, j) {
  const lot = lotAt(C, i, j);
  if (!lot || !isService(lot)) return false;
  const k = idx(i, j);
  if (lot.type === 'station') for (const l of C.lines) l.stops = l.stops.filter((s) => s !== k);
  C.lines = C.lines.filter((l) => l.stops.length >= 2 || l === C.draft);
  lot.type = 'empty'; G.cityVersion = (G.cityVersion || 0) + 1;
  news(G, 'Đã phá dỡ công trình, lô trở thành đất trống.');
  return true;
}

/** Vẽ tuyến metro: bấm lần lượt các lô; lô trống/nhà sẽ được xây ga. */
export function metroClick(G, C, i, j) {
  const lot = lotAt(C, i, j);
  if (!lot) return;
  if (lot.type !== 'station' && !buildService(G, C, i, j, 'station')) return;
  const k = idx(i, j);
  if (!C.draft) { C.draft = { stops: [k], color: LINE_COLORS[C.lines.length % LINE_COLORS.length] }; C.lines.push(C.draft); G.cityVersion++; return; }
  if (C.draft.stops.at(-1) === k) return;
  const p = C.lots[C.draft.stops.at(-1)], len = Math.hypot(p.i - i, p.j - j), c = cost(G, TRACK_COST) * len;
  if (G.budget < c) { news(G, `Không đủ ngân sách làm ${fmt(len, 1)} lô đường ray (cần ${fmt(c, 1)} triệu USD).`, 'warn'); return; }
  G.budget -= c; C.draft.stops.push(k); G.cityVersion++;
}
export function finishLine(G, C) {
  if (!C.draft) return;
  if (C.draft.stops.length < 2) C.lines = C.lines.filter((l) => l !== C.draft);
  else news(G, `Khai trương tuyến metro ${C.lines.indexOf(C.draft) + 1}: ${C.draft.stops.length} ga, ${fmt(trackLength(C, C.draft), 1)} lô đường ray trên cao.`);
  C.draft = null; G.cityVersion++;
}

/** Mỗi bước: đánh giá từng thành phố, tăng trưởng, chi phí, góp vào lòng dân cả nước. Trả về hạnh phúc bình quân theo dân số. */
export function citiesStep(G, dt) {
  const day = dt / 86400;
  let wSum = 0, hSum = 0;
  for (const n of G.net.nodes) {
    if (n.type !== 'city') continue;
    const C = (G.cities[n.id] ||= createCity(n));
    evaluate(C, n.frac ?? 0, n.demandBase);
    n.extraMW = C.extraMW;
    G.budget -= C.upkeep * G.priceLevel * day;
    // Thành phố hạnh phúc hút dân về (nhu cầu điện tăng), bất mãn thì dân bỏ đi
    n.demandBase = Math.max(80, n.demandBase * (1 + ((C.happiness - 55) / 100) * 0.05 * day));
    wSum += n.demandBase; hSum += C.happiness * n.demandBase;
  }
  G.happiness = wSum ? hSum / wSum : 55;
  return G.happiness;
}
