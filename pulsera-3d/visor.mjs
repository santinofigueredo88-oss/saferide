import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initNfcDemo } from './nfc-demo.mjs';
import { initTour } from './tour.mjs';
import { crearMuneca } from './muneca.mjs';

const $ = (selector) => document.querySelector(selector);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const svgNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const internalParts = new Set(['chip']);
const labelRowsMaxWidth = 560;
// Pulsera v2 (hardware/v2): correa deportiva de TPU impresa plana, centro redondo
// de 35 mm, etiqueta NFC de 30 mm debajo de una tapa al ras con el QR.
// La correa se arma plana y se curva siguiendo un camino: el centro queda plano.
const LH = 85, FLAT = 17.5, ESPESOR = 2.6;
function camino(radio, arriba) {
  const paso = .25, n = Math.round(LH / paso), xs = [], zs = [], fs = [];
  for (const sg of [1, -1]) {
    let x = 0, z = 0, f = 0;
    for (let i = 0; i <= n; i++) {
      const k = sg > 0 ? n + i : n - i;
      xs[k] = x; zs[k] = z + arriba; fs[k] = f;
      f += sg * (i * paso < FLAT ? 0 : 1 / radio) * paso;
      x += sg * Math.cos(f) * paso; z -= Math.sin(sg * f) * paso;
    }
  }
  return (s, d = 0) => {
    const t = THREE.MathUtils.clamp((s + LH) / paso, 0, 2 * n), i = Math.min(Math.floor(t), 2 * n - 1), u = t - i;
    const x = xs[i] + (xs[i + 1] - xs[i]) * u, z = zs[i] + (zs[i + 1] - zs[i]) * u, f = fs[i] + (fs[i + 1] - fs[i]) * u;
    return [x + d * Math.sin(f), z + d * Math.cos(f), f];
  };
}
// Puesta: la correa abraza la muñeca. Es la envolvente de la muñeca (elipse) y del centro plano,
// como una cinta tirante alrededor de un cuerpo con una placa rígida arriba.
function envolver(a, b, cz, flat) {
  const arriba = cz + b, pts = [];
  for (let i = 0; i < 720; i++) { const t = i / 720 * Math.PI * 2; pts.push([a * Math.cos(t), cz + b * Math.sin(t)]); }
  pts.push([-flat, arriba], [flat, arriba]);
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cruz = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lado = lista => { const h = []; for (const p of lista) { while (h.length > 1 && cruz(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
  const casco = [...lado(pts), ...lado([...pts].reverse())];   // antihorario
  // arrancar arriba en el medio y recorrer en sentido horario (x crece por arriba)
  let k = casco.findIndex(p => p[0] === flat && p[1] === arriba);
  const anillo = [[0, arriba]];
  for (let j = 0; j < casco.length; j++) anillo.push(casco[(k - j + casco.length) % casco.length]);
  anillo.push([0, arriba]);
  { // repartir puntos cada 0,5 mm para poder suavizar
    const denso = [anillo[0]];
    for (let i = 1; i < anillo.length; i++) {
      const A = anillo[i - 1], B = anillo[i], n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / .5));
      for (let j = 1; j <= n; j++) denso.push([A[0] + (B[0] - A[0]) * j / n, A[1] + (B[1] - A[1]) * j / n]);
    }
    anillo.length = 0; anillo.push(...denso);
  }
  // suavizar las esquinas (la cinta no hace quiebres): promedios sucesivos, sin mover el centro plano
  for (let pasada = 0; pasada < 40; pasada++) {
    const copia = anillo.map(p => [...p]);
    for (let i = 1; i < anillo.length - 1; i++) {
      if (Math.abs(copia[i][0]) < flat - 2 && copia[i][1] > arriba - .01) continue;
      anillo[i] = [(copia[i - 1][0] + 2 * copia[i][0] + copia[i + 1][0]) / 4, (copia[i - 1][1] + 2 * copia[i][1] + copia[i + 1][1]) / 4];
    }
  }
  const largo = [0];
  for (let i = 1; i < anillo.length; i++) largo.push(largo[i - 1] + Math.hypot(anillo[i][0] - anillo[i - 1][0], anillo[i][1] - anillo[i - 1][1]));
  const P = largo[largo.length - 1];
  const punto = u => {
    u = ((u % P) + P) % P;
    let i = 1; while (largo[i] < u) i++;
    const r = (u - largo[i - 1]) / (largo[i] - largo[i - 1] || 1), A = anillo[i - 1], B = anillo[i];
    return [A[0] + (B[0] - A[0]) * r, A[1] + (B[1] - A[1]) * r];
  };
  return (s, d = 0) => {
    const [x, z] = punto(s), [x1, z1] = punto(s + .4), [x0, z0] = punto(s - .4);
    const f = Math.atan2(-(z1 - z0), x1 - x0);
    return [x + d * Math.sin(f), z + d * Math.cos(f), f];
  };
}
// muñeca del modelo: elipse de 27,6 × 24,2 mm centrada en z = 3; la correa queda a 0,5 mm de la piel
const HOLGURA = .5;
const ARRIBA = 30.7, ARRIBA_PUESTA = 3 + 24.2 + HOLGURA + ESPESOR / 2;
const suelta = camino(27, ARRIBA), puesta = envolver(27.6 + HOLGURA + ESPESOR / 2, 24.2 + HOLGURA + ESPESOR / 2, 3, FLAT);
const S_CIERRE = -(LH - 6);
const claspAngle = suelta(S_CIERRE)[2], claspAngleWorn = puesta(S_CIERRE)[2];
const enCorrea = (s, y, d) => { const [x, z] = suelta(s, d); return [x, y, z]; };

const definitions = {
  band: { name: 'Correa de TPU', short: 'Correa TPU', type: '01 / CUERPO FLEXIBLE', copy: 'Correa deportiva de 16 mm impresa plana en TPU flexible: se curva sola al ponerla. En un costado lleva impresos el grupo sanguíneo, las alergias y un teléfono de emergencia. Siete agujeros cada 5 mm: sirve para muñecas de 15 a 18 cm.', side: 'left', offset: [-8, 8, -9], anchor: enCorrea(-44, 4, 1.3) },
  housing: { name: 'Centro redondo', short: 'Centro', type: '02 / ALOJAMIENTO', copy: 'Centro de 35 mm y bajito, de 4,4 mm. La correa se ensancha de a poco hasta él y forma una sola pieza. Adentro tiene un hueco de 31,2 mm donde se pega la etiqueta NFC sin doblarla.', side: 'left', offset: [0, 0, 6], anchor: enCorrea(-26, -7, 2.6) },
  qr: { name: 'QR adhesivo', short: 'QR', type: '03 / CAPA EXTERIOR', copy: 'Código de 20 × 20 mm pegado sobre la tapa, visible con la pulsera puesta. La cámara lo lee para abrir la ficha web. Para usar NFC, acercá el celular a este mismo punto.', side: 'left', offset: [-13, 19, 34], anchor: [-7, 0, .2] },
  chip: { name: 'Etiqueta NFC', short: 'NFC', type: '04 / DEBAJO DEL QR', copy: 'Etiqueta adhesiva redonda de 30 mm con chip y antena. Va pegada en el fondo del centro, debajo de la tapa, y permite leer los datos esenciales sin internet.', side: 'right', offset: [22, -7, 14], anchor: [6, 0, .2] },
  film: { name: 'Tapa al ras', short: 'Tapa', type: '05 / PROTECCIÓN', copy: 'Tapa de 31 mm que entra a presión y queda al ras del centro. Protege la etiqueta NFC y ningún borde roza la muñeca. Arriba lleva el QR.', side: 'right', offset: [28, 9, 24], anchor: [12, 4, .6] },
  clasp: { name: 'Cierre a presión', short: 'Cierre', type: '06 / AJUSTE', copy: 'Un perno con cabeza entra a presión en el agujero que corresponda y queda trabado. La trabita sostiene la punta que sobra para que no se enganche.', side: 'right', offset: [-6, 26, -6], anchor: [0, 0, 3.4] },
};

const catalogButtons = [...document.querySelectorAll('[data-part]')];
let selectedPart = '';
let viewer;

function selectPart(id) {
  highlightPart(selectedPart === id ? '' : id);
}

function highlightPart(id) {
  selectedPart = id;
  const part = definitions[selectedPart];
  $('#part-type').textContent = part?.type || 'VISTA GENERAL';
  $('#part-title').textContent = part?.name || 'Dos lecturas, una pulsera';
  $('#part-description').textContent = part?.copy || 'El QR queda visible por fuera. Debajo, en el mismo punto, se aloja el chip NFC cuadrado.';
  $('#part-demo').hidden = selectedPart !== 'chip';
  catalogButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === selectedPart)));
  document.querySelectorAll('[data-layer]').forEach(layer => layer.classList.toggle('is-selected', layer.dataset.layer === id));
  viewer?.selectionChanged();
}

