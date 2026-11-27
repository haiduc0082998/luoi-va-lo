"""Chuẩn bị các file GLB người chơi gửi để dùng trong game (chạy: python models/prepare_uploads.py).

- cloud_1.glb (57 600 tam giác): quá nặng cho hàng chục đám mây. Giảm còn khoảng 1 500 tam giác bằng gộp đỉnh
  theo lưới ô (vertex clustering): mây vốn tròn mềm nên nhìn gần như không khác. Tô trắng, đặt tâm ở gốc.
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


if __name__ == '__main__':
    for k in sys.argv[1:] or ['cloud', 'airplane']:
        {'cloud': cloud, 'airplane': airplane}[k]()
