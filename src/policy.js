// Giai đoạn 5: thị trường điện, chính trị (phe phái, sắc lệnh), cây công nghệ, điều kiện thua.
import { news } from './news.js';
import { fmt } from './util.js';
import { shiftRelation } from './world.js';

// ---------- Cây công nghệ ----------
export const TECHS = [
  // Vật liệu & an toàn hạt nhân
  { id: 'boron', branch: 'nuclear', name: 'Thanh điều khiển Boron cải tiến', cost: 30, req: [],
    desc: 'Bỏ đầu than chì: xoá bẫy AZ-3, SCRAM lò RBMK nhanh như lò nước áp lực.' },
  { id: 'recombiner', branch: 'nuclear', name: 'Bộ tái tổ hợp hydro', cost: 40, req: ['boron'],
    desc: 'Hydro tích tụ chậm 5 lần khi lõi quá nóng, khó nổ nhà lò hơn.' },
  { id: 'passive', branch: 'nuclear', name: 'Làm mát thụ động', cost: 55, req: ['boron'],
    desc: 'Nước tự đối lưu 5% lưu lượng khi mất bơm: đủ tản nhiệt phân rã, chống kịch bản Fukushima.' },
  { id: 'unit2', branch: 'nuclear', name: 'Thiết kế tổ máy số 2', cost: 60, req: ['passive'],
    desc: 'Cho phép xây lò 3 000 MWt thứ hai cạnh tổ máy 1 (30 triệu USD, 3 ngày). Nút xây ở bảng nhà máy hạt nhân.' },
  { id: 'gen3', branch: 'nuclear', name: 'Lò thế hệ III+', cost: 100, req: ['recombiner', 'passive'],
    desc: 'Hiệu suất chu trình hơi 33% → 37%: thêm khoảng 120 MW điện từ cùng một lõi.' },
  // Truyền tải
  { id: 'accc', branch: 'grid', name: 'Dây chịu nhiệt lõi composite', cost: 30, req: [],
    desc: 'Dây chịu tới 350 °C mới cháy thay vì 250 °C (áp dụng cho mọi tuyến).' },
  { id: 'smartsub', branch: 'grid', name: 'Trạm biến áp thông minh', cost: 50, req: ['accc'],
    desc: 'Máy biến áp chịu tải gấp 1,5 lần; tuyến bị cắt do quá tải tự đóng lại sau 2 phút thay vì 30 phút.' },
  { id: 'uhv', branch: 'grid', name: 'Siêu cao thế 750 kV', cost: 60, req: ['accc'],
    desc: 'Mở khoá cấp điện áp 750 kV cho tuyến mới: dòng nhỏ hơn, tổn hao thấp hơn.' },
  { id: 'supercond', branch: 'grid', name: 'Đường dây siêu dẫn', cost: 140, req: ['uhv', 'smartsub'],
    desc: 'Tuyến mới có thể dùng cáp siêu dẫn: điện trở gần bằng 0, giá gấp 4 lần.' },
  // Quản trị & tự động hoá
  { id: 'academy', branch: 'gov', name: 'Trung tâm đào tạo kỹ sư', cost: 30, req: [],
    desc: 'Gacha rẻ một nửa và không còn ra kỹ sư rởm; thêm 3 điểm nghiên cứu mỗi ngày.' },
  { id: 'audit', branch: 'gov', name: 'Kiểm toán số', cost: 45, req: ['academy'],
    desc: 'Tham nhũng giảm ngay 10 điểm và tăng chậm một nửa.' },
  { id: 'dispatchAI', branch: 'gov', name: 'AI điều độ quốc gia', cost: 70, req: ['academy'],
    desc: 'Tuyến bị cắt tự đóng lại sau 2 phút khi dây đã nguội thay vì chờ điều độ viên 30 phút.' },
  { id: 'regionalMkt', branch: 'gov', name: 'Thị trường điện khu vực', cost: 70, req: ['dispatchAI'],
    desc: 'Giá xuất khẩu cao hơn 20%, hợp đồng được tới 600 MW.' },
];
export const BRANCHES = [['nuclear', 'Vật liệu & an toàn hạt nhân'], ['grid', 'Truyền tải siêu cao thế'], ['gov', 'Quản trị & tự động hoá']];
export const has = (G, id) => G.tech.has(id);
export const techState = (G, t) => (has(G, t.id) ? 'done' : t.req.every((r) => has(G, r)) ? (G.rp >= t.cost ? 'ready' : 'open') : 'locked');

