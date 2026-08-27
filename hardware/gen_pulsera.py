#!/usr/bin/env python3
"""
Genera un STL de la pulsera Saferide para importar en Tinkercad.
- Aro en C con seccion eliptica (sin bordes filosos = comodo).
- Alojamiento (housing) tipo pastilla con esquinas verticales redondeadas
  y borde superior biselado; cara superior plana para el QR.
Todo en milimetros. Sin dependencias (solo stdlib).
"""
import math

# ---------------- PARAMETROS (cambiá acá) ----------------
WRIST_CIRC   = 165.0   # circunferencia de muñeca en mm (adulto ~160-180, niño ~135-150)
GAP_DEG      = 65.0    # abertura del aro en C (para que entre a presion, TPU flexible)
BAND_WIDTH   = 16.0    # ancho del aro (X)
BAND_THICK   = 3.2     # espesor del aro (radial)
HOUSING_X    = 30.0    # largo del alojamiento (a lo ancho de la muñeca)
HOUSING_Y    = 25.0    # largo del alojamiento (a lo largo del brazo)
HOUSING_H    = 8.5     # alto del alojamiento sobre el aro
HOUSING_R    = 5.0     # radio de las esquinas verticales del alojamiento
TOP_BEVEL    = 1.6     # bisel del borde superior (comodidad)
SEG_MAJOR    = 140     # resolucion a lo largo del aro
SEG_MINOR    = 28      # resolucion de la seccion eliptica
CORNER_SEG   = 6       # resolucion de cada esquina redondeada del housing
OUT          = "pulsera_saferide.stl"
# --------------------------------------------------------

R = WRIST_CIRC / (2 * math.pi)      # radio medio del aro
a = BAND_WIDTH / 2.0                # semieje en X
b = BAND_THICK / 2.0                # semieje radial

tris = []

def n(ax, ay, az, bx, by, bz):
    # normal por producto cruz, normalizada
    nx = ay*bz - az*by
    ny = az*bx - ax*bz
    nz = ax*by - ay*bx
    L = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
    return (nx/L, ny/L, nz/L)

def tri(p1, p2, p3):
    ux, uy, uz = p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]
    vx, vy, vz = p3[0]-p1[0], p3[1]-p1[1], p3[2]-p1[2]
    tris.append((n(ux,uy,uz,vx,vy,vz), p1, p2, p3))

def quad(p1, p2, p3, p4):
    tri(p1, p2, p3)
    tri(p1, p3, p4)

# ---------- ARO EN C (torus eliptico, eje = X) ----------
theta0 = math.radians(-(180.0 - GAP_DEG/2.0))
theta1 = math.radians( (180.0 - GAP_DEG/2.0))

def band_pt(theta, psi):
    rad = (0.0, math.sin(theta), math.cos(theta))          # direccion radial
    cx, cy, cz = 0.0, R*math.sin(theta), R*math.cos(theta)  # centro de seccion
    off = b * math.sin(psi)
    x = a * math.cos(psi)
    y = cy + off*rad[1]
    z = cz + off*rad[2]
    return (x, y, z)

rings = []
for i in range(SEG_MAJOR + 1):
    t = theta0 + (theta1 - theta0) * i / SEG_MAJOR
    ring = [band_pt(t, 2*math.pi*j/SEG_MINOR) for j in range(SEG_MINOR)]
    rings.append(ring)

for i in range(SEG_MAJOR):
    for j in range(SEG_MINOR):
        j2 = (j + 1) % SEG_MINOR
        quad(rings[i][j], rings[i][j2], rings[i+1][j2], rings[i+1][j])

# tapas de los dos extremos del C (fan al centro de la elipse)
for (ring, theta, flip) in ((rings[0], theta0, True), (rings[-1], theta1, False)):
    c = (0.0, R*math.sin(theta), R*math.cos(theta))
    for j in range(SEG_MINOR):
        j2 = (j + 1) % SEG_MINOR
        if flip:
            tri(c, ring[j2], ring[j])
        else:
            tri(c, ring[j], ring[j2])

