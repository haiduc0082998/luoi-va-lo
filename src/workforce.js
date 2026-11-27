// Nhân công: mỗi công trình cần một kíp vận hành; thiếu người thì nhà máy không chạy hết công suất,
// công trường chậm, nâng cấp dễ hỏng. Người làm việc lấy từ dân các thành phố; thuê thêm tạo việc làm
// (dân vui hơn) nhưng tốn lương mỗi ngày. Ma tuý trong thành phố làm năng suất lao động giảm.
import { news } from './news.js';
import { fmt } from './util.js';

/** Số người cần cho mỗi loại công trình (kíp vận hành 3 ca). */
export const CREW = { nuclear: 450, coal: 260, hydro: 90, sub: 24, wind: 18, mine: 160, border: 30, city: 0 };
export const INFRA_CREW = { port: 140, airport: 160, tower: 12, road: 8, wind: 18 };
export const WAGE = 22;          // USD / người / ngày (đã gồm bảo hiểm)
export const HIRE_FEE = 300;     // USD / người: tuyển dụng, đào tạo an toàn
export const SEVERANCE = 600;    // USD / người: trợ cấp thôi việc

export function createStaff() { return { hired: 1100 }; }

/** Số người cần ngay lúc này (cả công trường đang thi công). */
export function needed(G) {
  let s = 0;
  for (const n of G.net.nodes) s += (CREW[n.type] ?? 0) * (1 + 0.15 * ((n.lv ?? 1) - 1));
  if (G.reactor2) s += CREW.nuclear * 0.8;
  for (const it of G.infra ?? []) s += INFRA_CREW[it.type] ?? 0;
  if (G.unit2?.state === 'building') s += 700;
  return Math.round(s);
}

/** Lực lượng lao động sẵn sàng đi làm: khoảng 0,6 % dân số đô thị (dân số ≈ 1 000 người / MW nhu cầu). */
export function laborPool(G) {
  return Math.round(G.net.nodes.filter((n) => n.type === 'city').reduce((s, n) => s + n.demandBase * 1000, 0) * 0.006);
}

/** Tỉ lệ đủ người (0..1), đã tính năng suất giảm do ma tuý. */
export function staffRatio(G) {
  const need = needed(G);
  if (!need) return 1;
  const drugs = avgThreat(G, 'drugs');
  return Math.min(1, (G.staff.hired / need) * (1 - drugs / 300));
}
const avgThreat = (G, k) => {
  const cs = Object.values(G.cities ?? {});
  return cs.length ? cs.reduce((s, C) => s + (C.threat?.[k] ?? 0), 0) / cs.length : 0;
};

/** Hệ số công suất tối đa của nhà máy theo số người: thiếu một nửa kíp chỉ chạy được ~65 %. */
export const crewFactor = (G) => 0.3 + 0.7 * staffRatio(G);

export const dailyWage = (G) => (G.staff.hired * WAGE * G.priceLevel) / 1e6; // triệu USD / ngày

export function hire(G, count) {
  const room = laborPool(G) - G.staff.hired;
  const k = Math.max(0, Math.min(count, room));
  if (k <= 0) { news(G, 'Không còn người trong độ tuổi lao động để tuyển: hãy phát triển thành phố.', 'warn'); return 0; }
  const cost = (k * HIRE_FEE * G.priceLevel) / 1e6;
  if (cost > G.budget) { news(G, `Không đủ ngân sách tuyển ${fmt(k)} người (cần ${fmt(cost, 2)} triệu USD).`, 'warn'); return 0; }
  G.budget -= cost; G.staff.hired += k;
  news(G, `Tuyển thêm ${fmt(k)} nhân công (−${fmt(cost, 2)} triệu USD phí tuyển dụng). Tổng ${fmt(G.staff.hired)} người.`);
  return k;
}

export function dismiss(G, count) {
  const k = Math.max(0, Math.min(count, G.staff.hired));
  if (!k) return 0;
  const cost = (k * SEVERANCE * G.priceLevel) / 1e6;
  G.budget -= cost; G.staff.hired -= k; G.approval = Math.max(0, G.approval - k / 400);
  news(G, `Cho thôi việc ${fmt(k)} người (−${fmt(cost, 2)} triệu USD trợ cấp). Dân không vui khi mất việc.`, 'warn');
  return k;
}

/** Thuê vừa đủ số người cần (hoặc tối đa có thể). */
export const hireToNeed = (G) => hire(G, needed(G) - G.staff.hired);

/** Mỗi bước: trả lương; có việc làm thì dân hài lòng hơn một chút. Trả về thay đổi lòng dân / giờ. */
export function staffStep(G, dt) {
  G.budget -= dailyWage(G) * (dt / 86400);
  const pool = laborPool(G);
  return pool ? 0.6 * Math.min(1, G.staff.hired / (0.3 * pool)) - 0.3 : 0;
}
