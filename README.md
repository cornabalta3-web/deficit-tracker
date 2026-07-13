# Déficit Tracker — Despliegue en Netlify

## Qué incluye esta carpeta
- `index.html` — la app completa (frontend), sin dependencias externas.
- `netlify/functions/analyze.js` — función serverless que llama a la API de Anthropic protegiendo tu clave.
- `netlify.toml` — configuración de Netlify.

## Paso 1 — Conseguir tu clave de API de Anthropic
1. Andá a https://console.anthropic.com
2. Creá una cuenta (o iniciá sesión) y cargá una tarjeta / créditos de facturación.
3. Andá a **Settings > API Keys** y creá una nueva clave.
4. Copiala — la vas a necesitar en el Paso 3. **No la compartas ni la pegues en el código del frontend.**

## Paso 2 — Subir el proyecto a Netlify
Opción más simple (sin usar Git):
1. Andá a https://app.netlify.com y creá una cuenta gratis.
2. En el dashboard, buscá la opción de arrastrar y soltar una carpeta ("Deploy manually" / arrastrar carpeta al área indicada).
3. Arrastrá esta carpeta completa (`netlify-deficit`, con los tres archivos y la subcarpeta `netlify/functions`).
4. Netlify te va a dar una URL tipo `https://algo-random.netlify.app`.

## Paso 3 — Configurar tu clave de forma segura
1. En el dashboard de Netlify, entrá al sitio que acabás de crear.
2. Andá a **Site configuration > Environment variables**.
3. Agregá una variable nueva:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (pegá la clave que copiaste en el Paso 1)
4. Guardá, y volvé a desplegar el sitio (Netlify suele pedir un "redeploy" para que la variable tome efecto — hay un botón "Trigger deploy").

## Paso 4 — Agregarlo a tu iPhone
1. Abrí la URL de Netlify en Safari.
2. Confirmá que carga bien (deberías ver la pantalla de "Contame sobre vos").
3. Ícono de compartir → "Agregar a pantalla de inicio" → activá "Abrir como app web".
4. Como ahora es tu propio dominio (no claude.ai), no debería haber problemas de redirección a ninguna app.

## Nota sobre costos
Cada análisis de comida cuesta una fracción de centavo de dólar (ver cálculo que hicimos en el chat). Para uso personal, esperá gastar menos de $2-3 dólares por mes en la API.

## Nota sobre los datos
Esta versión usa `localStorage` del navegador — tus datos quedan guardados en ese dispositivo/navegador específico. Si cambiás de celular o borrás datos de Safari, se pierde el historial. Usá el botón de "Descargar respaldo" dentro de la app periódicamente para tener una copia de seguridad en un archivo aparte.
