// Función serverless de Netlify — la nube de la app de déficit.
//
// Guarda y devuelve todo el estado de la app con un código, sin cuentas ni
// contraseñas. El celular genera un código al azar (por ejemplo 7Q4M-92KD-H3TP)
// y manda su estado acá cada vez que cambia algo; en otro celular, con el mismo
// código, se baja. La contra, aceptada a propósito: quien tenga el código ve
// los datos.
//
// Se guarda en Netlify Blobs (viene con el sitio, no hay que configurar nada).
// La clave es el hash del código, así ni listando el almacén aparecen los
// códigos. El almacén es del sitio, no de cada deploy: un deploy nuevo no lo
// borra y las vistas previas ven los mismos datos.
//
// Recibe { accion: "guardar", codigo, datos } o { accion: "leer", codigo }.

const crypto = require("crypto");
const { connectLambda, getStore } = require("@netlify/blobs");

const STORE = "nube";
// Sin 0/O ni 1/I, que se confunden al copiarlo a mano.
const CODIGO_VALIDO = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
// Años de comidas con todos sus nutrientes entran holgados. Netlify corta
// los cuerpos de más de 6 MB de todas formas.
const MAX_BYTES = 4 * 1024 * 1024;

function responder(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function error(statusCode, code, mensaje) {
  return responder(statusCode, { error: mensaje, code });
}

// Mismo criterio que analyze.js: el pedido tiene que venir de la misma
// dirección donde está publicada la app (o de ALLOWED_ORIGINS).
function origenPermitido(event) {
  const origin = event.headers.origin || event.headers.Origin;
  if (!origin) return true;
  const host = event.headers.host || event.headers.Host;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch (e) {
    return false;
  }
  if (host && originHost === host) return true;
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
  const tokenEsperado = process.env.APP_SHARED_TOKEN;
  if (tokenEsperado) {
    const recibido = event.headers["x-app-token"] || event.headers["X-App-Token"];
    if (recibido !== tokenEsperado) {
      return error(403, "token_invalido", "Token de aplicación inválido.");
    }
  }
  if (event.body && event.body.length > MAX_BYTES) {
    return error(413, "muy_grande", "Los datos son demasiado grandes para guardarlos.");
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return error(400, "body_invalido", "El cuerpo del pedido no es JSON válido.");
  }

  const codigo = String((payload && payload.codigo) || "").trim().toUpperCase();
  if (!CODIGO_VALIDO.test(codigo)) {
    return error(400, "codigo_invalido", "Ese código no tiene el formato correcto (tres grupos de 4, como 7Q4M-92KD-H3TP).");
  }
  const clave = crypto.createHash("sha256").update(codigo).digest("hex");

  // En funciones con exports.handler, Blobs no se configura solo: hay que
  // pasarle el evento antes de abrir el almacén. Consistencia fuerte para que
  // un celular nuevo baje lo último que guardó el otro, no una copia vieja.
  let store;
  try {
    connectLambda(event);
    store = getStore({ name: STORE, consistency: "strong" });
  } catch (e) {
    return error(500, "sin_almacen", "No se pudo abrir el almacenamiento de Netlify.");
  }

  if (payload.accion === "guardar") {
    if (!payload.datos || typeof payload.datos !== "object" || Array.isArray(payload.datos)) {
      return error(400, "sin_datos", "No llegaron datos para guardar.");
    }
    const guardado = new Date().toISOString();
    try {
      await store.setJSON(clave, { guardado, datos: payload.datos });
    } catch (e) {
      return error(502, "no_guardo", "No se pudo guardar en la nube. Se reintenta solo.");
    }
    return responder(200, { ok: true, guardado });
  }

  if (payload.accion === "leer") {
    let registro;
    try {
      registro = await store.get(clave, { type: "json" });
    } catch (e) {
      return error(502, "no_leyo", "No se pudo leer de la nube. Probá de nuevo en un rato.");
    }
    if (!registro) {
      return error(404, "codigo_desconocido", "No hay datos guardados con ese código.");
    }
    return responder(200, registro);
  }

  return error(400, "accion_invalida", "Acción desconocida.");
};
