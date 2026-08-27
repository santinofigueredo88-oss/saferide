# Pulsera Saferide — modelo 3D

Base para diseñar la pulsera en **Tinkercad** (o cualquier programa 3D / impresora).

| Archivo | Qué es |
|---|---|
| `pulsera_saferide.stl` | Modelo listo para importar (aro en C + alojamiento). |
| `gen_pulsera.py` | Script que genera el STL. Cambiás medidas y lo volvés a correr. |

![vista del modelo](preview.png)

## Medidas del modelo actual

- Circunferencia de muñeca: **165 mm** (adulto promedio). Radio del aro ≈ 26,3 mm.
- Aro: **16 mm de ancho × 3,2 mm de espesor**, sección **elíptica** (sin bordes filosos → cómodo contra la piel).
- Abertura del aro: **65°** en la parte de abajo — entra a presión y es fácil de poner y sacar. Se imprime en material **flexible (TPU)**.
- Alojamiento arriba: **30 × 25 × 8,5 mm**, esquinas verticales redondeadas (r5) y borde superior biselado. Cara de arriba **plana** para el QR.

## Cómo usarlo en Tinkercad

1. Entrá a tinkercad.com → **Crear → Diseño 3D**.
2. Botón **Importar** (arriba a la derecha) → subí `pulsera_saferide.stl`.
   - Si te dice que es muy grande, en "Escala" dejá 100 % y "Unidades" en **mm**.
3. Va a aparecer la pulsera. Ya tiene la forma cómoda hecha; ahora le agregás los huecos:

### a) Hueco para el chip NFC (por abajo del alojamiento)

- Traé un **Cilindro** y ponelo en modo **Hueco** (agujero).
- Diámetro **27 mm**, alto **2,5 mm** (para un disco NFC NTAG213/215 de 25 mm). Si usás una "moneda" NFC de 12 mm, poné diámetro **13 mm**.
- Centralo con el alojamiento y subilo para que quede **desde la cara de abajo hacia adentro**, dejando **≥ 1,2 mm** de pared arriba del hueco.
- Seleccionás alojamiento + cilindro → **Agrupar**. Queda el bolsillo.
- El chip se pega adentro y se tapa con un disco fino impreso aparte o con resina/silicona.

### b) Recuadro para el QR (en la cara de arriba)

- Opción simple: **Caja** en modo Hueco, **24 × 24 × 0,6 mm**, centrada en la cara superior, hundida 0,6 mm. Ahí pegás una etiqueta impresa con el QR (min. 20 × 20 mm para que escanee bien).
- Opción grabada: en vez del hueco, usá **Texto/forma** del QR como Hueco de 0,4 mm de profundidad y después pintás el bajorrelieve.

### c) (Opcional) Versión con correa ajustable en vez de aro en C

- Borrá el aro y hacé una **tira recta** de 16 × 2,5 mm, largo ≈ circunferencia + 40 mm.
- En una punta: fila de **7 agujeros Ø3 mm** cada 4 mm.
- En la otra punta: un **pin/T** que entra en los agujeros (o una hebilla tipo reloj).
- Así sirve para muñecas de distinto tamaño (bueno para chicos que crecen).

## Impresión — TPU (todo el modelo)

Se imprime **entero en filamento TPU** (flexible), así el aro entra a presión y el
alojamiento no molesta contra la muñeca.

- **TPU 95A** (si tenés 85A, aún más blando: bajá `GAP_DEG` a ~55 para que agarre mejor).
- Altura de capa **0,15–0,20 mm**, **3 perímetros**, relleno **20–25 %** giroide.
- Velocidad **20–30 mm/s**, retracción baja (0,8–1,5 mm), sin (o poca) refrigeración.
- Orientación: alojamiento con la **cara plana hacia abajo** en la cama; el aro apoyado
  de costado. Con esa orientación casi no necesita soportes.
- Pared mínima en cualquier lado: **1,2 mm** (3 líneas de 0,4 mm).
- El disco que tapa el bolsillo del NFC: imprimilo también en TPU, 0,8–1 mm, y pegalo
  con adhesivo de contacto o soldadura con soldador fino.

## Cambiar el tamaño / la forma

Editá los parámetros arriba de `gen_pulsera.py` y corré:

```bash
python3 gen_pulsera.py
```

Genera un `pulsera_saferide.stl` nuevo. Parámetros útiles:

| Parámetro | Para qué |
|---|---|
| `WRIST_CIRC` | circunferencia de muñeca (niño ~135–150, adulto ~160–185) |
| `GAP_DEG` | qué tan abierto es el aro (más grande = entra más fácil, agarra menos) |
| `BAND_WIDTH` / `BAND_THICK` | ancho y espesor del aro (más fino = más cómodo, menos resistente) |
| `HOUSING_*` | tamaño del alojamiento del QR/NFC |
