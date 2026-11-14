"use client";

// src/hooks/usePerfil.ts
// Perfil de Firestore del usuario (nombre, apodo, suscripción, estado de
// Calendar...), en tiempo real. Lee de DatosProvider.

import { useDatos } from "@/components/dashboard/DatosProvider";

export function usePerfil() {
  const { perfil, loadingPerfil } = useDatos();
  return { perfil, loading: loadingPerfil };
}
