"use client";

// src/components/dashboard/CarreraActivaProvider.tsx
// Estado global de "carrera activa" para todo el dashboard: qué carrera (o
// "Global") está seleccionada. Se inicializa con Usuario.configuracion.carrera_activa
// y persiste cualquier cambio, así la próxima vez que se entra a la app arranca
// en la misma carrera.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { getCarreras, getPerfilUsuario, updateConfiguracion } from "@/lib/firestore";
import { Carrera } from "@/types";

interface CarreraActivaContextValue {
  carreras: Carrera[];
  carreraActivaId: string | null;
  carreraActiva: Carrera | null;
  setCarreraActivaId: (id: string | null) => void;
  loading: boolean;
  refetchCarreras: () => void;
}

const CarreraActivaContext = createContext<CarreraActivaContextValue>({
  carreras: [],
  carreraActivaId: null,
  carreraActiva: null,
  setCarreraActivaId: () => {},
  loading: true,
  refetchCarreras: () => {},
});

export function CarreraActivaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraActivaId, setCarreraActivaIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchCarreras = useCallback(() => {
    if (!uid) return;
    getCarreras(uid).then(setCarreras);
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setCarreras([]);
      setCarreraActivaIdState(null);
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    Promise.all([getCarreras(uid), getPerfilUsuario(uid)]).then(([carrerasData, perfil]) => {
      if (cancelado) return;
      setCarreras(carrerasData);
      // La carrera principal guardada puede apuntar a una carrera ya borrada —
      // en ese caso caemos a vista global en vez de mostrar algo inexistente.
      const guardada = perfil?.configuracion?.carrera_activa ?? null;
      const sigueExistiendo = guardada && carrerasData.some((c) => c.id === guardada);
      setCarreraActivaIdState(sigueExistiendo ? guardada : null);
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [uid]);

  const setCarreraActivaId = useCallback(
    (id: string | null) => {
      setCarreraActivaIdState(id);
      if (uid) updateConfiguracion(uid, { carrera_activa: id });
    },
    [uid]
  );

  const carreraActiva = carreras.find((c) => c.id === carreraActivaId) ?? null;

  return (
    <CarreraActivaContext.Provider
      value={{ carreras, carreraActivaId, carreraActiva, setCarreraActivaId, loading, refetchCarreras }}
    >
      {children}
    </CarreraActivaContext.Provider>
  );
}

export function useCarreraActivaContext() {
  return useContext(CarreraActivaContext);
}
