"""Chuẩn bị các file GLB người chơi gửi để dùng trong game (chạy: python models/prepare_uploads.py).

- cloud_1.glb (57 600 tam giác): quá nặng cho hàng chục đám mây. Giảm còn khoảng 1 500 tam giác bằng gộp đỉnh
  theo lưới ô (vertex clustering): mây vốn tròn mềm nên nhìn gần như không khác. Tô trắng, đặt tâm ở gốc.
- nha_may_nhiet_dien.glb (48 khối): gộp theo màu (48 → vài lệnh vẽ), in vị trí đỉnh ống khói / tháp làm mát.
- chernobyl_game_complex.glb (148 khối): bỏ nền, gộp theo màu; giữ riêng khối lò số 4 (Reactor4), mái vòm che
  an toàn (Arch) và thêm khối đổ nát (Reactor4_Ruin); gốc toạ độ đặt tại tâm lò số 4.
- airplane.glb (20 500 tam giác, 21 khối có màu đỉnh): giữ nguyên hình, gộp thành một lưới (mũi vốn đã hướng −Z),
  đặt đáy ở y = 0 để dùng cho máy bay dân dụng bay ngang bầu trời.
"""
import os
import sys

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, 'source')
OUT = os.path.join(HERE, '..', 'public', 'models')


def cluster(mesh, cell):
    """Gộp các đỉnh rơi vào cùng ô lưới cạnh `cell`, bỏ tam giác suy biến."""
    key = np.floor(mesh.vertices / cell).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    n = inv.max() + 1
    verts = np.zeros((n, 3)); cnt = np.zeros(n)
    np.add.at(verts, inv, mesh.vertices); np.add.at(cnt, inv, 1)
    verts /= cnt[:, None]
    faces = inv[mesh.faces]
    ok = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    faces = np.unique(np.sort(faces[ok], axis=1), axis=0, return_index=True)[1]
    faces = inv[mesh.faces][ok][np.sort(faces)]
    out = trimesh.Trimesh(verts, faces, process=True)
    out.fix_normals()
    return out


def cloud():
    s = trimesh.load(os.path.join(SRC, 'cloud_1.glb'))
    m = trimesh.util.concatenate(list(s.dump()))
    lo, hi = m.bounds
    target, cell = 1500, (hi - lo).max() / 30
    for _ in range(12):  # dò kích thước ô để còn khoảng 1 500 tam giác
        c = cluster(m, cell)
        if len(c.faces) <= target: break
        cell *= 1.15
    c.apply_translation(-(c.bounds[0] + c.bounds[1]) / 2)
    c.apply_scale(1 / (c.bounds[1] - c.bounds[0]).max())  # dài nhất = 1 đơn vị, game tự phóng to
    c.visual = trimesh.visual.TextureVisuals(material=PBRMaterial(baseColorFactor=[236, 240, 243, 255], metallicFactor=0, roughnessFactor=1))
    out = os.path.join(OUT, 'cloud.glb'); trimesh.Scene({'Cloud': c}).export(out)
    print(f'cloud.glb: {len(m.faces)} → {len(c.faces)} tam giác, {os.path.getsize(out) // 1024} KB')


def airplane():
    s = trimesh.load(os.path.join(SRC, 'airplane.glb'))
    parts = list(s.dump())
    for p in parts:  # giữ màu đỉnh của từng khối
        if not isinstance(p.visual, trimesh.visual.ColorVisuals):
            p.visual = p.visual.to_color()
    m = trimesh.util.concatenate(parts)
    # Mô hình gốc đã có mũi hướng −Z (kiểm tra bằng ảnh xem trước: kính buồng lái ở đầu −Z) nên không xoay.
    m.merge_vertices()
    m.apply_translation([-(m.bounds[0][0] + m.bounds[1][0]) / 2, -m.bounds[0][1], -(m.bounds[0][2] + m.bounds[1][2]) / 2])
    out = os.path.join(OUT, 'airliner.glb'); trimesh.Scene({'Airliner': m}).export(out)
    print(f'airliner.glb: {len(m.faces)} tam giác, {os.path.getsize(out) // 1024} KB')


def parts(path, skip=()):
    """Các khối của file GLB đã áp biến đổi, kèm tên nút và màu chủ đạo (RGBA 0–255)."""
    s = trimesh.load(path)
    for name in s.graph.nodes_geometry:
        if name in skip: continue
        T, g = s.graph[name]
        m = s.geometry[g].copy(); m.apply_transform(T)
        try: fc = np.asarray(m.visual.face_colors)
        except Exception: fc = np.full((len(m.faces), 4), 200)
        cols, cnt = np.unique(fc, axis=0, return_counts=True)
        yield name, m, tuple(int(c) for c in cols[np.argmax(cnt)])


def export_groups(groups, out, double=()):
    """groups: {tên nhóm: (màu, [lưới])} → một nút / một vật liệu cho mỗi nhóm. double: nhóm là vỏ mỏng, vẽ cả hai mặt."""
    scene = trimesh.Scene()
    for name, (color, meshes) in groups.items():
        m = trimesh.util.concatenate(meshes)
        if color is None:  # nhóm đã mang màu theo đỉnh
            scene.add_geometry(m, node_name=name, geom_name=name); continue
        m.visual = trimesh.visual.TextureVisuals(material=PBRMaterial(baseColorFactor=list(color[:3]) + [255], metallicFactor=0.05, roughnessFactor=0.75, doubleSided=name in double))
        scene.add_geometry(m, node_name=name, geom_name=name)
    scene.export(out)
    return scene


