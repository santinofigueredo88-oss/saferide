# Saferide — Tecnologías usadas

La página es **un solo archivo `index.html`**: sin frameworks, sin librerías
externas y sin herramientas de compilación (no hay npm, ni bundlers, ni
preprocesadores). Todo el HTML, el CSS y el JavaScript están dentro de ese archivo.

## Lenguajes base

| Tecnología | Para qué se usa |
|---|---|
| **HTML5** | Estructura semántica (`<header>`, `<main>`, `<section>`, `<footer>`) y accesibilidad: atributos ARIA (`aria-labelledby`, `aria-expanded`, `role`), textos alternativos, navegación por teclado. |
| **CSS3** (embebido en `<style>`) | Todo el diseño visual y el responsive. |
| **JavaScript** (vanilla, ES6+) | Toda la interactividad. **No usa ninguna librería** (nada de jQuery, React, Vue, Bootstrap, etc.). |

## CSS — técnicas y características

- **Variables CSS / custom properties** (`--green-deep`, `--surface-page`, …) para el
  sistema de temas y colores.
- **Modo claro / oscuro**: `@media (prefers-color-scheme)` + selección manual con el
  atributo `data-theme` en `<html>`, guardada en el navegador.
- **Flexbox** y **CSS Grid** para todos los layouts.
- **`clamp()`** para tipografía y espaciados fluidos (se adaptan al ancho de pantalla).
- **`backdrop-filter`** → efecto vidrio esmerilado (glassmorphism) en tarjetas y navbar.
- **`@keyframes`** y **`transition`** para las animaciones.
- **`@media` queries** → diseño responsive (escritorio / tablet / celular).
- **`@media (prefers-reduced-motion)`** → desactiva animaciones para quien lo pide.
- Degradados, `mix-blend-mode`, `text-wrap: balance`, `scroll-margin`.

## JavaScript — APIs del navegador utilizadas

- **`IntersectionObserver`** → animaciones de aparición al hacer scroll, contadores
  animados de estadísticas y resaltado del enlace activo en el menú.
- **`<canvas>` (contexto 2D)** → las partículas flotantes / "constelación" del fondo.
- **`localStorage`** → recuerda el tema y el idioma elegidos.
- **`matchMedia`** → detecta modo oscuro, `reduced-motion` y tipo de puntero (mouse/touch).
- **`MutationObserver`** → reacciona a los cambios de tema.
- **`requestAnimationFrame`** → animaciones y manejo eficiente del scroll.
- **Sistema propio de internacionalización (ES / EN)**: un objeto `translations` en el
  JS + atributos `data-i18n` en el HTML.
- Generación de un **código QR** dibujado sobre un `<canvas>` (para la vista de demo).
- **Validación de formularios** nativa del navegador (`checkValidity`, `reportValidity`)
  y descarga de un comprobante en texto con **`Blob`**.

## Recursos

- **Íconos**: SVG en línea, con un *sprite* (`<symbol>` + `<use>`). No se usa ninguna
  librería de íconos externa.
- **Tipografías**: declaradas *Poppins* / *Inter* con *fallback* a las fuentes del
  sistema (`system-ui`). **No se descargan fuentes externas**, así la página carga
  más rápido y funciona sin conexión.
- **Imágenes**: no hay archivos de imagen; todo lo visual es CSS y SVG.

## Infraestructura

| | |
|---|---|
| **Control de versiones** | Git + GitHub |
| **Hosting** | GitHub Pages (sitio estático, HTTPS) |
| **Repositorio** | https://github.com/santinofigueredo88-oss/saferide |
| **Sitio publicado** | https://santinofigueredo88-oss.github.io/saferide/ |

## Modelo 3D de la pulsera (carpeta `hardware/`)

- **OpenSCAD** — modelo paramétrico (`pulsera_saferide.scad`).
- **Python** (biblioteca estándar) — genera el `.stl` sin instalar nada.
- El `.stl` se puede editar en Tinkercad, SelfCAD, Onshape, etc. e imprimir en
  **TPU flexible**.

---
*Proyecto escolar — Santino Figueredo y Elena Avogadro — Escuela Secundaria Técnica
N.º 1 «Vuelta de Obligado», Baradero.*
