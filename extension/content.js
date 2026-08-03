// extension/content.js
// Content script inyectado en portales universitarios (.edu.ar, .edu)
// Scraper real para SIU Guaraní (autogestion.guarani.*), módulo "Plan de estudio".
// Responde a mensajes del background (chrome.runtime.onMessage), NO usa
// postMessage: la pestaña del portal y la del dashboard son pestañas
// distintas, así que window.postMessage entre ellas no llega a destino.

console.log("[Monteflori] Content script cargado en:", window.location.hostname);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SGAI_SCRAPE_GUARANI") {
    const promesa = esSiuGuarani() ? sincronizarTodo() : Promise.resolve(extraerGenerico());
    promesa
      .then((datos) => sendResponse({ ok: true, datos }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
    return true; // canal async abierto
  }
});

// ── Utilidades de espera ────────────────────────────────────

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarCondicion(fn, timeoutMs = 8000, intervaloMs = 150) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    if (fn()) return true;
    await esperar(intervaloMs);
  }
  return false;
}

// ── Normalización de texto (para comparar headers/estados sin acentos) ──

function normalizar(s) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ── Parsers de campos individuales ──────────────────────────

/** "Adquisición de Lenguas (F12400)" → { nombre, codigo } */
function parseNombreCodigo(texto) {
  const t = texto.trim();
  const m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { nombre: m[1].trim(), codigo: m[2].trim() } : { nombre: t, codigo: undefined };
}

/** "10 (Promocionado)" / "9 (Aprobado)" / "" → { nota, calificador } */
function parseNota(texto) {
  const t = (texto ?? "").trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*\(([^)]+)\)/);
  if (!m) return { nota: null, calificador: null };
  return { nota: parseFloat(m[1].replace(",", ".")), calificador: m[2].trim() };
}

/** "1er Cuatrimestre" / "2do Cuatrimestre" / "Anual" → 1 | 2 | 0 | undefined */
function mapCuatrimestre(periodo) {
  const p = (periodo ?? "").toLowerCase();
  if (p.includes("1er")) return 1;
  if (p.includes("2do")) return 2;
  if (p.includes("anual")) return 0;
  return undefined;
}

/** Infiere el EstadoMateria de la app a partir de Origen + calificador de la nota */
function inferirEstado(origen, calificador) {
  const o = (origen ?? "").toLowerCase();
  const c = (calificador ?? "").toLowerCase();
  if (c.includes("promocion") || c.includes("aprobad")) return "aprobada";
  if (c.includes("libre")) return "libre";
  if (c.includes("regular")) return "regular";
  if (o.includes("en curso")) return "cursando";
  if (o.includes("regular")) return "regular";
  if (o.includes("libre")) return "libre";
  return "pendiente";
}

// ── Ubicación de la tabla de materias y mapeo de columnas ────
//
// Distintas instancias/versiones de SIU Guaraní pueden variar el orden o la
// presencia de columnas del "Plan de estudio". En vez de asumir posiciones
// fijas, leemos el <thead> y mapeamos cada columna por su texto — así el
// scraper no se rompe si, por ejemplo, "Créditos" no existe en tu facultad
// o el orden difiere del de UNSJ (única instancia contra la que probamos).

const COLUMNAS_CONOCIDAS = 6; // fallback si no hay <thead> reconocible

function encontrarTablaMaterias() {
  const especifica = document.querySelector("table.table-bordered.table-condensed");
  if (especifica && especifica.querySelector("tr.materia")) return especifica;

  // Fallback: cualquier tabla cuyo header mencione "actividad" y "nota"
  return (
    Array.from(document.querySelectorAll("table")).find((t) => {
      const header = normalizar(t.querySelector("thead")?.textContent);
      return header.includes("actividad") && header.includes("nota");
    }) ?? null
  );
}

function mapearColumnas(tabla) {
  const ths = Array.from(tabla?.querySelectorAll("thead th") ?? []);
  const indice = { nombre: 0, anio: 2, periodo: 3, nota: 4, origen: 5 }; // default UNSJ

  if (ths.length === 0) return indice;

  ths.forEach((th, i) => {
    const t = normalizar(th.textContent);
    if (t.includes("actividad")) indice.nombre = i;
    else if (t.includes("ano") || t.includes("anio")) indice.anio = i;
    else if (t.includes("periodo")) indice.periodo = i;
    else if (t.includes("nota")) indice.nota = i;
    else if (t.includes("origen")) indice.origen = i;
  });

  return indice;
}

// ── Parseo de una fila <tr class="materia"> ─────────────────

