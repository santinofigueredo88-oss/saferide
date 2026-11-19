// Panel del equipo: ver los pedidos, imprimir el QR, grabar el chip y marcar el avance.
import { cargarFirebase, cargarAuth, linkDeFicha, fichaVieja, fechaDeFicha } from './fichas.mjs?v=2';

const EQUIPO = ['santinofigueredo88@gmail.com'];
const ESTADOS = { nuevo: 'NUEVO', grabado: 'GRABADO', enviado: 'ENVIADO', cancelado: 'CANCELADO' };
const SIGUIENTE = { nuevo: ['grabado', 'Marcar como grabada'], grabado: ['enviado', 'Marcar como enviada'] };
const PRECIO = 8000;

const $ = id => document.getElementById(id);
const { fs, db } = await cargarFirebase();
const { auth, sesion } = await cargarAuth();
let pedidos = [];
let fichas = [];
let filtro = 'pendientes';
let filtroFichas = 'sin';
const hayNFC = 'NDEFReader' in window;

$('entrar').addEventListener('click', async () => {
  $('estado-entrar').textContent = 'ABRIENDO GOOGLE…';
  const proveedor = new auth.GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try { await auth.signInWithPopup(sesion, proveedor); $('estado-entrar').textContent = ''; }
  catch (e) {
    if (e.code === 'auth/popup-blocked') return auth.signInWithRedirect(sesion, proveedor);
    $('estado-entrar').textContent = e.code === 'auth/popup-closed-by-user' ? '' : 'NO SE PUDO ENTRAR.';
  }
});
$('salir').addEventListener('click', () => auth.signOut(sesion));

auth.onAuthStateChanged(sesion, async u => {
  $('v-panel').hidden = true;
  $('v-fichas').hidden = true;
  $('v-entrar').hidden = false;
  if (!u) return;
  if (!EQUIPO.includes(u.email)) {
    $('estado-entrar').textContent = `LA CUENTA ${u.email.toUpperCase()} NO ES DEL EQUIPO.`;
    await auth.signOut(sesion);
    return;
  }
  $('quien').textContent = u.email;
  $('v-entrar').hidden = true;
  $('v-panel').hidden = false;
  $('v-fichas').hidden = false;
  await cargar();
});

for (const b of document.querySelectorAll('[data-f]')) {
  b.addEventListener('click', () => {
    filtro = b.dataset.f;
    for (const o of document.querySelectorAll('[data-f]')) o.setAttribute('aria-pressed', String(o === b));
    pintar();
  });
}

async function cargar() {
  const res = await fs.getDocs(fs.collection(db, 'pedidos'));
  pedidos = res.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.creado?.seconds || 0) - (a.creado?.seconds || 0));
  // Cada pedido necesita los datos de su ficha para armar el link del chip.
  await Promise.all(pedidos.map(async p => {
    const f = await fs.getDoc(fs.doc(db, 'fichas', p.fichaId));
    p.ficha = f.exists() ? f.data() : null;
  }));
  pintar();
  await cargarFichas();
}

// ---------- Fichas: todas, con o sin pedido ----------
for (const b of document.querySelectorAll('[data-ff]')) {
  b.addEventListener('click', () => {
    filtroFichas = b.dataset.ff;
    for (const o of document.querySelectorAll('[data-ff]')) o.setAttribute('aria-pressed', String(o === b));
    pintarFichas();
  });
}
$('buscar').addEventListener('input', () => pintarFichas());
$('nfc-ayuda').textContent = hayNFC
  ? 'Este celular puede grabar chips: tocá «Grabar en el chip» y apoyá la pulsera en la parte de atrás del teléfono.'
  : 'Para grabar el chip desde acá, abrí este panel en un celular Android con Chrome. Si no, copiá el link y grabalo con NFC Tools.';

async function cargarFichas() {
  const res = await fs.getDocs(fs.collection(db, 'fichas'));
  fichas = res.docs.map(d => ({ id: d.id, datos: d.data() }))
    .sort((a, b) => (b.datos.actualizado?.seconds || 0) - (a.datos.actualizado?.seconds || 0));
  pintarFichas();
}

function conPedido(id) { return pedidos.some(p => p.fichaId === id && p.estado !== 'cancelado'); }

