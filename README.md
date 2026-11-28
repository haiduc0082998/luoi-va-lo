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

## Có gì trong bản này (Giai đoạn 1–12)

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

**Giai đoạn 8: bản đồ toàn màn hình, tối ưu điện thoại**
- **Màn hình chính chỉ còn bản đồ 3D.** Phía trên là dải chỉ số mờ trong suốt; trên điện thoại chỉ hiện giờ, tốc độ, ngân sách, lòng dân, tần số, bấm "Thêm chỉ số" để xem hết.
- **Thanh nút bên phải** mở các cửa sổ trượt ra cạnh bản đồ: Lưới, Công trình, Quốc gia, Điều hành, Bản đồ, Ván chơi.
  - Mỗi lúc mở một cửa sổ; bấm lại nút, nút ×, phím Esc, hoặc vuốt sang phải để đóng.
  - Chọn một công trình trên bản đồ thì cửa sổ Công trình tự mở.
  - Nút Quốc gia có chấm đỏ khi bản tin có cảnh báo chưa xem.
- **Công cụ** (Chọn, Xây dựng, Kéo dây, Bán) nằm ở góc dưới, vừa tầm ngón cái.
- **Trong thành phố:** thanh bên chỉ còn nút "Thành phố" để thu hoặc mở bảng thành phố.
- **Hỗ trợ điện thoại:**
  - Xoay ngang: chỉ số gom một hàng, nút chỉ còn biểu tượng.
  - Chừa vùng tai thỏ và thanh home (safe area).
  - Nút cao ít nhất 44 px; hướng dẫn thao tác riêng cho màn hình cảm ứng.

**Giai đoạn 9: nhân công, nâng cấp, khởi động lại lò, bản đồ rộng, mối nguy đô thị**
- **Nhân công** (cửa sổ Quốc gia):
  - Mỗi công trình cần một kíp vận hành, lấy từ khoảng 0,6% dân số đô thị.
  - Thiếu người thì nhà máy chỉ chạy 30–100% công suất, công trường và sửa chữa chậm lại, nâng cấp dễ hỏng.
  - Thuê người tốn phí tuyển và lương mỗi ngày; có việc làm thì dân vui hơn, sa thải thì mất lòng dân.
- **Nâng cấp công trình** với xác suất thành công:
  - Hạt nhân: hiệu suất tua-bin +2 điểm %. Than: +20% công suất. Thuỷ điện: +15%. Gió: +25%. Trạm biến áp: +40% MVA.
  - Thành phố: +25% dân và nhu cầu điện, nhà cao tầng hơn cả trên bản đồ lẫn trong thành phố.
  - Tỉ lệ thành công giảm theo cấp và tham nhũng, tăng nhờ kỹ sư giỏi và đủ nhân công.
  - Thất bại thì mất tiền; với lò hạt nhân thì lò còn bị SCRAM.
- **Nút "Khởi động lại lò"** chạy quy trình thật trên mô hình vật lý:
  - Đóng máy cắt CB1–CB3 và chạy 4 bơm.
  - Chờ lõi dưới 330 °C, áp suất bình thường, rồi giải trừ SCRAM.
  - Rút thanh 0,4%/s tới 100% công suất.
  - Lò vỡ ống hoặc nóng chảy thì phải sửa chữa / thay lõi trước (tốn tiền, mất 18–72 giờ).
- **Bản đồ 380 × 380** (trước là 240 × 240):
  - Thêm đồng bằng phía nam với thành phố **Nam Bình**, miền duyên hải phía tây với **Tây Hải**, bờ biển, và cao nguyên của nước láng giềng.
  - Có hàng rào biên giới; bên kia biên giới không được xây.
  - Trục đông – tây nâng lên 500 kV.
