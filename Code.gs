/**
 * LLEGADAS · API de seguimiento de proveedores
 * Google Apps Script + Google Sheets como base de datos.
 *
 * La página web (GitHub Pages) llama a esta API con POST (JSON como text/plain).
 * Hojas: Viajes (un registro por viaje), Ubicaciones (historial), Config (parámetros).
 */

const VERSION_API = 2;
const HOJA_VIAJES = 'Viajes';
const HOJA_UBIC = 'Ubicaciones';
const HOJA_CONFIG = 'Config';

const COLS = [
  'ID', 'Registrado', 'Proveedor', 'RUC', 'Conductor', 'Telefono', 'Placa', 'Guia_OC', 'Carga',
  'Pallets', 'Peso_kg', 'Volumen_m3',
  'Estado', 'Lat', 'Lng', 'Precision_m', 'Velocidad_kmh', 'Ultima_actualizacion',
  'Distancia_km', 'ETA_min', 'Llegada_estimada', 'Llegada_real', 'Fuente_ETA',
  'Notas', 'Token'
];
const C = COLS.reduce((o, n, i) => (o[n] = i + 1, o), {});

const ESTADOS = ['En ruta', 'Llegando', 'En patio', 'Descargando', 'Finalizado', 'Cancelado'];
const ESTADOS_EN_CAMINO = ['En ruta', 'Llegando'];
const ESTADOS_CERRADOS = ['Finalizado', 'Cancelado'];

const CONFIG_DEFAULT = [
  ['ALMACEN_NOMBRE', 'Almacén Central', 'Nombre que ve el proveedor'],
  ['ALMACEN_LAT', -12.0464, 'Latitud de la puerta del patio (clic derecho en Google Maps para copiarla)'],
  ['ALMACEN_LNG', -77.0428, 'Longitud de la puerta del patio'],
  ['RADIO_LLEGADA_M', 150, 'A esta distancia (metros) el viaje pasa solo a "En patio"'],
  ['VELOCIDAD_PROMEDIO_KMH', 28, 'Velocidad promedio real de tus proveedores (para el ETA estimado)'],
  ['FACTOR_RUTA', 1.35, 'Convierte distancia en línea recta a distancia por pista'],
  ['USAR_GOOGLE_MAPS', 'FALSE', 'TRUE = ETA con rutas y tráfico de Google Maps (cuota diaria limitada)'],
  ['MINUTOS_CACHE_MAPS', 5, 'Cada cuántos minutos se vuelve a consultar Maps por viaje'],
  ['MINUTOS_LLEGANDO', 15, 'Con ETA menor a esto el viaje se marca "Llegando"'],
  ['MINUTOS_SIN_SENAL', 5, 'Sin actualizaciones por más de esto, el panel avisa "sin señal"'],
  ['INTERVALO_ENVIO_SEG', 30, 'Cada cuántos segundos el celular envía su ubicación'],
  ['GUARDAR_HISTORIAL', 'TRUE', 'TRUE = guarda cada posición en la hoja Ubicaciones'],
  ['PANEL_CLAVE', 'cambiar-esta-clave', 'Clave para entrar al panel del almacén'],
  ['WHATSAPP_NUMERO', '', 'WhatsApp del almacén con código de país, sin + ni espacios. Ej. 51987654321. Vacío = no se muestra el botón']
];

