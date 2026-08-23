"use client";

// src/components/dashboard/AvisoCalendar.tsx
// Dos cosas, ambas apoyadas en el perfil que ya se carga:
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
  const { perfil, recargar } = usePerfil(user?.uid ?? null);
  const yaCorrio = useRef(false);

  const conectado = !!perfil?.credenciales_externas?.google_calendar_refresh_token;
  const error = perfil?.uso?.calendar_ultimo_error;

  useEffect(() => {
    if (!user || !perfil || yaCorrio.current) return;
    if (!conectado) return;
    if (!tocaReconciliar(perfil.uso?.ultima_reconciliacion_calendar)) return;

    // Una sola vez por montaje, aunque el perfil se recargue.
    yaCorrio.current = true;

    sincronizarCalendar(user, { reconciliacion: true }).then(() => {
      // Refresca el perfil para que el aviso aparezca o desaparezca según
      // cómo haya salido el repaso.
      recargar();
    });
  }, [user, perfil, conectado, recargar]);

  if (!error) return null;

  return (
    <Link
      href="/configuracion"
      className="flex items-center gap-3 p-3.5 rounded-2xl border transition-all hover:opacity-85"
      style={{
        background: "var(--estado-libre-bg)",
        borderColor: "var(--color-alert-light)",
      }}
    >
      <AlertTriangle size={18} className="flex-shrink-0" style={{ color: "var(--color-alert)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--color-alert)" }}>
          {error.requiere_reconectar
            ? "Google Calendar se desconectó"
            : "No pudimos sincronizar con Google Calendar"}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {error.mensaje} Tocá para reconectar o dar de baja la sincronización.
        </p>
      </div>
      <ChevronRight size={16} className="flex-shrink-0" style={{ color: "var(--color-alert)" }} />
    </Link>
  );
}
