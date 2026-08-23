// src/lib/planes.ts
// Reglas de los niveles gratis / donante. Lógica pura y testeable: la decisión
// de si alguien puede usar una función se toma acá y se aplica en el servidor
// (nunca solo en el cliente, que es manipulable).

import { Usuario, Suscripcion } from "@/types";

/** Donación mínima mensual (ARS) para contar como donante. */
export const DONACION_MINIMA_ARS = 5000;

/**
 * Un usuario es donante si su suscripción está marcada como tal Y la fecha de
 * vencimiento del último pago todavía no pasó. Si venció (dejó de pagar, o
 * Mercado Pago no pudo cobrar), vuelve automáticamente al nivel gratis sin
 * necesidad de un proceso que lo degrade.
 */
export function esDonanteActivo(
  suscripcion: Suscripcion | undefined,
  ahora: Date = new Date()
): boolean {
  if (suscripcion?.plan !== "donante") return false;
  if (!suscripcion.donante_activo_hasta) return false;

  const vence = Date.parse(suscripcion.donante_activo_hasta);
  if (Number.isNaN(vence)) return false;

  return vence > ahora.getTime();
}

// NO hay funciones detrás de la donación. Donar no desbloquea nada: es apoyo al
// proyecto. `esDonanteActivo` se usa solo para mostrar el estado y agradecer.
//
// Google Calendar tampoco está limitado: su API es gratuita para nosotros y la
// sincronización se dispara por evento (sin proceso en segundo plano), así que
// cobrarla sería cobrar por algo que no cuesta mantener. Lo único que la acota
// es el rate limiting técnico de la ruta, que está para frenar abuso.
//
// WhatsApp era lo único gateado y quedó fuera de servicio hasta resolver el
// financiamiento (cuesta por mensaje y desde el 1/10/2026 también las
// respuestas). Ver ESTRATEGIA.md.

/** Plan efectivo del usuario, ya considerando vencimientos. */
export function planEfectivo(
  usuario: Pick<Usuario, "suscripcion"> | null | undefined,
  ahora: Date = new Date()
): "gratis" | "donante" {
  return esDonanteActivo(usuario?.suscripcion, ahora) ? "donante" : "gratis";
}
