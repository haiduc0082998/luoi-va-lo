// Thế giới 3D: địa hình, công trình theo dữ liệu lưới (thêm/bớt động), đường dây 3 pha trên cột,
// lò phản ứng nhìn xuyên, khói/hơi, lửa, phóng xạ, ngày/đêm, con trỏ chọn và bóng ma khi xây.
import * as pc from 'playcanvas';
import { clamp, ramp, WIRE_RAMP } from '../util.js';
import { RATED, dieselRunning } from '../physics/reactor.js';
import { lineUsable } from '../physics/network.js';
import { hourOfDay, nodeById, NUC_SCALE } from '../game.js';
import { height, WATER_Y, buildable, riverCenter, MAP_HALF, BORDER_X, PADS } from '../map.js';
import { buildTerrain, animateWater } from './terrain.js';
import { createInfra } from './infra3d.js';
import { createCityView } from './cityview.js';
import { canPlace, BUILDS } from '../infra.js';
import { WEATHERS } from '../weather.js';
import { col, col255, mat, ent, light, setBeam, beam, fire, seeded, lamp, model } from './kit.js';

const SEG = 6;
export const ATTACH = { nuclear: [14, 9, 9], coal: [7, 9, 6], sub: [0, 7.4, 0], city: [0, 10, 0], hydro: [12, 11, 3], border: [-4, 7.4, 0], wind: [0, 9, 0], mine: [8, 13, 0], solar: [-9, 4, 0], battery: [-6, 4, 0] };
export const PICK_RADIUS = { nuclear: 18, coal: 15, sub: 6, city: 14, hydro: 13, border: 9, wind: 11, mine: 14, solar: 11, battery: 8 };
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

  // ---------- Cây cối rải rác: hardware instancing (cả rừng chỉ 2 draw call: thân + tán) ----------
  let clearTrees = () => {};
  {
    const rnd = seeded('trees'), trunks = [], crowns = [], spots = [], q = new pc.Quat();
    for (let i = 0; i < 520; i++) {
      const x = (rnd() - 0.5) * 2 * (MAP_HALF - 8), z = (rnd() - 0.5) * 2 * (MAP_HALF - 8), y = height(x, z);
      if (y < 0.3 || y > 10) continue;
      if (PADS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r * 1.9 + 4)) continue; // không mọc trong khuôn viên công trình
      if (Math.abs(x - 4) < 40 && z > -58 && z < 2) continue;                           // khu nhà máy hạt nhân (cả Chernobyl)
      const s = 0.7 + rnd() * 0.7;
      spots.push([x, z]);
      trunks.push(new pc.Mat4().setTRS(new pc.Vec3(x, y + 1 * s, z), q, new pc.Vec3(0.4 * s, 2 * s, 0.4 * s)));
      crowns.push(new pc.Mat4().setTRS(new pc.Vec3(x, y + 3.4 * s, z), q, new pc.Vec3(3 * s, 4 * s, 3 * s)));
    }
    const instanced = (type, material, mats) => {
      const e = new pc.Entity(`trees-${type}`); world.addChild(e);
      e.addComponent('render', { type, material, castShadows: true, receiveShadows: true });
      const data = new Float32Array(mats.length * 16);
      mats.forEach((m, i) => data.set(m.data, i * 16));
      const vb = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), mats.length, { data });
      e.render.meshInstances[0].setInstancing(vb);
      e.render.meshInstances[0].cull = false; // hộp bao là của một cây, không dùng để loại khỏi khung nhìn
      return { data, vb };
    };
    const T = instanced('cylinder', M.trunk, trunks), C = instanced('cone', M.leaf, crowns);
    // Xây công trình mới thì chặt cây trong khuôn viên (thu ma trận về 0 để GPU bỏ qua)
    clearTrees = (x, z, r) => {
      let hit = false;
      spots.forEach(([tx, tz], i) => {
        if (Math.hypot(tx - x, tz - z) > r) return;
        for (const { data } of [T, C]) for (let j = 0; j < 16; j++) data[i * 16 + j] = 0;
        hit = true;
      });
      if (hit) for (const { data, vb } of [T, C]) vb.setData(data);
    };
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

  let hiQuality = true; // đồ hoạ cao / thấp (bóng đổ nhiều tầng)
  // ---------- Công trình theo loại ----------
  const builders = {
    nuclear(n, g) {
      // Nhà máy hạt nhân = mô hình cụm 4 khối lò (chernobyl_game_complex.glb người chơi gửi), tỉ lệ NUC_SCALE, quay 180°
      // để khu phụ trợ trải về phía đông bắc (tránh sông và đập thuỷ điện). Gốc mô hình = tâm khối lò thứ 4 = tổ máy 1
      // (trùng tâm nút trên lưới); khối thứ 3 là tổ máy 2. Mô hình chỉ là vỏ: mọi trạng thái (công suất, nhiệt độ,
      // SCRAM, nổ, sửa chữa) thể hiện qua các phần động bên dưới.
      const S = NUC_SCALE, y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      const site = new pc.Entity('nuc-model'); site.setLocalPosition(0, 0.03, 0); site.setLocalEulerAngles(0, 180, 0); g.addChild(site);
      const P = (X, Y, Z) => [(50 - X) * S, Y * S, -(Z + 12) * S]; // toạ độ mô hình gốc → toạ độ trong nhà máy
      const U2 = P(15, 0, -12); // tâm tổ máy 2 (hall2)
      const ROOF = 14.8 * S;
      // Hình tạm khi mô hình đang tải
      const tmp = new pc.Entity(); site.addChild(tmp);
      ent(tmp, 'box', [0, 2, 0], [30 * S, 14 * S, 25 * S], M.concrete);
      ent(tmp, 'box', [35 * S, 2, 0], [30 * S, 14 * S, 25 * S], M.concrete);
      const parts = { u1: null, u2: null, u1Win: null, u2Win: null, ruin1: [], ruin2: [], arch: null };
      const winMat = mat('#2b3540', { emissive: '#ffcf7a', ei: 0 }); // cửa sổ: sáng đèn về đêm
      model(site, 'chernobyl_complex', S, 0, tmp, (e) => {
        const f = (name) => e.findByName(name);
        Object.assign(parts, { u1: f('Unit1'), u2: f('Unit2'), u1Win: f('Unit1_Win'), u2Win: f('Unit2_Win'), arch: f('Arch'),
          ruin1: [f('Unit1_Ruin'), f('Unit1_Rubble')], ruin2: [f('Unit2_Ruin'), f('Unit2_Rubble')] });
        for (const name of ['Unit1_Win', 'Unit2_Win', 'Windows']) for (const mi of f(name)?.render?.meshInstances ?? []) mi.material = winMat;
      });
      // Nắp lò phát sáng trên mái mỗi tổ máy: màu & độ sáng theo công suất và nhiệt độ lõi (xanh Cherenkov → cam → đỏ)
      const lid1 = ent(g, 'cylinder', [0, ROOF + 0.06, 0], [3.2, 0.1, 3.2], M.ring, false);
      const ring2 = mat('#0b2230', { emissive: '#28beff', ei: 1.2 });
      const lid2 = ent(g, 'cylinder', [U2[0], ROOF + 0.06, U2[2]], [3.2, 0.1, 3.2], ring2, false);
      const coreLight = light(g, [0, ROOF + 1.2, 0], '#5cc8ff', 7); // ánh sáng hắt nhẹ quanh mái, không phủ cả khu
      const light2 = light(g, [U2[0], ROOF + 1.2, U2[2]], '#5cc8ff', 7);
      const corium = ent(g, 'sphere', [0, 0.6, 0], [4, 1.1, 4], M.corium, false); corium.enabled = false;
      // Đèn đỏ báo không lưu trên 3 ống khói thông gió (cao 30 → 8,4 đơn vị), nhấp nháy
      const beacon = mat('#400000', { emissive: '#ff2a1a', ei: 0 });
      for (const X of [5, -33, -68]) { const [x, y, z] = P(X, 30, -25); ent(g, 'sphere', [x, y + 0.25, z], [0.5, 0.5, 0.5], beacon, false); }
      // Công trường tổ máy 2: tường lên dần theo tiến độ, cần cẩu quay
      const build2 = new pc.Entity(); build2.setLocalPosition(U2[0], 0, U2[2]); g.addChild(build2);
      const wall = ent(build2, 'box', [0, 0, 0], [30 * S, 1, 25 * S], M.concrete);
      ent(build2, 'box', [-5, 6, -5], [0.5, 12, 0.5], M.flag);
      const jib = new pc.Entity(); jib.setLocalPosition(-5, 12, -5); build2.addChild(jib);
      ent(jib, 'box', [3.5, 0, 0], [10, 0.4, 0.4], M.flag);
      build2.enabled = false;
      // Mảnh vỡ văng lên khi nổ, ánh chớp, đám cháy than chì / nhiên liệu trong gian lò
      const debris = [[3, 9, 2, 25], [-4, 8, -3, -35], [1, 12, -5, 60], [-6, 10, 4, -15]].map(([dx, y, dz, r]) => {
        const e = ent(g, 'box', [dx, y, dz], [3, 0.5, 2], M.concrete); e.setLocalEulerAngles(r, r * 2, r / 2); e.enabled = false; return e;
      });
      const plume = ent(world, 'sphere', [0, -50, 0], [1, 1, 1], M.plume, false); plume.enabled = false;
      const flash = light(g, [0, 16, 0], '#ffffff', 160);
      const blaze = fire(g, [0, 1.6, 0], 2, M);
      // Trạm diesel dự phòng + đèn trạng thái nguồn tự dùng (xanh: diesel chạy, vàng: mất lưới, đỏ: hỏng diesel)
      ent(g, 'box', [-14, 1.5, 6], [4, 3, 3], M.concrete);
      ent(g, 'sphere', [-14, 3.4, 6], [0.9, 0.9, 0.9], M.lamp, false);
      // Bệ phòng không (hiện khi có quân canh gác nhà máy)
      const sam = new pc.Entity(); sam.setLocalPosition(-12, 0, -10); g.addChild(sam);
      ent(sam, 'box', [0, 0.8, 0], [4, 1.6, 2.6], M.army);
      const tube = ent(sam, 'box', [0, 2.6, 0], [1.2, 1.2, 4.6], M.army); tube.setLocalEulerAngles(-35, 0, 0);
      for (const [x, z] of [[-11, -16], [-11, 10], [38, -16], [38, 10]]) lamp(g, x, 0, z, M);

      const glow = (R, m, Lt) => { // màu nắp lò + đèn lõi theo trạng thái một tổ máy
        const hotK = clamp((R.T - 380) / 400, 0, 1);
        col255(R.melt ? [255, 110, 30] : hotK > 0 ? [255, Math.round(150 - 120 * hotK), 30] : [40, 190, 255], m.emissive);
        m.emissiveIntensity = R.melt ? 3 : 0.3 + clamp((R.Pf / RATED) * 1.6, 0, 3) + hotK * 2; m.update();
        Lt.light.color = R.melt ? col('#ff8a2a') : col('#5cc8ff');
        Lt.light.intensity = R.melt ? 2 : clamp((R.Pf / RATED) * 1.2, 0, 1.6);
      };
      let blink = 0;
      return (G, dt, t, day) => {
        const R = G.reactor, R2 = G.reactor2, rep1 = G.repair?.[1], rep2 = G.repair?.[2];
        const wreck1 = R.boom || rep1?.kind === 'core', wreck2 = !!R2?.boom || rep2?.kind === 'core';
        sam.enabled = G.world.guards.includes(n.id);
        // Khối lò: nguyên vẹn / đổ nát; mái vòm che an toàn dựng lên khi đang dọn dẹp, thay lõi tổ máy 1
        if (parts.u1) parts.u1.enabled = parts.u1Win.enabled = !wreck1;
        parts.ruin1.forEach((e) => e && (e.enabled = wreck1));
        if (parts.arch) parts.arch.enabled = rep1?.kind === 'core';
        const st2 = G.unit2?.state, has2 = !!R2 || rep2;
        if (parts.u2) parts.u2.enabled = parts.u2Win.enabled = has2 && !wreck2;
        parts.ruin2.forEach((e) => e && (e.enabled = !!wreck2));
        build2.enabled = st2 === 'building';
        if (build2.enabled) { const k = Math.max(0.05, G.unit2.progress), h = 14 * S * k; wall.setLocalScale(30 * S, h, 25 * S); wall.setLocalPosition(0, h / 2, 0); jib.setLocalEulerAngles(0, t * 12, 0); }
        // Nắp lò & đèn lõi
        lid1.enabled = !rep1; lid1.setLocalPosition(0, R.boom ? 0.5 : ROOF + 0.06, 0);
        glow(R, M.ring, coreLight); corium.enabled = R.melt;
        lid2.enabled = !!R2 && !rep2; light2.enabled = !!R2;
        if (R2) { lid2.setLocalPosition(U2[0], R2.boom ? 0.5 : ROOF + 0.06, U2[2]); glow(R2, ring2, light2); }
        // Cửa sổ sáng về đêm (khi nhà máy còn điện tự dùng), đèn không lưu nhấp nháy
        winMat.emissiveIntensity = (1 - day) * (R.offsite || R.Pe > 0 ? 1.4 : 0.2); winMat.update();
        blink += dt; beacon.emissiveIntensity = blink % 1.4 < 0.5 ? 3 : 0; beacon.update();
        M.lamp.emissive = col(!R.diesel ? '#ff5434' : dieselRunning(R) ? '#36b2ff' : !R.offsite ? '#f2b13a' : '#202020');
        M.lamp.emissiveIntensity = 2; M.lamp.update();
        // Nổ: mảnh vỡ, chớp sáng, cháy; chùm phóng xạ theo hướng gió
        debris.forEach((d) => (d.enabled = R.boom));
        blaze.set(R.boom && R.T > 600, t);
        R.flash = Math.max(0, R.flash - dt * 0.8); flash.light.intensity = R.flash * 10;
        const rel = Math.max(R.release, R2?.release ?? 0), pl = Math.max(R.plume, R2?.plume ?? 0);
        plume.enabled = rel > 0;
        if (plume.enabled) {
          const len = 10 + pl * 90, w = (R.wind * Math.PI) / 180;
          plume.setLocalPosition(n.x + Math.sin(w) * len, y0 + 16, n.z - Math.cos(w) * len);
          plume.setLocalEulerAngles(0, -R.wind, 0);
          plume.setLocalScale(10 + pl * 30, 5 + pl * 5, len * 2);
        }
        M.core.emissive = M.ring.emissive; M.core.emissiveIntensity = M.ring.emissiveIntensity; M.core.update();
      };
    },

    coal(n, g) {
      const y0 = groundY(n.x, n.z);
      g.setLocalPosition(n.x, y0, n.z);
      // Mô hình nhà máy nhiệt điện (nha_may_nhiet_dien.glb người chơi gửi), phóng 1,3 lần; hình dựng sẵn dùng tạm khi đang tải
      const tmp = new pc.Entity(); g.addChild(tmp);
      ent(tmp, 'box', [0, 4, 0], [12, 8, 10], M.concrete);
      ent(tmp, 'box', [0, 8.5, 0], [12.4, 1, 10.4], M.roof);
      ent(tmp, 'cylinder', [-3, 12, -3], [1.8, 24, 1.8], M.concrete);
      ent(tmp, 'cylinder', [2, 11, -3], [1.6, 22, 1.6], M.concrete);
      model(g, 'thermal', 1.3, 0, tmp);
      ent(g, 'cone', [-25, 2, 9], [8, 4, 8], M.coalPile); // bãi than cạnh tấm nền
      // Khói than ra 2 ống khói, hơi nước trắng ra 2 tháp làm mát (vị trí lấy từ mô hình × 1,3)
      const STACKS = [[-2.6, 15.6, -7.8], [-6.5, 15.6, -7.8]], TOWERS = [[16.9, 10.4, 5.2], [10.4, 10.4, 5.2]];
      let acc = 0;
      return (G, dt) => {
        acc += dt * 4 * clamp(n.gen / 600, 0, 1);
        while (acc >= 1) {
          acc -= 1;
          for (const [x, y, z] of STACKS) emit(n.x + x, y0 + y, n.z + z, '#5f6466', 3, 7);
          const [x, y, z] = TOWERS[Math.random() < 0.5 ? 0 : 1]; emit(n.x + x, y0 + y, n.z + z, '#f0f2f1', 3.5, 6);
        }
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
      const arm = ent(g, 'box', [3, 1.4, 0], [0.3, 0.3, 7], M.flag); arm.name = 'moving';
      ent(g, 'cylinder', [-4, 6, 5], [0.2, 12, 0.2], M.metal);
      const flag = ent(g, 'box', [-4, 11, 6.3], [0.05, 1.6, 2.6], M.flag, false); flag.name = 'moving';
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
      // Nhà cửa dựng lại khi thành phố được nâng cấp: nhiều toà hơn, cao hơn
      let bld = null, builtLv = 0, side = 1, bldBatch = -1;
      const makeBuildings = () => {
        bld?.destroy(); if (bld) app.batcher.removeGroup(bldBatch); bld = new pc.Entity(); g.addChild(bld); builtLv = n.lv ?? 1;
        const r = seeded(n.id), count = Math.round(4 + n.demandBase / 60), hk = 1 + 0.3 * (builtLv - 1);
        side = Math.ceil(Math.sqrt(count));
        for (let i = 0; i < count; i++) {
          const h = (6 + r() * (n.demandBase / 25)) * hk;
          const x = ((i % side) - (side - 1) / 2) * 5.2 + (r() - 0.5), z = (Math.floor(i / side) - (side - 1) / 2) * 5.6 + (r() - 0.5);
          ent(bld, 'box', [x, h / 2, z], [3.8 + r(), h, 4 + r()], m);
        }
        bldBatch = staticBatch(bld, `city-${n.id}-${builtLv}`); // cả cụm nhà: 1 lệnh vẽ
      };
      makeBuildings();
      const glow = light(g, [0, 8, 0], '#ffc861', 34);
      const ring = side * 2.9 + 3;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lamp(g, Math.cos(a) * ring, 0, Math.sin(a) * ring, M); }
      const blaze = fire(g, [side * 2.6 + 2, 1, 0], 1, M);
      return (G, dt, t, day) => {
        if ((n.lv ?? 1) !== builtLv) makeBuildings();
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
    // Cả 3 pha × mọi khoảng cột × SEG đoạn võng gộp thành MỘT lưới động (1 draw call cho mỗi tuyến),
    // mỗi đoạn là một lăng trụ vuông mảnh; chỉ dựng lại khi độ võng (theo nhiệt độ dây) đổi.
    const nSeg = 3 * spans * SEG, wpos = new Float32Array(nSeg * 8 * 3), wnor = new Float32Array(nSeg * 8 * 3), widx = [];
    for (let k = 0; k < nSeg; k++) {
      const o = k * 8;
      for (let c = 0; c < 4; c++) { const c2 = (c + 1) % 4; widx.push(o + c, o + c2, o + 4 + c, o + c2, o + 4 + c2, o + 4 + c); }
    }
    const wireMesh = new pc.Mesh(app.graphicsDevice);
    wireMesh.setPositions(wpos); wireMesh.setNormals(wnor); wireMesh.setIndices(widx); wireMesh.update();
    const wireEnt = new pc.Entity('wires'); g.addChild(wireEnt);
    wireEnt.addComponent('render', { meshInstances: [new pc.MeshInstance(wireMesh, wireMat)], castShadows: false });
    const D = new pc.Vec3(), U = new pc.Vec3(), V = new pc.Vec3(), UP = new pc.Vec3(0, 1, 0), SIDE = new pc.Vec3(1, 0, 0);
    const prism = (k, a, b, w) => { // ghi lăng trụ thứ k từ a tới b, bán kính w (a = b: suy biến, không thấy)
      D.sub2(b, a); const L = D.length();
      if (L < 1e-6) { for (let j = 0; j < 8; j++) wpos.set([a.x, a.y, a.z], (k * 8 + j) * 3); return; }
      D.mulScalar(1 / L); U.cross(D, Math.abs(D.y) > 0.95 ? SIDE : UP).normalize(); V.cross(U, D).normalize();
      for (let c = 0; c < 4; c++) {
        const su = c === 0 || c === 3 ? 1 : -1, sv = c < 2 ? 1 : -1;
        const nx = U.x * su + V.x * sv, ny = U.y * su + V.y * sv, nz = U.z * su + V.z * sv;
        for (const [j, p] of [[c, a], [c + 4, b]]) {
          const i3 = (k * 8 + j) * 3;
          wpos[i3] = p.x + nx * w; wpos[i3 + 1] = p.y + ny * w; wpos[i3 + 2] = p.z + nz * w;
          wnor[i3] = nx * 0.7071; wnor[i3 + 1] = ny * 0.7071; wnor[i3 + 2] = nz * 0.7071;
        }
      }
    };
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
    const batch = staticBatch(g, `line-${l.id}`, [wireEnt, fA.g, fB.g, ...pulses.map((p) => p.e)]); // cột + sứ: gộp tĩnh
    return {
      g, batch, polyline: tops, mid: at(0.5),
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
          let k = 0;
          for (let ph = 0; ph < 3; ph++) {
            const pts = phases[ph];
            for (let s = 0; s < spans; s++) {
              const br = broken && s === mid;
              for (let i = 0; i < SEG; i++, k++) {
                pointOn(pts[s], pts[s + 1], i / SEG, sag, br, P0);
                if (br && i === SEG / 2) { prism(k, P0, P0, 0); continue; } // chỗ dây đứt
                pointOn(pts[s], pts[s + 1], (i + 1) / SEG, sag, br, P1);
                prism(k, P0, P1, 0.07);
              }
            }
          }
          wireMesh.setPositions(wpos); wireMesh.setNormals(wnor); wireMesh.update();
        }
        if (selected) { wireMat.diffuse = col('#36b2ff'); wireMat.emissive = col('#36b2ff'); wireMat.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 5); }
        else {
          // Màu theo mức tải I/Imax: xanh lá ổn định, vàng cận tải (> 70 %), đỏ quá tải (> 90 %); dây cắt thì xám tối
          const k = live ? l.I / l.Imax : 0;
          wireMat.diffuse = !live ? col('#4a4f52') : k > 0.9 ? col('#e0453a') : k > 0.7 ? col('#e8b02a') : col('#5fae6e');
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
  // Gộp tĩnh (BatchManager): các khối không bao giờ di chuyển của một công trình / một tuyến dây gộp thành vài lưới,
  // mỗi vật liệu một lệnh vẽ. Mỗi công trình / tuyến một nhóm riêng, nên khi bị ẩn (ngoài khung nhìn) hay bị xoá
  // thì chỉ nhóm của nó phải dựng lại. Phần chuyển động (xung điện, lửa, cần cẩu…) truyền vào `skip`.
  function staticBatch(root, key, skip = []) {
    const grp = app.batcher.addGroup(key, false, 400);
    const out = new Set(skip.flatMap((e) => e.find(() => true)));
    for (const r of root.findComponents('render')) if (!out.has(r.entity)) r.batchGroupId = grp.id;
    return grp.id;
  }
  // Bán kính bao của từng loại công trình (để kiểm tra có nằm trong khung nhìn không)
  // Công trình gộp tĩnh được + các phần chuyển động cần giữ riêng (trả về danh sách thực thể)
  const STATIC_NODES = { solar: (g) => g.children.filter((c) => c.name === 'fire'), battery: (g) => g.children.filter((c) => c.name === 'fire' || c.name === 'moving'), sub: (g) => g.children.filter((c) => c.name === 'fire'), border: (g) => g.children.filter((c) => c.name === 'moving') };
  const VIEW_R = { nuclear: 60, city: 34, coal: 30, hydro: 34, sub: 14, border: 18, wind: 22, mine: 26, solar: 18, battery: 14 };
  const cull = { shown: 0, hidden: 0 }, sph = new pc.BoundingSphere();
  const inView = (fr, x, y, z, r) => { sph.center.set(x, y, z); sph.radius = r; return fr.containsSphere(sph) > 0; };
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
    for (const [id, v] of nodeViews) if (!G.net.nodes.some((n) => n.id === id)) { v.g.destroy(); v.guard?.destroy(); if (v.batch) app.batcher.removeGroup(v.batch); nodeViews.delete(id); }
    infra.sync(G);
    for (const n of G.net.nodes) {
      if (nodeViews.has(n.id)) continue;
      const g = new pc.Entity(`node-${n.id}`); world.addChild(g);
      if (PICK_RADIUS[n.type] && !['nuclear', 'coal', 'hydro', 'city'].includes(n.type)) clearTrees(n.x, n.z, PICK_RADIUS[n.type] + 3);
      const v = { g, update: builders[n.type](n, g), node: n, guard: n.type === 'border' ? null : makeGuard(n) };
      if (STATIC_NODES[n.type]) v.batch = staticBatch(g, `node-${n.id}`, STATIC_NODES[n.type](g)); // công trình ít chuyển động: gộp tĩnh
      nodeViews.set(n.id, v);
    }
    for (const [id, v] of lineViews) if (!G.net.lines.some((l) => l.id === id)) { v.g.destroy(); app.batcher.removeGroup(v.batch); lineViews.delete(id); }
    for (const l of G.net.lines) {
      if (lineViews.has(l.id)) continue;
      const a = nodeById(G, l.a), b = nodeById(G, l.b);
      lineViews.set(l.id, { ...buildLine(l, a, b), line: l, half: Math.hypot(a.x - b.x, a.z - b.z) / 2 });
    }
  }

  // ---------- Con trỏ chọn & bóng ma ----------
  const marker = ent(world, 'cone', [0, -50, 0], [2.4, 3, 2.4], M.marker, false);
  const ghost = ent(world, 'box', [0, -50, 0], [9, 7, 9], M.ghostOk, false);
  const ghostLine = ent(world, 'box', [0, -50, 0], [0.4, 0.4, 1], M.ghostOk, false);
  ghost.enabled = ghostLine.enabled = false;
  const gp = new pc.Vec3(), gq = new pc.Vec3();
  const GHOST_SIZE = { sub: [9, 7, 9], wind: [18, 18, 18], solar: [20, 3, 16], battery: [14, 4, 10], city: [22, 14, 22], tower: [18, 22, 18], road: [6, 1, 46], port: [10, 6, 18], airport: [50, 2, 7] };
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
  // Bóng đổ 3 tầng (cascade): sắc nét gần camera, vẫn phủ được cả bản đồ khi nhìn toàn cảnh
  sun.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 2048, shadowDistance: 320, numCascades: 3, cascadeDistribution: 0.55, shadowType: pc.SHADOW_PCF3_32F, shadowBias: 0.35, normalOffsetBias: 0.25, intensity: 1.2 });
  world.addChild(sun);
  // Trời sao: 900 tam giác nhỏ trên vòm bán kính 800, chỉ hiện khi trời tối và quang
  const starMat = new pc.StandardMaterial();
  starMat.useLighting = false; starMat.useFog = false; starMat.diffuse = new pc.Color(0, 0, 0);
  starMat.emissive = new pc.Color(1, 1, 1); starMat.emissiveIntensity = 0; starMat.depthWrite = false; starMat.cull = pc.CULLFACE_NONE;
  starMat.update();
  const stars = (() => {
    const pos = [], rnd = seeded('stars');
    for (let i = 0; i < 900; i++) {
      const u = rnd(), v = 0.08 + rnd() * 0.92, th = u * Math.PI * 2, ph = Math.acos(v), R = 800, s = 2.2 + rnd() * 3.2;
      const c = new pc.Vec3(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph), R * Math.sin(ph) * Math.sin(th));
      const t1 = new pc.Vec3().cross(c, pc.Vec3.UP).normalize().mulScalar(s), t2 = new pc.Vec3().cross(c, t1).normalize().mulScalar(s);
      for (const p of [c.clone().add(t1), c.clone().sub(t1).add(t2), c.clone().sub(t1).sub(t2)]) pos.push(p.x, p.y, p.z);
    }
    const mesh = new pc.Mesh(app.graphicsDevice); mesh.setPositions(pos); mesh.setIndices([...Array(pos.length / 3).keys()]); mesh.update();
    const e = new pc.Entity('stars'); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, starMat)], castShadows: false, receiveShadows: false });
    world.addChild(e); return e;
  })();
  // Ánh sáng hắt từ mặt đất (thay cho đèn bán cầu): chiếu ngược lên, màu cỏ, không đổ bóng
  const bounce = new pc.Entity('bounce');
  bounce.addComponent('light', { type: 'directional', castShadows: false, color: col('#7f9e6a'), intensity: 0.25 });
  bounce.setEulerAngles(180, 0, 20);
  world.addChild(bounce);
  app.scene.fog.type = pc.FOG_LINEAR; app.scene.fog.start = 240; app.scene.fog.end = 700;
  const NIGHT = col('#0b1420'), DAYW = new pc.Color(), FLASH = col('#e8eeff'), sky = new pc.Color();
  let time = 0;

  function setQuality(high) { sun.light.castShadows = high; sun.light.numCascades = high ? 3 : 1; hiQuality = high; cityView.setDensity(high ? 1 : 0.5); }
  // Bóng đổ: chỉ vẽ lại bản đồ bóng khi camera di chuyển, còn khi đứng yên thì 6 khung hình một lần
  // (đủ cho mặt trời di chuyển chậm và xe cộ nhỏ), tiết kiệm cả một lượt vẽ toàn cảnh mỗi khung hình.
  sun.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
  const lastCam = new pc.Mat4(); let shadowFrame = 0;
  function throttleShadows(camera) {
    const m = camera.getWorldTransform(), moved = !m.equals(lastCam);
    if (moved) lastCam.copy(m);
    shadowFrame++;
    if (moved || shadowFrame % 6 === 0) sun.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
  }

  function update(G, dt, camera, selection, cityId = null) {
    time += dt;
    sync(G);
    throttleShadows(camera);
    const hour = hourOfDay(G), w = WEATHERS[G.weather.id];
    const day = clamp(Math.sin(((hour - 6) / 12) * Math.PI) + 0.15, 0, 1) * (1 - (w.dim ?? 0));
    sun.setEulerAngles(35, 30, clamp((hour - 12) * 12, -80, 80));
    // Ban đêm “mặt trời” thành ánh trăng xanh nhạt; nền đêm sáng hơn một chút vì tone mapping ACES nén vùng tối
    sun.light.intensity = 0.32 + 1.1 * day;
    bounce.light.intensity = 0.06 + 0.28 * day;
    sun.light.color = day < 0.12 ? col('#9fb7e8') : hour > 6 && hour < 8.5 || hour > 16.5 && hour < 19 ? col('#ffd9a8') : col('#fff4e0');
    // Màu nền tính theo gamma (PlayCanvas đổi sang tuyến tính): đêm trăng xanh lam, ngày trung tính
    app.scene.ambientLight.set(0.38 - 0.03 * day, 0.42 - 0.04 * day, 0.52 - 0.1 * day);
    app.scene.exposure = 1 + 0.7 * (1 - day) ** 2; // mắt thích nghi bóng tối: phơi sáng cao hơn về đêm
    DAYW.fromString(w.sky);
    sky.lerp(NIGHT, DAYW, day);
    const flashK = infra.weather(G, dt, camera.getPosition());
    if (flashK > 0.5) sky.lerp(sky, FLASH, 0.6);
    camera.camera.clearColor = sky; app.scene.fog.color = sky;
    // Sao nhấp nháy nhẹ, đi theo camera để luôn ở “vô cực”
    stars.setPosition(camera.getPosition());
    starMat.emissiveIntensity = clamp((0.35 - day) * 4, 0, 1) * (1 - 0.8 * w.cover) * (0.85 + 0.15 * Math.sin(time * 1.7)); starMat.update();
    stars.enabled = starMat.emissiveIntensity > 0.01;
    animateWater(time, G.windNow ?? 5);
    app.scene.fog.start = w.fog?.[0] ?? 240; app.scene.fog.end = w.fog?.[1] ?? 700;
    if (mode === 'nation') {
      const fr0 = camera.camera.frustum;
      cull.shown = 0; cull.hidden = 0;
      infra.update(G, dt, day, (x, z, r) => inView(fr0, x, groundY(x, z) + 6, z, r), cull);
    }

    M.bulb.emissiveIntensity = clamp((0.55 - day) * 5, 0, 2.5); M.bulb.update();
    if (cityId) cityView.update(G, G.cities[cityId], dt, day);
    if (mode !== 'nation') { updatePuffs(dt); return; }
    // Ẩn vùng ngoài màn hình: công trình / tuyến dây không nằm trong khung nhìn thì tắt hẳn (không vẽ, không chạy
    // hoạt cảnh). Logic game vẫn chạy đủ trong advance(); khi quay lại vùng đó, hàm update vẽ lại đúng trạng thái hiện tại.
    const fr = camera.camera.frustum;
    for (const v of nodeViews.values()) {
      const off = v.node.type === 'nuclear' ? 14 : 0; // khu nhà máy hạt nhân lệch về phía đông bắc tâm lò
      const on = inView(fr, v.node.x + off, groundY(v.node.x, v.node.z) + 8, v.node.z - off * 0.4, VIEW_R[v.node.type] ?? 18);
      if (v.g.enabled !== on) v.g.enabled = on;
      if (v.guard) v.guard.enabled = on && G.world.guards.includes(v.node.id);
      if (on) { v.update(G, dt, time, day); cull.shown++; } else cull.hidden++;
    }
    // Tên lửa / phá hoại: chớp sáng tại điểm bị đánh
    const fx = G.world.strikeFx;
    if (fx.length > seenStrikes) {
      const n = nodeById(G, fx[fx.length - 1].id);
      seenStrikes = fx.length;
      if (n) { strikeLight.setPosition(n.x, groundY(n.x, n.z) + 10, n.z); strikeT = 1; for (let i = 0; i < 6; i++) emit(n.x, groundY(n.x, n.z) + 2, n.z, '#3b3b3b', 5, 10); }
    }
    strikeT = Math.max(0, strikeT - dt * 0.6); strikeLight.light.intensity = strikeT * 12;
    for (const v of lineViews.values()) {
      const on = inView(fr, v.mid.x, v.mid.y, v.mid.z, v.half + 12);
      if (v.g.enabled !== on) v.g.enabled = on;
      if (on) { v.update(time, selection?.kind === 'line' && selection.id === v.line.id, dt); cull.shown++; } else cull.hidden++;
    }
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

  // Hàng rào + cột mốc biên giới phía đông (bên kia là nước láng giềng)
  {
    const fence = new pc.Entity('border-fence'); world.addChild(fence);
    for (let z = -MAP_HALF + 12; z < MAP_HALF - 8; z += 9) {
      const y = groundY(BORDER_X, z);
      if (y < -0.5) continue;
      ent(fence, 'cylinder', [BORDER_X, y + 1.2, z], [0.35, 2.4, 0.35], M.metal);
      ent(fence, 'box', [BORDER_X, y + 1.7, z + 4.5], [0.12, 0.5, 9], M.army ?? M.metal, false);
    }
    for (let z = -MAP_HALF + 30; z < MAP_HALF; z += 60) { const y = groundY(BORDER_X, z); ent(fence, 'box', [BORDER_X, y + 2, z], [1.4, 4, 1.4], M.flag ?? M.metal); }
    staticBatch(fence, 'border-fence');
  }

  return { update, setGhost, lineViews, setQuality, infraViews: infra.views, setMode, cityView, cull };
}
