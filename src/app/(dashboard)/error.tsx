"use client";

// src/app/(dashboard)/error.tsx
// Boundary de error del dashboard: a diferencia de global-error.tsx (que solo
// se activa si falla el layout raíz entero), este atrapa errores de cualquier
// página del dashboard y deja el navbar en pie, así se puede seguir navegando.

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
    <main
      className="min-h-[60vh] w-full flex items-center justify-center p-6 text-center"
      style={{ background: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--estado-libre-bg)" }}
        >
          <AlertCircle size={28} style={{ color: "var(--color-alert)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Algo salió mal
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--foreground-muted)" }}>
            Ya nos enteramos del error. Tus datos están a salvo — probá de nuevo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: "var(--color-primary)", color: "white" }}
          >
            <RotateCcw size={14} /> Reintentar
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all hover:opacity-75"
            style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
