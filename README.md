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

## Có gì trong bản này (Giai đoạn 1 + 2)

**Lưới điện**
- Điện trở R = ρL/A, tăng theo nhiệt độ dây.
- Dòng điện giải từ P = (U − I·R)·I. Nếu phương trình vô nghiệm thì xảy ra sụp đổ điện áp.
- Tổn hao I²R và cân bằng nhiệt của dây: dây võng, đỏ rực, tới 250 °C thì chạm cây và cháy.
- Rơ-le quá dòng, máy biến áp 400 MVA quá tải thì cháy dầu.

**Lò phản ứng nước áp lực 3 000 MWt**
- Độ phản ứng gồm thanh điều khiển, hệ số nhiệt âm và hệ số rỗng dương (chế độ RBMK).
- Nhiệt phân rã hai nhóm, nên lò vẫn nóng lên sau khi SCRAM.
- Cân bằng nhiệt Q = m·c·ΔT, bơm có quán tính, máy phát diesel khởi động sau 15 giây.
- Chuỗi sự cố: áp suất → van xả → vỡ ống (LOCA) → hydro → nổ → nóng chảy lõi → đám mây phóng xạ theo gió.

**Quốc gia**
- Ngân sách: bán điện giá 60 USD/MWh, chi phí sửa chữa.
- Lòng dân: giảm khi mất điện, sụt áp hoặc có phóng xạ; dưới 25% sẽ có biểu tình.
- Bản tin thế giới, ngày và đêm theo đồng hồ trong game.

## Cấu trúc mã

```
src/
  physics/grid.js      mô hình lưới truyền tải (thuần JS, không phụ thuộc engine)
  physics/reactor.js   mô hình lò phản ứng
  game.js              thời gian, kinh tế, lòng dân, sự kiện → bản tin, kịch bản
  world/scene.js       thế giới 3D PlayCanvas: cột điện, dây 3 pha, thành phố, nhà máy, lửa, khói
  world/camera.js      camera quỹ đạo (chuột và cảm ứng)
  ui/hud.js            bảng điều khiển, số liệu kèm công thức, đèn báo
tests/physics.test.js  kiểm thử các kịch bản vật lý
```

Phần vật lý tách khỏi engine, nên có thể kiểm thử bằng Node và sau này chuyển sang Web Worker khi lưới có hàng nghìn nút.

## Lộ trình tiếp theo

- **Giai đoạn 3:** bản đồ thành phố có địa hình; nhiều nhà máy và trạm; lưới nhiều nút giải bằng phương pháp dòng công suất; cây công nghệ.
- **Giai đoạn 4:** bản đồ thế giới, nhiều quốc gia, AI đối thủ, quân đội, ngoại giao, chính sách.
- **Lớp 3 (Blueprint):** góc nhìn bên trong nhà máy để tự nối mạch và đặt thiết bị.

> Mô hình đã đơn giản hoá cho trò chơi. Các con số đúng bậc độ lớn, không dùng để thiết kế thật.
