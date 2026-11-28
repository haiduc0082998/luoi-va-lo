"""Dựng lại các macro FreeCAD trong models/source bằng cadlite rồi xuất GLB vào public/models.

Chạy:  pip install trimesh shapely mapbox_earcut
       python models/build_models.py          # tất cả
       python models/build_models.py car      # chỉ một mô hình (tower, man, woman, car, chernobyl, supercomplex)
Mô hình gần đúng để học tập và làm game, KHÔNG phải bản vẽ kỹ thuật.
"""
import math
import sys

import cadlite

from cadlite import Model, box, cylinder, ellipsoid, capsule, annulus, revolve, lathe, loft_rings, face_extrude


# ---------- Tháp làm mát đối lưu tự nhiên (Cooling_Tower_CAD.FCMacro) ----------
def cooling_tower():
    M = Model('cooling_tower')
    H, T = 150.0, 0.8
    profile = [(0.0, 59.0), (5.0, 54.0), (12.0, 48.0), (22.0, 41.0), (35.0, 34.5), (50.0, 29.0), (65.0, 25.5),
               (75.0, 24.0), (85.0, 24.5), (100.0, 26.5), (115.0, 29.5), (130.0, 33.0), (142.0, 36.0), (150.0, 38.0)]
    # Vỏ bê tông = loft ngoài trừ loft trong (dày 0,8 m), hở đáy và đỉnh
    loop = [(r, z) for z, r in profile] + [(r - T, z) for z, r in reversed(profile)]
    M.add('Hyperbolic_Concrete_Shell', revolve(loop, seg=64), (0.76, 0.78, 0.80))
    M.add('Base_Foundation_Ring', annulus(60.5, 57.5, 2.0, (0, 0, -2.0), seg=64), (0.52, 0.55, 0.58))
    for i in range(32):
        a = 2 * math.pi * i / 32
        x, y = 55.0 * math.cos(a), 55.0 * math.sin(a)
        M.add('Illustrative_Base_Piers', box(x - 0.6, y - 0.6, 0.0, 1.2, 1.2, 10.0), (0.62, 0.64, 0.66))
    M.add('Top_Rim', annulus(38.2, 37.0, 1.0, (0, 0, H - 1.0), seg=64), (0.70, 0.72, 0.74))
    M.add('Basin_Perimeter', annulus(62.0, 59.0, 1.0, (0, 0, -3.2), seg=64), (0.50, 0.58, 0.64))
    M.export('cooling-tower.glb', center=False, ground=False)  # gốc tại tâm đáy vỏ (z = 0)


# ---------- Người nộm nam (Male_Mannequin_CAD.FCMacro, mm) ----------
def man():
    cadlite.SEG = 7  # người đi bộ xuất hiện ~100 lần: dùng lưới thô
    M = Model('man')
    skin, shirt, pants, shoe = (0.78, 0.62, 0.48), (0.22, 0.34, 0.48), (0.18, 0.22, 0.28), (0.10, 0.12, 0.14)
    M.add('Head', ellipsoid((0, 0, 1660), (105, 95, 135)), skin)
    M.add('Neck', cylinder(58, 115, (0, 0, 1510)), skin)
    M.add('Shirt', ellipsoid((0, 0, 1370), (225, 125, 205)), shirt)
    M.add('Shirt', ellipsoid((0, 5, 1190), (165, 105, 190)), shirt)
    M.add('Pelvis', ellipsoid((0, 0, 1035), (190, 115, 115)), pants)
    for s in (-1, 1):
        M.add('Shirt', ellipsoid((s * 235, 0, 1450), (95, 100, 100)), shirt)
        sh, el, wr, he = (s * 255, 0, 1435), (s * 350, 0, 1195), (s * 405, 0, 970), (s * 415, -8, 865)
        M.add('Arms', capsule(sh, el, 72, 58), skin)
        M.add('Arms', ellipsoid(el, (58, 58, 58)), skin)
        M.add('Arms', capsule(el, wr, 58, 40), skin)
        M.add('Arms', ellipsoid(wr, (39, 42, 42)), skin)
        M.add('Arms', ellipsoid(he, (52, 35, 88)), skin)
        M.add('Arms', capsule((s * 438, -22, 900), (s * 475, -20, 855), 20, 17), skin)
        hip, knee, ankle = (s * 105, 0, 1000), (s * 112, 0, 565), (s * 115, 0, 125)
        M.add('Legs', capsule(hip, knee, 105, 75), pants)
        M.add('Legs', ellipsoid(knee, (78, 82, 75)), pants)
        M.add('Legs', capsule(knee, ankle, 72, 48), pants)
        M.add('Legs', ellipsoid(ankle, (48, 52, 50)), pants)
        M.add('Feet', ellipsoid((s * 115, -75, 65), (72, 150, 58)), shoe)
    M.export('man.glb', scale=0.001, yaw=180, keep=('Shirt',))  # mm → m; mặt nhìn −Y trong FreeCAD → −Z trong game


