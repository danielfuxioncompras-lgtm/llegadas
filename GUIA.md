# Llegadas · Guía de instalación desde cero

Sistema para que tus proveedores registren su carga y compartan su ubicación escaneando un QR, y para que tu almacén vea quién viene, a qué hora llega y en qué orden entra al patio.

```
 Celular del conductor          GitHub Pages                 Google
 ─────────────────────        ─────────────────         ─────────────────────
 Escanea el QR  ─────────▶   index.html (proveedor)  ──▶  Apps Script (API)
                              panel.html (almacén)    ──▶        │
 WhatsApp (respaldo) ──▶ tu celular de recepción              Google Sheets
```

## Qué hay en la carpeta

```
llegadas/
├── apps-script/          → se copia a Google Apps Script
│   ├── Code.gs
│   └── appsscript.json
└── web/                  → se sube a GitHub
    ├── index.html        página del proveedor (la abre el QR)
    ├── panel.html        panel del almacén
    ├── config.js         ← aquí pegas la URL de tu API (único archivo a editar)
    ├── api.js
    ├── manifest.webmanifest
    ├── sw.js
    └── icons/
```

Necesitas una cuenta de Google y una cuenta de GitHub, ambas gratuitas. No hay que instalar nada en tu computadora.

---

## Parte 1 · Google Sheets y Apps Script (la base de datos y la API)

