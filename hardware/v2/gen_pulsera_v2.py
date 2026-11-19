#!/usr/bin/env python3
"""
Pulsera Safe.Ride v2 - tipo pulsera deportiva, se imprime PLANA en TPU.

Genera tres STL:
  pulsera_v2.stl       correa ajustable + centro redondo bajo + cierre a presion + trabita
  tapa_v2.stl          tapa al ras con lugar para el QR (va arriba de la etiqueta NFC)
  prueba_centro.stl    solo el centro de la pulsera, para probar tamaño, encastre y lectura

Necesita la libreria manifold3d:  pip install manifold3d numpy
Todas las medidas en mm. Cambia los numeros de MEDIDAS y volve a correr el archivo.
"""
import math, struct, os
from manifold3d import Manifold, CrossSection, JoinType

# ---------------- MEDIDAS ----------------
MUNECA        = 165.0  # contorno de muñeca de referencia (agujero del medio)
AGUJEROS      = 7      # posiciones de ajuste
SEP_AGUJEROS  = 5.0    # 7 x 5 mm -> muñecas de 15 a 18 cm
CORREA_ANCHO  = 16.0
CORREA_ALTO   = 2.6    # espesor de la correa
REDONDEO      = 1.0    # redondeo de los bordes (arriba y abajo)

CENTRO_DIAM   = 35.0   # centro redondo
CENTRO_ALTO   = 4.4    # alto total del centro (bajito)
TRANSICION    = 18.0   # cuanto se estira la parte que se ensancha hacia el centro

ETIQUETA_DIAM = 30.0   # etiqueta NFC adhesiva
ETIQUETA_ALTO = 0.3
ALOJ_DIAM     = 31.2   # alojamiento: 0,6 mm libres alrededor de la etiqueta
TAPA_ALTO     = 1.2
TAPA_DIAM     = 31.0   # 0,1 mm de juego por lado: entra a presion, al ras
QR_LADO       = 20.4   # lugar del QR de 20 x 20 con su margen blanco
QR_PROF       = 0.3

AGUJERO_DIAM  = 3.2
PERNO_DIAM    = 3.0
CABEZA_DIAM   = 4.4    # la cabeza pasa estirando el TPU y queda trabada
CAPA          = 0.2    # el modelo se arma por capas, como lo imprime la impresora
SEG           = 96
# -----------------------------------------

T, H = CORREA_ALTO, CENTRO_ALTO
R = CENTRO_DIAM / 2
# Posiciones a lo largo de la correa (x). Punta A (perno) en x=0.
X_PERNO = 6.0
# distancia perno -> agujero del medio: contorno + lo que agrega el espesor al dar la vuelta
DIST = MUNECA + math.pi * T
X_MEDIO = X_PERNO + DIST
X_AGUJEROS = [X_MEDIO + (i - (AGUJEROS - 1) / 2) * SEP_AGUJEROS for i in range(AGUJEROS)]
LARGO = X_AGUJEROS[-1] + 22.0           # punta B: la cola llega hasta la trabita
X_CENTRO = X_PERNO + DIST / 2           # el centro queda del lado opuesto al cierre
X_TRABA = (X_PERNO + 8.0, X_PERNO + 14.0)


def redondeo(z, alto, r):
    """cuanto se mete el borde a la altura z para que el canto quede redondeado"""
    if z < r:
        d = r - z
    elif z > alto - r:
        d = z - (alto - r)
    else:
        return 0.0
    return r - math.sqrt(max(r * r - d * d, 0.0))


def plano_correa():
    w = CORREA_ANCHO
    cuerpo = CrossSection.square((LARGO - w, w), center=True).translate(((LARGO) / 2, 0))
    puntas = CrossSection.circle(w / 2, SEG).translate((w / 2, 0)) + \
        CrossSection.circle(w / 2, SEG).translate((LARGO - w / 2, 0))
    return cuerpo + puntas


def plano_centro(z):
    """el centro: circulo unido a la correa con un ensanche suave (hull)"""
    rb = redondeo(z, H, REDONDEO) if z < REDONDEO else 0.0
    if z <= T:
        largo, r = CENTRO_DIAM + 2 * TRANSICION, R
    else:
        f = (z - T) / (H - T)                      # 0 abajo, 1 arriba: rampa suave
        largo = CENTRO_DIAM + 2 * TRANSICION * (1 - f) ** 1.4
        r = R
    rt = redondeo(z, H, REDONDEO) if z > H - REDONDEO else 0.0
    r = r - rb - rt
    ancho = CORREA_ANCHO - 2 * (rb + rt)
    c = CrossSection.circle(r, SEG)
    rect = CrossSection.square((max(largo - 2 * (rb + rt), 0.1), ancho), center=True)
    return CrossSection.batch_hull([c, rect]).translate((X_CENTRO, 0))