# ---------- Người nộm nữ (Female_Mannequin_CAD.FCMacro, mm) ----------
def woman():
    cadlite.SEG = 7
    M = Model('woman')
    # Macro gốc tô một màu da cho cả người; trong game thêm màu áo/váy để phân biệt người đi đường.
    skin, top, skirt, shoe = (0.82, 0.78, 0.72), (0.70, 0.22, 0.30), (0.20, 0.20, 0.32), (0.12, 0.10, 0.10)
    for s in (-1, 1):
        M.add('Feet', ellipsoid((s * 85, -45, 75), (48, 105, 35)), shoe)
        M.add('Legs', capsule((s * 85, 0, 115), (s * 82, 0, 470), 42), skin)
        M.add('Legs', ellipsoid((s * 82, 0, 475), (47, 48, 52)), skin)
        M.add('Skirt', capsule((s * 82, 0, 500), (s * 72, 0, 850), 58), skirt)
    M.add('Skirt', ellipsoid((0, 0, 875), (155, 92, 115)), skirt)
    M.add('Top', ellipsoid((0, 8, 1010), (112, 78, 105)), top)
    M.add('Top', ellipsoid((0, 8, 1110), (145, 92, 145)), top)
    M.add('Top', ellipsoid((0, 8, 1255), (190, 100, 145)), top)
    M.add('Top', ellipsoid((0, -2, 1285), (178, 92, 105)), top)
    M.add('Head', capsule((0, 5, 1350), (0, 5, 1430), 42), skin)
    M.add('Head', ellipsoid((0, -5, 1510), (92, 105, 125)), skin)
    M.add('Head', ellipsoid((0, -105, 1515), (22, 30, 38)), skin)
    for s in (-1, 1):
        M.add('Top', ellipsoid((s * 205, 5, 1285), (72, 72, 75)), top)
        M.add('Arms', capsule((s * 225, 5, 1275), (s * 305, 0, 1050), 42), skin)
        M.add('Arms', ellipsoid((s * 305, 0, 1050), (43, 43, 45)), skin)
        M.add('Arms', capsule((s * 305, 0, 1030), (s * 330, -5, 830), 34), skin)
        M.add('Arms', ellipsoid((s * 330, -5, 825), (31, 31, 32)), skin)
        M.add('Arms', ellipsoid((s * 335, -20, 755), (42, 30, 70)), skin)
    M.export('woman.glb', scale=0.001, yaw=180, keep=('Top',))


