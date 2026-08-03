"use client";

// src/components/dashboard/ProximasFechas.tsx
// Timeline de próximas fechas importantes

import { Materia, FechaImportante } from "@/types";
import { Calendar, AlertCircle, Clock } from "lucide-react";
import { format, differenceInDays, parseISO, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

interface ProximasFechasProps {
  materias: Materia[];
  dias?: number;
}

interface FechaConMateria extends FechaImportante {
  nombreMateria: string;
}

const TIPO_COLORES: Record<string, string> = {
  parcial: "var(--color-accent)",
  recuperatorio: "var(--color-secondary)",
  final: "var(--color-alert)",
  tp: "var(--color-primary)",
  coloquio: "var(--color-primary-light)",
  otro: "var(--foreground-muted)",
};

const TIPO_LABELS: Record<string, string> = {
  parcial: "Parcial",
  recuperatorio: "Recuperatorio",
  final: "Final",
  tp: "TP",
  coloquio: "Coloquio",
  otro: "Evento",
};

export function ProximasFechas({ materias, dias = 30 }: ProximasFechasProps) {
  const hoy = new Date();

  // Recopilar todas las fechas futuras de todas las materias
  const fechas: FechaConMateria[] = [];

  materias.forEach((m) => {
    (m.fechas_importantes ?? []).forEach((f) => {
      if (!f.fecha) return;
      const diff = differenceInDays(parseISO(f.fecha), hoy);
      if (diff >= 0 && diff <= dias) {
        fechas.push({ ...f, nombreMateria: m.nombre });
      }
    });
  });

  // Ordenar por fecha
  fechas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (fechas.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: "var(--color-card)",
          borderColor: "var(--color-card-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3
          className="font-bold text-base mb-3 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <Calendar size={16} style={{ color: "var(--color-secondary)" }} />
          Próximas fechas
        </h3>
        <p
          className="text-sm text-center py-4"
          style={{ color: "var(--foreground-subtle)" }}
        >
          No hay fechas cargadas para los próximos {dias} días 🗓️
        </p>
      </div>
    );
  }

  function getLabelFecha(fechaStr: string) {
    const fecha = parseISO(fechaStr);
    const diff = differenceInDays(fecha, hoy);
    if (isToday(fecha)) return { label: "HOY", urgente: true };
    if (isTomorrow(fecha)) return { label: "MAÑANA", urgente: true };
    if (diff <= 7) return { label: `en ${diff} días`, urgente: diff <= 3 };
    return { label: format(fecha, "d 'de' MMM", { locale: es }), urgente: false };
  }

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-card-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <h3
        className="font-bold text-base mb-4 flex items-center gap-2"
        style={{ color: "var(--foreground)" }}
      >
        <Calendar size={16} style={{ color: "var(--color-secondary)" }} />
        Próximas fechas
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: "var(--estado-aprobada-bg)",
            color: "var(--estado-aprobada)",
          }}
        >
          {fechas.length} evento{fechas.length !== 1 ? "s" : ""}
        </span>
      </h3>

      <div className="space-y-3">
        {fechas.map((f, i) => {
          const { label, urgente } = getLabelFecha(f.fecha);
          const color = TIPO_COLORES[f.tipo] ?? "var(--foreground-muted)";

          return (
            <div
              key={`${f.id}-${i}`}
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:opacity-90"
              style={{
                background: urgente
                  ? "var(--estado-libre-bg)"
                  : "var(--background-alt)",
                border: urgente
                  ? "1px solid var(--color-alert-light)"
                  : "1px solid transparent",
              }}
            >
              {/* Indicador de tipo */}
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: color, minHeight: 24 }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                    style={{
                      background: `${color}22`,
                      color,
                    }}
                  >
                    {TIPO_LABELS[f.tipo] ?? f.tipo}
                  </span>
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {f.nombre}
                  </span>
                </div>
                <p
                  className="text-sm font-semibold mt-0.5 truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {f.nombreMateria}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <div
                  className="text-xs font-bold flex items-center gap-1"
                  style={{ color: urgente ? "var(--color-alert)" : "var(--foreground-muted)" }}
                >
                  {urgente && <AlertCircle size={10} />}
                  {label}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--foreground-subtle)" }}
                >
                  {format(parseISO(f.fecha), "d MMM", { locale: es })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
