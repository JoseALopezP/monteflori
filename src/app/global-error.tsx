"use client";

// src/app/global-error.tsx
// Boundary de error a nivel raíz — reporta a Sentry y muestra un fallback simple.
// Solo se activa si layout.tsx entero falla en renderizar.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#666" }}>
            Ya nos enteramos del error. Probá recargar la página.
          </p>
        </div>
      </body>
    </html>
  );
}
