"use client";

// src/components/materias/MateriaCursandoCard.tsx
// Tarjeta de una materia en curso, para el inicio: muestra de un vistazo cómo
// va (promedio, próxima fecha) y deja cargar o corregir notas ahí mismo, sin
// entrar a la materia.

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Plus } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Feedback";
import { NotaEditable } from "@/components/ui/kit";
import { AgregarNotaModal } from "@/components/notas/AgregarNotaModal";
import { updateEvaluacion } from "@/lib/firestore";
import { calcularResultadoMateria, evaluacionRecuperadaPor } from "@/lib/calculo-notas";
import { colorNota, formatearNota, infoTipo } from "@/lib/estados";
import { diasHasta, esProxima, etiquetaRelativa } from "@/lib/fechas";
import { Materia } from "@/types";

export function MateriaCursandoCard({ materia }: { materia: Materia }) {
  const { user } = useAuthContext();
  const toast = useToast();
  const [agregando, setAgregando] = useState(false);

  const resultado = calcularResultadoMateria(materia);
  const { nota_aprobar, nota_promocionar } = materia.configuracion_nota;
  const tieneNotas = resultado.nota_proyectada !== null;

  const proxima = (materia.fechas_importantes ?? [])
    .filter((f) => esProxima(f.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const diasProxima = proxima ? diasHasta(proxima.fecha) : null;
  const urgente = diasProxima !== null && diasProxima <= 3;

  const mensaje = !tieneNotas
    ? "Todavía sin notas"
    : resultado.puede_promocionar
    ? "Vas para promocionar"
    : resultado.puede_aprobar
    ? "Vas aprobando"
    : `Necesitás llegar a ${nota_aprobar}`;

  async function guardarNota(evalId: string, nota: number | null) {
    if (!user) return;
    try {
      await updateEvaluacion(user.uid, materia.id, evalId, { nota }, materia.evaluaciones);
      toast(nota === null ? "Nota borrada" : "Nota guardada");
    } catch {
      toast("No se pudo guardar la nota", "error");
    }
  }

  return (
    <article className="card overflow-hidden animate-fade-in">
      <Link
        href={`/materias/${materia.id}`}
        className="row-hover flex items-center gap-3 px-4 sm:px-5 py-4"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground leading-snug truncate">{materia.nombre}</h3>
          <p className="text-sm text-foreground-muted mt-0.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
            <span>{mensaje}</span>
            {proxima && (
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: urgente ? "var(--color-alert)" : "var(--color-accent-dark)" }}
              >
                <Clock size={12} />
                {proxima.nombre} · {etiquetaRelativa(proxima.fecha).toLowerCase()}
              </span>
            )}
          </p>
        </div>
        {tieneNotas && (
          <span
            className="font-display tabular text-2xl font-semibold flex-shrink-0"
            style={{ color: colorNota(resultado.promedio_actual, nota_aprobar, nota_promocionar) }}
            title="Tu nota hasta ahora"
          >
            {formatearNota(resultado.promedio_actual, 1)}
          </span>
        )}
        <ChevronRight size={18} className="text-foreground-subtle flex-shrink-0" />
      </Link>

      <div className="border-t border-card-border px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
        {materia.evaluaciones.map((ev) => (
          <span
            key={ev.id}
            className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-[var(--radius-md)] bg-background-alt"
          >
            <span className="text-xs font-semibold text-foreground-muted max-w-36 truncate" title={infoTipo(ev.tipo).label}>
              {ev.nombre}
            </span>
            <NotaEditable
              nota={ev.nota}
              nombre={ev.nombre}
              aprobar={nota_aprobar}
              promocionar={nota_promocionar}
              anulada={!!evaluacionRecuperadaPor(ev.id, materia.evaluaciones)}
              onGuardar={(nota) => guardarNota(ev.id, nota)}
            />
          </span>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAgregando(true)}>
          <Plus size={14} /> {materia.evaluaciones.length === 0 ? "Cargar la primera nota" : "Nota"}
        </button>
      </div>

      {agregando && (
        <AgregarNotaModal
          materias={[materia]}
          materiaIdInicial={materia.id}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </article>
  );
}
