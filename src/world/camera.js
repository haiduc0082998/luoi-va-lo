// Camera quỹ đạo: kéo trái để xoay, kéo phải (hoặc Shift + kéo, hai ngón) để di chuyển,
// cuộn/chụm để thu phóng. Phân biệt bấm (chọn) và kéo (xoay).
import * as pc from 'playcanvas';
import { clamp } from '../util.js';

export const VIEWS = {
  overview: { target: [-10, 0, 20], yaw: 20, pitch: 52, dist: 400 },
  nuclear: { target: [16, 3, -32], yaw: -150, pitch: 36, dist: 70 },
  capital: { target: [52, 4, 20], yaw: 30, pitch: 30, dist: 80 },
  west: { target: [-40, 4, 30], yaw: -20, pitch: 34, dist: 110 },
  south: { target: [46, 4, 140], yaw: 15, pitch: 32, dist: 90 },
  coast: { target: [-140, 2, 115], yaw: -60, pitch: 30, dist: 110 },
  sea: { target: [-40, 0, 205], yaw: 170, pitch: 28, dist: 150 },
};

export function createOrbitCamera(app, canvas, { onClick, onHover }) {
  const cam = new pc.Entity('camera');
  cam.addComponent('camera', { fov: 45, nearClip: 0.5, farClip: 1400 });
  app.root.addChild(cam);

  const v0 = VIEWS.overview;
  const s = { yaw: v0.yaw, pitch: v0.pitch, dist: v0.dist, target: new pc.Vec3(...v0.target) };
  const goal = { ...s, target: s.target.clone() };
  const pointers = new Map();
  let pinch = 0, down = null;
  const bounds = { x: 0, z: 0, r: 230 };
  const setBounds = (x, z, r) => { bounds.x = x; bounds.z = z; bounds.r = r; };

  const go = (name) => {
    const v = VIEWS[name];
    goal.target.set(...v.target); goal.yaw = v.yaw; goal.pitch = v.pitch; goal.dist = v.dist;
  };
  const focus = (x, y, z, dist, yaw, pitch) => { goal.target.set(x, y, z); if (dist) goal.dist = dist; if (yaw !== undefined) goal.yaw = yaw; if (pitch !== undefined) goal.pitch = pitch; };
  const jump = () => { s.target.copy(goal.target); s.yaw = goal.yaw; s.pitch = goal.pitch; s.dist = goal.dist; };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const pan = (dx, dy) => {
    const y = (s.yaw * Math.PI) / 180, k = goal.dist * 0.0016;
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
    goal.target.x = clamp(goal.target.x + (-dx * rx + dy * fx) * k, bounds.x - bounds.r, bounds.x + bounds.r);
    goal.target.z = clamp(goal.target.z + (-dx * rz + dy * fz) * k, bounds.z - bounds.r, bounds.z + bounds.r);
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    down = { t: performance.now(), moved: 0, button: e.button, shift: e.shiftKey };
  });
  canvas.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId); pinch = 0;
    if (down && down.moved < 6 && down.button === 0 && performance.now() - down.t < 600 && pointers.size === 0) onClick(...local(e));
    if (pointers.size === 0) down = null;
  });
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); down = null; });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) { onHover(...local(e)); return; }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 1) {
      if (down && (down.button === 2 || down.shift)) pan(dx, dy);
      else if (down && down.moved >= 6) {
        goal.yaw -= dx * 0.3;
        goal.pitch = clamp(goal.pitch + dy * 0.25, 8, 85);
      }
      onHover(...local(e));
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) goal.dist = clamp(goal.dist * (pinch / d), 25, 540);
      pinch = d;
      pan(dx / 2, dy / 2);
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    goal.dist = clamp(goal.dist * Math.pow(1.0015, e.deltaY), 25, 460);
  }, { passive: false });

  const pos = new pc.Vec3();
  function update(dt) {
    const k = 1 - Math.exp(-dt * 5);
    s.yaw += (goal.yaw - s.yaw) * k; s.pitch += (goal.pitch - s.pitch) * k; s.dist += (goal.dist - s.dist) * k;
    s.target.lerp(s.target, goal.target, k);
    const y = (s.yaw * Math.PI) / 180, p = (s.pitch * Math.PI) / 180;
    pos.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).mulScalar(s.dist).add(s.target);
    cam.setPosition(pos);
    cam.lookAt(s.target);
  }

  return { entity: cam, go, focus, update, setBounds, jump };
}