**1. Crea la hoja.** Entra a [sheets.new](https://sheets.new) y ponle un nombre, por ejemplo *Llegadas almacén*.

**2. Abre Apps Script.** Menú **Extensiones → Apps Script**. Se abre un editor con un archivo `Código.gs`.

**3. Pega el código.** Borra todo lo que tenga `Código.gs` y pega el contenido de `apps-script/Code.gs`. Guarda con Ctrl+S.

**4. Pega el manifiesto.**
1. En el editor, ve a ⚙️ **Configuración del proyecto** (barra izquierda).
2. Marca **"Mostrar el archivo de manifiesto appsscript.json en el editor"**.
3. Vuelve a **Editor** (ícono `< >`), abre `appsscript.json`, reemplaza todo con el contenido de `apps-script/appsscript.json` y guarda.

Así la zona horaria queda en Lima.

**5. Crea las hojas.**
1. Arriba, en el selector de funciones, elige `setup` y pulsa **Ejecutar**.
2. Google te pedirá permisos: **Revisar permisos → elige tu cuenta**.
3. Si aparece "Google no verificó esta app", pulsa **Configuración avanzada → Ir a (nombre del proyecto)** y luego **Permitir**. Es normal: la app es tuya.

Vuelve a la hoja: ahora tiene las pestañas **Viajes**, **Ubicaciones** y **Config**.

**6. Configura tu almacén.** En la pestaña **Config**, cambia la columna *Valor*:

| Clave | Qué poner |
|---|---|
| `ALMACEN_NOMBRE` | El nombre que verán los conductores |
| `ALMACEN_LAT` / `ALMACEN_LNG` | En Google Maps haz **clic derecho sobre la puerta de tu patio**. El primer número que aparece es la latitud y el segundo, la longitud |
| `PANEL_CLAVE` | La clave con la que tu equipo entra al panel. Que no sea fácil de adivinar |
| `WHATSAPP_NUMERO` | WhatsApp de recepción con código de país, sin + ni espacios. Ejemplo: `51987654321` |
| `VELOCIDAD_PROMEDIO_KMH` | Déjalo en 28 y ajústalo cuando veas llegadas reales |

**7. Publica la API.**
1. En Apps Script: **Implementar → Nueva implementación**.
2. En el engranaje junto a "Seleccionar tipo", elige **Aplicación web**.
3. Descripción: `API v1`.
4. **Ejecutar como: Yo**.
5. **Quién tiene acceso: Cualquier usuario**. Tiene que ser esta opción: si eliges "Cualquier usuario con cuenta de Google", la página no podrá conectarse.
6. **Implementar** y copia la **URL de la aplicación web**. Termina en `/exec`.

**8. Prueba la API.** Pega esa URL en tu navegador. Debes ver algo como:

```json
{"ok":true,"data":{"servicio":"llegadas","version":2,"hora":"..."}}
```

Si lo ves, la parte de Google está lista.

---

## Parte 2 · GitHub Pages (la página y el panel)

**9. Crea tu cuenta** en [github.com](https://github.com) si aún no la tienes. El nombre de usuario aparecerá en la dirección web, por ejemplo `almacenesperu.github.io`.

**10. Crea el repositorio.**
1. Botón **+** (arriba a la derecha) → **New repository**.
2. Repository name: `llegadas`.
3. Visibilidad: **Public**. GitHub Pages es gratis solo con repositorios públicos. No hay riesgo: el código no contiene tu clave ni tus datos, que viven en tu Google Sheets.
4. **Create repository**.

**11. Sube los archivos.**
1. En el repositorio nuevo, pulsa el enlace **uploading an existing file**.
2. Abre la carpeta `web` en tu computadora, selecciona **todo su contenido**, incluida la carpeta `icons`, y arrástralo a la página. Sube lo que está dentro de `web`, no la carpeta `web` misma, para que `index.html` quede en la raíz.
3. Abajo, **Commit changes**.

**12. Pega la URL de tu API.**
1. En el repositorio, abre `config.js` y pulsa el lápiz ✏️ (Edit).
2. Reemplaza `PEGA_AQUI_LA_URL_DE_TU_APPS_SCRIPT` por la URL del paso 7. Mantén las comillas:
   ```js
   window.API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
   ```
3. **Commit changes**.

**13. Activa GitHub Pages.**
1. En el repositorio: **Settings → Pages** (menú izquierdo).
2. En *Build and deployment*, Source: **Deploy from a branch**.
3. Branch: **main**, carpeta **/ (root)** → **Save**.
4. Espera 1 o 2 minutos y recarga. Arriba aparecerá: *Your site is live at* `https://TU-USUARIO.github.io/llegadas/`.

Tus dos direcciones son:
- **Proveedores (va en el QR):** `https://TU-USUARIO.github.io/llegadas/`
- **Panel del almacén:** `https://TU-USUARIO.github.io/llegadas/panel.html`

---

## Parte 3 · Probar y empezar a usar

**14. Entra al panel** desde la computadora de recepción con tu `PANEL_CLAVE`. Guárdalo en favoritos.

**15. Haz un viaje de prueba.**
1. En tu celular, abre la dirección de proveedores.
2. Llena el formulario y toca **Iniciar viaje**. Acepta el permiso de ubicación.
3. En unos segundos aparece en el panel y en la hoja *Viajes*.
4. Prueba el botón de WhatsApp y luego **Cancelar este viaje**.

**16. Imprime el QR.** En el panel, **QR para proveedores → Imprimir**. Pégalo en la garita o envíalo por WhatsApp junto con la orden de compra, para que lo escaneen **antes de salir** hacia tu almacén.

**17. Prepara el celular de recepción** con WhatsApp Business y el número que pusiste en `WHATSAPP_NUMERO`. Ahí llegarán las ubicaciones en tiempo real de respaldo.

---

## Cómo lo usa cada uno

**El conductor**
1. Escanea el QR antes de salir. La primera vez puede tocar "Agregar a pantalla de inicio" y usarla luego como app, sin escanear.
2. Llena empresa, conductor y placa (se guardan para la próxima). Lo que trae (descripción, guía u orden de compra, pallets, peso y volumen) es opcional.
3. Ve cuántos minutos le faltan. La página envía su ubicación cada 30 s mientras esté abierta.
4. Toca el botón verde y comparte su ubicación en tiempo real por WhatsApp: ese es el respaldo si cierra la página.
5. Al llegar a 150 m del patio, el viaje pasa solo a **En patio**. También puede tocar "Ya llegué".

**El almacén**
- **Por llegar:** ordenado por hora estimada de llegada. Si alguien sale en rojo con "Sin señal", búscalo en WhatsApp con su código de viaje.
- **En patio:** cuánto tiempo lleva esperando cada camión.
- **Estados:** cámbialos desde cada tarjeta (En patio → Descargando → Finalizado). Cada cambio queda anotado con hora en la columna *Notas*.
- **Resumen superior:** camiones en camino, cuántos llegan en 30 min, y pallets y toneladas por llegar, para organizar al personal de descarga.

---

## Cómo actualizar

**Si cambias `Code.gs`:** en Apps Script ve a **Implementar → Administrar implementaciones → ✏️ editar → Versión: Nueva versión → Implementar**. Así la URL sigue siendo la misma. Si haces "Nueva implementación", la URL cambia y tendrías que actualizar `config.js`.

**Si cambias la página:** edita el archivo en GitHub y haz commit. En 1 o 2 minutos se publica solo.

**Si cambias la hoja Config:** se aplica en máximo 1 minuto.

---

## Opcional

**Dominio propio** (por ejemplo `llegadas.tuempresa.pe`): en **Settings → Pages → Custom domain**. En tu proveedor de dominio, crea un registro CNAME que apunte a `TU-USUARIO.github.io`. Hazlo antes de imprimir los QR.

**ETA con tráfico real:** pon `USAR_GOOGLE_MAPS` en `TRUE`. Tiene una cuota diaria gratuita. Si se acaba, vuelve solo al cálculo estimado. La columna *Fuente_ETA* dice cuál se usó.

**Reportes:** con una tabla dinámica sobre la hoja *Viajes* puedes ver tiempo de espera por proveedor, llegadas por hora del día o pallets recibidos por semana.

---

## Límites que debes conocer

- **La página solo envía ubicación mientras está abierta.** Si el conductor la cierra o bloquea el celular, se envía un último punto y se detiene hasta que vuelva. Para eso existe el respaldo por WhatsApp. El seguimiento totalmente automático con el celular cerrado solo es posible con una app nativa.
- **Capacidad:** unas pocas decenas de camiones al mismo tiempo sin problema. Si tienes más, sube `INTERVALO_ENVIO_SEG` a 60.
- **La hoja Ubicaciones crece rápido**, unas 120 filas por hora por camión. Archívala cada mes: haz una copia del archivo y borra las filas antiguas. Si no necesitas el recorrido, pon `GUARDAR_HISTORIAL` en `FALSE`.
- **Datos personales (Ley 29733):** guardas nombre, celular y ubicación de los conductores. Conviene informarles para qué se usan. El formulario ya avisa que la ubicación se comparte solo durante el viaje.

## Problemas frecuentes

| Qué pasa | Solución |
|---|---|
| "No se pudo conectar con el almacén" | Revisa que `config.js` tenga la URL `/exec` correcta y que en Apps Script el acceso sea **Cualquier usuario**. |
| El panel dice "Falta pegar la URL de la API" | Igual que arriba: `config.js` todavía tiene el texto de ejemplo. |
| "Falta la hoja…" | Ejecuta `setup` otra vez, o en la hoja usa el menú **Llegadas → Configurar hojas**. |
| El celular no pide permiso de ubicación | Abre el enlace en Chrome (Android) o Safari (iPhone), no dentro del navegador de WhatsApp o de la cámara. Si antes se tocó "No permitir", actívalo en el candado 🔒 junto a la dirección. |
| Cambié la página y no veo el cambio | Espera 2 minutos y recarga. En el celular, cierra y abre la página. |
| La hora sale mal | Revisa que `appsscript.json` tenga `"timeZone": "America/Lima"`. |
| Cambié `Code.gs` y no se aplica | Falta publicar la **Nueva versión** en *Administrar implementaciones*. |
