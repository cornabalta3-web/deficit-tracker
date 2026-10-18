# Déficit Tracker — Despliegue en Netlify

## Qué incluye esta carpeta
- `index.html` — la app de déficit (frontend), sin dependencias externas.
- `nutrientes.js` — catálogo de nutrientes y referencias diarias que usan las dos apps. Tiene que viajar junto a `index.html`.
- `mama/` — la versión "Nutrientes": solo calorías, macros, vitaminas y minerales (ver abajo).
- `netlify/functions/analyze.js` — función serverless que llama a la API de Anthropic protegiendo tu clave. La comparten las dos apps.
- `netlify.toml` — configuración de Netlify.
- `manifest.json` + `icons/` — para que al agregarla a la pantalla de inicio tenga ícono y nombre propios.

## Versión "Nutrientes" (para mamá)

Vive en `mama/` y se publica sola con el resto: queda en `https://tu-sitio.netlify.app/mama/`. Usa la misma función y la misma clave, así que no hay que configurar nada más.

- No hay peso, objetivo, déficit ni rachas: cada comida (por foto o dictado) muestra las calorías, de dónde vienen (proteínas, carbohidratos y grasas), y el detalle de azúcares, fibra, tipos de grasa, colesterol, 13 vitaminas y 10 minerales.
- Las barras comparan contra lo recomendado por día para su edad y sexo (los pide al entrar; se cambian en Ajustes). Son las ingestas de referencia de las Academias Nacionales de EE.UU.
- El Historial tiene el promedio de la última semana, que es como conviene mirar vitaminas y minerales, y permite agregar comidas a un día pasado.
- Arranca en modo claro y con letra más grande. Guarda en el celular con otro prefijo (`nutri_`), así que puede convivir con la app de déficit en el mismo teléfono.
- Para el iPhone: abrir `/mama/` en Safari → compartir → "Agregar a pantalla de inicio". Aparece como "Nutrientes".

Biotina, yodo, cromo y molibdeno quedaron afuera a propósito: las tablas de composición casi no los informan, así que cualquier número sería inventado.

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

Desde la v15 cada análisis devuelve también ~30 nutrientes de detalle (vitaminas, minerales, tipos de grasa), lo que agrega tokens de salida: con el mismo uso calculá algo así como medio dólar más por mes. Es una estimación, no una medición.

Si alguna vez querés máxima precisión en las estimaciones por foto, cambiá `MODEL` en `netlify/functions/analyze.js` a `claude-opus-5`. Sube a ~$2,40 por mes.

## Nota sobre los datos

Esta versión usa `localStorage` del navegador — tus datos quedan guardados en ese dispositivo/navegador específico. **Si cambiás de celular o borrás datos de Safari, se pierde el historial.** Usá el botón de "Descargar respaldo" dentro de la app periódicamente para tener una copia de seguridad en un archivo aparte.

Es la limitación más seria que le queda a la app. La solución de fondo es guardar los datos en el servidor, que es un cambio de arquitectura pendiente.
