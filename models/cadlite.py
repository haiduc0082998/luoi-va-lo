"""cadlite: một phần nhỏ các lệnh Part của FreeCAD dựng lại bằng trimesh, đủ để chạy lại
các macro trong models/source mà không cần cài FreeCAD, rồi xuất GLB cho PlayCanvas.

Toạ độ khi dựng giống hệt FreeCAD (Z hướng lên). Lúc xuất, mô hình được xoay sang quy ước
của game: Y hướng lên, mặt trước hướng −Z. Phép hợp/trừ khối (fuse/cut) được thay bằng
cách ghép lưới hoặc dựng thẳng khối rỗng (vành khuyên, vỏ tròn xoay): nhìn giống hệt, nhẹ hơn.
"""
import math
import os

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

SEG = 16  # số cạnh mặt cầu/côn; giảm cho mô hình xuất hiện hàng trăm lần (người đi bộ)
PUBLIC = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')


def _fix(m):
    m.merge_vertices()
    m.fix_normals()
    return m


# ---------------- Khối cơ bản (tham số như Part.makeXxx) ----------------
def box(x, y, z, dx, dy, dz):
    m = trimesh.creation.box(extents=(dx, dy, dz))
    m.apply_translation((x + dx / 2, y + dy / 2, z + dz / 2))
    return m


def _place(m, base, axis):
    axis = np.array(axis, float)
    axis /= np.linalg.norm(axis)
    m.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], axis))
    m.apply_translation(np.array(base, float))
    return m


def cylinder(r, h, base=(0, 0, 0), axis=(0, 0, 1), seg=24):
    """Part.makeCylinder(r, h, base, dir): đáy tại base, cao theo dir."""
    m = trimesh.creation.cylinder(radius=r, height=h, sections=seg)
    m.apply_translation((0, 0, h / 2))
    return _place(m, base, axis)


def cone(r1, r2, h, base=(0, 0, 0), axis=(0, 0, 1), seg=None):
    seg = seg or SEG
    """Part.makeCone: côn cụt bán kính r1 ở đáy, r2 ở đỉnh."""
    return _place(lathe([(0, r1), (h, r2)], seg=seg), base, axis)


def sphere(r, c=(0, 0, 0), seg=None):
    return ellipsoid(c, (r, r, r), seg)


def ellipsoid(c, radii, seg=None):
    seg = seg or SEG
    m = trimesh.creation.uv_sphere(radius=1.0, count=[seg, seg])
    m.apply_scale(radii)
    m.apply_translation(c)
    return m


def capsule(a, b, ra, rb=None, seg=None):
    seg = seg or SEG
    """Côn giữa hai điểm + cầu ở hai đầu (capsule_between trong macro người nộm)."""
    rb = ra if rb is None else rb
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    L = np.linalg.norm(d)
    parts = [sphere(ra, a, seg), sphere(rb, b, seg)]
    if L > 0:
        parts.append(cone(ra, rb, L, a, d, seg))
    return trimesh.util.concatenate(parts)


def annulus(r_out, r_in, h, base=(0, 0, 0), seg=48):
    """Vành khuyên = makeCylinder(r_out).cut(makeCylinder(r_in))."""
    x, y, z = base
    return revolve([(r_in, 0), (r_out, 0), (r_out, h), (r_in, h)], (x, y), z, seg)


def lathe(profile, center=(0, 0), z0=0.0, seg=24, caps=True):
    """Khối tròn xoay quanh trục song song Z: profile = [(z, r), ...]. Giống makeLoft các đường tròn."""
    cx, cy = center
    verts, faces = [], []
    for z, r in profile:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append((cx + r * math.cos(a), cy + r * math.sin(a), z0 + z))
    n = len(profile)
    for s in range(n - 1):
        for k in range(seg):
            a, b = s * seg + k, s * seg + (k + 1) % seg
            faces += [(a, b, a + seg), (b, b + seg, a + seg)]
    if caps:
        for s in (0, n - 1):
            verts.append((cx, cy, z0 + profile[s][0]))
            ci = len(verts) - 1
            for k in range(seg):
                a, b = s * seg + k, s * seg + (k + 1) % seg
                faces.append((ci, b, a) if s == 0 else (ci, a, b))
    return _fix(trimesh.Trimesh(np.array(verts), np.array(faces)))


