// Giai đoạn 6: thời tiết động. Mỗi kiểu thời tiết đổi nhiệt độ không khí, tốc độ gió, nhiệt độ nước làm mát,
// lượng nước về hồ thủy điện và nguy cơ sét. Các con số đi thẳng vào mô hình vật lý.
import { news } from './news.js';

export const WEATHERS = {
  sunny: { name: 'Nắng đẹp', Ta: 30, wind: 5, dTin: 0, hydro: 1, lightning: 0, sky: '#a9c4d6', clouds: 0.15 },
  windy: { name: 'Gió mạnh', Ta: 24, wind: 13, dTin: -2, hydro: 1, lightning: 0, sky: '#9cb5c7', clouds: 0.45 },
  heatwave: { name: 'Nắng nóng cực đoan', Ta: 42, wind: 2, dTin: 8, hydro: 0.7, lightning: 0, sky: '#d6b48c', clouds: 0 },
  storm: { name: 'Bão tố, sấm sét', Ta: 25, wind: 20, dTin: -1, hydro: 1.3, lightning: 0.35, sky: '#4a5868', clouds: 1 },
};
export const WEATHER_ORDER = ['sunny', 'windy', 'heatwave', 'storm'];
const NEXT = { sunny: [['sunny', 0.4], ['windy', 0.3], ['heatwave', 0.2], ['storm', 0.1]],
  windy: [['sunny', 0.4], ['windy', 0.3], ['storm', 0.3]],
  heatwave: [['heatwave', 0.4], ['sunny', 0.5], ['storm', 0.1]],
  storm: [['windy', 0.5], ['sunny', 0.4], ['storm', 0.1]] };

export const createWeather = () => ({ id: 'sunny', until: 10 * 3600, flash: 0, strikes: 0 });
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
  G.weather.until = G.t + (6 + Math.random() * 10) * 3600;
  const w = WEATHERS[id];
  news(G, `Thời tiết: ${w.name}${why}. Không khí ${w.Ta} °C, gió ${w.wind} m/s.`, id === 'storm' || id === 'heatwave' ? 'warn' : '');
}
export function cycleWeather(G) {
  const i = WEATHER_ORDER.indexOf(G.weather.id);
  setWeather(G, WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length], ' (đổi thủ công)');
}

/** Gió dao động quanh giá trị trung bình của kiểu thời tiết. */
export const windNow = (G) => Math.max(0, current(G).wind * (1 + 0.25 * Math.sin(G.t / 1700) + 0.1 * Math.sin(G.t / 330)));

export function weatherStep(G, dt) {
  const W = G.weather, w = current(G);
  if (G.t >= W.until) {
    const r = Math.random();
    let acc = 0;
    for (const [id, p] of NEXT[W.id]) { acc += p; if (r <= acc) { setWeather(G, id); break; } }
  }
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
