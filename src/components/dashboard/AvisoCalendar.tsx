"use client";

// src/components/dashboard/AvisoCalendar.tsx
// Dos cosas, ambas apoyadas en el perfil (que llega en tiempo real):
//
// 1. El repaso diario: una vez por día, al abrir la app, pide una
//    reconciliación completa por si quedó algo sin sincronizar.
// 2. El aviso: si la última sincronización falló, lo muestra con un link a
//    Configuración para reconectar o dar de baja. Sin esto, una sincronización
//    silenciosa que falla queda invisible y el usuario cree que está al día.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { usePerfil } from "@/hooks/usePerfil";
import { sincronizarCalendar, tocaReconciliar } from "@/lib/calendarCliente";

export function AvisoCalendar() {
  const { user } = useAuthContext();
  const { perfil } = usePerfil();
  const yaCorrio = useRef(false);

  const conectado = !!perfil?.credenciales_externas?.google_calendar_refresh_token;
  const error = perfil?.uso?.calendar_ultimo_error;

  useEffect(() => {
    if (!user || !perfil || yaCorrio.current) return;
    if (!conectado) return;
    if (!tocaReconciliar(perfil.uso?.ultima_reconciliacion_calendar)) return;

    // Una sola vez por montaje. El resultado llega solo: el servidor escribe en
    // el perfil y la suscripción lo trae.
    yaCorrio.current = true;
    sincronizarCalendar(user, { reconciliacion: true });
  }, [user, perfil, conectado]);

  if (!error) return null;

  return (
    <div className="max-w-5xl w-full mx-auto px-4 md:px-6 pt-4">
      <Link
        href="/configuracion#calendar"
        className="notice notice-error items-center transition-opacity hover:opacity-85"
      >
        <AlertTriangle size={18} className="flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-bold">
            {error.requiere_reconectar
              ? "Google Calendar se desconectó"
              : "No pudimos sincronizar con Google Calendar"}
          </span>
          <span className="block text-xs text-foreground-muted mt-0.5">
            {error.mensaje} Tocá para solucionarlo.
          </span>
        </span>
        <ChevronRight size={16} className="flex-shrink-0" />
      </Link>
    </div>
  );
}
