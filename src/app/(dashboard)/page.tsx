"use client";

// src/app/(dashboard)/page.tsx
// Dashboard principal de Monteflori

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen, GraduationCap, Award, Calendar,
  Plus, ChevronRight, Layers,
} from "lucide-react";

import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProgresoCarrera } from "@/components/dashboard/ProgresoCarrera";
import { ProximasFechas } from "@/components/dashboard/ProximasFechas";
import MotivacionalBanner from "@/components/ui/MotivacionalBanner";
import MateriaCard from "@/components/ui/MateriaCard";
import { updateEvaluacion } from "@/lib/firestore";
import {
  calcularPromedioGeneral,
  calcularPorcentajeAvance,
} from "@/lib/calculo-notas";

export default function HomePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();

  const { materias, loading: matLoading } = useMaterias(user?.uid ?? null);
  const { carreras, carreraActivaId, carreraActiva, loading: carLoading } = useCarreraActivaContext();

  const materiasFiltradas = carreraActivaId
    ? materias.filter((m) => m.carreras_vinculadas?.includes(carreraActivaId))
    : materias;

  const materiasCursandoFiltradas = materiasFiltradas.filter((m) => m.estado === "cursando");
  const materiasAprobadasFiltradas = materiasFiltradas.filter((m) => m.estado === "aprobada");

  const porcentaje = calcularPorcentajeAvance(
    materiasFiltradas,
    carreraActiva?.total_materias_plan
  );
  const promedio = calcularPromedioGeneral(materiasFiltradas);

  const proximoExamen = materiasFiltradas
    .flatMap((m) => m.fechas_importantes ?? [])
    .filter((f) => f.fecha && new Date(f.fecha) >= new Date())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const handleEditarNota = useCallback(
    async (materiaId: string, evalId: string, nota: number | null) => {
      if (!user?.uid) return;
      const materia = materias.find((m) => m.id === materiaId);
      if (!materia) return;
      await updateEvaluacion(user.uid, materiaId, evalId, nota, materia.evaluaciones);
    },
    [user, materias]
  );

  const loading = authLoading || matLoading || carLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 animate-spin"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
          <p style={{ color: "var(--foreground-muted)", fontSize: "var(--font-size-sm)" }}>
            Cargando tu dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Saludo */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
              Hola, {user?.displayName?.split(" ")[0] ?? "Estudiante"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {carreraActiva
                ? carreraActiva.nombre
                : carreras.length > 0
                ? `Vista global — ${carreras.length} carrera${carreras.length !== 1 ? "s" : ""}`
                : "Organizá tu carrera desde acá"}
            </p>
          </div>

          <Link
            id="btn-nueva-materia"
            href="/materias/nueva"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all hover:opacity-85 active:scale-95"
            style={{ background: "var(--color-primary)", color: "white" }}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nueva materia</span>
          </Link>
        </div>

        {/* Banner motivacional */}
        <MotivacionalBanner
          materias={materiasFiltradas}
          totalMateriasPlan={carreraActiva?.total_materias_plan}
        />

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard
            titulo="Promedio general"
            valor={promedio > 0 ? promedio.toFixed(2) : "—"}
            subtitulo="Materias aprobadas"
            icono={<Award size={18} />}
            color="var(--color-accent)"
          />
          <StatsCard
            titulo="Avance carrera"
            valor={`${porcentaje}%`}
            subtitulo={`${materiasAprobadasFiltradas.length} aprobadas`}
            icono={<GraduationCap size={18} />}
            color="var(--color-primary)"
          />
          <StatsCard
            titulo="Cursando ahora"
            valor={materiasCursandoFiltradas.length}
            subtitulo="Este período"
            icono={<BookOpen size={18} />}
            color="var(--color-secondary)"
          />
          <StatsCard
            titulo="Próximo examen"
            valor={proximoExamen
              ? new Date(proximoExamen.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
              : "—"
            }
            subtitulo={proximoExamen?.nombre ?? "Sin fechas cargadas"}
            icono={<Calendar size={18} />}
            color="var(--color-alert)"
          />
        </div>

        {/* ── Progreso + Fechas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProgresoCarrera
            materias={materiasFiltradas}
            carrera={carreraActiva}
          />
          <ProximasFechas materias={materiasFiltradas} dias={30} />
        </div>

        {/* ── Materias cursando ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="font-semibold text-base flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <Layers size={16} style={{ color: "var(--foreground-muted)" }} />
              Materias activas
              {materiasCursandoFiltradas.length > 0 && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--estado-cursando-bg)",
                    color: "var(--estado-cursando)",
                  }}
                >
                  {materiasCursandoFiltradas.length}
                </span>
              )}
            </h2>
            <Link
              href="/materias"
              className="text-sm font-medium flex items-center gap-1 hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              Ver todas <ChevronRight size={13} />
            </Link>
          </div>

          {materiasCursandoFiltradas.length === 0 ? (
            <div
              className="rounded-2xl border-2 border-dashed p-8 text-center"
              style={{ borderColor: "var(--color-card-border)" }}
            >
              <BookOpen size={32} className="mx-auto mb-3" style={{ color: "var(--foreground-subtle)" }} />
              <p className="font-semibold text-sm" style={{ color: "var(--foreground-muted)" }}>
                No tenés materias activas
              </p>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--foreground-subtle)" }}>
                Agregá las materias que estás cursando este período
              </p>
              <Link
                href="/materias/nueva"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: "var(--color-primary)", color: "white" }}
              >
                <Plus size={14} /> Agregar materia
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {materiasCursandoFiltradas.map((materia) => (
                <MateriaCard
                  key={materia.id}
                  materia={materia}
                  onEditarNota={handleEditarNota}
                  onAbrirDetalle={(id) => router.push(`/materias/${id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Link a carreras si no hay ninguna ── */}
        {carreras.length === 0 && materias.length === 0 && (
          <section
            className="rounded-xl p-8 border text-center"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-card-border)",
            }}
          >
            <GraduationCap size={36} className="mx-auto mb-4" style={{ color: "var(--color-primary)" }} />
            <h3 className="font-semibold text-lg mb-1" style={{ color: "var(--foreground)" }}>
              Configurá tu carrera
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--foreground-muted)" }}>
              Empezá creando tu carrera y agregando tus materias para ver el seguimiento completo.
            </p>
            <Link
              id="btn-crear-carrera"
              href="/carreras"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-85"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              <GraduationCap size={15} /> Crear mi primera carrera
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
