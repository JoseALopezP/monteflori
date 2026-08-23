"use client";

// src/app/(dashboard)/layout.tsx
// Layout compartido por todas las páginas del dashboard: exige sesión,
// provee el estado global de carrera activa, y muestra el navbar en todas.

import { AuthGuard } from "@/components/auth/AuthGuard";
import { CarreraActivaProvider } from "@/components/dashboard/CarreraActivaProvider";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { AvisoCalendar } from "@/components/dashboard/AvisoCalendar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CarreraActivaProvider>
        <DashboardNav />
        {/* Dispara el repaso diario de Calendar y avisa si quedó fallando. */}
        <div className="max-w-5xl mx-auto px-4 pt-4 empty:hidden">
          <AvisoCalendar />
        </div>
        {children}
      </CarreraActivaProvider>
    </AuthGuard>
  );
}
