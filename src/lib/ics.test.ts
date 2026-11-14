import { describe, it, expect } from "vitest";
import { EventoIcs, generarIcs, nombreDeArchivo } from "./ics";

const AHORA = new Date(Date.UTC(2026, 10, 14, 12, 0, 0));

function evento(overrides: Partial<EventoIcs> = {}): EventoIcs {
  return {
    id: "fecha_1",
    nombre: "Parcial 1",
    tipo: "parcial",
    fecha: "2026-11-16T18:30",
    materiaNombre: "Álgebra",
    ...overrides,
  };
}

const lineasDe = (ics: string) => ics.split("\r\n");

describe("generarIcs", () => {
  it("arma un calendario válido aunque no haya eventos", () => {
    const ics = generarIcs([], AHORA);
    expect(lineasDe(ics)[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("pasa la hora de Argentina a UTC sumando 3 horas, con dos horas de duración", () => {
    const lineas = lineasDe(generarIcs([evento()], AHORA));
    expect(lineas).toContain("DTSTART:20261116T213000Z");
    expect(lineas).toContain("DTEND:20261116T233000Z");
  });

  it("cruza de día cuando la hora en UTC cae al día siguiente", () => {
    const lineas = lineasDe(generarIcs([evento({ fecha: "2026-12-31T22:00" })], AHORA));
    expect(lineas).toContain("DTSTART:20270101T010000Z");
    expect(lineas).toContain("DTEND:20270101T030000Z");
  });

  it("crea un evento de día completo cuando la fecha no tiene hora", () => {
    const lineas = lineasDe(generarIcs([evento({ fecha: "2026-02-28" })], AHORA));
    expect(lineas).toContain("DTSTART;VALUE=DATE:20260228");
    expect(lineas).toContain("DTEND;VALUE=DATE:20260301");
  });

  it("usa un identificador estable para que volver a descargar no duplique", () => {
    const a = generarIcs([evento()], AHORA);
    const b = generarIcs([evento()], new Date(Date.UTC(2027, 0, 1)));
    expect(lineasDe(a)).toContain("UID:fecha_1@monteflori");
    expect(lineasDe(b)).toContain("UID:fecha_1@monteflori");
  });

  it("pone los dos recordatorios: un día antes y una hora antes", () => {
    const lineas = lineasDe(generarIcs([evento()], AHORA));
    expect(lineas).toContain("TRIGGER:-P1D");
    expect(lineas).toContain("TRIGGER:-PT1H");
  });

  it("escapa comas, punto y coma y barras en los textos", () => {
    const lineas = lineasDe(generarIcs([evento({ nombre: "TP 1; parte a, b", materiaNombre: "Redes \\ Sistemas" })], AHORA));
    expect(lineas).toContain("SUMMARY:TP 1\\; parte a\\, b · Redes \\\\ Sistemas");
  });

  it("corta las líneas largas en 75 bytes sin partir letras con tilde", () => {
    const nombre = "Recuperatorio del segundo parcial de Análisis Matemático con ñandú y pingüino";
    const ics = generarIcs([evento({ nombre, materiaNombre: "Introducción a la Programación Orientada a Objetos" })], AHORA);
    const encoder = new TextEncoder();
    for (const linea of lineasDe(ics)) {
      expect(encoder.encode(linea).length).toBeLessThanOrEqual(75);
    }
    // Al desplegar (quitar salto + espacio) se recupera el texto entero.
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${nombre} · Introducción a la Programación Orientada a Objetos`);
  });

  it("saltea las fechas que no se pueden interpretar y conserva las demás", () => {
    const ics = generarIcs([evento({ id: "mala", fecha: "pronto" }), evento({ id: "buena" })], AHORA);
    expect(ics).not.toContain("UID:mala@monteflori");
    expect(ics).toContain("UID:buena@monteflori");
  });

  it("termina todas las líneas con CRLF", () => {
    const ics = generarIcs([evento()], AHORA);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("nombreDeArchivo", () => {
  it("saca tildes, espacios y símbolos", () => {
    expect(nombreDeArchivo("Parcial 1 · Álgebra II")).toBe("parcial-1-algebra-ii.ics");
  });

  it("tiene un nombre por defecto si no queda nada", () => {
    expect(nombreDeArchivo("···")).toBe("monteflori.ics");
  });
});