/* ───────────────────────── Menú y configuración ───────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Llegadas')
    .addItem('Configurar hojas', 'setup')
    .addItem('Ver URL de la API', 'mostrarUrlApi')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  const encabezado = (sh, cols) => sh.getRange(1, 1, 1, cols.length).setValues([cols])
    .setFontWeight('bold').setBackground('#1E2A32').setFontColor('#FFFFFF');

  const v = ss.getSheetByName(HOJA_VIAJES) || ss.insertSheet(HOJA_VIAJES);
  encabezado(v, COLS);
  v.setFrozenRows(1);
  v.getRange(2, C.Estado, v.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  ['Registrado', 'Ultima_actualizacion', 'Llegada_estimada', 'Llegada_real'].forEach(n =>
    v.getRange(2, C[n], v.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm'));
  v.hideColumns(C.Token);

  const u = ss.getSheetByName(HOJA_UBIC) || ss.insertSheet(HOJA_UBIC);
  encabezado(u, ['ID', 'Fecha', 'Lat', 'Lng', 'Precision_m', 'Velocidad_kmh', 'Distancia_km']);
  u.setFrozenRows(1);
  u.getRange(2, 2, u.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');

  let c = ss.getSheetByName(HOJA_CONFIG);
  if (!c) {
    c = ss.insertSheet(HOJA_CONFIG);
    c.getRange(1, 1, 1, 3).setValues([['Clave', 'Valor', 'Descripción']]).setFontWeight('bold');
    c.getRange(2, 1, CONFIG_DEFAULT.length, 3).setValues(CONFIG_DEFAULT);
    c.setColumnWidth(1, 200); c.setColumnWidth(2, 180); c.setColumnWidth(3, 480);
  } else {
    const existentes = c.getRange(1, 1, c.getLastRow(), 1).getValues().flat().map(String);
    CONFIG_DEFAULT.filter(r => !existentes.includes(r[0])).forEach(r => c.appendRow(r));
  }
  const hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);
  CacheService.getScriptCache().remove('config');
}

function mostrarUrlApi() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url
    ? 'URL de la API (pégala en config.js):\n\n' + url
    : 'Aún no implementas la aplicación web. Ve a Implementar > Nueva implementación > Aplicación web.');
}

function getConfig_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('config');
  if (hit) return JSON.parse(hit);
  const cfg = {};
  hoja_(HOJA_CONFIG).getDataRange().getValues().slice(1)
    .forEach(([k, val]) => { if (k) cfg[String(k).trim()] = val; });
  cache.put('config', JSON.stringify(cfg), 60);
  return cfg;
}

function configPublica_() {
  const cfg = getConfig_();
  return {
    almacen: String(cfg.ALMACEN_NOMBRE || 'Almacén'),
    intervaloSeg: Math.max(10, Number(cfg.INTERVALO_ENVIO_SEG) || 30),
    whatsapp: String(cfg.WHATSAPP_NUMERO || '').replace(/\D/g, ''),
    version: VERSION_API
  };
}

/* ───────────────────────── Entrada de la API ───────────────────────── */

