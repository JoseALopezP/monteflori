"use client";

// src/components/dashboard/StatsCard.tsx
// Tarjeta de KPI para el dashboard

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icono: ReactNode;
  color?: string;
  tendencia?: "up" | "down" | "neutral";
  tendenciaTexto?: string;
}

export function StatsCard({
  titulo,
  valor,
  subtitulo,
  icono,
  color = "var(--color-primary)",
  tendencia,
  tendenciaTexto,
}: StatsCardProps) {
  const tendenciaColor =
    tendencia === "up"
      ? "var(--color-success)"
      : tendencia === "down"
      ? "var(--color-alert)"
      : "var(--foreground-muted)";

  const TendenciaIcon =
    tendencia === "up"
      ? TrendingUp
      : tendencia === "down"
      ? TrendingDown
      : Minus;

  return (
    <div
      className="rounded-2xl p-5 border transition-all hover:shadow-sm group"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-card-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--background-alt)" }}
        >
          <span style={{ color }}>{icono}</span>
        </div>
        {tendencia && tendenciaTexto && (
          <div
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: tendenciaColor }}
          >
            <TendenciaIcon size={11} />
            {tendenciaTexto}
          </div>
        )}
      </div>

      <div
        className="text-2xl font-semibold tracking-tight mb-0.5"
        style={{ color: "var(--foreground)" }}
      >
        {valor}
      </div>

      <div
        className="text-sm font-medium"
        style={{ color: "var(--foreground-muted)" }}
      >
        {titulo}
      </div>

      {subtitulo && (
        <div
          className="text-xs mt-1"
          style={{ color: "var(--foreground-subtle)" }}
        >
          {subtitulo}
        </div>
      )}
    </div>
  );
}
