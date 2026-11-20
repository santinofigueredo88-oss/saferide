// Panel del equipo: ver los pedidos, imprimir el QR, grabar el chip y marcar el avance.
import { cargarFirebase, cargarAuth, linkDeFicha, fichaVieja, fechaDeFicha } from './fichas.mjs?v=2';

const EQUIPO = ['santinofigueredo88@gmail.com'];
const ESTADOS = { nuevo: 'NUEVO', grabado: 'GRABADO', enviado: 'ENTREGADO', cancelado: 'CANCELADO' };
const PRECIO = 8000;
const ENVIO = 1000; // envío a domicilio, solo en Baradero
const esRetiro = p => p.envio?.entrega === 'retiro';
const totalDe = p => p.cantidad * PRECIO + (esRetiro(p) ? 0 : ENVIO);
function siguiente(p) {
  if (p.estado === 'nuevo') return ['grabado', 'Marcar como grabada'];
  if (p.estado === 'grabado') return ['enviado', esRetiro(p) ? 'Marcar como retirada' : 'Marcar como entregada'];
  return null;
}

// Última vez que el equipo miró el panel (solo en este navegador): lo que llegó después se marca como NUEVO.
const CLAVE_VISTO = 'saferide-equipo-visto';
function leerVisto() { try { return Number(localStorage.getItem(CLAVE_VISTO)) || 0; } catch { return 0; } }
function guardarVisto(ms) { try { localStorage.setItem(CLAVE_VISTO, String(ms)); } catch {} }
let visto = leerVisto();
const ms = t => (t?.seconds || 0) * 1000;
const esNuevo = t => ms(t) > visto;

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
  $('v-novedades').hidden = false;
  escuchar();
});

// ---------- Novedades: qué llegó desde la última visita ----------
let avisados = null; // ids ya conocidos, para avisar solo lo que llega con el panel abierto
function pintarNovedades() {
  const pn = pedidos.filter(p => esNuevo(p.creado));
  const fn = fichas.filter(f => esNuevo(f.datos.actualizado));
  const pendientes = pedidos.filter(p => p.estado === 'nuevo').length;
  const partes = [];
  if (pn.length) partes.push(`${pn.length} pedido${pn.length > 1 ? 's' : ''} nuevo${pn.length > 1 ? 's' : ''}`);
  if (fn.length) partes.push(`${fn.length} ficha${fn.length > 1 ? 's' : ''} nueva${fn.length > 1 ? 's' : ''} o cambiada${fn.length > 1 ? 's' : ''}`);
  const caja = $('v-novedades');
  caja.dataset.hay = String(partes.length > 0);
  $('novedades-titulo').textContent = partes.length ? `¡Llegó algo! ${partes.join(' y ')}.` : 'No llegó nada nuevo.';
  $('novedades-texto').textContent = (visto ? `Desde tu última visita (${new Date(visto).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}). ` : 'Es tu primera visita desde este navegador. ')
    + (pendientes ? `Hay ${pendientes} pedido${pendientes > 1 ? 's' : ''} por grabar.` : 'No hay pedidos por grabar.')
    + ' Esta página se actualiza sola mientras la tengas abierta.';
  $('ya-visto').hidden = partes.length === 0;
  document.title = `${partes.length ? `(${pn.length + fn.length}) ` : ''}Safe.Ride · Equipo`;
}
$('ya-visto').addEventListener('click', () => {
  visto = Date.now(); guardarVisto(visto);
  pintar(); pintarFichas(); pintarNovedades();
});
const puedeAvisar = 'Notification' in window;
$('avisarme').hidden = !puedeAvisar || Notification.permission === 'granted';
$('avisarme').addEventListener('click', async () => {
  const r = await Notification.requestPermission();
  $('avisarme').hidden = r === 'granted';
  $('estado-avisos').textContent = r === 'granted' ? 'LISTO: TE AVISAMOS CON UN CARTEL MIENTRAS ESTA PÁGINA ESTÉ ABIERTA.' : 'EL NAVEGADOR NO DIO PERMISO PARA AVISAR.';
});
function avisar(titulo, texto) {
  if (!puedeAvisar || Notification.permission !== 'granted') return;
  try { new Notification(titulo, { body: texto, icon: './og.png' }); } catch {}
}

