// Thế giới 3D (PlayCanvas): lưới truyền tải 3 pha, thành phố, nhà máy hạt nhân, ngày/đêm.
import * as pc from 'playcanvas';
import { clamp, ramp, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import { RATED, outletTemp, DIESEL_START } from '../physics/reactor.js';
import { hasTransformer, isPowered } from '../physics/grid.js';
import { hourOfDay } from '../game.js';

export const TOWERS_X = [-38, -26, -14, -2, 10];
const PHASES_Z = [-2, 0, 2];
const SEG = 10;                       // số đoạn mỗi khoảng cột
const BROKEN_SPAN = 3;                // khoảng cột bị đứt khi cháy dây
const STEPUP_X = -46, STEPDOWN_X = 18;
export const PLANT = new pc.Vec3(0, 0, -48);
const TOWER_TOP = new pc.Vec3(40, 22, -54); // miệng tháp làm mát

const col = (h) => new pc.Color().fromString(h);
const col255 = (c, out = new pc.Color()) => out.set(c[0] / 255, c[1] / 255, c[2] / 255);
const UP_Y = pc.Vec3.UP, UP_X = pc.Vec3.RIGHT, tmp = new pc.Vec3();

export function buildWorld(app) {
  const root = new pc.Entity('world');
  app.root.addChild(root);

  const mat = (hex, o = {}) => {
    const m = new pc.StandardMaterial();
    m.diffuse = col(hex); m.gloss = o.gloss ?? 0.35; m.useMetalness = true; m.metalness = o.metal ?? 0;
    if (o.emissive) { m.emissive = col(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity != null) { m.opacity = o.opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update();
    return m;
  };
  const ent = (type, p, s, m, shadow = true, parent = root) => {
    const e = new pc.Entity();
    e.addComponent('render', { type, material: m, castShadows: shadow, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]);
    parent.addChild(e);
    return e;
  };
  const setBeam = (e, a, b, t) => {
    tmp.sub2(b, a);
    const len = tmp.length() || 1e-3;
    e.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    e.setLocalScale(t, t, len);
    e.lookAt(b, Math.abs(tmp.y) / len > 0.98 ? UP_X : UP_Y);
  };
  const beam = (a, b, t, m, shadow = true) => { const e = ent('box', [0, 0, 0], [1, 1, 1], m, shadow); setBeam(e, a, b, t); return e; };
  const V = (x, y, z) => new pc.Vec3(x, y, z);
  const meshEnt = (geom, p, m) => {
    const e = new pc.Entity();
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, geom), m)], castShadows: true, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); root.addChild(e); return e;
  };
  const light = (type, p, color, o = {}) => {
    const e = new pc.Entity();
    e.addComponent('light', { type, color: col(color), intensity: 0, range: o.range ?? 20, castShadows: false });
    e.setLocalPosition(p[0], p[1], p[2]); root.addChild(e); return e;
  };

  // ---------- Vật liệu ----------
  const M = {
    ground: mat('#7d9478', { gloss: 0.1 }), sea: mat('#2c6a8c', { gloss: 0.85 }),
    concrete: mat('#cfd2cb'), dark: mat('#3a4346'), metal: mat('#7f8b89', { metal: 0.6, gloss: 0.5 }),
    roof: mat('#56605f'), leaf: mat('#4f7d4b', { gloss: 0.1 }), trunk: mat('#6b5a44'),
    glass: mat('#dbe5e8', { opacity: 0.22, gloss: 0.9 }), steelGlass: mat('#a3b1b5', { opacity: 0.35, metal: 0.7 }),
    wire: mat('#808c89', { metal: 0.5, emissive: '#000000' }), coil: mat('#8a8f86', { emissive: '#000000' }),
    fuel: mat('#3a2418', { emissive: '#d25f23' }), hot: mat('#9b6b4b', { emissive: '#000000' }),
    cold: mat('#3a8fc4', { emissive: '#1d6fa8', ei: 0.4 }), steam: mat('#9aa3a3', { emissive: '#000000' }),
    lamp: mat('#222222', { emissive: '#000000' }), corium: mat('#ff8a2a', { emissive: '#ff7a1a', ei: 2.2 }),
    plume: mat('#ff6a3d', { opacity: 0.18, emissive: '#ff4a20', ei: 0.3 }),
    flameA: mat('#000000', { emissive: '#ff5434', ei: 3 }), flameB: mat('#000000', { emissive: '#ffc04a', ei: 3 }),
  };

  // ---------- Địa hình ----------
  ent('plane', [0, 0, -20], [260, 1, 220], M.ground, false);
  ent('plane', [0, 0.05, -100], [260, 1, 50], M.sea, false);
  const trees = [[-30, 6], [-20, -7], [-10, 1.5], [-6, -1.5], [-9, 4], [4, 8], [-48, 10], [-40, -10], [12, -12], [-25, 14], [28, 16], [-60, -18], [52, 6], [-18, -24], [14, -24]];
  for (const [x, z] of trees) {
    ent('cylinder', [x, 1, z], [0.4, 2, 0.4], M.trunk);
    ent('cone', [x, 3.4, z], [3, 4, 3], M.leaf);
  }

  // ---------- Nhà máy phát & trạm biến áp ----------
  ent('box', [-58, 4, 0], [10, 8, 12], M.concrete);
  ent('box', [-58, 8.6, 0], [10.4, 1.2, 12.4], M.roof);
  ent('cylinder', [-61, 12, 3.5], [1.6, 16, 1.6], M.concrete);
  const transformer = (x) => {
    ent('box', [x, 1.5, 0], [3.2, 3, 4.6], M.dark);
    ent('cylinder', [x, 4.3, -1], [1.3, 2.6, 1.3], M.coil);
    ent('cylinder', [x, 4.3, 1], [1.3, 2.6, 1.3], M.coil);
    for (const z of PHASES_Z) ent('cylinder', [x, 6.4, z], [0.25, 1.4, 0.25], M.metal);
  };
  transformer(STEPUP_X); transformer(STEPDOWN_X);
  for (const z of PHASES_Z) {
    beam(V(-53, 7, z), V(STEPUP_X, 7, z), 0.12, M.metal);
    beam(V(STEPDOWN_X, 7, z), V(25, 7, z * 0.6), 0.12, M.metal);
  }

  // ---------- Cột điện ----------
  for (const x of TOWERS_X) {
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of legs) beam(V(x + sx * 1.7, 0, sz * 1.7), V(x + sx * 0.35, 12, sz * 0.35), 0.22, M.metal);
    for (const h of [3, 6.5, 9.5]) {
      const w = 1.7 - (1.35 * h) / 12, w2 = 1.7 - (1.35 * (h + 3)) / 12;
      for (const sz of [-1, 1]) {
        beam(V(x - w, h, sz * w), V(x + w2, h + 3, sz * w2), 0.12, M.metal);
        beam(V(x + w, h, sz * w), V(x - w2, h + 3, sz * w2), 0.12, M.metal);
      }
    }
    ent('box', [x, 12, 0], [0.35, 0.35, 5.6], M.metal);
    beam(V(x, 12, 0), V(x, 14, 0), 0.2, M.metal);
    for (const z of PHASES_Z) ent('cylinder', [x, 11.6, z], [0.22, 0.8, 0.22], M.dark);
  }

  // ---------- Dây dẫn 3 pha ----------
  const wires = PHASES_Z.map(() => Array.from({ length: TOWERS_X.length + 1 }, () =>
    Array.from({ length: SEG }, () => ent('box', [0, 0, 0], [0.1, 0.1, 1], M.wire, false))));
  const pA = new pc.Vec3(), pB = new pc.Vec3();
  const pointOn = (a, b, t, sag, broken, out) => {
    if (broken) {
      const left = t <= 0.5, u = left ? t / 0.5 : (1 - t) / 0.5, base = left ? a : b;
      return out.set(base.x + (left ? 1 : -1) * u * 2.5, base.y - (base.y - 0.3) * u ** 1.5, a.z);
    }
    return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 4 * sag * t * (1 - t), a.z);
  };
  const anchors = PHASES_Z.map((z) => [V(STEPUP_X, 7.1, z), ...TOWERS_X.map((x) => V(x, 11.2, z)), V(STEPDOWN_X, 7.1, z)]);
  function updateWires(sag, broken) {
    for (let ph = 0; ph < 3; ph++) {
      const pts = anchors[ph];
      for (let s = 0; s < pts.length - 1; s++) {
        const br = broken && s === BROKEN_SPAN;
        for (let i = 0; i < SEG; i++) {
          const e = wires[ph][s][i];
          if (br && i === SEG / 2) { e.enabled = false; continue; }
          e.enabled = true;
          pointOn(pts[s], pts[s + 1], i / SEG, sag, br, pA);
          pointOn(pts[s], pts[s + 1], (i + 1) / SEG, sag, br, pB);
          setBeam(e, pA, pB, 0.12);
        }
      }
    }
  }

  // ---------- Thành phố ----------
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#fff';
  for (let y = 6; y < 124; y += 10) for (let x = 5; x < 60; x += 10) if ((x * 7 + y * 13) % 11 < 9) g.fillRect(x, y, 5, 6);
  const tex = new pc.Texture(app.graphicsDevice, { width: 64, height: 128, mipmaps: true });
  tex.setSource(canvas);
  const cityMat = mat('#5f6872');
  cityMat.emissiveMap = tex; cityMat.emissive = col('#ffc861'); cityMat.emissiveIntensity = 1; cityMat.update();
  const heights = [14, 22, 9, 17, 11, 26, 13, 8, 19, 12, 15, 10];
  heights.forEach((h, i) => {
    const x = 28 + (i % 4) * 5.5, z = -8 + Math.floor(i / 4) * 7;
    ent('box', [x, h / 2, z], [4, h, 4.5], cityMat);
  });
  const cityLight = light('omni', [36, 8, -1], '#ffc861', { range: 34 });

  // ---------- Nhà máy hạt nhân ----------
  const P = PLANT;
  ent('cylinder', [P.x, 0.3, P.z], [20, 0.6, 20], M.concrete);
  const shell = ent('cylinder', [P.x, 5.6, P.z], [18, 10, 18], M.glass, false);
  const dome = ent('sphere', [P.x, 10.6, P.z], [18, 11, 18], M.glass, false);
  ent('cylinder', [P.x, 4.6, P.z], [4.4, 8, 4.4], M.steelGlass, false);
  const fuel = [];
  for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) fuel.push(ent('box', [P.x + dx, 3.6, P.z + dz], [0.42, 5, 0.42], M.fuel, false));
  const rods = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].map(([dx, dz]) => ent('box', [P.x + dx, 8.6, P.z + dz], [0.24, 5, 0.24], M.dark, false));
  ent('box', [P.x, 9.6, P.z], [2.6, 1.2, 2.6], M.dark);
  const corium = ent('sphere', [P.x, 1.2, P.z], [4, 1.1, 4], M.corium, false);
  corium.enabled = false;
  const coreLight = light('omni', [P.x, 4.5, P.z], '#5cc8ff', { range: 18 });
  ent('cylinder', [P.x + 5, 4.6, P.z], [2.4, 7, 2.4], M.concrete);
  beam(V(P.x + 2.2, 6.6, P.z), V(P.x + 3.8, 6.6, P.z), 0.7, M.hot);
  beam(V(P.x + 5, 1.1, P.z + 1.2), V(P.x + 1.6, 1.1, P.z + 1.2), 0.7, M.cold);
  ent('cylinder', [P.x + 3.3, 1.3, P.z + 1.2], [1.4, 1.6, 1.4], M.dark);
  const pump = ent('box', [P.x + 3.3, 2.2, P.z + 1.2], [1.3, 0.15, 0.25], M.metal);
  beam(V(P.x + 5, 8.1, P.z), V(P.x + 13, 7, P.z), 0.6, M.steam);
  ent('box', [P.x + 20, 3.5, P.z], [14, 7, 9], M.concrete);
  ent('box', [P.x + 20, 7.3, P.z], [14.4, 0.8, 9.4], M.roof);
  meshEnt(new pc.ConeGeometry({ baseRadius: 8, peakRadius: 5, height: 14, heightSegments: 1, capSegments: 32 }), [40, 7, -54], M.concrete);
  meshEnt(new pc.ConeGeometry({ baseRadius: 5, peakRadius: 6, height: 8, heightSegments: 1, capSegments: 32 }), [40, 18, -54], M.concrete);
  ent('box', [-12, 1.5, -40], [4, 3, 3], M.concrete);
  const dieselLamp = ent('sphere', [-12, 3.4, -40], [0.9, 0.9, 0.9], M.lamp, false);
  const debris = [[3, 9, 2, 25], [-4, 8, -3, -35], [1, 12, -5, 60], [-6, 10, 4, -15]].map(([dx, y, dz, r]) => {
    const e = ent('box', [P.x + dx, y, P.z + dz], [3, 0.5, 2], M.concrete); e.setLocalEulerAngles(r, r * 2, r / 2); e.enabled = false; return e;
  });
  const plume = ent('sphere', [P.x, 10, P.z], [1, 1, 1], M.plume, false);
  plume.enabled = false;
  const flash = light('omni', [P.x, 16, P.z], '#ffffff', { range: 140 });

  // Hơi nước tháp làm mát: tái sử dụng một nhóm cầu mờ
  const puffs = Array.from({ length: 16 }, () => {
    const m = mat('#f3f5f4', { opacity: 0 });
    const e = ent('sphere', [0, -50, 0], [1, 1, 1], m, false);
    return { e, m, age: 99, life: 5, pos: new pc.Vec3() };
  });
  let puffAcc = 0;

  // ---------- Lửa ----------
  const fire = (p, size = 1) => {
    const g = new pc.Entity(); g.setLocalPosition(p[0], p[1], p[2]); root.addChild(g);
    const parts = [[0, 0, 1.4, M.flameA], [0.6, 0.3, 0.9, M.flameB], [-0.5, -0.4, 1.0, M.flameA]].map(([dx, dz, s, m]) => {
      const e = ent('cone', [dx * size, s * size, dz * size], [s * size, s * 2 * size, s * size], m, false, g);
      return { e, s: s * size };
    });
    const l = new pc.Entity(); l.addComponent('light', { type: 'omni', color: col('#ff7a33'), intensity: 0, range: 16 * size });
    l.setLocalPosition(0, 2 * size, 0); g.addChild(l);
    g.enabled = false;
    return { g, parts, l };
  };
  const fires = { lineA: fire([-11.5, 0, 0]), lineB: fire([-4.5, 0, 0], 0.8), tx: fire([STEPDOWN_X, 3, 0], 1.2), plant: fire([P.x, 9, P.z], 2) };
  const flicker = (f, on, t) => {
    f.g.enabled = on;
    if (!on) return;
    f.parts.forEach((p, i) => p.e.setLocalScale(p.s * (0.85 + 0.2 * Math.sin(t * 13 + i * 2)), p.s * 2 * (0.8 + 0.35 * Math.abs(Math.sin(t * 9 + i))), p.s));
    f.l.light.intensity = 2.5 + Math.sin(t * 20) * 0.8;
  };

  // ---------- Bầu trời & ánh sáng ----------
  const sun = new pc.Entity('sun');
  sun.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 2048, shadowDistance: 170, shadowBias: 0.3, normalOffsetBias: 0.05, intensity: 1.2 });
  root.addChild(sun);
  const DAY = col('#a9c4d6'), NIGHT = col('#0b1420'), sky = new pc.Color(), c1 = new pc.Color();
  let time = 0, pumpRot = 0;

  function update(G, dtReal, camera) {
    time += dtReal;
    const C = G.grid, R = G.reactor;

    // Ngày / đêm theo đồng hồ game
    const hour = hourOfDay(G);
    const day = clamp(Math.sin(((hour - 6) / 12) * Math.PI) + 0.15, 0, 1);
    sun.setEulerAngles(35, 30, clamp((hour - 12) * 12, -80, 80));
    sun.light.intensity = 0.08 + 1.3 * day;
    app.scene.ambientLight.set(0.1 + 0.3 * day, 0.12 + 0.32 * day, 0.16 + 0.32 * day);
    sky.lerp(NIGHT, DAY, day);
    camera.camera.clearColor = sky;

    // Dây: võng và phát sáng theo nhiệt độ
    const broken = C.line === 'fire';
    updateWires(0.6 + clamp((C.Tw - 40) * 0.035, 0, 5), broken);
    col255(ramp(WIRE_RAMP, C.Tw), M.wire.emissive);
    M.wire.emissiveIntensity = clamp((C.Tw - 80) / 120, 0, 2.5);
    M.wire.update();
    col255(ramp(WIRE_RAMP, 30 + (C.Tt - 40) * 2), M.coil.emissive);
    M.coil.emissiveIntensity = hasTransformer(C) ? clamp((C.Tt - 70) / 50, 0, 2) : 0;
    M.coil.update();

    const lit = isPowered(C);
    cityMat.emissiveIntensity = lit ? 0.35 + 1.6 * (1 - day) : 0;
    cityMat.update();
    cityLight.light.intensity = lit ? 2.5 * (1 - day) : 0;
    flicker(fires.lineA, broken, time); flicker(fires.lineB, broken, time + 1);
    flicker(fires.tx, C.tx === 'fire', time + 2);

    // Lò: thanh điều khiển, lõi, bơm, ống
    rods.forEach((r) => { const p = r.getLocalPosition(); r.setLocalPosition(p.x, 3.6 + (R.rod / 100) * 5, p.z); });
    col255(ramp(FUEL_RAMP, R.T), M.fuel.emissive);
    M.fuel.emissiveIntensity = clamp((R.T - 250) / 500, 0.15, 3);
    M.fuel.update();
    fuel.forEach((f) => (f.enabled = !R.melt));
    corium.enabled = R.melt;
    coreLight.light.color = R.melt ? col('#ff8a2a') : col('#5cc8ff');
    coreLight.light.intensity = R.melt ? 3 : clamp((R.Pf / RATED) * 2.5, 0, 6);
    col255(ramp(WIRE_RAMP, 30 + (outletTemp(R) - 290) * 3), M.hot.emissive);
    M.hot.emissiveIntensity = R.flow > 0.02 ? 0.8 : 0;
    M.hot.update();
    M.cold.emissiveIntensity = R.flow > 0.02 ? 0.4 : 0; M.cold.update();
    pumpRot += R.flow * 720 * dtReal;
    pump.setLocalEulerAngles(0, pumpRot % 360, 0);
    M.steam.emissive = col('#f2b13a'); M.steam.emissiveIntensity = R.Pe > 0 ? 0.6 : 0; M.steam.update();
    const dsl = !R.diesel ? '#ff5434' : !R.offsite && R.dieselT >= DIESEL_START ? '#36b2ff' : !R.offsite ? '#f2b13a' : '#202020';
    M.lamp.emissive = col(dsl); M.lamp.emissiveIntensity = 2; M.lamp.update();

    dome.enabled = !R.boom;
    debris.forEach((d) => (d.enabled = R.boom));
    M.glass.diffuse = R.boom ? col('#ff8a75') : col('#dbe5e8'); M.glass.update();
    flicker(fires.plant, R.boom && R.T > 600, time + 3);
    R.flash = Math.max(0, R.flash - dtReal * 0.8);
    flash.light.intensity = R.flash * 10;

    // Đám mây phóng xạ theo gió (0° = hướng Bắc = −Z)
    plume.enabled = R.release > 0;
    if (plume.enabled) {
      const len = 10 + R.plume * 90, w = (R.wind * Math.PI) / 180;
      plume.setLocalPosition(P.x + Math.sin(w) * len, 16, P.z - Math.cos(w) * len);
      plume.setLocalEulerAngles(0, -R.wind, 0);
      plume.setLocalScale(10 + R.plume * 30, 5 + R.plume * 5, len * 2);
    }

    // Hơi nước tháp làm mát
    const steamRate = clamp(R.Pe / (0.33 * RATED), 0, 1);
    puffAcc += dtReal * 5 * steamRate;
    for (const p of puffs) {
      if (p.age >= p.life && puffAcc >= 1) {
        puffAcc -= 1; p.age = 0;
        p.pos.set(TOWER_TOP.x + (Math.random() - 0.5) * 4, TOWER_TOP.y, TOWER_TOP.z + (Math.random() - 0.5) * 4);
      }
      if (p.age < p.life) {
        p.age += dtReal;
        const k = p.age / p.life;
        p.pos.y += dtReal * 3; p.pos.x += dtReal * 1.2;
        p.e.setLocalPosition(p.pos); const s = 4 + k * 9; p.e.setLocalScale(s, s * 0.8, s);
        p.m.opacity = 0.55 * (1 - k); p.m.update();
      } else if (p.m.opacity !== 0) { p.m.opacity = 0; p.m.update(); }
    }
  }

  return { update };
}

/** Điểm treo nhãn HTML trên các công trình. */
export const LABELS = [
  ['Máy phát 10,5 kV', [-58, 11, 0]], ['Tăng áp', [STEPUP_X, 8.6, 0]], ['Đường dây', [-14, 15.5, 0], 'line'],
  ['Hạ áp', [STEPDOWN_X, 8.6, 0]], ['Thành phố', [36, 28, 0]], ['Nhà lò', [0, 18, -48]],
  ['Tua-bin', [20, 9, -48]], ['Tháp làm mát', [40, 24.5, -54]], ['Diesel', [-12, 5.5, -40]],
];
