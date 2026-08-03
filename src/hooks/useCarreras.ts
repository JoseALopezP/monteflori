"use client";

// src/hooks/useCarreras.ts
// Hook para gestionar las carreras del usuario

import { useCallback, useEffect, useState } from "react";
import { getCarreras } from "@/lib/firestore";
import { Carrera } from "@/types";

export function useCarreras(uid: string | null) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraActivaId, setCarreraActivaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!uid) {
      setCarreras([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getCarreras(uid).then((data) => {
      setCarreras(data);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const carreraActiva = carreras.find((c) => c.id === carreraActivaId) ?? null;

  return {
    carreras,
    carreraActivaId,
    setCarreraActivaId,
    carreraActiva,
    loading,
    refetch,
  };
}