def cuerpo():
    base = plano_correa()
    capas = []
    n = int(round(H / CAPA))
    for i in range(n):
        z0 = i * CAPA
        zc = z0 + CAPA / 2
        partes = plano_centro(zc)
        if zc < T:
            partes = partes + base.offset(-redondeo(zc, T, REDONDEO), JoinType.Round, circular_segments=SEG)
        capas.append(Manifold.extrude(partes, CAPA + (0.02 if i < n - 1 else 0)).translate((0, 0, z0)))
    return Manifold.batch_boolean(capas, __import__('manifold3d').OpType.Add)


def cilindro(r, h, x, y=0.0, z=0.0, r2=-1.0):
    return Manifold.cylinder(h, r, r2, SEG).translate((x, y, z))


def caja(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def pulsera():
    m = cuerpo()
    # alojamiento de la etiqueta NFC + tapa (abierto arriba)
    prof = ETIQUETA_ALTO + TAPA_ALTO
    m = m - cilindro(ALOJ_DIAM / 2, prof + 1, X_CENTRO, z=H - prof)
    # agujeros de ajuste
    for x in X_AGUJEROS:
        m = m - cilindro(AGUJERO_DIAM / 2, T + 2, x, z=-1)
    # perno a presion (sale para arriba en la punta A; la punta B se apoya encima)
    m = m + cilindro(PERNO_DIAM / 2, T + 0.05, X_PERNO, z=T - 0.05)
    m = m + cilindro(CABEZA_DIAM / 2, 0.5, X_PERNO, z=2 * T)
    m = m + cilindro(CABEZA_DIAM / 2, 0.8, X_PERNO, z=2 * T + 0.5, r2=PERNO_DIAM / 2 - 0.3)
    # trabita: sostiene la punta que sobra
    luz = T + 0.4
    techo = 1.4
    yi, ye = CORREA_ANCHO / 2 + 0.4, CORREA_ANCHO / 2 + 2.0
    x0, x1 = X_TRABA
    for s in (1, -1):
        lo, hi = sorted((s * (CORREA_ANCHO / 2 - 0.6), s * ye))
        m = m + caja(x0, x1, lo, hi, 0, T)                       # pegado a la correa
        lo, hi = sorted((s * yi, s * ye))
        m = m + caja(x0, x1, lo, hi, T - 0.1, T + luz + techo)   # paredes
    m = m + caja(x0, x1, -ye, ye, T + luz, T + luz + techo)      # techo
    return m


def tapa():
    m = cilindro(TAPA_DIAM / 2, TAPA_ALTO - 0.3, 0) + \
        cilindro(TAPA_DIAM / 2, 0.3, 0, z=TAPA_ALTO - 0.3, r2=TAPA_DIAM / 2 - 0.3)
    m = m - caja(-QR_LADO / 2, QR_LADO / 2, -QR_LADO / 2, QR_LADO / 2, TAPA_ALTO - QR_PROF, TAPA_ALTO + 1)
    return m


def guardar_stl(m, nombre):
    malla = m.to_mesh()
    v = malla.vert_properties
    t = malla.tri_verts
    with open(nombre, 'wb') as f:
        f.write(b'Safe.Ride'.ljust(80, b' '))
        f.write(struct.pack('<I', len(t)))
        for a, b, c in t:
            p1, p2, p3 = v[a][:3], v[b][:3], v[c][:3]
            u = [p2[i] - p1[i] for i in range(3)]
            w = [p3[i] - p1[i] for i in range(3)]
            n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
            L = math.sqrt(sum(x * x for x in n)) or 1.0
            f.write(struct.pack('<12fH', *(x / L for x in n), *p1, *p2, *p3, 0))


def info(m, nombre):
    (x0, y0, z0, x1, y1, z1) = m.bounding_box()
    print(f'{nombre:22s} {x1 - x0:6.1f} x {y1 - y0:5.1f} x {z1 - z0:4.1f} mm  '
          f'{m.volume() / 1000:5.2f} cm3  piezas:{len(m.decompose())}  huecos:{m.genus()}')


if __name__ == '__main__':
    aqui = os.path.dirname(os.path.abspath(__file__))
    p, t = pulsera(), tapa()
    prueba = p ^ caja(X_CENTRO - 30, X_CENTRO + 30, -20, 20, -1, 10)
    for m, n in ((p, 'pulsera_v2.stl'), (t, 'tapa_v2.stl'), (prueba, 'prueba_centro.stl')):
        guardar_stl(m, os.path.join(aqui, n))
        info(m, n)
    print(f'largo total {LARGO:.1f} mm · centro en x={X_CENTRO:.1f} · agujeros {X_AGUJEROS[0]:.1f}..{X_AGUJEROS[-1]:.1f}')
