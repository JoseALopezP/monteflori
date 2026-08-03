"use client";

// src/app/(dashboard)/materias/correlativas/page.tsx
// Vista del grafo de correlativas: qué materias están habilitadas para cursar
// y cuáles siguen bloqueadas por correlativas pendientes.

import Link from "next/link";
import { ChevronLeft, Layers, Lock, Unlock } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreras } from "@/hooks/useCarreras";
import { GrafoCorrelativas } from "@/components/grafo/GrafoCorrelativas";
import { buildGrafo, getMateriasHabilitadas } from "@/lib/grafo-correlativas";

function CorrelativasContent() {
  const { user } = useAuthContext();
  const { materias, loading } = useMaterias(user?.uid ?? null);
  const { carreras, carreraActivaId, setCarreraActivaId } = useCarreras(user?.uid ?? null);

  const materiasFiltradas = carreraActivaId
    ? materias.filter((m) => m.carreras_vinculadas?.includes(carreraActivaId))
    : materias;

  const grafo = buildGrafo(materiasFiltradas);
  const habilitadas = getMateriasHabilitadas(grafo);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        <div>
          <Link href="/materias" className="text-sm mb-1 flex items-center gap-1 hover:underline"
            style={{ color: "var(--foreground-muted)" }}>
            <ChevronLeft size={14} /> Materias
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Layers size={22} style={{ color: "var(--color-primary)" }} />
              Correlativas
            </h1>
            {carreras.length > 0 && (
              <select
                value={carreraActivaId ?? ""}
                onChange={(e) => setCarreraActivaId(e.target.value || null)}
                className="px-3 py-1.5 rounded-xl text-sm border"
                style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)", color: "var(--foreground)" }}
              >
                <option value="">Todas las carreras</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Verde sólido = habilitada para cursar. Punteado y opaco = todavía te falta alguna correlativa.
          </p>
        </div>

        {!loading && habilitadas.length > 0 && (
          <div className="rounded-2xl p-4 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: "var(--foreground)" }}>
              <Unlock size={14} style={{ color: "var(--color-success)" }} />
              Podés cursar ahora ({habilitadas.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {habilitadas.map((n) => (
                <span key={n.id} className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--estado-aprobada-bg)", color: "var(--estado-aprobada)" }}>
                  {n.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="skeleton h-96 rounded-2xl" />
        ) : (
          <GrafoCorrelativas materias={materiasFiltradas} />
        )}

        {!loading && materiasFiltradas.some((m) => !m.correlativas_requisito?.length) && (
          <div className="rounded-2xl p-4 border flex items-start gap-2 text-sm"
            style={{ background: "var(--background-alt)", borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
            <Lock size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--foreground-subtle)" }} />
            Si una materia no tiene correlativas cargadas, el grafo la muestra siempre habilitada. Cargalas
            desde el detalle de cada materia o importándolas desde SIU Guaraní.
          </div>
        )}
      </div>
    </div>
  );
}

export default function CorrelativasPage() {
  return <AuthGuard><CorrelativasContent /></AuthGuard>;
}
