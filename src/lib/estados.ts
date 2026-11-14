// src/lib/estados.ts
// Una sola definición de cómo se nombra y se pinta cada estado de materia y
// cada tipo de evaluación. Antes cada pantalla tenía su propia tabla y no
// coincidían (en una "TP", en otra "tp", en otra "Trabajo práctico").

import { EstadoMateria, TipoEvaluacion } from "@/types";

export interface InfoEstado {
  label: string;
  plural: string;
  color: string;
  bg: string;
  /** Qué significa, para quien no conoce la jerga */
  ayuda: string;
}

export const ESTADOS: Record<EstadoMateria, InfoEstado> = {
  cursando: {
    label: "Cursando",
    plural: "Cursando",
    color: "var(--estado-cursando)",
    bg: "var(--estado-cursando-bg)",
    ayuda: "La estás cursando este período",
  },
  regular: {
    label: "Regular",
    plural: "Regulares",
    color: "var(--estado-regular)",
    bg: "var(--estado-regular-bg)",
    ayuda: "Aprobaste la cursada, te falta el final",
  },
  aprobada: {
    label: "Aprobada",
    plural: "Aprobadas",
    color: "var(--estado-aprobada)",
    bg: "var(--estado-aprobada-bg)",
    ayuda: "Materia terminada",
  },
  pendiente: {
    label: "Pendiente",
    plural: "Pendientes",
    color: "var(--estado-pendiente)",
    bg: "var(--estado-pendiente-bg)",
    ayuda: "Todavía no la cursaste",
  },
  libre: {
    label: "Libre",
    plural: "Libres",
    color: "var(--estado-libre)",
    bg: "var(--estado-libre-bg)",
    ayuda: "Perdiste la regularidad",
  },
};

/** Orden en que se ofrecen en selectores y filtros */
export const ESTADOS_ORDEN: EstadoMateria[] = ["cursando", "regular", "aprobada", "pendiente", "libre"];

export function infoEstado(estado: EstadoMateria | string | undefined): InfoEstado {
  return ESTADOS[estado as EstadoMateria] ?? ESTADOS.pendiente;
}

export interface InfoTipo {
  label: string;
  corto: string;
  color: string;
}

export const TIPOS_EVALUACION: Record<TipoEvaluacion, InfoTipo> = {
  parcial: { label: "Parcial", corto: "Parcial", color: "var(--color-accent)" },
  recuperatorio: { label: "Recuperatorio", corto: "Recup.", color: "var(--color-secondary)" },
  tp: { label: "Trabajo práctico", corto: "TP", color: "var(--color-primary)" },
  coloquio: { label: "Coloquio", corto: "Coloquio", color: "var(--color-secondary-dark)" },
  final: { label: "Final", corto: "Final", color: "var(--color-alert)" },
  otro: { label: "Otro", corto: "Otro", color: "var(--foreground-muted)" },
};

export const TIPOS_ORDEN: TipoEvaluacion[] = ["parcial", "tp", "coloquio", "final", "recuperatorio", "otro"];

export function infoTipo(tipo: TipoEvaluacion | string | undefined): InfoTipo {
  return TIPOS_EVALUACION[tipo as TipoEvaluacion] ?? TIPOS_EVALUACION.otro;
}

/** "5" → 5, "7,5" → 7.5. null si está vacío; NaN si no es una nota válida (0 a 10). */
export function parsearNota(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || n > 10) return NaN;
  return Math.round(n * 100) / 100;
}

/** Color de una nota según los umbrales de la materia */
export function colorNota(nota: number, aprobar = 4, promocionar = 7): string {
  if (nota >= promocionar) return "var(--estado-aprobada)";
  if (nota >= aprobar) return "var(--color-accent)";
  return "var(--color-alert)";
}

/** 7 → "7", 7.5 → "7,5", 6.666 → "6,67" */
export function formatearNota(nota: number, decimales = 2): string {
  return nota.toLocaleString("es-AR", { maximumFractionDigits: decimales });
}

/** Colores para distinguir carreras: de la paleta de la app, legibles en claro y en oscuro. */
export const COLORES_CARRERA = ["#6B8A5A", "#C17D52", "#4F8A8B", "#B8963E", "#8E6BA8", "#B05A4A", "#5B7DB1", "#8E7B64"];
