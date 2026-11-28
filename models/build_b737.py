"""Dựng mô hình Boeing 737-800 cho game từ cùng thông số với macro FreeCAD
(models/source/Boeing737_800_CAD_macro.FCMacro), rồi xuất GLB cho PlayCanvas.

Chạy:  pip install trimesh shapely mapbox_earcut
       python models/build_b737.py            → public/models/boeing737-800.glb
Đơn vị: mét. Trục: Y lên trên, mũi máy bay hướng −Z (đúng quy ước "phía trước" của PlayCanvas).
Mô hình gần đúng để học tập và làm game, KHÔNG phải dữ liệu kỹ thuật của hãng.
"""
import math
import os
import sys

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'boeing737-800.glb')
SEG = 32  # số cạnh mỗi tiết diện tròn/elip


def material(rgb, metal=0.1, rough=0.55):
    return PBRMaterial(baseColorFactor=[int(c * 255) for c in rgb] + [255], metallicFactor=metal, roughnessFactor=rough)


def colored(mesh, rgb, **kw):
    mesh.visual = trimesh.visual.TextureVisuals(material=material(rgb, **kw))
    return mesh


def loft(stations, seg=SEG):
    """Thân máy bay: nối các tiết diện elip (z, bán kính x, bán kính y) và đóng hai đầu."""
    verts, faces = [], []
    for z, rx, ry in stations:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append((rx * math.cos(a), ry * math.sin(a), z))
    n = len(stations)
    for s in range(n - 1):
        for k in range(seg):
            a, b = s * seg + k, s * seg + (k + 1) % seg
            c, d = a + seg, b + seg
            faces += [(a, c, b), (b, c, d)]
    for s, z in ((0, stations[0][0]), (n - 1, stations[-1][0])):
        verts.append((0, 0, z))
        ci = len(verts) - 1
        for k in range(seg):
            a, b = s * seg + k, s * seg + (k + 1) % seg
            faces.append((ci, b, a) if s == 0 else (ci, a, b))
    m = trimesh.Trimesh(np.array(verts), np.array(faces))
    m.fix_normals()
    return m


def prism(points, extrude):
    """Đa giác phẳng 3D đùn theo vectơ — tương đương Part.Face(...).extrude(...) của FreeCAD."""
    P = np.array(points, float)
    E = np.array(extrude, float)
    normal = np.zeros(3)
    for i in range(len(P)):  # pháp tuyến Newell
        a, b = P[i], P[(i + 1) % len(P)]
        normal += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    normal /= np.linalg.norm(normal)
    if abs(np.dot(normal, E) / np.linalg.norm(E)) < 0.3:  # mặt gần song song hướng đùn → đùn theo pháp tuyến
        E = normal * np.linalg.norm(E) * (1 if np.dot(normal, E) >= 0 else -1)
    u = P[1] - P[0]
    u -= normal * np.dot(u, normal)
    u /= np.linalg.norm(u)
    v = np.cross(normal, u)
    poly2d = [(np.dot(p - P[0], u), np.dot(p - P[0], v)) for p in P]
    from shapely.geometry import Polygon
    vs, fs = trimesh.creation.triangulate_polygon(Polygon(poly2d))
    base = np.array([P[0] + a * u + b * v for a, b in vs])
    n = len(base)
    verts = np.vstack([base, base + E])
    faces = [tuple(f) for f in fs] + [tuple(np.array(f[::-1]) + n) for f in fs]
    # thành bên theo biên của đa giác (dùng đỉnh gốc)
    ring = [int(np.argmin(np.linalg.norm(base - p, axis=1))) for p in P]
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        faces += [(a, b, b + n), (a, b + n, a + n)]
    m = trimesh.Trimesh(verts, np.array(faces))
    m.fix_normals()
    return m


def lathe_z(profile, center, seg=SEG):
    """Khối tròn xoay quanh trục song song Z: profile = [(z, r), ...], đóng hai đầu."""
    cx, cy = center
    verts, faces = [], []
    for z, r in profile:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    n = len(profile)
    for s in range(n - 1):
        for k in range(seg):
            a, b = s * seg + k, s * seg + (k + 1) % seg
            faces += [(a, a + seg, b), (b, a + seg, b + seg)]
    for s in (0, n - 1):
        verts.append((cx, cy, profile[s][0]))
        ci = len(verts) - 1
        for k in range(seg):
            a, b = s * seg + k, s * seg + (k + 1) % seg
            faces.append((ci, b, a) if s == 0 else (ci, a, b))
    m = trimesh.Trimesh(np.array(verts), np.array(faces))
    m.fix_normals()
    return m


def cylinder(r, h, start, axis, seg=24):
    axis = np.array(axis, float)
    m = trimesh.creation.cylinder(radius=r, height=h, sections=seg)
    m.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], axis))
    m.apply_translation(np.array(start, float) + axis * h / 2)
    return m