catalogButtons.forEach(button => button.addEventListener('click', () => selectPart(button.dataset.part)));

function roundedRect(w, h, requested, cx = 0, cy = 0) {
  const shape = new THREE.Shape();
  const r = Math.min(requested, w / 2, h / 2);
  const x = cx - w / 2, y = cy - h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r); shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function circleHole(x, y, r) {
  const path = new THREE.Path();
  path.absarc(x, y, r, 0, Math.PI * 2, true);
  return path;
}

const material = (color, roughness = .62, metalness = .04) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness });

function plate(shape, depth, bevel, mat) {
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 5, curveSegments: 18, steps: 1,
  }), mat);
}

function disk(radius, depth, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 56), mat);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// Contorno visto desde arriba: la correa de 16 mm se ensancha en línea recta
// hasta tocar el círculo del centro (como si se estirara un elástico).
function mitadAncho(s, R, L, w) {
  s = Math.abs(s);
  if (s >= L) return w;
  const a = Math.atan2(w, L) + Math.acos(R / Math.hypot(L, w));
  const tx = R * Math.cos(a), ty = R * Math.sin(a);
  if (s <= tx) return Math.sqrt(R * R - s * s);
  return ty + (w - ty) * (s - tx) / (L - tx);
}
function contorno(desde, hasta, R, L, w, punta) {
  const shape = new THREE.Shape();
  shape.moveTo(desde, mitadAncho(desde, R, L, w));
  for (let s = desde; s <= hasta; s += .5) shape.lineTo(s, mitadAncho(s, R, L, w));
  if (punta) shape.absarc(hasta, 0, w, Math.PI / 2, -Math.PI / 2, true);
  for (let s = hasta; s >= desde; s -= .5) shape.lineTo(s, -mitadAncho(s, R, L, w));
  if (punta) shape.absarc(desde, 0, w, -Math.PI / 2, Math.PI / 2, true);
  return shape;
}

