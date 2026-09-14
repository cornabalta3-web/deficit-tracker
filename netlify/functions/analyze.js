// Función serverless de Netlify — Déficit Tracker.
//
// Recibe { dictation, photo } desde el frontend, arma el pedido a la API de
// Anthropic con la clave guardada como variable de entorno (ANTHROPIC_API_KEY)
// y devuelve el análisis nutricional ya parseado.
//
// Decisiones de diseño importantes:
//
// 1. El system prompt vive ACÁ, no en el frontend. Antes viajaba en cada
//    request, lo que convertía este endpoint en una API de Claude de uso libre
//    para cualquiera que descubriera la URL: podía mandar el prompt que
//    quisiera y facturarlo a nuestra cuenta. Ahora el cliente solo aporta el
//    dictado y la foto; el resto es fijo.
//
// 2. Usamos structured outputs (output_config.format). La API garantiza un
//    JSON válido con la forma del esquema, así que desaparece el parseo frágil
//    de sacarle los backticks de markdown a la respuesta y cruzar los dedos.
//
// 3. fetch nativo en vez del SDK oficial: el despliegue manual de Netlify
//    (arrastrar la carpeta) no corre `npm install`, así que una dependencia
//    rompería el flujo. Node 18+ ya trae fetch global. Si algún día conectás
//    el repo a Netlify para que compile solo, migrar a @anthropic-ai/sdk es
//    un cambio chico.

const MODEL = "claude-sonnet-5";

// Techo de generación, no un costo: solo se paga lo que realmente se genera.
// Tiene que ser holgado porque el modelo razona antes de responder y ese
// razonamiento también consume del presupuesto de salida.
const MAX_TOKENS = 16000;

// Límites de entrada: cortan abuso y errores obvios antes de gastar un token.
const MAX_DICTATION_CHARS = 4000;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MEDIA_TYPES_VALIDOS = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const SYSTEM_PROMPT = `Sos un nutricionista que extrae datos estructurados sobre UNA comida o UN relato de actividad de un día. Podés recibir un relato dictado en español, una foto de comida, o ambos.

Reglas:
- IMPORTANTE — corregí el sesgo típico de subestimación: al estimar por foto o descripción, las personas y los modelos de IA tienden a quedarse cortos porque no cuentan bien el aceite de cocción, manteca, aderezos, salsas y azúcares ocultos, y porque subestiman el tamaño real de las porciones caseras o de restaurante. Para compensar esto:
  - Si el plato tiene claramente algo frito, salteado, con aceite, manteca, mayonesa, aderezo o salsa visible, SUMÁ explícitamente esas calorías aunque no se detallen.
  - Estimá el tamaño de las porciones con criterio realista de porción de restaurante/casa (no la porción "ideal" o mínima de un plan nutricional).
  - Ante la duda entre dos estimaciones razonables, elegí la más alta, no la más conservadora.
- Esto puede ser SOLO UNA COMIDA — no asumas que es todo lo que la persona comió en el día.
- Si la persona da directamente un número total de calorías consumidas en esta comida o en el día, usá ESE número tal cual, y en ese caso protein_g/carbs_g/fat_g quedan en 0.
- Si hay una foto, identificá los alimentos visibles y estimá porciones realistas.
- total_expenditure_kcal: SOLO si se menciona explícitamente un gasto calórico TOTAL del día reportado por una app. Si no, poné null.
- exercise_kcal: si se menciona ejercicio específico realizado, estimá las kcal quemadas SOLO por esa actividad puntual. Si no, poné null.
- summary: un resumen de una frase en español de esta comida/actividad puntual.
- nutrition_score: de 1 a 10, valorando la calidad nutricional de ESTA comida puntual (no del día completo). Considerá la densidad de proteína en relación a las calorías totales, el balance entre proteína/carbos/grasa, si son alimentos enteros o muy procesados/fritos, y la presencia de vegetales o fibra si se mencionan. 10 = muy completa y nutritiva, 1 = muy pobre (ej: solo azúcar o frituras sin proteína ni fibra).
- nutrition_comment: un comentario breve en español (máximo 8 palabras) sobre el punto más relevante, por ejemplo "Falta proteína", "Gran fuente de grasas saludables", "Buen balance de macros", "Alta en sodio y frituras".

No inventes datos que no estén sugeridos por el contenido.`;

// El esquema reemplaza a las viejas instrucciones de "devolvé JSON sin
// markdown": la API ya no puede responder con otra forma.
const ESQUEMA_NUTRICION = {
  type: "object",
  properties: {
    consumed_kcal: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
    total_expenditure_kcal: { type: ["number", "null"] },
    exercise_kcal: { type: ["number", "null"] },
    summary: { type: "string" },
    nutrition_score: { type: "number" },
    nutrition_comment: { type: "string" },
  },
  required: [
    "consumed_kcal", "protein_g", "carbs_g", "fat_g",
    "total_expenditure_kcal", "exercise_kcal",
    "summary", "nutrition_score", "nutrition_comment",
  ],
  additionalProperties: false,
};

