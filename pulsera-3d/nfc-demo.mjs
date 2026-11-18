export function initNfcDemo(reduceMotion) {
  const section = document.querySelector('#demo-nfc');
  const get = s => section.querySelector(s);
  const boton = get('#nfc-trigger'), rango = get('#nfc-posicion'), mano = get('.mano-lectora');
  const pasos = [...section.querySelectorAll('[data-nfc-step]')];
  const umbral = 89; // Posición en esta ilustración, no una distancia del hardware.
  let estado, cuadro = 0, lectura = 0;
  const mensajes = {
    idle: ['Listo para leer', 'La antena está activa. Acercá el dorso del celular a la pulsera.'],
    approach: ['Buscando la etiqueta…', 'Acercalo un poco más al cuadrado del QR.'],
    read: ['Leyendo el chip…', 'Mantené el celular en esa posición.'],
    lost: ['Se perdió el contacto', 'La lectura quedó incompleta. Volvé a acercar el celular.'],
  };

  function mostrar(siguiente) {
    if (estado === siguiente) return;
    estado = section.dataset.nfcState = siguiente;
    get('#nfc-wait').hidden = !mensajes[estado];
    get('#nfc-aviso').hidden = estado !== 'notice';
    get('#nfc-result').hidden = estado !== 'done';
    get('#nfc-barra').textContent = estado === 'done' ? 'Safe.Ride' : 'NFC activado';
    get('#nfc-anuncio').textContent = estado === 'notice' ? 'Etiqueta leída. Ya podés abrir la ficha sin internet.' : '';
    if (mensajes[estado]) {
      get('#nfc-status-title').textContent = mensajes[estado][0];
      get('#nfc-status-copy').textContent = mensajes[estado][1];
    }
    boton.querySelector('span').textContent = estado === 'notice' ? 'Abrir la ficha' : estado === 'done' ? 'Repetir lectura' : estado === 'read' ? 'Retirar el celular' : 'Acercar el celular';
    boton.querySelector('svg:last-child use').setAttribute('href', estado === 'done' ? '#icon-reset' : '#icon-arrow');
    const actual = estado === 'read' ? 1 : ['notice','done'].includes(estado) ? 2 : estado === 'idle' ? -1 : 0;
    pasos.forEach((paso,i) => {
      paso.dataset.complete = String(i < actual || estado === 'done');
      if (i === actual) paso.setAttribute('aria-current','step'); else paso.removeAttribute('aria-current');
    });
  }

  function colocar(valor) {
    rango.value = valor;
    const f = rango.valueAsNumber / 100;
    mano.setAttribute('transform', `translate(${-30*f} ${38*f})`);
    const zona = valor >= umbral ? 'Sobre el chip' : valor > 48 ? 'Cerca' : 'Lejos';
    if (rango.getAttribute('aria-valuetext') !== zona) {
      rango.setAttribute('aria-valuetext',zona);
      get('#nfc-zona').textContent = zona;
    }
    // Una etiqueta ya recibida sigue disponible aunque se retire el celular.
    if (estado === 'done' || estado === 'notice') return;
    if (valor >= umbral) {
      if (estado !== 'read') {
        mostrar('read');
        lectura = window.setTimeout(() => { lectura = 0; mostrar('notice'); }, 850);
      }
    } else {
      clearTimeout(lectura); lectura = 0;
      if (estado === 'read' || estado === 'lost') mostrar('lost');
      else mostrar(valor ? 'approach' : 'idle');
    }
  }

  function detener() { cancelAnimationFrame(cuadro); cuadro = 0; }
  function acercar() {
    detener();
    if (estado === 'notice' || estado === 'done') { mostrar('idle'); colocar(0); }
    if (reduceMotion.matches) { colocar(100); return; }
    const desde = rango.valueAsNumber, inicio = performance.now();
    function avanzar(t) {
      const avance = Math.min(1, Math.max(0,(t-inicio)/830));
      colocar(Math.round(desde+(100-desde)*avance*avance*(3-2*avance)));
      cuadro = avance < 1 ? requestAnimationFrame(avanzar) : 0;
    }
    cuadro = requestAnimationFrame(avanzar);
  }
  function abrir() {
    if (estado !== 'notice') return;
    mostrar('done'); get('#nfc-result h3').focus();
  }
  rango.addEventListener('pointerdown', detener);
  rango.addEventListener('input', () => { detener(); colocar(rango.valueAsNumber); });
  get('#nfc-abrir').addEventListener('click', abrir);
  boton.addEventListener('click', () => {
    if (estado === 'notice') abrir();
    else if (estado === 'read') { detener(); colocar(0); }
    else acercar();
  });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches && cuadro) { detener(); colocar(100); } });
  mostrar('idle'); colocar(0);
  return () => { boton.focus({preventScroll:true}); acercar(); };
}
