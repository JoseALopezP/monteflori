// src/lib/estadisticas.ts
// Los números detrás de la pantalla de Gráficos. Funciones puras: reciben las
// materias y devuelven series listas para dibujar, así se pueden testear sin
// montar ninguna pantalla.

import { calcularResultadoMateria } from "./calculo-notas";
import { diasHasta } from "./fechas";
import { ActoAcademico, Materia } from "@/types";

const esAprobatorio = (a: ActoAcademico) =>
  a.tipo === "promocion" || (a.tipo === "examen" && /aprob|promoc/i.test(a.resultado ?? ""));

/**
 * Cuándo se aprobó la materia (ISO), o null si no hay forma de saberlo.
 * Primero mira la historia académica de SIU; si no hay, usa la fecha de la
 * última evaluación con nota (la importación guarda ahí la fecha de aprobación).
 */
export function fechaAprobacion(materia: Materia): string | null {
  if (materia.estado !== "aprobada") return null;

  const deActos = (materia.actos_academicos ?? [])
    .filter((a) => esAprobatorio(a) && a.fecha)
    .map((a) => a.fecha as string)
    .sort();
  if (deActos.length > 0) return deActos[deActos.length - 1];

  const deEvaluaciones = (materia.evaluaciones ?? [])
    .filter((e) => e.fecha && e.nota !== null && e.nota !== undefined)
    .map((e) => (e.fecha as string).slice(0, 10))
    .sort();
  return deEvaluaciones.length > 0 ? deEvaluaciones[deEvaluaciones.length - 1] : null;
}

/** Nota con la que cuenta la materia para el promedio, o null si no tiene ninguna cargada. */
export function notaFinal(materia: Materia): number | null {
  const r = calcularResultadoMateria(materia);
  return r.nota_proyectada === null ? null : r.promedio_actual;
}

const promediar = (notas: number[]) =>
  notas.length === 0 ? null : Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;

export interface PuntoAnual {
  año: number;
  /** Materias aprobadas ese año */
  aprobadas: number;
  /** Materias aprobadas hasta ese año inclusive */
  acumuladas: number;
  /** Promedio de las aprobadas ese año (null si ninguna tiene nota) */
  promedioAño: number | null;
  /** Promedio general hasta ese año inclusive */
  promedioAcumulado: number | null;
}

/**
 * La carrera año por año. Incluye los años sin aprobadas que quedan en el
 * medio: un parate también es parte de la historia y no hay que esconderlo.
 * `sinFecha` cuenta las aprobadas que no se pudieron ubicar en el tiempo.
 */
export function lineaDeTiempo(materias: Materia[]): { puntos: PuntoAnual[]; sinFecha: number } {
  const porAño = new Map<number, number[]>();
  const cantidadPorAño = new Map<number, number>();
  let sinFecha = 0;

  materias
    .filter((m) => m.estado === "aprobada")
    .forEach((m) => {
      const fecha = fechaAprobacion(m);
      const año = fecha ? Number(fecha.slice(0, 4)) : NaN;
      if (!Number.isInteger(año)) {
        sinFecha++;
        return;
      }
      cantidadPorAño.set(año, (cantidadPorAño.get(año) ?? 0) + 1);
      const nota = notaFinal(m);
      if (nota !== null) porAño.set(año, [...(porAño.get(año) ?? []), nota]);
    });

  if (cantidadPorAño.size === 0) return { puntos: [], sinFecha };

  const años = Array.from(cantidadPorAño.keys());
  const desde = Math.min(...años);
  const hasta = Math.max(...años);

  const puntos: PuntoAnual[] = [];
  let acumuladas = 0;
  let notasHastaAca: number[] = [];
  for (let año = desde; año <= hasta; año++) {
    const aprobadas = cantidadPorAño.get(año) ?? 0;
    const notas = porAño.get(año) ?? [];
    acumuladas += aprobadas;
    notasHastaAca = [...notasHastaAca, ...notas];
    puntos.push({
      año,
      aprobadas,
      acumuladas,
      promedioAño: promediar(notas),
      promedioAcumulado: promediar(notasHastaAca),
    });
  }
  return { puntos, sinFecha };
}