- **Ẩn vùng ngoài màn hình:** công trình, tuyến dây và hạ tầng nằm ngoài khung nhìn camera thì không vẽ và không chạy hoạt cảnh. Logic game vẫn chạy đủ, nên khi quay lại vùng đó mọi thứ đúng trạng thái hiện tại.
- **Điều độ biết giới hạn đường dây:** nhà máy không bị giao phát quá khả năng tải các tuyến nối ra (khi rơ-le bật). Thiếu đường dây thì cố vấn nhắc kéo thêm tuyến.
- **Tiện ích đô thị:**
  - **Ngân hàng:** thu nhập đều mỗi ngày.
  - **Đài truyền hình:** chặn tuyên truyền.
- **Mối nguy đô thị:**
  - **Thuốc phiện:** buôn lậu qua cảng, làm giảm hạnh phúc và năng suất lao động.
  - **Khủng bố:** đánh bom trạm biến áp hoặc toà nhà; lính gác chặn được.
  - **Tuyên truyền chống phá:** làm xói mòn lòng dân.
  - Cảnh sát, bệnh viện, đài truyền hình làm giảm các mối nguy; có 3 chiến dịch toàn quốc để đẩy lùi nhanh.
- **Cố vấn** (nút Mẹo): lời khuyên theo tình huống, kèm nút làm ngay (khởi động lại lò, thuê đủ người, mở chiến dịch…), và 12 mẹo chơi.

**Giai đoạn 10: thời tiết ngẫu nhiên, ngày nhanh gấp 5, tối ưu hiệu năng**
- **Thời tiết ngẫu nhiên:**
  - 7 kiểu: nắng, gió mạnh, mưa rào, nắng nóng, rét đậm, sương mù, bão.
  - Chọn ngẫu nhiên theo xác suất, mỗi đợt kéo dài 2–10 giờ; gió giật và nhiệt độ dao động trong từng đợt.
  - Rét đậm làm tăng nhu cầu sưởi; sương mù và mưa làm trời tối và mù hơn.
- **Ngày trôi nhanh gấp 5:** các mức tốc độ là 1× (thời gian thực, để xử lý sự cố lò), 50×, 300× (mặc định, một ngày ≈ 4,8 phút), 1500×.
- **Mô phỏng đa nhịp:**
  - Lò phản ứng bước 0,05 s; lưới, kinh tế, chính trị bước 0,25–1 s game.
  - Ở 300× thời gian tính giảm từ khoảng 250 ms còn khoảng 30 ms mỗi giây thực; ở 1500× chỉ khoảng 35 ms.
- **Giảm draw call khoảng 59%** (3 263 → 1 324 ở góc nhìn mặc định):
  - Cây cối dùng hardware instancing: 520 cây chỉ 2 draw call.
  - Dây điện mỗi tuyến gộp thành một lưới động (6 đoạn võng mỗi khoảng cột).
- **Bóng đổ:** chỉ vẽ lại khi camera di chuyển, còn đứng yên thì 6 khung hình một lần.
- **Màu dây theo mức tải:** xanh lá dưới 70%, vàng 70–90%, đỏ trên 90%; dây vẫn phát sáng khi quá nhiệt.
- **Cờ cảnh báo trên thanh chỉ số:** "i" là thông tin, "!" nhấp nháy là nghiêm trọng. Rê chuột để xem nguyên nhân và cách xử lý (ví dụ tần số 50,2 Hz là dư công suất, nên xuất khẩu hoặc giảm lò); bấm để mở Cố vấn.
- **Nhiên liệu:** hiện số ngày uranium còn đủ theo công suất lò thực tế và sản lượng mỏ. Chạy lò thấp thì tiết kiệm nhiên liệu.
- **Mô hình mới:** mây (`cloud.glb`, giảm từ 57 600 xuống khoảng 1 450 tam giác) và máy bay chở khách (`airliner.glb`) bay ngang bầu trời.
- **Nhiệt điện Đồi Than** dùng mô hình nhà máy nhiệt điện: khói than ra 2 ống khói theo công suất phát, hơi nước ra 2 tháp làm mát.
- **Nhà máy hạt nhân Sông Lam dùng mô hình cụm 4 khối lò** (trước chỉ dùng trong kịch bản RBMK), thay cho khu lò VVER dựng tay:
  - Khối lò thứ 4 là tổ máy 1; khối thứ 3 là tổ máy 2, hiện khi xây xong. Lúc đang xây có tường lên dần và cần cẩu quay.
  - Nắp lò trên mái phát sáng theo công suất và nhiệt độ: xanh Cherenkov, rồi cam, rồi đỏ.
  - Cửa sổ sáng đèn về đêm (tối đi khi nhà máy mất điện tự dùng); đèn đỏ báo không lưu nhấp nháy trên 3 ống khói.
  - Mặt bằng được san phẳng cho cả khu.
