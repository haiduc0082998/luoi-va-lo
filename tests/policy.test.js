import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, buildLine, nodeById, SCENARIOS } from '../src/game.js';
import { signContract, research, TECHS, toggleDecree } from '../src/policy.js';
import { createReactor, stepReactor } from '../src/physics/reactor.js';

const runHours = (G, h) => { G.speed = 60; for (let i = 0; i < h * 60 && !G.over; i++) advance(G, 1); };

test('thủy điện gánh tải khi lò SCRAM', () => {
  const G = createGame();
  G.reactor.scram = true;
  runHours(G, 1);
  assert.ok(nodeById(G, 'hydro').gen > 200);
});

test('xuất khẩu chỉ có điện khi đã kéo dây tới cửa khẩu', () => {
  const G = createGame();
  signContract(G, 200);
  runHours(G, 1);
  assert.equal(nodeById(G, 'border').served, 0);
  G.budget = 100;
  assert.ok(buildLine(G, 'subE', 'border', 500, 630));
  runHours(G, 1);
  assert.ok(nodeById(G, 'border').served > 190);
});

test('Boron xoá bẫy AZ-3', () => {
  const R = createReactor({ rbmk: true, rps: false, rodCmd: 76, boron: true });
  const ev = [];
  for (let t = 0; t < 600 && !ev.includes('promptExplosion'); t += 0.05) {
    if (!R.scram && R.T >= 390) R.scram = true;
    stepReactor(R, 0.05, (e) => ev.push(e));
  }
  assert.ok(!ev.includes('promptExplosion'));
});

test('làm mát thụ động cứu lò trong kịch bản sóng thần', () => {
  const G = createGame();
  G.tech.add('boron'); G.tech.add('passive');
  SCENARIOS.find((s) => s[0].startsWith('Sóng thần'))[1](G);
  runHours(G, 6);
  assert.equal(G.reactor.melt, false);
  assert.ok(G.reactor.T < 500, `${G.reactor.T}`);
});

test('nghiên cứu cần đủ điểm và công nghệ tiền đề', () => {
  const G = createGame();
  G.rp = 100;
  assert.equal(research(G, 'passive'), false);
  assert.equal(research(G, 'boron'), true);
  assert.equal(research(G, 'passive'), true);
  assert.ok(G.rp < 100 - TECHS[0].cost);
});

test('quân đội bất mãn kéo dài thì đảo chính', () => {
  const G = createGame();
  G.factions.military = 0; G.gridFault = true; G.reactor.diesel = false;
  G.coalMax = 0;
  runHours(G, 30);
  assert.ok(G.over && G.over.includes('Đảo chính') || G.over?.includes('Cách mạng'), String(G.over));
});

test('thiết quân luật cần có căn cứ', () => {
  const G = createGame();
  toggleDecree(G, 'martial');
  assert.equal(G.decrees.martial, false);
});
