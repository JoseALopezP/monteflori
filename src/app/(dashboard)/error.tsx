"use client";

// src/app/(dashboard)/error.tsx
// Boundary de error del dashboard: a diferencia de global-error.tsx (que solo
// se activa si falla el layout raíz entero), este atrapa errores de cualquier
// página del dashboard y deja la navegación en pie, así se puede seguir usando la app.

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="page page-narrow">
      <div className="flex flex-col items-center text-center py-16">
        <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--estado-libre-bg)" }}>
          <AlertCircle size={26} className="text-alert" />
        </span>
        <h1 className="font-display text-2xl font-semibold text-foreground mt-4">Algo salió mal</h1>
        <p className="text-sm text-foreground-muted mt-2 max-w-sm">
          Ya nos enteramos del error. Tus datos están a salvo: probá de nuevo.
        </p>
        <div className="flex gap-2 mt-6">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw size={15} /> Reintentar
          </button>
          <Link href="/" className="btn btn-secondary">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
