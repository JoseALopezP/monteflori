import { describe, it, expect } from "vitest";
import {
  hashFecha,
  planificarSync,
  planVacio,
  tituloEvento,
  FechaSincronizable,
  MapaEventos,
} from "./calendar-sync";

function fecha(overrides: Partial<FechaSincronizable> = {}): FechaSincronizable {
  return {
    id: "f1",
    nombre: "Parcial 1",
    fecha: "2026-09-15T18:00:00.000Z",
    tipo: "parcial",
    materiaNombre: "Álgebra",
    ...overrides,
  };
}

describe("hashFecha", () => {
  it("da el mismo hash para la misma fecha", () => {
    expect(hashFecha(fecha())).toBe(hashFecha(fecha()));
  });

  it("cambia si cambia la fecha", () => {
    const a = hashFecha(fecha());
    const b = hashFecha(fecha({ fecha: "2026-09-16T18:00:00.000Z" }));
    expect(a).not.toBe(b);
  });

  it("cambia si cambia el nombre", () => {
    expect(hashFecha(fecha())).not.toBe(hashFecha(fecha({ nombre: "Parcial 2" })));
  });

  it("cambia si la materia se renombra", () => {
    // El nombre de la materia va en el título del evento, así que un cambio
    // ahí también tiene que disparar una actualización en Google.
    expect(hashFecha(fecha())).not.toBe(hashFecha(fecha({ materiaNombre: "Análisis" })));
  });

  it("no depende del id", () => {
    expect(hashFecha(fecha({ id: "a" }))).toBe(hashFecha(fecha({ id: "b" })));
  });
});

describe("planificarSync", () => {
  it("crea las fechas que nunca se sincronizaron", () => {
    const plan = planificarSync([fecha()], {});
    expect(plan.crear).toHaveLength(1);
    expect(plan.actualizar).toHaveLength(0);
    expect(plan.eliminar).toHaveLength(0);
  });

  it("no hace nada si nada cambió", () => {
    const f = fecha();
    const mapa: MapaEventos = { f1: { eventId: "ev1", hash: hashFecha(f) } };
    const plan = planificarSync([f], mapa);

    expect(planVacio(plan)).toBe(true);
    expect(plan.sinCambios).toBe(1);
  });

  it("actualiza cuando cambió algún dato de la fecha", () => {
    const original = fecha();
    const mapa: MapaEventos = { f1: { eventId: "ev1", hash: hashFecha(original) } };
    const movida = fecha({ fecha: "2026-10-01T18:00:00.000Z" });

    const plan = planificarSync([movida], mapa);
    expect(plan.actualizar).toEqual([{ fecha: movida, eventId: "ev1" }]);
    expect(plan.crear).toHaveLength(0);
  });

  it("elimina el evento de una fecha que el usuario borró", () => {
    const mapa: MapaEventos = { f1: { eventId: "ev1", hash: "loquesea" } };
    const plan = planificarSync([], mapa);
    expect(plan.eliminar).toEqual([{ fechaId: "f1", eventId: "ev1" }]);
  });

  it("ignora fechas sin id, que no se pueden rastrear entre sincronizaciones", () => {
    const plan = planificarSync([fecha({ id: "" })], {});
    expect(planVacio(plan)).toBe(true);
  });

  it("maneja crear, actualizar, borrar y sin cambios a la vez", () => {
    const igual = fecha({ id: "igual" });
    const cambiada = fecha({ id: "cambiada", nombre: "Nuevo nombre" });
    const nueva = fecha({ id: "nueva" });

    const mapa: MapaEventos = {
      igual: { eventId: "ev-igual", hash: hashFecha(igual) },
      cambiada: { eventId: "ev-cambiada", hash: "hash-viejo" },
      borrada: { eventId: "ev-borrada", hash: "loquesea" },
    };

    const plan = planificarSync([igual, cambiada, nueva], mapa);

    expect(plan.crear.map((f) => f.id)).toEqual(["nueva"]);
    expect(plan.actualizar.map((a) => a.eventId)).toEqual(["ev-cambiada"]);
    expect(plan.eliminar.map((e) => e.eventId)).toEqual(["ev-borrada"]);
    expect(plan.sinCambios).toBe(1);
  });

  it("es idempotente: sincronizar dos veces seguidas no duplica eventos", () => {
    const f = fecha();

    // Primera pasada: se crea.
    const primera = planificarSync([f], {});
    expect(primera.crear).toHaveLength(1);

    // Guardamos el resultado como lo haría la ruta y volvemos a planificar.
    const mapa: MapaEventos = { [f.id]: { eventId: "ev1", hash: hashFecha(f) } };
    expect(planVacio(planificarSync([f], mapa))).toBe(true);
  });
});

describe("tituloEvento", () => {
  it("incluye la materia y el nombre de la fecha", () => {
    expect(tituloEvento(fecha())).toBe("📚 Álgebra — Parcial 1");
  });
});
