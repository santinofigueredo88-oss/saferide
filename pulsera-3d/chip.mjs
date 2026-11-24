// Usa los mismos datos públicos que el fragmento del QR, incluso en fichas anteriores.
export function textoDelChip(link) {
  const campos = new URLSearchParams(new URL(link).hash.slice(1));
  const etiquetas = { n: 'Nombre', g: 'Grupo', a: 'Alergias', cn: 'Contacto', ct: 'Tel.' };
  return Object.entries(etiquetas)
    .filter(([k]) => campos.get(k))
    .map(([k, etiqueta]) => etiqueta + ': ' + campos.get(k))
    .join('\n');
}

export function mensajeDelChip(link) {
  return { records: [
    { recordType: 'url', data: link },
    { recordType: 'text', lang: 'es', encoding: 'utf-8', data: textoDelChip(link) },
  ] };
}

export function medidaDelChip(link) {
  const bytes = s => new TextEncoder().encode(s).length;
  // NDEF URI (prefijo comprimido), texto UTF-8 con idioma «es» y envoltorio Type 2.
  const registro = n => n + (n < 256 ? 4 : 7);
  const uri = new URL(link).href.replace(/^https?:\/\//, '');
  const ndef = registro(1 + bytes(uri)) + registro(3 + bytes(textoDelChip(link)));
  const total = ndef + (ndef < 255 ? 3 : 5);
  const chip = total <= 144 ? 'NTAG213' : total <= 496 ? 'NTAG215' : total <= 872 ? 'NTAG216' : '';
  return chip ? `URL y texto: aprox. ${total} bytes. Usá un ${chip} o mayor.`
    : `URL y texto: aprox. ${total} bytes. Supera la capacidad de un NTAG216.`;
}

export async function grabarChip(link, boton) {
  const etiqueta = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Acercá la pulsera al celular…';
  try {
    await new NDEFReader().write(mensajeDelChip(link));
    boton.textContent = 'URL y texto grabados';
  } catch (e) {
    boton.textContent = e.name === 'NotAllowedError' ? 'Falta permiso de NFC' : 'Falló la grabación. Revisá el espacio y que el chip permita escritura.';
  } finally {
    setTimeout(() => { boton.disabled = false; boton.textContent = etiqueta; }, 4000);
  }
}