// Curva una pieza plana (x = largo, y = ancho, z = espesor) sobre la correa.
// Se subdividen los triángulos largos para que sigan bien la curva, y se
// guarda la forma "puesta en la muñeca" como morph.
function curvar(plana, dz) {
  const first = plana.getAttribute('position');
  const normals = plana.getAttribute('normal');
  const positions = [], fitted = [], fittedNormals = [], resultNormals = [], uv = [];
  const vertex = i => [first.getX(i), first.getY(i), first.getZ(i) + dz, normals.getX(i), normals.getY(i), normals.getZ(i)];
  const giro = (f, ns, ny, nd) => {
    const nx = ns * Math.cos(f) + nd * Math.sin(f), nz = -ns * Math.sin(f) + nd * Math.cos(f);
    const L = Math.hypot(nx, ny, nz) || 1;
    return [nx / L, ny / L, nz / L];
  };
  function push([s, y, d, ns, ny, nd]) {
    const [x, z, f] = suelta(s, d), [xw, zw, fw] = puesta(s, d);
    positions.push(x, y, z); fitted.push(xw, y, zw);
    resultNormals.push(...giro(f, ns, ny, nd)); fittedNormals.push(...giro(fw, ns, ny, nd));
    uv.push(s / (2 * LH) + .5, y / 16 + .5);
  }
  function triangle(a, b, c) {
    const ab = Math.abs(a[0] - b[0]), bc = Math.abs(b[0] - c[0]), ca = Math.abs(c[0] - a[0]);
    if (Math.max(ab, bc, ca) <= 2) { push(a); push(b); push(c); return; }
    if (bc > ab && bc >= ca) [a, b, c] = [b, c, a];
    else if (ca > ab) [a, b, c] = [c, a, b];
    const mid = a.map((value, i) => (value + b[i]) * .5);
    triangle(a, mid, c); triangle(mid, b, c);
  }
  for (let i = 0; i < first.count; i += 3) triangle(vertex(i), vertex(i + 1), vertex(i + 2));
  plana.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultNormals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(fitted, 3)];
  geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute(fittedNormals, 3)];
  return geometry;
}

// Correa: 16 mm de ancho, 2,6 mm de espesor, se ensancha hasta el centro de 35 mm.
// El bisel agranda la pieza 0,45 mm, por eso el contorno va un poco más chico.
function bandGeometry() {
  const b = .45;
  const shape = contorno(-(LH - 8), LH - 8, 17.5 - b, 35.5, 8 - b, true);
  for (let i = 0; i < 7; i++) shape.holes.push(circleHole(LH - 7 - i * 5, 0, 1.6 + b));
  return curvar(plate(shape, ESPESOR - 2 * b, b, null).geometry, -ESPESOR / 2 + b);
}

// Centro: sube 1,8 mm sobre la correa en rampa suave y deja el hueco de 31,2 mm.
function housingGeometry() {
  const b = .45;
  const shape = contorno(-30, 30, 17.5 - b, 30, 6, false);
  shape.holes.push(circleHole(0, 0, 15.6 + b));
  return curvar(plate(shape, 1.8 - 2 * b, b, null).geometry, ESPESOR / 2 - .05 + b);
}

// Un cartel plano apoyado sobre la cara de afuera de la correa, centrado en s.
function sobreCorrea(ancho, alto, centro) {
  const geometry = new THREE.PlaneGeometry(ancho, alto, 30, 1);
  const position = geometry.getAttribute('position');
  const fitted = [];
  for (let i = 0; i < position.count; i++) {
    const s = centro + position.getX(i), y = position.getY(i) * Math.min(1, 13 / alto) - .3;
    const [x, z] = suelta(s, ESPESOR / 2 + .03), [xw, zw] = puesta(s, ESPESOR / 2 + .03);
    fitted.push(xw, y, zw);
    position.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(fitted, 3)];
  return geometry;
}

function graphicTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function qrGraphic() {
  return graphicTexture(256, (ctx, size) => {
    ctx.fillStyle = '#f5f4e7'; ctx.fillRect(0, 0, size, size);
    const modules = 25, step = 8, margin = (size - modules * step) / 2;
    const finder = [[0, 0], [18, 0], [0, 18]];
    ctx.fillStyle = '#182c23';
    let seed = 5237;
    for (let y = 0; y < modules; y++) for (let x = 0; x < modules; x++) {
      const f = finder.find(([a, b]) => x >= a - 1 && x <= a + 7 && y >= b - 1 && y <= b + 7);
      let dark;
      if (f) {
        const a = x - f[0], b = y - f[1];
        dark = a >= 0 && a < 7 && b >= 0 && b < 7 && (a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4));
      } else {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        dark = seed >>> 31;
      }
      if (dark) ctx.fillRect(margin + x * step, margin + y * step, step, step);
    }
  });
}

function bandFinish() {
  const texture = graphicTexture(128, (ctx, size) => {
    const pixels = ctx.createImageData(size, size);
    let seed = 8719;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 105 + ((seed >>> 24) % 43);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 1);
  const finish = material(0x28573f, .88, 0);
  finish.bumpMap = texture;
  finish.bumpScale = .11;
  finish.sheen = .12;
  finish.sheenColor.setHex(0x6cbca0);
  finish.sheenRoughness = .8;
  return finish;
}

function wordmark() {
  const texture = graphicTexture(512, (ctx, size) => {
    ctx.fillStyle = '#c9e9d9';
    ctx.font = '650 105px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Safe.Ride', size / 2, size / 2, 460);
  });
  const geometry = sobreCorrea(11, 8, 41.5);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .4, roughness: .76 }));
}

