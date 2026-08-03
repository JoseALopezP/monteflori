"use client";

// src/app/(dashboard)/layout.tsx
// Layout compartido por todas las páginas del dashboard: exige sesión,
// provee el estado global de carrera activa, y muestra el navbar en todas.

import { AuthGuard } from "@/components/auth/AuthGuard";
import { CarreraActivaProvider } from "@/components/dashboard/CarreraActivaProvider";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CarreraActivaProvider>
        <DashboardNav />
        {children}
      </CarreraActivaProvider>
    </AuthGuard>
  );
}
