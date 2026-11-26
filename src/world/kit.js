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

/** Bộ sinh số giả ngẫu nhiên có hạt giống, để thành phố trông giống nhau mỗi lần tải. */
export function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
