import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance } from '../src/game.js';
import { serialize, deserialize } from '../src/save.js';
import { MISSIONS, missionsStep, progress } from '../src/missions.js';
import { research } from '../src/policy.js';

test('lưu rồi tải: giữ nguyên trạng thái, Set công nghệ và getter chiến tranh', () => {
  const G = createGame();
  G.weather.until = 1e12;
  advance(G, 30);
  G.tech.add('boron'); G.budget = 42.5; G.world.countries[0].war = true; G.reactor.rod = 61;
  const H = deserialize(serialize(G));
  assert.equal(H.t, G.t);
  assert.equal(H.budget, 42.5);
  assert.ok(H.tech instanceof Set && H.tech.has('boron'));
  assert.equal(H.world.war, true, 'getter war tính lại từ danh sách nước');
  H.world.countries[0].war = false;
  assert.equal(H.world.war, false);
  assert.equal(H.reactor.rod, 61);
  assert.equal(H.net.lines.length, G.net.lines.length);
  assert.ok(H.listeners instanceof Set, 'listener là của phiên chạy, không lưu');
  advance(H, 30); // ván tải lên vẫn chạy được
  assert.ok(H.t > G.t);
});

test('tải dữ liệu hỏng hoặc khác phiên bản thì báo lỗi', () => {
  assert.throws(() => deserialize('{"v":99,"G":{}}'));
  assert.throws(() => deserialize('không phải json'));
});

test('nhiệm vụ: hoàn thành một lần, phát thưởng, nhiệm vụ "giữ" đếm lại khi trượt', () => {
  const G = createGame();
  const before = G.rp;
  G.rp = 999; for (const id of ['boron', 'recombiner', 'passive']) research(G, id);
  G.rp = before;
  missionsStep(G, 1);
  assert.ok(G.missions.done.includes('tech'));
  assert.equal(G.rp, before + MISSIONS.find((m) => m.id === 'tech').reward.rp);
  missionsStep(G, 1);
  assert.equal(G.missions.done.filter((x) => x === 'tech').length, 1, 'không thưởng hai lần');

  const loved = MISSIONS.find((m) => m.id === 'loved');
  G.approval = 80; missionsStep(G, 10 * 3600);
  assert.ok(progress(G, loved) > 0.4 && progress(G, loved) < 0.5);
  G.approval = 50; missionsStep(G, 60);
  assert.equal(progress(G, loved), 0, 'trượt điều kiện thì đếm lại');
});
