import { describe, it, expect } from "vitest";
import { horarioEvento } from "./calendar-fechas";

const ZONA = "America/Argentina/Buenos_Aires";

describe("horarioEvento", () => {
  it("manda la hora local tal cual, sin convertirla a UTC", () => {
    expect(horarioEvento("2026-03-12T18:30")).toEqual({
      start: { dateTime: "2026-03-12T18:30:00", timeZone: ZONA, date: null },
      end: { dateTime: "2026-03-12T20:30:00", timeZone: ZONA, date: null },
    });
  });

  it("cruza de día cuando el examen termina después de medianoche", () => {
    expect(horarioEvento("2026-12-31T23:00")).toEqual({
      start: { dateTime: "2026-12-31T23:00:00", timeZone: ZONA, date: null },
      end: { dateTime: "2027-01-01T01:00:00", timeZone: ZONA, date: null },
    });
  });

  it("crea un evento de día completo cuando no hay hora", () => {
    expect(horarioEvento("2026-02-28")).toEqual({
      start: { date: "2026-02-28", dateTime: null },
      end: { date: "2026-03-01", dateTime: null },
    });
  });

  it("respeta el instante exacto si la fecha ya trae zona", () => {
    expect(horarioEvento("2026-03-12T21:30:00.000Z")).toEqual({
      start: { dateTime: "2026-03-12T21:30:00.000Z", timeZone: ZONA, date: null },
      end: { dateTime: "2026-03-12T23:30:00.000Z", timeZone: ZONA, date: null },
    });
  });
});
