// extension/content.js
// Content script inyectado en portales universitarios (.edu.ar, .edu)
// Scraper real para SIU Guaraní (autogestion.guarani.*), módulo "Plan de estudio".
// Responde a mensajes del background (chrome.runtime.onMessage), NO usa
// postMessage: la pestaña del portal y la del dashboard son pestañas
// distintas, así que window.postMessage entre ellas no llega a destino.

console.log("[Monteflori] Content script cargado en:", window.location.hostname);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SGAI_SCRAPE_GUARANI") {
    const promesa = esSiuGuarani() ? extraerGuarani() : Promise.resolve(extraerGenerico());
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

// ── Parseo de una fila <tr class="materia"> ─────────────────

function parseFilaMateria(fila) {
  const celdas = fila.querySelectorAll("td");
  if (celdas.length < 6) return null;

  const [tdNombre, , tdAnio, tdPeriodo, tdNota, tdOrigen] = celdas;

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

// ── Detección de portal ──────────────────────────────────────

function esSiuGuarani() {
  return (
    !!document.querySelector("#info_plan") ||
    !!document.querySelector(".js-select-carreras") ||
    window.location.hostname.includes("guarani") ||
    document.title.toLowerCase().includes("guaraní")
  );
}

// ── Orquestador principal ───────────────────────────────────

async function extraerGuarani() {
  const filasMateria = Array.from(document.querySelectorAll("table.table-bordered.table-condensed tr.materia"));

  if (filasMateria.length === 0) {
    throw new Error(
      "No se encontraron materias en esta página. Abrí Plan de estudio → Reportes → Plan de estudio en SIU Guaraní."
    );
  }

  const materias = [];

  for (const fila of filasMateria) {
    const materia = parseFilaMateria(fila);
    if (!materia) continue;
    materia.correlativas_nombres = await cargarCorrelativasDeFila(fila);
    materias.push(materia);
  }

  return {
    portal: "SIU Guaraní",
    universidad: window.location.hostname,
    carrera: obtenerCarreraActiva(),
    materias,
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
    carrera: null,
    materias,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };
}
