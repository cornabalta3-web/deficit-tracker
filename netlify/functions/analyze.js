// Función serverless de Netlify — Déficit Tracker.
//
// Recibe { dictation, photo, perfil? } desde el frontend, arma el pedido a la
// API de Anthropic con la clave guardada como variable de entorno
// (ANTHROPIC_API_KEY) y devuelve el análisis nutricional ya parseado.
// `perfil` elige entre la app de déficit (por defecto) y la de nutrientes
// completos de /mama/; ver PERFILES.
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

// ---------- nutrientes ----------
//
// La unidad va en el nombre de cada campo para que el modelo no tenga que
// adivinarla y el frontend no tenga que convertir nada. Las dos apps los
// muestran con el catálogo de nutrientes.js: si sumás un campo acá, sumalo
// también allá.
//
// Los cuatro de base son los que la app de déficit ya pedía con otro nombre
// (consumed_kcal, protein_g...); el detalle es todo lo demás.
const CAMPOS_BASE = ["kcal", "proteinas_g", "carbohidratos_g", "grasas_g"];
const CAMPOS_DETALLE = [
  "azucares_g", "fibra_g",
  "grasas_saturadas_g", "grasas_monoinsaturadas_g", "grasas_poliinsaturadas_g", "grasas_trans_g",
  "colesterol_mg",
  "vitamina_a_ug", "vitamina_c_mg", "vitamina_d_ug", "vitamina_e_mg", "vitamina_k_ug",
  "tiamina_b1_mg", "riboflavina_b2_mg", "niacina_b3_mg", "pantotenico_b5_mg", "vitamina_b6_mg",
  "folato_b9_ug", "vitamina_b12_ug", "colina_mg",
  "calcio_mg", "hierro_mg", "magnesio_mg", "fosforo_mg", "potasio_mg", "sodio_mg",
  "zinc_mg", "cobre_mg", "manganeso_mg", "selenio_ug",
];

const numeros = (campos) => Object.fromEntries(campos.map((c) => [c, { type: "number" }]));

// Reglas de unidades y de cómo estimar micronutrientes, comunes a los dos perfiles.
const REGLAS_DETALLE = `- Cada nutriente va en la unidad que indica el nombre del campo (_g gramos, _mg miligramos, _ug microgramos) y es la cantidad TOTAL en esta comida. Vitamina A en microgramos de equivalentes de actividad de retinol (RAE), folato en microgramos DFE, niacina en miligramos NE.
- Para vitaminas y minerales usá valores típicos de tablas de composición de alimentos para las porciones que estimaste. Si un nutriente prácticamente no está en estos alimentos, poné 0. Nunca dejes un campo sin número.
- Las grasas saturadas, monoinsaturadas, poliinsaturadas y trans son parte de las grasas totales; los azúcares y la fibra son parte de los carbohidratos.`;

const SYSTEM_PROMPT = `Sos un nutricionista que extrae datos estructurados sobre UNA comida o UN relato de actividad de un día. Podés recibir un relato dictado en español, una foto de comida, o ambos.

Reglas:
- IMPORTANTE — corregí el sesgo típico de subestimación: al estimar por foto o descripción, las personas y los modelos de IA tienden a quedarse cortos porque no cuentan bien el aceite de cocción, manteca, aderezos, salsas y azúcares ocultos, y porque subestiman el tamaño real de las porciones caseras o de restaurante. Para compensar esto:
  - Si el plato tiene claramente algo frito, salteado, con aceite, manteca, mayonesa, aderezo o salsa visible, SUMÁ explícitamente esas calorías aunque no se detallen.
  - Estimá el tamaño de las porciones con criterio realista de porción de restaurante/casa (no la porción "ideal" o mínima de un plan nutricional).
  - Ante la duda entre dos estimaciones razonables, elegí la más alta, no la más conservadora.
- Esto puede ser SOLO UNA COMIDA — no asumas que es todo lo que la persona comió en el día.
- Si la persona da directamente un número total de calorías consumidas en esta comida o en el día, usá ESE número tal cual, y en ese caso protein_g/carbs_g/fat_g y todo el detalle quedan en 0.
- Si hay una foto, identificá los alimentos visibles y estimá porciones realistas.
- total_expenditure_kcal: SOLO si se menciona explícitamente un gasto calórico TOTAL del día reportado por una app. Si no, poné null.
- exercise_kcal: si se menciona ejercicio específico realizado, estimá las kcal quemadas SOLO por esa actividad puntual. Si no, poné null.
- summary: un resumen de una frase en español de esta comida/actividad puntual.
- nutrition_score: de 1 a 10, valorando la calidad nutricional de ESTA comida puntual (no del día completo). Considerá la densidad de proteína en relación a las calorías totales, el balance entre proteína/carbos/grasa, si son alimentos enteros o muy procesados/fritos, y la presencia de vegetales o fibra si se mencionan. 10 = muy completa y nutritiva, 1 = muy pobre (ej: solo azúcar o frituras sin proteína ni fibra).
- nutrition_comment: un comentario breve en español (máximo 8 palabras) sobre el punto más relevante, por ejemplo "Falta proteína", "Gran fuente de grasas saludables", "Buen balance de macros", "Alta en sodio y frituras".
- detalle: el resto de los macronutrientes, las vitaminas y los minerales de ESTA comida. Acá NO apliques el sesgo hacia arriba de las calorías: sobreestimar vitaminas te haría creer que estás cubierto cuando no. Si el relato es solo de actividad, sin comida, todo el detalle va en 0.
${REGLAS_DETALLE}

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
    detalle: {
      type: "object",
      properties: numeros(CAMPOS_DETALLE),
      required: CAMPOS_DETALLE,
      additionalProperties: false,
    },
  },
  required: [
    "consumed_kcal", "protein_g", "carbs_g", "fat_g",
    "total_expenditure_kcal", "exercise_kcal",
    "summary", "nutrition_score", "nutrition_comment", "detalle",
  ],
  additionalProperties: false,
};

// ---------- perfil "nutrientes" (la versión de mamá, en /mama/) ----------
//
// Misma función y misma clave, otro pedido: acá no hay déficit ni objetivo de
// peso, solo saber qué tiene la comida. Por eso el prompt no empuja la
// estimación hacia arriba como el de arriba (eso sirve para no engañarse con
// el déficit, no para saber cuánto calcio comiste).
const SYSTEM_PROMPT_NUTRIENTES = `Sos un nutricionista que estima la composición nutricional de UNA comida. Podés recibir un relato dictado en español (rioplatense), una foto de comida, o ambos.