function doGet(e) {
  const accion = e && e.parameter && e.parameter.accion;
  if (accion === 'config') return json_({ ok: true, data: configPublica_() });
  return json_({ ok: true, data: { servicio: 'llegadas', version: VERSION_API, hora: new Date().toISOString() } });
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Solicitud inválida' }); }

  const acciones = {
    config:       () => configPublica_(),
    iniciarViaje: () => iniciarViaje_(b.datos),
    ubicacion:    () => actualizarUbicacion_(b.id, b.token, b.pos),
    viaje:        () => obtenerViaje_(b.id, b.token),
    llegada:      () => marcarLlegada_(b.id, b.token),
    cancelar:     () => cancelarViaje_(b.id, b.token),
    panel:        () => obtenerPanel_(b.clave),
    estado:       () => cambiarEstado_(b.clave, b.id, b.estado)
  };
  const fn = acciones[b.accion];
  if (!fn) return json_({ ok: false, error: 'Acción desconocida' });
  try { return json_({ ok: true, data: fn() }); }
  catch (err) { return json_({ ok: false, error: String((err && err.message) || err) }); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────────────── Acciones del proveedor ───────────────────────── */

function iniciarViaje_(d) {
  d = d || {};
  [['proveedor', 'empresa'], ['conductor', 'conductor'], ['placa', 'placa']].forEach(([k, n]) => {
    if (!String(d[k] || '').trim()) throw new Error('Falta completar: ' + n);
  });
  const fila = new Array(COLS.length).fill('');
  fila[C.ID - 1] = generarId_();
  fila[C.Registrado - 1] = new Date();
  fila[C.Proveedor - 1] = limpiar_(d.proveedor, 120);
  fila[C.RUC - 1] = limpiar_(d.ruc, 20);
  fila[C.Conductor - 1] = limpiar_(d.conductor, 120);
  fila[C.Telefono - 1] = limpiar_(d.telefono, 30);
  fila[C.Placa - 1] = limpiar_(String(d.placa || '').toUpperCase().replace(/\s+/g, ''), 15);
  fila[C.Guia_OC - 1] = limpiar_(d.guia, 80);
  fila[C.Carga - 1] = limpiar_(d.carga, 1000);
  fila[C.Pallets - 1] = numOpcional_(d.pallets);
  fila[C.Peso_kg - 1] = numOpcional_(d.peso);
  fila[C.Volumen_m3 - 1] = numOpcional_(d.volumen);
  fila[C.Estado - 1] = 'En ruta';
  fila[C.Token - 1] = Utilities.getUuid();
  conLock_(() => hoja_(HOJA_VIAJES).appendRow(fila));
  const pub = filaPublica_(fila);
  pub.token = fila[C.Token - 1]; // solo se entrega una vez, al celular que creó el viaje
  return pub;
}

function actualizarUbicacion_(id, token, pos) {
  pos = pos || {};
  const lat = Number(pos.lat), lng = Number(pos.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Ubicación inválida');
  const cfg = getConfig_();
  const distKm = haversineKm_(lat, lng, Number(cfg.ALMACEN_LAT), Number(cfg.ALMACEN_LNG));
  const velKmh = pos.velocidad !== null && isFinite(pos.velocidad) ? Math.round(pos.velocidad * 3.6) : '';
  const precision = Math.round(Number(pos.precision) || 0);
  const llego = distKm * 1000 <= Number(cfg.RADIO_LLEGADA_M || 150);
  const eta = llego ? { min: 0, fuente: '' } : calcularEta_(id, lat, lng, distKm, cfg); // fuera del lock
  const ahora = new Date();

  return conLock_(() => {
    const sh = hoja_(HOJA_VIAJES);
    const { nFila, r } = leerViaje_(sh, id, token);
    if (!ESTADOS_EN_CAMINO.includes(r[C.Estado - 1])) return filaPublica_(r);

    const estado = llego ? 'En patio'
      : (eta.min <= Number(cfg.MINUTOS_LLEGANDO || 15) ? 'Llegando' : 'En ruta');
    const bloque = [
      estado, lat, lng, precision, velKmh, ahora,
      redondear_(distKm, 2), Math.round(eta.min),
      new Date(ahora.getTime() + eta.min * 60000),
      llego ? ahora : '',
      eta.fuente
    ];
    sh.getRange(nFila, C.Estado, 1, bloque.length).setValues([bloque]);
    bloque.forEach((val, i) => { r[C.Estado - 1 + i] = val; });

    if (String(cfg.GUARDAR_HISTORIAL).toUpperCase() !== 'FALSE') {
      hoja_(HOJA_UBIC).appendRow([id, ahora, lat, lng, precision, velKmh, redondear_(distKm, 2)]);
    }
    return filaPublica_(r);
  });
}

function obtenerViaje_(id, token) {
  return filaPublica_(leerViaje_(hoja_(HOJA_VIAJES), id, token).r);
}

function marcarLlegada_(id, token) {
  return conLock_(() => cambiarEstadoInterno_(id, token, 'En patio', 'Llegada marcada por el conductor', false));
}

function cancelarViaje_(id, token) {
  return conLock_(() => cambiarEstadoInterno_(id, token, 'Cancelado', 'Cancelado por el conductor', false));
}

/* ───────────────────────── Acciones del panel ───────────────────────── */

function obtenerPanel_(clave) {
  verificarClave_(clave);
  const cfg = getConfig_();
  const sh = hoja_(HOJA_VIAJES);
  const n = sh.getLastRow() - 1;
  const filas = n > 0 ? sh.getRange(2, 1, n, COLS.length).getValues() : [];
  const tz = Session.getScriptTimeZone();
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const esHoy = d => d instanceof Date && Utilities.formatDate(d, tz, 'yyyy-MM-dd') === hoy;

  return {
    almacen: {
      nombre: String(cfg.ALMACEN_NOMBRE || 'Almacén'),
      lat: Number(cfg.ALMACEN_LAT), lng: Number(cfg.ALMACEN_LNG),
      radio: Number(cfg.RADIO_LLEGADA_M || 150)
    },
    minutosSinSenal: Number(cfg.MINUTOS_SIN_SENAL || 5),
    estados: ESTADOS,
    servidor: new Date().toISOString(),
    viajes: filas
      .filter(r => r[0] && (!ESTADOS_CERRADOS.includes(r[C.Estado - 1]) || esHoy(r[C.Registrado - 1])))
      .map(filaPublica_)
  };
}

function cambiarEstado_(clave, id, estado) {
  verificarClave_(clave);
  if (!ESTADOS.includes(estado)) throw new Error('Estado no válido');
  return conLock_(() => cambiarEstadoInterno_(id, null, estado, 'Estado → ' + estado + ' (almacén)', true));
}

/* ───────────────────────── Lógica interna ───────────────────────── */

function leerViaje_(sh, id, token) {
  const nFila = buscarFila_(sh, id);
  if (nFila < 0) throw new Error('No se encontró el viaje');
  const r = sh.getRange(nFila, 1, 1, COLS.length).getValues()[0];
  if (token !== null && String(r[C.Token - 1]) !== String(token || '')) throw new Error('Viaje no autorizado');
  return { nFila, r };
}

function cambiarEstadoInterno_(id, token, estado, nota, desdePanel) {
  const sh = hoja_(HOJA_VIAJES);
  const { nFila, r } = leerViaje_(sh, id, desdePanel ? null : token);
  if (!desdePanel && ESTADOS_CERRADOS.includes(r[C.Estado - 1])) return filaPublica_(r);

  r[C.Estado - 1] = estado;
  if (['En patio', 'Descargando', 'Finalizado'].includes(estado) && !r[C.Llegada_real - 1]) {
    r[C.Llegada_real - 1] = new Date();
    r[C.ETA_min - 1] = 0;
  }
  if (nota) {
    const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm');
    r[C.Notas - 1] = (r[C.Notas - 1] ? r[C.Notas - 1] + '\n' : '') + sello + ' ' + nota;
  }
  sh.getRange(nFila, 1, 1, COLS.length).setValues([r]);
  return filaPublica_(r);
}

function calcularEta_(id, lat, lng, distKm, cfg) {
  if (String(cfg.USAR_GOOGLE_MAPS).toUpperCase() === 'TRUE') {
    const cache = CacheService.getScriptCache();
    const key = 'eta_' + id;
    const hit = cache.get(key);
    if (hit) {
      const c = JSON.parse(hit);
      return { min: Math.max(1, c.min - (Date.now() - c.t) / 60000), fuente: 'Google Maps' };
    }
    try {
      const dir = Maps.newDirectionFinder()
        .setOrigin(lat, lng)
        .setDestination(Number(cfg.ALMACEN_LAT), Number(cfg.ALMACEN_LNG))
        .setMode(Maps.DirectionFinder.Mode.DRIVING)
        .setDepart(new Date())
        .getDirections();
      const leg = dir && dir.routes && dir.routes[0] && dir.routes[0].legs[0];
      if (leg) {
        const min = (leg.duration_in_traffic || leg.duration).value / 60;
        cache.put(key, JSON.stringify({ min, t: Date.now() }), Math.max(60, Number(cfg.MINUTOS_CACHE_MAPS || 5) * 60));
        return { min, fuente: 'Google Maps' };
      }
    } catch (err) {
      console.warn('Google Maps no respondió, uso el estimado: ' + err);
    }
  }
  const v = Math.max(5, Number(cfg.VELOCIDAD_PROMEDIO_KMH) || 28);
  const f = Number(cfg.FACTOR_RUTA) || 1.35;
  return { min: (distKm * f) / v * 60, fuente: 'Estimado' };
}

function verificarClave_(clave) {
  if (String(clave || '') !== String(getConfig_().PANEL_CLAVE)) {
    Utilities.sleep(800); // frena intentos repetidos
    throw new Error('Clave incorrecta');
  }
}

function hoja_(nombre) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Ejecuta el menú Llegadas > Configurar hojas.');
  return sh;
}

function buscarFila_(sh, id) {
  if (!id || !/^V\d{6}-[A-Z0-9]{4}$/.test(String(id))) return -1;
  const cel = sh.getRange(1, C.ID, Math.max(1, sh.getLastRow()), 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return cel ? cel.getRow() : -1;
}

function conLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function filaPublica_(r) {
  const o = {};
  COLS.forEach((n, i) => {
    if (n === 'Token') return;
    const v = r[i];
    o[n] = v instanceof Date ? v.toISOString() : v;
  });
  return o;
}

function generarId_() {
  const f = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd');
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'V' + f + '-' + s;
}

function limpiar_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita que Sheets lo lea como fórmula
  return s;
}

function numOpcional_(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(',', '.'));
  return isFinite(n) && n >= 0 ? n : '';
}

function haversineKm_(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function redondear_(x, d) { const p = Math.pow(10, d); return Math.round(x * p) / p; }
