import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initNfcDemo } from './nfc-demo.mjs';
import { initTour } from './tour.mjs';

const $ = (selector) => document.querySelector(selector);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const svgNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const internalParts = new Set(['chip', 'film']);

// The SCAD integrates the module into the band. We separate them, and show an
// optional pin closure, for the conceptual assembly (not a print-ready CAD).
const definitions = {
  band: { name: 'Correa de TPU', short: 'Correa TPU', type: '01 / CUERPO FLEXIBLE', copy: 'Banda curva impresa en TPU. Los siete orificios de una punta permiten regular el ajuste.', side: 'left', offset: [-7, -4, -10], anchor: [-24, 4, 16] },
  housing: { name: 'Carcasa central', short: 'Carcasa', type: '02 / ALOJAMIENTO', copy: 'Una sola cavidad aloja las capas del módulo y las mantiene alineadas sobre la correa.', side: 'left', offset: [-8, -8, 13], anchor: [0, -4, 5] },
  qr: { name: 'Placa QR', short: 'Placa QR', type: '03 / CAPA EXTERIOR', copy: 'Cuadrado visible en el frente. La cámara lo lee para abrir la ficha web. Para usar NFC, acercá el celular a este mismo punto.', side: 'left', offset: [-10, 18, 33], anchor: [0, 0, 1] },
  chip: { name: 'Chip y antena NFC', short: 'Chip NFC', type: '04 / DEBAJO DEL QR', copy: 'Pieza cuadrada más chica, centrada debajo del QR. La antena rodea al chip y permite leer los datos esenciales sin internet con un dispositivo compatible.', side: 'right', offset: [19, -9, 26], anchor: [0, 0, 1] },
  film: { name: 'Lámina protectora', short: 'Protección', type: '05 / CAPA INTERMEDIA', copy: 'Lámina no metálica situada entre el QR y el NFC. Se muestra como una pieza independiente para que se entienda cómo se arman las capas.', side: 'right', offset: [15, 14, 30], anchor: [0, 0, .25] },
  clasp: { name: 'Cierre de ajuste', short: 'Cierre', type: '06 / PROPUESTA DE CIERRE', copy: 'Dos pernos a presión se encastran en los orificios de la otra punta. El modelo CAD del repositorio propone este cierre como una opción.', side: 'right', offset: [16, -1, -6], anchor: [1, 0, 0] },
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
  const positions = [], resultNormals = [], uv = [];
  const vertex = i => [first.getX(i), first.getY(i), first.getZ(i) - .9, normals.getX(i), normals.getY(i), normals.getZ(i)];
  function push([s, y, d, ns, ny, nd]) {
    const sin = Math.sin(s / radius), cos = Math.cos(s / radius);
    positions.push((radius + d) * sin, y, (radius + d) * cos);
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
  const finish = material(0x285645, .67, .02);
  finish.bumpMap = texture;
  finish.bumpScale = .085;
  finish.sheen = .26;
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
  for (let i = 0; i < position.count; i++) {
    const angle = 1.23 + position.getX(i) / 30.7;
    position.setXYZ(i, 32.20 * Math.sin(angle), position.getY(i) - .6, 32.20 * Math.cos(angle));
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .4, roughness: .76 }));
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
  band.add(new THREE.Mesh(bandGeometry(), bandFinish()), wordmark());

  const housing = part('housing', 0, 0, 29.6);
  const backing = plate(roundedRect(23.8, 16.4, 4.8), 1.05, .59, material(0x24483c, .72));
  housing.add(backing);
  const face = roundedRect(24, 17, 5.2);
  face.holes.push(roundedRect(11.65, 11.65, 1.04));
  const shellFinish = material(0x194436, .36, .07);
  shellFinish.clearcoat = .32;
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
  const copper = material(0xf4ad5d, .31, .44);
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
  const filmFinish = material(0xafe1d3, .32, 0);
  filmFinish.transparent = true;
  filmFinish.opacity = .66;
  filmFinish.depthWrite = false;
  film.add(plate(roundedRect(9.4, 9.4, .78), .23, .14, filmFinish));

  // The optional fastening sits on the end opposite the adjustment holes.
  const angle = -145 * Math.PI / 180;
  const clasp = part('clasp', 31.1 * Math.sin(angle), 0, 31.1 * Math.cos(angle));
  clasp.rotation.y = angle;
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
  scene.environment = pmrem.fromScene(room, .045).texture;
  scene.environmentIntensity = .72;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf4f8f4, 0x778e7f, 1.1));
  for (const [color, intensity, position] of [[0xfff7e6, 2.75, [-48, 92, 88]], [0xc1f0e0, 2.1, [10, 65, -78]], [0xdbedff, .8, [80, 16, 51]]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light);
  }
  const shadow = graphicTexture(128, (ctx, size) => {
    const shade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    shade.addColorStop(0, '#233b2eb8'); shade.addColorStop(.48, '#35534375'); shade.addColorStop(.77, '#43625229'); shade.addColorStop(1, '#43625200');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, size, size);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 85), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: .55, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(2, -15, 4); scene.add(floor);
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
  orbit.minPolarAngle = .035;
  orbit.maxPolarAngle = Math.PI - .035;
  orbit.minDistance = 50;
  orbit.maxDistance = 380;

  const parts = makeModel(scene);
  lightModel(scene, renderer);
  const shell = $('#callouts');
  const leaders = $('#leaders');
  const explodeButton = $('#explode');
  const labelButton = $('#toggle-labels');
  const separation = $('#separation');
  const fullscreen = $('#fullscreen');
  const presets = [...document.querySelectorAll('[data-view]')];
  const angles = { perspective: V(70, 57, 124), front: V(0, 7, 120), inside: V(-55, 100, -100) };
  let view = 'perspective', exploded = false, labels = false, phase = 0, zoom = 1;
  let width = 1, height = 1, frame = 0, previousTime = 0, failed = false, cameraInput = false;
  const world = V(0, 0, 0);

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
    stage.dataset.mode = exploded ? 'exploded' : 'assembled';
    $('#assembly-state').textContent = exploded ? 'Vista desarmada' : 'Armada';
    explodeButton.lastChild.textContent = exploded ? ' Volver a armar' : ' Desarmar';
    explodeButton.setAttribute('aria-pressed', String(exploded));
    labelButton.setAttribute('aria-pressed', String(labels));
    $('#separation-control').hidden = !exploded;
    shell.hidden = !labels;
    presets.forEach(button => button.setAttribute('aria-pressed', String(view === button.dataset.view)));
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
    const fitAspect = exploded && labels ? (width <= 485 ? 1.68 : 1.15) : 1.16;
    const scale = Math.max(1, fitAspect / camera.aspect);
    return (exploded ? 127 : 99) * scale;
  }

  function frameCamera(direction) {
    const oldDirection = camera.position.clone().sub(orbit.target).normalize();
    orbit.target.set(exploded ? 0 : 1, exploded ? -5 : -4, exploded ? 21 : 8);
    const distance = fitDistance() * zoom;
    orbit.minDistance = fitDistance() * .50;
    orbit.maxDistance = fitDistance() * 2.3;
    camera.position.copy(direction || oldDirection).normalize().multiplyScalar(distance).add(orbit.target);
    orbit.update(); schedule();
  }

  function applyView(name) {
    view = name;
    zoom = 1;
    frameCamera(angles[name]);
    updateButtonStates();
  }

  function setExploded(on) {
    if (exploded === on) return;
    exploded = on;
    labels = on;
    zoom = 1;
    if (!on && internalParts.has(selectedPart)) selectPart(selectedPart);
    frameCamera();
    updateButtonStates(); schedule();
  }

  function changeZoom(factor) {
    zoom = THREE.MathUtils.clamp(camera.position.distanceTo(orbit.target) / fitDistance() * factor, .50, 2.3);
    frameCamera();
  }

  function resize() {
    const size = stage.getBoundingClientRect();
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
    if (width <= 485) {
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
    const goal = exploded ? separation.valueAsNumber / 100 : 0;
    phase = reduceMotion.matches ? goal : THREE.MathUtils.lerp(phase, goal, 1 - Math.exp(-step / 100));
    if (Math.abs(phase - goal) < .002) phase = goal;
    for (const part of Object.values(parts)) {
      part.group.position.copy(part.position).addScaledVector(part.offset, phase);
      part.guide.visible = phase > .05;
      if (part.guide.visible) {
        const p = part.guide.geometry.attributes.position;
        p.setXYZ(0, part.position.x, part.position.y, part.position.z);
        p.setXYZ(1, part.group.position.x, part.group.position.y, part.group.position.z);
        p.needsUpdate = true;
      }
    }
    orbit.update();
    renderer.render(scene, camera);
    updateCallouts();
    if (phase !== goal) schedule();
  }

  function schedule() { if (!frame && !failed) frame = requestAnimationFrame(draw); }

  orbit.addEventListener('start', () => { cameraInput = true; });
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
    labels = !labels; frameCamera(); updateButtonStates(); schedule();
  });
  presets.forEach(button => button.addEventListener('click', () => applyView(button.dataset.view)));
  $('#zoom-out').addEventListener('click', () => changeZoom(1.22));
  $('#zoom-in').addEventListener('click', () => changeZoom(.82));
  $('#reset-camera').addEventListener('click', () => applyView('perspective'));
  new ResizeObserver(() => { if (!failed) resize(); }).observe(stage);
  reduceMotion.addEventListener('change', () => { orbit.enableDamping = !reduceMotion.matches; schedule(); });
  resize(); applyView('perspective');
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
      if (internalParts.has(selectedPart) && !exploded) setExploded(true);
      updateButtonStates(); schedule();
    },
  };
}

function showFallback() {
  $('#model').hidden = $('#stage-hint').hidden = $('#callouts').hidden = $('#leaders').hidden = true;
  $('#fallback').hidden = false;
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
