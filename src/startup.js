// Nút "Khởi động lại lò": chạy quy trình khởi động như ca trực thật, từng bước một, trên mô hình vật lý.
//  1. Đóng máy cắt tự dùng CB1–CB3, chạy lại 4 bơm (cần có điện lưới hoặc diesel).
//  2. Chờ lõi nguội và áp suất về bình thường (T < 330 °C, p < 16 MPa, lưu lượng > 90 %), rồi giải trừ SCRAM.
//  3. Rút thanh điều khiển chậm 0,4 %/s tới vị trí cân bằng ở công suất mục tiêu (100 % định mức),
//     tránh bước nhảy độ phản ứng. Lò tự SCRAM lại thì quy trình dừng và báo lý do.
// Lò đã vỡ ống (LOCA), nóng chảy hoặc nổ thì không khởi động được: phải "sửa chữa / thay lõi" (tốn tiền và thời gian).
import { news } from './news.js';
import { fmt } from './util.js';
import { RATED, createReactor, pumpsPowered } from './physics/reactor.js';
import { rodForPower } from './engineers.js';

export const REPAIR = { loca: { cost: 12, hours: 18, what: 'thay đoạn ống sơ cấp, nạp lại nước làm mát' }, core: { cost: 60, hours: 72, what: 'dọn dẹp, tẩy xạ và thay toàn bộ lõi lò' } };

const unitOf = (G, k) => (k === 2 ? G.reactor2 : G.reactor);
const label = (G, k) => (G.reactor2 ? `Tổ máy ${k}: ` : '');

/** Trạng thái để hiện nút: 'running' | 'startup' | 'ready' | 'nofuel' | 'repair-loca' | 'repair-core' | 'repairing'. */
export function restartState(G, k = 1) {
  const R = unitOf(G, k);
  if (!R) return null;
  if (G.repair?.[k]) return 'repairing';
  if (R.melt || R.boom) return 'repair-core';
  if (R.loca) return 'repair-loca';
  if (R.startup) return 'startup';
  if (R.noFuel) return 'nofuel';
  if (!R.scram && R.rod > 45) return 'running';
  return 'ready';
}

export function beginStartup(G, k = 1) {
  const R = unitOf(G, k), st = restartState(G, k);
  if (st === 'ready' || st === 'running') {
    R.startup = { phase: 'aux', t: 0 };
    news(G, `${label(G, k)}Bắt đầu quy trình khởi động lò: đóng máy cắt, chạy bơm, chờ lõi đủ điều kiện rồi rút thanh từ từ.`);
    return true;
  }
  if (st === 'nofuel') { news(G, `${label(G, k)}Hết nhiên liệu uranium: cần khai thác hoặc mua thêm trước khi khởi động.`, 'warn'); return false; }
  if (st === 'repair-loca' || st === 'repair-core') return beginRepair(G, k, st === 'repair-loca' ? 'loca' : 'core');
  return false;
}

export function beginRepair(G, k, kind) {
  const r = REPAIR[kind], cost = r.cost * G.priceLevel * (1 + G.corruption / 100);
  if (cost > G.budget) { news(G, `Không đủ ngân sách để ${r.what} (cần ${fmt(cost, 1)} triệu USD).`, 'warn'); return false; }
  G.budget -= cost;
  (G.repair ||= {})[k] = { kind, left: r.hours * 3600 };
  news(G, `${label(G, k)}Bắt đầu ${r.what} (−${fmt(cost, 1)} triệu USD, khoảng ${r.hours} giờ).`);
  return true;
}

/** Gọi mỗi bước mô phỏng, sau stepReactor. */
export function startupStep(G, dt, staffK = 1) {
  for (const k of [1, 2]) {
    const job = G.repair?.[k];
    if (job) {
      job.left -= dt * staffK;
      if (job.left <= 0) {
        const old = unitOf(G, k), R = createReactor({ wind: old.wind, rbmk: old.rbmk }); // giữ loại lò (RBMK vẫn là RBMK), bảo vệ RPS bật lại
        R.scram = true; R.rod = R.rodCmd = 0; R.T = 300; R.Pf = 0; R.D1 = R.D2 = 0; // lõi mới nạp, đang dừng
        if (k === 2) G.reactor2 = R; else G.reactor = R;
        delete G.repair[k]; G.version++;
        news(G, `${label(G, k)}Sửa chữa xong, lò ở trạng thái dừng an toàn. Bấm “Khởi động lại lò” để đưa lên công suất.`, 'good');
      }
    }
    const R = unitOf(G, k);
    if (!R?.startup) continue;
    const S = R.startup;
    S.t += dt;
    if (R.loca || R.melt || R.boom || R.noFuel) { R.startup = null; news(G, `${label(G, k)}Dừng quy trình khởi động: lò hư hỏng hoặc hết nhiên liệu.`, 'bad'); continue; }
    if (S.phase === 'aux') {
      R.cb = { cb1: true, cb2: true, cb3: true };
      if (pumpsPowered(R)) { R.pumps = [1, 1, 1, 1]; S.phase = 'wait'; S.t = 0; }
      else if (S.t > 600) { R.startup = null; news(G, `${label(G, k)}Không có điện cho bơm (mất lưới, diesel hỏng). Hãy khôi phục đường dây tới nhà máy.`, 'warn'); }
    } else if (S.phase === 'wait') {
      if (!R.scram) { S.phase = 'raise'; continue; }
      if (R.flow > 0.9 && R.T < 330 && R.p < 16) { R.scram = false; R.rodCmd = R.rod; S.phase = 'raise'; S.t = 0; news(G, `${label(G, k)}Đủ điều kiện: giải trừ SCRAM, bắt đầu rút thanh.`); }
    } else if (S.phase === 'raise') {
      if (R.scram) { R.startup = null; news(G, `${label(G, k)}Lò SCRAM lại trong lúc nâng công suất (nhiệt độ ${fmt(R.T)} °C). Kiểm tra bơm và lưới rồi thử lại.`, 'warn'); continue; }
      const goal = Math.min(100, rodForPower(R, RATED));
      R.rodCmd = Math.min(goal, R.rodCmd + 0.4 * dt);
      if (R.rodCmd >= goal - 0.05 && Math.abs(R.Pf - RATED) < 0.05 * RATED) {
        R.startup = null; news(G, `${label(G, k)}Lò đã lên công suất định mức, hoà lưới ổn định.`, 'good');
      } else if (S.t > 4 * 3600) { R.startup = null; news(G, `${label(G, k)}Lò đã chạy, đang ở ${fmt((R.Pf / RATED) * 100)}% công suất.`); }
    }
  }
}
