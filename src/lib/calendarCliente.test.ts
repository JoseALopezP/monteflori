import { describe, it, expect } from "vitest";
import { tocaReconciliar } from "./calendarCliente";

// Las fechas se construyen en hora local a propósito: `tocaReconciliar` compara
// por día calendario local (el "hoy" del usuario es su medianoche, no la de
// UTC), así que armarlas con strings UTC haría que el test dependa de la zona
// horaria de la máquina donde corre.
function local(año: number, mes: number, dia: number, hora = 12): Date {
  return new Date(año, mes - 1, dia, hora, 0, 0);
}

const AHORA = local(2026, 8, 15, 10);

describe("tocaReconciliar", () => {
  it("reconcilia si nunca se hizo", () => {
    expect(tocaReconciliar(undefined, AHORA)).toBe(true);
  });

  it("no reconcilia dos veces el mismo día", () => {
    expect(tocaReconciliar(local(2026, 8, 15, 2).toISOString(), AHORA)).toBe(false);
  });

  it("reconcilia al día siguiente", () => {
    expect(tocaReconciliar(local(2026, 8, 14, 23).toISOString(), AHORA)).toBe(true);
  });

  it("reconcilia si cambió el mes", () => {
    expect(tocaReconciliar(local(2026, 7, 15, 10).toISOString(), AHORA)).toBe(true);
  });

  it("reconcilia si cambió el año", () => {
    // Mismo día y mes, pero del año pasado.
    expect(tocaReconciliar(local(2025, 8, 15, 10).toISOString(), AHORA)).toBe(true);
  });

  it("reconcilia si la fecha guardada está corrupta", () => {
    expect(tocaReconciliar("cualquier cosa", AHORA)).toBe(true);
  });
});
