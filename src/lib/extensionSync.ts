// src/lib/extensionSync.ts
// Puente de comunicación con la extensión "Monteflori Sync" vía
// externally_connectable (chrome.runtime.sendMessage con el ID de la extensión).
// No requiere que el dashboard esté en la misma pestaña que el portal universitario.

import { EstadoMateria } from "@/types";

export interface MateriaScrapeada {
  nombre: string;
  codigo_interno?: string;
  año_plan?: number;
  cuatrimestre_plan?: number;
  periodo_texto?: string | null;
  nota: number | null;
  estado: EstadoMateria;
  correlativas_nombres: string[];
}

export interface ScrapeData {
  portal: string;
  universidad: string;
  carrera: string | null;
  materias: MateriaScrapeada[];
  /** Errores no fatales durante el scraping (ej. una fila con estructura inesperada) */
  errores?: string[];
  timestamp: string;
  sincronizadoEn?: string;
  url?: string;
}

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

type ChromeRuntimeLike = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

function getRuntime(): ChromeRuntimeLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { chrome?: { runtime?: ChromeRuntimeLike } };
  return w.chrome?.runtime ?? null;
}

export function extensionConfigurada(): boolean {
  return !!EXTENSION_ID;
}

/** Verifica si la extensión está instalada y respondiendo. */
export function pingExtension(): Promise<boolean> {
  return new Promise((resolve) => {
    const runtime = getRuntime();
    if (!runtime || !EXTENSION_ID) return resolve(false);
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "SGAI_PING" }, () => {
        resolve(!runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Trae el último resultado de scraping guardado por la extensión (o null). */
export function obtenerUltimaSincronizacion(): Promise<ScrapeData | null> {
  return new Promise((resolve) => {
    const runtime = getRuntime();
    if (!runtime || !EXTENSION_ID) return resolve(null);
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "SGAI_GET_LAST_SYNC" }, (response) => {
        if (runtime.lastError) return resolve(null);
        const r = response as { ok?: boolean; datos?: ScrapeData | null } | undefined;
        resolve(r?.ok ? r.datos ?? null : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** Limpia el resultado guardado (después de importarlo) para no reimportarlo por error. */
export function limpiarUltimaSincronizacion(): Promise<void> {
  return new Promise((resolve) => {
    const runtime = getRuntime();
    if (!runtime || !EXTENSION_ID) return resolve();
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "SGAI_CLEAR_LAST_SYNC" }, () => resolve());
    } catch {
      resolve();
    }
  });
}
