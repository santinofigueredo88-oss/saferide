#!/usr/bin/env python3
"""
Pulsera Saferide - modelo tipo malla deportiva (estilo smartband) para Tinkercad.
- Correa curva de seccion redondeada (comoda, sin bordes).
- Modulo central bajo y ovalado con hueco embutido para el QR.
- Se imprime entera en TPU flexible.
Todo en mm. Solo stdlib.

En Tinkercad despues agregas:
  * agujeros de ajuste en la cola (cilindros hueco Ø2.6 cada 4 mm)
  * hebilla / pasador en la otra punta
  * bolsillo del chip NFC por debajo del modulo (cilindro hueco Ø27 x 2.5)
"""
import math

# ---------------- PARAMETROS ----------------
WRIST_CIRC   = 165.0   # circunferencia de muñeca (mm). niño ~135-150, adulto ~160-185
EXTRA_R      = 7.0     # cuanto mas "abierta"/plana que la muñeca (mm de radio)
WRAP_DEG     = 205.0   # cuanto abraza la muñeca (mas = mas cerrada)
STRAP_W      = 17.0    # ancho de la correa
STRAP_T      = 3.0     # espesor de la correa
EDGE_R       = 1.3     # redondeo de los cantos de la correa
MOD_L        = 34.0    # largo del modulo (a lo ancho de la muñeca)
MOD_W        = 21.0    # ancho del modulo (a lo largo de la correa)
MOD_H        = 2.6     # cuanto sobresale el modulo
MOD_R        = 8.0     # redondeo de las esquinas del modulo
QR_SIDE      = 16.0    # lado del hueco cuadrado del QR
QR_DEPTH     = 0.7     # profundidad del hueco del QR
SEG_MAJOR    = 140     # resolucion a lo largo de la correa
CS_SEG       = 7       # resolucion por tramo de la seccion
CORNER_SEG   = 6       # resolucion de esquina del modulo
OUT          = "pulsera_saferide.stl"
# -------------------------------------------

Rc = WRIST_CIRC / (2 * math.pi) + EXTRA_R     # radio de la linea central de la correa
tris = []

def _n(ux, uy, uz, vx, vy, vz):
    nx, ny, nz = uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx
    L = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
    return (nx/L, ny/L, nz/L)

def tri(p1, p2, p3):
    tris.append((_n(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2],
                    p3[0]-p1[0], p3[1]-p1[1], p3[2]-p1[2]), p1, p2, p3))

def quad(p1, p2, p3, p4):
    tri(p1, p2, p3); tri(p1, p3, p4)

# ---- seccion de la correa: rectangulo con cantos redondeados (u = a lo ancho, v = radial) ----
def strap_section():
    hw, ht, r = STRAP_W/2.0, STRAP_T/2.0, EDGE_R
    pts = []
    # esquinas: centro y angulo de arranque (CCW)
    for (cx, cv, a0) in [( hw-r,  ht-r, 0.0),
                         (-(hw-r), ht-r, math.pi/2),
                         (-(hw-r), -(ht-r), math.pi),
                         ( hw-r, -(ht-r), 3*math.pi/2)]:
        for k in range(CS_SEG + 1):
            a = a0 + (math.pi/2) * k / CS_SEG
            pts.append((cx + r*math.cos(a), cv + r*math.sin(a)))
    return pts

SEC = strap_section()
NS = len(SEC)

# ---- barrer la seccion a lo largo de un arco (eje muñeca = X) ----
th0 = math.radians(-WRAP_DEG/2.0)
th1 = math.radians( WRAP_DEG/2.0)

def sweep_pt(theta, u, v):
    rad = (0.0, math.sin(theta), math.cos(theta))
    cy, cz = Rc*math.sin(theta), Rc*math.cos(theta)
    return (u, cy + v*rad[1], cz + v*rad[2])

rings = []
for i in range(SEG_MAJOR + 1):
    t = th0 + (th1 - th0) * i / SEG_MAJOR
    rings.append([sweep_pt(t, u, v) for (u, v) in SEC])

for i in range(SEG_MAJOR):
    for j in range(NS):
        j2 = (j + 1) % NS
        quad(rings[i][j], rings[i][j2], rings[i+1][j2], rings[i+1][j])

# tapas de las dos puntas
for (ring, theta, flip) in ((rings[0], th0, True), (rings[-1], th1, False)):
    c = (0.0, Rc*math.sin(theta), Rc*math.cos(theta))
    for j in range(NS):
        j2 = (j + 1) % NS
        tri(c, ring[j2], ring[j]) if flip else tri(c, ring[j], ring[j2])

