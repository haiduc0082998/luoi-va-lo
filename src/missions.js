// Nhiệm vụ: mục tiêu dài hạn có phần thưởng, dẫn người chơi qua các hệ thống của game.
// Loại "giữ" (hold) cần điều kiện đúng liên tục trong một khoảng thời gian game; điều kiện
// sai thì đồng hồ đếm lại từ đầu. Loại thường hoàn thành ngay khi điều kiện đúng.
import { news } from './news.js';
import { fmt } from './util.js';

const H = 3600;
const cities = (G) => G.net.nodes.filter((n) => n.type === 'city');
const count = (G, type) => G.net.nodes.filter((n) => n.type === type).length;

export const MISSIONS = [
  { id: 'stable', name: 'Lưới điện ổn định', desc: 'Giữ tần số lưới trong 50 ± 0,2 Hz suốt 24 giờ, qua cả giờ cao điểm tối.', hold: 24 * H,
    ok: (G) => Math.abs((G.net.summary?.hz ?? 0) - 50) <= 0.2 + 1e-9, reward: { budget: 4 } },
  { id: 'lights', name: 'Không ai thiếu điện', desc: 'Mọi thành phố được cấp đủ điện suốt 24 giờ.', hold: 24 * H,
    ok: (G) => cities(G).every((n) => n.frac >= 0.99), reward: { budget: 6, approval: 4 } },
  { id: 'wind', name: 'Điện gió', desc: 'Xây 3 trang trại gió.', ok: (G) => count(G, 'wind') >= 3, progress: (G) => count(G, 'wind') / 3, reward: { budget: 5, rp: 20 } },
  { id: 'storage', name: 'Nắng trưa, đèn tối', desc: 'Xây 2 trại điện mặt trời và 1 trạm pin lưu trữ nối vào lưới.',
    ok: (G) => count(G, 'solar') >= 2 && G.net.nodes.some((n) => n.type === 'battery' && G.net.lines.some((l) => l.a === n.id || l.b === n.id)),
    progress: (G) => (Math.min(2, count(G, 'solar')) + Math.min(1, count(G, 'battery'))) / 3, reward: { budget: 6, rp: 20 } },
  { id: 'tech', name: 'Nhà nước kỹ trị', desc: 'Nghiên cứu xong 3 công nghệ.', ok: (G) => G.tech.size >= 3, progress: (G) => G.tech.size / 3, reward: { rp: 40 } },
  { id: 'export', name: 'Bán điện ra nước ngoài', desc: 'Giao ít nhất 200 MW qua cửa khẩu suốt 12 giờ.', hold: 12 * H,
    ok: (G) => G.market.exportOn && (G.net.nodes.find((n) => n.type === 'border')?.served ?? 0) >= 199, reward: { budget: 8 } },
  { id: 'metro', name: 'Tàu điện ngầm đầu tiên', desc: 'Vào một thành phố và vẽ một tuyến metro.', ok: (G) => Object.values(G.cities).some((C) => C.lines.length > 0), reward: { approval: 5 } },
  { id: 'happy', name: 'Thành phố hạnh phúc', desc: 'Đưa chỉ số hạnh phúc đô thị lên 70%.', ok: (G) => G.happiness >= 70, progress: (G) => G.happiness / 70, reward: { approval: 6, budget: 4 } },
  { id: 'mine', name: 'Tự chủ nhiên liệu', desc: 'Nâng mỏ uranium lên cấp 3.', ok: (G) => G.res.mineLv >= 3, progress: (G) => (G.res.mineLv - 1) / 2, reward: { budget: 6 } },
  { id: 'unit2', name: 'Tổ máy số 2', desc: 'Hoàn thành và hoà lưới tổ máy hạt nhân số 2.', ok: (G) => !!G.reactor2, reward: { approval: 5, rp: 30 } },
  { id: 'loved', name: 'Được lòng dân', desc: 'Giữ lòng dân từ 75% trở lên suốt 24 giờ.', hold: 24 * H, ok: (G) => G.approval >= 75, reward: { budget: 10 } },
  { id: 'peace', name: 'Láng giềng hữu hảo', desc: 'Quan hệ với cả ba nước láng giềng từ 60 trở lên.', ok: (G) => G.world.countries.every((c) => c.relation >= 60 && !c.war),
    progress: (G) => Math.min(...G.world.countries.map((c) => c.relation)) / 60, reward: { budget: 6, approval: 3 } },
  { id: 'rich', name: 'Quỹ dự trữ quốc gia', desc: 'Tích luỹ ngân sách 150 triệu USD.', ok: (G) => G.budget >= 150, progress: (G) => G.budget / 150, reward: { approval: 4, rp: 30 } },
];

export function rewardText(r) {
  return [r.budget && `+${fmt(r.budget)} triệu USD`, r.rp && `+${fmt(r.rp)} điểm nghiên cứu`, r.approval && `+${fmt(r.approval)}% lòng dân`].filter(Boolean).join(', ');
}

export function missionState(G) {
  G.missions ||= { done: [], held: {} };
  return G.missions;
}

/** Tiến độ 0..1 của một nhiệm vụ (để vẽ thanh). */
export function progress(G, m) {
  const S = missionState(G);
  if (S.done.includes(m.id)) return 1;
  if (m.hold) return Math.min(1, (S.held[m.id] ?? 0) / m.hold);
  return Math.max(0, Math.min(0.99, m.progress ? m.progress(G) : m.ok(G) ? 1 : 0));
}

/** Gọi sau mỗi lần tiến thời gian, dt là số giây game. */
export function missionsStep(G, dt) {
  const S = missionState(G);
  for (const m of MISSIONS) {
    if (S.done.includes(m.id)) continue;
    let ok = m.ok(G);
    if (m.hold) { S.held[m.id] = ok ? (S.held[m.id] ?? 0) + dt : 0; ok = S.held[m.id] >= m.hold; }
    if (!ok) continue;
    S.done.push(m.id);
    const r = m.reward;
    G.budget += r.budget ?? 0; G.rp += r.rp ?? 0; G.approval = Math.min(100, G.approval + (r.approval ?? 0));
    news(G, `Hoàn thành nhiệm vụ “${m.name}”: ${rewardText(r)}.`, 'good');
  }
}
