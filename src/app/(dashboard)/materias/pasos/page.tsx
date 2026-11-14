"use client";

// src/app/(dashboard)/materias/pasos/page.tsx
// Plan de carrera: qué ya está hecho, qué se puede cursar ahora y qué está
// trabado por correlativas, año por año.

import { useMemo } from "react";
import Link from "next/link";
import { Check, CircleDashed, Lock, PlayCircle, RefreshCw, Route, Unlock } from "lucide-react";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { MateriaFila } from "@/components/materias/MateriaFila";
import { EmptyState, Esqueleto, PageHeader } from "@/components/ui/kit";
import { buildGrafo, getMateriasHabilitadas } from "@/lib/grafo-correlativas";
import { calcularPorcentajeAvance } from "@/lib/calculo-notas";
import { Materia } from "@/types";

function agruparPorAnio(materias: Materia[]) {
  const grupos = new Map<number | "sin-anio", Materia[]>();
  materias.forEach((m) => {
    const clave = m.año_plan ?? "sin-anio";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(m);
  });

  return Array.from(grupos.keys())
    .sort((a, b) => (a === "sin-anio" ? 1 : b === "sin-anio" ? -1 : a - b))
    .map((clave) => ({
      clave,
      materias: grupos.get(clave)!.sort((a, b) => {
        // Anual (0) primero, después 1° y 2° cuatrimestre; sin dato al final.
        const cuat = (a.cuatrimestre_plan ?? 9) - (b.cuatrimestre_plan ?? 9);
        return cuat !== 0 ? cuat : a.nombre.localeCompare(b.nombre, "es");
      }),
    }));
}

export default function PasosPage() {
  const { loading } = useMaterias();
  const { carreraActiva, materiasVisibles } = useCarreraActivaContext();

  const { habilitadas, grafoPorId, grupos } = useMemo(() => {
    const grafo = buildGrafo(materiasVisibles);
    const ids = new Set(getMateriasHabilitadas(grafo).map((n) => n.id));
    return {
      habilitadas: materiasVisibles.filter((m) => ids.has(m.id)),
      grafoPorId: new Map(grafo.map((n) => [n.id, n])),
      grupos: agruparPorAnio(materiasVisibles),
    };
  }, [materiasVisibles]);

  const nombrePorId = new Map(materiasVisibles.map((m) => [m.id, m.nombre]));
  const habilitadasIds = new Set(habilitadas.map((m) => m.id));
  const porcentaje = Math.min(100, calcularPorcentajeAvance(materiasVisibles, carreraActiva?.total_materias_plan));
  const sinCorrelativas = materiasVisibles.every((m) => !m.correlativas_requisito?.length);

  function iconoDe(m: Materia, bloqueada: boolean) {
    if (m.estado === "aprobada") return <Check size={17} strokeWidth={3} className="text-primary flex-shrink-0" />;
    if (m.estado === "regular") return <Check size={17} className="text-secondary flex-shrink-0" />;
    if (m.estado === "cursando") return <PlayCircle size={17} className="text-accent flex-shrink-0" />;
    if (bloqueada) return <Lock size={16} className="text-foreground-subtle flex-shrink-0" />;
    if (habilitadasIds.has(m.id)) return <Unlock size={16} className="text-primary flex-shrink-0" />;
    return <CircleDashed size={17} className="text-foreground-subtle flex-shrink-0" />;
  }

  return (
    <main className="page page-narrow">
      <PageHeader
        titulo="Plan de carrera"
        subtitulo={
          materiasVisibles.length > 0
            ? `${carreraActiva ? carreraActiva.nombre : "Todas tus materias"} · ${porcentaje}% recorrido`
            : undefined
        }
      />

      {loading ? (
        <Esqueleto filas={3} alto="h-28" />
      ) : materiasVisibles.length === 0 ? (
        <EmptyState
          icono={<Route size={22} />}
          titulo="Todavía no hay un plan para mostrar"
          texto="Cuando tengas tus materias cargadas, acá vas a ver año por año qué te falta y qué podés cursar."
        >
          <Link href="/materias/importar" className="btn btn-primary">
            <RefreshCw size={15} /> Traer de SIU Guaraní
          </Link>
          <Link href="/materias/nueva" className="btn btn-secondary">Cargar a mano</Link>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="progress" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la carrera">
            <span style={{ width: `${porcentaje}%` }} />
          </div>

          {habilitadas.length > 0 && (
            <section
              className="rounded-[var(--radius-lg)] border overflow-hidden"
              style={{ background: "var(--color-primary-soft)", borderColor: "var(--color-primary-light)" }}
            >
              <div className="px-4 pt-4 pb-2">
                <h2 className="section-title flex items-center gap-2">
                  <Unlock size={16} className="text-primary" />
                  Podés cursar ahora
                  <span className="badge !bg-card">{habilitadas.length}</span>
                </h2>
                <p className="text-sm text-foreground-muted mt-0.5">
                  {sinCorrelativas
                    ? "No tenés correlativas cargadas, así que figuran todas las pendientes."
                    : "Ya tenés aprobadas o regulares todas sus correlativas."}
                </p>
              </div>
              <div className="divide-y divide-card-border bg-card border-t border-card-border">
                {habilitadas.map((m) => <MateriaFila key={m.id} materia={m} sinEstado />)}
              </div>
            </section>
          )}

          {grupos.map(({ clave, materias }) => {
            const hechas = materias.filter((m) => m.estado === "aprobada").length;
            return (
              <section key={clave} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-background-alt">
                  <h2 className="section-title">
                    {clave === "sin-anio" ? "Sin año asignado" : `${clave}° año`}
                  </h2>
                  <span className="text-xs font-bold text-foreground-muted tabular">
                    {hechas === materias.length ? "Completo" : `${hechas} de ${materias.length} aprobadas`}
                  </span>
                </div>
                <div className="divide-y divide-card-border">
                  {materias.map((m) => {
                    const faltantes = (grafoPorId.get(m.id)?.bloqueada_por ?? [])
                      .map((id) => nombrePorId.get(id))
                      .filter(Boolean);
                    const bloqueada = (m.estado === "pendiente" || m.estado === "libre") && faltantes.length > 0;
                    return (
                      <MateriaFila
                        key={m.id}
                        materia={m}
                        icono={iconoDe(m, bloqueada)}
                        atenuada={m.estado === "aprobada"}
                        detalle={bloqueada ? `Te falta: ${faltantes.join(", ")}` : undefined}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}

          {grupos.some((g) => g.clave === "sin-anio") && (
            <p className="text-xs text-foreground-subtle text-center">
              Para ordenar una materia por año, entrá a la materia → Editar → Más detalles.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
