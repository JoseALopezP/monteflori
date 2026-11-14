import { describe, it, expect } from "vitest";
import {
  calcularPromedioSimple,
  calcularNotaPonderada,
  calcularFormulaCustom,
  calcularNotaGrupos,
  gruposPorDefecto,
  resolverEvaluacionesEfectivas,
  evaluacionRecuperadaPor,
  calcularResultadoMateria,
  calcularPromedioGeneral,
  calcularPorcentajeAvance,
} from "./calculo-notas";
import { Evaluacion, Materia, GrupoNota } from "@/types";

function evaluacion(overrides: Partial<Evaluacion> = {}): Evaluacion {
  return {
    id: overrides.id ?? `eval_${Math.random()}`,
    nombre: "Evaluación",
    tipo: "parcial",
    nota: null,
    ...overrides,
  };
}

function materia(overrides: Partial<Materia> = {}): Materia {
  return {
    id: "m1",
    nombre: "Materia de prueba",
    estado: "cursando",
    configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
    evaluaciones: [],
    ultima_actualizacion: new Date().toISOString(),
    ...overrides,
  };
}

describe("calcularPromedioSimple", () => {
  it("da 0 con un array vacío", () => {
    expect(calcularPromedioSimple([])).toBe(0);
  });

  it("ignora evaluaciones sin nota (null o undefined)", () => {
    const evals = [
      evaluacion({ nota: 8 }),
      evaluacion({ nota: null }),
      evaluacion({ nota: undefined }),
      evaluacion({ nota: 6 }),
    ];
    expect(calcularPromedioSimple(evals)).toBe(7);
  });

  it("da 0 si ninguna evaluación tiene nota", () => {
    expect(calcularPromedioSimple([evaluacion({ nota: null })])).toBe(0);
  });
});

describe("calcularNotaPonderada", () => {
  const config = { sistema: "ponderado" as const, nota_aprobar: 4, nota_promocionar: 7 };

  it("usa los pesos default (60% parciales, 40% TPs) cuando no se especifican", () => {
    const evals = [
      evaluacion({ tipo: "parcial", nota: 10 }),
      evaluacion({ tipo: "tp", nota: 5 }),
    ];
    // 10 * 0.6 + 5 * 0.4 = 8
    expect(calcularNotaPonderada(evals, config)).toBe(8);
  });

  it("respeta pesos custom", () => {
    const evals = [
      evaluacion({ tipo: "parcial", nota: 10 }),
      evaluacion({ tipo: "tp", nota: 0 }),
    ];
    const configCustom = { ...config, pesos: { parciales: 0.8, trabajos_practicos: 0.2 } };
    // 10 * 0.8 + 0 * 0.2 = 8
    expect(calcularNotaPonderada(evals, configCustom)).toBe(8);
  });

  it("usa solo parciales si no hay TPs cargados", () => {
    const evals = [evaluacion({ tipo: "parcial", nota: 6 })];
    expect(calcularNotaPonderada(evals, config)).toBe(6);
  });

  it("usa solo TPs si no hay parciales cargados", () => {
    const evals = [evaluacion({ tipo: "tp", nota: 9 })];
    expect(calcularNotaPonderada(evals, config)).toBe(9);
  });

  it("da 0 si no hay ninguna evaluación con nota", () => {
    expect(calcularNotaPonderada([], config)).toBe(0);
  });

  it("cuenta recuperatorio como parcial", () => {
    const evals = [evaluacion({ tipo: "recuperatorio", nota: 7 })];
    expect(calcularNotaPonderada(evals, config)).toBe(7);
  });
});