Reglas:
- Estimá con criterio realista, ni de más ni de menos: porciones caseras o de restaurante tal como se ven o se cuentan, no la porción mínima de un plan.
- Contá lo que suele quedar afuera: aceite o manteca de cocción, aderezos, salsas, azúcar agregada al café o al té, el pan que acompaña. Si el plato está claramente frito, salteado o con aderezo visible, sumalo aunque no se mencione.
- Si la foto es de una etiqueta o tabla nutricional, usá esos valores, ajustados a la cantidad que la persona dice que comió (si no lo dice, una porción de la etiqueta).
- Si la persona da cantidades (gramos, tazas, unidades), respetalas.
- Pensá en alimentos y marcas comunes en Argentina cuando el nombre sea ambiguo.
${REGLAS_DETALLE}
- resumen: una frase en español que diga qué comida entendiste y en qué cantidades aproximadas, para que la persona pueda detectar un malentendido.

No inventes alimentos que no estén sugeridos por el contenido.`;

const ESQUEMA_NUTRIENTES = {
  type: "object",
  properties: { resumen: { type: "string" }, ...numeros(CAMPOS_BASE), ...numeros(CAMPOS_DETALLE) },
  required: ["resumen", ...CAMPOS_BASE, ...CAMPOS_DETALLE],
  additionalProperties: false,
};

// El cliente elige el perfil por nombre, nunca manda prompt ni esquema: así
// el endpoint sigue sirviendo solo para estas dos cosas. Sin `perfil` se usa
// el de la app original, que nunca lo manda.
const PERFILES = {
  deficit: { system: SYSTEM_PROMPT, schema: ESQUEMA_NUTRICION },
  nutrientes: { system: SYSTEM_PROMPT_NUTRIENTES, schema: ESQUEMA_NUTRIENTES },
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
// La regla es "mismo origen": el pedido tiene que venir de la misma dirección
// donde está publicada la app. Comparamos el Origin del navegador contra el
// Host al que llegó el pedido, que es un dato del pedido mismo.
//
// La versión anterior comparaba contra las variables URL / DEPLOY_URL /
// DEPLOY_PRIME_URL de Netlify, y eso rebotaba pedidos legítimos: cada deploy
// preview, deploy de rama y dominio propio tiene una dirección distinta, así
// que bastaba con abrir la app desde cualquiera de ellas para quedar afuera.
// Comparar contra el Host funciona en todas por igual y no depende de que
// Netlify exponga esas variables dentro de la función.
function origenPermitido(event) {
  const origin = event.headers.origin || event.headers.Origin;
  if (!origin) return true; // pedidos same-origin que no mandan Origin

  const host = event.headers.host || event.headers.Host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch (e) {
    return false; // Origin malformado
  }
  if (host && originHost === host) return true;

  // Escotilla por si algún día servís el frontend desde otro dominio.
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return extra.some((p) => {
    try { return new URL(p).host === originHost; } catch (e) { return false; }
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return error(405, "method_not_allowed", "Método no permitido.");
  }

  if (!origenPermitido(event)) {
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

  const nombrePerfil = payload.perfil == null ? "deficit" : payload.perfil;
  if (!Object.prototype.hasOwnProperty.call(PERFILES, nombrePerfil)) {
    return error(400, "perfil_invalido", "Perfil de análisis desconocido.");
  }
  const perfil = PERFILES[nombrePerfil];

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
        system: perfil.system,
        messages: [{ role: "user", content: bloques }],
        output_config: { format: { type: "json_schema", schema: perfil.schema } },
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

  // Si se cortó por el techo de tokens, el JSON viene a medias aunque haya
  // esquema. Con los ~35 números del perfil nutrientes es más fácil llegar.
  if (data.stop_reason === "max_tokens") {
    return error(502, "respuesta_cortada", "El análisis quedó incompleto. Probá de nuevo.");
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