def by_color(items):
    """Gộp mọi khối thành MỘT lưới 'Body' mang màu theo đỉnh: một lệnh vẽ thay vì một lệnh mỗi màu."""
    body = []
    for _, m, c in items:
        m = m.copy(); m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(list(c[:3]) + [255], (len(m.vertices), 1)))
        body.append(m)
    return {'Body': (None, body)} if body else {}


def thermal():
    items = list(parts(os.path.join(SRC, 'nha_may_nhiet_dien.glb')))
    out = os.path.join(OUT, 'thermal-plant.glb')
    sc = export_groups(by_color(items), out)
    tris = sum(len(m.faces) for _, m, _ in items)
    print(f'thermal-plant.glb: {len(items)} khối → {len(sc.geometry)} nhóm màu, {tris} tam giác, {os.path.getsize(out) // 1024} KB')
    for name, m, c in items:  # ống khói: cao, mảnh; tháp làm mát: cao, to
        lo, hi = m.bounds; w = max(hi[0] - lo[0], hi[2] - lo[2]); h = hi[1] - lo[1]
        if h > 6 and w < 9:
            print(f'   đỉnh {"ống khói" if w < 3 else "tháp làm mát"}: x={(lo[0] + hi[0]) / 2:.2f} y={hi[1]:.2f} z={(lo[2] + hi[2]) / 2:.2f} (rộng {w:.1f})')


def ruin_boxes(x0, x1, z0, z1, h):
    """Khối lò số 4 sau vụ nổ: tường vỡ cao thấp, mất mái, đống đổ nát bên trong."""
    B = lambda cx, cy, cz, sx, sy, sz: trimesh.creation.box(extents=(sx, sy, sz), transform=trimesh.transformations.translation_matrix((cx, cy, cz)))
    t, dx, dz, out = 1.2, x1 - x0, z1 - z0, []
    out.append(B(x0 + t / 2, h / 2, (z0 + z1) / 2, t, h, dz))
    out.append(B(x1 - t / 2, h * 0.31, (z0 + z1) / 2, t, h * 0.62, dz))
    for i, k in enumerate((1.0, 0.75, 0.45, 0.3)):
        out.append(B(x0 + (i + 0.5) * dx / 4, h * k / 2, z0 + t / 2, dx / 4, h * k, t))
    for i, k in enumerate((0.85, 0.35, 0.65, 0.2)):
        out.append(B(x0 + (i + 0.5) * dx / 4, h * k / 2, z1 - t / 2, dx / 4, h * k, t))
    rubble = [(0.25, 0.3, 3), (0.5, 0.55, 4.5), (0.72, 0.35, 2.4), (0.4, 0.72, 3.6), (0.66, 0.7, 2)]
    return out, [B(x0 + dx * rx, rh / 2, z0 + dz * rz, 4 + i, rh, 3.5) for i, (rx, rz, rh) in enumerate(rubble)]


def chernobyl_complex():
    """Cụm 4 khối lò làm nhà máy hạt nhân của game. Khối thứ 4 (hall3) = tổ máy 1, khối thứ 3 (hall2) = tổ máy 2.
    Tách riêng để game bật/tắt: Unit1/Unit2 (khối lò), *_Win (cửa sổ, sáng đèn về đêm), Windows (cửa sổ các khối
    khác), Arch (mái vòm che an toàn), Unit*_Ruin / Unit*_Rubble (đổ nát tự dựng khi lò nổ)."""
    items = list(parts(os.path.join(SRC, 'chernobyl_game_complex.glb'), skip=('terrain',)))
    special = {}
    def tag(n):
        for u, h in ((1, 3), (2, 2)):
            if n in (f'hall{h}', f'roof{h}'): return f'Unit{u}'
            if n.startswith(f'window{h}_'): return f'Unit{u}_Win'
        if n.startswith('window'): return 'Windows'
        if n == 'arch_canopy': return 'Arch'
        return None
    rest = []
    for it in items:
        t = tag(it[0])
        if t: special.setdefault(t, (it[2], []))[1].append(it[1])
        else: rest.append(it)
    groups = by_color(rest)
    groups.update(special)
    for u, (x0, x1) in ((1, (35, 65)), (2, (0, 30))):
        walls, rubble = ruin_boxes(x0, x1, -24.5, 0.5, 14)
        groups[f'Unit{u}_Ruin'] = ((60, 56, 52, 255), walls)
        groups[f'Unit{u}_Rubble'] = ((38, 40, 42, 255), rubble)
    for _, (c, ms) in groups.items():  # gốc toạ độ: tâm tổ máy 1 (hall3: x 35..65, z −24,5..0,5)
        for m in ms: m.apply_translation((-50, 0, 12))
    out = os.path.join(OUT, 'chernobyl-complex.glb')
    sc = export_groups(groups, out, double=('Arch',))
    tris = sum(len(g.faces) for g in sc.geometry.values())
    print(f'chernobyl-complex.glb: {len(items)} khối → {len(sc.geometry)} nhóm, {tris} tam giác, {os.path.getsize(out) // 1024} KB, bounds {np.round(sc.bounds, 1).tolist()}')


if __name__ == '__main__':
    ALL = {'cloud': cloud, 'airplane': airplane, 'thermal': thermal, 'chernobyl': chernobyl_complex}
    for k in sys.argv[1:] or ALL:
        ALL[k]()
