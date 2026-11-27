// Giai đoạn 6: thời tiết động. Mỗi kiểu thời tiết đổi nhiệt độ không khí, tốc độ gió, nhiệt độ nước làm mát,
// lượng nước về hồ thủy điện và nguy cơ sét. Các con số đi thẳng vào mô hình vật lý.
import { news } from './news.js';

// rain: có mưa · dim: trời tối bớt (0–1) · fog: [bắt đầu, hết] sương mù · cover: độ phủ mây · grey: mây xám
export const WEATHERS = {
  sunny: { name: 'Nắng đẹp', Ta: 30, wind: 5, dTin: 0, hydro: 1, lightning: 0, sky: '#a9c4d6', cover: 0.15, p: 0.3 },
  windy: { name: 'Gió mạnh', Ta: 24, wind: 13, dTin: -2, hydro: 1, lightning: 0, sky: '#9cb5c7', cover: 0.45, p: 0.15 },
  rain: { name: 'Mưa rào', Ta: 26, wind: 7, dTin: -1, hydro: 1.15, lightning: 0, sky: '#8a9aa8', cover: 0.85, grey: true, rain: 0.6, dim: 0.25, fog: [140, 460], p: 0.17 },
  heatwave: { name: 'Nắng nóng cực đoan', Ta: 42, wind: 2, dTin: 8, hydro: 0.7, lightning: 0, sky: '#d6b48c', cover: 0, p: 0.1 },
  cold: { name: 'Rét đậm', Ta: 9, wind: 6, dTin: -6, hydro: 0.9, lightning: 0, sky: '#b9c6d0', cover: 0.5, p: 0.1 },
  fog: { name: 'Sương mù', Ta: 20, wind: 1.5, dTin: -2, hydro: 1, lightning: 0, sky: '#c3c9cc', cover: 0.3, dim: 0.2, fog: [25, 170], p: 0.08 },
  storm: { name: 'Bão tố, sấm sét', Ta: 25, wind: 20, dTin: -1, hydro: 1.3, lightning: 0.35, sky: '#4a5868', cover: 1, grey: true, rain: 1, dim: 0.45, fog: [90, 330], p: 0.1 },
};
export const WEATHER_ORDER = Object.keys(WEATHERS);

export const createWeather = () => ({ id: 'sunny', until: (1 + Math.random() * 3) * 3600, flash: 0, strikes: 0, seed: Math.random() * 1000 });
export const current = (G) => WEATHERS[G.weather.id];

/** Hệ số tản nhiệt của dây theo gió (W/m²·K): gió càng mạnh dây càng mát. */
export const hConv = (wind) => 18 + 3 * wind;

/** Công suất một trại gió 120 MW theo tốc độ gió: bắt đầu quay 3 m/s, định mức 12 m/s, ngắt bảo vệ trên 25 m/s. */
export function windFarmMW(wind, rated = 120) {
  if (wind < 3 || wind > 25) return 0;
  return rated * Math.min(1, ((wind - 3) / 9) ** 3);
}

export function setWeather(G, id, why = '') {
  G.weather.id = id;
  G.weather.until = G.t + (2 + Math.random() * 8) * 3600; // kéo dài ngẫu nhiên 2–10 giờ
  G.weather.seed = Math.random() * 1000;
  const w = WEATHERS[id];
  news(G, `Thời tiết: ${w.name}${why}. Không khí ${w.Ta} °C, gió ${w.wind} m/s.`, id === 'storm' || id === 'heatwave' ? 'warn' : '');
}
export function cycleWeather(G) {
  const i = WEATHER_ORDER.indexOf(G.weather.id);
  setWeather(G, WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length], ' (đổi thủ công)');
}

/** Gió dao động ngẫu nhiên quanh giá trị trung bình (pha khác nhau mỗi đợt thời tiết, có cơn giật). */
export const windNow = (G) => { const s = G.weather.seed ?? 0; return Math.max(0, current(G).wind * (1 + 0.25 * Math.sin(G.t / 1700 + s) + 0.1 * Math.sin(G.t / 330 + 2 * s) + 0.08 * Math.sin(G.t / 47 + 3 * s))); };
/** Nhiệt độ không khí dao động ±2 °C quanh giá trị của kiểu thời tiết. */
export const airTemp = (G) => current(G).Ta + 2 * Math.sin(G.t / 5200 + (G.weather.seed ?? 0));

/** Chọn ngẫu nhiên kiểu thời tiết kế tiếp theo xác suất p, không lặp lại kiểu cũ quá 1 lần. */
export function randomWeather(prev, rnd = Math.random) {
  const ids = WEATHER_ORDER.filter((id) => id !== prev || rnd() < 0.35);
  const tot = ids.reduce((a, id) => a + WEATHERS[id].p, 0);
  let r = rnd() * tot;
  for (const id of ids) { r -= WEATHERS[id].p; if (r <= 0) return id; }
  return ids.at(-1);
}

export function weatherStep(G, dt) {
  const W = G.weather, w = current(G);
  if (G.t >= W.until) setWeather(G, randomWeather(W.id));
  // Sét đánh đường dây trong bão: rơ-le cắt tuyến; dây đã tắt rơ-le thì có thể cháy
  if (w.lightning && Math.random() < (w.lightning * dt) / 3600) {
    const live = G.net.lines.filter((l) => l.state === 'ok' && l.closed);
    if (live.length) {
      const l = live[Math.floor(Math.random() * live.length)];
      const a = G.net.nodes.find((n) => n.id === l.a).name, b = G.net.nodes.find((n) => n.id === l.b).name;
      if (l.relay) { l.state = 'tripped'; l.transient = true; news(G, `Sét đánh tuyến ${a} – ${b}: rơ-le cắt, sẽ tự đóng lại sau 30 giây.`, 'warn'); }
      else { l.state = 'fire'; news(G, `Sét đánh tuyến ${a} – ${b} đang tắt rơ-le: dây đứt và cháy!`, 'bad'); }
      W.flash = 1; W.strikes++; W.lastStrike = l.id;
    }
  }
}
