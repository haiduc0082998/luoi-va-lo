// Mô phỏng lò nước áp lực 3 000 MWt (Giai đoạn 2): độ phản ứng, nhiệt phân rã,
// cân bằng nhiệt Q = m·c·ΔT, áp suất, hydro, nóng chảy lõi. Đơn vị độ phản ứng là đơn vị trò chơi.

export const RATED = 3e9;               // W nhiệt
export const FLOW_NOM = 17000;          // kg/s
export const CP_WATER = 5500;           // J/kg·K ở ~300 °C
export const EPS = 0.5;                 // hiệu suất trao đổi nhiệt lõi → nước
export const C_CORE = 60e6;             // J/K nhiệt dung lõi
export const T_IN = 290;                // °C nước vào lõi
export const P_RELIEF = 17, P_RUPTURE = 22; // MPa
export const T_DAMAGE = 1100, T_H2 = 900, T_MELT = 2800;
export const DIESEL_START = 15;         // giây
// Hiệu ứng SCRAM dương (AZ-3, Chernobyl 1986): thanh RBMK có đầu đẩy bằng than chì.
// Khi thanh từ vị trí rút cao bắt đầu đi xuống, phần than chì đẩy nước khỏi đáy kênh trước
// khi phần hấp thụ kịp vào → vài giây đầu độ phản ứng TĂNG. Lò đang nóng, nhiều hơi thì đủ để vọt công suất.
export const AZ_PEAK = 42;              // đơn vị độ phản ứng ở đỉnh hiệu ứng
export const AZ_TRAVEL = 20;            // % hành trình thanh có hiệu ứng
export const RBMK_ROD_SPEED = 5;        // %/s (≈ 18–20 s đi hết như RBMK thật)
const CREF = FLOW_NOM * CP_WATER * EPS;

export const createReactor = (o = {}) => ({
  rod: 70, rodCmd: 70, Pf: RATED, D1: 0.04 * RATED, D2: 0.025 * RATED, T: 354, flow: 1,
  pumps: [1, 1, 1, 1], offsite: true, diesel: true, dieselT: 0, porv: true, rps: true, rbmk: false,
  scram: false, scramFrom: null, H2: 0, cb: { cb1: true, cb2: true, cb3: true },
  // Công nghệ: boron (bỏ AZ-3), passive (làm mát thụ động 5%), recombiner (giảm hydro), eff (hiệu suất chu trình)
  boron: false, passive: false, recombiner: false, eff: 0.33, dTin: 0, noFuel: false, p: 15.5, porvOpen: false, loca: false, boom: false, melt: false, dmg: false,
  release: 0, plume: 0, wind: Math.random() * 360, Qout: 0, Qgen: 0, rho: 0, Pe: 0, flash: 0, ...o,
});

// Lớp 3 – hệ thống điện tự dùng: lưới ngoài → CB1 → thanh cái A (bơm 1, 2);
// diesel → CB2 → thanh cái B (bơm 3, 4); CB3 nối liên lạc A–B.
export const gridFeeds = (R) => R.offsite && R.cb.cb1;  // diesel tự khởi động khi thanh cái A mất nguồn lưới
export const dieselRunning = (R) => !gridFeeds(R) && R.diesel && R.dieselT >= DIESEL_START;
export function busPower(R) {
  const cb = R.cb, srcA = R.offsite && cb.cb1, srcB = dieselRunning(R) && cb.cb2;
  return { A: srcA || (srcB && cb.cb3), B: srcB || (srcA && cb.cb3) };
}
export const pumpPowered = (R, i) => busPower(R)[i < 2 ? 'A' : 'B'];
export const pumpsPowered = (R) => [0, 1, 2, 3].some((i) => pumpPowered(R, i));
export const inletTemp = (R) => T_IN + (R.dTin ?? 0);
export const outletTemp = (R) => inletTemp(R) + EPS * (R.T - inletTemp(R));

