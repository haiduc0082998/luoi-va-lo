// Giai đoạn 6 – hình 3D: trại gió, mỏ, hạ tầng giao thông (cao tốc + xe tải, cảng + tàu, sân bay + máy bay),
// tháp làm mát phụ, và thời tiết (mây, mưa, chớp sét).
import * as pc from 'playcanvas';
import { clamp } from '../util.js';
import { RATED } from '../physics/reactor.js';
import { riverCenter, height, WATER_Y } from '../map.js';
import { WEATHERS } from '../weather.js';
import { col, mat, ent, beam, hollowTower, lamp, seeded, model } from './kit.js';

export const INFRA_PICK = { tower: 10, road: 6, port: 9, airport: 14 };

export function createInfra(app, world, M, emit, groundY) {
  const Mx = {
    blade: mat('#f2f4f3', { gloss: 0.5 }), asphalt: mat('#2a2d31', { gloss: 0.2 }), stripe: mat('#e9d27a', { emissive: '#5a4a10', ei: 0.4 }),
    truck: mat('#d9482b'), truck2: mat('#e0a32a'), hull: mat('#1d3557'), deck: mat('#b0412f'),
    containers: ['#c0392b', '#2471a3', '#d4ac0d', '#27ae60'].map((c) => mat(c)), crane: mat('#f39c12', { metal: 0.4 }),
    pit: mat('#6e5440', { gloss: 0.05 }), pit2: mat('#584334', { gloss: 0.05 }), plane: mat('#f4f6f8', { gloss: 0.6 }), tail: mat('#2e86de'),
    runwayLight: mat('#202020', { emissive: '#7fd6ff', ei: 0 }),
  };

  // ---------- Nút lưới mới: trại gió, mỏ ----------
  const nodeBuilders = {
    wind(n, g) {
      const rotors = [[-7, -5], [6, -3], [0, 8]].map(([dx, dz]) => {
        const y = groundY(n.x + dx, n.z + dz) - groundY(n.x, n.z);
        ent(g, 'cylinder', [dx, y + 8, dz], [0.7, 16, 0.7], Mx.blade);
        ent(g, 'box', [dx, y + 16.2, dz], [1, 1, 2.2], Mx.blade);
        const rotor = new pc.Entity(); rotor.setLocalPosition(dx, y + 16.2, dz - 1.2); g.addChild(rotor);
        for (let i = 0; i < 3; i++) {
          const pv = new pc.Entity(); pv.setLocalEulerAngles(0, 0, i * 120); rotor.addChild(pv);
          ent(pv, 'box', [0, 3.4, 0], [0.45, 6.8, 0.12], Mx.blade);
        }
        return rotor;
      });
      g.setLocalPosition(n.x, groundY(n.x, n.z), n.z);
      let a = 0;
      return (G, dt) => {
        const on = n.state === 'ok' && G.windNow >= 3 && G.windNow <= 25;
        a += (on ? 40 + G.windNow * 14 : 0) * dt;
        rotors.forEach((r, i) => r.setLocalEulerAngles(0, 0, -(a + i * 37)));
      };
    },
    mine(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      for (let i = 0; i < 3; i++) ent(g, 'cylinder', [-6, 0.1 - i * 0.6, 0], [18 - i * 5, 0.6, 14 - i * 4], i % 2 ? Mx.pit2 : Mx.pit, false);
      const V = (x, y, z) => new pc.Vec3(n.x + x, y0 + y, n.z + z);
      for (const [x, z] of [[6, -2], [10, -2], [6, 2], [10, 2]]) beam(g, V(x, 0, z), V(8, 14, 0), 0.35, M.metal);
      ent(g, 'cylinder', [8, 14.3, 0], [2.6, 0.5, 2.6], M.metal);
      ent(g, 'box', [12, 2.5, 7], [7, 5, 5], M.concrete);
      beam(g, V(-6, 1, 0), V(10, 6, 6), 0.8, Mx.truck2);
      const truck = ent(g, 'box', [0, 1, 0], [2.2, 1.6, 3.4], Mx.truck2);
      let t = 0;
      return (G, dt) => {
        t += dt * 0.6 * n.frac;
        truck.setLocalPosition(-6 + Math.cos(t) * 6.5, 0.2, Math.sin(t) * 4.8);
        truck.setLocalEulerAngles(0, (-t * 180) / Math.PI, 0);
      };
    },
  };

  // ---------- Công trình không thuộc lưới ----------
  const infraBuilders = {
    tower(s, g) {
      const y = groundY(s.x, s.z);
      hollowTower(app, g, [s.x, y - 0.4, s.z], M);
      let acc = 0;
      return (G, dt) => {
        const pe = (G.reactor.Pe + (G.reactor2?.Pe ?? 0)) / (0.33 * RATED);
        acc += dt * 2.5 * clamp(pe, 0, 2);
        while (acc >= 1) { acc -= 1; emit(s.x, y + 20, s.z, '#f3f5f4', 5, 9); }
      };
    },
    road(s, g) {
      // Đường bám địa hình: 8 đoạn theo hướng về thành phố gần nhất
      const L = 46, segs = 8, dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
      const pts = Array.from({ length: segs + 1 }, (_, i) => {
        const k = i / segs - 0.5, x = s.x + dx * k * L, z = s.z + dz * k * L;
        return new pc.Vec3(x, Math.max(groundY(x, z), WATER_Y + 1.6) + 0.25, z);
      });
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[i + 1];
        const e = beam(g, a, b, 1, Mx.asphalt, false); e.setLocalScale(6, 0.4, a.distance(b) + 0.2);
        const st = beam(g, a, b, 1, Mx.stripe, false); st.setLocalScale(0.3, 0.45, a.distance(b) * 0.55);
      }
      const trucks = [0, 0.35, 0.7].map((u, i) => ({ e: ent(g, 'box', [0, 0, 0], [1.9, 1.7, 4], i % 2 ? Mx.truck2 : Mx.truck), u, dir: i % 2 ? -1 : 1 }));
      const P = new pc.Vec3();
      return (G, dt) => {
        const mine = G.net.nodes.find((n) => n.id === 'mine');
        const v = 0.05 * (0.3 + (mine?.frac ?? 0));
        for (const t of trucks) {
          t.u += v * t.dir * dt;
          if (t.u > 1 || t.u < 0) { t.dir *= -1; t.u = clamp(t.u, 0, 1); }
          const f = t.u * segs, i = Math.min(segs - 1, Math.floor(f));
          P.lerp(pts[i], pts[i + 1], f - i);
          t.e.setPosition(P.x + dz * 1.4 * t.dir, P.y + 1.1, P.z - dx * 1.4 * t.dir);
          t.e.setEulerAngles(0, (s.yaw * 180) / Math.PI + (t.dir < 0 ? 180 : 0), 0);
        }
      };
    },
    port(s, g) {
      const y = Math.max(groundY(s.x, s.z), WATER_Y);
      const side = Math.sign(s.x - riverCenter(s.z)) || 1;
      const qx = riverCenter(s.z) + side * 4.5;
      ent(g, 'box', [qx + side * 2, WATER_Y + 1, s.z], [6, 2.4, 18], M.concrete);
      ent(g, 'box', [s.x + side * 2, y + 1, s.z], [8, 2, 16], M.concrete);
      const r = seeded(s.id);
      for (let i = 0; i < 10; i++) ent(g, 'box', [s.x + side * (1 + (i % 2) * 2.6), y + 2.6 + Math.floor(i / 5) * 1.3, s.z - 6 + (i % 5) * 3], [2.4, 1.2, 2.6], Mx.containers[Math.floor(r() * 4)]);
      const V = (x, yy, z) => new pc.Vec3(x, yy, z);
      for (const dz of [-3, 3]) {
        beam(g, V(qx, WATER_Y + 2, s.z + dz), V(qx, WATER_Y + 13, s.z + dz), 0.45, Mx.crane);
        beam(g, V(qx + side * 6, WATER_Y + 2, s.z + dz), V(qx + side * 6, WATER_Y + 13, s.z + dz), 0.45, Mx.crane);
      }
      beam(g, V(qx - side * 7, WATER_Y + 13, s.z), V(qx + side * 8, WATER_Y + 13, s.z), 0.7, Mx.crane);
      const ship = new pc.Entity(); g.addChild(ship);
      ent(ship, 'box', [0, 0.4, 0], [3.4, 1.6, 13], Mx.hull);
      ent(ship, 'box', [0, 1.6, -4.2], [2.8, 2, 2.6], Mx.deck);
      for (let i = 0; i < 3; i++) ent(ship, 'box', [0, 1.6, -0.5 + i * 2.6], [2.6, 1.2, 2.3], Mx.containers[i]);
      let u = 0;
      return (G, dt) => {
        u += dt * 0.05;
        const z = s.z + Math.sin(u) * 40, dzdt = Math.cos(u);
        const x = riverCenter(z) + Math.sign(dzdt) * 1.2;
        ship.setPosition(x, WATER_Y + 0.1, z);
        const slope = 12 * 0.03 * Math.cos(z * 0.03);
        ship.setEulerAngles(0, (Math.atan(slope) * 180) / Math.PI + (dzdt < 0 ? 180 : 0), 0);
      };
    },
    airport(s, g) {
      const y = Math.max(...[-22, 0, 22].map((d) => height(s.x + d, s.z))) + 0.3;
      ent(g, 'box', [s.x, y, s.z], [50, 0.4, 6.5], Mx.asphalt, false);
      for (let i = -5; i <= 5; i++) ent(g, 'box', [s.x + i * 4.2, y + 0.22, s.z], [2, 0.05, 0.3], Mx.stripe, false);
      for (let i = -6; i <= 6; i++) for (const dz of [-3.6, 3.6]) ent(g, 'sphere', [s.x + i * 4, y + 0.4, s.z + dz], [0.4, 0.4, 0.4], Mx.runwayLight, false);
      ent(g, 'box', [s.x - 6, y + 2, s.z + 11], [16, 4, 6], M.concrete);
      ent(g, 'cylinder', [s.x + 12, y + 5, s.z + 10], [1.6, 10, 1.6], M.concrete);
      ent(g, 'box', [s.x + 12, y + 10.6, s.z + 10], [3.4, 1.6, 3.4], M.steelGlass);
      lamp(g, s.x - 16, y, s.z + 8, M); lamp(g, s.x + 4, y, s.z + 8, M);
      // Boeing 737-800 (models/boeing737-800.glb, dựng từ macro FreeCAD); hình hộp tạm trong lúc tải
      const mkPlane = () => {
        const p = new pc.Entity(); g.addChild(p);
        const tmp = new pc.Entity(); p.addChild(tmp);
        ent(tmp, 'cylinder', [0, 0, 0], [1, 7, 1], Mx.plane).setLocalEulerAngles(90, 0, 0);
        ent(tmp, 'box', [0, 0, 0.3], [9, 0.18, 1.6], Mx.plane);
        ent(tmp, 'box', [0, 1, -3.2], [0.18, 2, 1.2], Mx.tail);
        return model(p, 'b737', 0.26, 180, tmp);
      };
      const flyer = mkPlane(), taxi = mkPlane();
      let a = 0, t = 0;
      return (G, dt, day) => {
        Mx.runwayLight.emissiveIntensity = clamp((0.6 - day) * 4, 0, 2.5); Mx.runwayLight.update();
        a += dt * 0.25;
        flyer.setPosition(s.x + Math.cos(a) * 45, y + 30 + Math.sin(a * 2) * 4, s.z + Math.sin(a) * 30);
        flyer.setEulerAngles(0, (-a * 180) / Math.PI, -18);
        // Máy bay chạy đà rồi cất cánh, lặp lại
        t = (t + dt / 14) % 1;
        const along = -24 + t * 70, lift = Math.max(0, along - 10) * 0.35;
        taxi.setPosition(s.x + along, y + 1 + lift, s.z);
        taxi.setEulerAngles(-Math.min(12, lift * 1.5), 90, 0);
        taxi.enabled = t < 0.92;
      };
    },
  };

  // ---------- Thời tiết ----------
  const cloudMat = mat('#e7ecef', { opacity: 0 });
  // Mây: mô hình cloud.glb (người chơi gửi, đã giảm còn ~1 450 tam giác), dùng chung vật liệu mờ dần theo độ phủ mây
  const toCloudMat = (e) => { for (const r of e.findComponents('render')) for (const mi of r.meshInstances) { mi.material = cloudMat; mi.castShadow = false; } };
  const clouds = Array.from({ length: 22 }, (_, i) => {
    const L = 40 + (i % 4) * 12;
    const e = new pc.Entity('cloud'); world.addChild(e);
    e.setLocalPosition(((i * 37) % 360) - 180, 70 + (i % 3) * 8, ((i * 53) % 340) - 170);
    e.setLocalScale(L, L * 0.45, L * 1.1); e.setLocalEulerAngles(0, (i * 47) % 360, 0);
    const tmp = ent(e, 'sphere', [0, 0, 0], [1, 0.5, 0.6], cloudMat, false);
    model(e, 'cloud', 1, 0, tmp, toCloudMat);
    return e;
  });
  // Máy bay chở khách bay ngang bầu trời quốc gia (airplane.glb người chơi gửi), đèn chớp trắng về đêm
  const strobeMat = mat('#ffffff', { emissive: '#ffffff', ei: 0 });
  const airliners = Array.from({ length: 3 }, (_, i) => {
    const e = new pc.Entity('airliner'); world.addChild(e);
    const tmp = ent(e, 'box', [0, 0.6, 0], [5, 1, 5], Mx.plane ?? M.metal);
    model(e, 'airliner', 2.2, 0, tmp);
    ent(e, 'sphere', [0, 2.1, 1], [0.25, 0.25, 0.25], strobeMat, false);
    return { e, wait: i * 25, from: new pc.Vec3(), to: new pc.Vec3(), u: 1, len: 1 };
  });
  const relaunch = (a) => {
    const th = Math.random() * Math.PI * 2, y = 62 + Math.random() * 14, R = 260, off = (Math.random() - 0.5) * 160;
    a.from.set(Math.cos(th) * R - Math.sin(th) * off, y, Math.sin(th) * R + Math.cos(th) * off);
    a.to.set(-Math.cos(th) * R - Math.sin(th) * off, y, -Math.sin(th) * R + Math.cos(th) * off);
    a.len = a.from.distance(a.to); a.u = 0;
    a.e.setEulerAngles(0, (Math.atan2(-(a.to.x - a.from.x), -(a.to.z - a.from.z)) * 180) / Math.PI, 0);
  };
  const AP = new pc.Vec3();
  let strobeT = 0;
  const rainMat = mat('#c9d6e2', { opacity: 0.55 });
  const drops = Array.from({ length: 140 }, (_, i) => ({ e: ent(world, 'box', [0, -50, 0], [0.08, 2.2, 0.08], rainMat, false), y: Math.random() * 60, k: i / 140 }));
  const bolt = new pc.Entity(); bolt.addComponent('light', { type: 'directional', color: col('#dfe8ff'), intensity: 0, castShadows: false });
  bolt.setEulerAngles(60, 20, 0); world.addChild(bolt);
  let lastStrikes = 0, boltT = 0;

  function weather(G, dt, target) {
    const w = G.weather, W = WEATHERS[w.id], cover = W.cover;
    cloudMat.opacity += ((cover * 0.75) - cloudMat.opacity) * Math.min(1, dt); cloudMat.diffuse = W.grey ? col('#6b747c') : col('#e7ecef'); cloudMat.update();
    for (const c of clouds) { const p = c.getLocalPosition(); c.setLocalPosition(p.x > 230 ? -230 : p.x + dt * (G.windNow ?? 5) * 0.8, p.y, p.z); }
    strobeT += dt;
    strobeMat.emissiveIntensity = strobeT % 1.2 < 0.08 ? 6 : 0; strobeMat.update();
    for (const a of airliners) {
      if (a.wait > 0) { a.wait -= dt; a.e.enabled = false; continue; }
      if (a.u >= 1) { relaunch(a); a.e.enabled = true; }
      a.u += (dt * 24) / a.len; // ~24 đơn vị/giây thực
      a.e.setPosition(AP.lerp(a.from, a.to, Math.min(1, a.u)));
      if (a.u >= 1) { a.wait = 8 + Math.random() * 30; a.e.enabled = false; }
    }
    const raining = !!W.rain;
    for (const d of drops) {
      d.e.enabled = raining && d.k < W.rain;
      if (!raining) continue;
      d.y -= dt * 45;
      if (d.y < 0) { d.y = 50 + Math.random() * 10; d.x = target.x + (Math.random() - 0.5) * 120; d.z = target.z + (Math.random() - 0.5) * 120; }
      if (d.x === undefined) { d.x = target.x + (Math.random() - 0.5) * 120; d.z = target.z + (Math.random() - 0.5) * 120; }
      d.e.setPosition(d.x, d.y, d.z);
    }
    if (w.strikes > lastStrikes) { lastStrikes = w.strikes; boltT = 1; }
    boltT = Math.max(0, boltT - dt * 2.5);
    bolt.light.intensity = boltT > 0.5 || (boltT > 0.2 && boltT < 0.3) ? 4 : 0;
    return boltT;
  }

  // ---------- Đồng bộ ----------
  const views = new Map();
  function sync(G) {
    for (const [id, v] of views) if (!G.infra.some((s) => s.id === id)) { v.g.destroy(); views.delete(id); }
    for (const s of G.infra) {
      if (views.has(s.id)) continue;
      const g = new pc.Entity(`infra-${s.id}`); world.addChild(g);
      views.set(s.id, { g, s, update: infraBuilders[s.type](s, g) });
    }
  }
  // vis(x, z, r): công trình có trong khung nhìn không; ngoài màn hình thì tắt hẳn, logic game vẫn chạy
  const VR = { road: 60, airport: 45, port: 32, tower: 16, wind: 22 };
  function update(G, dt, day, vis = null, cull = null) {
    for (const v of views.values()) {
      const on = !vis || vis(v.s.x, v.s.z, VR[v.s.type] ?? 22);
      if (v.g.enabled !== on) v.g.enabled = on;
      if (on) v.update(G, dt, day);
      if (cull) cull[on ? 'shown' : 'hidden']++;
    }
  }
  return { nodeBuilders, sync, update, weather, views };
}
