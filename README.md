# Lưới & Lò

Trò chơi chiến lược năng lượng kết hợp mô phỏng vật lý, dựng trên engine 3D [PlayCanvas](https://github.com/playcanvas/engine). Người chơi thiết kế lưới truyền tải và vận hành nhà máy hạt nhân. Mọi sự cố đều sinh ra từ công thức vật lý, không phải từ con số ngẫu nhiên.

## Chạy thử

```bash
npm install
npm run dev      # mở http://localhost:5173
npm test         # kiểm thử mô hình vật lý
npm run build    # xuất bản tĩnh vào dist/
```

Mỗi lần đẩy lên nhánh `main`, GitHub Actions sẽ chạy kiểm thử, build rồi đăng lên GitHub Pages. Lần đầu cần bật: **Settings → Pages → Source: GitHub Actions**.

## Có gì trong bản này (Giai đoạn 1–7)

**Bản đồ 3D**
- Địa hình low-poly: đồi, dãy núi tuyết phía bắc, sông uốn lượn, hồ.
- Bấm vào nhà máy, trạm, thành phố hoặc đường dây để xem thông số và điều khiển.
- Ngày và đêm chạy theo đồng hồ trong game, có nút tua nhanh tới tối hoặc sáng. Thành phố lên đèn ban đêm, tắt ngấm khi mất điện.
- Hạt năng lượng chạy dọc dây: nhanh hay chậm theo công suất, đúng chiều dòng công suất, dừng khi tuyến bị cắt.
- Tháp làm mát hyperboloid nhả hơi theo điện phát ra; vòng Cherenkov quanh nhà lò xanh khi ổn định, cam rồi đỏ khi quá nhiệt.
- Sương mù theo chiều sâu, ánh sáng hắt từ mặt đất, nắng sớm và hoàng hôn ngả vàng; nút đồ hoạ thấp tắt đổ bóng cho máy yếu.
- **Xây trạm:** đặt trạm biến áp lên mặt đất (không xây trên sông hay sát công trình khác).
- **Kéo dây:** chọn điểm đầu, điểm cuối. Chiều dài tính theo bản đồ, cột điện tự dựng theo địa hình, R = ρL/A tự tính.

**Lưới nhiều nút**
- Tách đảo lưới theo máy cắt; mỗi đảo cân bằng phát – tải, thiếu nguồn thì sa thải phụ tải và tần số tụt dưới 50 Hz.
- Phân bố công suất kiểu DC: dòng chia theo U²/R giữa các đường song song.
- Mỗi tuyến: dòng I, tổn hao I²R, sụt áp, sụp đổ điện áp, nhiệt độ dây (võng, cháy ở 250 °C), rơ-le, máy cắt.
- Mỗi trạm: nhiệt độ dầu máy biến áp, quá tải thì cháy.
- Nhu cầu thay đổi theo giờ, đỉnh buổi tối, tăng khi nắng nóng.

**Lò phản ứng 3 000 MWt**
- Thanh điều khiển, nhiệt phân rã, Q = m·c·ΔT, áp suất, LOCA, hydro, nóng chảy lõi, đám mây phóng xạ theo gió.
- Điện lưới ngoài của nhà máy lấy từ chính lưới: cắt hết đường dây là bơm phải chờ diesel.
- **Bẫy AZ-3 (kiểu Chernobyl):** ở chế độ RBMK, thanh đi xuống chậm và đầu thanh bằng than chì làm độ phản ứng tăng trong vài giây đầu SCRAM. Lò ổn định thì SCRAM an toàn; lõi đã nóng khoảng 375–390 °C thì SCRAM lại làm công suất vọt lên, màn hình kẹt ở 99999 MW rồi nổ.

**Quốc gia**
- Ngân sách: bán điện 60 USD/MWh, than 35 USD/MWh, chi phí xây dựng và sửa chữa.
- Lạm phát (in tiền) làm tăng chỉ số giá.
- Tham nhũng làm đắt công trình, dây mới có điện trở cao hơn thiết kế, ăn bớt doanh thu. Thanh tra để giảm.
- Lòng dân, biểu tình, bản tin thế giới.
- **Gacha kỹ sư:** kỹ sư rởm (hoảng loạn bấm SCRAM, tắt nhầm bơm), chuyên gia quốc tế (bám tải, giữ nhiệt), tiến sĩ hạt nhân (bật lại bơm, hiểu bẫy AZ-3). Tham nhũng cao thì dễ trúng kỹ sư rởm.

**Giai đoạn 5: thị trường, chính trị, công nghệ**
- **Thị trường điện:** chỉnh giá bán lẻ (ảnh hưởng lòng dân, doanh nghiệp, ngân sách); giá giao ngay khu vực theo giờ, đỉnh 19–20 h; hợp đồng xuất khẩu qua Cửa khẩu Đông, cần tự kéo dây tới cửa khẩu; giao thiếu thì mất uy tín.
- **Vũ khí năng lượng:** cắt điện xuất khẩu để ép đối phương; một ngày sau họ nhượng bộ (bồi thường) hoặc trả đũa (cấm vận than, hạ giá mua).
- **Ba phe phái:** Dân chúng, Doanh nghiệp, Quân đội, cộng thêm uy tín quốc tế. Bốn sắc lệnh đánh đổi: trợ giá điện, độc quyền lưới, ngân sách quốc phòng, thiết quân luật.
- **Thua cuộc:** đảo chính (quân đội dưới 10% suốt một ngày), cách mạng (lòng dân gần 0 suốt một ngày), vỡ nợ (ngân sách dưới −20 triệu USD suốt một ngày).
- **Cây công nghệ 3 nhánh, 12 công nghệ, mỗi công nghệ đổi vật lý thật:** thanh Boron xoá bẫy AZ-3, làm mát thụ động cứu lò khi sóng thần, dây chịu nhiệt 350 °C, siêu cao thế 750 kV, cáp siêu dẫn, AI điều độ tự đóng lại tuyến, kiểm toán số…
- **Kiến trúc:** đập thủy điện 250 MW chắn sông (bọt trắng theo công suất); hai tháp làm mát rỗng ruột có vành miệng, mặt trong tối và bể nước; lõi lò dạng ống rỗng phát sáng; dàn tản nhiệt quạt quay theo nhiệt độ; bồn nước, hàng rào, đèn đường sáng về đêm; trạm cửa khẩu.

**Giai đoạn 4: ngoại giao & quân sự**
- Ba nước láng giềng có AI riêng: Cộng hoà Đông Lâm (khách mua điện), Vương quốc Bắc Sơn (giàu than, hay gây sức ép), Liên bang Nam Hải (ôn hoà, sợ phóng xạ). Quan hệ trôi theo uy tín quốc tế, sụt mạnh khi rò phóng xạ hoặc dùng điện làm vũ khí.
- Đề nghị ngoại giao hai lần mỗi ngày: than giá rẻ, vay ưu đãi, chia sẻ công nghệ, mua thêm điện, hoặc đòi tiền nhượng quyền. Có thể cử phái đoàn để cải thiện quan hệ.
- Quan hệ dưới 25: phá hoại trạm điện. Dưới 8: tuyên chiến, tên lửa đánh vào nhà máy và trạm, kể cả nhà máy hạt nhân (có thể gây LOCA và rò phóng xạ). Đình chiến tốn tiền.
- Quân đội: tuyển đơn vị, điều đi canh gác từng công trình (lều lính, xe quân sự, bệ phòng không hiện trên bản đồ). Lính gác chặn được phá hoại và 80% tên lửa.

**Tổ máy số 2**
- Nghiên cứu "Thiết kế tổ máy số 2", rồi khởi công: 30 triệu USD, 3 ngày, có giàn giáo và cần cẩu trên bản đồ.
- Lò thứ hai có vật lý riêng, điều khiển riêng (thẻ Tổ máy 1 / Tổ máy 2). Máy biến áp nhà máy nâng lên 2 400 MVA. Kỹ sư vận hành cả hai tổ.

**Lớp 3: sơ đồ điện tự dùng**
- Trong bảng nhà máy hạt nhân: lưới ngoài → CB1 → thanh cái A (bơm 1, 2); diesel → CB2 → thanh cái B (bơm 3, 4); CB3 nối hai thanh cái. Bấm máy cắt để đóng hoặc mở, đường có điện sáng màu hổ phách.
- Diesel tự khởi động khi thanh cái A mất nguồn lưới. Mở nhầm máy cắt có thể làm bơm mất điện, lò SCRAM, rồi kéo theo quá tải dây và mất điện dây chuyền.

**Giai đoạn 6: thời tiết, tài nguyên, giao thông**
- **Thời tiết động:** nắng đẹp, gió mạnh, nắng nóng cực đoan, bão; tự chuyển sau 6–16 giờ hoặc đổi bằng nút.
  - Nhiệt độ không khí và gió đổi khả năng tản nhiệt của dây (gió càng mạnh dây càng mát).
  - Nắng nóng làm nước làm mát nóng lên 8 °C nên lò phải giảm công suất, giống nhà máy thật.
  - Bão: sét đánh cắt tuyến. Rơ-le bật thì tự đóng lại sau 30 giây, rơ-le tắt thì cháy dây. Mưa làm hồ thủy điện đầy hơn, khô hạn thì vơi.
  - 3D: mây trôi theo gió, mưa, chớp sét, bầu trời đổi màu.
- **Xây dựng (nút “Xây dựng ▾”):**
  - Trạm biến áp.
  - Trại điện gió 120 MW: công suất theo lập phương tốc độ gió, ngắt khi gió trên 25 m/s, tốn đất hiếm.
  - Tháp làm mát phụ: hạ 3 °C nước làm mát, tối đa 3 tháp.
  - Khu đô thị mới.
  - Cao tốc có xe tải: +25% sản lượng mỏ.
  - Cảng sông có cần cẩu và tàu chạy trên sông: đất hiếm +30% giá, phí cảng.
  - Sân bay có máy bay cất cánh và bay vòng: gacha −30%, nghiên cứu +15%, du lịch.
  - Mỗi loại có luật đặt riêng: cảng phải sát bờ sông, sân bay cần đất bằng…
- **Chế độ Bán:** hoàn 70% chi phí công trình tự xây; hạ tầng cốt lõi không bán được.
- **Tài nguyên:**
  - Mỏ uranium và đất hiếm là một phụ tải 60 MW trong lưới, mất điện thì ngừng khai thác.
  - Mỗi tổ máy đốt khoảng 1 tấn uranium mỗi ngày; hết uranium là lò dừng.
  - Cây khai thác 3 cấp; xuất khẩu đất hiếm.
- **Điều độ viên:** tự đóng lại tuyến bị cắt do quá tải sau 30 phút; trạm thông minh hoặc AI điều độ rút xuống 2 phút.

**Bên trong thành phố (kiểu Cities: Skylines)**
- Bấm vào một thành phố rồi chọn **Vào thành phố**: khung cảnh đô thị 9 × 9 lô phố, xe cộ chạy theo làn, người đi bộ trên vỉa hè, máy bay bay ngang, cửa sổ sáng theo giờ và theo điện thực tế được cấp.
- Xây trường học, bệnh viện, đồn cảnh sát, trạm cứu hoả, công viên. Mỗi công trình phủ sóng các lô quanh nó; xây trên đất trống, hoặc phá nhà cũ (giá ×1,5).
- **Vẽ tuyến metro:** bấm lần lượt các lô để đặt ga và kéo ray trên cao, tàu chạy đi về. Metro giảm tắc đường (ít xe hơn, xe chạy nhanh hơn) nhưng tiêu thụ điện.
- **Hạnh phúc** = giáo dục, y tế, an ninh, phòng cháy, giải trí, giao thông công cộng, điện ổn định, trừ tắc đường.
  - Hạnh phúc trên 55% kéo lòng dân cả nước lên và thành phố lớn dần (nhu cầu điện tăng).
  - Dưới 55% thì ngược lại.
- Mọi dịch vụ đều tốn chi phí vận hành mỗi ngày và tiêu thụ điện thật trong lưới.

**Giai đoạn 7: nâng cấp đồ hoạ và lối chơi**
- **Hậu kỳ hình ảnh** (CameraFrame của PlayCanvas):
  - Tone mapping ACES.
  - Bloom cho mọi vật phát sáng: vòng Cherenkov, đèn đường, cửa sổ, lửa.
  - Che sáng môi trường SSAO, chỉnh màu và viền tối.
  - Không khí thay đổi theo tình huống: bão thì xám lạnh, có phóng xạ thì ngả vàng xanh và bạc màu.
- **Bóng đổ 3 tầng (cascade):** sắc nét khi nhìn gần, vẫn phủ cả bản đồ khi nhìn toàn cảnh.
- **Mặt nước gợn sóng:** hai lớp normal map dựng bằng code, trôi nhanh hơn và gợn mạnh hơn khi gió lớn.
- **Đêm trăng:** ánh trăng xanh nhạt, mắt "thích nghi bóng tối" (tăng độ phơi sáng), trời sao nhấp nháy và mờ đi khi trời mây gió.
- **Lưu / tải ván chơi** vào trình duyệt:
  - Có một ô lưu tay (Ctrl + S) và bản tự lưu mỗi ngày game, cũng như khi đóng tab.
  - Nút "Ván mới" bắt đầu lại từ đầu.
- **Âm thanh tổng hợp** (WebAudio, không cần file):
  - Tiếng ù máy biến áp ở 2 × tần số lưới, nghe lệch cao độ khi lưới lệch tần số.
  - Gió và mưa theo thời tiết, sấm sau tia sét.
  - Còi báo động, tiếng nổ, chuông hoàn thành nhiệm vụ.
- **12 nhiệm vụ có thưởng** (tab Nhiệm vụ): lưới ổn định 24 giờ, không ai thiếu điện, điện gió, xuất khẩu, metro đầu tiên, tổ máy 2, láng giềng hữu hảo… Nhiệm vụ "suốt X giờ" phải giữ điều kiện liên tục.
- **Phím tắt:** Space dừng/chạy, 1–4 đổi tốc độ, Q/L/B/X đổi công cụ, Esc huỷ hoặc rời thành phố, M tắt âm thanh, ? xem bảng phím.

## Cấu trúc mã

```
src/
  physics/network.js   lưới nhiều nút: đảo, phân bố công suất, tần số, nhiệt dây và máy biến áp
  physics/reactor.js   lò phản ứng, kể cả hiệu ứng SCRAM dương AZ-3
  engineers.js         gacha và hành vi tự vận hành của kỹ sư
  game.js              thời gian, kinh tế, lạm phát, tham nhũng, lòng dân, xây dựng, kịch bản
  policy.js            thị trường điện, phe phái, sắc lệnh, cây công nghệ, điều kiện thua
  world.js             các nước láng giềng, đề nghị, phá hoại, chiến tranh, quân đội canh gác
  weather.js           thời tiết động: nhiệt độ, gió, nước làm mát, thủy văn, sét
  infra.js             xây dựng, bán công trình, mỏ, uranium, đất hiếm, giao thông
  city.js              mô phỏng đô thị: lô phố, dịch vụ, metro, hạnh phúc, tắc đường, tăng trưởng
  world/cityview.js    cảnh 3D bên trong thành phố: nhà, xe, người, máy bay, metro trên cao
  ui/citypanel.js      bảng thành phố: hạnh phúc, công cụ xây, vẽ metro
  world/infra3d.js     trại gió, mỏ, cao tốc, cảng, sân bay, mây, mưa, chớp
  map.js               hàm độ cao địa hình và luật đặt công trình
  world/terrain.js     lưới địa hình low-poly, mặt nước, giao tia với mặt đất
  world/scene.js       công trình, đường dây trên cột, lửa, khói, phóng xạ, ngày/đêm
  world/picking.js     chọn công trình/đường dây bằng chuột
  world/camera.js      camera quỹ đạo (xoay, di chuyển, thu phóng, cảm ứng)
  ui/hud.js            thanh chỉ số, bảng thanh tra, bảng quốc gia
  ui/stage5.js         bảng Thị trường · Chính trị · Cây công nghệ · Nhiệm vụ, màn hình thua
  ui/gamebar.js        thanh ván chơi: lưu, tải, ván mới, âm thanh, phím tắt, tự lưu
  save.js              lưu / tải ván vào localStorage (giữ Set, getter, số vô cực)
  missions.js          nhiệm vụ và phần thưởng
  audio.js             âm thanh tổng hợp bằng WebAudio
  world/post.js        hậu kỳ: tone mapping, bloom, SSAO, chỉnh màu theo không khí
models/                mô hình 3D: macro FreeCAD (737, tháp làm mát, ô tô, người nam/nữ, Chernobyl ×2), script dựng GLB (cadlite.py), ảnh xem trước
public/models/         file GLB game tải lúc chạy
tests/                 kiểm thử lưới, lò, AZ-3 và vòng chơi
```

Phần vật lý tách khỏi engine, nên kiểm thử được bằng Node và sau này chuyển sang Web Worker khi lưới có hàng nghìn nút.

## Ý tưởng mở rộng

- Điện mặt trời và pin lưu trữ để tích điện ban đêm, bán giờ cao điểm.
- Bảng thành tích, nhiều ô lưu, xuất/nhập file lưu.
- Mỗi nước láng giềng có lưới điện riêng mô phỏng thật, có thể mua điện khi mình thiếu.

> Mô hình đã đơn giản hoá cho trò chơi. Các con số đúng bậc độ lớn, không dùng để thiết kế thật.
