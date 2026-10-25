# Déficit Tracker — Despliegue en Netlify

## Qué incluye esta carpeta
- `index.html` — la app de déficit (frontend), sin dependencias externas.
- `nutrientes.js` — catálogo de nutrientes y referencias diarias que usan las dos apps. Tiene que viajar junto a `index.html`.
- `mama/` — la versión "Nutrientes": solo calorías, macros, vitaminas y minerales (ver abajo).
- `netlify/functions/analyze.js` — función serverless que llama a la API de Anthropic protegiendo tu clave. La comparten las dos apps.
- `netlify/functions/datos.js` — la nube de la app de déficit: guarda y devuelve tus datos con un código (Netlify Blobs).
- `package.json` — la única dependencia, `@netlify/blobs`. Netlify la instala sola al publicar; no hay paso de build.
- `netlify.toml` — configuración de Netlify.
- `manifest.json` + `icons/` — para que al agregarla a la pantalla de inicio tenga ícono y nombre propios.

## Novedades de la v17 (app de déficit)

- **Dieta** (en la barra de abajo): elegís el tipo de dieta (equilibrada, alta en proteína, baja en carbohidratos, mediterránea o vegetariana). La proteína es siempre tu meta de Ajustes; la dieta reparte el resto de las calorías del día entre carbohidratos y grasas. Muestra **cómo viene el día** (kcal libres y las tres barras contra su meta) y, con **Sugerime**, propone qué comer en lo que queda del día según la hora. Cada opción tiene **Lo comí** (se suma sin otro análisis) y **Otra opción** (cambia solo esa).
- **Lo de siempre**: en la hoja de carga aparecen las comidas que marcaste con ★ (abriendo una comida) y las que cargaste 3 veces o más con el mismo texto. Un toque y se suman, sin gastar análisis.
- **Porciones**: al abrir una comida, ½ / 1 / 1½ / 2 recalcula calorías, macros y nutrientes. Volver a 1 deja el original exacto; si la editás a mano, manda lo que escribiste.
- **Resumen de la semana** arriba de Progreso, que ahora está en la barra: los últimos 7 días contra el límite, cuántos quedaron adentro (sin contar los cheat ni hoy), promedio, proteína y déficit de la semana. Tocando una barra ves los números de ese día.
- **Guardado en la nube** (Ajustes): ver la sección siguiente.

### La nube: cómo funciona y qué tener en cuenta

- No hay cuenta ni contraseña. Cada celular arma un **código al azar** (tres grupos de 4, como `7Q4M-92KD-H3TP`) y sube todo (comidas, días, objetivo, pesajes y Lo de siempre) unos segundos después de cada cambio. Sin señal, reintenta solo cuando vuelve.
- En un celular nuevo: en la bienvenida, "¿Ya la usabas en otro celular?" (o después, en Ajustes → "¿Celular nuevo?") → pegás el código → te muestra qué encontró y recién al confirmar reemplaza lo que hay. Desde ahí ese celular guarda con el mismo código.
- **Quien tenga el código ve tus datos.** Es a propósito, para no tener que manejar cuentas. No lo compartas.
- Se guarda en Netlify Blobs, que viene con el sitio: no hay que configurar nada. El servidor guarda bajo el hash del código, así que ni mirando el almacén aparecen los códigos. Las vistas previas de los PR usan el mismo almacén que el sitio publicado.
- "Borrar todo" no borra la copia de la nube: te muestra el código viejo por si te arrepentís, y al volver a empezar se arma uno nuevo.
- La app de mamá (`/mama/`) no usa la nube.

## Versión "Nutrientes" (para mamá)

Vive en `mama/` y se publica sola con el resto: queda en `https://tu-sitio.netlify.app/mama/`. Usa la misma función y la misma clave, así que no hay que configurar nada más.

- No hay objetivo de peso, déficit ni rachas: cada comida (por foto o dictado) muestra las calorías, de dónde vienen (proteínas, carbohidratos y grasas), y el detalle dividido en **Macronutrientes** (azul) y **Micronutrientes** (verde: 13 vitaminas y 10 minerales), como desplegables que se abren y se cierran.
- Las barras comparan contra lo recomendado por día para su edad y sexo. Son las ingestas de referencia de las Academias Nacionales de EE.UU.
- **Mis datos** (botón arriba a la derecha): peso, altura, cuánto se mueve, su salud y lo que le dijo el médico. Con eso:
  - calcula las calorías que necesita por día (Mifflin-St Jeor por el factor de actividad);
  - calcula la proteína por kilo (0,8 g/kg, 1 g/kg desde los 65);
  - baja el máximo de sodio a 1.500 mg si tiene presión alta;
  - marca "para vos" los nutrientes que importan según su salud;
  - arma en Hoy la tarjeta **Para vos**, con el número de hoy de cada uno, el consejo de actividad de la OMS si se mueve poco y la indicación del médico.
