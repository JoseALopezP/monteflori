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

// Google Calendar NO está limitado por plan. Su API es gratuita para nosotros
// y la sincronización se dispara por evento (no hay proceso en segundo plano),
// así que limitarla sería cobrar por algo que no cuesta mantener. Lo único que
// la acota es el rate limiting técnico de la ruta, que está para frenar abuso.

/** El bot de WhatsApp es exclusivo de donantes. */
export function puedeUsarWhatsApp(
  suscripcion: Suscripcion | undefined,
  ahora: Date = new Date()
): boolean {
  return esDonanteActivo(suscripcion, ahora);
}

/** Plan efectivo del usuario, ya considerando vencimientos. */
export function planEfectivo(
  usuario: Pick<Usuario, "suscripcion"> | null | undefined,
  ahora: Date = new Date()
): "gratis" | "donante" {
  return esDonanteActivo(usuario?.suscripcion, ahora) ? "donante" : "gratis";
}
