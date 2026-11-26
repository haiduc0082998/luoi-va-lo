import * as pc from 'playcanvas';
import './style.css';
import * as Game from './game.js';
import { buildWorld, nodeGround, PICK_RADIUS } from './world/scene.js';
import { createOrbitCamera } from './world/camera.js';
import { pick, groundPoint } from './world/picking.js';
import { createHud } from './ui/hud.js';
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

let world, hud, lineFrom = null, cursor = null;

const HINTS = {
  select: '',
  sub: 'Xây trạm: bấm lên mặt đất (xanh = đặt được, đỏ = không). Không xây trên sông hay sát công trình khác.',
  line: 'Kéo dây: bấm công trình đầu tiên…',
};
function setTool(t) {
  hud.ui.tool = t; lineFrom = null; hud.syncSegs();
  hud.setModeHint(HINTS[t]);
}

/** Bấm vào một công trình (trên bản đồ hoặc nhãn tên): chọn, hoặc làm đầu/cuối tuyến dây mới. */
function nodeClicked(id) {
  if (hud.ui.tool !== 'line') return hud.select({ kind: 'node', id });
  if (!lineFrom) {
    lineFrom = id;
    hud.setModeHint(`Kéo dây từ ${Game.nodeById(G, id).name}: bấm công trình thứ hai (${fmt(hud.ui.newKv, hud.ui.newKv === 10.5 ? 1 : 0)} kV, ${hud.ui.newA} mm²).`);
    return;
  }
  const l = Game.buildLine(G, lineFrom, id, hud.ui.newKv, hud.ui.newA);
  if (l) { setTool('select'); hud.select({ kind: 'line', id: l.id }); }
}

const camera = createOrbitCamera(app, canvas, {
  onClick(x, y) {
    const tool = hud.ui.tool;
    if (tool === 'sub') {
      const p = groundPoint(camera.entity, x, y);
      if (!p) return;
      const n = Game.buildSubstation(G, p.x, p.z);
      if (n) { setTool('select'); hud.select({ kind: 'node', id: n.id }); }
      return;
    }
    const hit = pick(camera.entity, x, y, G, world.lineViews);
    if (hit?.kind === 'node') return nodeClicked(hit.id);
    if (tool === 'select') hud.select(hit ? { kind: hit.kind, id: hit.id } : null);
  },
  onHover(x, y) {
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
document.getElementById('lineRows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const v = world.lineViews.get(tr.dataset.id);
  if (v) camera.focus(v.mid.x, v.mid.y - 8, v.mid.z, 110);
});

// Nhãn tên công trình bám theo vị trí 3D
const tags = new Map();
const screen = new pc.Vec3(), wpos = new pc.Vec3();
function updateTags() {
  for (const n of G.net.nodes) {
    if (!tags.has(n.id)) {
      const el = document.createElement('div'); el.className = 'tag'; stage.appendChild(el);
      el.addEventListener('click', () => nodeClicked(n.id));
      tags.set(n.id, el);
    }
    const el = tags.get(n.id);
    wpos.set(n.x, nodeGround(n) + PICK_RADIUS[n.type] + 4, n.z);
    camera.entity.camera.worldToScreen(wpos, screen);
    const visible = screen.z > 0 && screen.x > 0 && screen.x < stage.clientWidth && screen.y > 20 && screen.y < stage.clientHeight;
    el.style.display = visible ? '' : 'none';
    if (!visible) continue;
    el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -100%)`;
    const status = n.state === 'fire' ? ' · CHÁY' : n.type === 'city' ? ` · ${fmt(n.served)}/${fmt(n.demand)} MW` : n.type === 'nuclear' ? ` · ${fmt(G.reactor.Pe / 1e6)} MW` : n.type === 'coal' ? ` · ${fmt(n.gen)} MW` : '';
    const text = n.name + status;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('alert', n.state === 'fire' || (n.type === 'city' && n.frac < 0.99) || (n.type === 'nuclear' && (G.reactor.scram || G.reactor.boom)));
  }
}

app.on('update', (dt) => {
  const dtReal = Math.min(dt, 0.1);
  Game.advance(G, dtReal);
  camera.update(dtReal);
  world.update(G, dtReal, camera.entity, hud.ui.selection);
  world.setGhost(G, hud.ui.tool, cursor, lineFrom ? Game.nodeById(G, lineFrom) : null);
  updateTags();
  hud.render();
});

Game.news(G, 'Chào mừng Bộ trưởng Năng lượng. Hai nhà máy, hai trạm và hai thành phố đang chờ lệnh. Bấm vào công trình để điều khiển.');
setTool('select');
app.start();
window.__game = G; // để kiểm thử và gỡ lỗi
