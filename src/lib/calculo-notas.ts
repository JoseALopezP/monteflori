// src/lib/calculo-notas.ts
// Motor de cálculo de notas - 100% client-side, sin dependencias de UI
// Todas las funciones son puras y testeables

import { Materia, Evaluacion, ConfiguracionNota, ResultadoCalculo } from "@/types";

/**
 * Calcula el promedio simple de un array de evaluaciones con nota.
 */
export function calcularPromedioSimple(evaluaciones: Evaluacion[]): number {
  const conNota = evaluaciones.filter(
    (e) => e.nota !== undefined && e.nota !== null
  );
  if (conNota.length === 0) return 0;
  return conNota.reduce((acc, e) => acc + (e.nota ?? 0), 0) / conNota.length;
}

/**
 * Calcula la nota proyectada usando el sistema ponderado por tipo de evaluación.
 */
export function calcularNotaPonderada(
  evaluaciones: Evaluacion[],
  config: ConfiguracionNota
): number {
  const pesos = config.pesos ?? { parciales: 0.6, trabajos_practicos: 0.4 };

  const parciales = evaluaciones.filter(
    (e) => (e.tipo === "parcial" || e.tipo === "recuperatorio") && e.nota !== null && e.nota !== undefined
  );
  const tps = evaluaciones.filter(
    (e) => e.tipo === "tp" && e.nota !== null && e.nota !== undefined
  );

  const promParciales =
    parciales.length > 0
      ? parciales.reduce((a, e) => a + (e.nota ?? 0), 0) / parciales.length
      : 0;

  const promTPs =
    tps.length > 0
      ? tps.reduce((a, e) => a + (e.nota ?? 0), 0) / tps.length
      : 0;

  // Si no hay datos de uno de los tipos, solo usa lo que hay
  const pesoParciales = pesos.parciales ?? 0.6;
  const pesoTPs = pesos.trabajos_practicos ?? 0.4;

  if (parciales.length === 0 && tps.length === 0) return 0;
  if (parciales.length === 0) return promTPs;
  if (tps.length === 0) return promParciales;

  return promParciales * pesoParciales + promTPs * pesoTPs;
}

/**
 * Evalúa una fórmula custom con las notas del estudiante.
 * Variables disponibles en la fórmula: P1, P2, P3, F, TP1, TP2
 */
export function calcularFormulaCustom(
  evaluaciones: Evaluacion[],
  formula: string
): number {
  try {
    const parciales = evaluaciones.filter(
      (e) => e.tipo === "parcial" && e.nota !== null && e.nota !== undefined
    );
    const tps = evaluaciones.filter(
      (e) => e.tipo === "tp" && e.nota !== null && e.nota !== undefined
    );
    const final = evaluaciones.find(
      (e) => e.tipo === "final" && e.nota !== null && e.nota !== undefined
    );

    const variables: Record<string, number> = {
      F: final?.nota ?? 0,
    };
    parciales.forEach((p, i) => {
      variables[`P${i + 1}`] = p.nota ?? 0;
    });
    tps.forEach((t, i) => {
      variables[`TP${i + 1}`] = t.nota ?? 0;
    });

    // Reemplazar variables en la fórmula
    let formulaEval = formula;
    Object.entries(variables).forEach(([key, val]) => {
      formulaEval = formulaEval.replace(new RegExp(key, "g"), String(val));
    });

    // eslint-disable-next-line no-new-func
    return Number(new Function(`return ${formulaEval}`)());
  } catch {
    return 0;
  }
}

/**
 * Función principal: calcula todos los datos relevantes de una materia.
 */
export function calcularResultadoMateria(materia: Materia): ResultadoCalculo {
  const config = materia.configuracion_nota;
  const evaluaciones = materia.evaluaciones ?? [];

  const conNota = evaluaciones.filter(
    (e) => e.nota !== null && e.nota !== undefined
  );

  let notaActual = 0;

  switch (config.sistema) {
    case "lineal":
      notaActual = calcularPromedioSimple(evaluaciones);
      break;
    case "ponderado":
      notaActual = calcularNotaPonderada(evaluaciones, config);
      break;
    case "custom_formula":
      notaActual = config.formula_evaluacion
        ? calcularFormulaCustom(evaluaciones, config.formula_evaluacion)
        : calcularPromedioSimple(evaluaciones);
      break;
  }

  const tieneFinal = evaluaciones.some(
    (e) => e.tipo === "final" && e.nota !== null && e.nota !== undefined
  );

  return {
    promedio_actual: Math.min(10, Number(notaActual.toFixed(2))),
    nota_proyectada: conNota.length > 0 ? Math.min(10, Number(notaActual.toFixed(2))) : null,
    puede_promocionar: notaActual >= config.nota_promocionar,
    puede_aprobar: tieneFinal
      ? notaActual >= config.nota_aprobar
      : notaActual >= config.nota_aprobar,
    evaluaciones_completas: conNota.length,
    evaluaciones_totales: evaluaciones.length,
    porcentaje_completado:
      evaluaciones.length > 0
        ? Math.round((conNota.length / evaluaciones.length) * 100)
        : 0,
  };
}

/**
 * Calcula el promedio general de todas las materias aprobadas de una carrera.
 */
export function calcularPromedioGeneral(materias: Materia[]): number {
  const aprobadas = materias.filter((m) => m.estado === "aprobada");
  if (aprobadas.length === 0) return 0;

  const promedios = aprobadas.map((m) => calcularResultadoMateria(m).promedio_actual);
  return Number(
    (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(2)
  );
}

/**
 * Calcula el porcentaje de avance de una carrera.
 * Si las materias tienen créditos, usa créditos. Si no, cuenta materias.
 */
export function calcularPorcentajeAvance(
  materias: Materia[],
  totalMateriasPlan?: number
): number {
  const aprobadas = materias.filter((m) => m.estado === "aprobada");

  // Si hay créditos definidos, usar ponderación por créditos
  const tieneCreditosDef = materias.some((m) => m.creditos !== undefined);
  if (tieneCreditosDef) {
    const creditosAprobados = aprobadas.reduce(
      (acc, m) => acc + (m.creditos ?? 1),
      0
    );
    const creditosTotales = materias.reduce(
      (acc, m) => acc + (m.creditos ?? 1),
      0
    );
    if (creditosTotales === 0) return 0;
    return Math.round((creditosAprobados / creditosTotales) * 100);
  }

  // Fallback: contar materias
  const total = totalMateriasPlan ?? materias.length;
  if (total === 0) return 0;
  return Math.round((aprobadas.length / total) * 100);
}
