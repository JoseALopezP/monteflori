import { describe, it, expect } from "vitest";
import {
  avancePorAñoDelPlan, fechaAprobacion, formasDeAprobar, lineaDeTiempo,
  promedioConAplazos, regularidadesPorVencer,
} from "./estadisticas";
import { ActoAcademico, Materia } from "@/types";

let n = 0;
function materia(overrides: Partial<Materia> = {}): Materia {
  n++;
  return {
    id: `m${n}`,
    nombre: `Materia ${n}`,
    estado: "aprobada",
    configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
    evaluaciones: [],
    ultima_actualizacion: "2026-01-01",
    ...overrides,
  };
}

/** Materia aprobada como la deja la importación: una nota con su fecha. */
function aprobada(fecha: string | null, nota: number | null = 8, extra: Partial<Materia> = {}): Materia {
  return materia({
    evaluaciones: nota === null && fecha === null ? [] : [{ id: "e", nombre: "Nota SIU Guaraní", tipo: "otro", nota, fecha }],
    ...extra,
  });
}

const acto = (a: Partial<ActoAcademico>): ActoAcademico => ({
  tipo: "examen", resultado: null, nota: null, fecha: null, vencimiento: null, ...a,
});

describe("fechaAprobacion", () => {
  it("es null si la materia no está aprobada", () => {
    expect(fechaAprobacion(aprobada("2024-07-01", 8, { estado: "cursando" }))).toBeNull();
  });

  it("usa la fecha de la nota cuando no hay historia académica", () => {
    expect(fechaAprobacion(aprobada("2024-07-01"))).toBe("2024-07-01");
  });

  it("prefiere la historia académica y toma el acto que aprueba, no los desaprobados", () => {
    const m = aprobada("2020-01-01", 8, {
      actos_academicos: [
        acto({ tipo: "regularidad", resultado: "Aprobado", fecha: "2023-11-20" }),
        acto({ resultado: "Reprobado", nota: 2, fecha: "2023-12-10" }),
        acto({ resultado: "Aprobado", nota: 7, fecha: "2024-02-20" }),
      ],
    });
    expect(fechaAprobacion(m)).toBe("2024-02-20");
  });

  it("es null si está aprobada pero no hay ninguna fecha", () => {
    expect(fechaAprobacion(aprobada(null, null))).toBeNull();
  });
});

describe("lineaDeTiempo", () => {
  it("devuelve vacío si no hay aprobadas con fecha, y cuenta las que quedaron afuera", () => {
    expect(lineaDeTiempo([aprobada(null, null), materia({ estado: "cursando" })])).toEqual({
      puntos: [],
      sinFecha: 1,
    });
  });

  it("acumula por año e incluye los años sin aprobadas del medio", () => {
    const { puntos, sinFecha } = lineaDeTiempo([
      aprobada("2022-07-10", 6),
      aprobada("2022-12-01", 8),
      aprobada("2024-03-05", 10),
    ]);
    expect(sinFecha).toBe(0);
    expect(puntos).toEqual([
      { año: 2022, aprobadas: 2, acumuladas: 2, promedioAño: 7, promedioAcumulado: 7 },
      { año: 2023, aprobadas: 0, acumuladas: 2, promedioAño: null, promedioAcumulado: 7 },
      { año: 2024, aprobadas: 1, acumuladas: 3, promedioAño: 10, promedioAcumulado: 8 },
    ]);
  });

  it("una aprobada con fecha pero sin nota suma a la cuenta y no al promedio", () => {
    const sinNota = materia({
      actos_academicos: [acto({ tipo: "promocion", fecha: "2023-07-01" })],
    });
    const { puntos } = lineaDeTiempo([aprobada("2023-03-01", 9), sinNota]);
    expect(puntos).toEqual([
      { año: 2023, aprobadas: 2, acumuladas: 2, promedioAño: 9, promedioAcumulado: 9 },
    ]);
  });
});

