import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, buildLine, hourOfDay } from '../src/game.js';
import { build, canPlace } from '../src/infra.js';
import { setWeather, solarFarmMW, WEATHERS } from '../src/weather.js';
import { missionsStep } from '../src/missions.js';

const spot = (G, type, x0, z0) => { for (let r = 0; r < 60; r += 3) for (let a = 0; a < 6.28; a += 0.5) { const x = x0 + r * Math.cos(a), z = z0 + r * Math.sin(a); if (canPlace(G, type, x, z) === '') return [x, z]; } return null; };
const game = () => { const G = createGame(); setWeather(G, 'sunny'); G.weather.until = 1e12; G.weather.seed = 0; G.budget = 300; G.res.RE = 200; return G; };

test('điện mặt trời: đỉnh buổi trưa, 0 về đêm, mây làm giảm', () => {
  const W = WEATHERS.sunny;
  assert.equal(solarFarmMW(0, W, 25), 0);
  assert.ok(solarFarmMW(12, W, 25) > 75 && solarFarmMW(12, W, 25) > solarFarmMW(9, W, 25));
  assert.ok(solarFarmMW(12, WEATHERS.storm, 25) < 0.35 * solarFarmMW(12, W, 25));
});

test('trạm pin xả lúc cao điểm tối, sạc lại bằng điện dư, bớt than + nước hồ', () => {
  const run = (withStorage) => {
    const G = game();
    if (withStorage) {
      for (let i = 0; i < 2; i++) { const [x, z] = spot(G, 'solar', 75, 45); buildLine(G, build(G, 'solar', x, z).id, 'capital', 220, 400); }
      const [x, z] = spot(G, 'battery', 70, 10); const b = build(G, 'battery', x, z); buildLine(G, b.id, 'capital', 220, 400);
    }
    const log = [];
    let coalMWh = 0; // than + thuỷ điện: nguồn đắt / nước trong hồ mà pin giúp tiết kiệm
    for (let h = 0; h < 30; h++) { // từ 8 h sáng hôm nay tới 14 h hôm sau
      advance(G, 3600 / G.speed);
      coalMWh += G.net.nodes.filter((n) => n.type === 'coal' || n.type === 'hydro').reduce((t, n) => t + n.gen, 0);
      const b = G.net.nodes.find((n) => n.type === 'battery');
      if (b) log.push({ hr: Math.floor(hourOfDay(G)), soc: b.soc, gen: b.gen, charge: b.charge });
    }
    missionsStep(G, 1);
    return { G, log, coalMWh };
  };
  const a = run(false), b = run(true);
  const iEve = b.log.findIndex((r) => r.hr >= 18 && r.gen > 0);
  assert.ok(iEve >= 0, 'tối: pin xả');
  assert.ok(b.log.slice(iEve).some((r) => r.charge > 0), 'sau cao điểm: pin sạc lại bằng điện dư');
  assert.ok(Math.max(...b.log.map((r) => r.soc)) > 0.8, 'pin được sạc gần đầy');
  assert.ok(b.coalMWh <= a.coalMWh, `than+thuỷ điện: có pin ${b.coalMWh.toFixed(0)} ≤ không pin ${a.coalMWh.toFixed(0)} MWh`);
  assert.ok(b.G.missions.done.includes('storage'), 'xong nhiệm vụ Nắng trưa, đèn tối');
});