export function stepReactor(R, dt, emit = () => {}) {
  if (R.scram) {
    R.rodCmd = 0;
    if (R.scramFrom === null) R.scramFrom = R.rod;
  } else R.scramFrom = null;
  const rate = R.scram ? (R.rbmk && !R.boron ? RBMK_ROD_SPEED : 35) : 6; // %/s
  R.rod += Math.max(-rate * dt, Math.min(rate * dt, R.rodCmd - R.rod));

  if (gridFeeds(R)) R.dieselT = 0;
  else if (R.diesel) {
    const was = R.dieselT >= DIESEL_START;
    R.dieselT += dt;
    if (!was && R.dieselT >= DIESEL_START) emit('dieselOn');
  }
  const bus = busPower(R);
  const target = R.loca ? 0 : R.pumps.reduce((s, p, i) => s + (p && bus[i < 2 ? 'A' : 'B'] ? 0.25 : 0), 0);
  R.flow += ((target - R.flow) * dt) / (target > R.flow ? 5 : 15); // khởi động 5 s, quán tính dừng 15 s

  const voidTerm = R.rbmk ? 1.6 * Math.max(0, R.T - 370) : 0; // hệ số rỗng dương
  R.az = azEffect(R);
  R.rho = 2.7 * (R.rod - 50) - (R.T - 300) + voidTerm + R.az - (R.noFuel ? 300 : 0); // hết nhiên liệu: không duy trì được phản ứng
  const coreGone = R.melt || (R.rbmk && R.boom);
  R.Pf = coreGone
    ? Math.max(3e3, R.Pf * Math.exp(-3 * dt))
    : Math.min(400 * RATED, Math.max(3e3, R.Pf * Math.exp((R.rho / 100) * dt)));

  // Nhiệt phân rã: hai nhóm sản phẩm phân hạch, sống ngắn và sống dài
  R.D1 += ((0.04 * R.Pf - R.D1) * dt) / 80;
  R.D2 += ((0.025 * R.Pf - R.D2) * dt) / 2500;
  R.Qgen = 0.935 * R.Pf + R.D1 + R.D2;
  const coolFlow = R.passive && !R.loca ? Math.max(R.flow, 0.05) : R.flow; // đối lưu tự nhiên
  R.Qout = coolFlow * CREF * (R.T - inletTemp(R)); // = m·c·ΔT với ΔT = EPS·(T − Tin)
  R.T = Math.min(3200, Math.max(20, R.T + ((R.Qgen - R.Qout) / C_CORE) * dt));

  const pRaw = 15.5 + 0.045 * Math.max(0, R.T - 354);
  R.porvOpen = R.porv && !R.loca && pRaw > P_RELIEF;
  R.p = R.loca ? 0.4 : R.porvOpen ? P_RELIEF : pRaw;

  if (R.rps && !R.scram && (R.Pf > 1.15 * RATED || R.T > 420 || R.p > 16.8 || (R.flow < 0.6 && R.Pf > 0.3 * RATED))) {
    R.scram = true; emit('scram', { auto: true });
  }
  if (!R.loca && R.p > P_RUPTURE) {
    R.loca = true; R.release = Math.max(R.release, 0.3); R.flash = 1; emit('loca');
  }
  if (R.rbmk && R.Pf > 10 * RATED && !R.boom) {
    R.boom = R.loca = true; R.release = 1; R.flash = 1; emit('promptExplosion');
  }
  if (R.T > T_DAMAGE && !R.dmg) { R.dmg = true; emit('fuelDamage'); }
  if (R.T > T_H2) R.H2 = Math.min(100, R.H2 + ((R.T - T_H2) / 600) * dt * (R.recombiner ? 0.2 : 1));
  if (R.H2 >= 100 && !R.boom) {
    R.boom = true; R.release = Math.max(R.release, 0.6); R.flash = 1; emit('h2Explosion');
  }
  if (R.T >= T_MELT && !R.melt) { R.melt = true; R.release = 1; emit('meltdown'); }
  R.plume = Math.min(1, R.plume + (R.release * dt) / 900);
  R.Pe = !R.loca && R.flow > 0.2 && R.T > 300 ? R.eff * Math.max(0, R.Qout) : 0;
}

/** Độ phản ứng dương thêm vào trong vài giây đầu SCRAM của lò kiểu RBMK. */
export function azEffect(R) {
  if (!R.rbmk || R.boron || !R.scram || R.scramFrom === null) return 0;
  const travel = R.scramFrom - R.rod;
  if (travel <= 0 || travel >= AZ_TRAVEL) return 0;
  const withdrawn = Math.max(0, (R.scramFrom - 40) / 60); // chỉ đáng kể khi thanh đang rút cao
  const voids = 1 + Math.max(0, R.T - 370) / 60;          // càng nhiều hơi càng mạnh
  return AZ_PEAK * withdrawn * voids * Math.sin((Math.PI * travel) / AZ_TRAVEL);
}

/** Màn hình số 5 chữ số của bàn điều khiển (MW nhiệt), kẹt ở 99999 khi vượt thang. */
export const mwDisplay = (R) => String(Math.min(99999, Math.round(R.Pf / 1e6))).padStart(5, '0');
