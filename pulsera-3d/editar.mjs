// Página "Mi ficha": entrar con Google, crear la ficha y cambiar los datos médicos.
import { cargarFirebase, cargarAuth, CAMPOS, nuevoCodigo, linkDeFicha, fichaVieja } from './fichas.mjs?v=2';

const $ = id => document.getElementById(id);
const vistas = ['v-entrar', 'v-lista', 'form', 'v-listo', 'f-pedido', 'v-pedido-ok'];
function mostrar(id) {
  for (const v of vistas) $(v).hidden = v !== id;
  $(id).scrollIntoView({ block: 'nearest' });
}
function estado(el, texto, mal = false) {
  el.textContent = texto;
  el.classList.toggle('mal', mal);
}

let usuario = null;
let editando = null; // { id, datos } cuando se cambia una ficha existente
let fichas = [];
let quierePedir = false; // vino desde "Pedí tu pulsera" de la portada
const ESTADOS = { nuevo: 'Recibido · lo estamos preparando', grabado: 'Pulsera grabada · lista para entregar', enviado: 'Entregada', cancelado: 'Cancelado' };

// Datos de envío que el cliente ya escribió en la portada (quedan solo en esta pestaña).
function envioGuardado() {
  try { return JSON.parse(sessionStorage.getItem('saferide-pedido') || 'null'); } catch { return null; }
}

const { fs, db } = await cargarFirebase();
const { auth, sesion } = await cargarAuth();

// ---------- Entrar y salir ----------
$('entrar').addEventListener('click', async () => {
  estado($('estado-entrar'), 'ABRIENDO GOOGLE…');
  const proveedor = new auth.GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(sesion, proveedor);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await auth.signInWithRedirect(sesion, proveedor);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      estado($('estado-entrar'), 'NO SE PUDO ENTRAR. PROBÁ DE NUEVO.', true);
      console.error(e);
      return;
    }
    estado($('estado-entrar'), '');
  }
});
$('salir').addEventListener('click', () => auth.signOut(sesion));

auth.onAuthStateChanged(sesion, async u => {
  usuario = u;
  if (!u) { mostrar('v-entrar'); return; }
  $('quien').textContent = u.email || u.displayName || 'tu cuenta';
  await cargarLista();
  // Si se llega desde "Creá tu ficha" de la portada, los datos vienen en el link.
  const previo = new URLSearchParams(location.hash.slice(1));
  if (previo.get('pedir') === '1') quierePedir = true;
  if (previo.get('nuevo') === '1' || previo.get('pedir') === '1') history.replaceState(null, '', location.pathname);
  if (previo.get('nuevo') === '1') abrirFormulario(null, previo);
  else if (quierePedir) fichas.length ? abrirPedido() : abrirFormulario(null);
});