def revolve(loop, center=(0, 0), z0=0.0, seg=48):
    """Xoay một đa giác kín (r, z) quanh trục Z → khối rỗng kín (vỏ tháp, vành)."""
    cx, cy = center
    m = len(loop)
    verts, faces = [], []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        for r, z in loop:
            verts.append((cx + r * math.cos(a), cy + r * math.sin(a), z0 + z))
    for k in range(seg):
        k2 = (k + 1) % seg
        for i in range(m):
            i2 = (i + 1) % m
            a, b, c, d = k * m + i, k * m + i2, k2 * m + i, k2 * m + i2
            faces += [(a, b, c), (b, d, c)]
    return _fix(trimesh.Trimesh(np.array(verts), np.array(faces)))


def loft_rings(rings):
    """Part.makeLoft(các đa giác kín cùng số đỉnh, solid=True, ruled=True)."""
    R = [np.array(r, float) for r in rings]
    k = len(R[0])
    verts = np.vstack(R)
    faces = []
    for s in range(len(R) - 1):
        for i in range(k):
            a, b = s * k + i, s * k + (i + 1) % k
            faces += [(a, b, a + k), (b, b + k, a + k)]
    for s in (0, len(R) - 1):  # nắp: quạt tam giác (tiết diện lồi)
        for i in range(1, k - 1):
            faces.append((s * k, s * k + i, s * k + i + 1))
    return _fix(trimesh.Trimesh(verts, np.array(faces)))


def face_extrude(points, vec):
    """Part.Face(Part.makePolygon(points)).extrude(vec): tấm đa giác phẳng có độ dày."""
    P = np.array(points, float)
    E = np.array(vec, float)
    n = len(P)
    verts = np.vstack([P, P + E])
    faces = []
    for i in range(1, n - 1):
        faces += [(0, i, i + 1), (n, n + i + 1, n + i)]
    for i in range(n):
        j = (i + 1) % n
        faces += [(i, j, j + n), (i, j + n, i + n)]
    return _fix(trimesh.Trimesh(verts, np.array(faces)))


# ---------------- Mô hình gồm nhiều nhóm có màu ----------------
class Model:
    def __init__(self, name):
        self.name = name
        self.groups = {}  # tên → [màu, kim loại, độ nhám, [lưới]]

    def add(self, group, mesh, color, metal=0.05, rough=0.7):
        g = self.groups.setdefault(group, [color, metal, rough, []])
        g[3].append(mesh)
        return mesh

    def export(self, filename, scale=1.0, yaw=0.0, center=True, ground=True, origin=None):
        """Xoay Z-lên → Y-lên (x, y, z) → (x, z, −y), quay thêm `yaw` độ quanh Y để mặt trước nhìn −Z,
        nhân tỉ lệ, rồi đặt gốc: giữa đáy (center/ground) hoặc tại điểm `origin` (toạ độ FreeCAD)."""
        T = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], float)
        T = trimesh.transformations.rotation_matrix(math.radians(yaw), (0, 1, 0)) @ T
        T = np.diag([scale, scale, scale, 1]) @ T
        merged = {}
        for name, (color, metal, rough, meshes) in self.groups.items():
            m = trimesh.util.concatenate(meshes)
            m.apply_transform(T)
            mat = PBRMaterial(baseColorFactor=[int(c * 255) for c in color] + [255], metallicFactor=metal, roughnessFactor=rough)
            m.visual = trimesh.visual.TextureVisuals(material=mat)
            merged[name] = m
        allv = np.vstack([m.vertices for m in merged.values()])
        lo, hi = allv.min(0), allv.max(0)
        if origin is not None:
            shift = -(T @ np.array([*origin, 1.0]))[:3]
        else:
            shift = np.zeros(3)
            if center:
                shift[0], shift[2] = -(lo[0] + hi[0]) / 2, -(lo[2] + hi[2]) / 2
            if ground:
                shift[1] = -lo[1]
        scene = trimesh.Scene()
        for name, m in merged.items():
            m.apply_translation(shift)
            scene.add_geometry(m, node_name=name, geom_name=name)
        out = os.path.join(PUBLIC, filename)
        os.makedirs(PUBLIC, exist_ok=True)
        scene.export(out)
        lo, hi = scene.bounds
        tris = sum(len(m.faces) for m in merged.values())
        print(f'{filename:34s} {len(merged):2d} nhóm {tris:6d} tam giác  '
              f'{hi[0]-lo[0]:6.2f} × {hi[1]-lo[1]:6.2f} × {hi[2]-lo[2]:6.2f}  {os.path.getsize(out)/1024:5.0f} KB')
        return scene
