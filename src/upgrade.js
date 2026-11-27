// Nâng cấp công trình: tốn tiền, có xác suất thành công. Thành công: công trình mạnh hơn
// (nhà máy nhiều công suất hơn, trạm chịu tải lớn hơn, thành phố đông dân và cao tầng hơn).
// Thất bại: tiền đã chi mất trắng (nhà thầu ăn bớt, lỗi thi công); nâng cấp lò hạt nhân hỏng thì lò SCRAM.
// Xác suất thành công giảm theo cấp và tham nhũng, tăng nhờ kỹ sư giỏi và đủ nhân công.
import { news } from './news.js';
import { fmt, clamp } from './util.js';
import { staffRatio } from './workforce.js';

export const UPGRADES = {
  nuclear: { max: 4, cost: 18, what: (lv) => `Tua-bin và bộ sinh hơi mới: hiệu suất ${33 + 2 * (lv - 1)}% → ${33 + 2 * lv}%` },
  coal: { max: 4, cost: 6, what: (lv) => `Lò hơi siêu tới hạn: công suất tối đa +20% (cấp ${lv + 1}: ×${fmt(1 + 0.2 * lv, 1)})` },
  hydro: { max: 4, cost: 5, what: (lv) => `Thêm tổ máy thuỷ lực: công suất +15% (×${fmt(1 + 0.15 * lv, 2)})` },
  wind: { max: 3, cost: 2, what: (lv) => `Cánh quạt dài hơn: công suất +25% (×${fmt(1 + 0.25 * lv, 2)})` },
  sub: { max: 4, cost: 2.5, what: (lv) => `Máy biến áp lớn hơn: ${fmt(800 * (1 + 0.4 * (lv - 1)))} → ${fmt(800 * (1 + 0.4 * lv))} MVA` },
  city: { max: 5, cost: 8, what: () => 'Quy hoạch mở rộng: dân số và nhu cầu điện +25%, nhà cao tầng hơn, thu thuế nhiều hơn' },
};

export const level = (n) => n.lv ?? 1;
export const canUpgrade = (n) => !!UPGRADES[n.type] && level(n) < UPGRADES[n.type].max;
export const upgradeCost = (G, n) => UPGRADES[n.type].cost * level(n) * G.priceLevel * (1 + G.corruption / 100);

export function upgradeChance(G, n) {
  const eng = G.engineer?.tier === 'legend' ? 0.07 : G.engineer?.tier === 'rare' ? 0.03 : G.engineer?.tier === 'fake' ? -0.08 : 0;
  return clamp(0.93 - 0.09 * (level(n) - 1) - G.corruption * 0.004 + eng + (staffRatio(G) - 1) * 0.4, 0.2, 0.97);
}

/** Hệ số công suất / định mức theo cấp. */
const STEP = { coal: 0.2, hydro: 0.15, wind: 0.25 };
export const capMul = (n) => 1 + (STEP[n.type] ?? 0) * (level(n) - 1);
export const subRated = (n) => 800 * (1 + 0.4 * (level(n) - 1));

export function upgrade(G, n, rnd = Math.random) {
  if (!canUpgrade(n)) return null;
  if (n.state && n.state !== 'ok') { news(G, `${n.name} đang hỏng, cần sửa trước khi nâng cấp.`, 'warn'); return null; }
  const cost = upgradeCost(G, n), p = upgradeChance(G, n);
  if (cost > G.budget) { news(G, `Không đủ ngân sách nâng cấp ${n.name} (cần ${fmt(cost, 1)} triệu USD).`, 'warn'); return null; }
  G.budget -= cost;
  if (rnd() < p) {
    n.lv = level(n) + 1;
    if (n.type === 'city') { n.demandBase *= 1.25; G.cityVersion = (G.cityVersion || 0) + 1; }
    G.version++;
    news(G, `Nâng cấp ${n.name} lên cấp ${n.lv} thành công (−${fmt(cost, 1)} triệu USD).`, 'good');
    return true;
  }
  const why = G.corruption > 30 && rnd() < 0.6 ? 'nhà thầu rút ruột công trình' : 'lỗi thi công, phải tháo dỡ làm lại';
  news(G, `Nâng cấp ${n.name} thất bại: ${why}. Mất ${fmt(cost, 1)} triệu USD.`, 'bad');
  G.approval = Math.max(0, G.approval - 1.5);
  if (n.type === 'nuclear') for (const R of [G.reactor, G.reactor2]) if (R && !R.scram) { R.scram = true; news(G, 'Sự cố khi đấu nối thiết bị mới: lò SCRAM. Dùng nút “Khởi động lại lò”.', 'warn'); }
  return false;
}
