// src/lib/calculo-notas.ts
// Motor de cálculo de notas - 100% client-side, sin dependencias de UI
// Todas las funciones son puras y testeables

import { Materia, Evaluacion, ConfiguracionNota, ResultadoCalculo, GrupoNota } from "@/types";

/** Descripción legible de cómo se calcula la nota, para mostrar en la UI. */
export function resumenFormula(config: ConfiguracionNota): string {
  if (config.sistema === "grupos_ponderados" && config.grupos && config.grupos.length > 0) {
    return (
      config.grupos
        .filter((g) => g.tipos.length > 0)
        .map((g) => `${g.nombre} ${g.peso}%`)
        .join(" + ") || "Configurar grupos"
    );
  }
  if (config.sistema === "ponderado") return "Ponderado (parciales + TP)";
  if (config.sistema === "custom_formula") return "Fórmula personalizada";
  return "Promedio simple";
}

/**
 * Un recuperatorio no borra la evaluación que recupera — la reemplaza en el
 * cálculo. Mientras el recuperatorio no tenga nota cargada todavía, la
 * original sigue contando (no se recuperó nada aún). Devuelve el array de
 * evaluaciones que efectivamente entran en el cálculo de la nota.
 */
export function resolverEvaluacionesEfectivas(evaluaciones: Evaluacion[]): Evaluacion[] {
  const recuperadasIds = new Set(
    evaluaciones
      .filter((e) => e.recuperatorio_de && e.nota !== null && e.nota !== undefined)
      .map((e) => e.recuperatorio_de as string)
  );
  return evaluaciones.filter((e) => !recuperadasIds.has(e.id));
}

/**
 * Si esta evaluación fue anulada por un recuperatorio (con nota ya cargada),
 * devuelve ese recuperatorio — útil para mostrar "Recuperada por: X" en la UI.
 */
export function evaluacionRecuperadaPor(
  evaluacionId: string,
  evaluaciones: Evaluacion[]
): Evaluacion | null {
  return (
    evaluaciones.find(
      (e) => e.recuperatorio_de === evaluacionId && e.nota !== null && e.nota !== undefined
    ) ?? null
  );
}

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
 * Grupos por defecto del constructor visual: Parciales 50%, Trabajos
 * Prácticos 20%, Final 30% — un punto de partida razonable que cualquiera
 * puede reordenar/repesar desde el constructor.
 */
export function gruposPorDefecto(): GrupoNota[] {
  return [
    { id: "grupo_parciales", nombre: "Parciales", peso: 50, tipos: ["parcial", "recuperatorio"], metodo: "promedio" },
    { id: "grupo_tp", nombre: "Trabajos Prácticos", peso: 20, tipos: ["tp"], metodo: "promedio" },
    { id: "grupo_final", nombre: "Final", peso: 30, tipos: ["final"], metodo: "ultima_nota" },
  ];
}

/**
 * Calcula la nota final a partir de grupos ponderados (constructor visual).
 * Cada grupo combina las notas de sus tipos de evaluación asociados
 * (promedio / mejor nota / última nota) y después se pondera por su peso.
 *
 * Los grupos sin ninguna nota cargada todavía (ej. "Final" antes de rendirlo)
 * se excluyen del cálculo y el peso se renormaliza entre los que sí tienen
 * datos — así la nota proyectada no queda artificialmente baja solo porque
 * falta cursar/rendir una parte.
 */
export function calcularNotaGrupos(evaluaciones: Evaluacion[], grupos: GrupoNota[]): number {
  const gruposConDatos = grupos
    .map((g) => {
      const notas = evaluaciones
        .filter((e) => g.tipos.includes(e.tipo) && e.nota !== null && e.nota !== undefined)
        .map((e) => e.nota as number);
      if (notas.length === 0) return null;

      let valor: number;
      if (g.metodo === "mejor_nota") valor = Math.max(...notas);
      else if (g.metodo === "ultima_nota") valor = notas[notas.length - 1];
      else valor = notas.reduce((a, b) => a + b, 0) / notas.length;

      return { peso: g.peso, valor };
    })
    .filter((g): g is { peso: number; valor: number } => g !== null);

  if (gruposConDatos.length === 0) return 0;

  const pesoTotal = gruposConDatos.reduce((acc, g) => acc + g.peso, 0);
  if (pesoTotal <= 0) return 0;

  return gruposConDatos.reduce((acc, g) => acc + g.valor * (g.peso / pesoTotal), 0);
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
  // Las evaluaciones "recuperadas" (con un recuperatorio ya calificado que
  // las reemplaza) quedan afuera del cálculo, aunque se sigan mostrando en
  // el historial de la materia.
  const evaluaciones = resolverEvaluacionesEfectivas(materia.evaluaciones ?? []);

  const conNota = evaluaciones.filter(
    (e) => e.nota !== null && e.nota !== undefined
  );

  let notaActual = 0;

  switch (config.sistema) {
    case "grupos_ponderados":
      notaActual = config.grupos && config.grupos.length > 0
        ? calcularNotaGrupos(evaluaciones, config.grupos)
        : calcularPromedioSimple(evaluaciones);
      // Hay notas pero ninguna cae en un grupo (ej. la "Nota SIU Guaraní" que
      // trae la importación, de tipo "otro"): antes la materia quedaba en 0.
      // En ese caso se promedia lo que hay.
      if (notaActual === 0 && conNota.length > 0) {
        const hayGrupoConDatos = (config.grupos ?? []).some((g) =>
          conNota.some((e) => g.tipos.includes(e.tipo))
        );
        if (!hayGrupoConDatos) notaActual = calcularPromedioSimple(evaluaciones);
      }
      break;
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

  return {
    promedio_actual: Math.min(10, Number(notaActual.toFixed(2))),
    nota_proyectada: conNota.length > 0 ? Math.min(10, Number(notaActual.toFixed(2))) : null,
    puede_promocionar: notaActual >= config.nota_promocionar,
    puede_aprobar: notaActual >= config.nota_aprobar,
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
  // Solo cuentan las aprobadas que tienen alguna nota cargada: una materia
  // aprobada sin nota (ej. una equivalencia) no es un 0 y no debe bajar el promedio.
  const promedios = materias
    .filter((m) => m.estado === "aprobada")
    .map((m) => calcularResultadoMateria(m))
    .filter((r) => r.nota_proyectada !== null)
    .map((r) => r.promedio_actual);
  if (promedios.length === 0) return 0;

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
