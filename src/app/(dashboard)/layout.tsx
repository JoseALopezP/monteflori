"use client";

// src/app/(dashboard)/layout.tsx
// Layout compartido por todas las páginas del dashboard: exige sesión, carga
// los datos del usuario una sola vez (DatosProvider), mantiene la carrera que
// se está mirando y muestra la navegación.

import { AuthGuard } from "@/components/auth/AuthGuard";
import { DatosProvider } from "@/components/dashboard/DatosProvider";
import { CarreraActivaProvider } from "@/components/dashboard/CarreraActivaProvider";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { AvisoCalendar } from "@/components/dashboard/AvisoCalendar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DatosProvider>
        <CarreraActivaProvider>
          <DashboardNav />
          {/* Dispara el repaso diario de Calendar y avisa si quedó fallando. */}
          <AvisoCalendar />
          {children}
        </CarreraActivaProvider>
      </DatosProvider>
    </AuthGuard>
  );
}