- Diễn biến khi có sự cố (áp dụng cho cả hai tổ máy):
  - Khối lò sụp thành đống đổ nát khi nổ.
  - Mái vòm che an toàn mới chỉ dựng lên (trên tổ máy 1) khi người chơi bấm "Thay lõi" để dọn dẹp.
  - Sửa xong thì lò số 4 trở lại, và vẫn là lò RBMK (trước đây lò sửa xong bị đổi thành VVER).

**Giai đoạn 11: giảm giật**

Đo bằng `?prof` trên địa chỉ trang (số liệu ở `window.__prof`):

| | Trước | Sau |
|---|---|---|
| Thành phố, lệnh vẽ | 5 188 | 90–166 |
| Toàn cảnh, lệnh vẽ | 1 115 | khoảng 550 |

- **Mô hình gộp làm một khối mang màu theo đỉnh:** ô tô 17 khối còn 2, người còn 2, máy bay 737 từ 9 còn 1, nhà máy 13–16 còn 1 (cộng các phần cần bật tắt).
- **Xe và người trong thành phố vẽ bằng GPU instancing:** thân xe của cả 80 chiếc chung một lệnh vẽ, sơn mỗi màu một lệnh; người đi bộ tương tự.
- **Gộp tĩnh** (BatchManager) cho:
  - Nhà cửa, vỉa hè, 360 vạch kẻ đường, ray metro trong thành phố.
  - Cột điện của từng tuyến, cụm nhà thành phố trên bản đồ, trạm biến áp, cửa khẩu, hàng rào biên giới.
  - Mỗi tuyến hay công trình một nhóm riêng, nên ẩn hay xoá một cái chỉ phải dựng lại nhóm của nó.
- **Mặt đất mịn liền mạch** (trước là đa giác low-poly):
  - Lưới 190 × 190 dùng chung đỉnh, pháp tuyến tính từ độ dốc thật nên ánh sáng chuyển mượt.
  - Màu chuyển dần: cát → cỏ → cỏ khô → đá → tuyết, có loang lổ nhẹ; biên giới chuyển màu dần.
  - Mép vùng san nền quanh công trình chuyển mượt, bóng đổ chỉnh để không bị sọc trên sườn đồi.
- **Bảng chữ** (chỉ số, cửa sổ) cập nhật 10 lần/giây thay vì mỗi khung hình. Bấm nút thì vẽ lại ngay.
- **Đồ hoạ tự thích nghi:**
  - Điện thoại mặc định đồ hoạ thấp; game nhớ lựa chọn của người chơi.
  - Máy chạy dưới khoảng 25 khung hình/giây liên tục 4 giây thì tự hạ đồ hoạ (có thông báo), trừ khi người chơi đã tự chọn.
  - Đồ hoạ thấp chỉ hiện một nửa số xe và người.
  - Màn hình mật độ cao trên điện thoại vẽ tối đa 1,5×.
  - Tắt khử răng cưa ở cấp thiết bị, vì hậu kỳ đã tự khử răng cưa.

