// Lưới điện nhiều nút (Giai đoạn 3).
// - Tìm các "đảo" lưới đang nối với nhau.
// - Mỗi đảo: cân bằng phát – tải, sa thải phụ tải khi thiếu nguồn, tính tần số.
// - Phân bố công suất kiểu DC: dòng chia theo độ dẫn y = U²/R (dây ngắn, điện áp cao gánh nhiều hơn).
// - Mỗi tuyến: dòng I, tổn hao I²R, sụt áp, nhiệt độ dây, rơ-le; mỗi trạm: nhiệt độ dầu máy biến áp.
// Đơn vị: MW, kV, km, Ω, °C. Mô hình đơn giản hoá cho trò chơi.

export const RHO_AL = 2.82e-8;
export const ALPHA_AL = 0.00403;
export const H_CONV = 35;
export const C_VOL = 900 * 2700;
export const WIRE_SAG_T = 80;
export const WIRE_FIRE_T = 250;
export const TX_FIRE_T = 150;
export const RELAY_DELAY = 1.5;
export const KM_PER_UNIT = 2;        // 1 đơn vị bản đồ 3D = 2 km

export const defaultImax = (A) => Math.round((A * 3.5) / 50) * 50;
export const RATED_MVA = { sub: 800, city: 900, nuclear: 1200, coal: 800 };

let nextId = 1;
export function createNode(o) {
  return {
    id: o.id ?? `n${nextId++}`, name: '', type: 'sub', x: 0, z: 0,
    rated: RATED_MVA[o.type ?? 'sub'], Tt: 45, state: 'ok', demandBase: 0,
    demand: 0, served: 0, frac: 0, gen: 0, cap: 0, through: 0, island: -1, hz: 0, ...o,
  };
}

export function createLine(o) {
  const A = o.A ?? 400;
  return {
    id: o.id ?? `l${nextId++}`, a: '', b: '', kv: 220, A, L: 50, quality: 1, Tw: 30,
    closed: true, state: 'ok', relay: true, Imax: defaultImax(A), trip: 0,
    R: 0, P: 0, I: 0, loss: 0, drop: 0, ...o,
  };
}

/** Điện trở tuyến ở nhiệt độ hiện tại; quality > 1 khi bị rút ruột vật tư. */
export const lineResistance = (l) =>
  ((RHO_AL * (1 + ALPHA_AL * (l.Tw - 20)) * l.L * 1000) / (l.A * 1e-6)) * l.quality;

export const lineUsable = (l) => l.state === 'ok' && l.closed;

