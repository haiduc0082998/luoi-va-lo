import * as pc from 'playcanvas';
import './style.css';
import * as Game from './game.js';
import { buildWorld, nodeGround, PICK_RADIUS } from './world/scene.js';
import { createOrbitCamera } from './world/camera.js';
import { pick, groundPoint, planePoint } from './world/picking.js';
import { ORIGIN, lotFromPoint } from './world/cityview.js';
import { createCityPanel } from './ui/citypanel.js';
import * as City from './city.js';
import { createHud } from './ui/hud.js';
import { createStage5 } from './ui/stage5.js';
import * as Infra from './infra.js';
import { fmt } from './util.js';

const G = Game.createGame();
const canvas = document.getElementById('scene');
const stage = document.getElementById('stage');

let app;
try {
  app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true } });
} catch (err) {
  document.getElementById('noGL').hidden = false;
  throw err;
}
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
app.setCanvasFillMode(pc.FILLMODE_NONE);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
const fit = () => app.resizeCanvas(stage.clientWidth, stage.clientHeight);
new ResizeObserver(fit).observe(stage);
fit();

let world, hud, lineFrom = null, cursor = null, cityId = null, cityPanel = null;

const HINTS = {
  select: '',
  line: 'Kéo dây: bấm công trình đầu tiên…',
  sell: 'Bán công trình: bấm vào công trình tự xây để thu hồi 70% chi phí. Hạ tầng cốt lõi không bán được.',
};
function setTool(t) {
  hud.ui.tool = t; lineFrom = null; hud.syncSegs();
  const b = t.startsWith('build:') ? Infra.BUILDS[t.slice(6)] : null;
  hud.setModeHint(b ? `Xây ${b.name.toLowerCase()} (${fmt(Infra.buildCost(G, t.slice(6)), 1)} triệu USD): bấm lên mặt đất. Khối xanh là đặt được, đỏ là không. ${b.desc}` : HINTS[t]);
}

/** Bấm vào một công trình (trên bản đồ hoặc nhãn tên): chọn, hoặc làm đầu/cuối tuyến dây mới. */
function nodeClicked(id) {
  if (hud.ui.tool === 'sell') { if (Infra.sell(G, 'node', id)) hud.select(null); return; }
  if (hud.ui.tool !== 'line') return hud.select({ kind: 'node', id });
  if (!lineFrom) {
    lineFrom = id;
    hud.setModeHint(`Kéo dây từ ${Game.nodeById(G, id).name}: bấm công trình thứ hai (${fmt(hud.ui.newKv, hud.ui.newKv === 10.5 ? 1 : 0)} kV, ${hud.ui.newA} mm²).`);
    return;
  }
  const l = Game.buildLine(G, lineFrom, id, hud.ui.newKv, hud.ui.newA, hud.ui.sc);
  if (l) { setTool('select'); hud.select({ kind: 'line', id: l.id }); }
}

function enterCity(id) {
  const n = Game.nodeById(G, id);
  if (!n || n.type !== 'city') return;
  G.cities[id] ||= City.createCity(n);
  City.evaluate(G.cities[id], n.frac ?? 1, n.demandBase);
  cityId = id; setTool('select');
  world.setMode('city');
  camera.setBounds(ORIGIN.x, ORIGIN.z, 70);
  camera.focus(ORIGIN.x, 0, ORIGIN.z, 150, 35, 40); camera.jump();
  document.body.classList.add('in-city');
  cityPanel.ui.tool = 'look'; cityPanel.ui.lot = null; cityPanel.show(true);
  stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function exitCity() {
  const C = G.cities[cityId];
  if (C?.draft) City.finishLine(G, C);
  const n = Game.nodeById(G, cityId);
  cityId = null; world.setMode('nation'); world.cityView.setGhost(null);
  camera.setBounds(0, 0, 120);
  camera.focus(n.x, 4, n.z, 90, 30, 32); camera.jump();
  document.body.classList.remove('in-city');
  cityPanel.show(false);
}
function cityClick(x, y) {
  const p = planePoint(camera.entity, x, y), lot = p && lotFromPoint(p);
  if (!lot) return;
  const C = G.cities[cityId], t = cityPanel.ui.tool;
  cityPanel.ui.lot = lot;
  if (t === 'metro') City.metroClick(G, C, lot[0], lot[1]);
  else if (t === 'demolish') City.demolish(G, C, lot[0], lot[1]);
  else if (t !== 'look') City.buildService(G, C, lot[0], lot[1], t);
  City.evaluate(C, Game.nodeById(G, cityId).frac ?? 1, Game.nodeById(G, cityId).demandBase);
}

const camera = createOrbitCamera(app, canvas, {
  onClick(x, y) {
    if (cityId) return cityClick(x, y);
    const tool = hud.ui.tool;
    if (tool.startsWith('build:')) {
      const p = groundPoint(camera.entity, x, y);
      if (!p) return;
      const made = Infra.build(G, tool.slice(6), p.x, p.z);
      if (made) { setTool('select'); hud.select({ kind: made.demand !== undefined ? 'node' : 'infra', id: made.id }); }
      return;
    }
    const hit = pick(camera.entity, x, y, G, world.lineViews, world.infraViews);
    if (hit?.kind === 'node') return nodeClicked(hit.id);
    if (tool === 'sell') { if (hit?.kind === 'infra' && Infra.sell(G, 'infra', hit.id)) hud.select(null); return; }
    if (tool === 'select') hud.select(hit ? { kind: hit.kind, id: hit.id } : null);
  },
  onHover(x, y) {
    if (cityId) {
      const p = planePoint(camera.entity, x, y), lot = p && lotFromPoint(p), t = cityPanel.ui.tool;
      if (!lot || t === 'look') return world.cityView.setGhost(null);
      const L = City.lotAt(G.cities[cityId], lot[0], lot[1]);
      const ok = t === 'demolish' ? !!City.SERVICES[L.type] : t === 'metro' ? true : !City.SERVICES[L.type];
      return world.cityView.setGhost(lot, ok);
    }
    if (hud.ui.tool === 'select') { cursor = null; return; }
    cursor = groundPoint(camera.entity, x, y);
  },
});

world = buildWorld(app);
hud = createHud(G, {
  onTool: (t) => setTool(t),
  onView: (v) => camera.go(v),
  onSelect: () => {},
  onQuality: (high) => {
    world.setQuality(high);
    app.graphicsDevice.maxPixelRatio = high ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    fit();
  },
});
const s5 = createStage5(G);
cityPanel = createCityPanel(G, { onExit: exitCity });
cityPanel.show(false);
hud.onEnterCity = enterCity;
document.getElementById('lineRows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const v = world.lineViews.get(tr.dataset.id);
  if (v) camera.focus(v.mid.x, v.mid.y - 8, v.mid.z, 110);
});

