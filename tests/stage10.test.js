import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, slowTick } from '../src/game.js';
import { randomWeather, WEATHERS, setWeather } from '../src/weather.js';
import { fuelBalance } from '../src/infra.js';
import { demandMul } from '../src/game.js';

test('thời tiết ngẫu nhiên: ra đủ các kiểu theo xác suất, không kẹt một kiểu', () => {
  const seen = {};
  let prev = 'sunny';
  for (let i = 0; i < 4000; i++) { prev = randomWeather(prev); seen[prev] = (seen[prev] ?? 0) + 1; }
  for (const id of Object.keys(WEATHERS)) assert.ok(seen[id] > 50, `${id}: ${seen[id]}`);
  const G = createGame();
  setWeather(G, 'rain');
  const h = (G.weather.until - G.t) / 3600;
  assert.ok(h >= 2 && h <= 10, 'mỗi đợt kéo dài 2–10 giờ');
});

test('rét đậm làm tăng nhu cầu điện (sưởi), như nắng nóng (điều hoà)', () => {
  assert.ok(demandMul(19, 8) > demandMul(19, 24));
  assert.ok(demandMul(19, 40) > demandMul(19, 24));
});

test('đa nhịp: tốc độ 1500× chạy đúng thời gian game và lưới vẫn ổn định', () => {
  assert.equal(slowTick(60), 0.25); assert.equal(slowTick(1500), 1);
  const G = createGame(); G.weather.until = 1e12; G.speed = 1500;
  for (let i = 0; i < 120; i++) advance(G, 1 / 10);   // 12 s thực = 5 giờ game
  assert.ok(Math.abs(G.t - 18000) < 1, `t = ${G.t}`);
  assert.ok(G.net.nodes.filter((n) => n.type === 'city').every((n) => n.frac > 0.99));
  assert.ok(!G.reactor.scram);
});

test('uranium tiêu hao theo công suất lò: chạy nửa công suất thì đốt khoảng một nửa', () => {
  const G = createGame(); G.weather.until = 1e12;
  advance(G, 5);
  const full = fuelBalance(G, [G.reactor]).burn;
  G.reactor.Pf *= 0.5;
  assert.ok(Math.abs(fuelBalance(G, [G.reactor]).burn - full / 2) < 0.02);
});