// ---------- Lista ----------
async function cargarLista() {
  const consulta = fs.query(fs.collection(db, 'fichas'), fs.where('uid', '==', usuario.uid));
  const res = await fs.getDocs(consulta);
  fichas = res.docs.map(d => ({ id: d.id, datos: d.data() }));
  fichas.sort((a, b) => a.datos.nombre.localeCompare(b.datos.nombre));
  const lista = $('lista');
  lista.replaceChildren();
  for (const f of fichas) {
    const li = document.createElement('li');
    const texto = document.createElement('div');
    const nombre = document.createElement('strong');
    nombre.textContent = f.datos.nombre;
    const fecha = document.createElement('small');
    const cuando = f.datos.actualizado?.toDate?.();
    fecha.textContent = cuando ? `Actualizada el ${cuando.toLocaleDateString('es-AR')}` : '';
    texto.append(nombre, fecha);
    if (fichaVieja(f.datos)) {
      li.classList.add('vieja');
      const aviso = document.createElement('small');
      aviso.className = 'aviso-anio';
      aviso.textContent = 'Pasó más de un año: revisá que tus datos sigan bien y tocá «Cambiar datos» para confirmarlos.';
      texto.append(aviso);
    }
    const acciones = document.createElement('div');
    acciones.className = 'hero-actions';
    const editar = document.createElement('button');
    editar.type = 'button'; editar.className = 'hero-primary'; editar.textContent = 'Cambiar datos';
    editar.addEventListener('click', () => abrirFormulario(f));
    const qr = document.createElement('button');
    qr.type = 'button'; qr.textContent = 'QR y chip';
    qr.addEventListener('click', () => mostrarListo(f.id, f.datos));
    const pedir = document.createElement('button');
    pedir.type = 'button'; pedir.textContent = 'Pedir pulsera';
    pedir.addEventListener('click', () => abrirPedido(f.id));
    acciones.append(editar, qr, pedir);
    li.append(texto, acciones);
    lista.append(li);
  }
  $('lista-vacia').hidden = fichas.length > 0;
  const viejas = fichas.filter(f => fichaVieja(f.datos)).length;
  $('aviso-anual').hidden = viejas === 0;
  $('aviso-anual').textContent = viejas === 1
    ? 'Tenés una ficha que no se revisa hace más de un año. Tus datos médicos pueden haber cambiado: revisalos y guardalos de nuevo.'
    : `Tenés ${viejas} fichas que no se revisan hace más de un año. Tus datos médicos pueden haber cambiado: revisalos y guardalos de nuevo.`;
  $('cantidad').textContent = fichas.length ? `${String(fichas.length).padStart(2, '0')} FICHA${fichas.length > 1 ? 'S' : ''}` : '';
  await cargarPedidos();
  mostrar('v-lista');
}
async function cargarPedidos() {
  const consulta = fs.query(fs.collection(db, 'pedidos'), fs.where('uid', '==', usuario.uid));
  const res = await fs.getDocs(consulta);
  const pedidos = res.docs.map(d => d.data()).sort((a, b) => (b.creado?.seconds || 0) - (a.creado?.seconds || 0));
  const ul = $('pedidos');
  ul.replaceChildren();
  for (const p of pedidos) {
    const li = document.createElement('li');
    const texto = document.createElement('div');
    const titulo = document.createElement('strong');
    titulo.textContent = `${p.cantidad} pulsera${p.cantidad > 1 ? 's' : ''} · ${p.nombreFicha}`;
    const detalle = document.createElement('small');
    const cuando = p.creado?.toDate?.();
    detalle.textContent = `${ESTADOS[p.estado] || p.estado}${cuando ? ' · pedido el ' + cuando.toLocaleDateString('es-AR') : ''}`;
    texto.append(titulo, detalle);
    li.append(texto);
    ul.append(li);
  }
  $('bloque-pedidos').hidden = pedidos.length === 0;
}

// ---------- Pedido ----------
function abrirPedido(fichaId) {
  const form = $('f-pedido');
  const select = $('pedido-ficha');
  select.replaceChildren();
  for (const f of fichas) {
    const op = document.createElement('option');
    op.value = f.id; op.textContent = f.datos.nombre;
    select.append(op);
  }
  if (fichaId) select.value = fichaId;
  const previo = envioGuardado();
  if (previo) {
    for (const k of ['nombre', 'telefono', 'direccion', 'referencia']) if (previo[k]) form.elements[k].value = previo[k];
    if (previo.entrega) form.elements.entrega.value = previo.entrega;
    if (previo.cantidad) form.elements.cantidad.value = String(previo.cantidad);
  }
  actualizarPrecio();
  estado($('estado-pedido'), '');
  mostrar('f-pedido');
}
// Envío a domicilio solo en Baradero ($1.000) o retiro sin costo.
const PRECIO = 8000, ENVIO = 1000;
function actualizarPrecio() {
  const form = $('f-pedido');
  const domicilio = form.elements.entrega.value !== 'retiro';
  for (const el of form.querySelectorAll('[data-solo-domicilio]')) el.hidden = !domicilio;
  form.elements.direccion.required = domicilio;
  const n = Number(form.elements.cantidad.value || 1);
  $('pedido-precio').textContent = `$${(PRECIO * n + (domicilio ? ENVIO : 0)).toLocaleString('es-AR')}`;
}
$('f-pedido').elements.cantidad.addEventListener('change', actualizarPrecio);
for (const r of $('f-pedido').elements.entrega) r.addEventListener('change', actualizarPrecio);
$('cancelar-pedido').addEventListener('click', () => cargarLista());
$('ok-volver').addEventListener('click', () => cargarLista());