/** Giải hệ tuyến tính A·x = b bằng khử Gauss có chọn trụ (A nhỏ, vài chục nút). */
export function solveLinear(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Chia các nút còn sống thành đảo theo những tuyến đang đóng điện. */
export function findIslands(net) {
  const alive = new Map(net.nodes.filter((n) => n.state === 'ok').map((n) => [n.id, n]));
  const adj = new Map([...alive.keys()].map((id) => [id, []]));
  for (const l of net.lines) {
    if (!lineUsable(l) || !alive.has(l.a) || !alive.has(l.b)) continue;
    adj.get(l.a).push(l); adj.get(l.b).push(l);
  }
  const islands = [], seen = new Set();
  for (const id of alive.keys()) {
    if (seen.has(id)) continue;
    const nodes = [], lines = new Set(), stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop();
      nodes.push(alive.get(cur));
      for (const l of adj.get(cur)) {
        lines.add(l);
        const o = l.a === cur ? l.b : l.a;
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    islands.push({ nodes, lines: [...lines] });
  }
  return islands;
}

/**
 * Một bước mô phỏng dt giây.
 * env: { cap: {nodeId: MW khả dụng}, demandMul, Ta }
 * emit(type, data): 'collapse' | 'trip' | 'lineFire' | 'txFire'
 */
export function stepNetwork(net, dt, env, emit = () => {}) {
  const byId = new Map(net.nodes.map((n) => [n.id, n]));
  for (const n of net.nodes) {
    const ok = n.state === 'ok';
    n.demand = ok && n.type === 'city' ? n.demandBase * env.demandMul : 0;
    n.cap = ok ? env.cap[n.id] ?? 0 : 0;
    n.gen = n.served = n.through = n.frac = n.hz = 0;
  }
  for (const l of net.lines) { l.R = lineResistance(l); l.P = l.I = l.loss = l.drop = 0; }

  const islands = findIslands(net);
  let D = 0, S = 0, G = 0, loss = 0, hzSum = 0, hzW = 0;
  islands.forEach((isl, k) => {
    const demand = isl.nodes.reduce((s, n) => s + n.demand, 0);
    const cap = isl.nodes.reduce((s, n) => s + n.cap, 0);
    const lossPrev = isl.lines.reduce((s, l) => s + (l.lossPrev ?? 0), 0);
    const need = demand + lossPrev;
    let f = 0, hz = 0;
    if (cap > 0 && need > 0) {
      f = Math.min(1, cap / need);
      hz = cap >= need ? 50 + 0.2 * Math.min(1, (cap - need) / need) : 49.8 - 1.2 * (1 - cap / need);
      // Điều độ: hạt nhân chạy nền trước, nhiệt điện bù phần còn thiếu
      let left = Math.min(cap, need);
      for (const type of ['nuclear', 'coal']) {
        for (const n of isl.nodes) {
          if (n.type !== type) continue;
          n.gen = Math.min(n.cap, left); left -= n.gen;
        }
      }
    } else if (cap > 0) hz = 50.2;
    for (const n of isl.nodes) {
      n.island = k; n.hz = hz;
      if (n.type === 'city') { n.frac = f; n.served = n.demand * f; }
    }
    D += demand; S += demand * f; G += isl.nodes.reduce((s, n) => s + n.gen, 0);
    if (demand > 0 && cap > 0) { hzSum += hz * demand; hzW += demand; }

    // Phân bố công suất: θ_slack = 0, B·θ = P
    if (isl.nodes.length < 2) return;
    const idx = new Map(isl.nodes.map((n, i) => [n.id, i]));
    const inj = isl.nodes.map((n) => n.gen - n.served);
    let slack = 0;
    isl.nodes.forEach((n, i) => { if (n.gen > isl.nodes[slack].gen) slack = i; });
    const m = isl.nodes.length, B = Array.from({ length: m }, () => new Array(m).fill(0));
    for (const l of isl.lines) {
      const y = (l.kv * l.kv) / Math.max(l.R, 1e-3), i = idx.get(l.a), j = idx.get(l.b);
      B[i][i] += y; B[j][j] += y; B[i][j] -= y; B[j][i] -= y;
    }
    const keep = [...Array(m).keys()].filter((i) => i !== slack);
    const theta = new Array(m).fill(0);
    const sol = solveLinear(keep.map((i) => keep.map((j) => B[i][j])), keep.map((i) => inj[i]));
    if (sol) keep.forEach((i, k2) => (theta[i] = sol[k2]));
    for (const l of isl.lines) {
      const y = (l.kv * l.kv) / Math.max(l.R, 1e-3);
      l.P = y * (theta[idx.get(l.a)] - theta[idx.get(l.b)]); // dương: từ a sang b
    }
  });

  // Từng tuyến: dòng, tổn hao, sụp áp, rơ-le
  for (const l of net.lines) {
    if (!lineUsable(l) || !l.P) { l.trip = 0; l.lossPrev = 0; continue; }
    const U = l.kv * 1e3, P = Math.abs(l.P) * 1e6, disc = U * U - 4 * l.R * P;
    if (disc < 0) {
      l.state = 'collapse'; l.P = 0; l.lossPrev = 0;
      emit('collapse', { line: l, MW: P / 1e6 });
      continue;
    }
    const I = (U - Math.sqrt(disc)) / (2 * l.R);
    if (l.relay && I > l.Imax) {
      l.trip += dt;
      if (l.trip > RELAY_DELAY) { l.state = 'tripped'; l.P = 0; l.lossPrev = 0; emit('trip', { line: l, I }); continue; }
    } else l.trip = 0;
    l.I = I; l.loss = I * I * l.R; l.drop = (I * l.R) / U; l.lossPrev = l.loss / 1e6;
    loss += l.loss / 1e6;
    byId.get(l.a).through += Math.abs(l.P) / 2; byId.get(l.b).through += Math.abs(l.P) / 2;
  }

  // Nhiệt độ dây (mọi tuyến, kể cả đang cắt điện thì nguội dần)
  for (const l of net.lines) {
    const A = l.A * 1e-6, rPerM = l.R / (l.L * 1000), d = Math.sqrt((4 * A) / Math.PI);
    const heat = l.I * l.I * rPerM, cool = H_CONV * Math.PI * d * (l.Tw - env.Ta);
    l.Tw = Math.min(700, Math.max(-20, l.Tw + ((heat - cool) / (C_VOL * A)) * dt));
    if (l.Tw >= WIRE_FIRE_T && l.state === 'ok') {
      l.state = 'fire'; l.I = l.P = 0; l.lossPrev = 0;
      emit('lineFire', { line: l });
    }
  }

  // Máy biến áp ở mỗi nút
  for (const n of net.nodes) {
    const Smva = n.type === 'city' ? n.served : n.type === 'sub' ? n.through : n.gen;
    const Tss = 40 + 60 * (Smva / n.rated) ** 2;
    n.Tt += ((Tss - n.Tt) * dt) / 600;
    if (n.Tt >= TX_FIRE_T && n.state === 'ok') { n.state = 'fire'; emit('txFire', { node: n }); }
  }

  net.summary = { demand: D, served: S, gen: G, loss, hz: hzW ? hzSum / hzW : 0, islands: islands.length };
}

/** Nút có đang nối (qua lưới) với một nguồn phát khác không – dùng cho "điện lưới ngoài" của nhà máy. */
export function connectedToOtherSource(net, nodeId) {
  const isl = findIslands(net).find((i) => i.nodes.some((n) => n.id === nodeId));
  return !!isl && isl.nodes.some((n) => n.id !== nodeId && n.cap > 0);
}

export function lineLengthKm(a, b) {
  return Math.max(5, Math.round(Math.hypot(a.x - b.x, a.z - b.z) * KM_PER_UNIT));
}
