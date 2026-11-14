// src/lib/fechas.ts
// Fechas de examen: una sola forma de decidir qué es "próximo" y cómo decirlo.
//
// Todo se compara por día calendario. Antes se comparaba contra la hora exacta,
// así que un parcial de hoy a las 9 desaparecía a las 9:01 y uno de ayer a la
// tarde seguía figurando como "en 0 días".

import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { FechaImportante, Materia } from "@/types";

export function parsearFecha(fecha: string | null | undefined): Date | null {
  if (!fecha) return null;
  const d = parseISO(fecha);
  return isValid(d) ? d : null;
}

/** Días calendario hasta la fecha: 0 = hoy, 1 = mañana, negativo = ya pasó. null si no es válida. */
export function diasHasta(fecha: string | null | undefined, hoy: Date = new Date()): number | null {
  const d = parsearFecha(fecha);
  return d ? differenceInCalendarDays(d, hoy) : null;
}

/** true si la fecha es hoy o más adelante */
export function esProxima(fecha: string | null | undefined, hoy: Date = new Date()): boolean {
  const dias = diasHasta(fecha, hoy);
  return dias !== null && dias >= 0;
}

/** "Hoy", "Mañana", "En 5 días", "Hace 2 días", "12 de mar" */
export function etiquetaRelativa(fecha: string, hoy: Date = new Date()): string {
  const dias = diasHasta(fecha, hoy);
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Ayer";
  if (dias > 1 && dias <= 14) return `En ${dias} días`;
  if (dias < -1 && dias >= -14) return `Hace ${-dias} días`;
  return format(parsearFecha(fecha)!, "d 'de' MMM", { locale: es });
}

/** true si la fecha guardada trae hora (viene de un datetime-local) */
function tieneHora(fecha: string): boolean {
  return /T\d{2}:\d{2}/.test(fecha) && !/T00:00/.test(fecha);
}

/** "mié 12 de marzo · 18:30" (la hora solo si se cargó) */
export function formatearFechaLarga(fecha: string): string {
  const d = parsearFecha(fecha);
  if (!d) return "Sin fecha";
  const dia = format(d, "EEE d 'de' MMMM", { locale: es });
  return tieneHora(fecha) ? `${dia} · ${format(d, "HH:mm")}` : dia;
}

export function formatearFechaCorta(fecha: string): string {
  const d = parsearFecha(fecha);
  return d ? format(d, "d MMM", { locale: es }) : "—";
}

export interface FechaDeMateria extends FechaImportante {
  materiaId: string;
  materiaNombre: string;
}

/** Todas las fechas de hoy en adelante, de la más cercana a la más lejana */
export function proximasFechas(materias: Materia[], hoy: Date = new Date()): FechaDeMateria[] {
  return materias
    .flatMap((m) =>
      (m.fechas_importantes ?? []).map((f) => ({ ...f, materiaId: m.id, materiaNombre: m.nombre }))
    )
    .filter((f) => esProxima(f.fecha, hoy))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
