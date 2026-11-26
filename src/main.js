import * as pc from 'playcanvas';
import './style.css';
import { createGame, advance, news } from './game.js';
import { buildWorld, LABELS } from './world/scene.js';
import { createOrbitCamera } from './world/camera.js';
import { createHud } from './ui/hud.js';

const G = createGame();
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

const camera = createOrbitCamera(app, canvas);
const world = buildWorld(app);
const hud = createHud(G, { onTab: (tab) => camera.go(tab) });

// Nhãn HTML bám theo công trình 3D
const tags = LABELS.map(([text, p, id]) => {
  const el = document.createElement('div');
  el.className = 'tag'; el.textContent = text;
  if (id) el.id = `tag-${id}`;
  stage.appendChild(el);
  return { el, pos: new pc.Vec3(...p) };
});
const screen = new pc.Vec3();

app.on('update', (dt) => {
  const dtReal = Math.min(dt, 0.1);
  advance(G, dtReal);
  camera.update(dtReal);
  world.update(G, dtReal, camera.entity);
  for (const t of tags) {
    camera.entity.camera.worldToScreen(t.pos, screen);
    const visible = screen.z > 0 && screen.x > 0 && screen.x < stage.clientWidth && screen.y > 0 && screen.y < stage.clientHeight;
    t.el.style.display = visible ? '' : 'none';
    if (visible) t.el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -100%)`;
  }
  hud.render();
});

news(G, 'Chào mừng Bộ trưởng Năng lượng. Lưới điện quốc gia và nhà máy hạt nhân số 1 đang chờ lệnh.');
hud.sync();
hud.start();
app.start();

// Cho phép kiểm thử và gỡ lỗi từ console
window.__game = G;