// Un link de URL en el chip: NTAG213 guarda unos 130 bytes útiles, NTAG215 unos 490.
function tamanioChip(link) {
  const bytes = new TextEncoder().encode(link.replace(/^https:\/\//, '')).length + 1;
  if (bytes <= 130) return `Ocupa ${bytes} bytes: entra en NTAG213 o más grande.`;
  if (bytes <= 490) return `Ocupa ${bytes} bytes: necesita NTAG215 o NTAG216.`;
  return `Ocupa ${bytes} bytes: necesita NTAG216.`;
}

async function grabarChip(link, b) {
  const original = b.textContent;
  try {
    b.disabled = true; b.textContent = 'Apoyá el chip en el celular…';
    await new NDEFReader().write({ records: [{ recordType: 'url', data: link }] });
    b.textContent = '¡Chip grabado!';
  } catch (e) {
    b.textContent = e.name === 'NotAllowedError' ? 'Falta permiso de NFC' : 'No se pudo grabar';
  }
  setTimeout(() => { b.disabled = false; b.textContent = original; }, 2500);
}

function accionesDeLink(acciones, canvas, link, nombre) {
  dibujarQR(canvas, link);
  canvas.setAttribute('aria-label', `QR de la ficha de ${nombre}`);
  if (hayNFC) acciones.append(boton('Grabar en el chip', true, ev => grabarChip(link, ev.target)));
  acciones.append(boton('Copiar link del chip', false, async ev => {
    try { await navigator.clipboard.writeText(link); ev.target.textContent = '¡Copiado!'; }
    catch { ev.target.textContent = 'No se pudo copiar'; }
    setTimeout(() => { ev.target.textContent = 'Copiar link del chip'; }, 1800);
  }));
  acciones.append(boton('Descargar QR', false, () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-saferide-${nombre.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }));
}

function pintarFichas() {
  const q = $('buscar').value.trim().toLowerCase();
  const visibles = fichas.filter(f => {
    if (q && !f.datos.nombre.toLowerCase().includes(q)) return false;
    if (filtroFichas === 'sin') return !conPedido(f.id);
    if (filtroFichas === 'con') return conPedido(f.id);
    if (filtroFichas === 'revisar') return fichaVieja(f.datos);
    return true;
  });
  const sin = fichas.filter(f => !conPedido(f.id)).length;
  $('total-fichas').textContent = `${fichas.length} EN TOTAL · ${sin} SIN PEDIDO`;
  const lista = $('lista-fichas');
  lista.replaceChildren();
  $('vacio-fichas').hidden = visibles.length > 0;
  for (const f of visibles) {
    const d = f.datos;
    const art = document.createElement('article');
    art.className = 'pedido';
    const izq = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = d.nombre;
    const meta = document.createElement('p'); meta.className = 'meta';
    const cuando = fechaDeFicha(d);
    meta.textContent = `Ficha ${f.id.slice(0, 6).toUpperCase()}${cuando ? ' · actualizada el ' + cuando.toLocaleDateString('es-AR') : ''}`;
    const chip = document.createElement('span');
    const tiene = conPedido(f.id);
    chip.className = 'chip-estado'; chip.dataset.e = tiene ? 'con' : 'sin';
    chip.textContent = tiene ? 'CON PEDIDO' : 'SIN PEDIDO';
    izq.append(h, meta, chip);
    if (fichaVieja(d)) {
      const r = document.createElement('span');
      r.className = 'chip-estado'; r.dataset.e = 'revisar'; r.textContent = 'MÁS DE UN AÑO';
      izq.append(r);
    }
    const dl = document.createElement('dl');
    fila(dl, 'Grupo', d.g);
    fila(dl, 'Alergias', d.a);
    fila(dl, 'Contacto', [d.cn, d.ct].filter(Boolean).join(' · '));
    fila(dl, 'Localidad', d.l);
    const link = linkDeFicha(f.id, d);
    const tam = document.createElement('p'); tam.className = 'tam'; tam.textContent = tamanioChip(link);
    izq.append(dl, tam);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const acciones = document.createElement('div');
    acciones.className = 'hero-actions';
    accionesDeLink(acciones, canvas, link, d.nombre);
    art.append(izq, canvas, acciones);
    lista.append(art);
  }
}

function resumen() {
  const cuenta = e => pedidos.filter(p => p.estado === e).length;
  const vendidas = pedidos.filter(p => p.estado !== 'cancelado').reduce((t, p) => t + p.cantidad, 0);
  const datos = [['Nuevos', cuenta('nuevo')], ['Grabados', cuenta('grabado')], ['Enviados', cuenta('enviado')], ['Facturado', `$${(vendidas * PRECIO).toLocaleString('es-AR')}`]];
  $('resumen').replaceChildren(...datos.map(([t, v]) => {
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = v;
    const s = document.createElement('span'); s.textContent = t;
    d.append(b, s); return d;
  }));
  $('total').textContent = `${pedidos.length} EN TOTAL`;
}

function dibujarQR(canvas, texto) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (typeof qrcode !== 'function') return;
  const qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), celda = Math.floor(canvas.width / (n + 4));
  const borde = Math.floor((canvas.width - celda * n) / 2);
  ctx.fillStyle = '#0f2218';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(borde + c * celda, borde + r * celda, celda, celda);
}

