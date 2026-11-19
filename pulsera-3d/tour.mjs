export function initTour({ showModel, startReading }) {
  const guide = document.querySelector('#tour-guide');
  const message = document.querySelector('#tour-message');
  const next = document.querySelector('#tour-next');
  const nextLabel = next.querySelector('span');
  const stepLinks = [...document.querySelectorAll('[data-tour-step]')];
  const steps = {
    bracelet: { target: '#visor', message: 'Paso 1 de 3 · Girá la pulsera para conocerla.', next: 'chip', label: 'Descubrir el chip' },
    chip: { target: '#visor', message: 'Paso 2 de 3 · La etiqueta NFC va justo debajo del QR, protegida por la tapa.', next: 'read', label: 'Simular una lectura' },
    read: { target: '#demo-nfc' },
  };

  document.querySelectorAll('[data-tour]').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const stepName = link.dataset.tour;
    const step = steps[stepName];
    event.preventDefault();
    for (const entry of stepLinks) {
      if (entry.dataset.tour === stepName) entry.setAttribute('aria-current', 'step');
      else entry.removeAttribute('aria-current');
    }

    const target = document.querySelector(step.target);
    if (stepName === 'read') {
      guide.hidden = true;
      startReading();
    } else {
      showModel(stepName);
      guide.hidden = false;
      message.textContent = step.message;
      next.href = steps[step.next].target;
      next.dataset.tour = step.next;
      nextLabel.textContent = step.label;
      document.querySelector('#viewer').focus({ preventScroll: true });
    }
    target.scrollIntoView({ block: 'start' });
  }));
}