export function research(G, id) {
  const t = TECHS.find((x) => x.id === id);
  if (!t || techState(G, t) !== 'ready') return false;
  G.rp -= t.cost; G.tech.add(id);
  if (id === 'audit') G.corruption = Math.max(0, G.corruption - 10);
  news(G, `Nghiên cứu xong: ${t.name}. ${t.desc}`);
  return true;
}
/** Điểm nghiên cứu mỗi ngày: từ ngân sách nghiên cứu, kỹ sư và trung tâm đào tạo. */
export const rpPerDay = (G) => (G.researchBudget * 50 + (G.engineer ? G.engineer.skill / 25 : 0) + (has(G, 'academy') ? 3 : 0)) * (G.infra?.some((s) => s.type === 'airport') ? 1.15 : 1);

/** Đẩy hiệu lực công nghệ vào mô hình vật lý (lò có thể được tạo lại bởi kịch bản). */
export function applyTech(G) {
  for (const R of [G.reactor, G.reactor2]) {
    if (!R) continue;
    R.boron = has(G, 'boron'); R.recombiner = has(G, 'recombiner'); R.passive = has(G, 'passive');
    R.eff = has(G, 'gen3') ? 0.37 : 0.33;
  }
}
const anyRelease = (G) => Math.max(G.reactor.release, G.reactor2?.release ?? 0);
export const netParams = (G) => ({ fireT: has(G, 'accc') ? 350 : 250, ratedMul: has(G, 'smartsub') ? 1.5 : 1 });

// ---------- Thị trường ----------
export const BASE_RETAIL = 60;
/** Giá giao ngay khu vực (USD/MWh): đỉnh tối 19–20 h, thấp lúc nửa đêm. */
export function spotPrice(G, hour) {
  const p = 45 + 50 * Math.exp(-((hour - 19.5) ** 2) / 4) + 15 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  return p * (has(G, 'regionalMkt') ? 1.2 : 1) * (G.market.sanctionUntil > G.t ? 0.7 : 1);
}
export const maxContract = (G) => (has(G, 'regionalMkt') ? 600 : 400);
export const retailEffective = (G) => G.market.retail * (G.decrees.subsidy ? 0.75 : 1);

export function signContract(G, MW) {
  G.market.contractMW = Math.min(maxContract(G), MW); G.market.exportOn = true;
  news(G, `Ký hợp đồng bán ${fmt(G.market.contractMW)} MW cho nước láng giềng theo giá giao ngay. Cần đường dây tới cửa khẩu.`);
}
export function cancelContract(G) {
  if (!G.market.exportOn) return;
  G.market.exportOn = false; G.reputation = Math.max(0, G.reputation - 5);
  news(G, 'Huỷ hợp đồng xuất khẩu đúng thủ tục. Uy tín quốc tế giảm nhẹ.', 'warn');
}
/** Vũ khí năng lượng: cắt điện đột ngột để ép đối phương; một ngày sau họ nhượng bộ hoặc trả đũa. */
export function energyWeapon(G) {
  if (!G.market.exportOn) return;
  G.market.exportOn = false; G.reputation = Math.max(0, G.reputation - 15);
  G.factions.military = Math.min(100, G.factions.military + 8);
  G.market.pressureAt = G.t + 86400;
  if (G.world) { shiftRelation(G, 'east', -30); shiftRelation(G, 'north', -8); shiftRelation(G, 'south', -8); }
  news(G, 'Cắt điện xuất khẩu không báo trước để gây sức ép ngoại giao! Uy tín quốc tế lao dốc, quân đội hài lòng.', 'warn');
}

// ---------- Sắc lệnh ----------
export const DECREES = [
  { id: 'subsidy', name: 'Trợ giá điện sinh hoạt', desc: 'Giá bán lẻ thực thu −25%. Dân chúng ủng hộ, doanh nghiệp phàn nàn, ngân sách hụt.' },
  { id: 'monopoly', name: 'Độc quyền lưới điện quốc gia', desc: 'Doanh thu +15% nhưng tham nhũng tăng gấp đôi; dân và doanh nghiệp bất mãn dần.' },
  { id: 'defense', name: 'Ngân sách quốc phòng bảo vệ hạ tầng', desc: 'Tốn 0,25 triệu USD/ngày. Quân đội ủng hộ.' },
  { id: 'martial', name: 'Thiết quân luật', desc: 'Chỉ ban hành khi có biểu tình hoặc rò phóng xạ. Dập biểu tình, quân đội ủng hộ, dân và doanh nghiệp giảm dần.' },
];
export function toggleDecree(G, id) {
  const on = !G.decrees[id];
  if (id === 'martial' && on && !(G.protest || anyRelease(G) > 0 || G.world?.war)) {
    news(G, 'Không có căn cứ ban hành thiết quân luật: chưa có biểu tình hay sự cố phóng xạ.', 'warn'); return;
  }
  G.decrees[id] = on;
  const d = DECREES.find((x) => x.id === id);
  news(G, `${on ? 'Ban hành' : 'Bãi bỏ'} sắc lệnh: ${d.name}.`, on && id === 'martial' ? 'warn' : '');
}

