// Conexión de Safe.Ride con Firebase (base de datos de fichas + inicio con Google).
// Esta configuración es pública: la seguridad la ponen las reglas de firestore.rules.
const VERSION = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;

export const config = {
  apiKey: 'AIzaSyAbE2WCEEp2ckpHkNXA-9JyRBXdC2-Rv3w',
  authDomain: 'saferide-fichas.firebaseapp.com',
  projectId: 'saferide-fichas',
  storageBucket: 'saferide-fichas.firebasestorage.app',
  messagingSenderId: '860678902363',
  appId: '1:860678902363:web:89d7eb644a132d2cfde57e',
};

// Datos de la ficha: letra corta → nombre para mostrar.
export const CAMPOS = ['g', 'a', 'c', 'm', 'cn', 'ct', 'o', 'l', 'd'];
// Lo esencial viaja también dentro del link, para verlo sin internet.
export const ESENCIALES = ['n', 'g', 'a', 'cn', 'ct'];

let cargado;
export function cargarFirebase() {
  if (!cargado) {
    cargado = Promise.all([
      import(`${BASE}/firebase-app.js`),
      import(`${BASE}/firebase-firestore.js`),
    ]).then(([app, fs]) => {
      const aplicacion = app.getApps()[0] || app.initializeApp(config);
      return { aplicacion, fs, db: fs.getFirestore(aplicacion) };
    });
    cargado.catch(() => { cargado = null; });
  }
  return cargado;
}

export async function cargarAuth() {
  const { aplicacion } = await cargarFirebase();
  const auth = await import(`${BASE}/firebase-auth.js`);
  return { auth, sesion: auth.getAuth(aplicacion) };
}

// Trae una ficha por su código. Si tarda mucho (sin internet), corta.
export async function leerFicha(id, msMaximo = 7000) {
  const tarea = cargarFirebase().then(({ fs, db }) => fs.getDoc(fs.doc(db, 'fichas', id)));
  const corte = new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), msMaximo));
  const doc = await Promise.race([tarea, corte]);
  return doc.exists() ? doc.data() : null;
}

// Código de la ficha: 10 letras y números sin los que se confunden (0/O, 1/l/I).
export function nuevoCodigo() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  const azar = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(azar, b => letras[b % letras.length]).join('');
}

// Link fijo de la ficha: el código no cambia nunca; después del # va lo esencial.
export function linkDeFicha(id, datos) {
  const base = new URL('./ficha.html', location.href);
  base.search = `?id=${id}`;
  base.hash = '';
  const p = new URLSearchParams();
  for (const k of ESENCIALES) {
    const v = k === 'n' ? datos.nombre : datos[k];
    if (v) p.set(k, v);
  }
  return `${base.href}#${p.toString()}`;
}
