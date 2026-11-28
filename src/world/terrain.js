// Địa hình mịn liền mạch (lưới dùng chung đỉnh, pháp tuyến mượt theo độ dốc thật, màu chuyển dần) và mặt nước sông.
import * as pc from 'playcanvas';
import { height, MAP_HALF, WATER_Y, BORDER_X } from '../map.js';
import { seeded } from '../rng.js';

const STEPS = 190; // bản đồ 380 × 380: mỗi ô 2 đơn vị; 191² ≈ 36 nghìn đỉnh dùng chung (chỉ số 16 bit)

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const SAND = [176, 160, 120], GRASS_LO = [98, 142, 82], GRASS_HI = [76, 115, 70], DRY = [128, 132, 92], ROCK = [124, 122, 114], SNOW = [236, 240, 242];

/** Màu đất theo độ cao y, độ dốc (0 phẳng – 1 dựng đứng) và nhiễu nhỏ n (−1..1), chuyển dần giữa các vùng. */
function colorFor(y, slope, n) {
  let c = mix(GRASS_LO, GRASS_HI, smooth(-1, 8, y));
  c = mix(c, DRY, smooth(5, 10, y + n * 1.5) * 0.6);          // cỏ khô trên cao
  c = mix(c, ROCK, Math.max(smooth(8, 12, y + n), smooth(0.45, 0.75, slope + n * 0.05))); // đá: cao hoặc dốc
  c = mix(c, SNOW, smooth(15, 19, y + n * 1.5));               // tuyết trên đỉnh
  c = mix(c, SAND, smooth(-0.6, -1.6, y));                      // bãi cát / lòng sông
  const k = 1 + n * 0.05;                                       // loang lổ nhẹ cho tự nhiên
  return [c[0] * k, c[1] * k, c[2] * k];
}

export function buildTerrain(app, parent) {
  const size = MAP_HALF * 2, step = size / STEPS, V = STEPS + 1;
  const positions = new Float32Array(V * V * 3), normals = new Float32Array(V * V * 3), colors = new Uint8ClampedArray(V * V * 4);
  const rnd = seeded('terrain-tint'), ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const noise = (x, z) => 0.5 * Math.sin(x * 0.13 + ph[0]) * Math.cos(z * 0.11 + ph[1]) + 0.5 * Math.sin((x + z) * 0.041 + ph[2]);
  const H = 0.75; // bước sai phân trung tâm để tính pháp tuyến từ chính hàm độ cao (mượt, không phụ thuộc lưới)
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = j * V + i, x = -MAP_HALF + i * step, z = -MAP_HALF + j * step, y = height(x, z);
      positions[k * 3] = x; positions[k * 3 + 1] = y; positions[k * 3 + 2] = z;
      const dx = (height(x + H, z) - height(x - H, z)) / (2 * H), dz = (height(x, z + H) - height(x, z - H)) / (2 * H);
      const L = Math.hypot(dx, 1, dz), ny = 1 / L;
      normals[k * 3] = -dx / L; normals[k * 3 + 1] = ny; normals[k * 3 + 2] = -dz / L;
      let c = colorFor(y, 1 - ny, noise(x, z));
      // Đất nước láng giềng ngả vàng khô, chuyển dần qua dải biên giới 8 đơn vị
      const f = smooth(BORDER_X - 4, BORDER_X + 4, x);
      if (f > 0) c = mix(c, [c[0] + 34, c[1] + 14, c[2] - 8], f);
      colors[k * 4] = c[0]; colors[k * 4 + 1] = c[1]; colors[k * 4 + 2] = c[2]; colors[k * 4 + 3] = 255;
    }
  }
  const indices = new Uint16Array(STEPS * STEPS * 6);
  let o = 0;
  for (let j = 0; j < STEPS; j++) {
    for (let i = 0; i < STEPS; i++) {
      const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
      // chia ô theo đường chéo ít gập hơn để sườn đồi không bị răng cưa
      if (Math.abs(positions[a * 3 + 1] - positions[d * 3 + 1]) < Math.abs(positions[b * 3 + 1] - positions[c * 3 + 1])) {
        indices.set([a, c, d, a, d, b], o);
      } else {
        indices.set([a, c, b, b, c, d], o);
      }
      o += 6;
    }
  }
  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setColors32(colors);
  mesh.setIndices(indices);
  mesh.update();

  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(1, 1, 1); mat.diffuseVertexColor = true; mat.gloss = 0.1; mat.useMetalness = true; mat.metalness = 0;
  mat.update();
  const e = new pc.Entity('terrain');
  e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, mat)], castShadows: true, receiveShadows: true });
  parent.addChild(e);

  const wmat = new pc.StandardMaterial();
  wmat.diffuse = new pc.Color().fromString('#2a6d93'); wmat.gloss = 0.92; wmat.opacity = 0.86;
  wmat.blendType = pc.BLEND_NORMAL; wmat.depthWrite = false; wmat.useMetalness = true; wmat.metalness = 0.15;
  // Gợn sóng: hai lớp normal map dựng bằng code, trôi theo hai hướng khác nhau (xem animateWater)
  const waves = waveNormalTexture(app);
  wmat.normalMap = waves; wmat.normalMapTiling = new pc.Vec2(18, 18); wmat.bumpiness = 0.55;
  wmat.normalDetailMap = waves; wmat.normalDetailMapTiling = new pc.Vec2(47, 47); wmat.normalDetailMapBumpiness = 0.5;
  wmat.update();
  waterMat = wmat;
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

let waterMat = null;
/** Cho mặt nước trôi: gọi mỗi khung hình với thời gian thực (giây) và tốc độ gió (m/s). */
export function animateWater(t, wind = 5) {
  if (!waterMat) return;
  const v = 0.004 + wind * 0.0012;
  waterMat.normalMapOffset.set(t * v, t * v * 0.6);
  waterMat.normalDetailMapOffset.set(-t * v * 0.8, t * v * 1.1);
  waterMat.bumpiness = 0.35 + Math.min(wind, 25) * 0.03;
  waterMat.update();
}

/** Normal map lặp liền mạch 128×128 từ tổng các sóng sin (hướng và bước sóng ngẫu nhiên cố định). */
function waveNormalTexture(app) {
  const N = 128, h = new Float32Array(N * N), rnd = seeded('waves');
  const waves = Array.from({ length: 9 }, () => ({ kx: Math.round(rnd() * 8 - 4) || 1, kz: Math.round(rnd() * 8 - 4), a: 0.4 + rnd(), p: rnd() * 6.283 }));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    for (const w of waves) v += (w.a * Math.sin(((w.kx * i + w.kz * j) / N) * 6.283 + w.p)) / Math.hypot(w.kx, w.kz);
    h[j * N + i] = v;
  }
  const data = new Uint8Array(N * N * 4), at = (i, j) => h[((j + N) % N) * N + ((i + N) % N)];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * 2, dz = (at(i, j + 1) - at(i, j - 1)) * 2, L = Math.hypot(dx, dz, 1), o = (j * N + i) * 4;
    data[o] = ((-dx / L) * 0.5 + 0.5) * 255; data[o + 1] = ((-dz / L) * 0.5 + 0.5) * 255; data[o + 2] = ((1 / L) * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const tex = new pc.Texture(app.graphicsDevice, { width: N, height: N, format: pc.PIXELFORMAT_RGBA8, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT, name: 'waves' });
  tex.lock().set(data); tex.unlock();
  return tex;
}
