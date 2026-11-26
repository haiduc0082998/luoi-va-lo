import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReactor, stepReactor, RATED } from '../src/physics/reactor.js';

const run = (step, obj, seconds, dt = 0.05) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) step(obj, dt, (type) => events.push(type));
  return events;
};

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

test('AZ-3: SCRAM lò RBMK khi đang ổn định thì an toàn', () => {
  const R = createReactor({ rbmk: true, rps: false });
  R.scram = true;
  const ev = run(stepReactor, R, 300);
  assert.ok(!ev.includes('promptExplosion'));
  assert.ok(R.Pf < 0.05 * RATED);
});

test('AZ-3: SCRAM lò RBMK khi đã nóng ~390 °C thì đầu than chì làm công suất vọt và nổ', () => {
  const R = createReactor({ rbmk: true, rps: false, rodCmd: 76 });
  const ev = [];
  for (let t = 0; t < 600 && !ev.includes('promptExplosion'); t += 0.05) {
    if (!R.scram && R.T >= 390) R.scram = true;
    stepReactor(R, 0.05, (e) => ev.push(e));
  }
  assert.ok(ev.includes('promptExplosion'));
});
