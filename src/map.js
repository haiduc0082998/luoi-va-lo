// Bản đồ: hàm độ cao địa hình (đồi, núi phía bắc, sông uốn lượn), dùng chung cho đồ hoạ và luật xây dựng.
export const MAP_HALF = 190;
/** Biên giới phía đông: bên kia là lãnh thổ nước láng giềng, không được xây. */
export const BORDER_X = 116;
export const WATER_Y = -1.2;

export const riverCenter = (z) => -10 + 12 * Math.sin(z * 0.03);
const RIVER_HALF = 5, BANK = 5;

// Mặt bằng đã san phẳng quanh công trình ban đầu: [x, z, bán kính]
export const PADS = [];

const baseHeight = (x, z) => {
  let y = 2.2 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 1.4 * Math.sin(x * 0.11 + z * 0.07) + 1.2;
  if (z < -45) y += Math.min(30, (-45 - z) * 0.5) + Math.sin(x * 0.2) * Math.min(6, (-45 - z) * 0.15); // dãy núi phía bắc
  if (x > 125) y += Math.min(7, (x - 125) * 0.1);                          // cao nguyên nước láng giềng
  if (x < -150) y -= (-150 - x) * 0.18 * (1 + 0.3 * Math.sin(z * 0.05));   // bờ biển phía tây
  if (z > 125) y -= Math.min(1.2, (z - 125) * 0.03);                        // đồng bằng phía nam thấp dần
  return y;
};

export function height(x, z) {
  let y = baseHeight(x, z);
  for (const [px, pz, r] of PADS) {
    const d = Math.hypot(x - px, z - pz);
    if (d < r * 1.8) {
      const t = d < r ? 1 : 1 - (d - r) / (r * 0.8);
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
  if (x < -145 && height(x, z) < 0) return 'Không xây được dưới biển';
  if (inRiver(x, z)) return 'Không xây được trên sông';
  if (height(x, z) > 9) return 'Địa hình quá cao, quá dốc';
  if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 9)) return 'Quá gần công trình khác';
  return '';
}