for (const b of document.querySelectorAll('[data-f]')) {
  b.addEventListener('click', () => {
    filtro = b.dataset.f;
    for (const o of document.querySelectorAll('[data-f]')) o.setAttribute('aria-pressed', String(o === b));
    pintar();
  });
}

// Escucha la base de datos: si entra un pedido o una ficha, aparece sin recargar.
let fichasPorId = new Map();
function unir() { for (const p of pedidos) p.ficha = fichasPorId.get(p.fichaId) || null; }
function escuchar() {
  fs.onSnapshot(fs.collection(db, 'pedidos'), res => {
    pedidos = res.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => ms(b.creado) - ms(a.creado));
    if (avisados) {
      for (const p of pedidos) if (!avisados.has(p.id)) avisar('Nuevo pedido de Safe.Ride', `${p.cantidad} × pulsera para ${p.nombreFicha} · ${esRetiro(p) ? 'retiro' : 'envío a domicilio'}`);
    }
    avisados = new Set(pedidos.map(p => p.id));
    unir(); pintar(); pintarFichas(); pintarNovedades();
  }, err => { console.error(err); $('novedades-titulo').textContent = 'No se pudieron leer los pedidos. Revisá la conexión.'; });
  let primeraVez = true;
  fs.onSnapshot(fs.collection(db, 'fichas'), res => {
    if (!primeraVez) for (const c of res.docChanges()) if (c.type === 'added') avisar('Nueva ficha médica en Safe.Ride', c.doc.data().nombre || '');
    primeraVez = false;
    fichas = res.docs.map(d => ({ id: d.id, datos: d.data() }))
      .sort((a, b) => ms(b.datos.actualizado) - ms(a.datos.actualizado));
    fichasPorId = new Map(fichas.map(f => [f.id, f.datos]));
    unir(); pintar(); pintarFichas(); pintarNovedades();
  }, err => console.error(err));
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
    if (esNuevo(d.actualizado)) izq.append(chipNuevo());
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

function chipNuevo() {
  const c = document.createElement('span');
  c.className = 'chip-estado'; c.dataset.e = 'novedad'; c.textContent = 'NUEVO DESDE TU ÚLTIMA VISITA';
  return c;
}

function resumen() {
  const cuenta = e => pedidos.filter(p => p.estado === e).length;
  const facturado = pedidos.filter(p => p.estado !== 'cancelado').reduce((t, p) => t + totalDe(p), 0);
  const datos = [['Por grabar', cuenta('nuevo')], ['Por entregar', cuenta('grabado')], ['Entregados', cuenta('enviado')], ['Facturado', `$${facturado.toLocaleString('es-AR')}`]];
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
    meta.textContent = `Pedido ${p.id.slice(0, 6).toUpperCase()}${cuando ? ' · ' + cuando.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''} · Total $${totalDe(p).toLocaleString('es-AR')}`;
    const chip = document.createElement('span');
    chip.className = 'chip-estado'; chip.dataset.e = p.estado; chip.textContent = ESTADOS[p.estado] || p.estado;
    const dl = document.createElement('dl');
    const e = p.envio || {};
    fila(dl, 'Entrega', esRetiro(p) ? 'Retiro por el local · escribile para acordar dónde y cuándo' : `Envío a domicilio (+$${ENVIO.toLocaleString('es-AR')})`);
    fila(dl, 'Recibe', e.nombre);
    fila(dl, 'Teléfono', e.telefono);
    if (!esRetiro(p)) fila(dl, 'Dirección', [e.direccion, e.ciudad].filter(Boolean).join(', '));
    fila(dl, 'Nota', e.referencia);
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
    izq.append(h, meta, chip);
    if (esNuevo(p.creado)) izq.append(chipNuevo());
    izq.append(dl);
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
    const sig = siguiente(p);
    if (sig && p.ficha) acciones.append(boton(sig[1], true, () => cambiarEstado(p, sig[0])));
    if (e.telefono) acciones.append(boton('Llamar', false, () => { location.href = `tel:${e.telefono.replace(/[^\d+]/g, '')}`; }));
    if (p.estado === 'nuevo') acciones.append(boton('Cancelar', false, () => cambiarEstado(p, 'cancelado')));
    art.append(izq, canvas, acciones);
    lista.append(art);
  }
}