export interface AvanceDeAño {
  /** Año del plan de estudios; null agrupa las materias sin año asignado */
  año: number | null;
  total: number;
  aprobadas: number;
  regulares: number;
  cursando: number;
  /** Pendientes y libres: lo que todavía falta encarar */
  restantes: number;
}

/** Cuánto está hecho de cada año del plan de estudios. */
export function avancePorAñoDelPlan(materias: Materia[]): AvanceDeAño[] {
  const grupos = new Map<number | null, AvanceDeAño>();
  materias.forEach((m) => {
    const año = m.año_plan ?? null;
    const g = grupos.get(año) ?? { año, total: 0, aprobadas: 0, regulares: 0, cursando: 0, restantes: 0 };
    g.total++;
    if (m.estado === "aprobada") g.aprobadas++;
    else if (m.estado === "regular") g.regulares++;
    else if (m.estado === "cursando") g.cursando++;
    else g.restantes++;
    grupos.set(año, g);
  });
  return Array.from(grupos.values()).sort((a, b) =>
    a.año === null ? 1 : b.año === null ? -1 : a.año - b.año
  );
}

export interface FormasDeAprobar {
  promocion: number;
  examen: number;
  /** Aprobadas sin historia académica: no se sabe cómo */
  sinDato: number;
}

/** De las materias aprobadas, cuántas fueron por promoción y cuántas por examen final. */
export function formasDeAprobar(materias: Materia[]): FormasDeAprobar {
  const r: FormasDeAprobar = { promocion: 0, examen: 0, sinDato: 0 };
  materias
    .filter((m) => m.estado === "aprobada")
    .forEach((m) => {
      const actos = m.actos_academicos ?? [];
      if (actos.some((a) => a.tipo === "promocion")) r.promocion++;
      else if (actos.some((a) => a.tipo === "examen" && esAprobatorio(a))) r.examen++;
      else r.sinDato++;
    });
  return r;
}

/**
 * Promedio contando también los exámenes desaprobados (los "aplazos"), que es
 * como lo piden algunas becas. null si no hay historia académica para calcularlo.
 */
export function promedioConAplazos(materias: Materia[]): number | null {
  const notas = materias
    .flatMap((m) => m.actos_academicos ?? [])
    .filter((a) => (a.tipo === "examen" || a.tipo === "promocion") && a.nota !== null)
    .map((a) => a.nota as number);
  return promediar(notas);
}

export interface RegularidadPorVencer {
  materiaId: string;
  nombre: string;
  /** ISO (YYYY-MM-DD) */
  vence: string;
  /** Días que faltan; negativo si ya venció */
  dias: number;
}

/**
 * Materias regulares con fecha de vencimiento, de la más urgente a la más
 * lejana. Perder una regularidad obliga a recursar: es el dato que más
 * conviene tener a la vista.
 */
export function regularidadesPorVencer(materias: Materia[], hoy: Date = new Date()): RegularidadPorVencer[] {
  return materias
    .filter((m) => m.estado === "regular")
    .map((m) => {
      const vencimientos = (m.actos_academicos ?? [])
        .filter((a) => a.tipo === "regularidad" && a.vencimiento)
        .map((a) => a.vencimiento as string)
        .sort();
      // Si regularizó más de una vez, vale la última.
      const vence = vencimientos[vencimientos.length - 1];
      const dias = vence ? diasHasta(vence, hoy) : null;
      return vence && dias !== null ? { materiaId: m.id, nombre: m.nombre, vence, dias } : null;
    })
    .filter((r): r is RegularidadPorVencer => r !== null)
    .sort((a, b) => a.dias - b.dias);
}