function parseFilaMateria(fila, columnas) {
  const celdas = fila.querySelectorAll("td");
  if (celdas.length < COLUMNAS_CONOCIDAS) return null;

  const tdNombre = celdas[columnas.nombre];
  const tdAnio = celdas[columnas.anio];
  const tdPeriodo = celdas[columnas.periodo];
  const tdNota = celdas[columnas.nota];
  const tdOrigen = celdas[columnas.origen];
  if (!tdNombre) return null;

  const { nombre, codigo } = parseNombreCodigo(tdNombre.textContent);
  if (!nombre) return null;

  const { nota, calificador } = parseNota(tdNota?.textContent);
  const origen = tdOrigen?.textContent.trim() || null;
  const periodoTexto = tdPeriodo?.textContent.trim() || null;
  const anioTexto = tdAnio?.textContent.trim();

  return {
    nombre,
    codigo_interno: codigo,
    año_plan: anioTexto ? parseInt(anioTexto, 10) : undefined,
    cuatrimestre_plan: mapCuatrimestre(periodoTexto),
    periodo_texto: periodoTexto,
    nota,
    estado: inferirEstado(origen, calificador),
    correlativas_nombres: [],
  };
}

// ── Correlativas ("Para cursar", primera opción) ────────────

/**
 * Dentro del <td class="td-table-correlativas"> extrae los nombres de la
 * primera tabla de "Para cursar" (primera opción, si hay varias alternativas
 * OR se toma solo la primera — simplificación consciente para v1).
 */
function extraerCorrelativas(td) {
  const html = td.innerHTML;
  const idxAprobar = html.indexOf("Para aprobar");
  const soloCursar = idxAprobar > -1 ? html.slice(0, idxAprobar) : html;

  const temp = document.createElement("div");
  temp.innerHTML = soloCursar;

  const tabla = temp.querySelector("table.table-correlativas");
  if (!tabla) return [];

  return Array.from(tabla.querySelectorAll("tbody tr td:first-child"))
    .map((td2) => parseNombreCodigo(td2.textContent).nombre) // recorta el "(código)" final
    .filter(Boolean);
}

/**
 * Hace click en el link "Ver" de correlativas de una fila y espera a que el
 * AJAX del portal complete (data-completo pasa a "true"), luego parsea.
 */
async function cargarCorrelativasDeFila(filaMateria) {
  // El link "Ver" vive en la última celda de la propia fila de la materia
  // (columna "Correlativas"), NO en la fila siguiente.
  const link = filaMateria.querySelector("a.ver_correlatividades");
  if (!link) return []; // esta materia no tiene correlativas

  const filaSiguiente = filaMateria.nextElementSibling;
  if (!filaSiguiente || !filaSiguiente.classList.contains("correlatividades")) return [];

  if (link.dataset.completo !== "true") {
    link.click();
    const cargo = await esperarCondicion(() => link.dataset.completo === "true", 8000);
    if (!cargo) return [];
  }

  const td = filaSiguiente.querySelector("td.td-table-correlativas");
  return td ? extraerCorrelativas(td) : [];
}

// ── Nombre de la carrera activa ─────────────────────────────

