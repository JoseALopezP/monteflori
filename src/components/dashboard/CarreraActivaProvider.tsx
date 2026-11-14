"use client";

// src/components/dashboard/CarreraActivaProvider.tsx
// Qué carrera se está mirando en todo el dashboard (o "Todas"). La elección se
// guarda en Usuario.configuracion.carrera_activa, así la próxima vez la app
// arranca en la misma. También expone las materias ya filtradas por esa
// carrera, que es lo que necesita casi toda pantalla.

import {
  createContext, useCallback, useContext, useMemo, useState, ReactNode,
} from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useDatos } from "./DatosProvider";
import { updateConfiguracion } from "@/lib/firestore";
import { Carrera, Materia } from "@/types";

interface CarreraActivaContextValue {
  carreras: Carrera[];
  carreraActivaId: string | null;
  carreraActiva: Carrera | null;
  setCarreraActivaId: (id: string | null) => void;
  /** Materias de la carrera activa, o todas si se está en "Todas las carreras" */
  materiasVisibles: Materia[];
  loading: boolean;
}

const CarreraActivaContext = createContext<CarreraActivaContextValue>({
  carreras: [],
  carreraActivaId: null,
  carreraActiva: null,
  setCarreraActivaId: () => {},
  materiasVisibles: [],
  loading: true,
});

export function CarreraActivaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const { carreras, materias, perfil, loadingCarreras, loadingPerfil } = useDatos();

  // Elección hecha en esta sesión: gana sobre lo guardado para que el cambio se
  // vea al instante, sin esperar la ida y vuelta a Firestore.
  const [eleccion, setEleccion] = useState<{ uid: string; id: string | null } | null>(null);

  const guardada = perfil?.configuracion?.carrera_activa ?? null;
  const pedida = eleccion && eleccion.uid === uid ? eleccion.id : guardada;
  // La carrera guardada puede haberse borrado: en ese caso se muestran todas.
  const carreraActiva = carreras.find((c) => c.id === pedida) ?? null;
  const carreraActivaId = carreraActiva?.id ?? null;

  const setCarreraActivaId = useCallback(
    (id: string | null) => {
      if (!uid) return;
      setEleccion({ uid, id });
      updateConfiguracion(uid, { carrera_activa: id }).catch(() => {
        // Si no se pudo guardar, la elección igual vale para esta sesión.
      });
    },
    [uid]
  );

  const materiasVisibles = useMemo(
    () =>
      carreraActivaId
        ? materias.filter((m) => m.carreras_vinculadas?.includes(carreraActivaId))
        : materias,
    [materias, carreraActivaId]
  );

  return (
    <CarreraActivaContext.Provider
      value={{
        carreras,
        carreraActivaId,
        carreraActiva,
        setCarreraActivaId,
        materiasVisibles,
        loading: loadingCarreras || loadingPerfil,
      }}
    >
      {children}
    </CarreraActivaContext.Provider>
  );
}

export function useCarreraActivaContext() {
  return useContext(CarreraActivaContext);
}
