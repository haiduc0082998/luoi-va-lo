// Camera quỹ đạo: kéo để xoay, cuộn hoặc chụm hai ngón để thu phóng, chuyển mượt giữa các góc nhìn.
import * as pc from 'playcanvas';
import { clamp } from '../util.js';

export const VIEWS = {
  grid: { target: [-8, 6, 0], yaw: 18, pitch: 22, dist: 88 },
  reactor: { target: [14, 6, -50], yaw: -35, pitch: 34, dist: 70 },
  overview: { target: [0, 4, -22], yaw: 35, pitch: 38, dist: 140 },
};

export function createOrbitCamera(app, canvas) {
  const cam = new pc.Entity('camera');
  cam.addComponent('camera', { fov: 45, nearClip: 0.5, farClip: 800 });
  app.root.addChild(cam);

  const s = { yaw: 18, pitch: 22, dist: 88, target: new pc.Vec3(-8, 6, 0) };
  const goal = { ...s, target: s.target.clone() };
  const pointers = new Map();
  let pinch = 0;

  const go = (name) => {
    const v = VIEWS[name];
    goal.target.set(...v.target); goal.yaw = v.yaw; goal.pitch = v.pitch; goal.dist = v.dist;
  };

  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); });
  const up = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      goal.yaw -= (e.clientX - prev[0]) * 0.3;
      goal.pitch = clamp(goal.pitch + (e.clientY - prev[1]) * 0.25, 6, 80);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) goal.dist = clamp(goal.dist * (pinch / d), 20, 220);
      pinch = d;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    goal.dist = clamp(goal.dist * Math.pow(1.0015, e.deltaY), 20, 220);
  }, { passive: false });

  const pos = new pc.Vec3();
  function update(dt) {
    const k = 1 - Math.exp(-dt * 4);
    s.yaw += (goal.yaw - s.yaw) * k; s.pitch += (goal.pitch - s.pitch) * k; s.dist += (goal.dist - s.dist) * k;
    s.target.lerp(s.target, goal.target, k);
    const y = (s.yaw * Math.PI) / 180, p = (s.pitch * Math.PI) / 180;
    pos.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).mulScalar(s.dist).add(s.target);
    cam.setPosition(pos);
    cam.lookAt(s.target);
  }

  return { entity: cam, go, update };
}
