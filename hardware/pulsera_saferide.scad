/* ============================================================
   PULSERA SAFERIDE  -  modelo parametrico
   ------------------------------------------------------------
   Se abre con OPENSCAD (gratis, ~40 MB):  https://openscad.org
     - F5  = vista previa
     - F6  = render final
     - Archivo > Exportar > Exportar como STL   (para imprimir)
   Cambia los numeros de "MEDIDAS" y el modelo se rehace solo.
   Trae: correa curva comoda, modulo bajo integrado, hueco del QR,
         bolsillo del chip NFC y agujeros de ajuste en una punta.
   Imprimir entera en TPU flexible.
   ============================================================ */

// ---------------- MEDIDAS (cambia aca) ----------------
wrist_circ      = 165;   // circunferencia de la muñeca en mm (niño ~135-150, adulto ~160-185)
holgura         = 5;     // aire entre la pulsera y la muñeca (radio)
abrazo          = 300;   // grados que abraza (300 = casi cerrada, como una smartband)

correa_ancho    = 16;    // ancho de la correa
correa_espesor  = 3;     // espesor de la correa
correa_redondeo = 1.3;   // redondeo de los cantos (comodidad)

mod_ancho       = 19;    // modulo: medida a lo ancho de la muñeca
mod_largo       = 27;    // modulo: medida a lo largo de la correa
mod_alto        = 3;     // cuanto sobresale el modulo
mod_redondeo    = 6;     // redondeo de las esquinas del modulo

qr_lado         = 14;    // hueco cuadrado para el QR (min util ~13)
qr_prof         = 0.8;   // profundidad del hueco del QR

nfc_diam        = 14;    // bolsillo para el chip NFC (tag chico Ø12-15).
nfc_prof        = 1.6;   // Para un disco NTAG de 25 mm: subi mod_ancho a >= 30 y pone nfc_diam = 27.

agujeros_n      = 7;     // agujeros de ajuste en una punta
agujero_diam    = 2.6;
agujero_sep     = 4;     // separacion entre agujeros (mm sobre la correa)

$fn = 90;
// -----------------------------------------------------
// CIERRE: la otra punta queda lisa. Opciones para agregar en OpenSCAD o en la
// impresion: (a) hebilla tipo reloj;  (b) 2 pernos Ø3 (tallo) / Ø4.5 (cabeza)
// que entran a presion en los agujeros, estilo Xiaomi Mi Band (mejor para TPU).

PI_ = 3.1415926536;
R    = wrist_circ / (2 * PI_) + holgura;   // radio a la linea central de la correa
Rext = R + correa_espesor / 2;             // radio de la cara exterior
ang_paso = agujero_sep / R * 180 / PI_;    // separacion de agujeros, en grados

// perfil 2D de la correa (rectangulo con cantos redondeados), centrado en x = R
module perfil_correa() {
    w = correa_espesor;
    h = correa_ancho;
    r = min(correa_redondeo, w/2 - 0.05, h/2 - 0.05);
    translate([R - w/2, -h/2])
        offset(r = r) offset(delta = -r) square([w, h]);
}

module correa() {
    rotate([0, 0, -abrazo/2])
        rotate_extrude(angle = abrazo)
            perfil_correa();
}

// modulo: caja baja de esquinas redondeadas, apoyada en la cara exterior (angulo 0 = eje +X)
module modulo() {
    translate([Rext - 0.6, 0, 0])
        rotate([0, 90, 0])
            linear_extrude(height = mod_alto + 0.6)
                offset(r = mod_redondeo) offset(delta = -mod_redondeo)
                    square([mod_ancho, mod_largo], center = true);
}

// un agujero radial que atraviesa la correa, en el angulo phi (grados)
module agujero(phi) {
    rotate([0, 0, phi])
        translate([R, 0, 0])
            rotate([0, 90, 0])
                cylinder(h = correa_espesor * 4, d = agujero_diam, center = true);
}

// ---------------- ARMADO ----------------
difference() {
    union() {
        correa();
        modulo();
    }

    // hueco del QR: desde la cara de arriba del modulo hacia adentro
    translate([Rext + mod_alto - qr_prof, 0, 0])
        rotate([0, 90, 0])
            linear_extrude(qr_prof + 3)
                square([qr_lado, qr_lado], center = true);

    // bolsillo del chip NFC: desde la cara interna de la correa hacia afuera
    translate([R - correa_espesor/2 - 0.01, 0, 0])
        rotate([0, 90, 0])
            cylinder(h = nfc_prof, d = nfc_diam);

    // agujeros de ajuste, agrupados cerca de la punta +abrazo/2
    for (i = [0 : agujeros_n - 1])
        agujero(abrazo/2 - 7 - i * ang_paso);
}
