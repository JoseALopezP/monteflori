"use client";

// src/components/dashboard/ProximasFechas.tsx
// "Lo que viene": las próximas fechas de examen, de la más cercana a la más
// lejana. Cada una lleva a su materia.

import Link from "next/link";
import { CalendarArrowDown, CalendarDays, CalendarPlus } from "lucide-react";
import { useToast } from "@/components/ui/Feedback";
import { descargarIcs } from "@/lib/ics";
import { infoTipo } from "@/lib/estados";
import { diasHasta, etiquetaRelativa, parsearFecha, proximasFechas } from "@/lib/fechas";
import { Materia } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProximasFechasProps {
  materias: Materia[];
  /** Cuántas mostrar como mucho */
  maximo?: number;
  onAgendar: () => void;
}

export function ProximasFechas({ materias, maximo = 5, onAgendar }: ProximasFechasProps) {
  const toast = useToast();
  const todas = proximasFechas(materias);
  const fechas = todas.slice(0, maximo);

  function llevarAlCalendario() {
    descargarIcs(todas, "monteflori-fechas.ics");
    toast("Archivo descargado: abrilo para sumarlo a tu calendario");
  }

  return (
    <section className="card card-pad flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="section-title flex items-center gap-2">
          <CalendarDays size={17} className="text-accent" />
          Lo que viene
        </h2>
        <button type="button" className="btn btn-ghost btn-sm -mr-2" onClick={onAgendar}>
          <CalendarPlus size={14} /> Agendar
        </button>
      </div>

      {fechas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <p className="text-sm font-semibold text-foreground-muted">No tenés fechas agendadas</p>
          <p className="text-xs text-foreground-subtle mt-1 max-w-xs">
            Agendá tus parciales y finales para verlos acá y que no se te pase ninguno.
          </p>
        </div>
      ) : (
        <ul className="space-y-1 -mx-2">
          {fechas.map((f) => {
            const dias = diasHasta(f.fecha) ?? 0;
            const urgente = dias <= 3;
            const d = parsearFecha(f.fecha)!;
            return (
              <li key={`${f.materiaId}-${f.id}`}>
                <Link
                  href={`/materias/${f.materiaId}`}
                  className="row-hover flex items-center gap-3 px-2 py-2 rounded-[var(--radius-md)]"
                >
                  {/* Hoja de calendario */}
                  <span
                    className="w-11 h-12 rounded-[var(--radius-sm)] flex flex-col items-center justify-center flex-shrink-0 leading-none"
                    style={{
                      background: urgente ? "var(--estado-libre-bg)" : "var(--background-alt)",
                      color: urgente ? "var(--color-alert)" : "var(--foreground)",
                    }}
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">
                      {format(d, "MMM", { locale: es }).replace(".", "")}
                    </span>
                    <span className="font-display tabular text-lg font-semibold mt-0.5">{format(d, "d")}</span>
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-foreground truncate">{f.materiaNombre}</span>
                    <span className="block text-xs text-foreground-muted truncate">
                      {f.nombre}
                      {f.nombre.toLowerCase().includes(infoTipo(f.tipo).label.toLowerCase())
                        ? ""
                        : ` · ${infoTipo(f.tipo).label}`}
                    </span>
                  </span>

                  <span
                    className="text-xs font-extrabold flex-shrink-0"
                    style={{ color: urgente ? "var(--color-alert)" : "var(--foreground-muted)" }}
                  >
                    {etiquetaRelativa(f.fecha)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {todas.length > 0 && (
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-card-border">
          <p className="text-xs text-foreground-subtle">
            {todas.length > fechas.length ? `Y ${todas.length - fechas.length} más adelante.` : ""}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm -mr-2"
            onClick={llevarAlCalendario}
            title="Descarga un archivo que abre Apple Calendar, Samsung Calendar, Outlook o el que uses"
          >
            <CalendarArrowDown size={14} /> Llevar a mi calendario
          </button>
        </div>
      )}
    </section>
  );
}