// Datos esenciales impresos en el costado: se leen sin celular ni internet.
function printedData() {
  const texture = graphicTexture(1024, (ctx, size) => {
    // La textura es cuadrada pero la placa es 23 × 13: se estira el dibujo para compensar.
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.scale(1, 23 / 13);
    ctx.fillStyle = '#d7f0e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 150px system-ui, sans-serif';
    ctx.fillText('0+', -300, -60);
    ctx.font = '700 72px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALERGIA:', -150, -100, 620);
    ctx.fillText('PENICILINA', -150, -25, 620);
    ctx.fillRect(-440, 50, 880, 6);
    ctx.textAlign = 'center';
    ctx.font = '700 70px system-ui, sans-serif';
    ctx.fillText('EMERG. 3329 000000', 0, 125, 880);
    ctx.restore();
  });
  const geometry = sobreCorrea(23, 13, -50);
  const map = texture; map.anisotropy = 8;
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: .35, roughness: .76 }));
}

function makeModel(scene) {
  const parts = {};
  function part(id, x, y, z) {
    const group = new THREE.Group();
    const position = V(x, y, z);
    group.position.copy(position);
    scene.add(group);
    const def = definitions[id];
    parts[id] = { ...def, group, position, anchor: V(...def.anchor), offset: V(...def.offset), materials: new Set() };
    return group;
  }

  const band = part('band', 0, 0, 0);
  band.add(new THREE.Mesh(bandGeometry(), bandFinish()), wordmark(), printedData());

  // El centro es parte de la correa: mismo TPU, se curva con ella.
  const housing = part('housing', 0, 0, 0);
  const centro = bandFinish();
  centro.color.setHex(0x2b5e44);
  housing.add(new THREE.Mesh(housingGeometry(), centro));

  // Capas del centro, de afuera hacia adentro: QR, tapa, etiqueta NFC.
  const tope = ARRIBA + ESPESOR / 2 + 1.8;          // cara de arriba del centro
  const qr = part('qr', 0, 0, tope);
  qr.add(plate(roundedRect(19.4, 19.4, .7), .06, .05, material(0xf0f2e7, .48, .01)));
  const qrDecal = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.MeshStandardMaterial({ map: qrGraphic(), roughness: .65 }));
  qrDecal.position.z = .17; qr.add(qrDecal);

  const film = part('film', 0, 0, tope - 1.2);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(15.2, 15.5, 1.2, 72), material(0xe9ece2, .55, 0));
  tapa.rotation.x = Math.PI / 2; tapa.position.z = .6; film.add(tapa);

  const chip = part('chip', 0, 0, ARRIBA + ESPESOR / 2);
  const etiqueta = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, .3, 72), material(0xf3f1e6, .7, 0));
  etiqueta.rotation.x = Math.PI / 2; etiqueta.position.z = .15; chip.add(etiqueta);
  const copper = material(0xe79b59, .28, .74);
  for (let i = 0; i < 5; i++) {
    const r = 13.6 - i * .9;
    const vuelta = new THREE.Shape(); vuelta.absarc(0, 0, r, 0, Math.PI * 2, false);
    vuelta.holes.push(circleHole(0, 0, r - .4));
    const track = plate(vuelta, .03, 0, copper);
    track.position.z = .31; chip.add(track);
  }
  const die = plate(roundedRect(2.4, 2.4, .25), .3, .1, material(0x232e29, .48));
  die.position.z = .31; chip.add(die);

  // Cierre: perno con cabeza en una punta y la trabita que sostiene la otra.
  const [cx, cz] = suelta(S_CIERRE, ESPESOR / 2);
  const clasp = part('clasp', cx, 0, cz);
  clasp.rotation.y = claspAngle;
  const metal = material(0x7f9b8f, .4, .1);
  const pin = disk(1.5, 2.6, metal); pin.position.set(0, 0, 1.3); clasp.add(pin);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 1.3, 40), metal);
  head.rotation.x = Math.PI / 2; head.position.set(0, 0, 3.25); clasp.add(head);
  const traba = material(0x28573f, .85, 0);
  for (const y of [-9.2, 9.2]) {
    const poste = plate(roundedRect(6, 1.6, .5), 7, 0, traba);
    poste.position.set(9, y, -ESPESOR); clasp.add(poste);
  }
  const techo = plate(roundedRect(6, 20, .6), 1.4, 0, traba);
  techo.position.set(9, 0, 3); clasp.add(techo);

  for (const [id, item] of Object.entries(parts)) {
    item.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.userData.part = id;
      item.materials.add(mesh.material);
    });
    const points = new Float32Array(6);
    const guide = new THREE.BufferGeometry();
    guide.setAttribute('position', new THREE.BufferAttribute(points, 3));
    item.guide = new THREE.Line(guide, new THREE.LineBasicMaterial({ color: 0xa8ddc1, transparent: true, opacity: .12, depthWrite: false }));
    item.guide.frustumCulled = false;
    scene.add(item.guide);
  }
  return parts;
}

