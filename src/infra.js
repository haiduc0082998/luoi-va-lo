// Giai đoạn 6: xây dựng hạ tầng (năng lượng, đô thị, giao thông), tài nguyên uranium/đất hiếm, mỏ, bán công trình.
import { createNode } from './physics/network.js';
import { buildable, inRiver, riverCenter, height, MAP_HALF, WATER_Y, inSea, nearSea } from './map.js';
import { news } from './news.js';
import { fmt } from './util.js';

export const BUILDS = {
  sub: { name: 'Trạm biến áp', cost: 2, desc: 'Nút chia tải để nối đường dây.' },
  wind: { name: 'Trại điện gió 120 MW', cost: 6, re: 10, desc: 'Công suất theo lập phương tốc độ gió; ngắt khi gió trên 25 m/s. Tốn 10 tấn đất hiếm.' },
  solar: { name: 'Trại điện mặt trời 100 MW', cost: 5, re: 4, desc: 'Phát theo góc mặt trời: đỉnh buổi trưa, 0 về đêm; mây làm giảm tới 75 %. Tốn 4 tấn đất hiếm.' },
  battery: { name: 'Trạm pin lưu trữ 200 MW / 400 MWh', cost: 8, re: 12, desc: 'Sạc bằng điện rẻ còn dư (mặt trời, gió, hạt nhân), xả trước nhiệt điện than: trưa sạc, tối cao điểm xả. Giữ tần số khi mất nguồn đột ngột.' },
  tower: { name: 'Tháp làm mát phụ', cost: 4, desc: 'Hạ 3 °C nước làm mát (tối đa 3 tháp). Đặt trong bán kính 45 quanh nhà máy hạt nhân.' },
  city: { name: 'Khu đô thị mới', cost: 5, desc: '+200 MW nhu cầu, thêm doanh thu bán điện. Cần kéo dây tới.' },
  road: { name: 'Cao tốc', cost: 4, desc: 'Xe tải chở quặng: +25% sản lượng mỏ (tối đa 2 tuyến).' },
  port: { name: 'Cảng sông', cost: 7, desc: 'Xuất đất hiếm giá +30%, phí cảng 0,3 triệu USD/ngày. Phải xây sát bờ sông.' },
  airport: { name: 'Sân bay quốc tế', cost: 10, desc: 'Gacha kỹ sư −30%, nghiên cứu +15%, du lịch 0,25 triệu USD/ngày. Cần đất bằng.' },
};
export const GRID_TYPES = ['sub', 'wind', 'solar', 'battery', 'city'];
export const MINE_LEVELS = [
  { name: 'Cấp 1: Mỏ lộ thiên', cost: 0, U: 1.5, RE: 0.6, desc: '1,5 tấn uranium và 0,6 tấn đất hiếm mỗi ngày.' },
  { name: 'Cấp 2: Nhà máy làm giàu uranium', cost: 6, U: 4, RE: 0.6, desc: 'Uranium 4 tấn/ngày; lò tiêu hao ít hơn 20%.' },
  { name: 'Cấp 3: Tổ hợp đất hiếm tự động', cost: 9, U: 4, RE: 3, desc: 'Đất hiếm 3 tấn/ngày để làm trại gió và xuất khẩu.' },
];
export const RE_LOT = 10, RE_PRICE = 1.5;
let seq = 1;
const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export const createResources = () => ({ U: 20, RE: 15, mineLv: 1 });
export const count = (G, type) => G.infra.filter((s) => s.type === type).length + G.net.nodes.filter((n) => n.type === type && n.built).length;
export const buildCost = (G, type) => BUILDS[type].cost * G.priceLevel * (1 + G.corruption / 100);

