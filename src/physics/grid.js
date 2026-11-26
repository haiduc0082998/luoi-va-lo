// Mô phỏng lưới truyền tải (Giai đoạn 1): định luật Ohm, tổn hao I²R, nhiệt độ dây, rơ-le, máy biến áp.
// Mô hình một pha, đơn giản hoá cho trò chơi – đúng bậc độ lớn, không dùng để thiết kế thật.

export const RHO_AL = 2.82e-8;   // điện trở suất nhôm ở 20 °C (Ω·m)
export const ALPHA_AL = 0.00403; // hệ số nhiệt điện trở (1/°C)
export const H_CONV = 35;        // hệ số tản nhiệt đối lưu + bức xạ (W/m²·K), có gió nhẹ
export const C_VOL = 900 * 2700; // nhiệt dung riêng × khối lượng riêng của nhôm (J/m³·K)
export const WIRE_SAG_T = 80;    // °C: bắt đầu võng
export const WIRE_FIRE_T = 250;  // °C: võng chạm cây, cháy
export const TX_RATED_MVA = 400;
export const TX_FIRE_T = 150;
export const RELAY_DELAY = 1.5;  // giây trễ trước khi rơ-le cắt

export const createGrid = (o = {}) => ({
  kv: 220, L: 120, A: 400, P: 220, Ta: 30, relay: true, Imax: 1500,
  Tw: 55, Tt: 52, line: 'ok', tx: 'ok',
  I: 0, R: 0, U2: 0, drop: 0, loss: 0, trip: 0, ...o,
});

export const hasTransformer = (C) => C.kv !== 10.5;
export const isPowered = (C) => C.I > 0;

/** Bước mô phỏng dt giây (thời gian trong game). emit(type, data) báo sự kiện. */
export function stepGrid(C, dt, emit = () => {}) {
  const A = C.A * 1e-6;
  const rPerM = (RHO_AL * (1 + ALPHA_AL * (C.Tw - 20))) / A;
  C.R = rPerM * C.L * 1000;
  C.I = C.U2 = C.drop = C.loss = 0;

  if (C.line === 'ok' && (C.tx === 'ok' || !hasTransformer(C))) {
    const U = C.kv * 1e3, P = C.P * 1e6;
    // P tải = (U − I·R)·I  →  R·I² − U·I + P = 0
    const disc = U * U - 4 * C.R * P;
    if (disc < 0) {
      C.line = 'collapse';
      emit('collapse', { L: C.L, P: C.P, kv: C.kv });
    } else {
      const I = (U - Math.sqrt(disc)) / (2 * C.R);
      if (C.relay && I > C.Imax) {
        C.trip += dt;
        if (C.trip > RELAY_DELAY) { C.line = 'tripped'; emit('trip', { I, Imax: C.Imax }); }
      } else C.trip = 0;
      if (C.line === 'ok') {
        C.I = I; C.U2 = U - I * C.R; C.drop = (I * C.R) / U; C.loss = I * I * C.R;
      }
    }
  }

  // Cân bằng nhiệt trên 1 m dây: C·dT/dt = I²R' − h·πd·(T − Ta)
  const d = Math.sqrt((4 * A) / Math.PI);
  const heat = C.I * C.I * rPerM;
  const cool = H_CONV * Math.PI * d * (C.Tw - C.Ta);
  C.Tw = Math.min(700, Math.max(-20, C.Tw + ((heat - cool) / (C_VOL * A)) * dt));
  if (C.Tw >= WIRE_FIRE_T && C.line === 'ok') {
    C.line = 'fire'; C.I = 0;
    emit('lineFire', { A: C.A, Tw: C.Tw });
  }

  if (hasTransformer(C)) {
    const S = C.I > 0 ? C.P : 0;
    const Tss = 40 + 60 * (S / TX_RATED_MVA) ** 2; // nhiệt độ dầu xác lập
    C.Tt += ((Tss - C.Tt) * dt) / 600;
    if (C.Tt >= TX_FIRE_T && C.tx === 'ok') { C.tx = 'fire'; C.I = 0; emit('txFire', {}); }
  } else C.Tt += ((C.Ta - C.Tt) * dt) / 600;
}

/** Chi phí (triệu USD) để khôi phục đường dây và trạm. */
export const repairCost = (C) => (C.line === 'fire' ? 2.5 : 0) + (C.tx === 'fire' ? 6 : 0);

export function restoreGrid(C) {
  if (C.line === 'fire') C.Tw = C.Ta;
  if (C.tx === 'fire') C.Tt = 45;
  C.line = 'ok'; C.tx = 'ok'; C.trip = 0;
}