// Nhãn tên công trình bám theo vị trí 3D
const tags = new Map();
const screen = new pc.Vec3(), wpos = new pc.Vec3();
function updateTags() {
  if (cityId) { for (const el of tags.values()) el.style.display = 'none'; return; }
  for (const [id, el] of tags) if (!G.net.nodes.some((n) => n.id === id)) { el.remove(); tags.delete(id); }
  for (const n of G.net.nodes) {
    if (!tags.has(n.id)) {
      const el = document.createElement('div'); el.className = 'tag'; stage.appendChild(el);
      el.addEventListener('click', () => { nodeClicked(n.id); if (hud.ui.tool === 'select') camera.focus(n.x, nodeGround(n), n.z, 75); });
      tags.set(n.id, el);
    }
    const el = tags.get(n.id);
    wpos.set(n.x, nodeGround(n) + PICK_RADIUS[n.type] + 4, n.z);
    camera.entity.camera.worldToScreen(wpos, screen);
    const visible = screen.z > 0 && screen.x > 0 && screen.x < stage.clientWidth && screen.y > 72 && screen.y < stage.clientHeight - 20;
    el.style.display = visible ? '' : 'none';
    if (!visible) continue;
    el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -100%)`;
    const status = n.state === 'fire' ? ' · CHÁY' : n.type === 'hydro' || n.type === 'wind' ? ` · ${fmt(n.gen)} MW` : n.type === 'mine' ? ` · ${fmt(G.res.U, 1)} t U` : n.type === 'border' ? (G.market.exportOn ? ` · xuất ${fmt(n.served)} MW` : '') : n.type === 'city' ? ` · ${fmt(n.served)}/${fmt(n.demand)} MW` : n.type === 'nuclear' ? ` · ${fmt(G.reactor.Pe / 1e6)} MW` : n.type === 'coal' ? ` · ${fmt(n.gen)} MW` : '';
    const text = n.name + status;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('alert', n.state === 'fire' || (n.type === 'city' && n.frac < 0.99) || (n.type === 'nuclear' && (G.reactor.scram || G.reactor.boom)));
  }
}

app.on('update', (dt) => {
  const dtReal = Math.min(dt, 0.1);
  Game.advance(G, dtReal);
  camera.update(dtReal);
  world.update(G, dtReal, camera.entity, hud.ui.selection, cityId);
  if (cityId) cityPanel.render(cityId);
  world.setGhost(G, hud.ui.tool, cursor, lineFrom ? Game.nodeById(G, lineFrom) : null);
  updateTags();
  hud.render();
  s5.render();
});

Game.news(G, 'Chào mừng Bộ trưởng Năng lượng. Ba nhà máy, hai trạm, hai thành phố và cửa khẩu sang nước láng giềng đang chờ lệnh. Bấm vào công trình để điều khiển.');
setTool('select');
app.start();
window.__game = G; // để kiểm thử và gỡ lỗi
window.__build = (type, x, z) => Infra.build(G, type, x, z);
