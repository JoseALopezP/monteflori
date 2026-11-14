// src/lib/ics.ts
// Arma archivos de calendario en formato iCalendar (.ics), el estándar que
// abren Apple Calendar, Samsung Calendar, Outlook y Google Calendar. Es la vía
// para llevar las fechas de examen a cualquier calendario sin conectar ninguna
// cuenta: se descarga el archivo y el dispositivo ofrece agregarlo.
//
// Todo acá es puro (texto que entra, texto que sale) para poder testearlo. La
// descarga en sí está en `descargarIcs`, al final.

import { infoTipo } from "./estados";
import { FechaImportante } from "@/types";

export interface EventoIcs extends Pick<FechaImportante, "id" | "nombre" | "tipo" | "fecha"> {
  materiaNombre: string;
}

const DURACION_HORAS = 2;

/**
 * Argentina está en UTC-3 todo el año (no cambia la hora desde 2009). Las
 * fechas se guardan en hora local sin zona, así que para escribirlas en el
 * archivo se pasan a UTC sumando 3 horas. Se usa UTC y no "hora local +
 * nombre de zona" porque así no hace falta incluir la definición de la zona,
 * que es donde más difieren los calendarios al leer un .ics.
 */
const DESFASE_UTC_HORAS = 3;

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha de un Date ya corrido a UTC → "20261116T213000Z" */
function aUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}` +
    `T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`
  );
}

/** Los caracteres que el formato reserva van escapados. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * El estándar pide líneas de 75 bytes como máximo; las más largas se cortan y
 * la continuación arranca con un espacio. Se cuenta en bytes y no en letras
 * para no partir una "á" o una "ñ" por la mitad.
 */
function plegar(linea: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(linea).length <= 75) return linea;

  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const caracter of linea) {
    const peso = encoder.encode(caracter).length;
    // Las líneas de continuación llevan un espacio adelante: les queda 1 byte menos.
    const tope = partes.length === 0 ? 75 : 74;
    if (bytes + peso > tope) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += caracter;
    bytes += peso;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

/** Inicio y fin del evento, o null si la fecha guardada no se puede interpretar. */
function horario(fecha: string): string[] | null {
  // Solo día → evento de día completo (el fin es exclusivo: el día siguiente).
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (dia) {
    const siguiente = new Date(Date.UTC(+dia[1], +dia[2] - 1, +dia[3] + 1));
    const fin = `${siguiente.getUTCFullYear()}${dos(siguiente.getUTCMonth() + 1)}${dos(siguiente.getUTCDate())}`;
    return [`DTSTART;VALUE=DATE:${dia[1]}${dia[2]}${dia[3]}`, `DTEND;VALUE=DATE:${fin}`];
  }

  // Día y hora sin zona → hora de Argentina.
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(fecha);
  if (local) {
    const [, a, m, d, h, min, s = "0"] = local;
    const inicio = new Date(Date.UTC(+a, +m - 1, +d, +h + DESFASE_UTC_HORAS, +min, +s));
    const fin = new Date(inicio.getTime() + DURACION_HORAS * 60 * 60 * 1000);
    return [`DTSTART:${aUtc(inicio)}`, `DTEND:${aUtc(fin)}`];
  }

  // Ya trae zona (termina en Z o ±hh:mm): es un instante exacto.
  const instante = new Date(fecha);
  if (Number.isNaN(instante.getTime())) return null;
  const fin = new Date(instante.getTime() + DURACION_HORAS * 60 * 60 * 1000);
  return [`DTSTART:${aUtc(instante)}`, `DTEND:${aUtc(fin)}`];
}

/** "Parcial 1 · Álgebra" (sin repetir el tipo si el nombre ya lo dice) */
export function tituloEvento(e: EventoIcs): string {
  return `${e.nombre} · ${e.materiaNombre}`;
}

/**
 * Arma el contenido de un archivo .ics con los eventos dados. Los que tienen
 * una fecha que no se puede interpretar se saltean. `ahora` es el momento de
 * generación (se pasa por parámetro para que los tests sean estables).
 */
export function generarIcs(eventos: EventoIcs[], ahora: Date = new Date()): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Monteflori//Fechas de examen//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Monteflori",
  ];

  for (const e of eventos) {
    const cuando = horario(e.fecha);
    if (!cuando) continue;
    lineas.push(
      "BEGIN:VEVENT",
      // El mismo identificador en cada descarga: si el calendario ya tiene el
      // evento, lo actualiza en vez de duplicarlo.
      `UID:${e.id}@monteflori`,
      `DTSTAMP:${aUtc(ahora)}`,
      ...cuando,
      `SUMMARY:${escapar(tituloEvento(e))}`,
      `DESCRIPTION:${escapar(`${infoTipo(e.tipo).label} de ${e.materiaNombre}. Agregado desde Monteflori.`)}`,
      // Los mismos dos avisos que en Google Calendar: un día antes y una hora antes.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(tituloEvento(e))}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(tituloEvento(e))}`,
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lineas.push("END:VCALENDAR");
  // El estándar exige saltos de línea CRLF, también al final.
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

/** "Parcial 1 · Álgebra II" → "parcial-1-algebra-ii" */
export function nombreDeArchivo(texto: string): string {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${limpio || "monteflori"}.ics`;
}

/**
 * Descarga el archivo en el dispositivo. Al abrirlo, el sistema ofrece
 * agregarlo al calendario que el usuario tenga configurado.
 */
export function descargarIcs(eventos: EventoIcs[], archivo: string): void {
  const blob = new Blob([generarIcs(eventos)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = archivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Un momento después: algunos navegadores cancelan la descarga si la URL se libera en el acto.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