# ---------- Ô tô (Car_Model_FreeCAD.FCMacro, mét, đầu xe +X) ----------
def car():
    M = Model('car')
    paint = (0.72, 0.055, 0.045)
    rings = []
    for x, hw, tz in [(-2.25, 0.62, 0.72), (-1.95, 0.82, 1.00), (-1.45, 0.91, 1.17), (1.35, 0.91, 1.17), (1.85, 0.80, 1.00), (2.15, 0.65, 0.78)]:
        rings.append([(x, -hw, 0.55), (x, hw, 0.55), (x, hw * 0.92, 0.83), (x, hw * 0.78, tz), (x, -hw * 0.78, tz), (x, -hw * 0.92, 0.83)])
    M.add('Paint', loft_rings(rings), paint, metal=0.4, rough=0.35)
    dark = (0.22, 0.23, 0.25)
    M.add('Chassis', box(-2.05, -0.78, 0.48, 4.0, 1.56, 0.22), (0.16, 0.17, 0.19))
    M.add('Bumpers', box(1.92, -0.72, 0.53, 0.28, 1.44, 0.22), dark)
    M.add('Bumpers', box(-2.28, -0.72, 0.53, 0.25, 1.44, 0.22), dark)
    cab = [[(x, -w, zl), (x, w, zl), (x, w * 0.92, zh), (x, -w * 0.92, zh)]
           for x, w, zl, zh in [(-1.18, 0.66, 1.12, 1.17), (-0.72, 0.58, 1.30, 1.78), (0.25, 0.58, 1.30, 1.78), (0.92, 0.62, 1.12, 1.17)]]
    M.add('Paint', loft_rings(cab), (0.78, 0.10, 0.07), metal=0.4, rough=0.35)
    glass = (0.10, 0.20, 0.27)
    M.add('Glass', face_extrude([(0.91, -0.55, 1.20), (0.62, -0.52, 1.68), (0.62, 0.52, 1.68), (0.91, 0.55, 1.20)], (0.015, 0, 0)), glass, 0.3, 0.15)
    M.add('Glass', face_extrude([(-1.12, -0.55, 1.20), (-0.75, -0.51, 1.68), (-0.75, 0.51, 1.68), (-1.12, 0.55, 1.20)], (-0.015, 0, 0)), glass, 0.3, 0.15)
    for s in (-1, 1):
        y = s * 0.585
        for pane in ([(-1.02, y, 1.25), (-0.67, y, 1.67), (-0.18, y, 1.67), (-0.18, y, 1.25)],
                     [(-0.08, y, 1.25), (-0.08, y, 1.67), (0.50, y, 1.67), (0.82, y, 1.25)]):
            M.add('Glass', face_extrude(pane, (0, s * 0.018, 0)), glass, 0.3, 0.15)
    for ax in (-1.35, 1.35):
        for s in (-1, 1):
            y0 = s * 0.73
            M.add('Tires', cylinder(0.39, 0.24, (ax, y0 - 0.12, 0.62), (0, 1, 0)), (0.035, 0.038, 0.042), 0, 0.9)
            M.add('Rims', cylinder(0.235, 0.27, (ax, y0 - 0.135, 0.62), (0, 1, 0)), (0.62, 0.65, 0.68), 0.8, 0.3)
            M.add('Hubs', cylinder(0.085, 0.29, (ax, y0 - 0.145, 0.62), (0, 1, 0)), (0.20, 0.22, 0.24))
    for s in (-1, 1):
        M.add('Headlights', box(2.02, s * 0.38 - 0.16, 0.78, 0.12, 0.28, 0.11), (0.92, 0.91, 0.72))
        M.add('Taillights', box(-2.18, s * 0.40 - 0.13, 0.78, 0.08, 0.24, 0.12), (0.85, 0.025, 0.02))
        M.add('Trim', box(0.55, s * 0.82 if s > 0 else -0.94, 1.14, 0.10, 0.12, 0.05), (0.20, 0.20, 0.22))
        M.add('Paint', box(0.58, s * 0.91, 1.16, 0.18, 0.12, 0.10), paint)
        M.add('Trim', box(-0.05, s * 0.91, 0.98, 0.20, 0.035, 0.035), (0.72, 0.72, 0.72), 0.8, 0.3)
    M.add('Trim', box(2.16, -0.30, 0.62, 0.025, 0.60, 0.18), (0.045, 0.05, 0.06))
    M.add('Plates', box(2.19, -0.18, 0.56, 0.025, 0.36, 0.08), (0.85, 0.86, 0.84))
    M.add('Plates', box(-2.31, -0.18, 0.56, 0.025, 0.36, 0.08), (0.85, 0.86, 0.84))
    # Bỏ tấm "Ground reference" của macro: game có mặt đường riêng.
    M.export('car.glb', yaw=90, keep=('Paint',))  # đầu xe +X → −Z


# ---------- Nhà máy Chernobyl (hai macro low-poly) ----------
CONCRETE, ROOF, DARK, WATER, WHITE = (0.62, 0.63, 0.61), (0.35, 0.39, 0.42), (0.20, 0.23, 0.25), (0.25, 0.48, 0.62), (0.80, 0.82, 0.80)
SCORCH = (0.24, 0.22, 0.20)


def soviet_tower(cx, cy, height, radius, levels):
    return lathe([(height * f, radius * r) for f, r in levels], (cx, cy), seg=28)


def ruin(M, x, y, dx, dy, h):
    """Khối lò số 4 sau vụ nổ: tường vỡ cao thấp, mất mái, đống đổ nát bên trong (chỉ hiện khi lò nổ)."""
    t = 1.6
    M.add('Reactor4_Ruin', box(x, y, 0, t, dy, h), SCORCH)
    M.add('Reactor4_Ruin', box(x + dx - t, y, 0, t, dy, h * 0.62), SCORCH)
    for i, hk in enumerate((1.0, 0.75, 0.45, 0.3)):
        w = dx / 4
        M.add('Reactor4_Ruin', box(x + i * w, y, 0, w, t, h * hk), SCORCH)
    for i, hk in enumerate((0.85, 0.35, 0.65, 0.2)):
        w = dx / 4
        M.add('Reactor4_Ruin', box(x + i * w, y + dy - t, 0, w, t, h * hk), SCORCH)
    for i, (rx, ry, rh) in enumerate([(0.2, 0.3, 4), (0.5, 0.5, 6), (0.7, 0.35, 3), (0.4, 0.7, 5), (0.65, 0.7, 2.5)]):
        M.add('Reactor4_Ruin', box(x + dx * rx - 3, y + dy * ry - 3, 0, 6 + i, 5, rh), DARK)


