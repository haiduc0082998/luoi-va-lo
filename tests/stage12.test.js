import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, buildLine } from '../src/game.js';
import { inSea, nearSea, height, buildable, MAP_HALF, WATER_Y, westCoast, southCoast } from '../src/map.js';
import { canPlace, build } from '../src/infra.js';
import { setWeather } from '../src/weather.js';

test('bản đồ 460 × 460 có biển phía tây và phía nam, đất liền không bị ngập', () => {
  assert.equal(MAP_HALF, 230);
  assert.ok(inSea(-210, 0) && inSea(0, 225), 'ngoài khơi là biển');
  assert.ok(!inSea(0, 0) && !inSea(-128, 118) && !inSea(46, 146), 'thủ phủ, Tây Hải, Nam Bình trên đất liền');
  assert.ok(height(-128, 118) > WATER_Y && height(46, 146) > WATER_Y);
  assert.equal(buildable(-210, 0, []), 'Không xây được dưới biển');
});

test('cảng biển đặt được sát bờ biển; trại gió ngoài khơi mạnh hơn trên đất liền', () => {
  const G = createGame(); setWeather(G, 'sunny'); G.weather.until = 1e12; G.weather.seed = 0; G.budget = 200; G.res.RE = 100;
  // tìm một điểm bờ biển phía tây gần Tây Hải
  let port = null;
  for (let x = -160; x < -120 && !port; x += 1) if (canPlace(G, 'port', x, 140) === '') port = [x, 140];
  assert.ok(port, 'có chỗ đặt cảng biển');
  assert.ok(nearSea(port[0], port[1]));
  const z = 60, x = westCoast(z) - 10; // thềm biển nông
  assert.ok(inSea(x, z));
  assert.equal(canPlace(G, 'wind', x, z), '');
  const off = build(G, 'wind', x, z), on = build(G, 'wind', 60, 50);
  assert.ok(off.offshore && !on.offshore);
  buildLine(G, off.id, 'west', 220, 400); buildLine(G, on.id, 'capital', 220, 400);
  advance(G, 3600 / G.speed);
  assert.ok(off.gen > on.gen * 1.2, `ngoài khơi ${off.gen} > trên bờ ${on.gen}`);
});

test('dễ chơi hơn: vốn 50 triệu, đủ nhân công, có ngân sách trung ương hằng ngày', () => {
  const G = createGame(); G.weather.until = 1e12;
  assert.equal(G.budget, 50);
  const b = G.budget;
  advance(G, (6 * 3600) / G.speed);
  assert.ok(G.grantPerDay > 1 && G.grantPerDay < 1.6);
  assert.ok(G.budget > b, 'không lỗ trong 6 giờ đầu');
});
