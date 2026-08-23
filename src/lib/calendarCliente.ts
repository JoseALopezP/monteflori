// src/lib/calendarCliente.ts
// Llamadas del cliente a la sincronización con Google Calendar.
//
// La sincronización es "fire and forget" desde la UI: si falla, el servidor
// guarda el error en el perfil y la app lo muestra la próxima vez que entre.
// Así agregar una fecha nunca queda bloqueado esperando a Google.

import { User } from "firebase/auth";

/** Dispara una sincronización. No lanza: los errores quedan registrados en el perfil. */
export async function sincronizarCalendar(
  user: User,
  opciones: { reconciliacion?: boolean } = {}
): Promise<void> {
  try {
    const token = await user.getIdToken();
    await fetch("/api/calendar/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reconciliacion: opciones.reconciliacion ?? false }),
    });
  } catch {
    // Sin conexión, por ejemplo. El repaso diario lo vuelve a intentar.
  }
}

/** Da de baja la sincronización con Google Calendar. */
export async function desconectarCalendar(user: User): Promise<boolean> {
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/calendar/desconectar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * true si corresponde hacer el repaso diario. Se compara por día calendario y
 * no por "hace 24 h" para que abrir la app cada mañana lo dispare siempre.
 */
export function tocaReconciliar(ultima: string | undefined, ahora: Date = new Date()): boolean {
  if (!ultima) return true;

  const fecha = new Date(ultima);
  if (Number.isNaN(fecha.getTime())) return true;

  return (
    fecha.getFullYear() !== ahora.getFullYear() ||
    fecha.getMonth() !== ahora.getMonth() ||
    fecha.getDate() !== ahora.getDate()
  );
}
