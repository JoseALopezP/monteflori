// src/lib/calendar-fechas.ts
// Convierte una fecha guardada por la app en el horario de un evento de Google
// Calendar.
//
// Las fechas se guardan como las escribe el usuario, SIN zona horaria:
// "2026-03-12T18:30" (con hora) o "2026-03-12" (solo el día). Pasarlas por
// `new Date()` en el servidor las interpreta en la zona del servidor (UTC en
// Vercel), y el parcial de las 18:30 aparecía en el calendario a las 15:30.
// Por eso acá nunca se convierte: se manda la hora tal cual junto con la zona,
// y Google hace la cuenta.

export const ZONA_CALENDAR = "America/Argentina/Buenos_Aires";

const DURACION_HORAS = 2;

// El campo que no se usa va en null a propósito: al actualizar un evento
// (PATCH) Google mezcla lo nuevo con lo que ya tenía, y un evento con `date` y
// `dateTime` a la vez es inválido. El null borra el que sobra.
type Horario =
  | { start: { date: string; dateTime: null }; end: { date: string; dateTime: null } }
  | {
      start: { dateTime: string; timeZone: string; date: null };
      end: { dateTime: string; timeZone: string; date: null };
    };

const dos = (n: number) => String(n).padStart(2, "0");

export function horarioEvento(fecha: string, zona: string = ZONA_CALENDAR): Horario {
  // Solo día → evento de día completo (el fin es exclusivo: el día siguiente).
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (dia) {
    const siguiente = new Date(Date.UTC(+dia[1], +dia[2] - 1, +dia[3] + 1));
    return {
      start: { date: fecha, dateTime: null },
      end: { date: siguiente.toISOString().slice(0, 10), dateTime: null },
    };
  }

  // Día y hora sin zona → es hora local del usuario.
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(fecha);
  if (local) {
    const [, a, m, d, h, min, s = "00"] = local;
    // Date.UTC solo como calculadora de calendario para sumar las horas.
    const fin = new Date(Date.UTC(+a, +m - 1, +d, +h + DURACION_HORAS, +min, +s));
    const finTexto =
      `${fin.getUTCFullYear()}-${dos(fin.getUTCMonth() + 1)}-${dos(fin.getUTCDate())}` +
      `T${dos(fin.getUTCHours())}:${dos(fin.getUTCMinutes())}:${dos(fin.getUTCSeconds())}`;
    return {
      start: { dateTime: `${a}-${m}-${d}T${h}:${min}:${s}`, timeZone: zona, date: null },
      end: { dateTime: finTexto, timeZone: zona, date: null },
    };
  }

  // Ya trae zona (termina en Z o en ±hh:mm): es un instante exacto.
  const inicio = new Date(fecha);
  const fin = new Date(inicio.getTime() + DURACION_HORAS * 60 * 60 * 1000);
  return {
    start: { dateTime: inicio.toISOString(), timeZone: zona, date: null },
    end: { dateTime: fin.toISOString(), timeZone: zona, date: null },
  };
}
