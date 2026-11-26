import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, nodeById } from '../src/game.js';
import { createCity, evaluate, buildService, metroClick, finishLine, servedStations, lotAt } from '../src/city.js';

const fresh = () => { const G = createGame(); G.budget = 100; G.weather.until = 1e12; return G; };
const emptyLots = (C) => C.lots.filter((l) => l.type === 'empty');

test('thành phố mới có dịch vụ cơ bản, hạnh phúc ở mức trung bình', () => {
  const C = evaluate(createCity({ id: 'capital' }), 1, 560);
  assert.ok(C.happiness > 40 && C.happiness < 70, `${C.happiness}`);
  assert.ok(C.extraMW > 0);
});

test('xây thêm trường và bệnh viện làm tăng hạnh phúc', () => {
  const G = fresh(), C = createCity({ id: 'capital' });
  const before = evaluate(C, 1, 560).happiness;
  for (const [type, i, j] of [['school', 6, 6], ['hospital', 1, 1], ['park', 7, 7], ['police', 1, 7], ['fire', 7, 1]]) buildService(G, C, i, j, type);
  assert.ok(evaluate(C, 1, 560).happiness > before + 5);
});

test('metro: ga chỉ phục vụ khi tuyến có ≥ 2 ga; metro giảm tắc đường và tốn điện', () => {
  const G = fresh(), C = createCity({ id: 'capital' });
  evaluate(C, 1, 560);
  const jam = C.congestion, mw = C.extraMW;
  metroClick(G, C, 0, 4);
  assert.equal(servedStations(C).size, 0);
  metroClick(G, C, 4, 4); metroClick(G, C, 8, 4); metroClick(G, C, 4, 0); metroClick(G, C, 4, 8);
  finishLine(G, C);
  evaluate(C, 1, 560);
  assert.equal(servedStations(C).size, 5);
  assert.ok(C.congestion < jam && C.extraMW > mw + 5);
  assert.equal(lotAt(C, 4, 4).type, 'station');
});

test('dịch vụ đô thị tốt kéo lòng dân lên và thành phố lớn dần', () => {
  const G = fresh();
  advance(G, 0.01);
  const C = G.cities.capital ?? (advance(G, 2), G.cities.capital);
  for (const l of emptyLots(C)) buildService(G, C, l.i, l.j, ['school', 'hospital', 'park', 'police'][(l.i + l.j) % 4]);
  G.speed = 60;
  const ap0 = G.approval, d0 = nodeById(G, 'capital').demandBase;
  for (let i = 0; i < 24 * 60; i++) advance(G, 1);
  assert.ok(G.cities.capital.happiness > 60, `${G.cities.capital.happiness}`);
  assert.ok(nodeById(G, 'capital').demandBase > d0);
  assert.ok(G.approval >= ap0);
});
