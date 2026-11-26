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
const CREF = FLOW_NOM * CP_WATER * EPS;

export const createReactor = (o = {}) => ({
  rod: 70, rodCmd: 70, Pf: RATED, D1: 0.04 * RATED, D2: 0.025 * RATED, T: 354, flow: 1,
  pumps: [1, 1, 1, 1], offsite: true, diesel: true, dieselT: 0, porv: true, rps: true, rbmk: false,
  scram: false, H2: 0, p: 15.5, porvOpen: false, loca: false, boom: false, melt: false, dmg: false,
  release: 0, plume: 0, wind: Math.random() * 360, Qout: 0, Qgen: 0, rho: 0, Pe: 0, flash: 0, ...o,
});

export const pumpsPowered = (R) => R.offsite || (R.diesel && R.dieselT >= DIESEL_START);
export const outletTemp = (R) => T_IN + EPS * (R.T - T_IN);

export function stepReactor(R, dt, emit = () => {}) {
  if (R.scram) R.rodCmd = 0;
  const rate = R.scram ? 35 : 6; // %/s
  R.rod += Math.max(-rate * dt, Math.min(rate * dt, R.rodCmd - R.rod));

  if (R.offsite) R.dieselT = 0;
  else if (R.diesel) {
    const was = R.dieselT >= DIESEL_START;
    R.dieselT += dt;
    if (!was && R.dieselT >= DIESEL_START) emit('dieselOn');
  }
  const target = R.loca ? 0 : pumpsPowered(R) ? R.pumps.reduce((a, b) => a + b, 0) * 0.25 : 0;
  R.flow += ((target - R.flow) * dt) / (target > R.flow ? 5 : 15); // khởi động 5 s, quán tính dừng 15 s

  const voidTerm = R.rbmk ? 1.6 * Math.max(0, R.T - 370) : 0; // hệ số rỗng dương
  R.rho = 2.7 * (R.rod - 50) - (R.T - 300) + voidTerm;
  const coreGone = R.melt || (R.rbmk && R.boom);
  R.Pf = coreGone
    ? Math.max(3e3, R.Pf * Math.exp(-3 * dt))
    : Math.min(400 * RATED, Math.max(3e3, R.Pf * Math.exp((R.rho / 100) * dt)));

  // Nhiệt phân rã: hai nhóm sản phẩm phân hạch, sống ngắn và sống dài
  R.D1 += ((0.04 * R.Pf - R.D1) * dt) / 80;
  R.D2 += ((0.025 * R.Pf - R.D2) * dt) / 2500;
  R.Qgen = 0.935 * R.Pf + R.D1 + R.D2;
  R.Qout = R.flow * CREF * (R.T - T_IN); // = m·c·ΔT với ΔT = EPS·(T − Tin)
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
  if (R.T > T_H2) R.H2 = Math.min(100, R.H2 + ((R.T - T_H2) / 600) * dt);
  if (R.H2 >= 100 && !R.boom) {
    R.boom = true; R.release = Math.max(R.release, 0.6); R.flash = 1; emit('h2Explosion');
  }
  if (R.T >= T_MELT && !R.melt) { R.melt = true; R.release = 1; emit('meltdown'); }
  R.plume = Math.min(1, R.plume + (R.release * dt) / 900);
  R.Pe = !R.loca && R.flow > 0.2 && R.T > 300 ? 0.33 * Math.max(0, R.Qout) : 0;
}