- Pensada para alguien a quien le cuesta el celular: botones grandes con texto, "Volver" visible en cada pantalla, la carga de una comida a pantalla completa (no se cierra por tocar afuera), y el botón de atrás del teléfono vuelve a Hoy en vez de cerrar la app.
- El Historial tiene el promedio de la última semana, que es como conviene mirar vitaminas y minerales, y permite agregar comidas a un día pasado.
- Arranca en modo claro y con letra más grande, y la versión se ve abajo de cada pantalla. Guarda en el celular con otro prefijo (`nutri_`), así que puede convivir con la app de déficit en el mismo teléfono.
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

### Cambiar la clave más adelante

Las dos apps (la de déficit y `/mama/`) usan la misma clave, así que se cambia en un solo lugar:

1. En console.anthropic.com, con la cuenta que vas a usar: cargá crédito en **Billing** y creá la clave en **API Keys → Create Key**. Si usás workspaces, creala dentro del workspace del proyecto: una clave no se puede mover de workspace.
2. En Netlify: **Project configuration → Environment variables → `ANTHROPIC_API_KEY` → Edit**, pegá la nueva y guardá.
3. **Deploys → Trigger deploy → Deploy project**. Sin este paso la función sigue usando la clave vieja: Netlify toma las variables recién en el próximo deploy. Cualquier commit a `main` también dispara uno.
4. Probá un análisis. "Clave rechazada" = la copiaste mal; "sin crédito" = falta saldo en esa cuenta.
5. Cuando la nueva ande, borrá la vieja en la consola.

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

La app usa **`claude-sonnet-5`**: USD 2 por millón de tokens de entrada y USD 10 por millón de salida. El modelo razona antes de contestar (thinking adaptativo), y ese razonamiento se cobra como salida, así que la salida es la mayor parte del costo.

Estimación (no medición; el número real está en console.anthropic.com → Usage):

| Qué | Costo aproximado |
|---|---|
| Analizar una comida (dictado o foto, con nutrientes) | USD 0,01 a 0,03 |
| Pedir sugerencias en Dieta (o "Otra opción") | USD 0,01 a 0,02 |
| Sumar desde Lo de siempre, "Lo comí", porciones, la nube | gratis (no llaman a la API) |

Con ~4 análisis y 1 o 2 pedidos de sugerencias por día da **USD 2,5 a 4 por mes**. Cada comida que sumás desde Lo de siempre en vez de dictarla es un análisis menos.

**Netlify.** En los planes por créditos, el gratis trae 300 créditos por mes y cada deploy a producción (cada merge a `main`) gasta 15; las vistas previas de los PR no gastan. Las funciones y la nube de esta app son poco tráfico. Si los créditos se acaban, Netlify pausa el sitio hasta el mes siguiente, así que conviene juntar cambios y publicar menos veces. Las cuentas viejas pueden seguir en el plan anterior, con otros límites: fijate cuál tenés en Billing / Usage.

Las fotos se redimensionan a 1024px en el navegador antes de mandarlas: para estimar un plato no se pierde nada útil y es lo que más baja el costo por análisis (una foto de iPhone sin tocar cuesta más del doble en tokens de entrada).

La estimación ya cuenta los ~30 nutrientes de detalle (vitaminas, minerales, tipos de grasa) que devuelve cada análisis desde la v15.

Si alguna vez querés máxima precisión en las estimaciones por foto, cambiá `MODEL` en `netlify/functions/analyze.js` a `claude-opus-5-5` (USD 4 / USD 20 por millón): cuesta más o menos el doble.

## Nota sobre los datos

La app trabaja con `localStorage` del navegador y, desde la v17, sube una copia a la nube con tu código (ver arriba): si cambiás de celular o se borran los datos de Safari, los recuperás con el código. El respaldo en archivo ("Descargar respaldo") sigue estando, ahora con Lo de siempre incluido.

La app de mamá guarda solo en su celular.
