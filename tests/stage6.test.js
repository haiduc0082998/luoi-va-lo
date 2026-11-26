import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, buildLine, nodeById } from '../src/game.js';
import { setWeather, windFarmMW } from '../src/weather.js';
import { build, sell, canPlace, exportRE, upgradeMine } from '../src/infra.js';

const runHours = (G, h) => { G.speed = 60; for (let i = 0; i < h * 60 && !G.over; i++) advance(G, 1); };
const calm = (G, id = 'sunny') => { setWeather(G, id); G.weather.until = 1e12; };

test('công suất gió theo lập phương, ngắt khi bão quá mạnh', () => {
  assert.equal(windFarmMW(2), 0);
  assert.ok(Math.abs(windFarmMW(12) - 120) < 1e-9);
  assert.ok(windFarmMW(7.5) < 120 * 0.2);
  assert.equal(windFarmMW(30), 0);
});

test('nắng nóng làm nước làm mát nóng lên: lò giảm công suất điện', () => {
  const A = createGame(); calm(A, 'sunny'); runHours(A, 3);
  const B = createGame(); calm(B, 'heatwave'); runHours(B, 3);
  assert.ok(B.reactor.Pe < A.reactor.Pe * 0.95, `${B.reactor.Pe} vs ${A.reactor.Pe}`);
});

test('tháp làm mát phụ bù lại phần công suất mất do nắng nóng', () => {
  const G = createGame(); calm(G, 'heatwave'); G.budget = 100;
  runHours(G, 2);
  const before = G.reactor.Pe;
  const nuc = nodeById(G, 'nuc');
  assert.ok(build(G, 'tower', nuc.x + 40, nuc.z), 'không đặt được tháp');
  runHours(G, 2);
  assert.ok(G.reactor.Pe > before, `${G.reactor.Pe} vs ${before}`);
});

test('trại gió cần đất hiếm, nối lưới thì phát điện khi trời gió', () => {
  const G = createGame(); calm(G, 'windy'); G.budget = 100;
  const w = build(G, 'wind', 60, 50);
  assert.ok(w, 'không xây được trại gió');
  assert.ok(buildLine(G, w.id, 'capital', 220, 400));
  runHours(G, 1);
  assert.ok(w.gen > 40, `${w.gen}`);
});

test('cảng phải sát bờ sông', () => {
  const G = createGame();
  assert.notEqual(canPlace(G, 'port', 60, 50), '');
  const z = 40, x = -10 + 12 * Math.sin(z * 0.03) + 9;
  assert.equal(canPlace(G, 'port', x, z), '');
});

test('bán trại gió hoàn 70% và gỡ tuyến nối vào', () => {
  const G = createGame(); G.budget = 100;
  const w = build(G, 'wind', 60, 50);
  buildLine(G, w.id, 'capital', 220, 400);
  const b = G.budget, lines = G.net.lines.length;
  assert.ok(sell(G, 'node', w.id));
  assert.ok(Math.abs(G.budget - (b + 0.7 * w.cost)) < 1e-9);
  assert.equal(G.net.lines.length, lines - 1);
  assert.equal(sell(G, 'node', 'nuc'), false);
});

test('mỏ mất điện thì ngừng khai thác; hết uranium thì lò dừng', () => {
  const G = createGame(); calm(G);
  G.net.lines.find((l) => l.a === 'mine').closed = false;
  G.res.U = 0.3;
  runHours(G, 12);
  assert.equal(G.reactor.noFuel, true);
  assert.ok(G.reactor.Pf < 0.05 * 3e9);
});

test('nâng cấp mỏ và xuất khẩu đất hiếm', () => {
  const G = createGame(); G.budget = 50; G.res.RE = 25;
  upgradeMine(G); assert.equal(G.res.mineLv, 2);
  const b = G.budget; exportRE(G);
  assert.ok(G.budget > b && G.res.RE === 15);
});