**Giai đoạn 12: biển, bản đồ 460 × 460, dễ chơi hơn**
- **Biển:**
  - Bờ biển phía tây và phía nam uốn lượn, có bãi thoải, thềm nông rồi sâu dần; sông đổ ra cửa biển ở phía nam.
  - Mặt biển trải tới chân trời, có đáy biển thẫm bên dưới. Góc nhìn mới: **Cửa biển**.
  - **Cảng biển:** cảng xây được sát bờ biển, không chỉ ven sông.
  - **Trại gió ngoài khơi:** đặt trên thềm biển nông (sâu tới khoảng 10). Gió biển mạnh hơn 12% và tuabin lớn hơn 20%, nên phát nhiều hơn trại trên bờ.
  - Không xây được dưới biển hay dưới hồ nước.
- **Bản đồ 460 × 460** (trước là 380 × 380): lưới địa hình 230 × 230; camera, mây, máy bay, sương mù nới theo.
- **Dễ chơi hơn:**
  - Vốn khởi đầu 50 triệu USD (trước 20); lòng dân khởi đầu 65%; thuê sẵn đủ nhân công.
  - **Ngân sách trung ương cấp hằng ngày** khoảng 0,75–1,5 triệu USD, nhiều hơn khi được lòng dân. Rê chuột lên ô Ngân sách để xem thu chi mỗi ngày.
  - Ma tuý, khủng bố, tuyên truyền tăng chậm hơn 25%; cảnh sát và đài truyền hình vẫn đẩy lùi với tốc độ cũ.

**Giai đoạn 13: điện mặt trời và trạm pin lưu trữ**
- **Trại điện mặt trời 100 MW** (5,8 triệu USD + 4 t đất hiếm):
  - Phát theo góc mặt trời: đỉnh buổi trưa, bằng 0 về đêm.
  - Mây che làm giảm tới 75%; tấm pin nóng thì giảm 0,4%/°C.
  - Hình 3D: 6 hàng tấm pin nghiêng 25° về phía nam, có tủ biến tần.
- **Trạm pin lưu trữ 200 MW / 400 MWh** (9,2 triệu USD + 12 t đất hiếm):
  - Chỉ sạc bằng điện "phải phát" còn dư (mặt trời, gió, hạt nhân), không sạc bằng nước hồ thuỷ điện. Hiệu suất khứ hồi khoảng 90%.
  - Xả khi thuỷ điện đã hết sức, trước nhiệt điện than, nên cao điểm tối 19–20 h đỡ phải đốt than.
  - Hình 3D: 4 container có quạt tản nhiệt. Vạch đèn trên trạm cho biết mức pin: xanh là đang sạc hoặc chờ, cam là đang xả.
- Cả hai đều nâng cấp được, cần nhân công, có bảng thông tin riêng (mức pin, sạc/xả MW, nắng lúc này) và nhãn trên bản đồ.
- **Nhiệm vụ mới "Nắng trưa, đèn tối":** xây 2 trại mặt trời và 1 trạm pin nối lưới, thưởng 6 triệu USD và 20 RP.
- Cố vấn nhắc xây pin khi cao điểm tối phải chạy nhiều than, và nhắc khi trại hoặc trạm pin chưa nối dây.
- Xây công trình mới sẽ chặt cây trong khuôn viên, không còn cây mọc xuyên qua nhà.

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
  ui/drawers.js        thanh nút bên phải và các cửa sổ trượt (mở/đóng, vuốt để đóng, chấm báo)
  ui/extras.js         bảng Nhân công và cửa sổ Cố vấn
  workforce.js         nhân công: nhu cầu theo công trình, lực lượng lao động, lương, hệ số công suất
  upgrade.js           nâng cấp công trình có xác suất thành công
  startup.js           quy trình khởi động lại lò, sửa chữa sau sự cố
  tips.js              cố vấn: lời khuyên theo trạng thái ván chơi
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
