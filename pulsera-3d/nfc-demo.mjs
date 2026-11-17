export function initNfcDemo(reduceMotion) {
  const section = document.querySelector('#demo-nfc');
  const trigger = section.querySelector('#nfc-trigger');
  const label = trigger.querySelector('span');
  const wait = section.querySelector('#nfc-wait');
  const result = section.querySelector('#nfc-result');
  const title = section.querySelector('#nfc-status-title');
  const copy = section.querySelector('#nfc-status-copy');
  const steps = [...section.querySelectorAll('[data-nfc-step]')];

  function render(state) {
    section.dataset.nfcState = state;
    wait.hidden = state === 'done';
    result.hidden = state !== 'done';
    const busy = state === 'approach' || state === 'read';
    trigger.setAttribute('aria-disabled', String(busy));
    label.textContent = state === 'done' ? 'Repetir lectura' : busy ? 'Lectura en curso' : 'Acercar el celular';
    title.textContent = state === 'read' ? 'Chip detectado' : state === 'approach' ? 'Acercando el celular…' : 'Listo para leer';
    copy.textContent = state === 'read' ? 'Leyendo los datos guardados en el chip.' : 'Acercá el celular al módulo de la pulsera.';
    const current = steps.findIndex(step => step.dataset.nfcStep === state);
    steps.forEach((step, index) => {
      step.dataset.complete = String(index < current || state === 'done');
      if (index === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  }

  const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  async function play() {
    if (trigger.getAttribute('aria-disabled') === 'true') return;
    render('approach');
    if (reduceMotion.matches) { render('done'); return; }
    await delay(650);
    render('read');
    await delay(780);
    render('done');
  }

  trigger.addEventListener('click', play);
  return function startReading() {
    trigger.focus({ preventScroll: true });
    return play();
  };
}
