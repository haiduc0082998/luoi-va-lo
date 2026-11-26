import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, stepGrid, isPowered } from '../src/physics/grid.js';
import { createReactor, stepReactor, RATED } from '../src/physics/reactor.js';

const run = (step, obj, seconds, dt = 0.05) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) step(obj, dt, (type) => events.push(type));
  return events;
};

test('lưới 220 kV chuẩn ổn định, tổn hao dưới 10%', () => {
  const C = createGrid();
  const ev = run(stepGrid, C, 3600, 0.5);
  assert.deepEqual(ev, []);
  assert.ok(isPowered(C));
  assert.ok(C.loss / (C.P * 1e6) < 0.1);
  assert.ok(C.Tw > 30 && C.Tw < 80, `nhiệt độ dây ${C.Tw}`);
});

test('10,5 kV đi 100 km gây sụp đổ điện áp', () => {
  const C = createGrid({ kv: 10.5, L: 100, A: 240, P: 120 });
  assert.deepEqual(run(stepGrid, C, 1), ['collapse']);
  assert.equal(isPowered(C), false);
});

test('dây 95 mm² quá tải, không rơ-le thì cháy', () => {
  const C = createGrid({ kv: 110, L: 15, A: 95, P: 300, relay: false, Ta: 38, Tw: 40 });
  assert.ok(run(stepGrid, C, 600).includes('lineFire'));
});

test('rơ-le cắt trước khi dây kịp cháy', () => {
  const C = createGrid({ kv: 110, L: 15, A: 95, P: 300, relay: true, Imax: 1500, Tw: 40 });
  const ev = run(stepGrid, C, 600);
  assert.equal(ev[0], 'trip');
  assert.ok(!ev.includes('lineFire'));
});

test('lò định mức giữ cân bằng quanh 3 000 MWt', () => {
  const R = createReactor();
  const ev = run(stepReactor, R, 1800);
  assert.deepEqual(ev, []);
  assert.ok(Math.abs(R.Pf / RATED - 1) < 0.05, `công suất ${R.Pf / RATED}`);
  assert.ok(R.Pe > 9e8);
});

test('mất điện toàn trạm: SCRAM rồi nhiệt phân rã vẫn làm nóng chảy lõi', () => {
  const R = createReactor({ offsite: false, diesel: false });
  const ev = run(stepReactor, R, 3 * 3600);
  assert.equal(ev[0], 'scram');
  assert.ok(ev.includes('h2Explosion') && ev.includes('meltdown'), ev.join(','));
});

test('có diesel thì lò được làm mát an toàn', () => {
  const R = createReactor({ offsite: false, diesel: true });
  const ev = run(stepReactor, R, 3 * 3600);
  assert.ok(!ev.includes('fuelDamage'), ev.join(','));
  assert.ok(R.T < 400);
});

test('RBMK tắt bảo vệ, rút thanh lên 80% thì công suất vọt và nổ', () => {
  const R = createReactor({ rbmk: true, rps: false, rodCmd: 80 });
  assert.ok(run(stepReactor, R, 300).includes('promptExplosion'));
});