function fila(dl, titulo, valor) {
  if (!valor) return;
  const d = document.createElement('div');
  const t = document.createElement('dt'); t.textContent = titulo;
  const v = document.createElement('dd'); v.textContent = valor;
  d.append(t, v); dl.append(d);
}

function boton(texto, primario, accion) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = texto;
  if (primario) b.className = 'hero-primary';
  b.addEventListener('click', accion);
  return b;
}

async function cambiarEstado(p, estado) {
  await fs.updateDoc(fs.doc(db, 'pedidos', p.id), { estado, cambiado: fs.serverTimestamp() });
  p.estado = estado;
  pintar();
}

function pintar() {
  resumen();
  const visibles = pedidos.filter(p =>
    filtro === 'todos' ? true : filtro === 'pendientes' ? (p.estado === 'nuevo' || p.estado === 'grabado') : p.estado === filtro);
  const lista = $('lista');
  lista.replaceChildren();
  $('vacio').hidden = visibles.length > 0;
  for (const p of visibles) {
    const art = document.createElement('article');
    art.className = 'pedido';
    const izq = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = `${p.cantidad} × pulsera · ${p.nombreFicha}`;
    const meta = document.createElement('p');
    meta.className = 'meta';
    const cuando = p.creado?.toDate?.();
    meta.textContent = `Pedido ${p.id.slice(0, 6).toUpperCase()}${cuando ? ' · ' + cuando.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''} · $${(p.cantidad * PRECIO).toLocaleString('es-AR')}`;
    const chip = document.createElement('span');
    chip.className = 'chip-estado'; chip.dataset.e = p.estado; chip.textContent = ESTADOS[p.estado] || p.estado;
    const dl = document.createElement('dl');
    const e = p.envio || {};
    fila(dl, 'Recibe', e.nombre);
    fila(dl, 'Teléfono', e.telefono);
    fila(dl, 'Dirección', [e.direccion, e.ciudad, e.provincia, e.cp && `CP ${e.cp}`].filter(Boolean).join(', '));
    fila(dl, 'Mail', p.email);
    fila(dl, 'Nota', p.nota);
    if (p.ficha) {
      fila(dl, 'Grupo', p.ficha.g);
      fila(dl, 'Alergias', p.ficha.a);
      fila(dl, 'Contacto', [p.ficha.cn, p.ficha.ct].filter(Boolean).join(' · '));
      if (fichaVieja(p.ficha)) {
        fila(dl, 'Revisar', `La ficha no se actualiza desde el ${fechaDeFicha(p.ficha).toLocaleDateString('es-AR')}. Avisale al cliente que revise sus datos y, si cambian, volvé a grabar el chip.`);
      }
    } else {
      fila(dl, 'Ficha', 'El cliente borró la ficha');
    }
    izq.append(h, meta, chip, dl);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const acciones = document.createElement('div');
    acciones.className = 'hero-actions';
    if (p.ficha) {
      const link = linkDeFicha(p.fichaId, p.ficha);
      accionesDeLink(acciones, canvas, link, p.nombreFicha);
      const tam = document.createElement('p'); tam.className = 'tam'; tam.textContent = tamanioChip(link);
      izq.append(tam);
    }
    const sig = SIGUIENTE[p.estado];
    if (sig && p.ficha) acciones.append(boton(sig[1], true, () => cambiarEstado(p, sig[0])));
    if (p.estado === 'nuevo') acciones.append(boton('Cancelar', false, () => cambiarEstado(p, 'cancelado')));
    art.append(izq, canvas, acciones);
    lista.append(art);
  }
}