def chernobyl():
    """Chernobyl_Power_Plant_PreAccident_LowPoly.FCMacro — bản nhẹ (đồ hoạ thấp)."""
    M = Model('chernobyl')
    M.add('Roads', box(-180, -15, 0, 360, 12, 0.25), DARK)
    M.add('Roads', box(-35, -120, 0, 12, 240, 0.25), DARK)
    M.add('Roads', box(-180, 42, 0, 360, 3, 0.2), (0.28, 0.28, 0.30))
    for i, (x, y) in enumerate([(-65, 12), (5, 12), (-65, 62), (5, 62)], 1):
        g = 'Reactor4' if i == 4 else 'Reactor_Blocks'
        M.add(g, box(x, y, 0, 48, 28, 17), CONCRETE)
        M.add(g, box(x - 1, y - 1, 17, 50, 30, 2), ROOF)
        M.add('Annexes', box(x + 8, y - 8, 0, 22, 8, 8), WHITE)
        M.add(g, box(x + 17, y + 8, 19, 10, 8, 3), DARK)
    ruin(M, 5, 62, 48, 28, 17)
    for yy in (-28, 94):
        M.add('Turbine_Halls', box(-70, yy, 0, 115, 22, 12), (0.70, 0.71, 0.68))
        M.add('Roofs', box(-70, yy, 12, 115, 22, 2), ROOF)
    lv = [(0.00, 1.00), (0.22, 0.82), (0.48, 0.68), (0.72, 0.75), (1.00, 0.88)]
    for cx, cy in [(105, 25), (135, 25)]:
        M.add('Cooling_Towers', soviet_tower(cx, cy, 34, 13, lv), WHITE)
        M.add('Concrete', cylinder(13.2, 1.0, (cx, cy, 0), seg=28), CONCRETE)
    M.add('Water', box(95, -55, -0.5, 72, 62, 0.5), WATER, 0.1, 0.2)
    M.add('Water', box(87, 4, 0, 12, 72, 0.35), WATER, 0.1, 0.2)
    M.add('Water', box(95, 4, 0, 58, 10, 0.35), WATER, 0.1, 0.2)
    M.add('Concrete', cylinder(4.2, 38, (-105, 15, 0)), CONCRETE)
    M.add('Annexes', cylinder(3.5, 30, (-117, 15, 0)), WHITE)
    M.add('Substation', box(75, 60, 0, 65, 42, 2), (0.72, 0.72, 0.65))
    for i in range(6):
        M.add('Transformers', box(80 + i * 9, 67, 2, 6, 8, 5), (0.76, 0.60, 0.30))
    for i in range(5):
        M.add('Dark', box(80 + i * 11, 82, 2, 8, 4, 7), DARK)
    M.add('Annexes', box(-125, -55, 0, 34, 20, 9), WHITE)
    M.add('Roofs', box(-126, -56, 9, 36, 22, 1.5), ROOF)
    M.add('Concrete', box(-125, -85, 0, 42, 18, 8), CONCRETE)
    M.add('Annexes', box(-80, -85, 0, 30, 18, 7), WHITE)
    M.add('Concrete', box(-25, -85, 0, 30, 18, 8), CONCRETE)
    M.add('Annexes', box(-160, -18, 0, 12, 10, 5), WHITE)
    for i in range(8):
        M.add('Vehicles', box(-118 + i * 10, -40, 0, 5, 2.4, 1.7), (0.32, 0.40, 0.52))
    for x in range(-170, 171, 20):
        M.add('Dark', box(x, 112, 0, 14, 0.35, 2.2), DARK)
        M.add('Dark', box(x, -105, 0, 14, 0.35, 2.2), DARK)
    for y in range(-100, 113, 20):
        M.add('Dark', box(-170, y, 0, 0.35, 14, 2.2), DARK)
        M.add('Dark', box(170, y, 0, 0.35, 14, 2.2), DARK)
    # Bỏ tấm "SiteGround": game có địa hình riêng. Gốc toạ độ đặt tại tâm khối lò số 4.
    M.export('chernobyl.glb', origin=(29, 76, 0), keep=('Reactor4', 'Reactor4_Ruin'))


