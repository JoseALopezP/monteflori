// src/lib/rate-limit.ts
// Rate limiting en memoria para las rutas de API.
//
// LIMITACIÓN IMPORTANTE: en Vercel cada instancia serverless tiene su propia
// memoria y se recicla seguido, así que esto NO es un límite global exacto —
// alguien con muchas instancias en paralelo puede superarlo. Sirve para frenar
// el abuso obvio (un script pegándole en loop) y para que un bug del cliente no
// dispare cientos de llamadas a APIs que se pagan por uso.
//
// Para un límite estricto haría falta un store compartido (Redis/Upstash).
// La defensa de fondo contra tráfico masivo es Cloudflare adelante del dominio.

interface Ventana {
  contador: number;
  expiraEn: number;
}

const ventanas = new Map<string, Ventana>();

/** Evita que el Map crezca sin fin si llegan muchas claves distintas. */
function limpiarVencidas(ahora: number) {
  if (ventanas.size < 5000) return;
  for (const [clave, v] of ventanas) {
    if (v.expiraEn <= ahora) ventanas.delete(clave);
  }
}

export interface ResultadoRateLimit {
  permitido: boolean;
  /** Segundos que faltan para poder reintentar (solo si no está permitido). */
  reintentarEn: number;
}

/**
 * Aplica una ventana fija por clave (típicamente el uid del usuario).
 *
 * @param clave      identificador del que hace el pedido, ej. `calendar:${uid}`
 * @param maxPedidos cuántos pedidos se permiten dentro de la ventana
 * @param ventanaMs  duración de la ventana en milisegundos
 */
export function verificarRateLimit(
  clave: string,
  maxPedidos: number,
  ventanaMs: number,
  ahora: number = Date.now()
): ResultadoRateLimit {
  limpiarVencidas(ahora);

  const actual = ventanas.get(clave);

  if (!actual || actual.expiraEn <= ahora) {
    ventanas.set(clave, { contador: 1, expiraEn: ahora + ventanaMs });
    return { permitido: true, reintentarEn: 0 };
  }

  if (actual.contador >= maxPedidos) {
    return {
      permitido: false,
      reintentarEn: Math.ceil((actual.expiraEn - ahora) / 1000),
    };
  }

  actual.contador++;
  return { permitido: true, reintentarEn: 0 };
}

/** Solo para tests: vacía el estado acumulado. */
export function resetRateLimit() {
  ventanas.clear();
}
