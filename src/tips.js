// Cố vấn: đọc trạng thái ván chơi và đưa lời khuyên cụ thể, kèm nút làm ngay khi có thể.
import { fmt } from './util.js';
import { needed, staffRatio, hireToNeed } from './workforce.js';
import { restartState, beginStartup } from './startup.js';
import { THREATS, CAMPAIGNS, campaign } from './city.js';
import { units, hourOfDay as hourOf } from './game.js';
import { fuelBalance } from './infra.js';

/** Danh sách lời khuyên, khẩn cấp trước. lvl: 'bad' | 'warn' | ''. */
export function advice(G) {
  const out = [];
  const add = (lvl, text, label, act) => out.push({ lvl, text, label, act });

  units(G).forEach((R, i) => {
    const k = i + 1, st = restartState(G, k), u = G.reactor2 ? ` tổ máy ${k}` : '';
    if (st === 'ready' && (R.scram || R.rod < 40)) add('bad', `Lò${u} đang dừng nên mất khoảng 1 000 MW. Quy trình khởi động tự đóng máy cắt, chạy bơm, chờ lõi nguội rồi rút thanh từ từ.`, `Khởi động lại lò${u}`, () => beginStartup(G, k));
    if (st === 'repair-loca' || st === 'repair-core') add('bad', `Lò${u} hư hỏng (${st === 'repair-core' ? 'lõi nóng chảy / nổ' : 'vỡ ống sơ cấp'}). Phải sửa chữa trước khi chạy lại.`, 'Bắt đầu sửa chữa', () => beginStartup(G, k));
    if (st === 'nofuel') add('bad', `Lò${u} hết uranium. Nâng cấp mỏ, xây đường tới mỏ, hoặc nhận hàng viện trợ trong tab Ngoại giao.`);
  });
  const fb = fuelBalance(G, units(G));
  if (fb.days < 3) add(fb.days < 1 ? 'bad' : 'warn', `Uranium chỉ còn đủ khoảng ${fmt(fb.days, 1)} ngày (lò đốt ${fmt(fb.burn, 2)} t/ngày, mỏ làm ra ${fmt(fb.made, 2)} t/ngày). Giảm công suất lò khi không cần, nâng cấp mỏ, làm đường tới mỏ, hoặc nhận nhiên liệu viện trợ.`);
  const need = needed(G), r = staffRatio(G);
  if (r < 0.95) add('warn', `Thiếu nhân công: có ${fmt(G.staff.hired)}/${fmt(need)} người, nhà máy chỉ chạy ${fmt((0.3 + 0.7 * r) * 100)}% công suất, công trường chậm lại.`, 'Thuê đủ người', () => hireToNeed(G));

  for (const n of G.net.nodes) {
    const pot = n.type === 'nuclear' ? units(G).reduce((a, R) => a + R.Pe, 0) / 1e6 : n.type === 'coal' ? G.coalMax : 0;
    if (n.exportCap !== undefined && pot > n.exportCap + 50) add('warn', `${n.name} có thể phát ${fmt(pot)} MW nhưng các tuyến nối ra chỉ tải được khoảng ${fmt(n.exportCap)} MW. Kéo thêm một tuyến 500 kV từ nhà máy để dùng hết công suất.`);
  }
  const short = G.net.nodes.filter((n) => n.type === 'city' && n.frac < 0.99);
  for (const n of short) add('bad', `${n.name} chỉ được cấp ${fmt(n.frac * 100)}% điện. Kiểm tra tuyến dây bị cắt (Lưới → danh sách tuyến) hoặc xây thêm nguồn.`);
  for (const l of G.net.lines) {
    const k = (l.I ?? 0) / l.Imax;
    if (l.state === 'ok' && k > 0.85) {
      const a = G.net.nodes.find((n) => n.id === l.a), b = G.net.nodes.find((n) => n.id === l.b);
      add('warn', `Tuyến ${a.name} – ${b.name} đang tải ${fmt(k * 100)}%: dễ bị rơ-le cắt. Kéo thêm tuyến song song hoặc dùng điện áp cao hơn.`);
    }
    if (l.state === 'fire' || l.state === 'tripped') {
      const a = G.net.nodes.find((n) => n.id === l.a), b = G.net.nodes.find((n) => n.id === l.b);
      add('warn', `Tuyến ${a.name} – ${b.name} ${l.state === 'fire' ? 'đang cháy, cần sửa' : 'bị cắt'}: bấm vào tuyến trên bản đồ để ${l.state === 'fire' ? 'sửa' : 'đóng lại'}.`);
    }
  }
  for (const n of G.net.nodes) if (n.state === 'fire') add('warn', `Máy biến áp tại ${n.name} cháy: bấm vào công trình để thay máy mới.`);

  for (const k of Object.keys(THREATS)) {
    const worst = Object.entries(G.cities).map(([id, C]) => [id, C.threat?.[k] ?? 0]).sort((a, b) => b[1] - a[1])[0];
    if (worst && worst[1] >= 40) {
      const name = G.net.nodes.find((n) => n.id === worst[0])?.name;
      const fix = k === 'drugs' ? 'xây đồn cảnh sát, bệnh viện' : k === 'terror' ? 'xây đồn cảnh sát, cử lính gác trạm biến áp' : 'xây đài truyền hình';
      add(worst[1] >= 60 ? 'bad' : 'warn', `${THREATS[k].name} ở ${name}: ${fmt(worst[1])}/100. Vào thành phố để ${fix}, hoặc mở chiến dịch toàn quốc.`, CAMPAIGNS[k].name, () => campaign(G, k));
    }
  }
  const hr = hourOf(G), coalNow = G.net.nodes.find((n) => n.id === 'coal')?.gen ?? 0, batteries = G.net.nodes.filter((n) => n.type === 'battery');
  if (!batteries.length && hr >= 17 && hr <= 22 && coalNow > 60) add('', `Giờ cao điểm đang phải chạy ${fmt(coalNow)} MW nhiệt điện than (đắt nhất). Xây trạm pin lưu trữ: pin tự sạc bằng điện rẻ còn dư lúc trưa / đêm khuya và xả vào giờ này.`);
  for (const b of batteries) if (!G.net.lines.some((l) => l.a === b.id || l.b === b.id)) add('warn', `${b.name} chưa nối dây vào lưới nên không sạc / xả được.`);
  for (const p of G.net.nodes.filter((n) => n.type === 'solar')) if (!G.net.lines.some((l) => l.a === p.id || l.b === p.id)) add('warn', `${p.name} chưa nối dây vào lưới.`);
  if (G.budget < 5) add('warn', 'Ngân sách sắp cạn: tăng giá bán lẻ một chút, ký hợp đồng xuất khẩu vào giờ cao điểm (19–20 h), hoặc bán bớt công trình không cần.');
  if (G.approval < 45) add('warn', 'Lòng dân thấp: giữ đủ điện cho mọi thành phố, xây dịch vụ đô thị, giảm giá điện, chống tham nhũng.');
  if (!G.engineer) add('', 'Chưa có kỹ sư trưởng: tuyển trong cửa sổ Quốc gia để lò tự bám theo nhu cầu lưới và tự khởi động lại sau sự cố.');
  if (G.corruption > 35) add('warn', `Tham nhũng ${fmt(G.corruption)}%: mọi công trình đắt hơn, nâng cấp dễ thất bại. Mở chiến dịch chống tham nhũng trong cửa sổ Quốc gia.`);
  if (G.happiness < 50) add('', 'Thành phố kém hạnh phúc: vào thành phố, xem thanh nào thấp (giáo dục, y tế, giao thông…) rồi xây dịch vụ tương ứng.');
  const spare = (G.net.summary?.genCap ?? 0) - (G.net.summary?.demand ?? 0);
  if (!G.market.exportOn && spare > 250) add('', `Lưới còn dư khoảng ${fmt(spare)} MW: kéo dây tới Cửa khẩu Đông và ký hợp đồng xuất khẩu để kiếm thêm.`);
  return out;
}

