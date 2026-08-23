// src/lib/comentarios.ts
// Validación de comentarios. Pura y testeable: la misma función se usa para
// avisar en el formulario y para decidir en el servidor, pero **la que manda es
// la del servidor** — el frontend es manipulable.

export const TEXTO_MIN = 10;
export const TEXTO_MAX = 500;
export const MAX_LINKS = 2;

/** Cuánto hay que esperar entre comentarios. */
export const COOLDOWN_MINUTOS = 2;
/** Tope diario por usuario. */
export const MAX_COMENTARIOS_POR_DIA = 15;

/**
 * Dominios permitidos en los links. Se compara el hostname **exacto** (o un
 * subdominio real), nunca con `includes()`: `bit.ly.attacker.com` contiene
 * "bit.ly" pero es otro dominio.
 *
 * Arranca acotado a material de estudio; se puede ampliar después.
 */
export const DOMINIOS_PERMITIDOS = [
  "drive.google.com",
  "docs.google.com",
  "youtube.com",
  "youtu.be",
  "github.com",
  "wikipedia.org",
];

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
}

/** Extrae las URLs de un texto. */
export function extraerLinks(texto: string): string[] {
  const matches = texto.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return matches.map((u) => u.replace(/[.,;:]+$/, ""));
}

/**
 * ¿El link apunta a un dominio permitido?
 *
 * Compara el hostname exacto o un subdominio legítimo (`sub.drive.google.com`),
 * verificando que el carácter previo sea un punto. Así `evildrive.google.com`
 * o `drive.google.com.attacker.net` quedan afuera.
 */
export function linkPermitido(url: string): boolean {
  let hostname: string;
  try {
    const parsed = new URL(url);
    // Solo http/https: descarta javascript:, data:, file:...
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }

  return DOMINIOS_PERMITIDOS.some(
    (permitido) => hostname === permitido || hostname.endsWith(`.${permitido}`)
  );
}

/** Valida el texto y los links de un comentario. */
export function validarComentario(texto: string): ResultadoValidacion & { links: string[] } {
  const limpio = (texto ?? "").trim();

  if (limpio.length < TEXTO_MIN) {
    return { valido: false, error: `El comentario tiene que tener al menos ${TEXTO_MIN} caracteres.`, links: [] };
  }
  if (limpio.length > TEXTO_MAX) {
    return { valido: false, error: `El comentario no puede superar los ${TEXTO_MAX} caracteres.`, links: [] };
  }

  const links = extraerLinks(limpio);

  if (links.length > MAX_LINKS) {
    return { valido: false, error: `Máximo ${MAX_LINKS} links por comentario.`, links: [] };
  }

  const noPermitido = links.find((l) => !linkPermitido(l));
  if (noPermitido) {
    return {
      valido: false,
      error: `Ese link no está permitido. Por ahora se aceptan: ${DOMINIOS_PERMITIDOS.join(", ")}.`,
      links: [],
    };
  }

  return { valido: true, links };
}

/**
 * ¿Puede comentar ahora? Aplica el cooldown y el tope diario.
 *
 * Se apoya en datos guardados en el documento del usuario (que el cliente no
 * puede escribir), no en memoria del servidor: en serverless cada instancia
 * tiene su propia memoria y el límite se saltearía solo.
 */
export function puedeComentar(
  uso: { ultimo_comentario_en?: string; comentarios_hoy?: number; dia_comentarios?: string } | undefined,
  ahora: Date = new Date()
): ResultadoValidacion {
  const hoy = ahora.toISOString().slice(0, 10);

  if (uso?.ultimo_comentario_en) {
    const ultimo = Date.parse(uso.ultimo_comentario_en);
    if (!Number.isNaN(ultimo)) {
      const minutos = (ahora.getTime() - ultimo) / 60_000;
      if (minutos < COOLDOWN_MINUTOS) {
        const faltan = Math.ceil(COOLDOWN_MINUTOS - minutos);
        return { valido: false, error: `Esperá ${faltan} minuto${faltan === 1 ? "" : "s"} antes de comentar de nuevo.` };
      }
    }
  }

  // El contador solo cuenta si es del día de hoy; si es de ayer, arranca de cero.
  const esDeHoy = uso?.dia_comentarios === hoy;
  const cuantos = esDeHoy ? uso?.comentarios_hoy ?? 0 : 0;

  if (cuantos >= MAX_COMENTARIOS_POR_DIA) {
    return { valido: false, error: "Llegaste al límite de comentarios por hoy." };
  }

  return { valido: true };
}

/** Cuántos reportes distintos ocultan un comentario automáticamente. */
export const REPORTES_PARA_OCULTAR = 3;
