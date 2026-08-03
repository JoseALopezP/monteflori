// src/lib/grafo-correlativas.ts
// Algoritmo de Kahn para ordenamiento topológico del árbol de correlativas
// Determina qué materias están habilitadas/bloqueadas para cursar

import { Materia, NodoGrafo, EstadoMateria } from "@/types";

const ESTADOS_APROBADOS: EstadoMateria[] = ["aprobada", "regular"];

/**
 * Construye la estructura de grafo a partir de un array plano de materias.
 * Determina para cada materia si está habilitada (todas sus correlativas aprobadas)
 * y qué materias habilita al ser aprobada.
 */
export function buildGrafo(materias: Materia[]): NodoGrafo[] {
  const mapaById = new Map<string, Materia>();
  materias.forEach((m) => mapaById.set(m.id, m));

  return materias.map((materia) => {
    const correlativas = materia.correlativas_requisito ?? [];

    // Verificar qué correlativas NO están aprobadas
    const bloqueada_por = correlativas.filter((corrId) => {
      const correlativa = mapaById.get(corrId);
      if (!correlativa) return false; // Si no existe, ignorar
      return !ESTADOS_APROBADOS.includes(correlativa.estado);
    });

    // Materias que esta materia habilita (es correlativa de esas)
    const habilita_a = materias
      .filter((m) => m.correlativas_requisito?.includes(materia.id))
      .map((m) => m.id);

    return {
      id: materia.id,
      nombre: materia.nombre,
      estado: materia.estado,
      habilitada: bloqueada_por.length === 0,
      bloqueada_por,
      habilita_a,
    };
  });
}

/**
 * Retorna las materias que están disponibles para cursar:
 * - No aprobadas todavía
 * - Con todas sus correlativas cumplidas
 */
export function getMateriasHabilitadas(grafo: NodoGrafo[]): NodoGrafo[] {
  return grafo.filter(
    (n) =>
      n.habilitada &&
      n.estado !== "aprobada" &&
      n.estado !== "regular" &&
      n.estado !== "cursando"
  );
}

/**
 * Retorna las materias que están bloqueadas (faltan correlativas).
 */
export function getMateriasBloqueadas(grafo: NodoGrafo[]): NodoGrafo[] {
  return grafo.filter((n) => !n.habilitada && n.estado === "pendiente");
}

/**
 * Ordenamiento topológico usando el algoritmo de Kahn.
 * Retorna el orden en que se deberían cursar las materias.
 * Si hay ciclos en el grafo (error de carga), retorna array vacío.
 */
export function ordenTopologico(materias: Materia[]): string[] {
  const grafo = buildGrafo(materias);
  const inDegree = new Map<string, number>();
  const adyacencia = new Map<string, string[]>();

  grafo.forEach((n) => {
    inDegree.set(n.id, n.bloqueada_por.length);
    adyacencia.set(n.id, n.habilita_a);
  });

  const cola: string[] = [];
  inDegree.forEach((grado, id) => {
    if (grado === 0) cola.push(id);
  });

  const resultado: string[] = [];

  while (cola.length > 0) {
    const actual = cola.shift()!;
    resultado.push(actual);

    const vecinos = adyacencia.get(actual) ?? [];
    vecinos.forEach((vecinoId) => {
      const nuevoGrado = (inDegree.get(vecinoId) ?? 1) - 1;
      inDegree.set(vecinoId, nuevoGrado);
      if (nuevoGrado === 0) {
        cola.push(vecinoId);
      }
    });
  }

  // Si no se procesaron todos los nodos, hay un ciclo
  if (resultado.length !== grafo.length) {
    console.warn("Grafo de correlativas: ciclo detectado.");
    return grafo.map((n) => n.id); // Fallback: orden original
  }

  return resultado;
}
