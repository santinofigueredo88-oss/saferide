# Safe.Ride — Resumen del Proyecto

## Descripción
Safe.Ride es una pulsera con código QR y chip NFC con datos médicos de emergencia, pensada para todo público
(cualquier persona que pueda tener un accidente). Slogan: «Tu información, a tiempo.»
Landing page profesional con modo claro/oscuro, bilingüe (ES/EN), y animaciones.

## Creadores
- **Santino Figueredo**
- **Elena Avogadro**
- Escuela Secundaria Técnica N.º 1 «Vuelta de Obligado», Baradero

## URLs
- **GitHub**: https://github.com/santinofigueredo88-oss/saferide
- **GitHub Pages**: https://santinofigueredo88-oss.github.io/saferide/

## Estructura
- `index.html` — Archivo único con HTML, CSS y JS inline

## Funcionalidades implementadas
- Navbar glassmorphism con auto-hide al scrollear
- Hero con logo profesional, badge, trust indicators, QR flotante
- Partículas flotantes en toda la página (canvas)
- Scroll progress bar (barra de progreso fija)
- Contadores animados en estadísticas
- Secciones: Problema, Cómo funciona, Formatos, Privacidad, Tu cuenta (activación con PIN), Quiénes lo usan, Beneficios, Historia, Futuro/Proyecto, Estadísticas, Comparativa, Precio, Demo, Pedido, FAQ, CTA, Footer
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
- Un solo producto físico: **Pulsera Safe.Ride** con código QR + chip NFC
  integrado en la misma pieza (si no se puede escanear el QR, se lee por NFC).
  Los dos abren la misma ficha online: el celular que escanea necesita internet.
- Precio: **$8.000** (igual que en el informe; actualización de datos ilimitada incluida).
- Entrega: Baradero y zona norte de Buenos Aires (alcance del proyecto).
- Datos de la ficha: nombre, fecha de nacimiento, grupo sanguíneo, condiciones, alergias,
  medicación, obra social, localidad, contacto de emergencia y última actualización.
  **No se piden DNI ni domicilio** (minimización de datos, Ley 25.326). Hay consentimiento obligatorio.

## Notas para continuar
- Todo el contenido está coordinado con el informe del proyecto (precio, NFC, datos, público, estadísticas)
- El formulario de pedido no tiene backend (es demo)
- Las traducciones ES/EN están en el objeto `translations` en el JS
- Para push se necesita token con Contents: Read and Write en el repo saferide
