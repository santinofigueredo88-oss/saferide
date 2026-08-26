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

## Estructura
- `index.html` — Archivo único con HTML, CSS y JS inline

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

## Notas para continuar
- Los precios son de ejemplo ($0, $2.500, $4.000)
- El formulario de pedido no tiene backend (es demo)
- Las traducciones ES/EN están en el objeto `translations` en el JS
- Para push se necesita token con Contents: Read and Write en el repo saferide