function obtenerCarreraActiva() {
  const boton = document.querySelector("#js-dropdown-toggle-carreras");
  if (boton) {
    // El botón tiene el nombre como primer nodo de texto + un <span class="caret">
    const texto = Array.from(boton.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (texto) return texto;
  }
  const seleccionada = document.querySelector(".js-select-carreras.selected");
  return seleccionada?.getAttribute("title")?.trim() ?? seleccionada?.textContent?.trim() ?? null;
}

// ── Navegación entre secciones (SPA vía AJAX/pagelets) ───────
//
// Los links de "Reportes" (Plan de estudio, Historia académica, etc.) y el
// dropdown de carreras NO recargan la página — SIU Guaraní los intercepta y
// reemplaza el contenido vía AJAX. Por eso el content script no se pierde:
// solo hay que clickear y esperar a que aparezca el marcador de la sección
// destino. click() vía JS funciona aunque el link esté oculto por CSS
// (dropdown cerrado), no hace falta abrir el menú primero.

async function irASeccion(idNavLi, marcadorSelector) {
  if (document.querySelector(marcadorSelector)) return true; // ya estamos ahí
  const link = document.querySelector(`#${idNavLi} a`);
  if (!link) return false;
  link.click();
  const ok = await esperarCondicion(() => !!document.querySelector(marcadorSelector), 10000);
  if (ok) await esperar(300); // margen para que termine de pintar el contenido
  return ok;
}

// ── Cambio de carrera activa ──────────────────────────────────

function obtenerCarrerasDisponibles() {
  return Array.from(document.querySelectorAll(".js-select-carreras[data-carrera-id]")).map((a) => ({
    id: a.dataset.carreraId,
    nombre: (a.getAttribute("title") || a.textContent || "").trim(),
    seleccionada: a.classList.contains("selected"),
  }));
}

async function cambiarCarrera(carreraId) {
  const link = document.querySelector(`.js-select-carreras[data-carrera-id="${carreraId}"]`);
  if (!link) return false;
  if (link.classList.contains("selected")) return true;

  const tituloPrevio = obtenerCarreraActiva();
  link.click();
  const ok = await esperarCondicion(() => obtenerCarreraActiva() !== tituloPrevio, 10000);
  if (ok) await esperar(400);
  return ok;
}

// ── Historia académica (fechas y notas reales de cada acto) ──
//
// Complementa el Plan de estudio: da fecha exacta y nota de cada regularidad/
// promoción/examen, no solo el período. Se cruza con Plan de estudio por
// código de materia (ej. "F12400"), que aparece igual en ambas páginas.

const ATRIBUTOS_TIPO_ACTO = ["encurso", "regularidad", "promocion", "examen"];

function normalizarEspacios(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** "18/11/2025" → "2025-11-18" (ISO, más útil para ordenar/graficar) */
function fechaArToISO(texto) {
  const m = (texto ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseCatedra(divCatedra) {
  const atributo = ATRIBUTOS_TIPO_ACTO.find((a) => divCatedra.hasAttribute(a));
  if (!atributo) return null;

  const resultado = divCatedra.getAttribute(atributo) || null;
  const span = divCatedra.querySelector(".catedra_nombre span");
  const texto = normalizarEspacios(span?.textContent);

  const notaMatch = texto.match(/(\d{1,2})\s*\([^)]*\)/);
  const nota = notaMatch ? parseInt(notaMatch[1], 10) : null;
  const fecha = fechaArToISO(texto);

  const divInfo = divCatedra.querySelector(".toggle_info_catedra");
  const vencimiento = divInfo ? fechaArToISO(divInfo.textContent.match(/Vencimiento:\s*[\d/]+/)?.[0]) : null;

  return {
    tipo: atributo === "encurso" ? "en_curso" : atributo,
    resultado,
    nota,
    fecha,
    vencimiento,
  };
}

/** Click en "Historia completa" del cuadro de consultas habituales, si existe. */
async function irAHistoriaCompleta() {
  const link = document.querySelector('.js-consultas_habituales a[consulta="todo"]');
  if (!link) return; // puede que ya muestre todo por defecto
  link.click();
  await esperar(600);
}

function extraerHistoriaAcademica() {
  const grupos = Array.from(document.querySelectorAll("#listado > .catedras"));
  return grupos
    .map((grupo) => {
      const tituloTexto = grupo.querySelector("h3.titulo-corte")?.textContent ?? "";
      const { nombre, codigo } = parseNombreCodigo(tituloTexto);
      const actos = Array.from(grupo.querySelectorAll(":scope > .catedra"))
        .map(parseCatedra)
        .filter(Boolean);
      return { nombre, codigo_interno: codigo, actos };
    })
    .filter((m) => m.nombre);
}

/**
 * Cruza los actos de Historia académica con las materias de Plan de estudio
 * por código. Prioriza la nota/fecha de Promoción, y si no hay, la de Examen
 * aprobado — eso es lo que efectivamente aprueba la materia.
 */
function fusionarHistoria(materiasPlan, materiasHistoria) {
  const historiaPorCodigo = new Map();
  materiasHistoria.forEach((h) => {
    if (h.codigo_interno) historiaPorCodigo.set(h.codigo_interno, h);
  });

  return materiasPlan.map((m) => {
    const h = m.codigo_interno ? historiaPorCodigo.get(m.codigo_interno) : null;
    if (!h) return m;

    const promocion = h.actos.find((a) => a.tipo === "promocion");
    const examenAprobado = h.actos.find((a) => a.tipo === "examen" && /aprob/i.test(a.resultado ?? ""));
    const actoFinal = promocion ?? examenAprobado;

    return {
      ...m,
      nota: actoFinal?.nota ?? m.nota,
      fecha_aprobacion: actoFinal?.fecha ?? null,
      actos_academicos: h.actos,
    };
  });
}

// ── Detección de portal ──────────────────────────────────────

function esSiuGuarani() {
  return (
    !!document.querySelector("#info_plan") ||
    !!document.querySelector(".js-select-carreras") ||
    window.location.hostname.includes("guarani") ||
    document.title.toLowerCase().includes("guaraní")
  );
}

// ── Extracción de la sección "Plan de estudio" actualmente visible ──

async function extraerPlanDeEstudioActual() {
  const tabla = encontrarTablaMaterias();

  if (!tabla) {
    throw new Error(
      "No se encontró la tabla de materias. Puede que esta instancia de Guaraní use una estructura distinta a la esperada."
    );
  }

  const columnas = mapearColumnas(tabla);
  const filasMateria = Array.from(tabla.querySelectorAll("tr.materia"));

  if (filasMateria.length === 0) {
    throw new Error("La tabla de materias está vacía o no se reconoció ninguna fila.");
  }

  const materias = [];
  const errores = [];

  // Cada fila se procesa de forma aislada: si una falla (estructura inesperada,
  // AJAX de correlativas que no responde, etc.) seguimos con el resto en vez
  // de perder toda la sincronización.
  for (const fila of filasMateria) {
    let materia;
    try {
      materia = parseFilaMateria(fila, columnas);
      if (!materia) continue;
    } catch (err) {
      errores.push(`No se pudo leer una fila de materia: ${err?.message ?? err}`);
      continue;
    }

    try {
      materia.correlativas_nombres = await cargarCorrelativasDeFila(fila);
    } catch (err) {
      errores.push(`No se pudieron cargar las correlativas de "${materia.nombre}": ${err?.message ?? err}`);
    }

    materias.push(materia);
  }

  return { materias, errores };
}

// ── Orquestador principal: recorre cada carrera y ambas secciones ──

async function sincronizarTodo() {
  const errores = [];
  const disponibles = obtenerCarrerasDisponibles();
  const listaCarreras = disponibles.length > 0
    ? disponibles
    : [{ id: null, nombre: obtenerCarreraActiva() }];

  const resultado = [];

  for (const c of listaCarreras) {
    if (c.id) {
      const cambio = await cambiarCarrera(c.id);
      if (!cambio) {
        errores.push(`No se pudo cambiar a la carrera "${c.nombre}" — se omite.`);
        continue;
      }
    }

    let materias = [];

    try {
      const llegoAPlan = await irASeccion("plan_estudio", "#info_plan");
      if (!llegoAPlan) throw new Error("no se pudo abrir la sección");
      const datosPlan = await extraerPlanDeEstudioActual();
      materias = datosPlan.materias;
      datosPlan.errores.forEach((e) => errores.push(`[${c.nombre}] Plan de estudio: ${e}`));
    } catch (err) {
      errores.push(`[${c.nombre}] Plan de estudio: ${err?.message ?? err}`);
      continue; // sin plan de estudio no hay nada que importar de esta carrera
    }

    try {
      const llegoAHistoria = await irASeccion("historia_academica", "#info_historia");
      if (llegoAHistoria) {
        await irAHistoriaCompleta();
        const materiasHistoria = extraerHistoriaAcademica();
        materias = fusionarHistoria(materias, materiasHistoria);
      } else {
        errores.push(`[${c.nombre}] No se pudo abrir Historia académica (se importó igual el Plan de estudio).`);
      }
    } catch (err) {
      errores.push(`[${c.nombre}] Historia académica: ${err?.message ?? err}`);
    }

    resultado.push({ carrera: c.nombre, materias });
  }

  return {
    portal: "SIU Guaraní",
    universidad: window.location.hostname,
    carreras: resultado,
    errores: errores.length > 0 ? errores : undefined,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
}

// ── Fallback genérico (otros portales, ej. AulasWeb) ────────

function extraerGenerico() {
  const materias = [];
  document.querySelectorAll("table").forEach((tabla) => {
    tabla.querySelectorAll("tr").forEach((fila) => {
      const celdas = fila.querySelectorAll("td");
      if (celdas.length < 2) return;
      const nombre = celdas[0]?.innerText?.trim();
      const notaTexto = celdas[celdas.length - 1]?.innerText?.trim();
      const nota = parseFloat(notaTexto);
      if (nombre && nombre.length > 2 && nombre.length < 100) {
        materias.push({
          nombre,
          nota: !isNaN(nota) && nota >= 0 && nota <= 10 ? nota : null,
          estado: "pendiente",
          correlativas_nombres: [],
        });
      }
    });
  });
  return {
    portal: "generico",
    universidad: window.location.hostname,
    carreras: [{ carrera: null, materias }],
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
}