describe("calcularFormulaCustom", () => {
  it("evalúa una fórmula simple con parciales", () => {
    const evals = [
      evaluacion({ tipo: "parcial", nota: 6 }),
      evaluacion({ tipo: "parcial", nota: 8 }),
    ];
    expect(calcularFormulaCustom(evals, "(P1+P2)/2")).toBe(7);
  });

  it("incluye la nota del final como variable F", () => {
    const evals = [evaluacion({ tipo: "final", nota: 9 })];
    expect(calcularFormulaCustom(evals, "F")).toBe(9);
  });

  it("da 0 si la fórmula es inválida en vez de lanzar una excepción", () => {
    expect(calcularFormulaCustom([], "esto no es una fórmula válida (")).toBe(0);
  });

  it("trata las variables faltantes como 0", () => {
    expect(calcularFormulaCustom([], "P1 + P2")).toBe(0);
  });
});

describe("resolverEvaluacionesEfectivas", () => {
  it("excluye la evaluación original cuando su recuperatorio ya tiene nota", () => {
    const original = evaluacion({ id: "p1", tipo: "parcial", nota: 3 });
    const recu = evaluacion({ id: "r1", tipo: "recuperatorio", nota: 8, recuperatorio_de: "p1" });
    const efectivas = resolverEvaluacionesEfectivas([original, recu]);
    expect(efectivas.map((e) => e.id)).toEqual(["r1"]);
  });

  it("mantiene la original si el recuperatorio todavía no tiene nota cargada", () => {
    const original = evaluacion({ id: "p1", tipo: "parcial", nota: 3 });
    const recu = evaluacion({ id: "r1", tipo: "recuperatorio", nota: null, recuperatorio_de: "p1" });
    const efectivas = resolverEvaluacionesEfectivas([original, recu]);
    expect(efectivas.map((e) => e.id).sort()).toEqual(["p1", "r1"]);
  });

  it("no afecta evaluaciones sin recuperatorio asociado", () => {
    const evals = [evaluacion({ id: "p1", nota: 6 }), evaluacion({ id: "tp1", tipo: "tp", nota: 8 })];
    expect(resolverEvaluacionesEfectivas(evals)).toHaveLength(2);
  });
});

describe("evaluacionRecuperadaPor", () => {
  it("devuelve el recuperatorio que reemplaza a una evaluación", () => {
    const recu = evaluacion({ id: "r1", tipo: "recuperatorio", nota: 8, recuperatorio_de: "p1" });
    expect(evaluacionRecuperadaPor("p1", [recu])?.id).toBe("r1");
  });

  it("da null si el recuperatorio todavía no tiene nota", () => {
    const recu = evaluacion({ id: "r1", tipo: "recuperatorio", nota: null, recuperatorio_de: "p1" });
    expect(evaluacionRecuperadaPor("p1", [recu])).toBeNull();
  });

  it("da null si no hay ningún recuperatorio asociado", () => {
    expect(evaluacionRecuperadaPor("p1", [evaluacion({ id: "tp1" })])).toBeNull();
  });
});

