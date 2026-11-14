"use client";

// src/components/auth/AuthGuard.tsx
// Protege las rutas del dashboard: sin sesión, manda a /login.

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { PantallaCargando } from "@/components/ui/kit";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) return <PantallaCargando texto="Abriendo tu espacio..." />;

  return <>{children}</>;
}
