// Thế giới 3D: địa hình, công trình theo dữ liệu lưới (thêm/bớt động), đường dây 3 pha trên cột,
// lò phản ứng nhìn xuyên, khói/hơi, lửa, phóng xạ, ngày/đêm, con trỏ chọn và bóng ma khi xây.
import * as pc from 'playcanvas';
import { clamp, ramp, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import { RATED, outletTemp, DIESEL_START } from '../physics/reactor.js';
import { lineUsable } from '../physics/network.js';
import { hourOfDay, nodeById } from '../game.js';
import { height, WATER_Y, buildable } from '../map.js';
import { buildTerrain } from './terrain.js';
import { col, col255, mat, ent, meshEnt, light, setBeam, beam, fire, seeded } from './kit.js';

const SEG = 6;
export const ATTACH = { nuclear: [14, 9, 9], coal: [7, 9, 6], sub: [0, 7.4, 0], city: [0, 10, 0] };
export const PICK_RADIUS = { nuclear: 17, coal: 10, sub: 6, city: 14 };
const groundY = (x, z) => Math.max(height(x, z), WATER_Y);

export function attachPoint(n, out = new pc.Vec3()) {
  const [dx, dy, dz] = ATTACH[n.type];
  return out.set(n.x + dx, groundY(n.x, n.z) + dy, n.z + dz);
}
export const nodeGround = (n) => groundY(n.x, n.z);

export function buildWorld(app) {
  const world = new pc.Entity('world');
  app.root.addChild(world);
  buildTerrain(app, world);

  const M = {
    concrete: mat('#cfd2cb'), dark: mat('#3a4346'), metal: mat('#7f8b89', { metal: 0.6, gloss: 0.5 }),
    roof: mat('#56605f'), leaf: mat('#4a7a47', { gloss: 0.1 }), trunk: mat('#6b5a44'), coalPile: mat('#1d1d1d'),
    glass: mat('#dbe5e8', { opacity: 0.22, gloss: 0.9 }), steelGlass: mat('#a3b1b5', { opacity: 0.35, metal: 0.7 }),
    fuel: mat('#3a2418', { emissive: '#d25f23' }), hot: mat('#9b6b4b', { emissive: '#000000' }),
    cold: mat('#3a8fc4', { emissive: '#1d6fa8', ei: 0.4 }), steam: mat('#9aa3a3', { emissive: '#000000' }),
    lamp: mat('#222222', { emissive: '#000000' }), corium: mat('#ff8a2a', { emissive: '#ff7a1a', ei: 2.2 }),
    plume: mat('#ff6a3d', { opacity: 0.18, emissive: '#ff4a20', ei: 0.3 }),
    flameA: mat('#000000', { emissive: '#ff5434', ei: 3 }), flameB: mat('#000000', { emissive: '#ffc04a', ei: 3 }),
    marker: mat('#000000', { emissive: '#ffd24a', ei: 2 }),
    ghostOk: mat('#36b2ff', { opacity: 0.45, emissive: '#36b2ff', ei: 0.6 }),
    ghostBad: mat('#ff5434', { opacity: 0.45, emissive: '#ff5434', ei: 0.6 }),
  };

  // ---------- Cây cối rải rác ----------
  const rnd = seeded('trees');
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * 220, z = (rnd() - 0.5) * 220, y = height(x, z);
    if (y < 0.3 || y > 10) continue;
    const s = 0.7 + rnd() * 0.7;
    ent(world, 'cylinder', [x, y + 1 * s, z], [0.4 * s, 2 * s, 0.4 * s], M.trunk);
    ent(world, 'cone', [x, y + 3.4 * s, z], [3 * s, 4 * s, 3 * s], M.leaf);
  }

  // ---------- Hơi nước / khói (một bể hạt dùng chung) ----------
  const puffs = Array.from({ length: 48 }, () => {
    const m = mat('#f3f5f4', { opacity: 0 });
    const e = ent(world, 'sphere', [0, -50, 0], [1, 1, 1], m, false);
    return { e, m, age: 99, life: 5, pos: new pc.Vec3(), grow: 9 };
  });
  const emit = (x, y, z, color, life, grow) => {
    const p = puffs.find((q) => q.age >= q.life);
    if (!p) return;
    p.age = 0; p.life = life; p.grow = grow; p.pos.set(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3);
    p.m.diffuse = col(color); p.m.update();
  };
  const updatePuffs = (dt) => {
    for (const p of puffs) {
      if (p.age >= p.life) { if (p.m.opacity !== 0) { p.m.opacity = 0; p.m.update(); } continue; }
      p.age += dt;
      const k = p.age / p.life;
      p.pos.y += dt * 3; p.pos.x += dt * 1.2;
      p.e.setLocalPosition(p.pos); const s = 3 + k * p.grow; p.e.setLocalScale(s, s * 0.8, s);
      p.m.opacity = 0.55 * (1 - k); p.m.update();
    }
  };

  // ---------- Công trình theo loại ----------
  const builders = {
    nuclear(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      ent(g, 'cylinder', [0, 0.3, 0], [20, 0.6, 20], M.concrete);
      ent(g, 'cylinder', [0, 5.6, 0], [18, 10, 18], M.glass, false);
      const dome = ent(g, 'sphere', [0, 10.6, 0], [18, 11, 18], M.glass, false);
      ent(g, 'cylinder', [0, 4.6, 0], [4.4, 8, 4.4], M.steelGlass, false);
      const fuel = [];
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) fuel.push(ent(g, 'box', [dx, 3.6, dz], [0.42, 5, 0.42], M.fuel, false));
      const rods = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].map(([dx, dz]) => ent(g, 'box', [dx, 8.6, dz], [0.24, 5, 0.24], M.dark, false));
      ent(g, 'box', [0, 9.6, 0], [2.6, 1.2, 2.6], M.dark);
      const corium = ent(g, 'sphere', [0, 1.2, 0], [4, 1.1, 4], M.corium, false); corium.enabled = false;
      const coreLight = light(g, [0, 4.5, 0], '#5cc8ff', 18);
      ent(g, 'cylinder', [5, 4.6, 0], [2.4, 7, 2.4], M.concrete);
      const V = (x, y, z) => new pc.Vec3(n.x + x, y0 + y, n.z + z);
      beam(g, V(2.2, 6.6, 0), V(3.8, 6.6, 0), 0.7, M.hot);
      beam(g, V(5, 1.1, 1.2), V(1.6, 1.1, 1.2), 0.7, M.cold);
      ent(g, 'cylinder', [3.3, 1.3, 1.2], [1.4, 1.6, 1.4], M.dark);
      const pump = ent(g, 'box', [3.3, 2.2, 1.2], [1.3, 0.15, 0.25], M.metal);
      beam(g, V(5, 8.1, 0), V(13, 7, 2), 0.6, M.steam);
      ent(g, 'box', [18, 3.5, 2], [13, 7, 9], M.concrete);
      ent(g, 'box', [18, 7.3, 2], [13.4, 0.8, 9.4], M.roof);
      ent(g, 'box', [14, 4, 9], [5, 8, 3], M.metal); // trạm phân phối
      const tx = n.x + 18, tz = n.z - 12, ty = groundY(tx, tz);
      meshEnt(app, world, new pc.ConeGeometry({ baseRadius: 8, peakRadius: 5, height: 14, heightSegments: 1, capSegments: 28 }), [tx, ty + 7, tz], M.concrete);
      meshEnt(app, world, new pc.ConeGeometry({ baseRadius: 5, peakRadius: 6, height: 8, heightSegments: 1, capSegments: 28 }), [tx, ty + 18, tz], M.concrete);
      ent(g, 'box', [-14, 1.5, 10], [4, 3, 3], M.concrete);
      const lamp = ent(g, 'sphere', [-14, 3.4, 10], [0.9, 0.9, 0.9], M.lamp, false);
      void lamp;
      const debris = [[3, 9, 2, 25], [-4, 8, -3, -35], [1, 12, -5, 60], [-6, 10, 4, -15]].map(([dx, y, dz, r]) => {
        const e = ent(g, 'box', [dx, y, dz], [3, 0.5, 2], M.concrete); e.setLocalEulerAngles(r, r * 2, r / 2); e.enabled = false; return e;
      });
      const plume = ent(world, 'sphere', [0, -50, 0], [1, 1, 1], M.plume, false); plume.enabled = false;
      const flash = light(g, [0, 16, 0], '#ffffff', 160);
      const blaze = fire(g, [0, 9, 0], 2, M);
      let pumpRot = 0, acc = 0;
      return (G, dt, t) => {
        const R = G.reactor;
        rods.forEach((r) => { const p = r.getLocalPosition(); r.setLocalPosition(p.x, 3.6 + (R.rod / 100) * 5, p.z); });
        col255(ramp(FUEL_RAMP, R.T), M.fuel.emissive); M.fuel.emissiveIntensity = clamp((R.T - 250) / 500, 0.15, 3); M.fuel.update();
        fuel.forEach((f) => (f.enabled = !R.melt)); corium.enabled = R.melt;
        coreLight.light.color = R.melt ? col('#ff8a2a') : col('#5cc8ff');
        coreLight.light.intensity = R.melt ? 3 : clamp((R.Pf / RATED) * 2.5, 0, 6);
        col255(ramp(WIRE_RAMP, 30 + (outletTemp(R) - 290) * 3), M.hot.emissive);
        M.hot.emissiveIntensity = R.flow > 0.02 ? 0.8 : 0; M.hot.update();
        M.cold.emissiveIntensity = R.flow > 0.02 ? 0.4 : 0; M.cold.update();
        pumpRot += R.flow * 720 * dt; pump.setLocalEulerAngles(0, pumpRot % 360, 0);
        M.steam.emissive = col('#f2b13a'); M.steam.emissiveIntensity = R.Pe > 0 ? 0.6 : 0; M.steam.update();
        M.lamp.emissive = col(!R.diesel ? '#ff5434' : !R.offsite && R.dieselT >= DIESEL_START ? '#36b2ff' : !R.offsite ? '#f2b13a' : '#202020');
        M.lamp.emissiveIntensity = 2; M.lamp.update();
        dome.enabled = !R.boom; debris.forEach((d) => (d.enabled = R.boom));
        M.glass.diffuse = R.boom ? col('#ff8a75') : col('#dbe5e8'); M.glass.update();
        blaze.set(R.boom && R.T > 600, t);
        R.flash = Math.max(0, R.flash - dt * 0.8); flash.light.intensity = R.flash * 10;
        plume.enabled = R.release > 0;
        if (plume.enabled) {
          const len = 10 + R.plume * 90, w = (R.wind * Math.PI) / 180;
          plume.setLocalPosition(n.x + Math.sin(w) * len, y0 + 16, n.z - Math.cos(w) * len);
          plume.setLocalEulerAngles(0, -R.wind, 0);
          plume.setLocalScale(10 + R.plume * 30, 5 + R.plume * 5, len * 2);
        }
        acc += dt * 5 * clamp(R.Pe / (0.33 * RATED), 0, 1);
        while (acc >= 1) { acc -= 1; emit(tx, ty + 22, tz, '#f3f5f4', 5, 9); }
      };
    },

    coal(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      ent(g, 'box', [0, 4, 0], [12, 8, 10], M.concrete);
      ent(g, 'box', [0, 8.5, 0], [12.4, 1, 10.4], M.roof);
      ent(g, 'cylinder', [-3, 12, -3], [1.8, 24, 1.8], M.concrete);
      ent(g, 'cylinder', [2, 11, -3], [1.6, 22, 1.6], M.concrete);
      ent(g, 'cone', [-9, 2, 6], [7, 4, 7], M.coalPile);
      let acc = 0;
      return (G, dt) => {
        acc += dt * 4 * clamp(n.gen / 600, 0, 1);
        while (acc >= 1) { acc -= 1; emit(n.x - 3, y0 + 24, n.z - 3, '#5f6466', 4, 7); emit(n.x + 2, y0 + 22, n.z - 3, '#6f7476', 4, 7); }
      };
    },

    sub(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      ent(g, 'box', [0, 0.2, 0], [9, 0.4, 9], M.concrete);
      const coil = mat('#8a8f86', { emissive: '#000000' });
      for (const dz of [-2, 2]) {
        ent(g, 'box', [-1.5, 1.5, dz], [2.6, 2.6, 2.6], M.dark);
        ent(g, 'cylinder', [-1.5, 3.8, dz - 0.6], [1, 2, 1], coil);
        ent(g, 'cylinder', [-1.5, 3.8, dz + 0.6], [1, 2, 1], coil);
      }
      const V = (x, y, z) => new pc.Vec3(n.x + x, y0 + y, n.z + z);
      for (const [x, z] of [[3, -3.5], [3, 3.5], [-4, -3.5], [-4, 3.5]]) beam(g, V(x, 0, z), V(x, 7.4, z), 0.3, M.metal);
      beam(g, V(3, 7.4, -3.5), V(3, 7.4, 3.5), 0.3, M.metal);
      beam(g, V(-4, 7.4, -3.5), V(-4, 7.4, 3.5), 0.3, M.metal);
      const blaze = fire(g, [-1.5, 2.6, 0], 1.1, M);
      return (G, dt, t) => {
        col255(ramp(WIRE_RAMP, 30 + (n.Tt - 40) * 2), coil.emissive);
        coil.emissiveIntensity = clamp((n.Tt - 70) / 50, 0, 2); coil.update();
        blaze.set(n.state === 'fire', t);
      };
    },

    city(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 128;
      const c2 = canvas.getContext('2d');
      c2.fillStyle = '#000'; c2.fillRect(0, 0, 64, 128); c2.fillStyle = '#fff';
      for (let y = 6; y < 124; y += 10) for (let x = 5; x < 60; x += 10) if ((x * 7 + y * 13) % 11 < 9) c2.fillRect(x, y, 5, 6);
      const tex = new pc.Texture(app.graphicsDevice, { width: 64, height: 128, mipmaps: true });
      tex.setSource(canvas);
      const m = mat('#5f6872'); m.emissiveMap = tex; m.emissive = col('#ffc861'); m.update();
      const r = seeded(n.id), count = Math.round(4 + n.demandBase / 60);
      const side = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const h = 6 + r() * (n.demandBase / 25);
        const x = ((i % side) - (side - 1) / 2) * 5.2 + (r() - 0.5), z = (Math.floor(i / side) - (side - 1) / 2) * 5.6 + (r() - 0.5);
        ent(g, 'box', [x, h / 2, z], [3.8 + r(), h, 4 + r()], m);
      }
      const glow = light(g, [0, 8, 0], '#ffc861', 34);
      const blaze = fire(g, [side * 2.6 + 2, 1, 0], 1, M);
      return (G, dt, t, day) => {
        const k = n.state === 'ok' ? n.frac : 0;
        m.emissiveIntensity = k * (0.25 + 1.6 * (1 - day)); m.update();
        glow.light.intensity = k * 2.5 * (1 - day);
        blaze.set(n.state === 'fire', t);
      };
    },
  };

  // ---------- Đường dây trên cột ----------
  function buildLine(l, A, B) {
    const g = new pc.Entity(`line-${l.id}`); world.addChild(g);
    const pa = attachPoint(A), pb = attachPoint(B);
    const dir = new pc.Vec3(pb.x - pa.x, 0, pb.z - pa.z), dist = dir.length();
    dir.normalize();
    const perp = new pc.Vec3(-dir.z, 0, dir.x);
    const spans = Math.max(1, Math.round(dist / 16));
    const yaw = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
    const tops = [pa.clone()];
    const leg = (tw, ax, ay, az, bx, by, bz, t) => {
      const a = new pc.Vec3(ax, ay, az), d = new pc.Vec3(bx - ax, by - ay, bz - az), len = d.length();
      const e = ent(tw, 'box', [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], [t, t, len], M.metal);
      e.setLocalEulerAngles((Math.asin(d.y / len) * 180) / Math.PI, (Math.atan2(-d.x, -d.z) * 180) / Math.PI, 0);
      void a;
    };
    for (let k = 1; k < spans; k++) {
      const x = pa.x + (pb.x - pa.x) * (k / spans), z = pa.z + (pb.z - pa.z) * (k / spans), y = groundY(x, z);
      const tw = new pc.Entity(); tw.setLocalPosition(x, y, z); tw.setLocalEulerAngles(0, yaw, 0); g.addChild(tw);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) leg(tw, sx * 1.6, 0, sz * 1.6, sx * 0.35, 13, sz * 0.35, 0.22);
      leg(tw, -1.6, 0, -1.6, 0.9, 6.5, 0.9, 0.12); leg(tw, 1.6, 0, -1.6, -0.9, 6.5, 0.9, 0.12);
      ent(tw, 'box', [0, 13, 0], [5.6, 0.35, 0.35], M.metal);
      ent(tw, 'box', [0, 14, 0], [0.25, 2, 0.25], M.metal);
      tops.push(new pc.Vec3(x, y + 12.2, z));
    }
    tops.push(pb.clone());
    const wireMat = mat('#808c89', { metal: 0.5, emissive: '#000000' });
    const phases = [-2, 0, 2].map((o) => tops.map((p, i) => {
      const end = i === 0 || i === tops.length - 1, s = end ? 0.5 : 1;
      return new pc.Vec3(p.x + perp.x * o * s, p.y, p.z + perp.z * o * s);
    }));
    const segs = phases.map(() => Array.from({ length: spans }, () => Array.from({ length: SEG }, () => ent(g, 'box', [0, 0, 0], [0.1, 0.1, 1], wireMat, false))));
    const mid = Math.floor(spans / 2);
    const at = (k) => new pc.Vec3().lerp(tops[mid], tops[mid + 1], k);
    const fA = fire(g, [0, 0, 0], 0.8, M), fB = fire(g, [0, 0, 0], 0.6, M);
    const a2 = at(0.35), b2 = at(0.65);
    fA.g.setPosition(a2.x, groundY(a2.x, a2.z), a2.z); fB.g.setPosition(b2.x, groundY(b2.x, b2.z), b2.z);
    const P0 = new pc.Vec3(), P1 = new pc.Vec3();
    const pointOn = (a, b, t, sag, broken, out) => {
      if (broken) {
        const left = t <= 0.5, u = left ? t / 0.5 : (1 - t) / 0.5, base = left ? a : b, other = left ? b : a;
        const gx = base.x + (other.x - base.x) * 0.35 * u, gz = base.z + (other.z - base.z) * 0.35 * u;
        const gy = groundY(gx, gz) + 0.3;
        return out.set(gx, base.y + (gy - base.y) * u ** 1.5, gz);
      }
      return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 4 * sag * t * (1 - t), a.z + (b.z - a.z) * t);
    };
    let lastKey = '';
    return {
      g, polyline: tops, mid: at(0.5),
      update(t, selected) {
        const broken = l.state === 'fire', live = lineUsable(l);
        const sag = (0.5 + clamp((l.Tw - 40) * 0.03, 0, 4.5)) * (dist / spans / 14);
        const key = `${broken}|${sag.toFixed(2)}`;
        if (key !== lastKey) {
          lastKey = key;
          for (let ph = 0; ph < 3; ph++) {
            const pts = phases[ph];
            for (let s = 0; s < spans; s++) {
              const br = broken && s === mid;
              for (let i = 0; i < SEG; i++) {
                const e = segs[ph][s][i];
                if (br && i === SEG / 2) { e.enabled = false; continue; }
                e.enabled = true;
                pointOn(pts[s], pts[s + 1], i / SEG, sag, br, P0);
                pointOn(pts[s], pts[s + 1], (i + 1) / SEG, sag, br, P1);
                setBeam(e, P0, P1, 0.12);
              }
            }
          }
        }
        if (selected) { wireMat.diffuse = col('#36b2ff'); wireMat.emissive = col('#36b2ff'); wireMat.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 5); }
        else {
          wireMat.diffuse = live ? col('#808c89') : col('#4a4f52');
          col255(ramp(WIRE_RAMP, l.Tw), wireMat.emissive);
          wireMat.emissiveIntensity = clamp((l.Tw - 80) / 120, 0, 2.5);
        }
        wireMat.update();
        fA.set(broken, t); fB.set(broken, t + 1);
      },
    };
  }

  // ---------- Đồng bộ với dữ liệu lưới ----------
  const nodeViews = new Map(), lineViews = new Map();
  function sync(G) {
    for (const n of G.net.nodes) {
      if (nodeViews.has(n.id)) continue;
      const g = new pc.Entity(`node-${n.id}`); world.addChild(g);
      nodeViews.set(n.id, { g, update: builders[n.type](n, g), node: n });
    }
    for (const [id, v] of lineViews) if (!G.net.lines.some((l) => l.id === id)) { v.g.destroy(); lineViews.delete(id); }
    for (const l of G.net.lines) {
      if (lineViews.has(l.id)) continue;
      lineViews.set(l.id, { ...buildLine(l, nodeById(G, l.a), nodeById(G, l.b)), line: l });
    }
  }

  // ---------- Con trỏ chọn & bóng ma ----------
  const marker = ent(world, 'cone', [0, -50, 0], [2.4, 3, 2.4], M.marker, false);
  const ghost = ent(world, 'box', [0, -50, 0], [9, 7, 9], M.ghostOk, false);
  const ghostLine = ent(world, 'box', [0, -50, 0], [0.4, 0.4, 1], M.ghostOk, false);
  ghost.enabled = ghostLine.enabled = false;
  const gp = new pc.Vec3(), gq = new pc.Vec3();
  function setGhost(G, mode, cursor, from) {
    ghost.enabled = mode === 'sub' && !!cursor;
    ghostLine.enabled = mode === 'line' && !!cursor && !!from;
    if (ghost.enabled) {
      const ok = !buildable(cursor.x, cursor.z, G.net.nodes);
      ghost.render.meshInstances[0].material = ok ? M.ghostOk : M.ghostBad;
      ghost.setPosition(cursor.x, height(cursor.x, cursor.z) + 3.5, cursor.z);
    }
    if (ghostLine.enabled) setBeam(ghostLine, attachPoint(from, gp), gq.set(cursor.x, cursor.y + 8, cursor.z), 0.5);
  }

  // ---------- Bầu trời ----------
  const sun = new pc.Entity('sun');
  sun.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 2048, shadowDistance: 260, shadowBias: 0.3, normalOffsetBias: 0.05, intensity: 1.2 });
  world.addChild(sun);
  app.scene.fog.type = pc.FOG_LINEAR; app.scene.fog.start = 200; app.scene.fog.end = 560;
  const DAY = col('#a9c4d6'), NIGHT = col('#0b1420'), sky = new pc.Color();
  let time = 0;

  function setQuality(high) { sun.light.castShadows = high; }

  function update(G, dt, camera, selection) {
    time += dt;
    sync(G);
    const hour = hourOfDay(G), day = clamp(Math.sin(((hour - 6) / 12) * Math.PI) + 0.15, 0, 1);
    sun.setEulerAngles(35, 30, clamp((hour - 12) * 12, -80, 80));
    sun.light.intensity = 0.08 + 1.3 * day;
    app.scene.ambientLight.set(0.1 + 0.3 * day, 0.12 + 0.32 * day, 0.16 + 0.32 * day);
    sky.lerp(NIGHT, DAY, day);
    camera.camera.clearColor = sky; app.scene.fog.color = sky;

    for (const v of nodeViews.values()) v.update(G, dt, time, day);
    for (const v of lineViews.values()) v.update(time, selection?.kind === 'line' && selection.id === v.line.id);
    updatePuffs(dt);

    marker.enabled = !!selection;
    if (selection) {
      const bob = Math.sin(time * 3) * 0.8;
      if (selection.kind === 'node') {
        const n = nodeById(G, selection.id);
        if (n) marker.setPosition(n.x, groundY(n.x, n.z) + PICK_RADIUS[n.type] + 8 + bob, n.z);
      } else {
        const v = lineViews.get(selection.id);
        if (v) marker.setPosition(v.mid.x, v.mid.y + 6 + bob, v.mid.z);
      }
      marker.setLocalEulerAngles(180, time * 90, 0);
    }
  }

  return { update, setGhost, lineViews, setQuality };
}
