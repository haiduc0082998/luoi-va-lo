// Cảnh 3D bên trong một thành phố: phố xá, nhà, xe cộ, người đi bộ, máy bay, công trình dịch vụ, metro trên cao.
// Đặt ở toạ độ riêng (x = 1000) và chỉ bật khi người chơi "vào thành phố".
import * as pc from 'playcanvas';
import { N, SERVICES } from '../city.js';
import { clamp } from '../util.js';
import { col, mat, ent, beam, setBeam, lamp, seeded, model, modelParts, instanced } from './kit.js';

export const ORIGIN = new pc.Vec3(1000, 0, 0);
export const LOT = 14;
const HALF = (N - 1) / 2;
export const lotCenter = (i, j, out = new pc.Vec3()) => out.set(ORIGIN.x + (i - HALF) * LOT, 0, ORIGIN.z + (j - HALF) * LOT);
export function lotFromPoint(p) {
  const i = Math.round((p.x - ORIGIN.x) / LOT + HALF), j = Math.round((p.z - ORIGIN.z) / LOT + HALF);
  return i >= 0 && j >= 0 && i < N && j < N ? [i, j] : null;
}

export function createCityView(app, M) {
  const root = new pc.Entity('cityview'); root.enabled = false; app.root.addChild(root);
  const size = N * LOT + 40;
  const K = {
    asphalt: mat('#33373c', { gloss: 0.25 }), walk: mat('#b9bdb8', { gloss: 0.1 }), grass: mat('#6f9a5c', { gloss: 0.05 }),
    lane: mat('#f2f2f2', { emissive: '#555555', ei: 0.3 }), water: mat('#3f8fbf', { gloss: 0.9 }),
    beige: mat('#e2d3b1'), yellow: mat('#e8b923'), white: mat('#f4f5f2'), red: mat('#d63031'), blue: mat('#2d5d9f'),
    darkred: mat('#9c2a20'), glass: mat('#7fa6c4', { gloss: 0.8, metal: 0.3 }), track: mat('#9aa0a6', { metal: 0.5 }),
    person: ['#e17055', '#0984e3', '#fdcb6e', '#00b894', '#6c5ce7', '#2d3436'].map((c) => mat(c)),
    car: ['#c0392b', '#ecf0f1', '#2c3e50', '#2980b9', '#f1c40f', '#7f8c8d', '#16a085'].map((c) => mat(c, { gloss: 0.7, metal: 0.3 })),
    hl: mat('#000000', { emissive: '#fff2c0', ei: 0 }), ghostOk: M.ghostOk, ghostBad: M.ghostBad,
  };
  // Cửa sổ: hai vật liệu (nhà ở ấm, văn phòng lạnh) dùng chung kết cấu phát sáng
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const g2 = cv.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, 64, 128); g2.fillStyle = '#fff';
  for (let y = 5; y < 124; y += 9) for (let x = 4; x < 60; x += 9) if ((x * 5 + y * 11) % 7 < 5) g2.fillRect(x, y, 5, 5);
  const tex = new pc.Texture(app.graphicsDevice, { width: 64, height: 128, mipmaps: true }); tex.setSource(cv);
  const winMat = (hex, glow) => { const m = mat(hex); m.emissiveMap = tex; m.emissive = col(glow); m.update(); return m; };
  K.house = winMat('#c9b8a0', '#ffd38a'); K.tower = winMat('#7d96ad', '#cfe6ff');

  // Nền: mặt đường phủ toàn bộ, vỉa hè từng lô
  ent(root, 'box', [ORIGIN.x, -0.6, ORIGIN.z], [size + 60, 1, size + 60], K.grass, false);
  ent(root, 'box', [ORIGIN.x, -0.05, ORIGIN.z], [N * LOT + 6, 0.1, N * LOT + 6], K.asphalt, false);
  // 81 ô vỉa hè + 360 vạch kẻ đường: gộp tĩnh thành vài lưới (trước đây mỗi khối một lệnh vẽ)
  const ground = new pc.Entity('city-ground'); root.addChild(ground);
  const c = new pc.Vec3();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { lotCenter(i, j, c); ent(ground, 'box', [c.x, 0.12, c.z], [LOT - 3.6, 0.24, LOT - 3.6], K.walk, false); }
  for (let k = 0; k <= N; k++) {
    const o = (k - HALF - 0.5) * LOT;
    for (let s = -N / 2; s < N / 2; s += 0.5) {
      ent(ground, 'box', [ORIGIN.x + o, 0.02, ORIGIN.z + s * LOT + 3], [0.25, 0.04, 3], K.lane, false);
      ent(ground, 'box', [ORIGIN.x + s * LOT + 3, 0.02, ORIGIN.z + o], [3, 0.04, 0.25], K.lane, false);
    }
  }
  { const gg = app.batcher.addGroup('city-ground', false, 60); for (const r of ground.findComponents('render')) r.batchGroupId = gg.id; }

  // ---------- Nội dung từng lô (dựng lại khi thành phố thay đổi) ----------
  let lotsRoot = null, metroRoot = null, trains = [];
  // Nhà cửa, đường ray, trụ metro là vật tĩnh: gộp thành vài lưới lớn theo vùng 48 × 48 (BatchManager),
  // hàng trăm khối hộp chỉ còn vài chục lệnh vẽ; mỗi vùng vẫn được loại khi ngoài khung nhìn.
  const batch = app.batcher.addGroup('city-static', false, 48);
  const batchAll = (root0) => { for (const r of root0.findComponents('render')) r.batchGroupId = batch.id; };
  const box = (p, s, m, sh = true) => ent(lotsRoot, 'box', p, s, m, sh);
  const BUILD = {
    res(x, z, l, r) {
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const w = 3 + r() * 1.5, h = (4 + l.h * 14 * (0.6 + r() * 0.6)) * hMul, dx = ((k % 2) - 0.5) * 5, dz = (Math.floor(k / 2) - 0.5) * 5;
        box([x + dx, h / 2 + 0.24, z + dz], [w, h, w], K.house);
      }
    },
    com(x, z, l, r) {
      const h = (14 + l.h * 40 * (0.7 + r() * 0.5)) * hMul;
      box([x, h / 2 + 0.24, z], [7, h, 7], K.tower);
      box([x, h + 0.7, z], [4, 1.2, 4], M.metal);
      if (r() < 0.5) box([x + 3, 3, z + 3], [4, 6, 4], K.glass);
    },
    empty(x, z) { box([x, 0.3, z], [LOT - 4.2, 0.1, LOT - 4.2], K.grass, false); },
    school(x, z) {
      box([x - 1.5, 2.2, z - 2], [7, 4.4, 3.5], K.beige); box([x + 2.6, 2.2, z + 0.5], [3, 4.4, 6], K.beige);
      box([x - 1.5, 4.6, z - 2], [7.4, 0.4, 3.9], K.yellow);
      box([x - 1.5, 0.32, z + 2.6], [6, 0.08, 4], K.grass, false);
      ent(lotsRoot, 'cylinder', [x - 4.5, 3.5, z + 4], [0.12, 7, 0.12], M.metal); box([x - 3.9, 6.6, z + 4], [1.2, 0.8, 0.05], K.red, false);
    },
    hospital(x, z) {
      box([x, 4, z], [9, 8, 7], K.white);
      box([x, 8.3, z], [1, 0.4, 3.2], K.red, false); box([x, 8.3, z], [3.2, 0.4, 1], K.red, false);
      box([x, 0.3, z + 4.6], [8, 0.1, 1.6], K.red, false);
    },
    police(x, z) {
      box([x, 2.5, z - 1], [8, 5, 5], K.white); box([x, 5.1, z - 1], [8.2, 0.4, 5.2], K.blue);
      for (const dx of [-2.5, 2.5]) { box([x + dx, 0.9, z + 3.6], [1.8, 1.1, 3.4], K.white); box([x + dx, 1.6, z + 3.6], [1.6, 0.2, 0.6], K.blue, false); }
    },
    fire(x, z) {
      box([x, 3, z], [9, 6, 6], K.red); for (const dx of [-2.6, 0, 2.6]) box([x + dx, 2, z + 3.05], [2.2, 3.4, 0.1], K.darkred, false);
      box([x + 3.8, 6, z - 2], [1.6, 12, 1.6], K.red);
    },
    park(x, z, l, r) {
      box([x, 0.32, z], [LOT - 4.2, 0.12, LOT - 4.2], K.grass, false);
      ent(lotsRoot, 'cylinder', [x + 1.5, 0.4, z + 1.5], [4.5, 0.1, 3.5], K.water, false);
      for (let k = 0; k < 5; k++) { const tx = x + (r() - 0.5) * 8, tz = z + (r() - 0.5) * 8; ent(lotsRoot, 'cone', [tx, 2.2, tz], [2, 3.4, 2], M.leaf); ent(lotsRoot, 'cylinder', [tx, 0.6, tz], [0.3, 1.2, 0.3], M.trunk); }
      lamp(lotsRoot, x - 4, 0.2, z - 4, M);
    },
    bank(x, z) { // ngân hàng: nhà cột kiểu cổ điển, mái vàng
      box([x, 0.6, z], [10, 1.2, 8], K.white);
      box([x, 4.6, z - 0.6], [8.6, 6.8, 5.6], K.white);
      for (let k = -3; k <= 3; k += 1.5) ent(lotsRoot, 'cylinder', [x + k, 4.4, z + 2.8], [0.6, 6.4, 0.6], K.white);
      box([x, 8.2, z + 0.4], [9.6, 0.6, 7.6], K.yellow); box([x, 9, z + 0.4], [7, 1, 5.5], K.yellow);
      box([x, 1.6, z + 3.9], [2, 2, 0.1], K.glass, false);
    },
    tv(x, z) { // đài truyền hình: toà nhà + tháp ăng-ten sọc đỏ trắng, đèn đỉnh nhấp nháy
      box([x - 2, 3, z + 1.5], [6, 6, 6], K.blue); box([x - 2, 6.2, z + 1.5], [6.2, 0.4, 6.2], M.metal);
      for (let k = 0; k < 8; k++) ent(lotsRoot, 'cylinder', [x + 3, 2 + k * 3.6, z - 3], [1.4 - k * 0.12, 3.6, 1.4 - k * 0.12], k % 2 ? K.white : K.red);
      ent(lotsRoot, 'sphere', [x + 3, 31, z - 3], [1, 1, 1], K.red, false);
      ent(lotsRoot, 'cylinder', [x - 2, 7.4, z + 1.5], [3, 0.3, 3], M.metal);
    },
    station(x, z) {
      box([x, 1.5, z + 3], [4, 3, 3], K.glass); box([x, 3.2, z + 3], [4.4, 0.3, 3.4], M.metal);
      for (const dx of [-4, 4]) ent(lotsRoot, 'cylinder', [x + dx, 3.5, z], [0.6, 7, 0.6], K.track);
      box([x, 7.2, z], [11, 0.6, 4.2], K.track); box([x, 9.2, z], [11, 0.25, 4.6], K.glass, false);
    },
  };

  let hMul = 1;
  function rebuild(C) {
    lotsRoot?.destroy(); metroRoot?.destroy();
    lotsRoot = new pc.Entity(); root.addChild(lotsRoot);
    metroRoot = new pc.Entity(); root.addChild(metroRoot);
    const r = seeded(`view-${C.id}`), p = new pc.Vec3();
    for (const l of C.lots) { lotCenter(l.i, l.j, p); BUILD[l.type](p.x, p.z, l, r); }
    batchAll(lotsRoot);
    // Tuyến metro trên cao: dầm + trụ, mỗi tuyến hai đoàn tàu chạy đi về
    trains = [];
    for (const line of C.lines) {
      if (line.stops.length < 2) continue;
      const pts = line.stops.map((k) => { const l = C.lots[k]; return lotCenter(l.i, l.j).add(new pc.Vec3(0, 7.6, 0)); });
      const lm = mat(line.color, { emissive: line.color, ei: 0.35 });
      for (let n = 0; n < pts.length - 1; n++) {
        const a = pts[n], b = pts[n + 1], len = a.distance(b);
        beam(metroRoot, a, b, 1, K.track).setLocalScale(2.4, 0.7, len);
        beam(metroRoot, a.clone().add(new pc.Vec3(0, 0.45, 0)), b.clone().add(new pc.Vec3(0, 0.45, 0)), 1, lm, false).setLocalScale(0.5, 0.15, len);
        for (let s = 6; s < len - 3; s += 7) { const q = new pc.Vec3().lerp(a, b, s / len); ent(metroRoot, 'cylinder', [q.x, 3.6, q.z], [0.8, 7.2, 0.8], K.track); }
      }
      batchAll(metroRoot); // ray + trụ (trước khi thêm tàu: tàu chạy nên không gộp)
      for (let t = 0; t < 2; t++) {
        const tr = new pc.Entity(); metroRoot.addChild(tr);
        for (let car = 0; car < 3; car++) ent(tr, 'box', [0, 1.3, (car - 1) * 3.4], [2, 1.8, 3.2], lm);
        trains.push({ e: tr, pts, u: t * 0.5, dir: t ? -1 : 1 });
      }
    }
  }

  // ---------- Xe cộ & người đi bộ (bể đối tượng) ----------
  const streets = Array.from({ length: N + 1 }, (_, k) => (k - HALF - 0.5) * LOT);
  // Vẽ bằng GPU instancing: thân xe của cả 80 chiếc = 1 lệnh vẽ, sơn mỗi màu 1 lệnh, đèn pha 1 lệnh; người đi bộ tương tự.
  // Mỗi xe / người chỉ còn là một thực thể giữ vị trí (không có render); mỗi khung hình gom ma trận rồi vẽ một lượt.
  const crowd = new pc.Entity('crowd'); root.addChild(crowd);
  const boxMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry());
  const cars = Array.from({ length: 80 }, (_, i) => {
    const e = new pc.Entity(); root.addChild(e);
    return { e, c: i % K.car.length, axis: i % 2, line: streets[i % (N + 1)], lane: i % 4 < 2 ? 1 : -1, u: (i * 37) % 130 - 65, v: 6 + (i % 5) };
  });
  const people = Array.from({ length: 110 }, (_, i) => {
    const e = new pc.Entity(); root.addChild(e);
    const li = i % N, lj = Math.floor(i / N) % N;
    return { e, woman: i % 2 === 1, c: i % K.person.length, li, lj, u: (i * 0.37) % 1, v: 0.03 + (i % 7) * 0.006, side: i % 4 };
  });
  const TMP = new pc.Mat4(), TMP2 = new pc.Mat4();
  const mk = (pos, scl) => new pc.Mat4().setTRS(new pc.Vec3(...pos), pc.Quat.IDENTITY, new pc.Vec3(...scl));
  // Bộ vẽ: trước khi mô hình tải xong dùng khối hộp màu (sets[k].local = biến đổi trong không gian của một cá thể)
  const set = (mesh, material, local, max = 120) => ({ ...instanced(app, crowd, mesh, material, max), local });
  const carSets = { body: K.car.map((m) => set(boxMesh, m, mk([0, 0.75, 0], [1.6, 0.9, 3.2]))), paint: [], hl: set(boxMesh, K.hl, mk([0, 0.43, -1.66], [0.95, 0.1, 0.05])) };
  carSets.hl.mi.castShadow = false;
  modelParts('car', (parts) => { // ô tô từ macro FreeCAD (dài 4,5 m), tỉ lệ 0,72
    const S = mk([0, 0, 0], [0.72, 0.72, 0.72]), body = parts.find((p) => p.name === 'Body'), pt = parts.find((p) => p.name === 'Paint');
    carSets.body.forEach((st) => st.e.destroy());
    const bodySet = set(body.mesh, body.material, new pc.Mat4().mul2(S, body.local));
    carSets.body = K.car.map(() => null); carSets.body[0] = bodySet; carSets.sharedBody = bodySet;
    carSets.paint = K.car.map((m) => set(pt.mesh, m, new pc.Mat4().mul2(S, pt.local)));
  });
  const pplSets = { man: { body: null, top: [] }, woman: { body: null, top: [] }, box: K.person.map((m) => set(boxMesh, m, mk([0, 0.7, 0], [0.5, 1.4, 0.5]))) };
  pplSets.box.forEach((st) => (st.mi.castShadow = false));
  for (const [g, name, sc, top] of [['man', 'man', 0.8, 'Shirt'], ['woman', 'woman', 0.85, 'Top']]) {
    modelParts(name, (parts) => {
      const S = mk([0, 0, 0], [sc, sc, sc]), body = parts.find((p) => p.name === 'Body'), t = parts.find((p) => p.name === top);
      pplSets[g].body = set(body.mesh, body.material, new pc.Mat4().mul2(S, body.local));
      pplSets[g].top = K.person.map((m) => set(t.mesh, m, new pc.Mat4().mul2(S, t.local)));
    });
  }
  function drawCrowd() {
    const push = (st, W) => st && st.push(TMP2.mul2(W, st.local));
    for (const c of cars) {
      if (!c.e.enabled) continue;
      const W = TMP.copy(c.e.getWorldTransform());
      if (carSets.sharedBody) { push(carSets.sharedBody, W); push(carSets.paint[c.c], W); } else push(carSets.body[c.c], W);
      push(carSets.hl, W);
    }
    for (const w of people) {
      if (!w.e.enabled) continue;
      const W = TMP.copy(w.e.getWorldTransform()), g = pplSets[w.woman ? 'woman' : 'man'];
      if (g.body) { push(g.body, W); push(g.top[w.c], W); } else push(pplSets.box[w.c], W);
    }
    for (const st of [...carSets.body, carSets.sharedBody, ...carSets.paint, carSets.hl, ...pplSets.box, pplSets.man.body, ...pplSets.man.top, pplSets.woman.body, ...pplSets.woman.top]) st?.commit();
  }
  // Máy bay bay ngang thành phố
  const planes = [0, 1].map((k) => {
    const p = new pc.Entity(); root.addChild(p);
    const tmp = new pc.Entity(); p.addChild(tmp);
    ent(tmp, 'cylinder', [0, 0, 0], [1.2, 9, 1.2], K.white).setLocalEulerAngles(90, 0, 0);
    ent(tmp, 'box', [0, 0, 0.4], [11, 0.2, 2], K.white);
    model(p, 'b737', 0.32, 180, tmp); // Boeing 737-800 từ thư mục models
    return { p, a: k * Math.PI };
  });

  const P = new pc.Vec3(), Q = new pc.Vec3();
  let current = null, version = -1;
  function update(G, C, dt, day) {
    if (!root.enabled) return;
    if (C !== current || G.cityVersion !== version) {
      current = C; version = G.cityVersion;
      hMul = 1 + 0.25 * ((G.net.nodes.find((x) => x.id === C.id)?.lv ?? 1) - 1); // thành phố nâng cấp: nhà cao hơn
      rebuild(C);
    }
    const lit = (G.net.nodes.find((n) => n.id === C.id)?.frac ?? 0);
    K.house.emissiveIntensity = lit * (0.2 + 1.5 * (1 - day)); K.house.update();
    K.tower.emissiveIntensity = lit * (0.3 + 1.6 * (1 - day)); K.tower.update();
    K.hl.emissiveIntensity = (1 - day) * 2.5; K.hl.update();
    // Xe: số lượng và tốc độ theo tắc đường
    const active = Math.min(Math.round(cars.length * density), C.cars), slow = 1 / (1 + 1.6 * C.congestion);
    cars.forEach((c, i) => {
      c.e.enabled = i < active;
      if (!c.e.enabled) return;
      c.u += c.v * slow * c.lane * dt * 2.2;
      const lim = (N * LOT) / 2 + 2;
      if (c.u > lim) c.u = -lim; if (c.u < -lim) c.u = lim;
      const off = c.lane * 1.3;
      if (c.axis) { c.e.setPosition(ORIGIN.x + c.line + off, 0, ORIGIN.z + c.u); c.e.setEulerAngles(0, c.lane > 0 ? 180 : 0, 0); }
      else { c.e.setPosition(ORIGIN.x + c.u, 0, ORIGIN.z + c.line - off); c.e.setEulerAngles(0, c.lane > 0 ? -90 : 90, 0); }
    });
    // Người đi bộ vòng quanh vỉa hè của lô
    for (const w of people) {
      if (!w.e.enabled) continue;
      w.u = (w.u + w.v * dt) % 1;
      lotCenter(w.li, w.lj, P);
      const e = (LOT - 4.6) / 2, t = w.u * 4, s = Math.floor(t), f = t - s;
      const corners = [[-e, -e], [e, -e], [e, e], [-e, e]], a = corners[s], b = corners[(s + 1) % 4];
      w.e.setPosition(P.x + a[0] + (b[0] - a[0]) * f, Math.abs(Math.sin(G.t * 3 + w.u * 50)) * 0.06, P.z + a[1] + (b[1] - a[1]) * f);
      w.e.setEulerAngles(0, (Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) * 180) / Math.PI, 0); // mặt nhìn theo hướng đi
    }
    drawCrowd();
    // Tàu metro
    for (const t of trains) {
      const segs = t.pts.length - 1;
      t.u += t.dir * dt * 0.12 / Math.max(1, segs * 0.6);
      if (t.u > 1 || t.u < 0) { t.dir *= -1; t.u = clamp(t.u, 0, 1); }
      const f = t.u * segs, k = Math.min(segs - 1, Math.floor(f));
      P.lerp(t.pts[k], t.pts[k + 1], f - k);
      t.e.setPosition(P);
      Q.sub2(t.pts[k + 1], t.pts[k]);
      t.e.setEulerAngles(0, (Math.atan2(Q.x, Q.z) * 180) / Math.PI, 0);
    }
    for (const pl of planes) {
      pl.a += dt * 0.12;
      pl.p.setPosition(ORIGIN.x + Math.cos(pl.a) * 75, 40 + Math.sin(pl.a * 3) * 4, ORIGIN.z + Math.sin(pl.a) * 55);
      pl.p.setEulerAngles(0, (-pl.a * 180) / Math.PI, -15);
    }
  }

  // Ô chọn / bóng ma khi xây
  const ghost = ent(root, 'box', [0, -10, 0], [LOT - 3, 0.6, LOT - 3], K.ghostOk, false);
  function setGhost(lot, ok) {
    ghost.enabled = !!lot;
    if (!lot) return;
    lotCenter(lot[0], lot[1], P);
    ghost.render.meshInstances[0].material = ok ? K.ghostOk : K.ghostBad;
    ghost.setPosition(P.x, 0.5, P.z);
  }
  void setBeam; void SERVICES;
  let density = 1;
  /** Mật độ xe và người đi bộ (1 = đủ, 0,5 = một nửa ở đồ hoạ thấp). */
  function setDensity(k) {
    density = k;
    people.forEach((w, i) => (w.e.enabled = i < people.length * k));
  }
  return { root, update, setGhost, setDensity, show: (on) => (root.enabled = on) };
}
