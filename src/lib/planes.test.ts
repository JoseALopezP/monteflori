import { describe, it, expect } from "vitest";
import {
  esDonanteActivo,
  puedeSincronizarCalendar,
  puedeUsarWhatsApp,
  planEfectivo,
} from "./planes";
import { Suscripcion } from "@/types";

const AHORA = new Date("2026-08-15T12:00:00.000Z");

function donante(hasta: string): Suscripcion {
  return { plan: "donante", donante_activo_hasta: hasta };
}

describe("esDonanteActivo", () => {
  it("es false si no hay suscripción", () => {
    expect(esDonanteActivo(undefined, AHORA)).toBe(false);
  });

  it("es false para el plan gratis", () => {
    expect(esDonanteActivo({ plan: "gratis" }, AHORA)).toBe(false);
  });

  it("es true para una donación vigente", () => {
    expect(esDonanteActivo(donante("2026-09-15T12:00:00.000Z"), AHORA)).toBe(true);
  });

  it("es false cuando la donación ya venció", () => {
    // Dejó de pagar: vuelve solo a gratis, sin necesidad de degradarlo a mano.
    expect(esDonanteActivo(donante("2026-07-15T12:00:00.000Z"), AHORA)).toBe(false);
  });

  it("es false si está marcado donante pero sin fecha de vencimiento", () => {
    expect(esDonanteActivo({ plan: "donante" }, AHORA)).toBe(false);
  });

  it("es false si la fecha de vencimiento no se puede parsear", () => {
    expect(esDonanteActivo(donante("no-es-una-fecha"), AHORA)).toBe(false);
  });
});

describe("puedeSincronizarCalendar", () => {
  it("permite siempre a un donante activo, aunque ya haya sincronizado hoy", () => {
    const r = puedeSincronizarCalendar(
      donante("2026-09-15T12:00:00.000Z"),
      { ultima_sincronizacion_calendar: "2026-08-15T09:00:00.000Z" },
      AHORA
    );
    expect(r.permitido).toBe(true);
  });

  it("permite en gratis si nunca sincronizó", () => {
    expect(puedeSincronizarCalendar(undefined, undefined, AHORA).permitido).toBe(true);
  });

  it("bloquea en gratis si ya sincronizó este mes", () => {
    const r = puedeSincronizarCalendar(
      undefined,
      { ultima_sincronizacion_calendar: "2026-08-02T09:00:00.000Z" },
      AHORA
    );
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/donación/i);
  });

  it("vuelve a permitir en gratis al cambiar de mes", () => {
    const r = puedeSincronizarCalendar(
      undefined,
      { ultima_sincronizacion_calendar: "2026-07-31T23:00:00.000Z" },
      AHORA
    );
    expect(r.permitido).toBe(true);
  });

  it("distingue el mismo mes de años distintos", () => {
    // Agosto del año pasado no consume el cupo de agosto de este año.
    const r = puedeSincronizarCalendar(
      undefined,
      { ultima_sincronizacion_calendar: "2025-08-10T09:00:00.000Z" },
      AHORA
    );
    expect(r.permitido).toBe(true);
  });

  it("no bloquea si la fecha guardada está corrupta", () => {
    const r = puedeSincronizarCalendar(
      undefined,
      { ultima_sincronizacion_calendar: "cualquier cosa" },
      AHORA
    );
    expect(r.permitido).toBe(true);
  });

  it("bloquea a un ex-donante con la donación vencida que ya usó su cupo", () => {
    const r = puedeSincronizarCalendar(
      donante("2026-07-01T12:00:00.000Z"),
      { ultima_sincronizacion_calendar: "2026-08-05T09:00:00.000Z" },
      AHORA
    );
    expect(r.permitido).toBe(false);
  });
});

describe("puedeUsarWhatsApp", () => {
  it("solo lo habilita para donantes activos", () => {
    expect(puedeUsarWhatsApp(donante("2026-09-15T12:00:00.000Z"), AHORA)).toBe(true);
    expect(puedeUsarWhatsApp(donante("2026-07-15T12:00:00.000Z"), AHORA)).toBe(false);
    expect(puedeUsarWhatsApp(undefined, AHORA)).toBe(false);
  });
});

describe("planEfectivo", () => {
  it("devuelve gratis si no hay usuario o no hay suscripción", () => {
    expect(planEfectivo(null, AHORA)).toBe("gratis");
    expect(planEfectivo({ suscripcion: undefined }, AHORA)).toBe("gratis");
  });

  it("devuelve donante solo mientras la donación esté vigente", () => {
    expect(planEfectivo({ suscripcion: donante("2026-09-15T12:00:00.000Z") }, AHORA)).toBe("donante");
    expect(planEfectivo({ suscripcion: donante("2026-07-15T12:00:00.000Z") }, AHORA)).toBe("gratis");
  });
});