describe("calcularNotaGrupos", () => {
  function grupo(overrides: Partial<GrupoNota> = {}): GrupoNota {
    return {
      id: overrides.id ?? `grupo_${Math.random()}`,
      nombre: "Grupo",
      peso: 50,
      tipos: ["parcial"],
      metodo: "promedio",
      ...overrides,
    };
  }

  it("da 0 si ningún grupo tiene notas cargadas", () => {
    expect(calcularNotaGrupos([], gruposPorDefecto())).toBe(0);
  });

  it("pondera grupos según su peso cuando todos tienen datos", () => {
    const grupos = [
      grupo({ nombre: "Parciales", peso: 60, tipos: ["parcial"], metodo: "promedio" }),
      grupo({ nombre: "TP", peso: 40, tipos: ["tp"], metodo: "promedio" }),
    ];
    const evals = [
      evaluacion({ tipo: "parcial", nota: 10 }),
      evaluacion({ tipo: "tp", nota: 5 }),
    ];
    // 10 * 0.6 + 5 * 0.4 = 8
    expect(calcularNotaGrupos(evals, grupos)).toBe(8);
  });

  it("renormaliza el peso cuando un grupo todavía no tiene notas (ej. Final sin rendir)", () => {
    const grupos = [
      grupo({ nombre: "Parciales", peso: 70, tipos: ["parcial"], metodo: "promedio" }),
      grupo({ nombre: "Final", peso: 30, tipos: ["final"], metodo: "ultima_nota" }),
    ];
    const evals = [evaluacion({ tipo: "parcial", nota: 8 })];
    // Solo hay datos de "Parciales" -> se queda con ese valor entero, no 8*0.7
    expect(calcularNotaGrupos(evals, grupos)).toBe(8);
  });

  it("usa la mejor nota del grupo cuando el método es mejor_nota", () => {
    const grupos = [grupo({ metodo: "mejor_nota", peso: 100 })];
    const evals = [
      evaluacion({ tipo: "parcial", nota: 4 }),
      evaluacion({ tipo: "parcial", nota: 9 }),
      evaluacion({ tipo: "parcial", nota: 6 }),
    ];
    expect(calcularNotaGrupos(evals, grupos)).toBe(9);
  });

  it("usa la última nota cargada del grupo cuando el método es ultima_nota", () => {
    const grupos = [grupo({ metodo: "ultima_nota", peso: 100 })];
    const evals = [
      evaluacion({ id: "1", tipo: "parcial", nota: 4 }),
      evaluacion({ id: "2", tipo: "parcial", nota: 9 }),
    ];
    expect(calcularNotaGrupos(evals, grupos)).toBe(9);
  });

  it("ignora tipos de evaluación que no pertenecen a ningún grupo", () => {
    const grupos = [grupo({ tipos: ["parcial"], peso: 100 })];
    const evals = [
      evaluacion({ tipo: "parcial", nota: 7 }),
      evaluacion({ tipo: "coloquio", nota: 2 }),
    ];
    expect(calcularNotaGrupos(evals, grupos)).toBe(7);
  });
});

describe("calcularResultadoMateria", () => {
  it("calcula el sistema lineal correctamente", () => {
    const m = materia({
      configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
      evaluaciones: [evaluacion({ nota: 8 }), evaluacion({ nota: 6 })],
    });
    const r = calcularResultadoMateria(m);
    expect(r.promedio_actual).toBe(7);
    expect(r.puede_aprobar).toBe(true);
    expect(r.puede_promocionar).toBe(true);
    expect(r.evaluaciones_completas).toBe(2);
    expect(r.evaluaciones_totales).toBe(2);
    expect(r.porcentaje_completado).toBe(100);
  });

  it("no promociona si el promedio queda por debajo de la nota de promoción", () => {
    const m = materia({
      configuracion_nota: { sistema: "lineal", nota_aprobar: 4, nota_promocionar: 7 },
      evaluaciones: [evaluacion({ nota: 5 })],
    });
    const r = calcularResultadoMateria(m);
    expect(r.puede_aprobar).toBe(true);
    expect(r.puede_promocionar).toBe(false);
  });

  it("nota_proyectada es null cuando no hay ninguna evaluación con nota cargada", () => {
    const m = materia({ evaluaciones: [evaluacion({ nota: null })] });
    const r = calcularResultadoMateria(m);
    expect(r.nota_proyectada).toBeNull();
    expect(r.promedio_actual).toBe(0);
  });

  it("nunca devuelve un promedio mayor a 10", () => {
    const m = materia({
      configuracion_nota: {
        sistema: "custom_formula",
        nota_aprobar: 4,
        nota_promocionar: 7,
        formula_evaluacion: "P1 * 2",
      },
      evaluaciones: [evaluacion({ tipo: "parcial", nota: 8 })],
    });
    const r = calcularResultadoMateria(m);
    expect(r.promedio_actual).toBeLessThanOrEqual(10);
  });

  it("porcentaje_completado es 0 si no hay evaluaciones cargadas", () => {
    const m = materia({ evaluaciones: [] });
    const r = calcularResultadoMateria(m);
    expect(r.porcentaje_completado).toBe(0);
  });

  it("calcula el sistema grupos_ponderados usando los grupos configurados", () => {
    const m = materia({
      configuracion_nota: {
        sistema: "grupos_ponderados",
        nota_aprobar: 4,
        nota_promocionar: 7,
        grupos: gruposPorDefecto(),
      },
      evaluaciones: [
        evaluacion({ tipo: "parcial", nota: 8 }),
        evaluacion({ tipo: "tp", nota: 6 }),
      ],
    });
    const r = calcularResultadoMateria(m);
    // Solo hay datos de Parciales (50%) y TP (20%) -> renormalizado: 8*(50/70) + 6*(20/70) = 7.43
    expect(r.promedio_actual).toBeCloseTo(7.43, 1);
  });

  it("un recuperatorio reemplaza a la evaluación que recupera en el cálculo final", () => {
    const m = materia({
      configuracion_nota: {
        sistema: "grupos_ponderados",
        nota_aprobar: 4,
        nota_promocionar: 7,
        grupos: gruposPorDefecto(),
      },
      evaluaciones: [
        evaluacion({ id: "p1", tipo: "parcial", nota: 2 }),
        evaluacion({ id: "r1", tipo: "recuperatorio", nota: 9, recuperatorio_de: "p1" }),
      ],
    });
    const r = calcularResultadoMateria(m);
    // Si promediara ambos dentro del grupo Parciales sería (2+9)/2=5.5; como
    // el recuperatorio reemplaza al parcial original, el grupo queda en 9.
    expect(r.promedio_actual).toBe(9);
  });

  it("grupos_ponderados sin grupos configurados cae a promedio simple", () => {
    const m = materia({
      configuracion_nota: { sistema: "grupos_ponderados", nota_aprobar: 4, nota_promocionar: 7 },
      evaluaciones: [evaluacion({ nota: 8 }), evaluacion({ nota: 6 })],
    });
    expect(calcularResultadoMateria(m).promedio_actual).toBe(7);
  });
});

