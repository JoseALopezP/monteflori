// src/lib/catalogo.ts
// Lógica pura del catálogo compartido de materias.
//
// El catálogo es lo que permite que dos estudiantes de la misma facultad estén
// mirando "la misma" materia y por lo tanto compartan comentarios. Sin él, cada
// usuario tiene sus materias privadas con IDs aleatorios y no hay dónde colgar
// una opinión.

/** Normaliza texto para comparar y buscar: sin acentos, minúsculas, sin espacios de más. */
export function normalizarTexto(texto: string): string {
  return (texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Deriva un identificador estable de institución a partir del hostname que
 * reporta la extensión.
 *
 * "autogestion.guarani.unsj.edu.ar" -> "unsj"
 * "estudiantes.uade.edu.ar"         -> "uade"
 * "lanube.21.edu.ar"                -> "21"
 *
 * La idea es quedarse con la etiqueta anterior al sufijo académico/país, que es
 * la que identifica a la institución. Distintos portales de la misma
 * universidad caen así en la misma clave.
 */
export function institucionIdDesdeHostname(hostname: string): string {
  const limpio = normalizarTexto(hostname).replace(/:\d+$/, "");
  if (!limpio) return "";

  // Se descartan desde el final los sufijos genéricos: ar, edu, com, org, gob...
  const SUFIJOS = new Set(["ar", "edu", "com", "org", "net", "gob", "gov", "int"]);
  const partes = limpio.split(".").filter(Boolean);

  let i = partes.length - 1;
  while (i >= 0 && SUFIJOS.has(partes[i])) i--;

  // Si todo eran sufijos (hostname raro), devolvemos el original normalizado.
  return i >= 0 ? partes[i] : limpio;
}

/**
 * Clave de deduplicación de una materia dentro del catálogo.
 *
 * Se prefiere el código (SIU da cosas como "F12400"): es único por institución
 * y —lo importante— se repite entre carreras, así que una materia que aparece
 * en dos carreras de la misma facultad es una sola entrada y comparte los
 * comentarios. Sin código, se cae al nombre normalizado.
 */
export function claveDeDedup(
  institucionId: string,
  codigo: string | null | undefined,
  nombre: string
): string {
  const inst = normalizarTexto(institucionId);
  const cod = normalizarTexto(codigo ?? "");
  return cod ? `${inst}::cod::${cod}` : `${inst}::nom::${normalizarTexto(nombre)}`;
}

/**
 * ¿Dos materias son la misma? Se usa para sugerir "esta materia ya existe"
 * cuando alguien la carga a mano.
 */
export function esLaMismaMateria(
  a: { institucion_id: string; codigo?: string | null; nombre_normalizado: string },
  b: { institucion_id: string; codigo?: string | null; nombre_normalizado: string }
): boolean {
  if (normalizarTexto(a.institucion_id) !== normalizarTexto(b.institucion_id)) return false;

  const codA = normalizarTexto(a.codigo ?? "");
  const codB = normalizarTexto(b.codigo ?? "");

  // Si ambas tienen código, manda el código: dos materias con códigos distintos
  // son distintas aunque se llamen parecido.
  if (codA && codB) return codA === codB;

  return normalizarTexto(a.nombre_normalizado) === normalizarTexto(b.nombre_normalizado);
}

/** Rango para buscar por prefijo en Firestore (autocompletado del nombre). */
export function rangoBusquedaPrefijo(consulta: string): { desde: string; hasta: string } {
  const desde = normalizarTexto(consulta);
  //  es el último carácter del rango Unicode usable: cubre todo lo que
  // empiece con `desde`.
  return { desde, hasta: `${desde}` };
}
