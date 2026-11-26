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

## Có gì trong bản này (Giai đoạn 1–5)

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

## Cấu trúc mã

```
src/
  physics/network.js   lưới nhiều nút: đảo, phân bố công suất, tần số, nhiệt dây và máy biến áp
  physics/reactor.js   lò phản ứng, kể cả hiệu ứng SCRAM dương AZ-3
  engineers.js         gacha và hành vi tự vận hành của kỹ sư
  game.js              thời gian, kinh tế, lạm phát, tham nhũng, lòng dân, xây dựng, kịch bản
  policy.js            thị trường điện, phe phái, sắc lệnh, cây công nghệ, điều kiện thua
  map.js               hàm độ cao địa hình và luật đặt công trình
  world/terrain.js     lưới địa hình low-poly, mặt nước, giao tia với mặt đất
  world/scene.js       công trình, đường dây trên cột, lửa, khói, phóng xạ, ngày/đêm
  world/picking.js     chọn công trình/đường dây bằng chuột
  world/camera.js      camera quỹ đạo (xoay, di chuyển, thu phóng, cảm ứng)
  ui/hud.js            thanh chỉ số, bảng thanh tra, bảng quốc gia
  ui/stage5.js         bảng Thị trường · Chính trị · Cây công nghệ, màn hình thua
tests/                 kiểm thử lưới, lò, AZ-3 và vòng chơi
```

Phần vật lý tách khỏi engine, nên kiểm thử được bằng Node và sau này chuyển sang Web Worker khi lưới có hàng nghìn nút.

## Lộ trình tiếp theo

- **Giai đoạn 4:** bản đồ thế giới, nhiều quốc gia có AI riêng (mua bán điện, phản ứng khi có sự cố phóng xạ), quân đội bảo vệ hạ tầng.
- **Lớp 3 (Blueprint):** góc nhìn bên trong nhà máy để tự nối mạch và đặt thiết bị.

> Mô hình đã đơn giản hoá cho trò chơi. Các con số đúng bậc độ lớn, không dùng để thiết kế thật.