describe("calcularPromedioGeneral", () => {
  it("da 0 si no hay materias aprobadas", () => {
    const materias = [materia({ estado: "cursando", evaluaciones: [evaluacion({ nota: 10 })] })];
    expect(calcularPromedioGeneral(materias)).toBe(0);
  });

  it("promedia solo las materias aprobadas, ignorando las demás", () => {
    const materias = [
      materia({ id: "a", estado: "aprobada", evaluaciones: [evaluacion({ nota: 8 })] }),
      materia({ id: "b", estado: "aprobada", evaluaciones: [evaluacion({ nota: 6 })] }),
      materia({ id: "c", estado: "cursando", evaluaciones: [evaluacion({ nota: 2 })] }),
    ];
    expect(calcularPromedioGeneral(materias)).toBe(7);
  });

  it("no cuenta como 0 a las aprobadas que no tienen ninguna nota cargada", () => {
    const materias = [
      materia({ id: "a", estado: "aprobada", evaluaciones: [evaluacion({ nota: 8 })] }),
      materia({ id: "b", estado: "aprobada", evaluaciones: [] }),
    ];
    expect(calcularPromedioGeneral(materias)).toBe(8);
  });
});

describe("calcularPorcentajeAvance", () => {
  it("da 0 si no hay materias", () => {
    expect(calcularPorcentajeAvance([])).toBe(0);
  });

  it("calcula por conteo de materias cuando no hay créditos definidos", () => {
    const materias = [
      materia({ id: "a", estado: "aprobada" }),
      materia({ id: "b", estado: "cursando" }),
    ];
    expect(calcularPorcentajeAvance(materias)).toBe(50);
  });

  it("usa total_materias_plan como denominador si se pasa", () => {
    const materias = [materia({ id: "a", estado: "aprobada" })];
    expect(calcularPorcentajeAvance(materias, 4)).toBe(25);
  });

  it("pondera por créditos cuando están definidos", () => {
    const materias = [
      materia({ id: "a", estado: "aprobada", creditos: 3 }),
      materia({ id: "b", estado: "cursando", creditos: 1 }),
    ];
    // 3 de 4 créditos totales
    expect(calcularPorcentajeAvance(materias)).toBe(75);
  });
});
