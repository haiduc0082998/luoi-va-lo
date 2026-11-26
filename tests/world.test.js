import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, nodeById, startUnit2, units } from '../src/game.js';
import { research } from '../src/policy.js';
import { toggleGuard, recruit, answerOffer, worldStep } from '../src/world.js';

const runHours = (G, h) => { G.speed = 60; for (let i = 0; i < h * 60 && !G.over; i++) advance(G, 1); };

test('tổ máy số 2: cần công nghệ, xây 3 ngày, rồi phát thêm điện', () => {
  const G = createGame();
  G.budget = 200; G.rp = 500;
  startUnit2(G);
  assert.equal(G.unit2.state, 'none');
  for (const id of ['boron', 'passive', 'unit2']) research(G, id);
  startUnit2(G);
  assert.equal(G.unit2.state, 'building');
  runHours(G, 73);
  assert.equal(units(G).length, 2);
  assert.ok(G.reactor2.Pe > 9e8);
  assert.equal(nodeById(G, 'nuc').rated, 2400);
});

test('nước thù địch phá hoại trạm không có lính gác, có lính thì bị chặn', () => {
  const G = createGame();
  for (const c of G.world.countries) c.relation = 15;
  G.reputation = 0;
  G.world.guards = [];
  let fires = 0;
  for (let i = 0; i < 12; i++) { G.world.eventAcc = 1e9; worldStep(G, 1); }
  fires = G.net.nodes.filter((n) => n.state === 'fire').length;
  assert.ok(fires > 0);
  const G2 = createGame();
  for (const c of G2.world.countries) c.relation = 15;
  G2.world.troops = 20;
  for (const id of ['subE', 'subW', 'coal', 'hydro', 'capital', 'port']) toggleGuard(G2, id);
  for (let i = 0; i < 12; i++) { G2.world.eventAcc = 1e9; worldStep(G2, 1); }
  assert.equal(G2.net.nodes.filter((n) => n.state === 'fire').length, 0);
});

test('quan hệ dưới 8 thì tuyên chiến', () => {
  const G = createGame();
  G.world.countries[1].relation = 5; G.reputation = 0;
  worldStep(G, 1);
  assert.ok(G.world.war);
});

test('đề nghị vay vốn cộng ngân sách', () => {
  const G = createGame();
  G.world.offers.push({ id: 'x', country: 'south', kind: 'loan', text: 'vay', expires: 1e9 });
  const b = G.budget;
  answerOffer(G, 'x', true);
  assert.equal(G.budget, b + 8);
});

test('tuyển quân tốn tiền và giới hạn số công trình canh gác', () => {
  const G = createGame();
  recruit(G);
  assert.equal(G.world.troops, 3);
  for (const id of ['subE', 'subW', 'coal', 'hydro']) toggleGuard(G, id);
  assert.equal(G.world.guards.length, 3);
});
