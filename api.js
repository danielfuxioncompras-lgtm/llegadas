// Conexión con la API de Apps Script.
// Se envía como text/plain para que el navegador no bloquee la llamada (CORS).
function apiConfigurada() {
  return typeof window.API_URL === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(window.API_URL.trim());
}

async function api(accion, datos = {}) {
  if (!apiConfigurada()) throw new Error('Falta configurar la URL de la API en config.js');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(window.API_URL.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ accion }, datos)),
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder');
    if (e instanceof TypeError) throw new Error('Sin conexión con el servidor');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Envío "de último momento" cuando la página se oculta o se cierra.
function apiBeacon(accion, datos = {}) {
  if (!apiConfigurada() || !navigator.sendBeacon) return false;
  try {
    const blob = new Blob([JSON.stringify(Object.assign({ accion }, datos))], { type: 'text/plain;charset=utf-8' });
    return navigator.sendBeacon(window.API_URL.trim(), blob);
  } catch (e) { return false; }
}
