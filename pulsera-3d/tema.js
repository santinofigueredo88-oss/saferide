// El visor, el simulador y la portada comparten la misma preferencia.
(() => {
  const clave = 'saferide-theme';
  const sistema = matchMedia('(prefers-color-scheme: dark)');
  const raiz = document.documentElement;
  let elegido = null;
  function leer() {
    try { elegido = localStorage.getItem(clave); } catch { /* Se conserva la elección en esta página. */ }
  }
  function aplicar() {
    const oscuro = elegido === 'dark' || (elegido !== 'light' && sistema.matches);
    raiz.dataset.theme = oscuro ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = oscuro ? '#0d140f' : '#edf5ef';
    const boton = document.querySelector('[data-tema]');
    if (!boton) return;
    boton.hidden = false;
    // El botón dice a qué modo se pasa, no en cuál se está.
    const texto = oscuro ? 'Modo claro' : 'Modo oscuro';
    boton.removeAttribute('aria-pressed');
    boton.dataset.modo = oscuro ? 'oscuro' : 'claro';
    boton.setAttribute('aria-label', texto);
    boton.title = oscuro ? 'Cambiar al modo claro' : 'Cambiar al modo oscuro';
    const etiqueta = boton.querySelector('span');
    if (etiqueta) etiqueta.textContent = texto;
  }
  leer(); aplicar(); // Antes del primer dibujo, aun al abrir directamente la maqueta.
  document.addEventListener('DOMContentLoaded', () => {
    aplicar();
    document.querySelector('[data-tema]').addEventListener('click', () => {
      elegido = raiz.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(clave, elegido); } catch { /* Almacenamiento no disponible. */ }
      aplicar();
    });
  });
  sistema.addEventListener('change', aplicar);
  window.addEventListener('pageshow', () => { leer(); aplicar(); });
  window.addEventListener('storage', e => { if (e.key === clave || e.key === null) { leer(); aplicar(); } });
})();