# ---------- ALOJAMIENTO (rounded-rect extrudido, con bisel arriba) ----------
# apoyado sobre la parte de arriba del aro (theta = 0 -> punto (0,0,R+b))
z_base = R + b - 0.6            # un poco embebido en el aro para que quede unido
z_top  = R + b + HOUSING_H
hx = HOUSING_X/2.0 - HOUSING_R
hy = HOUSING_Y/2.0 - HOUSING_R

def rrect(scale):
    """poligono rounded-rect (CCW visto desde +Z), 'scale' encoge para el bisel."""
    rx = HOUSING_R - (1.0 - scale) * TOP_BEVEL
    sx = hx - (1.0 - scale) * TOP_BEVEL
    sy = hy - (1.0 - scale) * TOP_BEVEL
    pts = []
    corners = [( sx,  sy, 0.0), (-sx,  sy, math.pi/2),
               (-sx, -sy, math.pi), ( sx, -sy, 3*math.pi/2)]
    for (ccx, ccy, base_ang) in corners:
        for k in range(CORNER_SEG + 1):
            ang = base_ang + (math.pi/2) * k / CORNER_SEG
            pts.append((ccx + rx*math.cos(ang), ccy + rx*math.sin(ang)))
    return pts

poly_bot = rrect(1.0)
poly_topedge = rrect(1.0)          # borde superior antes del bisel
poly_topface = rrect(0.55)         # cara superior (mas chica -> bisel)
Np = len(poly_bot)

# pared vertical (de z_base hasta z_top - TOP_BEVEL)
z_shoulder = z_top - TOP_BEVEL
for i in range(Np):
    i2 = (i + 1) % Np
    p1 = (poly_bot[i][0],  poly_bot[i][1],  z_base)
    p2 = (poly_bot[i2][0], poly_bot[i2][1], z_base)
    p3 = (poly_topedge[i2][0], poly_topedge[i2][1], z_shoulder)
    p4 = (poly_topedge[i][0],  poly_topedge[i][1],  z_shoulder)
    quad(p1, p2, p3, p4)

# bisel superior
for i in range(Np):
    i2 = (i + 1) % Np
    p1 = (poly_topedge[i][0],  poly_topedge[i][1],  z_shoulder)
    p2 = (poly_topedge[i2][0], poly_topedge[i2][1], z_shoulder)
    p3 = (poly_topface[i2][0], poly_topface[i2][1], z_top)
    p4 = (poly_topface[i][0],  poly_topface[i][1],  z_top)
    quad(p1, p2, p3, p4)

# cara superior (fan) y base (fan)
ctop = (0.0, 0.0, z_top)
cbot = (0.0, 0.0, z_base)
for i in range(Np):
    i2 = (i + 1) % Np
    tri(ctop, (poly_topface[i][0], poly_topface[i][1], z_top),
              (poly_topface[i2][0], poly_topface[i2][1], z_top))
    tri(cbot, (poly_bot[i2][0], poly_bot[i2][1], z_base),
              (poly_bot[i][0], poly_bot[i][1], z_base))

# ---------- escribir STL ASCII ----------
with open(OUT, "w") as f:
    f.write("solid pulsera_saferide\n")
    for (nrm, p1, p2, p3) in tris:
        f.write(f"  facet normal {nrm[0]:.5f} {nrm[1]:.5f} {nrm[2]:.5f}\n")
        f.write("    outer loop\n")
        for p in (p1, p2, p3):
            f.write(f"      vertex {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n")
        f.write("    endloop\n  endfacet\n")
    f.write("endsolid pulsera_saferide\n")

print(f"OK -> {OUT}  ({len(tris)} triangulos)")
print(f"Radio del aro: {R:.1f} mm | seccion {BAND_WIDTH}x{BAND_THICK} mm")
print(f"Housing: {HOUSING_X}x{HOUSING_Y}x{HOUSING_H} mm, esquinas r{HOUSING_R}")