describe("avancePorAñoDelPlan", () => {
  it("agrupa por año del plan, con las sin año al final", () => {
    const r = avancePorAñoDelPlan([
      materia({ año_plan: 2, estado: "pendiente" }),
      materia({ año_plan: 1, estado: "aprobada" }),
      materia({ año_plan: 1, estado: "regular" }),
      materia({ año_plan: 1, estado: "cursando" }),
      materia({ año_plan: 1, estado: "libre" }),
      materia({ estado: "aprobada" }),
    ]);
    expect(r).toEqual([
      { año: 1, total: 4, aprobadas: 1, regulares: 1, cursando: 1, restantes: 1 },
      { año: 2, total: 1, aprobadas: 0, regulares: 0, cursando: 0, restantes: 1 },
      { año: null, total: 1, aprobadas: 1, regulares: 0, cursando: 0, restantes: 0 },
    ]);
  });
});

describe("formasDeAprobar", () => {
  it("distingue promoción, examen final y las que no tienen historia", () => {
    const r = formasDeAprobar([
      materia({ actos_academicos: [acto({ tipo: "promocion", nota: 9 })] }),
      materia({ actos_academicos: [acto({ resultado: "Reprobado", nota: 2 }), acto({ resultado: "Aprobado", nota: 6 })] }),
      aprobada("2024-01-01"),
      materia({ estado: "cursando", actos_academicos: [acto({ tipo: "promocion" })] }),
    ]);
    expect(r).toEqual({ promocion: 1, examen: 1, sinDato: 1 });
  });
});

describe("promedioConAplazos", () => {
  it("es null si no hay historia académica", () => {
    expect(promedioConAplazos([aprobada("2024-01-01", 8)])).toBeNull();
  });

  it("cuenta también los exámenes desaprobados, y no las regularidades", () => {
    const m = materia({
      actos_academicos: [
        acto({ tipo: "regularidad", nota: 10 }),
        acto({ resultado: "Reprobado", nota: 2 }),
        acto({ resultado: "Aprobado", nota: 8 }),
        acto({ resultado: "Ausente", nota: null }),
      ],
    });
    expect(promedioConAplazos([m])).toBe(5);
  });
});

describe("regularidadesPorVencer", () => {
  const hoy = new Date(2026, 10, 14); // 14 de noviembre de 2026

  it("ordena de la más urgente a la más lejana y marca las vencidas en negativo", () => {
    const lejos = materia({
      estado: "regular", nombre: "Lejos",
      actos_academicos: [acto({ tipo: "regularidad", vencimiento: "2027-03-31" })],
    });
    const cerca = materia({
      estado: "regular", nombre: "Cerca",
      actos_academicos: [acto({ tipo: "regularidad", vencimiento: "2026-11-24" })],
    });
    const vencida = materia({
      estado: "regular", nombre: "Vencida",
      actos_academicos: [acto({ tipo: "regularidad", vencimiento: "2026-11-10" })],
    });
    const r = regularidadesPorVencer([lejos, cerca, vencida], hoy);
    expect(r.map((x) => [x.nombre, x.dias])).toEqual([["Vencida", -4], ["Cerca", 10], ["Lejos", 137]]);
  });

  it("ignora las que no están regulares o no tienen vencimiento, y usa el último si hubo varios", () => {
    const aprobadaYa = materia({
      estado: "aprobada",
      actos_academicos: [acto({ tipo: "regularidad", vencimiento: "2026-12-01" })],
    });
    const sinDato = materia({ estado: "regular" });
    const dosVeces = materia({
      estado: "regular", nombre: "Dos veces",
      actos_academicos: [
        acto({ tipo: "regularidad", vencimiento: "2025-03-31" }),
        acto({ tipo: "regularidad", vencimiento: "2027-03-31" }),
      ],
    });
    const r = regularidadesPorVencer([aprobadaYa, sinDato, dosVeces], hoy);
    expect(r).toHaveLength(1);
    expect(r[0].vence).toBe("2027-03-31");
  });
});