export const GENERAL_TIPS = [
  'Bấm Space để tạm dừng khi có sự cố; tốc độ 1× giúp xử lý lò phản ứng chính xác hơn.',
  'Lò hạt nhân rẻ nhất cho mỗi MWh; nhiệt điện than đắt nhất. Đừng để lò dừng lâu.',
  'Điện áp cao giảm dòng điện và tổn hao I²R: tuyến dài nên dùng 500 kV.',
  'Dòng vượt định mức thì rơ-le cắt tuyến; quá nóng lâu thì dây võng chạm cây và cháy.',
  'Có ít nhất hai đường nối tới nhà máy hạt nhân để không bị mất điện lưới ngoài khi một tuyến bị cắt.',
  'Kỹ sư "con ông cháu cha" nguy hiểm hơn không có ai: nếu xui, hãy sa thải và tuyển lại.',
  'Nhân công đủ thì nhà máy chạy hết công suất và nâng cấp dễ thành công hơn.',
  'Nâng cấp thành phố làm dân số và nhu cầu điện tăng 25%: chuẩn bị thêm nguồn trước khi nâng.',
  'Ngân hàng mang lại thu nhập đều mỗi ngày; đài truyền hình chặn tin giả của nước thù địch.',
  'Cảnh sát giảm cả ma tuý lẫn khủng bố; lính gác ở trạm biến áp chặn được đánh bom.',
  'Giá điện khu vực đỉnh vào 19–20 h: đó là lúc xuất khẩu lời nhất.',
  'Điện mặt trời phát mạnh nhất lúc trưa, bằng 0 về đêm; ghép với trạm pin để dời điện trưa sang cao điểm tối, khỏi đốt than.',
  'Đi xem bản đồ ở các vùng xa (nam, tây) cũng không làm chậm game: vùng ngoài màn hình được ẩn nhưng vẫn mô phỏng.',
];