$('f-pedido').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const ficha = fichas.find(f => f.id === form.elements.ficha.value);
  if (!ficha) return;
  const entrega = form.elements.entrega.value === 'retiro' ? 'retiro' : 'domicilio';
  const envio = { entrega };
  const campos = entrega === 'domicilio' ? ['nombre', 'telefono', 'direccion', 'referencia'] : ['nombre', 'telefono', 'referencia'];
  for (const k of campos) {
    const v = form.elements[k].value.trim();
    if (v) envio[k] = v;
  }
  if (entrega === 'domicilio') { envio.ciudad = 'Baradero'; envio.provincia = 'Buenos Aires'; envio.cp = '2942'; }
  const pedido = {
    uid: usuario.uid, email: usuario.email, fichaId: ficha.id, nombreFicha: ficha.datos.nombre,
    cantidad: Number(form.elements.cantidad.value), envio, estado: 'nuevo',
    creado: fs.serverTimestamp(), cambiado: fs.serverTimestamp(),
  };
  const nota = form.elements.nota.value.trim();
  if (nota) pedido.nota = nota;
  $('enviar-pedido').disabled = true;
  estado($('estado-pedido'), 'ENVIANDO EL PEDIDO…');
  try {
    await fs.addDoc(fs.collection(db, 'pedidos'), pedido);
    try { sessionStorage.removeItem('saferide-pedido'); } catch {}
    quierePedir = false;
    $('ok-nombre').textContent = ficha.datos.nombre;
    mostrar('v-pedido-ok');
  } catch (err) {
    console.error(err);
    estado($('estado-pedido'), 'NO SE PUDO ENVIAR EL PEDIDO. REVISÁ TU CONEXIÓN Y PROBÁ DE NUEVO.', true);
  } finally {
    $('enviar-pedido').disabled = false;
  }
});

$('nueva').addEventListener('click', () => abrirFormulario(null));
$('volver-lista').addEventListener('click', () => cargarLista());
$('cancelar').addEventListener('click', () => mostrar('v-lista'));

// ---------- Formulario ----------
function abrirFormulario(ficha, previo) {
  const form = $('form');
  form.reset();
  editando = ficha;
  const nueva = !ficha;
  $('t-form').textContent = nueva ? 'Nueva ficha' : 'Cambiar datos';
  $('campo-nombre').hidden = !nueva;
  form.elements.nombre.required = nueva;
  $('nombre-fijo').hidden = nueva;
  $('campo-acepto').hidden = !nueva;
  $('consentimiento').required = nueva;
  $('guardar').firstChild.textContent = nueva ? 'Guardar ficha ' : 'Guardar cambios ';
  estado($('estado-form'), '');
  if (ficha) {
    $('nombre-texto').textContent = ficha.datos.nombre;
    for (const k of CAMPOS) form.elements[k].value = ficha.datos[k] || '';
  } else if (previo) {
    form.elements.nombre.value = previo.get('n') || '';
    for (const k of CAMPOS) if (previo.get(k)) form.elements[k].value = previo.get(k);
  }
  mostrar('form');
  (nueva ? form.elements.nombre : form.elements.g).focus({ preventScroll: true });
}

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const datos = {};
  for (const k of CAMPOS) {
    const v = form.elements[k].value.trim();
    if (v) datos[k] = v;
  }
  datos.actualizado = fs.serverTimestamp();
  $('guardar').disabled = true;
  estado($('estado-form'), 'GUARDANDO…');
  try {
    let id, completo;
    if (editando) {
      id = editando.id;
      completo = { uid: usuario.uid, nombre: editando.datos.nombre, ...datos };
      await fs.setDoc(fs.doc(db, 'fichas', id), completo);
    } else {
      id = nuevoCodigo();
      completo = { uid: usuario.uid, nombre: form.elements.nombre.value.trim(), ...datos };
      await fs.setDoc(fs.doc(db, 'fichas', id), completo);
    }
    if (quierePedir) {
      fichas.push({ id, datos: completo });
      abrirPedido(id);
    } else {
      mostrarListo(id, completo);
    }
  } catch (err) {
    console.error(err);
    estado($('estado-form'), 'NO SE PUDO GUARDAR. REVISÁ TU CONEXIÓN Y PROBÁ DE NUEVO.', true);
  } finally {
    $('guardar').disabled = false;
  }
});

// ---------- QR y chip ----------
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

function mostrarListo(id, datos) {
  const link = linkDeFicha(id, datos);
  $('link').value = link;
  $('ver').href = link;
  dibujarQR($('qr'), link);
  const bytes = new TextEncoder().encode(link.replace(/^https:\/\//, '')).length;
  const chip = bytes <= 132 ? 'NTAG213, NTAG215 Y NTAG216' : bytes <= 490 ? 'NTAG215 Y NTAG216' : 'NTAG216';
  estado($('medida'), `OCUPA ${bytes} BYTES · ENTRA EN ${chip}`);
  mostrar('v-listo');
}

$('copiar').addEventListener('click', async () => {
  const texto = $('copiar').querySelector('span');
  try { await navigator.clipboard.writeText($('link').value); }
  catch { $('link').select(); document.execCommand('copy'); }
  texto.textContent = '¡Copiado!';
  setTimeout(() => { texto.textContent = 'Copiar link'; }, 1800);
});