function lightModel(scene, renderer) {
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, .035).texture;
  scene.environmentIntensity = .66;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf4f8f4, 0x778e7f, .88));
  // A warm key and a grazing rim light separate the green finishes from the stage.
  for (const [color, intensity, position] of [[0xfff7e6, 2.65, [-56, 72, 82]], [0xd2f3e5, 2.45, [24, 43, -82]], [0xdbedff, .72, [80, 16, 51]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
    if (!scene.userData.keyLight) {
      // La luz principal proyecta una sombra suave sobre el piso.
      scene.userData.keyLight = light;
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.radius = 6;
      light.shadow.bias = -.0006;
      Object.assign(light.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 260 });
    }
  }
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.ShadowMaterial({ opacity: .15 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.set(2, -15.2, 4); catcher.receiveShadow = true;
  scene.add(catcher);
  const shadow = graphicTexture(128, (ctx, size) => {
    const shade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    shade.addColorStop(0, '#071b14c4'); shade.addColorStop(.48, '#071b1470'); shade.addColorStop(1, '#071b1400');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, size, size);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 85), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: .55, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(2, -15, 4); scene.add(floor);
  return floor;
}

function createViewer() {
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Pulsera 3D. Usá las flechas para girar, más y menos para acercar o alejar e Inicio para recentrar.');
  $('#model').append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .3, 600);
  camera.position.set(72, 54, 125);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.enableDamping = !reduceMotion.matches;
  orbit.dampingFactor = .14;
  orbit.rotateSpeed = .67;
  orbit.autoRotateSpeed = 2.2;
  orbit.minPolarAngle = .035;
  orbit.maxPolarAngle = Math.PI - .035;
  orbit.minDistance = 50;
  orbit.maxDistance = 380;

  const rig = new THREE.Group(); scene.add(rig);
  const parts = makeModel(rig);
  const floor = lightModel(scene, renderer);
  rig.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const shell = $('#callouts');
  const leaders = $('#leaders');
  const explodeButton = $('#explode');
  const labelButton = $('#toggle-labels');
  const spinButton = $('#spin');
  const separation = $('#separation');
  const fullscreen = $('#fullscreen');
  const presets = [...document.querySelectorAll('[data-view]')];
  const angles = { perspective: V(70, 57, 124), front: V(0, 7, 120), inside: V(-55, 100, -100), worn: V(8,20,160) };
  const claspWorn = (() => { const [x, z] = puesta(S_CIERRE, ESPESOR / 2); return V(x, 0, z); })();
  let wrist, worn = false, wearPhase = 0;
  let view = 'perspective', exploded = false, labels = false, phase = 0, zoom = 1;
  let width = 1, height = 1, frame = 0, previousTime = 0, failed = false, cameraInput = false;
  let spinning = false, stageVisible = true;
  const world = V(0, 0, 0);
  const zoomLevel = $('#zoom-level');
  const polar = new THREE.Spherical();
  let flight = null, spread = 1;

  for (const [id, part] of Object.entries(parts)) {
    const button = document.createElement('button');
    button.className = `callout is-${part.side}`;
    button.type = 'button';
    button.setAttribute('aria-label', part.name);
    button.setAttribute('aria-pressed', 'false');
    const index = document.createElement('span');
    index.textContent = part.type.slice(0, 2);
    const name = document.createElement('span');
    name.className = 'callout-name'; name.textContent = part.short;
    button.append(index, name);
    button.addEventListener('click', () => selectPart(id));
    shell.append(button);
    const line = document.createElementNS(svgNS, 'path');
    line.setAttribute('class', 'leader');
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('class', 'leader-dot'); dot.setAttribute('r', '2.7');
    leaders.append(line, dot);
    Object.assign(part, { button, line, dot });
  }

  function updateButtonStates() {
    stage.dataset.mode = worn ? 'worn' : exploded ? 'exploded' : 'assembled';
    stage.dataset.labels = String(labels);
    $('#assembly-state').textContent = worn ? 'En la muñeca' : exploded ? 'Vista desarmada' : 'Armada';
    explodeButton.lastChild.textContent = exploded ? ' Armar' : ' Desarmar';
    explodeButton.setAttribute('aria-pressed', String(exploded));
    labelButton.setAttribute('aria-pressed', String(labels));
    $('#separation-control').hidden = !exploded;
    shell.hidden = !labels;
    presets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === 'worn' ? worn : view === button.dataset.view)));
    for (const [id, part] of Object.entries(parts)) {
      part.button.hidden = internalParts.has(id) && !exploded;
      part.button.setAttribute('aria-pressed', String(id === selectedPart));
      part.line.classList.toggle('is-selected', id === selectedPart);
      for (const mat of part.materials) {
        mat.emissive.setHex(id === selectedPart ? (id === 'chip' ? 0xa07742 : 0x60cdac) : 0x000000);
        mat.emissiveIntensity = id === selectedPart ? .36 : 0;
      }
    }
  }

  function fitDistance() {
    if (worn) return 202 * Math.max(1, 1.52 / camera.aspect);
    if (!exploded) return 116 * Math.max(1, 1.16 / camera.aspect);
    // Leave room for the two columns on wide stages and the label rows on narrow ones.
    const labelRows = labels && width <= labelRowsMaxWidth;
    const usableWidth = Math.max(1, width - (labels && !labelRows ? 220 : 28));
    return 151 * Math.max(labelRows ? 1.22 : 1, 1.04 * height / usableWidth);
  }

  function frameCamera(direction, duration = 0) {
    const offset = camera.position.clone().sub(orbit.target);
    const from = new THREE.Spherical().setFromVector3(offset);
    const to = new THREE.Spherical().setFromVector3(direction || offset);
    const fit = fitDistance();
    to.radius = fit * zoom;
    // Always turn through the shorter arc, even across the azimuth seam.
    const angle = to.theta - from.theta;
    to.theta = from.theta + Math.atan2(Math.sin(angle), Math.cos(angle));
    orbit.minDistance = fit * .50;
    orbit.maxDistance = fit * 2.3;
    flight = { from, to, origin: orbit.target.clone(), target: worn ? V(8,4,1) : exploded ? V(-3,-3,12) : V(1,-4,8), start: performance.now(), duration, smooth: !!cine };
    if (!duration || reduceMotion.matches) advanceCamera(1);
    schedule();
  }

  function advanceCamera(t) {
    const { from, to, origin, target } = flight;
    const mix = flight.smooth ? (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) : 1 - (1 - t) ** 3;
    polar.set(THREE.MathUtils.lerp(from.radius, to.radius, mix), THREE.MathUtils.lerp(from.phi, to.phi, mix), THREE.MathUtils.lerp(from.theta, to.theta, mix));
    orbit.target.lerpVectors(origin, target, mix);
    camera.position.setFromSpherical(polar).add(orbit.target);
    if (t === 1) flight = null;
  }

  function applyView(name) {
    setSpin(false);
    worn = name === 'worn';
    if (worn) {
      setExploded(false);
      labels = false;
      if (!wrist) { wrist = crearMuneca(); rig.add(wrist); }
    }
    view = name;
    zoom = 1;
    frameCamera(angles[name], 390);
    updateButtonStates();
  }

  function setExploded(on) {
    if (exploded === on) return;
    setSpin(false);
    exploded = on;
    if (on && worn) { worn = false; view = 'perspective'; }
    labels = on;
    zoom = 1;
    if (!on && internalParts.has(selectedPart)) selectPart(selectedPart);
    frameCamera(angles[view], 410);
    updateButtonStates(); schedule();
  }

  function changeZoom(factor) {
    setSpin(false);
    const current = flight ? zoom : camera.position.distanceTo(orbit.target) / fitDistance();
    zoom = THREE.MathUtils.clamp(current * factor, .50, 2.3);
    frameCamera(view ? angles[view] : null, 190);
  }

  function resize() {
    const size = stage.getBoundingClientRect();
    if (size.width === width && size.height === height) return;
    const currentZoom = camera.position.distanceTo(orbit.target) / fitDistance();
    zoom = width === 1 ? 1 : THREE.MathUtils.clamp(currentZoom, .50, 2.3);
    width = Math.max(size.width, 1); height = Math.max(size.height, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    leaders.setAttribute('viewBox', `0 0 ${width} ${height}`);
    frameCamera();
  }

  function updateCallouts() {
    leaders.style.visibility = labels ? 'visible' : 'hidden';
    if (!labels) return;
    const anchors = [];
    for (const part of Object.values(parts)) {
      if (part.button.hidden) { part.line.style.display = part.dot.style.display = 'none'; continue; }
      part.group.localToWorld(world.copy(part.anchor)).project(camera);
      const x = (world.x + 1) * width / 2, y = (1 - world.y) * height / 2;
      anchors.push({ part, x, y, offscreen: world.z < -1 || world.z > 1 || x < 0 || x > width || y < 0 || y > height });
    }

    function connect({ part, x, y, offscreen }, line) {
      part.line.style.display = part.dot.style.display = offscreen ? 'none' : '';
      if (offscreen) return;
      part.line.setAttribute('d', `${line}L${x},${y}`);
      part.dot.setAttribute('cx', x); part.dot.setAttribute('cy', y);
    }

    // On narrow screens the names sit above and below the model rather than
    // covering it. Sorting anchors keeps the leaders from crossing each other.
    if (width <= labelRowsMaxWidth) {
      const split = Math.ceil(anchors.length / 2);
      anchors.sort((a, b) => a.y - b.y);
      [anchors.slice(0, split), anchors.slice(split)].forEach((row, rowIndex) => {
        row.sort((a, b) => a.x - b.x);
        const py = rowIndex === 0 ? 33 : height - 56;
        row.forEach((point, i) => {
          const { part } = point;
          const px = (i + .5) * width / row.length;
          part.button.style.left = `${px}px`;
          part.button.style.right = 'auto';
          part.button.style.transform = 'translate(-50%, -50%)';
          part.button.style.top = `${py}px`;
          const edge = py + (rowIndex === 0 ? 1 : -1) * (part.button.offsetHeight / 2);
          connect(point, `M${px},${edge}`);
        });
      });
      return;
    }

    const columns = { left: anchors.filter(({ part }) => part.side === 'left'), right: anchors.filter(({ part }) => part.side === 'right') };
    for (const [side, list] of Object.entries(columns)) {
      list.sort((a, b) => a.y - b.y);
      let above = 5;
      for (const [i, point] of list.entries()) {
        const { part, y } = point;
        const py = Math.min(Math.max(y, above + 38), height - 42 - (list.length - i - 1) * 38);
        above = py;
        part.button.style.left = part.button.style.right = part.button.style.transform = '';
        part.button.style.top = `${py}px`;
        const edge = part.button.offsetLeft + (side === 'left' ? part.button.offsetWidth : 0);
        const elbow = edge + (side === 'left' ? 12 : -12);
        connect(point, `M${edge},${py}H${elbow}`);
      }
    }
  }

  function draw(now) {
    frame = 0;
    const step = previousTime ? Math.min(now - previousTime, 40) : 16;
    previousTime = now;
    const goal = exploded ? 1 : 0, fraction = separation.valueAsNumber / 100;
    const approach = (value, end, ms) => reduceMotion.matches || Math.abs(value - end) < .002 ? end : THREE.MathUtils.lerp(value, end, 1 - Math.exp(-step / ms));
    phase = approach(phase, goal, 115);
    spread = approach(spread, fraction, 55);
    wearPhase = approach(wearPhase, worn ? 1 : 0, 80);
    rig.rotation.z = -(width / height > 1.1 ? 1.13 : .66) * wearPhase;
    if (wrist) {
      wrist.visible = wearPhase > .002;
      // El brazo entra por el eje interior y queda quieto al terminar el encuadre.
      wrist.position.y = (wearPhase - 1) * 165;
    }
    for (const mesh of [...parts.band.group.children, ...parts.housing.group.children]) mesh.morphTargetInfluences[0] = wearPhase;
    parts.clasp.group.rotation.y = THREE.MathUtils.lerp(claspAngle, .35, phase * spread) + (claspAngleWorn - claspAngle) * wearPhase;
    floor.visible = phase < .5 && wearPhase < .01;
    floor.material.opacity = .55 * Math.max(0, 1 - 2 * phase);
    for (const [id, part] of Object.entries(parts)) {
      // The external plate lifts first; the film and then the chip follow it out.
      const delay = id === 'chip' ? .34 : id === 'film' ? .17 : 0;
      const layer = THREE.MathUtils.smoothstep(phase, delay, 1) * spread;
      part.group.position.copy(part.position).addScaledVector(part.offset, layer);
      if (id === 'clasp') part.group.position.lerp(claspWorn,wearPhase);
      else if (id !== 'band' && id !== 'housing') part.group.position.z += (ARRIBA_PUESTA - ARRIBA) * wearPhase;
      part.guide.visible = phase > .05;
      if (part.guide.visible) {
        const p = part.guide.geometry.attributes.position;
        p.setXYZ(0, part.position.x, part.position.y, part.position.z);
        p.setXYZ(1, part.group.position.x, part.group.position.y, part.group.position.z);
        p.needsUpdate = true;
      }
    }
    orbit.autoRotate = spinning && stageVisible && !document.hidden;
    if (flight) advanceCamera(reduceMotion.matches ? 1 : THREE.MathUtils.clamp((now - flight.start) / flight.duration, 0, 1));
    orbit.update(step / 1000);
    const percent = `${Math.round(100 * fitDistance() / orbit.getDistance())} %`;
    if (zoomLevel.textContent !== percent) zoomLevel.textContent = percent;
    renderer.render(scene, camera);
    updateCallouts();
    if (flight || phase !== goal || wearPhase !== Number(worn) || spread !== fraction || orbit.autoRotate) schedule();
  }

  function schedule() { if (!frame && !failed) frame = requestAnimationFrame(draw); }

  function setSpin(on) {
    if (on === spinning) return;
    spinning = on;
    orbit.autoRotate = on && stageVisible && !document.hidden;
    spinButton.setAttribute('aria-pressed', String(on));
    spinButton.title = on ? 'Pausar giro' : 'Girar automáticamente';
    spinButton.querySelector('use').setAttribute('href', on ? '#icon-pause' : '#icon-spin');
    if (on) { flight = null; view = ''; updateButtonStates(); }
    schedule();
  }

  // ---------- Presentación (cinemática) ----------
  // Arranca solo con el botón. Cualquier toque en el visor la corta.
  let cine = null;
  const cineButton = $('#cine');
  const cineBox = $('#cine-texto');
  const PASOS = [
    { dir: V(118, 30, 150), t: 2300, armada: true, pieza: '', paso: 'Safe.Ride', titulo: 'Una pulsera, dos formas de leerla' },
    { dir: V(0, 7, 120), t: 2100, armada: true, pieza: 'qr', paso: 'Por fuera', titulo: 'El código QR, siempre visible' },
    { dir: V(-55, 100, -100), t: 2300, armada: false, pieza: 'chip', paso: 'Por dentro', titulo: 'El chip NFC, debajo del QR' },
    { dir: V(96, 44, -70), t: 2300, armada: false, pieza: '', paso: 'Pieza por pieza', titulo: 'TPU flexible, 216 mm, 8 a 10 g' },
    { dir: V(70, 57, 124), t: 2200, armada: true, pieza: '', paso: 'Lista', titulo: 'Se cierra con un perno a presión' },
  ];
  const ESPERA = 1500;
  function mostrarTexto(p, i) {
    if (!cineBox) return;
    cineBox.hidden = !p;
    if (!p) return;
    $('#cine-paso').textContent = `${String(i + 1).padStart(2, '0')} / ${String(PASOS.length).padStart(2, '0')} · ${p.paso}`;
    $('#cine-titulo').textContent = p.titulo;
    cineBox.style.setProperty('--avance', `${(i + 1) / PASOS.length}`);
    cineBox.classList.remove('entra'); void cineBox.offsetWidth; cineBox.classList.add('entra');
  }
  function pararCine() {
    if (!cine) return;
    clearTimeout(cine.timer); cine = null;
    mostrarTexto(null);
    stage.classList.remove('en-cine');
    cineButton?.setAttribute('aria-pressed', 'false');
    if (cineButton) cineButton.lastChild.textContent = ' Presentación';
  }
  function pasoCine(i) {
    if (!cine) return;
    if (i >= PASOS.length) { pararCine(); highlightPart(''); view = 'perspective'; updateButtonStates(); return; }
    const p = PASOS[i];
    cine.i = i;
    worn = false;
    if (exploded === p.armada) { exploded = !p.armada; labels = false; updateButtonStates(); }
    highlightPart(p.pieza);
    zoom = i === 0 ? 1.18 : 1;
    frameCamera(p.dir, reduceMotion.matches ? 0 : p.t);
    mostrarTexto(p, i);
    cine.timer = setTimeout(() => pasoCine(i + 1), (reduceMotion.matches ? 0 : p.t) + ESPERA);
  }
  function empezarCine() {
    setSpin(false);
    cine = { i: 0, timer: 0 };
    stage.classList.add('en-cine');
    cineButton?.setAttribute('aria-pressed', 'true');
    if (cineButton) cineButton.lastChild.textContent = ' Detener';
    if (worn) { worn = false; view = 'perspective'; }
    pasoCine(0);
  }
  cineButton?.addEventListener('click', () => (cine ? pararCine() : empezarCine()));
  $('#viewer').addEventListener('click', ev => {
    if (cine && ev.target.closest('button, a, input') && !ev.target.closest('#cine')) pararCine();
  }, true);
  canvas.addEventListener('pointerdown', () => pararCine());
  canvas.addEventListener('keydown', () => pararCine());

  orbit.addEventListener('start', () => { flight = null; cameraInput = true; setSpin(false); });
  orbit.addEventListener('end', () => { cameraInput = false; });
  orbit.addEventListener('change', () => {
    if (cameraInput && view) { view = ''; updateButtonStates(); }
    schedule();
  });

  const ray = new THREE.Raycaster();
  let down = null;
  canvas.addEventListener('pointerdown', ev => {
    down = ev.isPrimary && ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : null;
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerup', ev => {
    const start = down; down = null;
    if (!start || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(2 * (ev.clientX - rect.left) / width - 1, 1 - 2 * (ev.clientY - rect.top) / height), camera);
    const hit = ray.intersectObjects(Object.values(parts).map(part => part.group), true)[0];
    if (hit) selectPart(hit.object.userData.part);
  });
  canvas.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (key === '+' || key === '=') changeZoom(.82);
    else if (key === '-') changeZoom(1.22);
    else if (key === 'Home') applyView('perspective');
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      setSpin(false);
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
      spherical.theta += key === 'ArrowLeft' ? -.15 : key === 'ArrowRight' ? .15 : 0;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (key === 'ArrowUp' ? -.12 : key === 'ArrowDown' ? .12 : 0), orbit.minPolarAngle, orbit.maxPolarAngle);
      view = ''; zoom = spherical.radius / fitDistance();
      frameCamera(V(0, 0, 0).setFromSpherical(spherical)); updateButtonStates();
    } else return;
    event.preventDefault();
  });

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); failed = true;
    if (frame) cancelAnimationFrame(frame);
    orbit.dispose();
    showFallback();
  });
  explodeButton.addEventListener('click', () => setExploded(!exploded));
  spinButton.addEventListener('click', () => setSpin(!spinning));
  new IntersectionObserver(([entry]) => {
    stageVisible = entry.isIntersecting;
    if (!failed && spinning) schedule();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!failed && spinning) schedule(); });
  function updateSeparation() {
    const text = `${separation.value} %`;
    $('#separation-value').value = text;
    separation.setAttribute('aria-valuetext', text);
    schedule();
  }
  separation.addEventListener('input', updateSeparation);
  if (document.fullscreenEnabled && $('#viewer').requestFullscreen) {
    fullscreen.hidden = false;
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await $('#viewer').requestFullscreen();
      } catch (error) {
        console.warn('No se pudo cambiar a pantalla completa:', error);
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === $('#viewer');
      const name = active ? 'Salir de pantalla completa' : 'Pantalla completa';
      fullscreen.title = name;
      fullscreen.setAttribute('aria-label', name);
      fullscreen.querySelector('use').setAttribute('href', active ? '#icon-collapse' : '#icon-expand');
    });
  }
  labelButton.addEventListener('click', () => {
    zoom = camera.position.distanceTo(orbit.target) / fitDistance();
    labels = !labels; frameCamera(view ? angles[view] : null, 260); updateButtonStates(); schedule();
  });
  presets.forEach(button => button.addEventListener('click', () => applyView(button.dataset.view)));
  $('#zoom-out').addEventListener('click', () => changeZoom(1.22));
  $('#zoom-in').addEventListener('click', () => changeZoom(.82));
  $('#reset-camera').addEventListener('click', () => applyView('perspective'));
  new ResizeObserver(() => { if (!failed) resize(); }).observe(stage);
  reduceMotion.addEventListener('change', () => { orbit.enableDamping = !reduceMotion.matches; schedule(); });
  resize(); frameCamera(angles.perspective); updateButtonStates();
  if (new URLSearchParams(location.search).get('vista') === 'muneca') {
    applyView('worn'); wearPhase = 1; frameCamera(angles.worn);
  }
  return {
    showTourStep(step) {
      if (failed) return;
      if (step === 'chip') {
        separation.value = '100';
        updateSeparation();
        setExploded(true);
        labels = true;
      } else {
        setExploded(false);
        labels = false;
      }
      applyView('perspective');
    },
    selectionChanged() {
      if (failed) return;
      setSpin(false);
      if (internalParts.has(selectedPart) && !exploded) setExploded(true);
      updateButtonStates(); schedule();
    },
  };
}

function showFallback() {
  $('#model').hidden = $('#stage-hint').hidden = $('#callouts').hidden = $('#leaders').hidden = true;
  $('#fallback').hidden = false;
  $('#zoom-level').hidden = $('#separation-control').hidden = true;
  $('#assembly-state').textContent = 'VISTA ESTÁTICA';
  document.querySelectorAll('[data-requires-3d]').forEach(button => { button.disabled = true; });
}

const startReading = initNfcDemo(reduceMotion);
initTour({
  showModel(step) {
    highlightPart(step === 'chip' ? 'chip' : '');
    viewer?.showTourStep(step);
  },
  startReading,
});
try { viewer = createViewer(); }
catch (error) { showFallback(); console.warn('No se pudo iniciar el visor Safe.Ride:', error); }
