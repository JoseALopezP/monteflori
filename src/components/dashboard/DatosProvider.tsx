"use client";

// src/components/dashboard/DatosProvider.tsx
// Los datos del usuario (materias, carreras, perfil), suscriptos UNA sola vez
// para todo el dashboard y en tiempo real.
//
// Antes cada pantalla abría su propia suscripción al entrar: navegar mostraba
// un spinner cada vez, y carreras/perfil se pedían una sola vez, así que un
// cambio hecho en una pantalla no aparecía en otra hasta recargar. Con esto,
// cambiar de pantalla es instantáneo y todo se actualiza solo.

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import { Unsubscribe } from "firebase/firestore";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { suscribirCarreras, suscribirMaterias, suscribirPerfil } from "@/lib/firestore";
import { Carrera, Materia, Usuario } from "@/types";

interface DatosContextValue {
  materias: Materia[];
  carreras: Carrera[];
  perfil: Usuario | null;
  loadingMaterias: boolean;
  loadingCarreras: boolean;
  loadingPerfil: boolean;
}

const SIN_MATERIAS: Materia[] = [];
const SIN_CARRERAS: Carrera[] = [];

const DatosContext = createContext<DatosContextValue>({
  materias: SIN_MATERIAS,
  carreras: SIN_CARRERAS,
  perfil: null,
  loadingMaterias: true,
  loadingCarreras: true,
  loadingPerfil: true,
});

type Suscribir<T> = (uid: string, callback: (datos: T) => void, onError: () => void) => Unsubscribe;

/**
 * Suscripción atada a un uid. El estado recuerda de qué usuario son los datos:
 * si el uid cambia (logout, otra cuenta), lo anterior deja de valer al instante
 * sin tener que limpiarlo a mano.
 */
function useSuscripcion<T>(uid: string | null, suscribir: Suscribir<T>, vacio: T) {
  const [estado, setEstado] = useState<{ uid: string | null; datos: T }>({ uid: null, datos: vacio });

  useEffect(() => {
    if (!uid) return;
    return suscribir(
      uid,
      (datos) => setEstado({ uid, datos }),
      // Sin permisos o sin conexión: mostramos vacío en vez de cargar para siempre.
      () => setEstado({ uid, datos: vacio })
    );
  }, [uid, suscribir, vacio]);

  const vigente = uid !== null && estado.uid === uid;
  return { datos: vigente ? estado.datos : vacio, loading: uid !== null && !vigente };
}

export function DatosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;

  const materias = useSuscripcion<Materia[]>(uid, suscribirMaterias, SIN_MATERIAS);
  const carreras = useSuscripcion<Carrera[]>(uid, suscribirCarreras, SIN_CARRERAS);
  const perfil = useSuscripcion<Usuario | null>(uid, suscribirPerfil, null);

  return (
    <DatosContext.Provider
      value={{
        materias: materias.datos,
        carreras: carreras.datos,
        perfil: perfil.datos,
        loadingMaterias: materias.loading,
        loadingCarreras: carreras.loading,
        loadingPerfil: perfil.loading,
      }}
    >
      {children}
    </DatosContext.Provider>
  );
}

export function useDatos() {
  return useContext(DatosContext);
}
