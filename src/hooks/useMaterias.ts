"use client";

// src/hooks/useMaterias.ts
// Hook con suscripción en tiempo real a las materias del usuario

import { useEffect, useState } from "react";
import { suscribirMaterias } from "@/lib/firestore";
import { Materia } from "@/types";

export function useMaterias(uid: string | null) {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setMaterias([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = suscribirMaterias(uid, (data) => {
      setMaterias(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // Filtros útiles derivados
  const materiasCursando = materias.filter((m) => m.estado === "cursando");
  const materiasAprobadas = materias.filter((m) => m.estado === "aprobada");
  const materiasPendientes = materias.filter((m) => m.estado === "pendiente");

  return {
    materias,
    materiasCursando,
    materiasAprobadas,
    materiasPendientes,
    loading,
    error,
  };
}
