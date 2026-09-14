# Déficit Tracker — Despliegue en Netlify

## Qué incluye esta carpeta
- `index.html` — la app completa (frontend), sin dependencias externas.
- `netlify/functions/analyze.js` — función serverless que llama a la API de Anthropic protegiendo tu clave.
- `netlify.toml` — configuración de Netlify.
- `manifest.json` + `icons/` — para que al agregarla a la pantalla de inicio tenga ícono y nombre propios.

## Paso 1 — Conseguir tu clave de API de Anthropic
1. Andá a https://console.anthropic.com
2. Creá una cuenta (o iniciá sesión) y cargá una tarjeta / créditos de facturación.
3. Andá a **Settings > API Keys** y creá una nueva clave.
4. Copiala — la vas a necesitar en el Paso 3. **No la compartas ni la pegues en el código del frontend.**

## Paso 2 — Subir el proyecto a Netlify
Opción más simple (sin usar Git):
1. Andá a https://app.netlify.com y creá una cuenta gratis.
2. En el dashboard, buscá la opción de arrastrar y soltar una carpeta ("Deploy manually" / arrastrar carpeta al área indicada).
3. Arrastrá esta carpeta completa, con todos los archivos y las subcarpetas `netlify/functions` e `icons`.
4. Netlify te va a dar una URL tipo `https://algo-random.netlify.app`.

## Paso 3 — Configurar tu clave de forma segura
1. En el dashboard de Netlify, entrá al sitio que acabás de crear.
2. Andá a **Site configuration > Environment variables**.
3. Agregá una variable nueva:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (pegá la clave que copiaste en el Paso 1)
4. Guardá, y volvé a desplegar el sitio (Netlify suele pedir un "redeploy" para que la variable tome efecto — hay un botón "Trigger deploy").

## Paso 4 — Cerrar el endpoint (importante)

La función `analyze` está publicada en internet. Sin protección, cualquiera que descubra tu URL puede usarla como una API de Claude gratis **facturada a tu tarjeta**.

Ya viene con dos defensas activas por diseño:

- **El prompt vive en el servidor.** El frontend solo manda el dictado y la foto, así que nadie puede reutilizar tu endpoint para otra cosa.
- **Chequeo de origen.** Netlify define `URL` sola, y la función rechaza pedidos que vengan de otro dominio.

Para cerrarlo del todo, agregá una variable de entorno más:

- Key: `APP_SHARED_TOKEN`
- Value: cualquier texto largo y aleatorio que inventes

Si la definís, la función va a exigir ese token en cada pedido. Tené en cuenta que **el frontend también tiene que mandarlo**, así que si la activás hay que agregar el header `x-app-token` en la llamada de `index.html`. Sin esa variable la app funciona igual, apoyada en las dos defensas anteriores.

## Paso 5 — Agregarlo a tu iPhone
1. Abrí la URL de Netlify en Safari.
2. Confirmá que carga bien (deberías ver la pantalla de "Contame sobre vos").
3. Ícono de compartir → "Agregar a pantalla de inicio".
4. Ahora tiene ícono y nombre propios ("Déficit"), y abre en pantalla completa sin la barra de Safari.

## Nota sobre costos

La app usa **`claude-sonnet-5`**. Con ~4 análisis por día, el costo ronda los **$0,80 por mes**.

Las fotos se redimensionan a 1024px en el navegador antes de mandarlas: para estimar un plato no se pierde nada útil y es lo que más baja el costo por análisis (una foto de iPhone sin tocar cuesta más del doble en tokens de entrada).

Si alguna vez querés máxima precisión en las estimaciones por foto, cambiá `MODEL` en `netlify/functions/analyze.js` a `claude-opus-5`. Sube a ~$2,40 por mes.

## Nota sobre los datos

Esta versión usa `localStorage` del navegador — tus datos quedan guardados en ese dispositivo/navegador específico. **Si cambiás de celular o borrás datos de Safari, se pierde el historial.** Usá el botón de "Descargar respaldo" dentro de la app periódicamente para tener una copia de seguridad en un archivo aparte.

Es la limitación más seria que le queda a la app. La solución de fondo es guardar los datos en el servidor, que es un cambio de arquitectura pendiente.
