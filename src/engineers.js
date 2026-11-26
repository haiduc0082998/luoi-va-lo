// Gacha kỹ sư: thuê người tự vận hành lò. Tham nhũng cao thì dễ "trúng" kỹ sư rởm.
import { RATED, FLOW_NOM, CP_WATER, EPS, T_IN, pumpsPowered as anyPump } from './physics/reactor.js';

export const ENGINEERS = {
  fake: { tier: 'fake', name: 'Kỹ sư “con ông cháu cha”', skill: 20, salary: 0.05,
    desc: 'Rút thanh lung tung, hoảng thì bấm SCRAM bất kể tình huống, đôi khi tắt nhầm bơm.' },
  rare: { tier: 'rare', name: 'Chuyên gia quốc tế', skill: 75, salary: 0.12,
    desc: 'Bám theo nhu cầu lưới, giữ lõi dưới 380 °C, SCRAM khi vượt 420 °C, tự khởi động lại.' },
  legend: { tier: 'legend', name: 'Tiến sĩ hạt nhân', skill: 98, salary: 0.3,
    desc: 'Như chuyên gia, còn bật lại bơm, hiểu bẫy AZ-3: lò RBMK nóng thì hạ thanh từ từ thay vì SCRAM.' },
};

export function rollEngineer(corruption, rnd = Math.random) {
  const roll = rnd() * 100 + corruption * 0.3;
  if (roll > 82) return { ...ENGINEERS.fake };
  if (roll < 25) return { ...ENGINEERS.legend };
  return { ...ENGINEERS.rare };
}

const CREF = FLOW_NOM * CP_WATER * EPS;
/** Vị trí thanh để lò cân bằng ở công suất nhiệt P (từ phương trình độ phản ứng = 0). */
export function rodForPower(R, P) {
  const flow = Math.max(R.flow, 0.05);
  const T = T_IN + P / (flow * CREF);
  return 50 + (T - 300) / 2.7;
}

/**
 * Gọi mỗi giây trong game. wantMWe: công suất điện lưới cần từ nhà máy.
 * emit(text, level) để đưa tin.
 */
export function runEngineer(E, R, wantMWe, rnd = Math.random, emit = () => {}) {
  if (!E || R.melt || (R.rbmk && R.boom)) return;
  const pumpsPowered = anyPump(R);

  if (E.tier === 'fake') {
    if (!R.scram) R.rodCmd = Math.max(0, Math.min(100, R.rodCmd + (rnd() - 0.45) * 4));
    if (!R.scram && (R.T > 400 || R.flow < 0.6) && rnd() < 0.3) {
      R.scram = true;
      emit(`${E.name} hoảng loạn, đập nút SCRAM!`, 'warn');
    }
    if (rnd() < 0.002) {
      const i = Math.floor(rnd() * 4);
      if (R.pumps[i]) { R.pumps[i] = 0; emit(`${E.name} tắt nhầm bơm ${i + 1}.`, 'warn'); }
    }
    return;
  }

  const legend = E.tier === 'legend';
  if (legend && (!R.cb.cb1 || !R.cb.cb2 || !R.cb.cb3)) {
    R.cb = { cb1: true, cb2: true, cb3: true };
    emit(`${E.name} đóng lại các máy cắt tự dùng CB1–CB3.`);
  }
  if (legend && pumpsPowered) {
    R.pumps.forEach((p, i) => {
      if (!p) { R.pumps[i] = 1; emit(`${E.name} cho chạy lại bơm ${i + 1}.`); }
    });
  }

  if (R.scram) {
    // Khởi động lại khi nguyên nhân đã hết
    const okToRestart = !R.loca && R.flow > 0.9 && R.T < 330 && R.p < 16 && pumpsPowered;
    if (okToRestart && rnd() < (legend ? 0.2 : 0.05)) {
      R.scram = false; R.rodCmd = R.rod;
      emit(`${E.name} giải trừ SCRAM, nâng công suất lò trở lại.`);
    }
    return;
  }

  const Tmax = R.rbmk ? 360 : 380;
  if (R.rbmk && R.T > 370) {
    if (legend) { R.rodCmd = Math.max(0, R.rod - 1.5); return; }   // hạ từ từ, tránh AZ-3
  }
  if (R.T > 420) {
    R.scram = true;
    emit(`${E.name} bấm SCRAM vì lõi vượt 420 °C.`, 'warn');
    return;
  }
  const Pth = Math.max(0.3 * RATED, Math.min(RATED, (wantMWe * 1e6) / 0.33));
  const rodMax = 50 + (Tmax - 300) / 2.7;
  const target = Math.max(0, Math.min(rodMax, rodForPower(R, Pth)));
  R.rodCmd += (target - R.rodCmd) * (legend ? 0.5 : 0.25);
}
