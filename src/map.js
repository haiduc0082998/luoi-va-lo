// Bản đồ: hàm độ cao địa hình (đồi, núi phía bắc, sông uốn lượn), dùng chung cho đồ hoạ và luật xây dựng.
export const MAP_HALF = 230; // bản đồ 460 × 460
/** Biên giới phía đông: bên kia là lãnh thổ nước láng giềng, không được xây. */
export const BORDER_X = 116;
export const WATER_Y = -1.2;

export const riverCenter = (z) => -10 + 12 * Math.sin(z * 0.03);
const RIVER_HALF = 5, BANK = 5;

// Mặt bằng đã san phẳng quanh công trình ban đầu: [x, z, bán kính]
export const PADS = [];
/** Đường bờ biển phía tây (x theo z) và phía nam (z theo x). */
export const westCoast = (z) => -158 + 10 * Math.sin(z * 0.021) + 5 * Math.sin(z * 0.067);
export const southCoast = (x) => 196 + 9 * Math.sin(x * 0.025) + 4 * Math.sin(x * 0.071);
/** Điểm (x, z) nằm ngoài biển (nước mặn, không phải sông / hồ trong đất liền). */
export const inSea = (x, z) => (x < westCoast(z) + 2 || z > southCoast(x) - 2) && height(x, z) < WATER_Y - 0.2;
/** Trong vòng r có biển không (dùng cho cảng biển). */
export const nearSea = (x, z, r = 10) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => inSea(x + r * Math.cos(k * Math.PI / 4), z + r * Math.sin(k * Math.PI / 4)));

const baseHeight = (x, z) => {
  let y = 2.2 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 1.4 * Math.sin(x * 0.11 + z * 0.07) + 1.2;
  if (z < -45) y += Math.min(30, (-45 - z) * 0.5) + Math.sin(x * 0.2) * Math.min(6, (-45 - z) * 0.15); // dãy núi phía bắc
  if (x > 125) y += Math.min(7, (x - 125) * 0.1);                          // cao nguyên nước láng giềng
  if (z > 125) y -= Math.min(1.2, (z - 125) * 0.03);                        // đồng bằng phía nam thấp dần
  // Biển: bờ tây và bờ nam uốn lượn, đáy dốc dần ra khơi (thềm nông ~ 20 đơn vị rồi sâu hẳn)
  const w = westCoast(z) - x, s = z - southCoast(x);
  const sea = Math.max(w, s);
  if (sea > -12) y -= sea < 0 ? (sea + 12) ** 2 * 0.012 : 1.7 + sea * 0.22;  // bãi thoải vào bờ rồi xuống biển
  return y;
};

export function height(x, z) {
  let y = baseHeight(x, z);
  for (const [px, pz, r] of PADS) {
    const d = Math.hypot(x - px, z - pz);
    if (d < r * 1.8) {
      const u = d < r ? 0 : (d - r) / (r * 0.8), t = 1 - u * u * (3 - 2 * u); // chuyển mượt (không thành gờ khi địa hình đổ bóng mịn)
      y += (Math.max(0.6, baseHeight(px, pz)) - y) * t;
    }
  }
  const d = Math.abs(x - riverCenter(z));
  if (d < RIVER_HALF) return -2.6;
  if (d < RIVER_HALF + BANK) {
    const t = (d - RIVER_HALF) / BANK;
    return -2.6 + (y + 2.6) * t * t * (3 - 2 * t);
  }
  return y;
}

export const inRiver = (x, z) => Math.abs(x - riverCenter(z)) < RIVER_HALF + 2;

/** Có thể đặt trạm ở (x, z) không: trong bản đồ, không ở sông, không quá dốc, cách công trình khác ≥ 9. */
export function buildable(x, z, nodes) {
  if (Math.abs(x) > MAP_HALF - 10 || Math.abs(z) > MAP_HALF - 10) return 'Ngoài bản đồ';
  if (x > BORDER_X) return 'Lãnh thổ nước láng giềng';
  if (inSea(x, z)) return 'Không xây được dưới biển';
  if (height(x, z) < WATER_Y + 0.2) return 'Không xây được dưới nước';
  if (inRiver(x, z)) return 'Không xây được trên sông';
  if (height(x, z) > 9) return 'Địa hình quá cao, quá dốc';
  if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 9)) return 'Quá gần công trình khác';
  return '';
}
