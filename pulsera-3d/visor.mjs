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
const internalParts = new Set(['chip', 'film']);
const labelRowsMaxWidth = 560;
const claspAngle = THREE.MathUtils.degToRad(-145);

// The SCAD integrates the module into the band. We separate them, and show an
// optional pin closure, for the conceptual assembly (not a print-ready CAD).
const definitions = {
  band: { name: 'Correa de TPU', short: 'Correa TPU', type: '01 / CUERPO FLEXIBLE', copy: 'Banda curva impresa en TPU. En un costado lleva impresos el grupo sanguíneo, las alergias y un teléfono de emergencia, para que cualquiera los lea sin celular ni internet. Los siete orificios permiten regular el ajuste.', side: 'left', offset: [-8, 8, -9], anchor: [-24, 4, 16] },
  housing: { name: 'Carcasa central', short: 'Carcasa', type: '02 / ALOJAMIENTO', copy: 'Una sola cavidad aloja las capas del módulo y las mantiene alineadas sobre la correa.', side: 'left', offset: [-14, -14, 12], anchor: [-7.2, -4, 4.5] },
  qr: { name: 'Placa QR', short: 'Placa QR', type: '03 / CAPA EXTERIOR', copy: 'Cuadrado visible en el frente. La cámara lo lee para abrir la ficha web. Para usar NFC, acercá el celular a este mismo punto.', side: 'left', offset: [-13, 19, 30], anchor: [-4.6, 0, .75] },
  chip: { name: 'Chip y antena NFC', short: 'Chip NFC', type: '04 / DEBAJO DEL QR', copy: 'Pieza cuadrada más chica, centrada debajo del QR. La antena rodea al chip y permite leer los datos esenciales sin internet con un dispositivo compatible.', side: 'right', offset: [20, -7, 25], anchor: [0, 0, 1] },
  film: { name: 'Lámina protectora', short: 'Protección', type: '05 / CAPA INTERMEDIA', copy: 'Lámina no metálica situada entre el QR y el NFC. Se muestra como una pieza independiente para que se entienda cómo se arman las capas.', side: 'right', offset: [30, 7, 17], anchor: [0, 0, .25] },
  clasp: { name: 'Cierre de ajuste', short: 'Cierre', type: '06 / PROPUESTA DE CIERRE', copy: 'Dos pernos a presión se encastran en los orificios de la otra punta. El modelo CAD del repositorio propone este cierre como una opción.', side: 'right', offset: [21, 28, -3], anchor: [0, 0, 1.53] },
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

// Sección de la muñeca en y=0: radios 27 × 24 y centro z=3. Se deja espacio
// para el espesor del TPU y se solapan las puntas por el lado de la palma.
const wornSweep = 388 / 300;
const wristX = 29.7, wristZ = 25.9, wristCenter = 3;
function wornPoint(angle, depth, y) {
  const a = angle * wornSweep;
  const overlap = 2.85 * THREE.MathUtils.smoothstep(a, 2.65, 2.92);
  return [(wristX + depth + overlap) * Math.sin(a), y, wristCenter + (wristZ + depth + overlap) * Math.cos(a)];
}

// Bend an extruded strip into a bracelet. Subdivide its planar faces first so
// no triangle cuts straight through the wrist opening; preserve edge normals.
function bandGeometry() {
  const radius = 30.7;
  const length = radius * Math.PI * 300 / 180;
  const shape = roundedRect(length, 14.8, 3.2);
  for (let i = 0; i < 7; i++) shape.holes.push(circleHole(length / 2 - 7 - i * 4, 0, 1.48));
  const strip = plate(shape, 1.8, .56, null).geometry;
  const first = strip.getAttribute('position');
  const normals = strip.getAttribute('normal');
  const positions = [], fitted = [], fittedNormals = [], resultNormals = [], uv = [];
  const vertex = i => [first.getX(i), first.getY(i), first.getZ(i) - .9, normals.getX(i), normals.getY(i), normals.getZ(i)];
  function push([s, y, d, ns, ny, nd]) {
    const sin = Math.sin(s / radius), cos = Math.cos(s / radius);
    positions.push((radius + d) * sin, y, (radius + d) * cos);
    fitted.push(...wornPoint(s / radius, d, y));
    const a = s / radius * wornSweep, sn = Math.sin(a), cs = Math.cos(a);
    const fx = (ns * cs + nd * sn) / (wristX / radius), fz = (-ns * sn + nd * cs) / (wristZ / radius);
    const norm = Math.hypot(fx,ny,fz) || 1;
    fittedNormals.push(fx/norm,ny/norm,fz/norm);
    uv.push(s / length + .5, y / 16 + .5);
    const nx = ns * cos + nd * sin, nz = -ns * sin + nd * cos;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    resultNormals.push(nx / normalLength, ny / normalLength, nz / normalLength);
  }
  function triangle(a, b, c) {
    const ab = Math.abs(a[0] - b[0]), bc = Math.abs(b[0] - c[0]), ca = Math.abs(c[0] - a[0]);
    if (Math.max(ab, bc, ca) <= 2.3) { push(a); push(b); push(c); return; }
    if (bc > ab && bc >= ca) [a, b, c] = [b, c, a];
    else if (ca > ab) [a, b, c] = [c, a, b];
    const mid = a.map((value, i) => (value + b[i]) * .5);
    triangle(a, mid, c); triangle(mid, b, c);
  }
  for (let i = 0; i < first.count; i += 3) triangle(vertex(i), vertex(i + 1), vertex(i + 2));
  strip.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultNormals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(fitted,3)];
  geometry.morphAttributes.normal = [new THREE.Float32BufferAttribute(fittedNormals,3)];
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
  const geometry = new THREE.PlaneGeometry(23, 13, 30, 1);
  const position = geometry.getAttribute('position');
  const fitted = [];
  for (let i = 0; i < position.count; i++) {
    const angle = 1.23 + position.getX(i) / 30.7;
    fitted.push(...wornPoint(angle,1.54,position.getY(i)-.6));
    position.setXYZ(i, 32.20 * Math.sin(angle), position.getY(i) - .6, 32.20 * Math.cos(angle));
  }
  geometry.computeVertexNormals();
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(fitted,3)];
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
  const geometry = new THREE.PlaneGeometry(23, 13, 30, 1);
  const position = geometry.getAttribute('position');
  const fitted = [];
  for (let i = 0; i < position.count; i++) {
    const angle = -1.23 + position.getX(i) / 30.7;
    fitted.push(...wornPoint(angle,1.54,position.getY(i)-.6));
    position.setXYZ(i, 32.20 * Math.sin(angle), position.getY(i) - .6, 32.20 * Math.cos(angle));
  }
  geometry.computeVertexNormals();
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(fitted,3)];
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

  const housing = part('housing', 0, 0, 29.6);
  const backing = plate(roundedRect(23.8, 16.4, 4.8), 1.05, .59, material(0x24483c, .72));
  housing.add(backing);
  const face = roundedRect(24, 17, 5.2);
  face.holes.push(roundedRect(11.65, 11.65, 1.04));
  const shellFinish = material(0x194436, .42, .07);
  shellFinish.clearcoat = .22;
  shellFinish.clearcoatRoughness = .46;
  const rim = plate(face, 2.85, .47, shellFinish);
  rim.position.z = 1.18; housing.add(rim);

  // The four front-module parts share one axis: QR, film, NFC, housing.
  const qr = part('qr', 0, 0, 33.7);
  qr.add(plate(roundedRect(10.95, 10.95, .83), .55, .19, material(0xf0f2e7, .48, .01)));
  const qrDecal = new THREE.Mesh(new THREE.PlaneGeometry(10.57, 10.57), new THREE.MeshStandardMaterial({ map: qrGraphic(), roughness: .65 }));
  qrDecal.position.z = .749; qr.add(qrDecal);

  const chip = part('chip', 0, 0, 31.8);
  chip.add(plate(roundedRect(8.1, 8.1, .68), .42, .11, material(0x273d30, .62, .04)));
  const copper = material(0xe79b59, .28, .74);
  for (let i = 0; i < 4; i++) {
    const size = 7.38 - i * .64;
    const line = roundedRect(size, size, .53);
    line.holes.push(roundedRect(size - .27, size - .27, .43));
    const track = plate(line, .035, 0, copper);
    track.position.z = .55; chip.add(track);
  }
  const die = plate(roundedRect(2.15, 2.15, .22), .33, .11, material(0x232e29, .48));
  die.position.z = .55; chip.add(die);
  for (const x of [-1.42, 1.42]) for (const y of [-.48, .48]) {
    const contact = plate(roundedRect(.35, .23, .07), .08, .02, copper);
    contact.position.set(x, y, .58); chip.add(contact);
  }

  const film = part('film', 0, 0, 33.03);
  const filmFinish = material(0xafe1d3, .42, 0);
  filmFinish.transparent = true;
  filmFinish.opacity = .75;
  filmFinish.depthWrite = false;
  film.add(plate(roundedRect(9.4, 9.4, .78), .23, .14, filmFinish));

  // The optional fastening sits on the end opposite the adjustment holes.
  const clasp = part('clasp', 31.1 * Math.sin(claspAngle), 0, 31.1 * Math.cos(claspAngle));
  clasp.rotation.y = claspAngle;
  const base = plate(roundedRect(10.8, 12.4, 3.3), 1, .53, material(0x5b796d, .34, .25));
  clasp.add(base);
  for (const x of [-2.8, 2.8]) {
    const pin = disk(1.18, 1.75, material(0x86a597, .29, .36)); pin.position.set(x, 0, 1.8); clasp.add(pin);
    const head = disk(1.84, .68, material(0xa4bcb0, .31, .48)); head.position.set(x, 0, 2.65); clasp.add(head);
  }

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
  }
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
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
  const shell = $('#callouts');
  const leaders = $('#leaders');
  const explodeButton = $('#explode');
  const labelButton = $('#toggle-labels');
  const spinButton = $('#spin');
  const separation = $('#separation');
  const fullscreen = $('#fullscreen');
  const presets = [...document.querySelectorAll('[data-view]')];
  const angles = { perspective: V(70, 57, 124), front: V(0, 7, 120), inside: V(-55, 100, -100), worn: V(8,20,160) };
  const claspWorn = V(...wornPoint(claspAngle,.7,0));
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
    if (!exploded) return 99 * Math.max(1, 1.16 / camera.aspect);
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
    flight = { from, to, origin: orbit.target.clone(), target: worn ? V(8,4,1) : exploded ? V(-3,-3,12) : V(1,-4,8), start: performance.now(), duration };
    if (!duration || reduceMotion.matches) advanceCamera(1);
    schedule();
  }

  function advanceCamera(t) {
    const { from, to, origin, target } = flight;
    const mix = 1 - (1 - t) ** 3;
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
    for (const mesh of parts.band.group.children) mesh.morphTargetInfluences[0] = wearPhase;
    parts.clasp.group.rotation.y = THREE.MathUtils.lerp(claspAngle, .35, phase * spread) + (claspAngle*wornSweep-claspAngle)*wearPhase;
    floor.visible = phase < .5 && wearPhase < .01;
    floor.material.opacity = .55 * Math.max(0, 1 - 2 * phase);
    for (const [id, part] of Object.entries(parts)) {
      // The external plate lifts first; the film and then the chip follow it out.
      const delay = id === 'chip' ? .34 : id === 'film' ? .17 : 0;
      const layer = THREE.MathUtils.smoothstep(phase, delay, 1) * spread;
      part.group.position.copy(part.position).addScaledVector(part.offset, layer);
      if (id === 'clasp') part.group.position.lerp(claspWorn,wearPhase);
      else if (id !== 'band') part.group.position.z += (wristCenter + wristZ - 30.7) * wearPhase;
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