# ---------- MODULO central (rounded-rect bajo, con hueco de QR) ----------
# apoyado en la cara exterior de la correa, en theta = 0  -> (0, 0, Rc + ht)
ht = STRAP_T/2.0
z0 = Rc + ht - 0.8                 # embebido en la correa
z_top = Rc + ht + MOD_H
z_qr  = z_top - QR_DEPTH
mx = MOD_L/2.0 - MOD_R
my = MOD_W/2.0 - MOD_R

def mod_poly(inset):
    r = max(0.4, MOD_R - inset)
    sx, sy = mx - inset*0.0, my - inset*0.0
    # (inset solo achica el radio -> bisela la tapa)
    pts = []
    for (cx, cy, a0) in [( sx,  sy, 0.0), (-sx,  sy, math.pi/2),
                         (-sx, -sy, math.pi), ( sx, -sy, 3*math.pi/2)]:
        for k in range(CORNER_SEG + 1):
            a = a0 + (math.pi/2) * k / CORNER_SEG
            pts.append((cx + r*math.cos(a), cy + r*math.sin(a)))
    return pts

p_base = mod_poly(0.0)
p_edge = mod_poly(0.0)
p_face = mod_poly(1.1)            # tapa un poco mas chica -> canto superior redondeado
NM = len(p_base)
z_sh = z_top - 1.1               # hombro antes del bisel

# pared vertical del modulo
for i in range(NM):
    i2 = (i + 1) % NM
    quad((p_base[i][0], p_base[i][1], z0),
         (p_base[i2][0], p_base[i2][1], z0),
         (p_edge[i2][0], p_edge[i2][1], z_sh),
         (p_edge[i][0], p_edge[i][1], z_sh))
# bisel superior
for i in range(NM):
    i2 = (i + 1) % NM
    quad((p_edge[i][0], p_edge[i][1], z_sh),
         (p_edge[i2][0], p_edge[i2][1], z_sh),
         (p_face[i2][0], p_face[i2][1], z_top),
         (p_face[i][0], p_face[i][1], z_top))
# base del modulo (fan hacia abajo)
cb = (0.0, 0.0, z0)
for i in range(NM):
    i2 = (i + 1) % NM
    tri(cb, (p_base[i2][0], p_base[i2][1], z0), (p_base[i][0], p_base[i][1], z0))

# cara superior del modulo con hueco cuadrado embutido para el QR
h = QR_SIDE/2.0
qr = [(h, h), (-h, h), (-h, -h), (h, -h)]           # borde del hueco (z_top)
qb = [(h, h, z_qr), (-h, h, z_qr), (-h, -h, z_qr), (h, -h, z_qr)]  # fondo del hueco

# anillo entre el borde exterior de la tapa y el borde del hueco:
# cada vertice de la tapa se asocia a la esquina del cuadrado QR mas cercana (0..3)
def nearest_qr_corner(px, py):
    best, bd = 0, 1e9
    for k, (fx, fy) in enumerate(qr):
        d = (fx-px)**2 + (fy-py)**2
        if d < bd: bd, best = d, k
    return best

for i in range(NM):
    i2 = (i + 1) % NM
    a = (p_face[i][0], p_face[i][1], z_top)
    b = (p_face[i2][0], p_face[i2][1], z_top)
    ka = nearest_qr_corner(*p_face[i]); kb = nearest_qr_corner(*p_face[i2])
    qa = (qr[ka][0], qr[ka][1], z_top)
    qbb = (qr[kb][0], qr[kb][1], z_top)
    tri(a, b, qbb)
    if ka != kb:
        tri(a, qbb, qa)

# paredes del hueco del QR
for i in range(4):
    i2 = (i + 1) % 4
    quad((qr[i][0], qr[i][1], z_top), (qr[i2][0], qr[i2][1], z_top),
         qb[i2], qb[i])
# fondo del hueco del QR
tri(qb[0], qb[2], qb[1]); tri(qb[0], qb[3], qb[2])

# ---------- escribir STL ASCII ----------
with open(OUT, "w") as f:
    f.write("solid pulsera_saferide\n")
    for (nrm, p1, p2, p3) in tris:
        f.write(f"  facet normal {nrm[0]:.5f} {nrm[1]:.5f} {nrm[2]:.5f}\n    outer loop\n")
        for p in (p1, p2, p3):
            f.write(f"      vertex {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}\n")
        f.write("    endloop\n  endfacet\n")
    f.write("endsolid pulsera_saferide\n")

print(f"OK -> {OUT}  ({len(tris)} triangulos)")
print(f"Correa: linea central r={Rc:.1f} mm, seccion {STRAP_W}x{STRAP_T} mm, abraza {WRAP_DEG}°")
print(f"Modulo: {MOD_L}x{MOD_W}x{MOD_H} mm | hueco QR {QR_SIDE}x{QR_SIDE}x{QR_DEPTH} mm")
