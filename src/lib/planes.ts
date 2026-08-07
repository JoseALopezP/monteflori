// src/lib/planes.ts
// Reglas de los niveles gratis / donante. Lógica pura y testeable: la decisión
// de si alguien puede usar una función se toma acá y se aplica en el servidor
// (nunca solo en el cliente, que es manipulable).

import { Usuario, Suscripcion, Uso } from "@/types";

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

/**
 * En el nivel gratis se puede sincronizar con Google Calendar una vez por mes
 * calendario. Los donantes no tienen límite.
 */
export function puedeSincronizarCalendar(
  suscripcion: Suscripcion | undefined,
  uso: Uso | undefined,
  ahora: Date = new Date()
): { permitido: boolean; motivo?: string } {
  if (esDonanteActivo(suscripcion, ahora)) return { permitido: true };

  const ultima = uso?.ultima_sincronizacion_calendar;
  if (!ultima) return { permitido: true };

  const fechaUltima = new Date(ultima);
  if (Number.isNaN(fechaUltima.getTime())) return { permitido: true };

  const mismoMes =
    fechaUltima.getFullYear() === ahora.getFullYear() &&
    fechaUltima.getMonth() === ahora.getMonth();

  if (!mismoMes) return { permitido: true };

  return {
    permitido: false,
    motivo:
      "Ya usaste tu sincronización con Google Calendar de este mes. " +
      "Con una donación tenés sincronizaciones ilimitadas.",
  };
}

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
