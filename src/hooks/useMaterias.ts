"use client";

// src/hooks/useMaterias.ts
// Materias del usuario, en tiempo real. Lee de DatosProvider: todas las
// pantallas comparten una sola suscripción.

import { useDatos } from "@/components/dashboard/DatosProvider";

export function useMaterias() {
  const { materias, loadingMaterias } = useDatos();
  return { materias, loading: loadingMaterias };
}