def build():
    parts = {}
    # 1. Thân (giống hệt các trạm tiết diện trong macro)
    stations = [(-20.0, 0.10, 0.12), (-19.2, 0.48, 0.50), (-18.0, 0.92, 0.85), (-16.2, 1.35, 1.20), (-13.5, 1.68, 1.48),
                (-8.0, 1.82, 1.65), (0.0, 1.85, 1.68), (8.0, 1.82, 1.65), (12.5, 1.68, 1.52), (15.0, 1.40, 1.28),
                (17.2, 0.95, 0.90), (19.0, 0.50, 0.48), (19.8, 0.12, 0.12)]
    parts['Fuselage'] = colored(loft(stations), (0.82, 0.85, 0.89))

    # 2. Cánh chính
    wing = [(1.7, -3.8), (17.9, 3.4), (17.9, 4.5), (5.3, 3.1), (1.7, 3.8)]
    wings = [prism([(x * s, -0.15, z) for x, z in wing], (0, 0.42, 0)) for s in (-1, 1)]
    parts['Main_Wings'] = colored(trimesh.util.concatenate(wings), (0.86, 0.88, 0.91))

    # 3. Winglet
    wl = lambda s: [(s * 17.45, 0.0, 3.45), (s * 18.05, 0.0, 3.70), (s * 18.25, 1.65, 4.65), (s * 17.55, 1.65, 4.35)]
    parts['Winglets'] = colored(trimesh.util.concatenate([prism(wl(s), (0, 0.18, 0)) for s in (-1, 1)]), (0.08, 0.24, 0.48))

    # 4. Đuôi ngang
    tp = lambda s: [(s * 0.5, 0.25, 13.0), (s * 6.0, 0.25, 15.1), (s * 6.0, 0.25, 15.9), (s * 1.0, 0.25, 14.9)]
    parts['Horizontal_Tail'] = colored(trimesh.util.concatenate([prism(tp(s), (0, 0.28, 0)) for s in (-1, 1)]), (0.82, 0.85, 0.89))

    # 5. Đuôi đứng
    fin = [(-0.23, 1.0, 12.8), (-0.23, 1.2, 18.0), (-0.23, 2.3, 19.5), (-0.23, 3.5, 14.2), (-0.23, 2.4, 12.8)]
    parts['Vertical_Tail'] = colored(prism(fin, (0.46, 0, 0)), (0.08, 0.24, 0.48))

    # 6. Động cơ: côn hút gió + trụ + côn xả (một khối tròn xoay) và giá treo
    eng = []
    for s in (-1, 1):
        x = s * 7.4
        eng.append(lathe_z([(-1.55, 0.82), (-0.9, 1.02), (2.5, 1.02), (3.15, 0.72)], (x, -1.0)))
        eng.append(trimesh.creation.box(extents=(0.75, 1.0, 2.0)).apply_translation((x, -0.15, 0.9)))
    parts['Engine_Nacelles'] = colored(trimesh.util.concatenate(eng), (0.45, 0.49, 0.53), metal=0.5, rough=0.4)
    fans = [cylinder(0.78, 0.04, (s * 7.4, -1.0, -1.57), (0, 0, 1)) for s in (-1, 1)]
    parts['Engine_Fans'] = colored(trimesh.util.concatenate(fans), (0.06, 0.07, 0.08))

    # 7. Càng đáp: thanh chống + bánh
    gear = []
    for x, z, main in [(-1.0, 3.2, True), (1.0, 3.2, True), (0.0, -14.0, False)]:
        gear.append(cylinder(0.09, 1.65, (x, -2.7, z), (0, 1, 0)))
        r, count = (0.48, 2) if main else (0.34, 1)
        for i in range(count):
            off = (i - (count - 1) / 2.0) * 0.72
            gear.append(cylinder(r, 0.24, (x + off - 0.12, -3.1, z), (1, 0, 0)))
    parts['Landing_Gear'] = colored(trimesh.util.concatenate(gear), (0.25, 0.28, 0.31))

    # 8. Cửa sổ khoang khách (28 mỗi bên) + kính buồng lái
    win = []
    for s in (-1, 1):
        for i in range(28):
            m = trimesh.creation.icosphere(subdivisions=1, radius=0.13)
            m.apply_translation((s * 1.68, 0.55, -13.0 + i * 0.88))
            win.append(m)
    for s in (-1, 1):
        m = trimesh.creation.box(extents=(0.5, 0.28, 0.7))
        m.apply_transform(trimesh.transformations.rotation_matrix(s * 0.5, (0, 1, 0)))
        m.apply_translation((s * 0.55, 0.75, -17.7))
        win.append(m)
    parts['Cabin_Windows'] = colored(trimesh.util.concatenate(win), (0.04, 0.10, 0.16), metal=0.3, rough=0.2)

    # Gộp mọi bộ phận thành MỘT lưới mang màu theo đỉnh (1 lệnh vẽ cho mỗi máy bay thay vì 9)
    body = []
    for mesh in parts.values():
        c = mesh.visual.material.baseColorFactor
        m = mesh.copy(); m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.tile(list(c[:3]) + [255], (len(m.vertices), 1)))
        body.append(m)
    scene = trimesh.Scene()
    scene.add_geometry(trimesh.util.concatenate(body), node_name='Boeing737', geom_name='Boeing737')
    return scene, parts


if __name__ == '__main__':
    scene, parts = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    scene.export(OUT)
    tris = sum(len(m.faces) for m in parts.values())
    lo, hi = scene.bounds
    print(f'Đã xuất {os.path.relpath(OUT)}: {len(parts)} bộ phận, {tris} tam giác, '
          f'kích thước {hi[0]-lo[0]:.1f} × {hi[1]-lo[1]:.1f} × {hi[2]-lo[2]:.1f} m, {os.path.getsize(OUT)/1024:.0f} KB')
    if '--stl' in sys.argv:
        stl = OUT.replace('.glb', '.stl')
        trimesh.util.concatenate(list(parts.values())).export(stl)
        print('Kèm', os.path.relpath(stl))