def supercomplex():
    """Chernobyl_Supercomplex_Expanded_LowPoly.FCMacro — bản đầy đủ (đồ hoạ cao)."""
    M = Model('supercomplex')
    C = {'concrete': (0.65, 0.66, 0.63), 'roof': (0.36, 0.40, 0.43), 'dark': (0.18, 0.20, 0.22), 'water': (0.22, 0.43, 0.58),
         'white': (0.82, 0.83, 0.80), 'yellow': (0.72, 0.61, 0.34)}
    colors = {'Water_System': C['water'], 'Transformers': C['yellow'], 'Cooling_Towers': C['white'], 'Vehicles': (0.34, 0.40, 0.49),
              'Perimeter': C['dark'], 'Construction_Cranes': C['yellow'], 'Construction_Materials': (0.66, 0.50, 0.34),
              'Roads': C['dark'], 'Railway': (0.30, 0.28, 0.27), 'Roofs': C['roof']}

    def add(group, mesh):
        M.add(group, mesh, colors.get(group, C['concrete']), *((0.1, 0.2) if group == 'Water_System' else ()))

    def roofed(group, x, y, dx, dy, h):
        add(group, box(x, y, 0, dx, dy, h))
        add('Roofs', box(x - 0.8, y - 0.8, h, dx + 1.6, dy + 1.6, 1.5))

    for a in [(-240, -24, 0, 480, 12, 0.3), (-28, -170, 0, 12, 340, 0.3), (-240, 130, 0, 480, 8, 0.3), (145, -170, 0, 8, 340, 0.3)]:
        add('Roads', box(*a))
    for a in [(-240, 45, 0, 480, 3, 0.25), (-90, 45, 0, 3, 85, 0.25), (80, 45, 0, 3, 85, 0.25)]:
        add('Railway', box(*a))
    for i, (x, y) in enumerate([(-78, 5), (2, 5), (-78, 58), (2, 58)], 1):
        g = 'Reactor4' if i == 4 else 'Reactor_Buildings'
        add(g, box(x, y, 0, 52, 30, 18))
        add(g, box(x - 1, y - 1, 18, 54, 32, 2))
        add('Reactor_Annexes', box(x + 8, y - 9, 0, 26, 9, 9))
        add(g, box(x + 15, y + 9, 20, 12, 8, 3))
        add(g, box(x + 3, y + 23, 20, 7, 4, 2))
        for k in range(3):
            add(g, box(x + 30 + k * 5, y + 5, 20, 3, 4, 2))
    ruin(M, 2, 58, 52, 30, 18)
    roofed('Turbine_Halls', -83, -32, 122, 24, 13)
    roofed('Turbine_Halls', -83, 94, 122, 24, 13)
    for x in range(-72, 43, 15):
        add('Turbine_Halls', box(x, -26, 14, 8, 12, 1))
        add('Turbine_Halls', box(x, 100, 14, 8, 12, 1))
    lv = [(0, 1.0), (0.20, 0.84), (0.46, 0.69), (0.70, 0.75), (1.0, 0.88)]
    add('Cooling_Towers', soviet_tower(120, 22, 38, 15, lv))
    add('Cooling_Towers', soviet_tower(155, 22, 38, 15, lv))
    for a in [(90, -62, 0, 95, 78, 0.35), (84, 2, 0, 15, 88, 0.35), (98, 2, 0, 70, 12, 0.35), (108, -54, 0, 8, 58, 0.35), (160, -54, 0, 8, 58, 0.35)]:
        add('Water_System', box(*a))
    roofed('Pump_Station', 91, -84, 36, 20, 10)
    add('Pump_Station', box(91, -64, 0, 36, 7, 3))
    for x in (98, 108, 118):
        add('Pump_Station', cylinder(2.5, 14, (x, -74, 10)))
    add('Electrical_Yard', box(72, 65, 0, 95, 48, 2))
    for row in range(3):
        for c in range(7):
            x, y = 78 + c * 11, 70 + row * 13
            add('Transformers', box(x, y, 2, 6, 8, 5))
            add('Transformers', box(x + 1, y + 1, 7, 4, 6, 1))
    for x in range(75, 160, 14):
        add('Switchgear', box(x, 111, 2, 3, 2, 12))
        add('Switchgear', box(x, 113, 13, 3, 2, 1))
    for x in (85, 125, 165, 205):
        add('Power_Lines', box(x, 125, 0, 2, 2, 24))
        add('Power_Lines', box(x - 8, 125, 21, 18, 2, 1.5))
        add('Power_Lines', box(x - 11, 125, 23, 24, 2, 1))
    add('Stacks', cylinder(4.5, 42, (-112, 18, 0)))
    add('Stacks', cylinder(3.5, 32, (-125, 18, 0)))
    add('Stacks', cylinder(5.5, 2, (-112, 18, 42)))
    add('Stacks', cylinder(4.3, 2, (-125, 18, 32)))
    for a in [(95, 70, 0, 58, 38, 2), (98, 74, 0, 34, 25, 14), (98, 74, 14, 34, 25, 2), (136, 75, 0, 22, 28, 10)]:
        add('Construction_Zone', box(*a))
    for x, y in [(115, 68), (145, 68)]:
        add('Construction_Cranes', box(x, y, 0, 2, 2, 32))
        add('Construction_Cranes', box(x - 14, y, 30, 30, 2, 2))
        add('Construction_Cranes', box(x + 10, y, 20, 1, 1, 10))
    for i in range(6):
        add('Construction_Materials', box(96 + i * 7, 112, 0, 5, 5, 2))
        add('Construction_Materials', box(96 + i * 7, 112, 2, 5, 5, 2))
    for a in [(-142, -60, 36, 22, 10), (-142, -92, 44, 20, 8), (-92, -92, 32, 20, 8), (-42, -92, 38, 20, 9), (12, -92, 28, 18, 8),
              (48, -92, 24, 18, 7), (-145, 92, 32, 18, 8), (-104, 92, 28, 18, 8)]:
        roofed('Support_Buildings', *a)
    for a in [(-38, 122, 42, 16, 7), (12, 122, 35, 16, 7), (55, 122, 30, 16, 7)]:
        roofed('Auxiliary_Buildings', *a)
    add('Auxiliary_Buildings', cylinder(3, 8, (-22, 130, 0)))
    add('Auxiliary_Buildings', cylinder(3, 8, (-12, 130, 0)))
    for i in range(12):
        x, y = -138 + (i % 6) * 9, -43 + (i // 6) * 6
        add('Vehicles', box(x, y, 0, 5.5, 2.5, 1.8))
        add('Vehicles', box(x + 1, y + 0.3, 1.8, 3, 1.9, 1))
    for x, y, r, h in [(-160, 15, 5, 10), (-148, 15, 4, 8), (-160, 32, 4, 8), (60, -55, 5, 9)]:
        add('Utility_Tanks', cylinder(r, h, (x, y, 0)))
        add('Utility_Tanks', cylinder(r, 1, (x, y, h)))
    add('Pipe_Racks', box(-95, -38, 13, 190, 3, 2))
    for x in range(-90, 96, 18):
        add('Pipe_Racks', box(x, -39, 0, 2, 5, 13))
    add('Pipe_Racks', box(20, 26, 18, 3, 70, 2))
    add('Pipe_Racks', box(21, 26, 0, 2, 3, 18))
    for x in range(0, 440, 20):  # macro viết -220 + x với x từ -220 → hàng rào lệch tới -440; sửa lại cho khép kín
        add('Perimeter', box(-220 + x, -145, 0, 14, 0.4, 2.5))
        add('Perimeter', box(-220 + x, 145, 0, 14, 0.4, 2.5))
    for y in range(-140, 146, 20):
        add('Perimeter', box(-220, y, 0, 0.4, 14, 2.5))
        add('Perimeter', box(220, y, 0, 0.4, 14, 2.5))
    roofed('Gate', -220, -20, 12, 12, 5)
    roofed('Gate', 208, -20, 12, 12, 5)
    for i in range(5):
        roofed('Nearby_Buildings', -205 + i * 18, -75, 14, 12, 5)
        roofed('Nearby_Buildings', -205 + i * 18, -95, 14, 12, 5)
    M.export('chernobyl-supercomplex.glb', origin=(28, 73, 0), keep=('Reactor4', 'Reactor4_Ruin'))


ALL = {'tower': cooling_tower, 'man': man, 'woman': woman, 'car': car, 'chernobyl': chernobyl, 'supercomplex': supercomplex}

if __name__ == '__main__':
    for k in (sys.argv[1:] or ALL):
        ALL[k]()