/** Lý do không đặt được (chuỗi rỗng nếu được). */
export function canPlace(G, type, x, z) {
  const near = (px, pz, r) => Math.hypot(px - x, pz - z) < r;
  if (Math.abs(x) > MAP_HALF - 12 || Math.abs(z) > MAP_HALF - 12) return 'Ngoài bản đồ';
  if (G.infra.some((s) => near(s.x, s.z, type === 'airport' || s.type === 'airport' ? 26 : 12))) return 'Quá gần công trình khác';
  if (type === 'port') {
    const d = Math.abs(x - riverCenter(z)), sea = !inSea(x, z) && height(x, z) > WATER_Y && nearSea(x, z, 10);
    if (!sea && (d < 6 || d > 12)) return 'Cảng phải nằm sát bờ sông hoặc bờ biển';
    if (G.net.nodes.some((n) => near(n.x, n.z, 10))) return 'Quá gần công trình khác';
    return '';
  }
  if (type === 'tower') {
    const nuc = G.net.nodes.find((n) => n.id === 'nuc');
    if (!near(nuc.x, nuc.z, 45)) return 'Phải đặt gần nhà máy hạt nhân (bán kính 45)';
    if (count(G, 'tower') >= 3) return 'Đã đủ 3 tháp phụ';
  }
  if (type === 'road' && count(G, 'road') >= 2) return 'Đã đủ 2 tuyến cao tốc';
  if (type === 'airport') {
    if (inRiver(x, z) || [-22, -11, 0, 11, 22].some((dx) => inRiver(x + dx, z))) return 'Đường băng không được cắt qua sông';
    const hs = [-22, -11, 0, 11, 22].flatMap((dx) => [-4, 4].map((dz) => height(x + dx, z + dz)));
    if (Math.max(...hs) - Math.min(...hs) > 5) return 'Địa hình không đủ bằng cho đường băng';
  }
  // Trại gió ngoài khơi: đặt được trên thềm biển nông (sâu tới ~10 đơn vị), gió biển mạnh và đều hơn
  if (type === 'wind' && inSea(x, z)) return height(x, z) > -11 ? (G.net.nodes.some((n) => near(n.x, n.z, 14)) ? 'Quá gần công trình khác' : '') : 'Biển quá sâu cho móng trại gió';
  const why = buildable(x, z, G.net.nodes);
  if (why && !(type === 'wind' && why.startsWith('Địa hình') && height(x, z) < 15)) return why;
  if (type === 'road' && G.net.nodes.some((n) => near(n.x, n.z, 14))) return 'Quá gần công trình khác';
  return '';
}

export function build(G, type, x, z) {
  const B = BUILDS[type], why = canPlace(G, type, x, z);
  if (why) { news(G, `Không xây được ${lc(B.name)}: ${why}.`, 'warn'); return null; }
  const cost = buildCost(G, type);
  if (G.budget < cost) { news(G, `Không đủ ngân sách cho ${lc(B.name)} (cần ${fmt(cost, 1)} triệu USD).`, 'warn'); return null; }
  if (B.re && G.res.RE < B.re) { news(G, `Cần ${B.re} tấn đất hiếm để xây ${lc(B.name)} (đang có ${fmt(G.res.RE, 1)}).`, 'warn'); return null; }
  G.budget -= cost; if (B.re) G.res.RE -= B.re;
  let made;
  if (GRID_TYPES.includes(type)) {
    const k = count(G, type) + 1;
    const name = type === 'sub' ? `Trạm ${String.fromCharCode(64 + ((G.subCount++ % 26) + 1))}` : type === 'wind' ? `Trại gió số ${k}` : type === 'solar' ? `Điện mặt trời số ${k}` : type === 'battery' ? `Trạm pin số ${k}` : `Khu đô thị mới ${k}`;
    made = createNode({ name, type, x, z, built: true, sellable: true, cost, ...(type === 'city' ? { demandBase: 200 } : {}), ...(type === 'wind' && inSea(x, z) ? { offshore: true, name: `Gió ngoài khơi số ${k}` } : {}) });
    G.net.nodes.push(made);
  } else {
    const nuc = G.net.nodes.find((n) => n.id === 'nuc');
    const city = G.net.nodes.filter((n) => n.type === 'city').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const seaDir = type === 'port' && Math.abs(x - riverCenter(z)) > 12 ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => k * Math.PI / 4).find((a) => inSea(x + 10 * Math.cos(a), z + 10 * Math.sin(a))) : undefined;
    const yaw = type === 'road' ? Math.atan2(city.x - x, city.z - z) : seaDir !== undefined ? Math.atan2(Math.cos(seaDir), Math.sin(seaDir)) + Math.PI / 2 : type === 'port' ? Math.atan2(1, 12 * 0.03 * Math.cos(z * 0.03)) : 0;
    made = { id: `s${seq++}`, type, x, z, yaw, cost, name: `${B.name} ${count(G, type) + 1}`, near: type === 'tower' ? nuc.id : null };
    G.infra.push(made);
  }
  G.version++;
  news(G, `Đã xây ${made.name} (−${fmt(cost, 1)} triệu USD${B.re ? `, −${B.re} tấn đất hiếm` : ''}).${['wind', 'solar', 'battery', 'city'].includes(type) ? ' Hãy kéo dây nối vào lưới.' : ''}`);
  return made;
}

