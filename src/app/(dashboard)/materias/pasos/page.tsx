"use client";

// src/app/(dashboard)/materias/pasos/page.tsx
// Plan de ruta: qué te falta para terminar la carrera, organizado por año,
// en vez del grafo de nodos (ilegible con muchas materias).

import { useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, Layers, Unlock, Lock, CheckCircle2, BookOpen, Circle,
} from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { buildGrafo, getMateriasHabilitadas } from "@/lib/grafo-correlativas";
import { calcularPorcentajeAvance } from "@/lib/calculo-notas";
import { EstadoMateria, Materia } from "@/types";

const ESTADO_ICONO: Record<EstadoMateria, typeof CheckCircle2> = {
  aprobada: CheckCircle2,
  cursando: BookOpen,
  regular: Circle,
  libre: Circle,
  pendiente: Circle,
};

const ESTADO_COLOR: Record<EstadoMateria, string> = {
  aprobada: "var(--estado-aprobada)",
  cursando: "var(--estado-cursando)",
  regular: "var(--estado-regular)",
  libre: "var(--estado-libre)",
  pendiente: "var(--foreground-subtle)",
};

const ESTADO_LABEL: Record<EstadoMateria, string> = {
  aprobada: "Aprobada",
  cursando: "Cursando",
  regular: "Regular",
  libre: "Libre",
  pendiente: "Pendiente",
};

function agruparPorAnio(materias: Materia[]) {
  const grupos = new Map<number | "sin-anio", Materia[]>();
  materias.forEach((m) => {
    const clave = m.año_plan ?? "sin-anio";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(m);
  });

  const claves = Array.from(grupos.keys()).sort((a, b) => {
    if (a === "sin-anio") return 1;
    if (b === "sin-anio") return -1;
    return a - b;
  });

  return claves.map((clave) => ({
    clave,
    materias: grupos.get(clave)!.sort((a, b) => {
      const cuat = (a.cuatrimestre_plan ?? 9) - (b.cuatrimestre_plan ?? 9);
      return cuat !== 0 ? cuat : a.nombre.localeCompare(b.nombre);
    }),
  }));
}

export default function PasosPage() {
  const { user } = useAuthContext();
  const { materias, loading } = useMaterias(user?.uid ?? null);
  const { carreraActivaId, carreraActiva } = useCarreraActivaContext();

  const materiasFiltradas = carreraActivaId
    ? materias.filter((m) => m.carreras_vinculadas?.includes(carreraActivaId))
    : materias;

  const grafo = useMemo(() => buildGrafo(materiasFiltradas), [materiasFiltradas]);
  const habilitadas = useMemo(() => getMateriasHabilitadas(grafo), [grafo]);
  const habilitadasIds = new Set(habilitadas.map((n) => n.id));
  const grafoPorId = new Map(grafo.map((n) => [n.id, n]));
  const materiasPorId = new Map(materiasFiltradas.map((m) => [m.id, m]));

  const porcentaje = calcularPorcentajeAvance(materiasFiltradas, carreraActiva?.total_materias_plan);
  const grupos = useMemo(() => agruparPorAnio(materiasFiltradas), [materiasFiltradas]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div>
          <Link href="/materias" className="text-sm mb-1 flex items-center gap-1 hover:underline"
            style={{ color: "var(--foreground-muted)" }}>
            <ChevronLeft size={14} /> Materias
          </Link>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
            <Layers size={22} style={{ color: "var(--color-primary)" }} />
            Plan de ruta
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            {carreraActiva ? carreraActiva.nombre : "Vista global"} — {porcentaje}% del camino recorrido
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : materiasFiltradas.length === 0 ? (
          <div className="rounded-2xl p-8 border text-center" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <Layers size={32} className="mx-auto mb-3" style={{ color: "var(--foreground-subtle)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--foreground-muted)" }}>
              No hay materias cargadas para armar el plan de ruta
            </p>
          </div>
        ) : (
          <>
            {habilitadas.length > 0 && (
              <div className="rounded-2xl p-4 border" style={{ background: "var(--estado-aprobada-bg)", borderColor: "var(--estado-aprobada)" }}>
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: "var(--estado-aprobada)" }}>
                  <Unlock size={14} />
                  Podés cursar ahora ({habilitadas.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {habilitadas.map((n) => (
                    <Link key={n.id} href={`/materias/${n.id}`}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: "var(--color-card)", color: "var(--estado-aprobada)" }}>
                      {n.nombre}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {grupos.map(({ clave, materias: materiasDelAnio }) => (
                <div key={clave} className="rounded-2xl border overflow-hidden" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
                  <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
                    style={{ background: "var(--background-alt)", color: "var(--foreground-muted)" }}>
                    {clave === "sin-anio" ? "Sin año asignado" : `Año ${clave}`}
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--color-card-border)" }}>
                    {materiasDelAnio.map((m) => {
                      const Icono = ESTADO_ICONO[m.estado];
                      const nodo = grafoPorId.get(m.id);
                      const bloqueada = m.estado === "pendiente" && !habilitadasIds.has(m.id) && (nodo?.bloqueada_por.length ?? 0) > 0;
                      const nombresFaltantes = bloqueada
                        ? nodo!.bloqueada_por.map((id) => materiasPorId.get(id)?.nombre ?? id)
                        : [];

                      return (
                        <Link key={m.id} href={`/materias/${m.id}`}
                          className="flex items-start gap-3 p-3.5 transition-all hover:opacity-80"
                          style={{ opacity: m.estado === "aprobada" ? 0.75 : 1 }}>
                          {bloqueada
                            ? <Lock size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--foreground-subtle)" }} />
                            : <Icono size={16} className="mt-0.5 flex-shrink-0" style={{ color: ESTADO_COLOR[m.estado] }} />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                {m.nombre}
                              </p>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--background-alt)", color: ESTADO_COLOR[m.estado] }}>
                                {ESTADO_LABEL[m.estado]}
                              </span>
                            </div>
                            {bloqueada && nombresFaltantes.length > 0 && (
                              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                                Te falta: {nombresFaltantes.join(", ")}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
