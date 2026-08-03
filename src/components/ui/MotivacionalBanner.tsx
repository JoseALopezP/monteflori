"use client";

// src/components/ui/MotivacionalBanner.tsx
// Banner motivacional con estética Montessori

import { useMemo, useState } from "react";
import { Materia } from "@/types";
import { generarMensajeMotivacional } from "@/lib/motivacion";
import { Leaf, X } from "lucide-react";

interface MotivacionalBannerProps {
  materias: Materia[];
  totalMateriasPlan?: number;
  className?: string;
}

const TIPO_ESTILOS = {
  logro: {
    bg: "var(--estado-aprobada-bg)",
    border: "var(--estado-aprobada)",
    color: "var(--estado-aprobada)",
  },
  aliento: {
    bg: "var(--estado-cursando-bg)",
    border: "var(--estado-cursando)",
    color: "var(--color-accent-dark)",
  },
  alerta: {
    bg: "var(--estado-libre-bg)",
    border: "var(--estado-libre)",
    color: "var(--color-alert)",
  },
  bienvenida: {
    bg: "var(--estado-regular-bg)",
    border: "var(--estado-regular)",
    color: "var(--color-secondary-dark)",
  },
};

export default function MotivacionalBanner({
  materias,
  totalMateriasPlan,
  className = "",
}: MotivacionalBannerProps) {
  const [visible, setVisible] = useState(true);
  const mensaje = useMemo(
    () => generarMensajeMotivacional(materias, totalMateriasPlan),
    [materias, totalMateriasPlan]
  );

  const estilo = TIPO_ESTILOS[mensaje.tipo];

  if (!visible) return null;

  return (
    <div
      className={`relative rounded-xl px-5 py-4 border-l-[3px] animate-fade-in ${className}`}
      style={{
        background: estilo.bg,
        borderLeftColor: estilo.border,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 pr-6">
        <Leaf size={15} style={{ color: estilo.border, flexShrink: 0 }} />
        <p
          className="text-sm font-medium leading-relaxed"
          style={{ color: estilo.color }}
        >
          {mensaje.texto}
        </p>
      </div>

      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 opacity-40 hover:opacity-70 transition-opacity"
        style={{ color: estilo.color }}
        aria-label="Cerrar mensaje"
      >
        <X size={13} />
      </button>
    </div>
  );
}
