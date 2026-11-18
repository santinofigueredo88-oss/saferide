// Guarda la ficha en el celular para que abra aunque no haya internet.
// Los datos de la persona no se guardan: vienen dentro del link del chip (después del #).
const CACHE = 'saferide-ficha-v1';
const ARCHIVOS = [
  './ficha.html',
  './pulsera-3d/visor.css?v=4',
  './pulsera-3d/tema.css?v=2',
  './pulsera-3d/tema.js?v=2',
  './pulsera-3d/red.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k.startsWith('saferide-ficha-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Solo se ocupa de los archivos de la ficha; el resto del sitio funciona como siempre.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const esFicha = url.pathname.endsWith('/ficha.html') || url.pathname.endsWith('/ficha');
  const esArchivo = ARCHIVOS.some(a => url.pathname.endsWith(a.slice(1).split('?')[0]));
  if (!esFicha && !esArchivo) return;

  // Primero intenta traer la versión nueva; si no hay internet, usa la guardada.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(esFicha ? './ficha.html' : e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(esFicha ? './ficha.html' : e.request)
        .then(r => r || caches.match(e.request, { ignoreSearch: true })))
  );
});
