import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, buildSubstation, buildLine, nodeById, SCENARIOS } from '../src/game.js';

const runHours = (G, h) => { G.speed = 60; for (let i = 0; i < h * 60; i++) advance(G, 1); };

test('một ngày vận hành bình thường: không sự cố, lưới đủ điện, có lãi', () => {
  const G = createGame();
  G.weather.until = 1e12; // giữ trời nắng đẹp để kết quả ổn định
  const b0 = G.budget;
  runHours(G, 24);
  const bad = G.news.filter((n) => n.level === 'bad');
  assert.deepEqual(bad.map((n) => n.text), []);
  assert.ok(G.net.summary.served / G.net.summary.demand > 0.999);
  assert.ok(Math.abs(G.net.summary.hz - 50) < 0.3);
  assert.ok(G.budget > b0, `${G.budget}`);
});

test('xây trạm và kéo dây mới làm tăng số nút và tuyến', () => {
  const G = createGame();
  const s = buildSubstation(G, 20, 50);
  assert.ok(s);
  assert.ok(buildLine(G, s.id, 'capital', 220, 400));
  assert.ok(buildLine(G, s.id, 'subW', 220, 400));
  assert.equal(G.net.nodes.length, 12); // 11 công trình ban đầu (gồm Nam Bình, Tây Hải) + trạm mới
  runHours(G, 2);
  assert.ok(G.net.lines.at(-1).P !== 0);
});

test('không cho xây trạm trên sông', () => {
  const G = createGame();
  assert.equal(buildSubstation(G, -10, 0), null);
});

test('sóng thần: nhà máy mất lưới ngoài, SCRAM, lưới thiếu điện', () => {
  const G = createGame();
  SCENARIOS.find((s) => s[0].startsWith('Sóng thần'))[1](G);
  runHours(G, 1);
  assert.equal(G.reactor.scram, true);
  assert.equal(nodeById(G, 'nuc').gen, 0);
});
