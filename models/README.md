# Thư mục mô hình 3D

| File | Nội dung |
|---|---|
| `source/Boeing737_800_CAD_macro.FCMacro` | Macro FreeCAD gốc dựng Boeing 737-800 theo thông số gần đúng (mét). |
| `build_b737.py` | Dựng lại cùng hình học bằng Python (`trimesh`) và xuất GLB cho game, không cần cài FreeCAD. |
| `boeing737-800-preview.png` | Ảnh xem trước: góc nghiêng và nhìn từ trên xuống. |
| `../public/models/boeing737-800.glb` | File game tải lúc chạy (Vite sao chép thư mục `public/` vào bản build). |

## Dựng lại file GLB

```bash
pip install trimesh shapely mapbox_earcut
python models/build_b737.py          # → public/models/boeing737-800.glb
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

Máy bay ở sân bay (tỉ lệ 0,26) và máy bay bay qua thành phố (tỉ lệ 0,32) đều dùng mô hình này.

## Thêm mô hình mới

Mở macro trong FreeCAD (Macro → Macros → Execute), chọn các đối tượng rồi File → Export → **glTF (.glb)**. Đặt file vào `public/models/`, sau đó gọi `loadModel` với một tên mới.

> Mô hình gần đúng để học tập và làm game, không phải dữ liệu kỹ thuật của Boeing.