// ---------- Phe phái & điều kiện thua ----------
const clamp = (x) => Math.max(0, Math.min(100, x));
export function politicsStep(G, dt, { secFrac, portFrac, profitPerH, exportFrac }) {
  const h = dt / 3600, F = G.factions, D = G.decrees, M = G.market;
  // Doanh nghiệp: lợi nhuận, giá cao, xuất khẩu, điện cho cảng công nghiệp
  let b = (profitPerH > 0 ? 0.6 : -0.8) + (M.exportOn ? 0.4 : 0) + (retailEffective(G) > 70 ? 0.3 : 0)
    - 2.5 * (1 - portFrac) - (D.monopoly ? 0.8 : 0) - (D.subsidy ? 0.4 : 0) - (D.martial ? 1 : 0)
    - (G.corruption > 40 ? 0.4 : 0) - (M.sanctionUntil > G.t ? 0.6 : 0);
  // Quân đội: an ninh năng lượng, quốc phòng, uy tín
  let m = (D.defense ? 1.2 : -0.2) + Math.min(1.2, (G.world?.troops ?? 0) * 0.2) - 0.4 + (D.martial ? 0.6 : 0) - 3 * (1 - secFrac) - (anyRelease(G) > 0 ? 1 : 0) + (G.world?.war ? -0.5 + Math.min(1.5, G.world.troops * 0.3) : 0)
    - (G.reputation < 25 ? 0.3 : 0);
  F.business = clamp(F.business + (b + (50 - F.business) * 0.02) * h);
  F.military = clamp(F.military + (m + (50 - F.military) * 0.02) * h);
  // Dân chúng (Lòng dân): giá điện thực thu so với mức 60 USD/MWh
  G.approval = clamp(G.approval + (-(retailEffective(G) - BASE_RETAIL) * 0.04 - (D.monopoly ? 0.3 : 0) - (D.martial ? 1 : 0)) * h);
  // Uy tín: giao đủ hợp đồng thì tăng, thiếu thì giảm
  if (M.exportOn) G.reputation = clamp(G.reputation + (exportFrac > 0.95 ? 0.3 : -2) * h);
  // Ép ngoại giao có kết quả
  if (M.pressureAt && G.t >= M.pressureAt) {
    M.pressureAt = 0;
    if (Math.random() < 0.5) { G.budget += 4 * G.priceLevel; news(G, 'Nước láng giềng nhượng bộ sau đợt cắt điện: bồi thường 4 triệu USD và mở lại đàm phán.'); }
    else { M.sanctionUntil = G.t + 3 * 86400; news(G, 'Nước láng giềng trả đũa: cấm vận than và hạ giá mua điện 30% trong 3 ngày.', 'bad'); }
  }
  // Cảnh báo & điều kiện thua (giữ đủ 1 ngày)
  const watch = (key, cond, warnText, overText) => {
    if (!cond) { G.danger[key] = 0; return; }
    if (!G.danger[key]) news(G, warnText, 'bad');
    G.danger[key] = (G.danger[key] || 0) + dt;
    if (G.danger[key] > 86400 && !G.over) G.over = overText;
  };
  watch('coup', F.military < 10, 'Quân đội bất mãn cực độ: tin đồn đảo chính lan khắp thủ đô!', 'Đảo chính quân sự. Chính phủ của bạn bị lật đổ vì để an ninh năng lượng sụp đổ.');
  watch('revolution', G.approval < 3, 'Dân chúng xuống đường khắp cả nước, chính phủ lung lay!', 'Cách mạng. Người dân lật đổ chính phủ sau những ngày mất điện, giá cả và phóng xạ.');
  watch('default', G.budget < -20, 'Ngân sách âm nặng: chủ nợ quốc tế ra tối hậu thư!', 'Vỡ nợ quốc gia. Chủ nợ tiếp quản ngành điện.');
}
