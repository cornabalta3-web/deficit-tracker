// Catálogo de nutrientes compartido por las dos apps: index.html (déficit) y
// mama/index.html (nutrientes). Expone todo en window.Nutrientes.
//
// Las claves son exactamente los campos que devuelve la función analyze
// (CAMPOS_BASE + CAMPOS_DETALLE en netlify/functions/analyze.js): si sumás un
// nutriente, sumalo en los dos lados.
(function () {
  "use strict";

  // Dos secciones arriba de todo: macro (de donde salen las calorías) y micro
  // (vitaminas y minerales). Los grupos son el detalle dentro de cada una.
  const SECCIONES = [
    { k: "macro", nombre: "Macronutrientes", bajada: "Proteínas, carbohidratos y grasas: de acá salen las calorías." },
    { k: "micro", nombre: "Micronutrientes", bajada: "Vitaminas y minerales: hacen falta en poca cantidad, pero todos los días." },
  ];
  const GRUPOS = [
    { k: "macros", nombre: "Macronutrientes", seccion: "macro" },
    { k: "vitaminas", nombre: "Vitaminas", seccion: "micro" },
    { k: "minerales", nombre: "Minerales", seccion: "micro" },
  ];

  // ref: "meta"   = conviene llegar a la referencia diaria;
  //      "max"    = conviene no pasarse;
  //      "kcal10" = no más del 10 % de las calorías del día (grasas saturadas).
  // Sin ref no hay una cifra diaria que sirva (carbohidratos, azúcares totales,
  // colesterol, trans): se muestra solo la cantidad.
  // sub = es parte del renglón anterior (se dibuja con sangría).
  const NUTRIENTES = [
    { k: "proteinas_g", nombre: "Proteínas", u: "g", grupo: "macros", ref: "meta" },
    { k: "carbohidratos_g", nombre: "Carbohidratos", u: "g", grupo: "macros" },
    { k: "azucares_g", nombre: "Azúcares", largo: "Azúcares", u: "g", grupo: "macros", sub: true },
    { k: "fibra_g", nombre: "Fibra", largo: "Fibra", u: "g", grupo: "macros", sub: true, ref: "meta" },
    { k: "grasas_g", nombre: "Grasas", u: "g", grupo: "macros" },
    { k: "grasas_saturadas_g", nombre: "Saturadas", largo: "Grasas saturadas", u: "g", grupo: "macros", sub: true, ref: "kcal10" },
    { k: "grasas_monoinsaturadas_g", nombre: "Monoinsaturadas", largo: "Grasas mono", u: "g", grupo: "macros", sub: true },
    { k: "grasas_poliinsaturadas_g", nombre: "Poliinsaturadas", largo: "Grasas poli", u: "g", grupo: "macros", sub: true },
    { k: "grasas_trans_g", nombre: "Trans", largo: "Grasas trans", u: "g", grupo: "macros", sub: true },
    { k: "colesterol_mg", nombre: "Colesterol", u: "mg", grupo: "macros" },

    { k: "vitamina_a_ug", nombre: "Vitamina A", u: "ug", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_c_mg", nombre: "Vitamina C", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_d_ug", nombre: "Vitamina D", u: "ug", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_e_mg", nombre: "Vitamina E", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_k_ug", nombre: "Vitamina K", u: "ug", grupo: "vitaminas", ref: "meta" },
    { k: "tiamina_b1_mg", nombre: "B1 · Tiamina", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "riboflavina_b2_mg", nombre: "B2 · Riboflavina", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "niacina_b3_mg", nombre: "B3 · Niacina", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "pantotenico_b5_mg", nombre: "B5 · Ác. pantoténico", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_b6_mg", nombre: "Vitamina B6", u: "mg", grupo: "vitaminas", ref: "meta" },
    { k: "folato_b9_ug", nombre: "B9 · Folato", u: "ug", grupo: "vitaminas", ref: "meta" },
    { k: "vitamina_b12_ug", nombre: "Vitamina B12", u: "ug", grupo: "vitaminas", ref: "meta" },
    { k: "colina_mg", nombre: "Colina", u: "mg", grupo: "vitaminas", ref: "meta" },

    { k: "calcio_mg", nombre: "Calcio", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "hierro_mg", nombre: "Hierro", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "magnesio_mg", nombre: "Magnesio", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "fosforo_mg", nombre: "Fósforo", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "potasio_mg", nombre: "Potasio", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "sodio_mg", nombre: "Sodio", u: "mg", grupo: "minerales", ref: "max" },
    { k: "zinc_mg", nombre: "Zinc", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "cobre_mg", nombre: "Cobre", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "manganeso_mg", nombre: "Manganeso", u: "mg", grupo: "minerales", ref: "meta" },
    { k: "selenio_ug", nombre: "Selenio", u: "ug", grupo: "minerales", ref: "meta" },
  ];

  // Los cuatro de base (la app de déficit los guarda aparte, con sus nombres de
  // siempre) y el resto, que viaja como `detalle`.
  const CLAVES_BASE = ["kcal", "proteinas_g", "carbohidratos_g", "grasas_g"];
  const CLAVES = ["kcal"].concat(NUTRIENTES.map((d) => d.k));
  const CLAVES_DETALLE = CLAVES.filter((k) => CLAVES_BASE.indexOf(k) === -1);

  // ---------- referencias diarias ----------
  //
  // Ingestas diarias recomendadas para adultos de las Academias Nacionales de
  // EE.UU. (NASEM, antes IOM): RDA cuando existe, si no AI. El potasio es el
  // valor revisado en 2019 y el sodio es el máximo para reducir riesgo
  // crónico (CDRR), no un mínimo. Cambian con el sexo y con la edad: a partir
  // de los 51 baja el hierro de las mujeres y sube su calcio y su B6, y a partir
  // de los 71 sube la vitamina D de todos y el calcio de los hombres.
  function referencias(edad, sexo) {
    const h = sexo === "masculino";
    const e = Number(edad) || 40;
    const de31 = e >= 31, de51 = e >= 51, de71 = e >= 71;
    return {
      proteinas_g: h ? 56 : 46,
      fibra_g: h ? (de51 ? 30 : 38) : (de51 ? 21 : 25),
      vitamina_a_ug: h ? 900 : 700,
      vitamina_c_mg: h ? 90 : 75,
      vitamina_d_ug: de71 ? 20 : 15,
      vitamina_e_mg: 15,
      vitamina_k_ug: h ? 120 : 90,
      tiamina_b1_mg: h ? 1.2 : 1.1,
      riboflavina_b2_mg: h ? 1.3 : 1.1,
      niacina_b3_mg: h ? 16 : 14,
      pantotenico_b5_mg: 5,
      vitamina_b6_mg: de51 ? (h ? 1.7 : 1.5) : 1.3,
      folato_b9_ug: 400,
      vitamina_b12_ug: 2.4,
      colina_mg: h ? 550 : 425,
      calcio_mg: h ? (de71 ? 1200 : 1000) : (de51 ? 1200 : 1000),
      hierro_mg: h ? 8 : (de51 ? 8 : 18),
      magnesio_mg: h ? (de31 ? 420 : 400) : (de31 ? 320 : 310),
      fosforo_mg: 700,
      potasio_mg: h ? 3400 : 2600,
      sodio_mg: 2300,
      zinc_mg: h ? 11 : 8,
      cobre_mg: 0.9,
      manganeso_mg: h ? 2.3 : 1.8,
      selenio_ug: 55,
    };
  }

  function notaReferencias(edad, sexo) {
    const quien = sexo === "masculino" ? "un hombre" : "una mujer";
    return `Los porcentajes comparan con lo recomendado por día para ${quien} de ${Number(edad) || "?"} años (Academias Nacionales de EE.UU.). ` +
      "Las cantidades son estimaciones a partir de lo que contás o de la foto, con margen de error. " +
      "Es una guía general: si tenés indicaciones de un médico o nutricionista, valen esas.";
  }

  // ---------- números ----------

  // Lo que venga del modelo o de un respaldo viejo: todo número finito y >= 0,
  // y todas las claves presentes, así nadie tiene que preguntar si existe.
  function limpiar(obj, claves) {
    const n = {};
    (claves || CLAVES).forEach((k) => {
      const v = Number(obj && obj[k]);
      n[k] = isFinite(v) && v > 0 ? v : 0;
    });
    return n;
  }

  function sumar(lista, claves) {
    const total = limpiar(null, claves);
    lista.forEach((n) => {
      if (!n) return;
      Object.keys(total).forEach((k) => { total[k] += Number(n[k]) || 0; });
    });
    return total;
  }

  // Sin decimales de más: 1.200 mg, 8,5 mg, 0,45 mg.
  function fmt(v) {
    const n = Number(v) || 0;
    const a = Math.abs(n);
    const dec = a === 0 || a >= 10 ? 0 : a >= 1 ? 1 : 2;
    return n.toLocaleString("es-AR", { maximumFractionDigits: dec });
  }

  function unidad(u) { return u === "ug" ? "µg" : u; }

  // ---------- tabla ----------

  // `destacar` = {clave: nota}: marca el renglón como importante para esta
  // persona (por ejemplo, el sodio con presión alta) y muestra la nota abajo.
  function fila(d, n, refs, destacar) {
    const nota = destacar && destacar[d.k];
    const v = n[d.k] || 0;
    const u = unidad(d.u);
    let pct = null, color = "var(--meta)", texto = "";

    if (d.ref === "meta" && refs[d.k]) {
      pct = (v / refs[d.k]) * 100;
      if (pct >= 100) color = "var(--sage)";
      texto = `${Math.round(pct)}% de ${fmt(refs[d.k])} ${u}`;
    } else if (d.ref === "max" && refs[d.k]) {
      pct = (v / refs[d.k]) * 100;
      if (pct > 100) color = "var(--rust)"; else if (pct >= 80) color = "var(--amber)";
      texto = `${Math.round(pct)}% del máximo (${fmt(refs[d.k])} ${u})`;
    } else if (d.ref === "kcal10" && n.kcal > 0) {
      const deLasKcal = ((v * 9) / n.kcal) * 100;
      pct = deLasKcal * 10; // el 10 % de las kcal es el 100 % de la barra
      if (deLasKcal > 10) color = "var(--rust)"; else if (deLasKcal >= 8) color = "var(--amber)";
      texto = `${fmt(deLasKcal)}% de las kcal (máx. 10%)`;
    }

    return `<div class="nut${d.sub ? " nut-sub" : ""}${nota ? " nut-destacado" : ""}">
      <div class="nut-top"><span>${d.nombre}${nota ? ` <span class="nut-tag">para vos</span>` : ""}</span><span class="nut-val">${fmt(v)} <span class="nut-u">${u}</span></span></div>
      ${pct != null ? `<div class="nut-bar"><div class="track"><i style="width:${Math.min(100, pct).toFixed(0)}%;background:${color};"></i></div><span class="nut-ref">${texto}</span></div>` : ""}
      ${nota ? `<div class="nut-nota">${nota}</div>` : ""}
    </div>`;
  }

  // Devuelve un bloque por grupo, sin envolver: cada pantalla decide si lo mete
  // en una tarjeta, en la hoja de carga o donde sea. `compacta` es una grilla
  // de cantidades sola, para el detalle de una comida.
  function gruposHTML(n, refs, opciones) {
    const compacta = !!(opciones && opciones.compacta);
    return GRUPOS.map((g) => {
      const defs = NUTRIENTES.filter((d) => d.grupo === g.k);
      const html = compacta
        ? `<div class="nut-grid">${defs.map((d) => `<div class="nut-celda"><span>${d.largo || d.nombre}</span><b>${fmt(n[d.k])} ${unidad(d.u)}</b></div>`).join("")}</div>`
        : `<div class="nut-lista">${defs.map((d) => fila(d, n, refs || {}, opciones && opciones.destacar)).join("")}</div>`;
      return { k: g.k, nombre: g.nombre, html };
    });
  }

  // Lo mismo agrupado en Macronutrientes y Micronutrientes; dentro de
  // Micronutrientes, Vitaminas y Minerales con su subtítulo. Un bloque por
  // sección, sin envolver, para que la pantalla la meta en una tarjeta.
  function seccionesHTML(n, refs, opciones) {
    const grupos = gruposHTML(n, refs, opciones);
    return SECCIONES.map((s) => {
      const suyos = GRUPOS.filter((g) => g.seccion === s.k);
      const html = suyos.map((g) => {
        const bloque = grupos.find((x) => x.k === g.k).html;
        // Un grupo que se llama igual que su sección no lleva subtítulo.
        return g.nombre === s.nombre ? bloque : `<div class="nut-subgrupo">${g.nombre}</div>${bloque}`;
      }).join("");
      return { k: s.k, nombre: s.nombre, bajada: s.bajada, html };
    });
  }

  // Las dos secciones seguidas, con su título: para la hoja de carga, el
  // detalle de una comida o un día del historial.
  function seccionesPlanas(n, refs, opciones) {
    const compacta = !!(opciones && opciones.compacta);
    return seccionesHTML(n, refs, opciones).map((s) =>
      `<div class="nut-seccion">${s.nombre}</div>${compacta ? "" : `<div class="nut-bajada">${s.bajada}</div>`}${s.html}`
    ).join("");
  }

  // Los estilos viajan con la tabla para no repetirlos en cada página. Usan los
  // tokens de color de la página (--line, --textDim, --meta, ...).
  const CSS = `
    .nut-lista > .nut + .nut { border-top: 1px solid var(--line); }
    .nut { padding: 9px 0; }
    .nut-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 14px; }
    .nut-sub .nut-top, .nut-sub .nut-bar { padding-left: 14px; }
    .nut-sub .nut-top { color: var(--textDim); font-size: 13px; }
    .nut-val { font-weight: 700; white-space: nowrap; color: var(--text); }
    .nut-u { font-weight: 400; color: var(--textDim); font-size: 12px; }
    .nut-bar { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
    .nut-bar .track { flex: 1; height: 5px; min-width: 40px; }
    .nut-ref { font-size: 11px; color: var(--textDim); white-space: nowrap; }
    .nut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    .nut-celda { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed var(--line); }
    .nut-celda span { color: var(--textDim); }
    .nut-celda b { white-space: nowrap; }
    .nut-tag { font-size: 10px; font-weight: 700; color: var(--amber); border: 1px solid var(--amber); border-radius: 999px; padding: 0 6px; margin-left: 4px; vertical-align: 1px; white-space: nowrap; }
    .nut-nota { font-size: 12px; color: var(--textDim); margin-top: 5px; line-height: 1.4; }
    .nut-grupo { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--textDim); margin: 14px 0 4px; }
    .nut-seccion { font-size: 15px; font-weight: 700; color: var(--text); margin: 18px 0 2px; }
    .nut-bajada { font-size: 12px; color: var(--textDim); margin-bottom: 4px; line-height: 1.4; }
    .nut-subgrupo { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--textDim); margin: 14px 0 2px; padding-top: 10px; border-top: 1px solid var(--line); }
  `;
  const estilo = document.createElement("style");
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  window.Nutrientes = {
    GRUPOS, NUTRIENTES, CLAVES, CLAVES_BASE, CLAVES_DETALLE,
    SECCIONES, referencias, notaReferencias, limpiar, sumar, fmt, unidad, gruposHTML, seccionesHTML, seccionesPlanas,
  };
})();
