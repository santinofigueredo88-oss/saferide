// Solo se almacena la plantilla pública, sin el identificador ni los datos del enlace.
const CACHE = 'saferide-ficha-v9';
const FICHA = new URL('ficha.html', self.registration.scope).href;
const ARCHIVOS = [
  FICHA,
  ...['visor.css?v=4', 'tema.css?v=3', 'tema.js?v=2', 'red.svg']
    .map(nombre => new URL('pulsera-3d/' + nombre, self.registration.scope).href),
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ARCHIVOS.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const anteriores = (await caches.keys()).filter(k => k.startsWith('saferide-ficha-') && k !== CACHE);
    await Promise.all(anteriores.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const esFicha = req.mode === 'navigate' && /^\/ficha(?:\.html)?\.*(?:%23.*)?\/?$/i.test(url.pathname);
  const recurso = esFicha ? FICHA : ARCHIVOS.find(archivo => new URL(archivo).pathname === url.pathname);
  if (!recurso) return;
  // Safari puede usar la plantilla inmediatamente, incluso si la red tarda en fallar.
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const copia = await cache.match(recurso);
    return copia || fetch(req);
  })());
});