function responder(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// `code` viaja al frontend para que pueda mostrar un mensaje específico en vez
// del genérico "no pude analizar esto", que tapaba por igual un problema de red,
// una clave vencida y un JSON malformado.
function error(statusCode, code, mensaje) {
  return responder(statusCode, { error: mensaje, code });
}

// Solo aceptamos pedidos que vengan de nuestro propio sitio. No frena a alguien
// decidido (curl no manda Origin), pero corta el abuso casual; el cierre real
// es APP_SHARED_TOKEN, más abajo.
function origenPermitido(origin) {
  if (!origin) return true; // same-origin de algunos navegadores / PWA
  const permitidos = [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL]
    .filter(Boolean)
    .concat((process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean));
  if (permitidos.length === 0) return true; // entorno local sin configurar
  return permitidos.some((p) => origin === p.replace(/\/$/, ""));
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return error(405, "method_not_allowed", "Método no permitido.");
  }

  if (!origenPermitido(event.headers.origin || event.headers.Origin)) {
    return error(403, "origen_no_permitido", "Origen no autorizado.");
  }

  // Si configurás APP_SHARED_TOKEN en Netlify, el frontend tiene que mandarlo.
  // No es un secreto perfecto (viaja en el JS del cliente), pero sube muchísimo
  // el costo de que alguien encuentre y explote el endpoint.
  const tokenEsperado = process.env.APP_SHARED_TOKEN;
  if (tokenEsperado) {
    const recibido = event.headers["x-app-token"] || event.headers["X-App-Token"];
    if (recibido !== tokenEsperado) {
      return error(403, "token_invalido", "Token de aplicación inválido.");
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return error(500, "sin_clave", "Falta configurar ANTHROPIC_API_KEY en Netlify (Site configuration > Environment variables).");
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return error(400, "body_invalido", "El cuerpo del pedido no es JSON válido.");
  }

  const dictation = typeof payload.dictation === "string" ? payload.dictation.trim() : "";
  const photo = payload.photo || null;

  if (!dictation && !photo) {
    return error(400, "sin_contenido", "Mandá un dictado, una foto, o las dos cosas.");
  }
  if (dictation.length > MAX_DICTATION_CHARS) {
    return error(413, "dictado_muy_largo", "El dictado es demasiado largo.");
  }

  const bloques = [];

  if (photo) {
    if (!photo.data || typeof photo.data !== "string") {
      return error(400, "foto_invalida", "La foto llegó incompleta.");
    }
    if (!MEDIA_TYPES_VALIDOS.includes(photo.mediaType)) {
      return error(415, "formato_no_soportado", "Ese formato de imagen no se puede analizar. Sacá la foto en JPG o PNG.");
    }
    // base64 ocupa ~4/3 de los bytes reales.
    if (photo.data.length * 0.75 > MAX_PHOTO_BYTES) {
      return error(413, "foto_muy_grande", "La foto es demasiado grande.");
    }
    bloques.push({
      type: "image",
      source: { type: "base64", media_type: photo.mediaType, data: photo.data },
    });
  }

  bloques.push({ type: "text", text: dictation || "Analizá la foto adjunta." });

  let respuesta;
  try {
    respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: bloques }],
        output_config: { format: { type: "json_schema", schema: ESQUEMA_NUTRICION } },
      }),
    });
  } catch (e) {
    return error(502, "sin_conexion", "No se pudo contactar al servicio de análisis.");
  }

  let data;
  try {
    data = await respuesta.json();
  } catch (e) {
    return error(502, "respuesta_ilegible", "El servicio de análisis devolvió una respuesta ilegible.");
  }

  if (!respuesta.ok) {
    const detalle = data && data.error ? data.error.message : "Error desconocido";
    if (respuesta.status === 401 || respuesta.status === 403) {
      return error(502, "clave_rechazada", "La clave de API fue rechazada. Revisá ANTHROPIC_API_KEY en Netlify.");
    }
    if (respuesta.status === 429) {
      return error(429, "limite_alcanzado", "Se alcanzó el límite de pedidos. Probá de nuevo en un minuto.");
    }
    if (respuesta.status === 400 && /credit|billing/i.test(detalle)) {
      return error(502, "sin_credito", "La cuenta de Anthropic no tiene crédito disponible.");
    }
    return error(502, "error_api", detalle);
  }

  // Las clasificaciones de seguridad pueden declinar un pedido devolviendo 200:
  // hay que mirar stop_reason antes de leer el contenido.
  if (data.stop_reason === "refusal") {
    return error(422, "rechazado", "El análisis fue rechazado. Probá describir la comida con otras palabras.");
  }

  // Con el razonamiento activo la respuesta trae también bloques de thinking:
  // hay que quedarse con el bloque de texto, no asumir que es el primero.
  const bloqueTexto = (data.content || []).find((b) => b.type === "text");
  if (!bloqueTexto) {
    return error(502, "sin_resultado", "El análisis volvió vacío. Probá de nuevo.");
  }

  let analisis;
  try {
    analisis = JSON.parse(bloqueTexto.text);
  } catch (e) {
    return error(502, "json_invalido", "El análisis volvió con un formato inesperado.");
  }

  return responder(200, analisis);
};
