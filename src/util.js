export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const fmt = (x, d = 0) =>
  Number.isFinite(x) ? x.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Nội suy màu theo bảng mốc [[giá trị, [r,g,b]], ...] (0–255). */
export function ramp(stops, x) {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (x - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
    }
  }
  return stops[stops.length - 1][1];
}
export const rgb = (c) => `rgb(${c.join(',')})`;

export const WIRE_RAMP = [[30, [128, 144, 140]], [90, [160, 150, 118]], [150, [242, 177, 58]], [250, [255, 70, 40]], [600, [255, 220, 180]]];
export const FUEL_RAMP = [[290, [150, 80, 40]], [600, [210, 95, 35]], [1200, [255, 125, 35]], [2000, [255, 195, 90]], [2800, [255, 248, 210]]];
