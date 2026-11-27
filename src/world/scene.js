// Thế giới 3D: địa hình, công trình theo dữ liệu lưới (thêm/bớt động), đường dây 3 pha trên cột,
// lò phản ứng nhìn xuyên, khói/hơi, lửa, phóng xạ, ngày/đêm, con trỏ chọn và bóng ma khi xây.
import * as pc from 'playcanvas';
import { clamp, ramp, WIRE_RAMP, FUEL_RAMP } from '../util.js';
import { RATED, outletTemp, dieselRunning } from '../physics/reactor.js';
import { lineUsable } from '../physics/network.js';
import { hourOfDay, nodeById } from '../game.js';
import { height, WATER_Y, buildable, riverCenter } from '../map.js';
import { buildTerrain } from './terrain.js';
import { createInfra } from './infra3d.js';
import { createCityView } from './cityview.js';
import { canPlace, BUILDS } from '../infra.js';
import { WEATHERS } from '../weather.js';
import { col, col255, mat, ent, meshEnt, light, setBeam, beam, fire, seeded, hyperboloid, hollowTower, lamp, model } from './kit.js';

const SEG = 6;
export const ATTACH = { nuclear: [14, 9, 9], coal: [7, 9, 6], sub: [0, 7.4, 0], city: [0, 10, 0], hydro: [12, 11, 3], border: [-4, 7.4, 0], wind: [0, 9, 0], mine: [8, 13, 0] };
export const PICK_RADIUS = { nuclear: 17, coal: 10, sub: 6, city: 14, hydro: 13, border: 9, wind: 11, mine: 14 };
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
    marker: mat('#000000', { emissive: '#ffd24a', ei: 2 }), army: mat('#4b5a33', { gloss: 0.2 }), tent: mat('#6b7a43', { gloss: 0.1 }),
    ring: mat('#0b2230', { emissive: '#28beff', ei: 1.2 }), pulse: mat('#000000', { emissive: '#5ff5ff', ei: 3 }),
    tower: mat('#c9ccc4', { gloss: 0.2 }), towerIn: mat('#2a2e31', { gloss: 0.05 }),
    basin: mat('#1d5f86', { gloss: 0.9, emissive: '#0b3550', ei: 0.4 }),
    core: (() => { const m = mat('#08202c', { emissive: '#28beff', ei: 1.5 }); m.cull = pc.CULLFACE_NONE; m.update(); return m; })(),
    bulb: mat('#3a3a2a', { emissive: '#ffd27a', ei: 0 }), foam: mat('#eef8fb', { opacity: 0.85, emissive: '#bfe8f5', ei: 0.3 }),
    gate: mat('#10161c'), tank: mat('#9aa6b0', { metal: 0.5, gloss: 0.6 }), flag: mat('#c8102e', { emissive: '#400008', ei: 0.3 }),
    fence: mat('#8b958f', { metal: 0.4 }), damConcrete: mat('#a9b1b2', { gloss: 0.15 }), reservoir: mat('#2a6d93', { opacity: 0.9, gloss: 0.9 }),
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

  let hiQuality = true; // đồ hoạ cao: Chernobyl bản supercomplex; thấp: bản nhẹ
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
      hyperboloid(app, g, [0, 1.1, 0], M.core, { height: 5.2, base: 1.65, waist: 1.65, top: 1.65, rings: 2, segs: 20, shadow: false }); // lõi rỗng phát sáng
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
      const towers = [[n.x + 18, n.z - 12], [n.x + 36, n.z - 2]].map(([x, z]) => [x, groundY(x, z), z]);
      const towerEnts = towers.map(([x, y, z]) => hollowTower(app, world, [x, y - 0.4, z], M));
      const [tx, ty, tz] = towers[0];
      // Dàn tản nhiệt phụ với quạt quay theo nhiệt độ lõi
      const fans = [-4.5, 0, 4.5].map((dx) => {
        ent(g, 'box', [18 + dx, 1.2, 9.5], [3.4, 2.4, 2.6], M.dark);
        ent(g, 'cylinder', [18 + dx, 2.6, 9.5], [2, 0.4, 2], M.metal);
        return ent(g, 'box', [18 + dx, 2.9, 9.5], [1.8, 0.08, 0.3], M.lamp);
      });
      // Bồn nước làm mát, bồn cầu, hàng rào, đèn đường
      ent(g, 'cylinder', [27, 2.5, -4], [3.6, 5, 3.6], M.tank); ent(g, 'cylinder', [27, 5.1, -4], [3.8, 0.3, 3.8], M.metal);
      ent(g, 'sphere', [-9, 4, -9], [4.2, 4.2, 4.2], M.tank);
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ent(g, 'cylinder', [-9 + dx * 1.3, 1.2, -9 + dz * 1.3], [0.3, 2.4, 0.3], M.metal);
      const fx0 = -16, fx1 = 30, fz0 = -16, fz1 = 16;
      for (let x = fx0; x <= fx1; x += 4) for (const z of [fz0, fz1]) ent(g, 'box', [x, 1, z], [0.18, 2, 0.18], M.fence, false);
      for (let z = fz0; z <= fz1; z += 4) for (const x of [fx0, fx1]) ent(g, 'box', [x, 1, z], [0.18, 2, 0.18], M.fence, false);
      for (const y of [0.8, 1.8]) {
        for (const z of [fz0, fz1]) ent(g, 'box', [(fx0 + fx1) / 2, y, z], [fx1 - fx0, 0.08, 0.08], M.fence, false);
        for (const x of [fx0, fx1]) ent(g, 'box', [x, y, (fz0 + fz1) / 2], [0.08, 0.08, fz1 - fz0], M.fence, false);
      }
      for (const [x, z] of [[fx0, fz0], [fx1, fz0], [fx1, fz1], [fx0, fz1], [7, fz1], [7, fz0]]) lamp(g, x + 0.8, 0, z + (z < 0 ? 0.8 : -0.8), M);
      // ---------- Tổ máy số 2 (lò riêng, vật liệu riêng) + công trường ----------
      const ux = 42, uz = 18, uy = groundY(n.x + ux, n.z + uz) - y0;
      const u2g = new pc.Entity(); u2g.setLocalPosition(ux, uy, uz); g.addChild(u2g);
      const M2 = { fuel: mat('#3a2418', { emissive: '#d25f23' }), ring: mat('#0b2230', { emissive: '#28beff', ei: 1.2 }),
        core: (() => { const m = mat('#08202c', { emissive: '#28beff', ei: 1.5 }); m.cull = pc.CULLFACE_NONE; m.update(); return m; })(),
        glass: mat('#dbe5e8', { opacity: 0.22, gloss: 0.9 }) };
      const unit = new pc.Entity(); u2g.addChild(unit);
      ent(unit, 'cylinder', [0, 0.3, 0], [20, 0.6, 20], M.concrete);
      ent(unit, 'cylinder', [0, 5.6, 0], [18, 10, 18], M2.glass, false);
      const dome2 = ent(unit, 'sphere', [0, 10.6, 0], [18, 11, 18], M2.glass, false);
      ent(unit, 'cylinder', [0, 4.6, 0], [4.4, 8, 4.4], M.steelGlass, false);
      const fuel2 = [];
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) fuel2.push(ent(unit, 'box', [dx, 3.6, dz], [0.42, 5, 0.42], M2.fuel, false));
      const rods2 = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].map(([dx, dz]) => ent(unit, 'box', [dx, 8.6, dz], [0.24, 5, 0.24], M.dark, false));
      hyperboloid(app, unit, [0, 1.1, 0], M2.core, { height: 5.2, base: 1.65, waist: 1.65, top: 1.65, rings: 2, segs: 20, shadow: false });
      meshEnt(app, unit, new pc.TorusGeometry({ ringRadius: 9.25, tubeRadius: 0.32, segments: 40, sides: 8 }), [0, 4.2, 0], M2.ring);
      ent(unit, 'cylinder', [5, 4.6, 0], [2.4, 7, 2.4], M.concrete);
      const light2 = light(unit, [0, 4.5, 0], '#5cc8ff', 18);
      const debris2 = [[3, 9, 2, 25], [-4, 8, -3, -35], [1, 12, -5, 60]].map(([dx, y, dz, r]) => {
        const e = ent(unit, 'box', [dx, y, dz], [3, 0.5, 2], M.concrete); e.setLocalEulerAngles(r, r * 2, r / 2); e.enabled = false; return e;
      });
      beam(g, new pc.Vec3(n.x + ux - 6, y0 + uy + 8, n.z + uz - 4), new pc.Vec3(n.x + 24.5, y0 + 6.5, n.z + 5), 0.6, M.steam);
      const steam2 = g.children[g.children.length - 1];
      // Công trường: giàn giáo, cần cẩu, tường lên dần theo tiến độ
      const site = new pc.Entity(); u2g.addChild(site);
      const wall = ent(site, 'cylinder', [0, 0, 0], [18, 1, 18], M.concrete);
      const V2 = (x, y, z) => new pc.Vec3(n.x + ux + x, y0 + uy + y, n.z + uz + z);
      for (const [x, z] of [[-10, -10], [10, -10], [10, 10], [-10, 10]]) beam(site, V2(x, 0, z), V2(x, 13, z), 0.3, M.metal);
      for (const y of [4, 8.5, 13]) { beam(site, V2(-10, y, -10), V2(10, y, -10), 0.2, M.metal); beam(site, V2(-10, y, 10), V2(10, y, 10), 0.2, M.metal); beam(site, V2(-10, y, -10), V2(-10, y, 10), 0.2, M.metal); beam(site, V2(10, y, -10), V2(10, y, 10), 0.2, M.metal); }
      ent(site, 'box', [-14, 14, -6], [1.2, 28, 1.2], M.flag);
      const jib = ent(site, 'box', [-6, 27.5, -6], [18, 0.8, 0.8], M.flag);
      unit.enabled = site.enabled = false;
      const updateU2 = (G, t) => {
        const st = G.unit2.state, R2 = G.reactor2;
        unit.enabled = !!R2; site.enabled = st === 'building'; steam2.enabled = !!R2;
        if (site.enabled) { const k = Math.max(0.05, G.unit2.progress); wall.setLocalScale(18, 10 * k, 18); wall.setLocalPosition(0, 5 * k, 0); jib.setLocalEulerAngles(0, t * 12, 0); }
        if (!R2) return;
        rods2.forEach((r) => { const p = r.getLocalPosition(); r.setLocalPosition(p.x, 3.6 + (R2.rod / 100) * 5, p.z); });
        col255(ramp(FUEL_RAMP, R2.T), M2.fuel.emissive); M2.fuel.emissiveIntensity = clamp((R2.T - 250) / 500, 0.15, 3); M2.fuel.update();
        fuel2.forEach((f) => (f.enabled = !R2.melt));
        const hk = clamp((R2.T - 380) / 400, 0, 1);
        col255(hk > 0 ? [255, Math.round(150 - 120 * hk), 30] : [40, 190, 255], M2.ring.emissive);
        M2.ring.emissiveIntensity = R2.melt ? 3 : 0.4 + clamp((R2.Pf / RATED) * 1.2, 0, 2.5) + hk * 2; M2.ring.update();
        M2.core.emissive = M2.ring.emissive; M2.core.emissiveIntensity = R2.melt ? 0.2 : 0.6 + clamp((R2.Pf / RATED) * 1.5, 0, 3) + hk * 2; M2.core.update();
        light2.light.intensity = R2.melt ? 3 : clamp((R2.Pf / RATED) * 2.5, 0, 6);
        dome2.enabled = !R2.boom; debris2.forEach((d) => (d.enabled = R2.boom));
        M2.glass.diffuse = R2.boom ? col('#ff8a75') : col('#dbe5e8'); M2.glass.update();
      };
      // Bệ phòng không (hiện khi có quân canh gác nhà máy)
      const sam = new pc.Entity(); sam.setLocalPosition(-12, 0, -14); g.addChild(sam);
      ent(sam, 'box', [0, 0.8, 0], [4, 1.6, 2.6], M.army);
      const tube = ent(sam, 'box', [0, 2.6, 0], [1.2, 1.2, 4.6], M.army); tube.setLocalEulerAngles(-35, 0, 0);
      let fanRot = 0;
      // Vòng phát sáng Cherenkov quanh vỏ lò: xanh khi ổn định, cam rồi đỏ khi quá nhiệt
      meshEnt(app, g, new pc.TorusGeometry({ ringRadius: 9.25, tubeRadius: 0.32, segments: 40, sides: 8 }), [0, 4.2, 0], M.ring);
      ent(g, 'box', [-14, 1.5, 10], [4, 3, 3], M.concrete);
      ent(g, 'sphere', [-14, 3.4, 10], [0.9, 0.9, 0.9], M.lamp, false);
      const debris = [[3, 9, 2, 25], [-4, 8, -3, -35], [1, 12, -5, 60], [-6, 10, 4, -15]].map(([dx, y, dz, r]) => {
        const e = ent(g, 'box', [dx, y, dz], [3, 0.5, 2], M.concrete); e.setLocalEulerAngles(r, r * 2, r / 2); e.enabled = false; return e;
      });
      const plume = ent(world, 'sphere', [0, -50, 0], [1, 1, 1], M.plume, false); plume.enabled = false;
      const flash = light(g, [0, 16, 0], '#ffffff', 160);
      const blaze = fire(g, [0, 9, 0], 2, M);
      // ---------- Chế độ RBMK: thay cụm VVER bằng nhà máy Chernobyl (2 macro FreeCAD) ----------
      // Gốc mô hình = tâm khối lò số 4, trùng tâm lõi; quay 180° để khu phụ trợ trải về phía nam, tránh đập thủy điện.
      const keep = new Set([coreLight, flash, blaze.g, sam, corium, ...debris]);
      const vver = g.children.filter((c) => !keep.has(c));
      const CH = 0.08; // 1 m → 0,08 đơn vị: khu 480 × 340 m chiếm 38 × 27 đơn vị. Tỉ lệ & hướng được chọn bằng cách dò
      // địa hình: khu nhà máy gần như không lấn sông, nền phẳng, không đè lên trạm/đập/mỏ khác
      const rb = new pc.Entity('rbmk'); rb.setLocalPosition(0, 0.05, 0); rb.setLocalEulerAngles(0, 180, 0); g.addChild(rb);
      const hiQ = new pc.Entity(), loQ = new pc.Entity(); rb.addChild(hiQ); rb.addChild(loQ);
      const r4 = [], ruins = [];
      const grab = (e) => { r4.push(e.findByName('Reactor4')); ruins.push(e.findByName('Reactor4_Ruin')); };
      model(hiQ, 'supercomplex', CH, 0, null, grab);
      model(loQ, 'chernobyl', CH, 0, null, grab);
      // Tấm che lò trên mái gian lò (vị trí lõi), phát sáng theo màu/độ nóng của vòng Cherenkov
      const lid = ent(g, 'cylinder', [0, 1.65, 0], [1.6, 0.06, 1.6], M.ring, false);
      const rbTowers = [[120, 22], [155, 22]].map(([X, Y]) => { // tháp làm mát của mô hình (cao 38 m)
        const x = n.x - (X - 28) * CH, z = n.z + (Y - 73) * CH; return [x, y0, z];
      });
      rb.enabled = lid.enabled = false;
      let wasRbmk = false;
      let pumpRot = 0, acc = 0;
      return (G, dt, t) => {
        const R = G.reactor, rbmk = !!R.rbmk;
        if (rbmk !== wasRbmk) {
          wasRbmk = rbmk;
          for (const c of vver) c.enabled = !rbmk;
          for (const e of towerEnts) e.enabled = !rbmk;
          rb.enabled = rbmk;
          blaze.g.setLocalPosition(0, rbmk ? 1.2 : 9, 0); // RBMK không có vỏ bọc: cháy than chì ngay trong gian lò
        }
        if (rbmk) {
          hiQ.enabled = hiQuality; loQ.enabled = !hiQuality;
          r4.forEach((e) => e && (e.enabled = !R.boom)); ruins.forEach((e) => e && (e.enabled = R.boom));
          lid.enabled = true; lid.setLocalPosition(0, R.boom ? 0.4 : 1.65, 0); // sau nổ: lõi hở giữa đống đổ nát
        } else lid.enabled = false;
        updateU2(G, t); if (rbmk) steam2.enabled = false; sam.enabled = G.world.guards.includes(n.id);
        rods.forEach((r) => { const p = r.getLocalPosition(); r.setLocalPosition(p.x, 3.6 + (R.rod / 100) * 5, p.z); });
        col255(ramp(FUEL_RAMP, R.T), M.fuel.emissive); M.fuel.emissiveIntensity = clamp((R.T - 250) / 500, 0.15, 3); M.fuel.update();
        fuel.forEach((f) => (f.enabled = !R.melt && !rbmk)); corium.enabled = R.melt;
        coreLight.light.color = R.melt ? col('#ff8a2a') : col('#5cc8ff');
        coreLight.light.intensity = R.melt ? 3 : clamp((R.Pf / RATED) * 2.5, 0, 6);
        col255(ramp(WIRE_RAMP, 30 + (outletTemp(R) - 290) * 3), M.hot.emissive);
        M.hot.emissiveIntensity = R.flow > 0.02 ? 0.8 : 0; M.hot.update();
        M.cold.emissiveIntensity = R.flow > 0.02 ? 0.4 : 0; M.cold.update();
        pumpRot += R.flow * 720 * dt; pump.setLocalEulerAngles(0, pumpRot % 360, 0);
        fanRot += (200 + clamp(R.T - 280, 0, 400) * 3) * dt; fans.forEach((f, i) => f.setLocalEulerAngles(0, (fanRot + i * 40) % 360, 0));
        M.steam.emissive = col('#f2b13a'); M.steam.emissiveIntensity = R.Pe > 0 ? 0.6 : 0; M.steam.update();
        M.lamp.emissive = col(!R.diesel ? '#ff5434' : dieselRunning(R) ? '#36b2ff' : !R.offsite ? '#f2b13a' : '#202020');
        M.lamp.emissiveIntensity = 2; M.lamp.update();
        dome.enabled = !R.boom && !rbmk; debris.forEach((d) => (d.enabled = R.boom));
        M.glass.diffuse = R.boom ? col('#ff8a75') : col('#dbe5e8'); M.glass.update();
        blaze.set(R.boom && R.T > 600, t);
        R.flash = Math.max(0, R.flash - dt * 0.8); flash.light.intensity = R.flash * 10;
        const rel = Math.max(R.release, G.reactor2?.release ?? 0), pl = Math.max(R.plume, G.reactor2?.plume ?? 0);
        plume.enabled = rel > 0;
        if (plume.enabled) {
          const len = 10 + pl * 90, w = (R.wind * Math.PI) / 180;
          plume.setLocalPosition(n.x + Math.sin(w) * len, y0 + 16, n.z - Math.cos(w) * len);
          plume.setLocalEulerAngles(0, -R.wind, 0);
          plume.setLocalScale(10 + pl * 30, 5 + pl * 5, len * 2);
        }
        const hotK = clamp((R.T - 380) / 400, 0, 1);
        col255(hotK > 0 ? [255, Math.round(150 - 120 * hotK), 30] : [40, 190, 255], M.ring.emissive);
        M.ring.emissiveIntensity = R.melt ? 3 : 0.4 + clamp((R.Pf / RATED) * 1.2, 0, 2.5) + hotK * 2;
        M.ring.update();
        M.core.emissive = M.ring.emissive; M.core.emissiveIntensity = R.melt ? 0.2 : 0.6 + clamp((R.Pf / RATED) * 1.5, 0, 3) + hotK * 2; M.core.update();
        acc += dt * 5 * clamp((R.Pe + (G.reactor2?.Pe ?? 0)) / (0.33 * RATED), 0, 2);
        while (acc >= 1) { acc -= 1; const [x, y, z] = (rbmk ? rbTowers : towers)[Math.random() < 0.5 ? 0 : 1]; emit(x, y + (rbmk ? 3.2 : 20), z, '#f3f5f4', rbmk ? 2.5 : 5, rbmk ? 4 : 9); }
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

    hydro(n, g) {
      // Đập bê tông chắn ngang sông (sông chảy theo trục z), hồ chứa phía thượng lưu, cửa xả bọt trắng
      const base = -2.6, top = 9;
      const dir = (riverCenter(n.z + 1) - riverCenter(n.z - 1)) / 2, yaw = (Math.atan(dir) * 180) / Math.PI;
      g.setLocalPosition(n.x, 0, n.z); g.setLocalEulerAngles(0, -yaw, 0);
      ent(g, 'box', [0, (base + top) / 2, 0], [26, top - base, 4], M.damConcrete);
      ent(g, 'box', [0, (base + top) / 2 - 2, 3], [26, top - base - 4, 2.2], M.damConcrete);
      ent(g, 'box', [0, top + 0.9, -0.5], [14, 1.8, 2.6], M.dark);
      ent(g, 'box', [11, top - 1, 6], [6, 5, 6], M.concrete); // nhà máy phát ở chân đập
      const res = ent(g, 'box', [0, 0.6, -16], [11, 0.2, 28], M.reservoir, false);
      void res;
      const foams = [-6, -2, 2, 6].map((x) => {
        ent(g, 'box', [x, base + 2.6, 4.2], [2.4, 3, 0.6], M.gate);
        return ent(g, 'box', [x, WATER_Y + 0.25, 7], [3, 0.6, 5], M.foam, false);
      });
      for (const x of [-12, 12]) lamp(g, x, top + 1.8, 0, M);
      return (G, dt, t) => {
        const k = clamp(n.gen / 250, 0, 1);
        foams.forEach((f, i) => { f.enabled = k > 0.02; f.setLocalScale(3, 0.6 + k * 0.6, (3 + k * 4) * (0.85 + 0.15 * Math.sin(t * 8 + i))); });
      };
    },

    border(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      ent(g, 'box', [0, 0.2, 0], [12, 0.4, 14], M.concrete);
      for (const z of [-4, 4]) ent(g, 'box', [3, 1.6, z], [3, 3.2, 3], M.dark);
      const arm = ent(g, 'box', [3, 1.4, 0], [0.3, 0.3, 7], M.flag);
      ent(g, 'cylinder', [-4, 6, 5], [0.2, 12, 0.2], M.metal);
      const flag = ent(g, 'box', [-4, 11, 6.3], [0.05, 1.6, 2.6], M.flag, false);
      const V = (x, y, z) => new pc.Vec3(n.x + x, y0 + y, n.z + z);
      for (const z of [-3.5, 3.5]) beam(g, V(-4, 0, z), V(-4, 7.4, z), 0.3, M.metal);
      beam(g, V(-4, 7.4, -3.5), V(-4, 7.4, 3.5), 0.3, M.metal);
      lamp(g, 6, 0, -6, M); lamp(g, 6, 0, 6, M);
      return (G, dt, t) => {
        arm.setLocalEulerAngles(G.market.exportOn ? 0 : 0, 0, 0);
        flag.setLocalEulerAngles(0, 10 * Math.sin(t * 2), 0);
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
      const ring = side * 2.9 + 3;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lamp(g, Math.cos(a) * ring, 0, Math.sin(a) * ring, M); }
      const blaze = fire(g, [side * 2.6 + 2, 1, 0], 1, M);
      return (G, dt, t, day) => {
        const k = n.state === 'ok' ? n.frac : 0;
        m.emissiveIntensity = k * (0.25 + 1.6 * (1 - day)); m.update();
        glow.light.intensity = k * 2.5 * (1 - day);
        blaze.set(n.state === 'fire', t);
      };
    },
  };

  const infra = createInfra(app, world, M, emit, groundY);
  const cityView = createCityView(app, M);
  let mode = 'nation';
  function setMode(m) {
    mode = m;
    for (const ch of world.children) if (ch !== sun && ch !== bounce) ch.enabled = m === 'nation';
    cityView.show(m !== 'nation');
  }
  Object.assign(builders, infra.nodeBuilders);

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
    // Hạt năng lượng chạy dọc pha giữa: tốc độ theo MW, chiều theo hướng công suất
    const pulseSize = l.kv >= 500 ? 0.75 : l.kv >= 220 ? 0.6 : 0.45;
    const nPulse = Math.max(3, spans * 2);
    const pulses = Array.from({ length: nPulse }, (_, i) => ({
      e: ent(g, 'sphere', [0, -50, 0], [pulseSize, pulseSize, pulseSize], M.pulse, false), u: i / nPulse,
    }));
    const PP = new pc.Vec3();
    return {
      g, polyline: tops, mid: at(0.5),
      update(t, selected, dt = 0) {
        const broken = l.state === 'fire', live = lineUsable(l);
        const sag = (0.5 + clamp((l.Tw - 40) * 0.03, 0, 4.5)) * (dist / spans / 14);
        const flowing = live && Math.abs(l.P) > 1;
        const speed = clamp(Math.abs(l.P) / 600, 0.05, 1.6) * (120 / Math.max(dist, 20)) * Math.sign(l.P) * 0.5;
        for (const p of pulses) {
          p.e.enabled = flowing;
          if (!flowing) continue;
          p.u = (((p.u + speed * dt) % 1) + 1) % 1;
          const f = p.u * spans, s = Math.min(spans - 1, Math.floor(f));
          pointOn(phases[1][s], phases[1][s + 1], f - s, sag, false, PP);
          p.e.setPosition(PP);
        }
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
  // Lều lính gác + xe quân sự cạnh công trình được canh gác
  const makeGuard = (n) => {
    const r = PICK_RADIUS[n.type] * 0.7 + 3, x = n.x - r, z = n.z + r, y = groundY(x, z);
    const e = new pc.Entity(); e.setLocalPosition(x, y, z); world.addChild(e);
    ent(e, 'cone', [0, 1.2, 0], [3.2, 2.4, 3.2], M.tent);
    ent(e, 'box', [3, 0.9, 0.5], [2.2, 1.4, 4], M.army);
    ent(e, 'cylinder', [-2, 2.5, 1], [0.1, 5, 0.1], M.metal);
    ent(e, 'box', [-2, 4.6, 1.6], [0.05, 0.9, 1.3], M.flag, false);
    e.enabled = false;
    return e;
  };
  const strikeLight = light(world, [0, -50, 0], '#ffb070', 70);
  let strikeT = 0, seenStrikes = 0;
  function sync(G) {
    for (const [id, v] of nodeViews) if (!G.net.nodes.some((n) => n.id === id)) { v.g.destroy(); v.guard?.destroy(); nodeViews.delete(id); }
    infra.sync(G);
    for (const n of G.net.nodes) {
      if (nodeViews.has(n.id)) continue;
      const g = new pc.Entity(`node-${n.id}`); world.addChild(g);
      nodeViews.set(n.id, { g, update: builders[n.type](n, g), node: n, guard: n.type === 'border' ? null : makeGuard(n) });
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
  const GHOST_SIZE = { sub: [9, 7, 9], wind: [18, 18, 18], city: [22, 14, 22], tower: [18, 22, 18], road: [6, 1, 46], port: [10, 6, 18], airport: [50, 2, 7] };
  function setGhost(G, mode, cursor, from) {
    const bt = mode?.startsWith('build:') ? mode.slice(6) : null;
    ghost.enabled = !!bt && !!cursor;
    ghostLine.enabled = mode === 'line' && !!cursor && !!from;
    if (ghost.enabled) {
      const ok = !canPlace(G, bt, cursor.x, cursor.z);
      ghost.render.meshInstances[0].material = ok ? M.ghostOk : M.ghostBad;
      const [sx, sy, sz] = GHOST_SIZE[bt];
      ghost.setLocalScale(sx, sy, sz);
      let yaw = 0;
      if (bt === 'road') { const c = G.net.nodes.filter((n) => n.type === 'city').sort((a, b) => Math.hypot(a.x - cursor.x, a.z - cursor.z) - Math.hypot(b.x - cursor.x, b.z - cursor.z))[0]; yaw = (Math.atan2(c.x - cursor.x, c.z - cursor.z) * 180) / Math.PI; }
      ghost.setEulerAngles(0, yaw, 0);
      ghost.setPosition(cursor.x, Math.max(height(cursor.x, cursor.z), WATER_Y) + sy / 2, cursor.z);
    }
    void BUILDS; void buildable;
    if (ghostLine.enabled) setBeam(ghostLine, attachPoint(from, gp), gq.set(cursor.x, cursor.y + 8, cursor.z), 0.5);
  }

  // ---------- Bầu trời ----------
  const sun = new pc.Entity('sun');
  sun.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 2048, shadowDistance: 260, shadowBias: 0.3, normalOffsetBias: 0.05, intensity: 1.2 });
  world.addChild(sun);
  // Ánh sáng hắt từ mặt đất (thay cho đèn bán cầu): chiếu ngược lên, màu cỏ, không đổ bóng
  const bounce = new pc.Entity('bounce');
  bounce.addComponent('light', { type: 'directional', castShadows: false, color: col('#7f9e6a'), intensity: 0.25 });
  bounce.setEulerAngles(180, 0, 20);
  world.addChild(bounce);
  app.scene.fog.type = pc.FOG_LINEAR; app.scene.fog.start = 200; app.scene.fog.end = 560;
  const NIGHT = col('#0b1420'), DAYW = new pc.Color(), FLASH = col('#e8eeff'), sky = new pc.Color();
  let time = 0;

  function setQuality(high) { sun.light.castShadows = high; hiQuality = high; }

  function update(G, dt, camera, selection, cityId = null) {
    time += dt;
    sync(G);
    const hour = hourOfDay(G), w = WEATHERS[G.weather.id];
    const day = clamp(Math.sin(((hour - 6) / 12) * Math.PI) + 0.15, 0, 1) * (G.weather.id === 'storm' ? 0.55 : 1);
    sun.setEulerAngles(35, 30, clamp((hour - 12) * 12, -80, 80));
    sun.light.intensity = 0.08 + 1.3 * day;
    bounce.light.intensity = 0.05 + 0.28 * day;
    sun.light.color = hour > 6 && hour < 8.5 || hour > 16.5 && hour < 19 ? col('#ffd9a8') : col('#fff4e0');
    app.scene.ambientLight.set(0.1 + 0.3 * day, 0.12 + 0.32 * day, 0.16 + 0.32 * day);
    DAYW.fromString(w.sky);
    sky.lerp(NIGHT, DAYW, day);
    const flashK = infra.weather(G, dt, camera.getPosition());
    if (flashK > 0.5) sky.lerp(sky, FLASH, 0.6);
    camera.camera.clearColor = sky; app.scene.fog.color = sky;
    app.scene.fog.start = G.weather.id === 'storm' ? 90 : 200; app.scene.fog.end = G.weather.id === 'storm' ? 330 : 560;
    infra.update(G, dt, day);

    M.bulb.emissiveIntensity = clamp((0.55 - day) * 5, 0, 2.5); M.bulb.update();
    if (cityId) cityView.update(G, G.cities[cityId], dt, day);
    if (mode !== 'nation') { updatePuffs(dt); return; }
    for (const v of nodeViews.values()) { v.update(G, dt, time, day); if (v.guard) v.guard.enabled = G.world.guards.includes(v.node.id); }
    // Tên lửa / phá hoại: chớp sáng tại điểm bị đánh
    const fx = G.world.strikeFx;
    if (fx.length > seenStrikes) {
      const n = nodeById(G, fx[fx.length - 1].id);
      seenStrikes = fx.length;
      if (n) { strikeLight.setPosition(n.x, groundY(n.x, n.z) + 10, n.z); strikeT = 1; for (let i = 0; i < 6; i++) emit(n.x, groundY(n.x, n.z) + 2, n.z, '#3b3b3b', 5, 10); }
    }
    strikeT = Math.max(0, strikeT - dt * 0.6); strikeLight.light.intensity = strikeT * 12;
    for (const v of lineViews.values()) v.update(time, selection?.kind === 'line' && selection.id === v.line.id, dt);
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

  return { update, setGhost, lineViews, setQuality, infraViews: infra.views, setMode, cityView };
}
