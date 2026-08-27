#!/usr/bin/env python3
"""
Pulsera Saferide - modelo tipo malla deportiva (smartband), estilo la foto de
referencia: correa continua y fina, con un modulo ovalado BAJO que sube suave
desde la correa (sin escalon) y lleva el QR grabado arriba. Boton chico al lado.
Se imprime entera en TPU flexible. Todo en mm, solo stdlib.

En Tinkercad despues agregas:
  * agujeros de ajuste en una punta (cilindros hueco Ø2.6 cada 4 mm)
  * hebilla / pernos a presion en la otra punta
  * bolsillo del chip NFC por debajo del modulo (cilindro hueco Ø27 x 2)
"""
import math

# ---------------- PARAMETROS ----------------
WRIST_CIRC   = 165.0   # circunferencia de muñeca (mm). niño ~135-150, adulto ~160-185
EXTRA_R      = 5.0     # holgura de radio respecto de la muñeca
WRAP_DEG     = 300.0   # cuanto abraza (300 = casi cerrada, como la foto)
STRAP_W      = 16.0    # ancho de la correa
STRAP_T      = 3.0     # espesor de la correa
EDGE_R       = 1.35    # redondeo de los cantos de la correa (seccion tipo "D")
END_TAPER    = 0.78    # cuanto se afina la correa hacia las puntas (1 = nada)

MOD_L        = 19.0    # ancho del modulo (a lo ancho de la muñeca) ~ igual que la correa
MOD_W        = 27.0    # largo del modulo (a lo largo de la correa, elongado)
MOD_H        = 3.0     # altura del modulo sobre la correa
MOD_EMBED    = 0.3     # cuanto se hunde el modulo en la correa
PLATEAU      = 0.58    # fraccion del modulo que queda plana arriba (resto: rampa suave)
QR_SIDE      = 13.0    # lado del hueco cuadrado del QR
QR_DEPTH     = 0.6     # profundidad del hueco del QR

BTN_D        = 5.0     # diametro del botoncito al lado del modulo
BTN_H        = 0.9     # cuanto sobresale
BTN_OFFSET   = 8.0     # separacion del borde del modulo (a lo largo de la correa)

SEG_MAJOR    = 90      # resolucion a lo largo de la correa
CS_SEG       = 5       # resolucion por tramo de la seccion de la correa
MOD_GRID     = 30      # resolucion de la grilla del modulo
OUT          = "pulsera_saferide.stl"
# -------------------------------------------

Rc   = WRIST_CIRC / (2*math.pi) + EXTRA_R    # radio de la linea central de la correa
Rout = Rc + STRAP_T/2.0                       # radio de la cara exterior
tris = []

def _n(ux, uy, uz, vx, vy, vz):
    nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    L = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
    return (nx/L, ny/L, nz/L)

def tri(p1, p2, p3):
    tris.append((_n(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2],
                    p3[0]-p1[0], p3[1]-p1[1], p3[2]-p1[2]), p1, p2, p3))

def quad(p1, p2, p3, p4):
    tri(p1, p2, p3); tri(p1, p3, p4)

def smoothstep(e0, e1, x):
    if x <= e0: return 0.0
    if x >= e1: return 1.0
    t = (x - e0) / (e1 - e0)
    return t*t*t*(t*(t*6 - 15) + 10)

# ============ CORREA ============
th0 = math.radians(-WRAP_DEG/2.0)
th1 = math.radians( WRAP_DEG/2.0)

def strap_section(scale):
    """rectangulo con cantos redondeados; scale afina el ancho hacia las puntas."""
    hw = (STRAP_W/2.0) * scale
    ht = STRAP_T/2.0
    r  = min(EDGE_R, hw*0.9, ht*0.9)
    pts = []
    for (cx, cv, a0) in [( hw-r, ht-r, 0.0), (-(hw-r), ht-r, math.pi/2),
                         (-(hw-r), -(ht-r), math.pi), ( hw-r, -(ht-r), 3*math.pi/2)]:
        for k in range(CS_SEG+1):
            a = a0 + (math.pi/2)*k/CS_SEG
            pts.append((cx + r*math.cos(a), cv + r*math.sin(a)))
    return pts

NS = len(strap_section(1.0))

def sweep(theta, u, v):
    s, c = math.sin(theta), math.cos(theta)
    return (u, Rc*s + v*s, Rc*c + v*c)

