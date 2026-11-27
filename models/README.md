# Thư mục mô hình 3D

Các mô hình dựng từ macro FreeCAD (thư mục `source/`). Ở đây không cần cài FreeCAD: script Python dựng lại đúng hình học của macro rồi xuất **GLB** vào `public/models/`. Game tải các file này lúc chạy; Vite tự sao chép thư mục `public/` vào bản build.

| Macro gốc (`source/`) | File game (`public/models/`) | Dùng ở đâu trong game |
|---|---|---|
| `Boeing737_800_CAD_macro.FCMacro` | `boeing737-800.glb` | Máy bay ở sân bay, máy bay bay qua thành phố |
| `Cooling_Tower_CAD.FCMacro` | `cooling-tower.glb` | Mọi tháp làm mát (nhà máy hạt nhân, công trình “tháp làm mát”) — tháp 150 m thu về cao 22 đơn vị |
| `Car_Model_FreeCAD.FCMacro` | `car.glb` | 80 ô tô chạy trong thành phố, mỗi xe được sơn lại một màu |
| `Male_Mannequin_CAD.FCMacro`, `Female_Mannequin_CAD.FCMacro` | `man.glb`, `woman.glb` | Người đi bộ trong thành phố (nam/nữ xen kẽ, đổi màu áo, quay mặt theo hướng đi) |
| `Chernobyl_Supercomplex_Expanded_LowPoly.FCMacro` | `chernobyl-supercomplex.glb` | Kịch bản **Lò kiểu RBMK** (đồ hoạ cao) |
| `Chernobyl_Power_Plant_PreAccident_LowPoly.FCMacro` | `chernobyl.glb` | Kịch bản **Lò kiểu RBMK** (đồ hoạ thấp) |

| Script | Việc |
|---|---|
| `cadlite.py` | Bộ lệnh nhỏ thay cho `Part` của FreeCAD (hộp, trụ, côn, cầu elip, capsule, vành khuyên, loft, xoay, đùn mặt) bằng `trimesh`; xuất GLB với trục Y lên, mặt trước nhìn −Z. |
| `build_models.py` | Dựng lại 6 macro mới. |
| `build_b737.py` | Dựng lại Boeing 737-800. |

Ảnh xem trước: `boeing737-800-preview.png` và `models-preview.png`.

### Chernobyl trong kịch bản RBMK

Khi chọn kịch bản “Lò kiểu RBMK, tắt bảo vệ”, cụm lò VVER (vòm, tháp làm mát, tổ máy 2) được ẩn đi và thay bằng nhà máy Chernobyl, lò số 4 nằm đúng vị trí lõi. Tỉ lệ 0,08 (khu 480 × 340 m chiếm 38 × 27 đơn vị) và góc quay 180° được chọn bằng cách dò địa hình, để khu nhà máy không lấn sông, nằm trên nền phẳng và không đè lên đập thủy điện hay trạm điện. Hơi nước bốc lên từ hai tháp làm mát của mô hình.

RBMK không có vỏ bọc, nên trên mái gian lò có một tấm phát sáng đổi màu theo nhiệt độ lõi. Khi lò nổ, khối lò số 4 được thay bằng **khối đổ nát** (nhóm `Reactor4_Ruin`, do script thêm vào: tường vỡ, mất mái, lõi hở), có lửa than chì và chùm phóng xạ.

### Những chỗ khác với macro

- **Mặt đất:** bỏ các tấm mặt đất tham chiếu (*Ground*, *SiteGround*, *Terrain*) vì game có địa hình riêng.
- **Phép cắt/hợp khối:** thay bằng khối rỗng dựng sẵn (vỏ tháp, vành khuyên) hoặc ghép lưới; nhìn giống hệt nhưng nhẹ hơn.
- **Người nữ:** macro tô một màu da cho cả người; mình thêm màu áo và váy.
- **Hàng rào supercomplex:** macro viết `-220 + x` với `x` chạy từ −220, làm hàng rào lệch sang trái tới −440 m; đã sửa cho khép kín quanh khu.
- **Người nộm:** dùng lưới thô (khoảng 7 500 tam giác mỗi người) vì thành phố có hơn 100 người.

## Dựng lại file GLB

```bash
pip install trimesh shapely mapbox_earcut
python models/build_b737.py          # → public/models/boeing737-800.glb
python models/build_models.py        # 6 mô hình còn lại (hoặc: build_models.py car tower ...)
python models/build_b737.py --stl    # thêm bản STL để in 3D hoặc mở bằng phần mềm CAD
```

Script giữ đúng các thông số của macro:
- **Thân:** loft 13 tiết diện elip từ mũi (z = −20) tới đuôi (z = 19,8).
- **Cánh:** cánh chính, winglet, đuôi ngang, đuôi đứng, đùn từ đa giác.
- **Động cơ:** côn hút gió, trụ, côn xả, giá treo; thêm mặt quạt tối màu.
- **Càng đáp và cửa sổ:** càng đáp 3 cụm, 56 cửa sổ khoang khách, thêm kính buồng lái.

Kết quả: 9 bộ phận, khoảng 6 900 tam giác, 130 KB. Trục Y hướng lên, mũi hướng −Z (quy ước của PlayCanvas).

## Dùng trong game

`src/world/kit.js` có hai hàm:
- `loadModel(app, tên, url)`: tải GLB một lần.
- `model(holder, tên, tỉ_lệ, góc_quay, hình_tạm)`: gắn mô hình vào một đối tượng. Trong lúc file chưa tải xong, hình hộp tạm được hiển thị rồi tự thay bằng mô hình thật.

Hàm `model` còn nhận thêm một hàm `onReady(e)` chạy khi mô hình đã gắn xong. Game dùng hàm này để sơn lại xe, đổi màu áo người đi bộ, và tìm khối `Reactor4` / `Reactor4_Ruin` của Chernobyl.

## Thêm mô hình mới

Mở macro trong FreeCAD (Macro → Macros → Execute), chọn các đối tượng rồi File → Export → **glTF (.glb)**. Đặt file vào `public/models/`, sau đó gọi `loadModel` với một tên mới.

> Mô hình gần đúng để học tập và làm game, không phải dữ liệu kỹ thuật hay bản vẽ xây dựng.
