import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, createLine, stepNetwork, solveLinear, findIslands } from '../src/physics/network.js';

const mk = () => {
  const g = createNode({ id: 'g', type: 'coal' });
  const s = createNode({ id: 's', type: 'sub' });
  const c = createNode({ id: 'c', type: 'city', demandBase: 300 });
  return { g, s, c };
};
const env = (cap, Ta = 30) => ({ cap, demandMul: 1, Ta });
const run = (net, e, seconds, dt = 0.5) => {
  const ev = [];
  for (let t = 0; t < seconds; t += dt) stepNetwork(net, dt, e, (type) => ev.push(type));
  return ev;
};

test('giải hệ tuyến tính', () => {
  const x = solveLinear([[2, 1], [1, 3]], [3, 5]);
  assert.ok(Math.abs(x[0] - 0.8) < 1e-9 && Math.abs(x[1] - 1.4) < 1e-9);
});

test('hai tuyến song song chia công suất ngược với điện trở', () => {
  const { g, c } = mk();
  const net = {
    nodes: [g, c],
    lines: [createLine({ a: 'g', b: 'c', L: 40, A: 400 }), createLine({ a: 'g', b: 'c', L: 80, A: 400 })],
  };
  stepNetwork(net, 0.1, env({ g: 600 }));
  const [short, long] = net.lines;
  assert.ok(Math.abs(short.P / long.P - 2) < 0.05, `${short.P} / ${long.P}`);
  assert.ok(Math.abs(short.P + long.P - 300) < 1);
});

test('thiếu nguồn: sa thải phụ tải và tần số tụt dưới 50 Hz', () => {
  const { g, s, c } = mk();
  const net = { nodes: [g, s, c], lines: [createLine({ a: 'g', b: 's', L: 30 }), createLine({ a: 's', b: 'c', L: 30 })] };
  stepNetwork(net, 0.1, env({ g: 150 }));
  assert.ok(c.frac < 0.55 && c.frac > 0.45);
  assert.ok(net.summary.hz < 49.5);
});

test('mở máy cắt tách đảo: thành phố mất điện', () => {
  const { g, s, c } = mk();
  const l2 = createLine({ a: 's', b: 'c', L: 30 });
  const net = { nodes: [g, s, c], lines: [createLine({ a: 'g', b: 's', L: 30 }), l2] };
  l2.closed = false;
  stepNetwork(net, 0.1, env({ g: 600 }));
  assert.equal(findIslands(net).length, 2);
  assert.equal(c.served, 0);
});

test('dây mảnh quá tải, tắt rơ-le thì cháy và cắt điện', () => {
  const { g, c } = mk();
  c.demandBase = 300;
  const l = createLine({ a: 'g', b: 'c', kv: 110, A: 95, L: 15, relay: false });
  const net = { nodes: [g, c], lines: [l] };
  assert.ok(run(net, env({ g: 600 }, 38), 600, 0.05).includes('lineFire'));
  assert.equal(l.state, 'fire');
});

test('rơ-le bật: điều độ giảm phát cho vừa dây, không cắt, không cháy; thiếu điện thì thành phố chịu', () => {
  const { g, c } = mk();
  c.demandBase = 300;
  const l = createLine({ a: 'g', b: 'c', kv: 110, A: 95, L: 15 });
  const net = { nodes: [g, c], lines: [l] };
  const ev = run(net, env({ g: 600 }, 38), 600, 0.05);
  assert.ok(!ev.includes('lineFire') && !ev.includes('trip'));
  assert.ok(l.I <= l.Imax, `${l.I} ≤ ${l.Imax}`);
  assert.ok(c.frac < 0.5, 'dây mảnh không chở đủ 300 MW');
});

test('rơ-le bật mà dây trong mạch vòng vẫn quá tải thì rơ-le cắt trước khi cháy', () => {
  const { g, c } = mk();
  c.demandBase = 300;
  const h = createNode({ id: 'h', type: 'sub', x: 10, z: 10 });
  const big = createLine({ a: 'g', b: 'h', kv: 500, A: 630, L: 15 }), thin = createLine({ a: 'h', b: 'c', kv: 110, A: 95, L: 15 });
  const ev = run({ nodes: [g, h, c], lines: [big, thin] }, env({ g: 600 }, 38), 600, 0.05);
  assert.equal(ev[0], 'trip');
  assert.ok(!ev.includes('lineFire'));
});

test('tham nhũng làm tăng điện trở và tổn hao', () => {
  const { g, c } = mk();
  const clean = createLine({ a: 'g', b: 'c', L: 100 }), dirty = createLine({ a: 'g', b: 'c', L: 100, quality: 1.3 });
  stepNetwork({ nodes: [g, c], lines: [clean] }, 0.1, env({ g: 600 }));
  const lossClean = clean.loss;
  stepNetwork({ nodes: [g, c], lines: [dirty] }, 0.1, env({ g: 600 }));
  assert.ok(dirty.loss > lossClean * 1.25);
});
