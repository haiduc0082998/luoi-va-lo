// Chọn công trình / đường dây bằng tia từ con trỏ chuột, và tìm điểm trên mặt đất.
import * as pc from 'playcanvas';
import { rayTerrain } from './terrain.js';
import { PICK_RADIUS, nodeGround } from './scene.js';

const from = new pc.Vec3(), to = new pc.Vec3(), dir = new pc.Vec3(), hit = new pc.Vec3();

function rayFromScreen(cam, x, y) {
  cam.camera.screenToWorld(x, y, cam.camera.nearClip, from);
  cam.camera.screenToWorld(x, y, cam.camera.farClip, to);
  dir.sub2(to, from).normalize();
  return { o: from, d: dir };
}

/** Khoảng cách ngắn nhất giữa tia (o, d) và đoạn thẳng p→q; trả về {dist, t} (t: tham số trên tia). */
function raySegment(o, d, p, q) {
  const u = new pc.Vec3().sub2(q, p), w = new pc.Vec3().sub2(o, p);
  const a = 1, b = d.dot(u), c = u.dot(u), dd = d.dot(w), e = u.dot(w);
  const den = a * c - b * b;
  let s = den > 1e-9 ? (b * e - c * dd) / den : 0;   // trên tia
  let r = den > 1e-9 ? (a * e - b * dd) / den : 0;   // trên đoạn
  r = Math.max(0, Math.min(1, r));
  s = Math.max(0, d.dot(new pc.Vec3().sub2(new pc.Vec3().copy(p).add(u.clone().mulScalar(r)), o)));
  const pr = new pc.Vec3().copy(p).add(u.mulScalar(r)), po = new pc.Vec3().copy(o).add(d.clone().mulScalar(s));
  return { dist: pr.distance(po), t: s };
}

export function pick(cam, x, y, G, lineViews) {
  const { o, d } = rayFromScreen(cam, x, y);
  let best = null;
  for (const n of G.net.nodes) {
    const r = PICK_RADIUS[n.type], c = new pc.Vec3(n.x, nodeGround(n) + r * 0.45, n.z);
    const oc = new pc.Vec3().sub2(o, c), b = oc.dot(d), disc = b * b - (oc.dot(oc) - r * r);
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && (!best || t < best.t)) best = { kind: 'node', id: n.id, t };
  }
  for (const [id, v] of lineViews) {
    const pts = v.polyline;
    for (let i = 0; i < pts.length - 1; i++) {
      const { dist, t } = raySegment(o, d, pts[i], pts[i + 1]);
      if (dist < 3 && (!best || t < best.t - 4)) best = { kind: 'line', id, t };
    }
  }
  return best;
}

export function groundPoint(cam, x, y) {
  const { o, d } = rayFromScreen(cam, x, y);
  const p = rayTerrain(o, d, hit);
  return p ? p.clone() : null;
}