rings = []
for i in range(SEG_MAJOR+1):
    f = i/SEG_MAJOR
    t = th0 + (th1-th0)*f
    # afinado suave hacia las dos puntas
    edge = min(f, 1-f) * 2.0
    sc = END_TAPER + (1-END_TAPER)*smoothstep(0.0, 0.18, edge)
    sec = strap_section(sc)
    rings.append([sweep(t, u, v) for (u, v) in sec])

for i in range(SEG_MAJOR):
    for j in range(NS):
        j2 = (j+1) % NS
        quad(rings[i][j], rings[i][j2], rings[i+1][j2], rings[i+1][j])

# tapas redondeadas en las puntas
for (ring, theta, outward) in ((rings[0], th0, -1), (rings[-1], th1, 1)):
    s, c = math.sin(theta), math.cos(theta)
    tang = (0.0, math.cos(theta)*outward, -math.sin(theta)*outward)  # a lo largo de la correa
    cen = (0.0, Rc*s, Rc*c)
    apex = (cen[0] + tang[0]*STRAP_T*0.5,
            cen[1] + tang[1]*STRAP_T*0.5,
            cen[2] + tang[2]*STRAP_T*0.5)
    for j in range(NS):
        j2 = (j+1) % NS
        if outward < 0:
            tri(apex, ring[j], ring[j2])
        else:
            tri(apex, ring[j2], ring[j])

# ============ MODULO (domo suave con meseta + hueco QR) ============
A = MOD_L/2.0
B = MOD_W/2.0

def mod_height(nx, ns):
    """altura (0..MOD_H) en coords normalizadas del modulo. Tapers a 0 en el borde."""
    r = math.sqrt((nx)**2 + (ns)**2)
    if r >= 1.0:
        return 0.0
    # meseta plana en el centro, rampa suave hasta el borde
    ramp = 1.0 - smoothstep(PLATEAU, 1.0, r)    # 1 en el centro -> 0 en r=1
    return MOD_H * ramp

def mod_point(nx, ns):
    x = nx * A
    s = ns * B                                   # distancia a lo largo de la correa
    theta = s / Rout
    st, ct = math.sin(theta), math.cos(theta)
    h = mod_height(nx, ns)
    base = Rout - MOD_EMBED                             # embebido un poco en la correa
    rr = base + h
    return (x, rr*st, rr*ct)

# grilla del modulo (top). Recorta al ovalo.
G = MOD_GRID
grid = [[None]*(G+1) for _ in range(G+1)]
for iy in range(G+1):
    for ix in range(G+1):
        nx = -1 + 2*ix/G
        ns = -1 + 2*iy/G
        if nx*nx + ns*ns <= 1.0001:
            grid[iy][ix] = mod_point(nx, ns)

qh = QR_SIDE/2.0
def in_qr(nx, ns):
    return abs(nx*A) <= qh and abs(ns*B) <= qh

for iy in range(G):
    for ix in range(G):
        p = [grid[iy][ix], grid[iy][ix+1], grid[iy+1][ix+1], grid[iy+1][ix]]
        if any(v is None for v in p):
            continue
        nxs = [(-1+2*ix/G, -1+2*iy/G), (-1+2*(ix+1)/G, -1+2*iy/G),
               (-1+2*(ix+1)/G, -1+2*(iy+1)/G), (-1+2*ix/G, -1+2*(iy+1)/G)]
        if all(in_qr(a, b) for (a, b) in nxs):
            continue  # esa celda es el fondo del hueco, se hace aparte
        quad(*p)

# base plana del modulo (para cerrar el solido; se solapa con la correa, Tinkercad lo une)
base_z = Rout - MOD_EMBED
rimpts = []
NR = 96
for k in range(NR):
    a = 2*math.pi*k/NR
    nx, ns = math.cos(a), math.sin(a)
    x = nx*A
    s = ns*B
    theta = s / Rout
    rimpts.append((x, base_z*math.sin(theta), base_z*math.cos(theta)))
cbase = (0.0, base_z*math.sin(0), base_z*math.cos(0))
for k in range(NR):
    k2 = (k+1) % NR
    tri(cbase, rimpts[k2], rimpts[k])
# pared del rim (altura ~0, solo cierra)
for k in range(NR):
    k2 = (k+1) % NR
    a = 2*math.pi*k/NR
    a2 = 2*math.pi*k2/NR
    top1 = mod_point(math.cos(a), math.sin(a))
    top2 = mod_point(math.cos(a2), math.sin(a2))
    quad(rimpts[k], rimpts[k2], top2, top1)

