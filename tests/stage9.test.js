import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance } from '../src/game.js';
import { needed, staffRatio, crewFactor, hire, hireToNeed, dismiss, laborPool } from '../src/workforce.js';
import { upgrade, upgradeChance, capMul, level } from '../src/upgrade.js';
import { beginStartup, restartState, startupStep } from '../src/startup.js';
import { threatStep, campaign, createCity, evaluate } from '../src/city.js';
import { buildable } from '../src/map.js';
import { serialize, deserialize } from '../src/save.js';
import { advice } from '../src/tips.js';
import { RATED } from '../src/physics/reactor.js';

const game = () => { const G = createGame(); G.weather.until = 1e12; return G; };

test('nhân công: thiếu người thì nhà máy giảm công suất, thuê đủ thì 100 %', () => {
  const G = game();
  assert.ok(needed(G) > 0 && laborPool(G) > needed(G));
  G.staff.hired = Math.round(needed(G) / 2);
  assert.ok(staffRatio(G) < 0.55 && crewFactor(G) < 0.7);
  G.budget = 50;
  hireToNeed(G);
  assert.equal(staffRatio(G), 1);
  const before = G.staff.hired; dismiss(G, 100); assert.equal(G.staff.hired, before - 100);
  assert.equal(hire(G, 1e9) <= laborPool(G), true, 'không thuê quá lực lượng lao động');
});

test('nâng cấp: thành công tăng cấp và công suất, thất bại mất tiền', () => {
  const G = game(); G.budget = 500;
  const coal = G.net.nodes.find((n) => n.id === 'coal');
  assert.ok(upgradeChance(G, coal) > 0.8);
  assert.equal(upgrade(G, coal, () => 0), true);
  assert.equal(level(coal), 2); assert.ok(Math.abs(capMul(coal) - 1.2) < 1e-9);
  const b = G.budget;
  assert.equal(upgrade(G, coal, () => 0.999), false);
  assert.equal(level(coal), 2); assert.ok(G.budget < b);
  const city = G.net.nodes.find((n) => n.id === 'capital'), d = city.demandBase;
  upgrade(G, city, () => 0); assert.ok(city.demandBase > d * 1.2, 'thành phố to hơn');
  G.corruption = 70; assert.ok(upgradeChance(G, coal) < 0.7, 'tham nhũng làm dễ thất bại');
});

test('nút khởi động lại: lò SCRAM lên lại công suất định mức theo quy trình', () => {
  const G = game();
  G.reactor.scram = true;
  advance(G, 60);
  assert.equal(restartState(G), 'ready');
  assert.ok(beginStartup(G));
  for (let i = 0; i < 8 && G.reactor.startup; i++) advance(G, 30);
  assert.equal(G.reactor.scram, false);
  assert.ok(Math.abs(G.reactor.Pf - RATED) < 0.1 * RATED, `công suất ${G.reactor.Pf / RATED}`);
});

test('lò hư hỏng phải sửa chữa rồi mới khởi động được', () => {
  const G = game(); G.budget = 200;
  G.reactor.loca = true; G.reactor.scram = true;
  assert.equal(restartState(G), 'repair-loca');
  assert.ok(beginStartup(G));
  assert.equal(restartState(G), 'repairing');
  startupStep(G, 30 * 3600);
  assert.equal(restartState(G), 'ready');
  assert.equal(G.reactor.loca, false);
});

test('mối nguy đô thị: thiếu cảnh sát thì ma tuý tăng, chiến dịch làm giảm', () => {
  const G = game();
  const n = G.net.nodes.find((x) => x.id === 'port'), C = createCity(n);
  for (const l of C.lots) if (l.type === 'police' || l.type === 'hospital') l.type = 'empty';
  evaluate(C, 1, n.demandBase); G.cities.port = C;
  const d0 = C.threat.drugs;
  threatStep(G, C, n, 3, () => 1);
  assert.ok(C.threat.drugs > d0);
  G.budget = 50; campaign(G, 'drugs');
  assert.ok(C.threat.drugs < d0 + 1);
});

test('khủng bố đánh vào trạm có lính gác thì bị chặn', () => {
  const G = game();
  const n = G.net.nodes.find((x) => x.id === 'capital'), C = createCity(n);
  evaluate(C, 1, n.demandBase); G.cities.capital = C;
  C.threat.terror = 100;
  G.world.guards = G.net.nodes.map((x) => x.id);
  threatStep(G, C, n, 1, () => 0);
  assert.ok(G.net.nodes.every((x) => x.state === 'ok'));
  assert.ok(C.threat.terror < 100);
});

test('bản đồ rộng: vùng nam và tây xây được, bên kia biên giới thì không', () => {
  assert.equal(buildable(20, 165, []), '');
  assert.equal(buildable(150, 0, []), 'Lãnh thổ nước láng giềng');
});

test('lưu/tải giữ cấp nâng cấp, nhân công, mối nguy; cố vấn đưa lời khuyên khi lò dừng', () => {
  const G = game(); advance(G, 120);
  G.net.nodes.find((n) => n.id === 'coal').lv = 3; G.staff.hired = 777;
  const H = deserialize(serialize(G));
  assert.equal(H.net.nodes.find((n) => n.id === 'coal').lv, 3);
  assert.equal(H.staff.hired, 777);
  assert.ok(Object.values(H.cities).every((C) => C.threat && C.threat.drugs >= 0));
  H.reactor.scram = true;
  assert.ok(advice(H).some((a) => a.label?.startsWith('Khởi động lại lò')));
});
