// Bộ công cụ dựng hình nhỏ dùng chung: vật liệu, khối hình cơ bản, thanh dầm nối hai điểm.
import * as pc from 'playcanvas';

export const col = (h) => new pc.Color().fromString(h);
export const col255 = (c, out = new pc.Color()) => out.set(c[0] / 255, c[1] / 255, c[2] / 255);

export function mat(hex, o = {}) {
  const m = new pc.StandardMaterial();
  m.diffuse = col(hex); m.gloss = o.gloss ?? 0.35; m.useMetalness = true; m.metalness = o.metal ?? 0;
  if (o.emissive) { m.emissive = col(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity != null) { m.opacity = o.opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
  m.update();
  return m;
}

export function ent(parent, type, p, s, m, shadow = true) {
  const e = new pc.Entity();
  e.addComponent('render', { type, material: m, castShadows: shadow, receiveShadows: true });
  e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]);
  parent.addChild(e);
  return e;
}

export function meshEnt(app, parent, geom, p, m) {
  const e = new pc.Entity();
  const mi = new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, geom), m);
  e.addComponent('render', { meshInstances: [mi], castShadows: true, receiveShadows: true });
  e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e);
  return e;
}

export function light(parent, p, color, range = 20) {
  const e = new pc.Entity();
  e.addComponent('light', { type: 'omni', color: col(color), intensity: 0, range, castShadows: false });
  e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e);
  return e;
}

const tmp = new pc.Vec3();
/** Đặt khối hộp e thành thanh nối a → b (toạ độ thế giới), tiết diện t. */
export function setBeam(e, a, b, t) {
  tmp.sub2(b, a);
  const len = tmp.length() || 1e-3;
  e.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  e.setLocalScale(t, t, len);
  e.lookAt(b, Math.abs(tmp.y) / len > 0.98 ? pc.Vec3.RIGHT : pc.Vec3.UP);
}
export function beam(parent, a, b, t, m, shadow = true) {
  const e = ent(parent, 'box', [0, 0, 0], [1, 1, 1], m, shadow);
  setBeam(e, a, b, t);
  return e;
}

/** Ngọn lửa: vài hình nón phát sáng + đèn điểm, nhấp nháy. */
export function fire(parent, p, size, M) {
  const g = new pc.Entity(); g.setLocalPosition(p[0], p[1], p[2]); parent.addChild(g);
  const parts = [[0, 0, 1.4, M.flameA], [0.6, 0.3, 0.9, M.flameB], [-0.5, -0.4, 1.0, M.flameA]].map(([dx, dz, s, m]) => ({
    e: ent(g, 'cone', [dx * size, s * size, dz * size], [s * size, s * 2 * size, s * size], m, false), s: s * size,
  }));
  const l = new pc.Entity();
  l.addComponent('light', { type: 'omni', color: col('#ff7a33'), intensity: 0, range: 16 * size });
  l.setLocalPosition(0, 2 * size, 0); g.addChild(l);
  g.enabled = false;
  return {
    g,
    set(on, t) {
      g.enabled = on;
      if (!on) return;
      parts.forEach((p, i) => p.e.setLocalScale(p.s * (0.85 + 0.2 * Math.sin(t * 13 + i * 2)), p.s * 2 * (0.8 + 0.35 * Math.abs(Math.sin(t * 9 + i))), p.s));
      l.light.intensity = 2.5 + Math.sin(t * 20) * 0.8;
    },
  };
}

export { seeded } from '../rng.js';

/** Tháp làm mát hyperboloid: xoay một đường cong bán kính quanh trục Y (hai mặt, không có nắp). */
export function hyperboloid(app, parent, p, m, { height = 22, base = 9.5, waist = 5.8, top = 6.8, waistAt = 0.7, rings = 14, segs = 28, inside = false, shadow = true } = {}) {
  const R = (t) => {
    if (t < waistAt) { const k = t / waistAt; return waist + (base - waist) * (1 - k) ** 2; }
    const k = (t - waistAt) / (1 - waistAt); return waist + (top - waist) * k ** 2;
  };
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, r = R(t), dr = (R(Math.min(1, t + 0.01)) - R(Math.max(0, t - 0.01))) / (0.02 * height);
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(r * c, t * height, r * s);
      const n = new pc.Vec3(c, -dr, s).normalize();
      if (inside) n.mulScalar(-1);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + segs + 1;
    if (inside) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(pos); mesh.setNormals(nor); mesh.setIndices(idx); mesh.update();
  const e = new pc.Entity();
  e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: shadow, receiveShadows: true });
  e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e);
  return e;
}

/** Tháp làm mát rỗng ruột: vỏ ngoài sáng, vỏ trong tối, vành miệng, bể nước dưới đáy. */
export function hollowTower(app, parent, p, M) {
  const g = new pc.Entity(); g.setLocalPosition(p[0], p[1], p[2]); parent.addChild(g);
  hyperboloid(app, g, [0, 0, 0], M.tower);
  hyperboloid(app, g, [0, 0.05, 0], M.towerIn, { base: 9.1, waist: 5.45, top: 6.45, inside: true, shadow: false });
  meshEnt(app, g, new pc.TorusGeometry({ ringRadius: 6.65, tubeRadius: 0.28, segments: 32, sides: 6 }), [0, 22, 0], M.metal);
  ent(g, 'cylinder', [0, 0.5, 0], [17.5, 0.3, 17.5], M.basin, false);
  for (let i = 0; i < 12; i++) { // chân cột chữ V quanh đế
    const a = (i / 12) * Math.PI * 2;
    ent(g, 'box', [Math.cos(a) * 9.4, 0.8, Math.sin(a) * 9.4], [0.5, 1.6, 0.5], M.metal);
  }
  return g;
}

/** Cột đèn đường: thân + bóng phát sáng (vật liệu dùng chung để bật/tắt theo đêm). */
export function lamp(parent, x, y, z, M) {
  ent(parent, 'cylinder', [x, y + 2.5, z], [0.18, 5, 0.18], M.metal);
  ent(parent, 'box', [x + 0.5, y + 5, z], [1.2, 0.15, 0.2], M.metal);
  ent(parent, 'sphere', [x + 1, y + 4.85, z], [0.45, 0.3, 0.45], M.bulb, false);
}

// ---------- Mô hình 3D tải từ file (thư mục public/models) ----------
const models = {}, waiting = [];
/** Tải một file GLB một lần; các chỗ đã dùng `model()` trước khi tải xong sẽ được thay hình ngay khi có. */
export function loadModel(app, name, url) {
  app.assets.loadFromUrl(url, 'container', (err, asset) => {
    if (err) { console.warn('Không tải được mô hình', url, err); return; }
    models[name] = asset;
    for (const w of waiting.filter((x) => x.name === name)) attach(w);
  });
}
function attach(w) {
  const e = models[w.name].resource.instantiateRenderEntity({ castShadows: true });
  e.setLocalScale(w.scale, w.scale, w.scale);
  e.setLocalEulerAngles(0, w.yaw, 0);
  w.holder.addChild(e);
  w.fallback?.destroy();
}
/** Gắn mô hình `name` vào `holder` (tỉ lệ, góc quay quanh Y). `fallback` là hình tạm hiển thị trong lúc chờ tải. */
export function model(holder, name, scale = 1, yaw = 0, fallback = null) {
  const w = { holder, name, scale, yaw, fallback };
  if (models[name]) attach(w); else waiting.push(w);
  return holder;
}