# ---- hueco del QR (cuadrado embutido en la meseta) ----
qz_top = Rout - MOD_EMBED + MOD_H
qz_bot = qz_top - QR_DEPTH
def qpt(x, y, rr):
    theta = y / Rout
    return (x, rr*math.sin(theta), rr*math.cos(theta))
qtl = [( qh,  qh), (-qh,  qh), (-qh, -qh), ( qh, -qh)]
for i in range(4):
    i2 = (i+1) % 4
    a = qpt(qtl[i][0],  qtl[i][1],  qz_top)
    b = qpt(qtl[i2][0], qtl[i2][1], qz_top)
    c = qpt(qtl[i2][0], qtl[i2][1], qz_bot)
    d = qpt(qtl[i][0],  qtl[i][1],  qz_bot)
    quad(a, b, c, d)
b0 = qpt(qtl[0][0], qtl[0][1], qz_bot); b1 = qpt(qtl[1][0], qtl[1][1], qz_bot)
b2 = qpt(qtl[2][0], qtl[2][1], qz_bot); b3 = qpt(qtl[3][0], qtl[3][1], qz_bot)
tri(b0, b2, b1); tri(b0, b3, b2)

# ============ BOTONCITO al lado del modulo ============
btn_s = B + BTN_OFFSET
btn_theta = btn_s / Rout
bz0 = Rout - 0.4
bz1 = Rout + BTN_H
NB = 28
prev = None
for k in range(NB+1):
    a = 2*math.pi*k/NB
    x = (BTN_D/2.0)*math.cos(a)
    dl = (BTN_D/2.0)*math.sin(a)
    th = btn_theta + dl/Rout
    o = (x, bz0*math.sin(th), bz0*math.cos(th))
    t = (x, bz1*math.sin(th), bz1*math.cos(th))
    if prev:
        quad(prev[0], o, t, prev[1])
    prev = (o, t)
# tapa del boton
ctop = (0.0, bz1*math.sin(btn_theta), bz1*math.cos(btn_theta))
prev = None
for k in range(NB+1):
    a = 2*math.pi*k/NB
    x = (BTN_D/2.0)*math.cos(a)
    dl = (BTN_D/2.0)*math.sin(a)
    th = btn_theta + dl/Rout
    t = (x, bz1*math.sin(th), bz1*math.cos(th))
    if prev:
        tri(ctop, prev, t)
    prev = t

# ============ ORIENTAR PARA TINKERCAD / IMPRESION ============
# El modelo se construyo con el eje de la muñeca en X y el aro en el plano YZ.
# Para Tinkercad conviene: aro apoyado (eje muñeca = Z, vertical) y todo por
# encima del plano de trabajo (Z >= 0).
_allz = [c for t in tris for p in t[1:] for c in (p[2],)]
def _xf(p):
    x, y, z = p          # x = ancho muñeca, (y,z) = circulo del aro
    return (y, z, x)      # nuevo: (aro_x, aro_y, alto=ancho muñeca)
# aplicar y luego subir para apoyar en Z=0
_tmp = [(nrm, _xf(p1), _xf(p2), _xf(p3)) for (nrm, p1, p2, p3) in tris]
_minz = min(c for t in _tmp for p in t[1:] for c in (p[2],))
def _up(p): return (p[0], p[1], p[2] - _minz)
tris = [(nrm, _up(p1), _up(p2), _up(p3)) for (nrm, p1, p2, p3) in _tmp]

# ============ ESCRIBIR STL (binario, chico y rapido de importar) ============
import struct
with open(OUT, "wb") as f:
    f.write(b"Saferide bracelet - generado con gen_pulsera.py".ljust(80, b" "))
    f.write(struct.pack("<I", len(tris)))
    for (_nrm, p1, p2, p3) in tris:
        f.write(struct.pack("<3f", 0.0, 0.0, 0.0))
        for p in (p1, p2, p3):
            f.write(struct.pack("<3f", p[0], p[1], p[2]))
        f.write(struct.pack("<H", 0))

print(f"OK -> {OUT}  ({len(tris)} triangulos)")
print(f"Correa: r central {Rc:.1f} mm | seccion {STRAP_W}x{STRAP_T} | abraza {WRAP_DEG}°")
print(f"Modulo: {MOD_L}x{MOD_W}x{MOD_H} mm, sube suave | hueco QR {QR_SIDE}x{QR_SIDE}x{QR_DEPTH}")