/** Bán công trình tự xây: hoàn 70% chi phí; trạm/trại gió/đô thị bị gỡ cùng các tuyến nối vào. */
export function sell(G, kind, id) {
  if (kind === 'infra') {
    const s = G.infra.find((x) => x.id === id);
    if (!s) return false;
    G.infra = G.infra.filter((x) => x !== s);
    G.budget += 0.7 * s.cost; G.version++;
    news(G, `Đã bán ${s.name}, thu hồi ${fmt(0.7 * s.cost, 1)} triệu USD.`);
    return true;
  }
  const n = G.net.nodes.find((x) => x.id === id);
  if (!n || !n.sellable) { news(G, `Không thể bán ${n ? n.name : 'công trình này'}: hạ tầng cốt lõi của quốc gia.`, 'warn'); return false; }
  G.net.nodes = G.net.nodes.filter((x) => x !== n);
  G.net.lines = G.net.lines.filter((l) => l.a !== id && l.b !== id);
  G.world.guards = G.world.guards.filter((g) => g !== id);
  G.budget += 0.7 * n.cost; G.version++;
  news(G, `Đã bán ${n.name}, thu hồi ${fmt(0.7 * n.cost, 1)} triệu USD. Các tuyến nối vào đã được tháo.`);
  return true;
}

export function upgradeMine(G) {
  const next = MINE_LEVELS[G.res.mineLv];
  if (!next) return;
  const cost = next.cost * G.priceLevel;
  if (G.budget < cost) { news(G, 'Không đủ ngân sách nâng cấp mỏ.', 'warn'); return; }
  G.budget -= cost; G.res.mineLv++;
  news(G, `Nâng cấp mỏ: ${next.name}. ${next.desc}`);
}
export function exportRE(G) {
  if (G.res.RE < RE_LOT) { news(G, `Cần ít nhất ${RE_LOT} tấn đất hiếm để xuất một lô.`, 'warn'); return; }
  const gain = RE_PRICE * (count(G, 'port') ? 1.3 : 1) * G.priceLevel;
  G.res.RE -= RE_LOT; G.budget += gain;
  news(G, `Xuất khẩu ${RE_LOT} tấn đất hiếm: +${fmt(gain, 2)} triệu USD${count(G, 'port') ? ' (có cảng sông)' : ''}.`);
}

/** Cân bằng uranium (tấn/ngày): sản lượng mỏ hiện tại, lượng lò đang đốt (tỉ lệ công suất nhiệt), số ngày còn đủ. */
export function fuelBalance(G, units) {
  const R = G.res, L = MINE_LEVELS[R.mineLv - 1], mine = G.net.nodes.find((n) => n.id === 'mine');
  const made = L.U * (mine && mine.state === 'ok' ? mine.frac : 0) * (1 + 0.25 * count(G, 'road'));
  const burn = units.reduce((s, u) => s + (u.Pf / 3e9) * (u.noFuel ? 0 : 1), 0) * (R.mineLv >= 2 ? 0.8 : 1);
  const net = made - burn;
  return { made, burn, net, days: net < 0 ? R.U / -net : Infinity };
}

/** Một bước: khai thác, đốt nhiên liệu, thu phí cảng / du lịch. Trả về số tháp làm mát phụ. */
export function infraStep(G, dt, units) {
  const day = dt / 86400, R = G.res, L = MINE_LEVELS[R.mineLv - 1];
  const mine = G.net.nodes.find((n) => n.id === 'mine');
  const powered = mine && mine.state === 'ok' ? mine.frac : 0;
  const road = 1 + 0.25 * count(G, 'road');
  R.U += L.U * powered * road * day;
  R.RE += L.RE * powered * road * day;
  const burn = units.reduce((s, u) => s + (u.Pf / 3e9) * (u.noFuel ? 0 : 1), 0) * (R.mineLv >= 2 ? 0.8 : 1) * day;
  R.U = Math.max(0, R.U - burn);
  for (const u of units) {
    if (R.U <= 0 && !u.noFuel) { u.noFuel = true; u.scram = true; news(G, 'Hết uranium! Lò không còn nhiên liệu, phải dừng. Nâng cấp mỏ hoặc cấp điện cho mỏ.', 'bad'); }
    if (R.U > 2 && u.noFuel) { u.noFuel = false; news(G, 'Đã nạp nhiên liệu mới, lò có thể khởi động lại.'); }
  }
  G.budget += (0.3 * count(G, 'port') + 0.25 * count(G, 'airport')) * G.priceLevel * day;
}
