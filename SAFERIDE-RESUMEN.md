# Saferide — Resumen del Proyecto

## Descripción
Saferide es una pulsera QR y medalla NFC con datos médicos de emergencia.
Landing page profesional con modo claro/oscuro, bilingüe (ES/EN), y animaciones.

## Creadores
- **Santino Figueredo**
- **Elena Avogadro**
- Escuela Secundaria Técnica N.º 1 «Vuelta de Obligado», Baradero

## URLs
- **GitHub**: https://github.com/santinofigueredo88-oss/saferide
- **GitHub Pages**: https://santinofigueredo88-oss.github.io/saferide/
- **Maqueta interactiva**: https://santinofigueredo88-oss.github.io/saferide/maqueta.html

## Estructura
- `index.html` — Archivo único con HTML, CSS y JS inline
- `maqueta.html` — Página de la pulsera con visor 3D y demo NFC animada. Abrila directamente en Chrome o Edge, o entrá desde **Explorar la pulsera en 3D y probar NFC** en la sección de demostración de la web.
- `demo-lectura.html` — Simulador de lectura QR y NFC. Se abre desde el enlace al pie del visor.

### Demostración para la feria

El **Recorrido de la feria**, arriba de la página, guía la presentación en tres pasos: ver la pulsera, destacar el chip en el despiece y simular su lectura sin internet.

1. Arrastrá para girar la pulsera. Acercá con la rueda, con dos dedos o con **+**. Los botones **Frente** e **Interior** cambian el ángulo.
2. Tocá **Desarmar** para separar las seis piezas y usá **Separación** para acercarlas o alejarlas entre sí. Elegí una etiqueta, una pieza del modelo o un componente en la ficha técnica para leer qué función cumple. Usá **Pantalla completa** para proyectar el visor en la feria.
3. En el despiece, seleccioná **Chip y antena NFC** para ver la pieza cuadrada debajo del QR. Tocá **Probar la lectura del chip** para simular el acercamiento de un celular y ver el grupo sanguíneo, las alergias y el contacto de emergencia sin internet. Para comparar con la ficha web está el simulador QR y NFC al pie de la página.

Las dos páginas se pueden abrir sin conexión. El visor incluye un modelo conceptual basado en el diseño de `hardware/`; no sustituye el archivo CAD para impresión.

Para regenerar el visor después de editar `pulsera-3d/visor.mjs`: ejecutá `npm ci` y `npm run build:visor`. El archivo `pulsera-3d/visor.bundle.js` empaqueta Three.js para poder abrir la maqueta sin servidor local ni conexión.

## Funcionalidades implementadas
- Navbar glassmorphism con auto-hide al scrollear
- Hero con logo profesional, badge, trust indicators, QR flotante
- Partículas flotantes en toda la página (canvas)
- Scroll progress bar (barra de progreso fija)
- Contadores animados en estadísticas
- Secciones: Problema, Cómo funciona, Formatos, Quiénes lo usan, Beneficios, Historia, Futuro/Proyecto, Estadísticas, Comparativa, Precios, Demo, Pedido, FAQ, CTA, Footer
- Formulario de pedido con layout 2 columnas
- Modal de prototype (creación de ficha)
- Modo oscuro/claro con toggle
- Bilingüe ES/EN con toggle
- FAQ accordion
- Animaciones: parallax, scroll reveal escalonado, hover effects con barras de gradiente, ripple en botones
- Partículas adaptativas (colores diferentes para modo claro vs oscuro)

## Variables CSS importantes
- `--green-deep: #234b36`
- `--green-accent: #2e7d32`
- `--surface-page: #f8faf9` (claro) / `#10190f` (oscuro)
- `--container-width: 1200px`
- `--nav-height: 76px`

## Producto y precio
- Un solo producto físico: **Pulsera Saferide** con código QR + chip NFC
  integrado en la misma pieza (si no se puede escanear el QR, se lee por NFC).
- Precio: **$4.000** (envío a todo el país + actualización de datos ilimitada).
- Ya no hay medalla NFC suelta ni "pack".

## Notas para continuar
- El precio ($4.000) es de ejemplo
- El formulario de pedido no tiene backend (es demo)
- Las traducciones ES/EN están en el objeto `translations` en el JS
- Para push se necesita token con Contents: Read and Write en el repo saferide
