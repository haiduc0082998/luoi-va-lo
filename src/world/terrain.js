// Địa hình low-poly (đổ bóng phẳng, tô màu theo độ cao) và mặt nước sông.
import * as pc from 'playcanvas';
import { height, MAP_HALF, WATER_Y } from '../map.js';

const STEPS = 72;

function colorFor(y, slope) {
  if (y < -1.4) return [176, 160, 120];                   // lòng sông cát
  if (y > 16) return [236, 240, 240];                     // tuyết
  if (y > 9 || slope > 0.7) return [128, 128, 118];       // đá
  const t = Math.min(1, Math.max(0, (y + 1) / 9));
  return [Math.round(96 - 20 * t), Math.round(140 - 25 * t), Math.round(82 - 10 * t)];
}

export function buildTerrain(app, parent) {
  const size = MAP_HALF * 2, step = size / STEPS;
  const positions = [], normals = [], colors = [];
  const P = (i, j) => { const x = -MAP_HALF + i * step, z = -MAP_HALF + j * step; return [x, height(x, z), z]; };
  const a = new pc.Vec3(), b = new pc.Vec3(), n = new pc.Vec3();
  const tri = (p0, p1, p2) => {
    a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    n.cross(a, b).normalize();
    if (n.y < 0) n.mulScalar(-1);
    const y = (p0[1] + p1[1] + p2[1]) / 3, c = colorFor(y, 1 - n.y);
    for (const p of [p0, p1, p2]) { positions.push(...p); normals.push(n.x, n.y, n.z); colors.push(...c, 255); }
  };
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      tri(p00, p01, p10); tri(p10, p01, p11);
    }
  }
  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setColors32(colors);
  mesh.setIndices([...Array(positions.length / 3).keys()]);
  mesh.update();

  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(1, 1, 1); mat.diffuseVertexColor = true; mat.gloss = 0.1; mat.useMetalness = true; mat.metalness = 0;
  mat.update();
  const e = new pc.Entity('terrain');
  e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, mat)], castShadows: true, receiveShadows: true });
  parent.addChild(e);

  const wmat = new pc.StandardMaterial();
  wmat.diffuse = new pc.Color().fromString('#2a6d93'); wmat.gloss = 0.9; wmat.opacity = 0.88;
  wmat.blendType = pc.BLEND_NORMAL; wmat.depthWrite = false; wmat.useMetalness = true; wmat.metalness = 0.1;
  wmat.update();
  const water = new pc.Entity('water');
  water.addComponent('render', { type: 'plane', material: wmat, castShadows: false });
  water.setLocalPosition(0, WATER_Y, 0); water.setLocalScale(size, 1, size);
  parent.addChild(water);
  return e;
}

/** Giao tia với địa hình bằng cách bước dọc tia rồi tinh chỉnh nhị phân. */
export function rayTerrain(origin, dir, out) {
  let prev = 0;
  for (let t = 0; t < 900; t += 1.5) {
    const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
    if (Math.abs(x) > MAP_HALF || Math.abs(z) > MAP_HALF) { if (t > 50 && y < 0) return null; prev = t; continue; }
    if (y <= height(x, z)) {
      let lo = prev, hi = t;
      for (let k = 0; k < 12; k++) {
        const m = (lo + hi) / 2, mx = origin.x + dir.x * m, mz = origin.z + dir.z * m;
        if (origin.y + dir.y * m <= height(mx, mz)) hi = m; else lo = m;
      }
      return out.set(origin.x + dir.x * hi, origin.y + dir.y * hi, origin.z + dir.z * hi);
    }
    prev = t;
  }
  return null;
}
