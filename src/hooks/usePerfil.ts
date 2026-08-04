"use client";

// src/hooks/usePerfil.ts
// Perfil de Firestore del usuario (nombre, alias, bio, etc.) — separado de
// useAuth porque ese solo expone el User de Firebase Auth.

import { useEffect, useState, useCallback } from "react";
import { getPerfilUsuario } from "@/lib/firestore";
import { Usuario } from "@/types";

export function usePerfil(uid: string | null) {
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(() => {
    if (!uid) {
      setPerfil(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPerfilUsuario(uid).then((p) => {
      setPerfil(p);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { perfil, loading, setPerfil, recargar };
}
