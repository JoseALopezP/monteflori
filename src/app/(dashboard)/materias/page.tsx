"use client";

// src/app/(dashboard)/materias/page.tsx
// Vista completa de todas las materias con filtros

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, BookOpen, Import, Layers } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useMaterias } from "@/hooks/useMaterias";
import { useCarreraActivaContext } from "@/components/dashboard/CarreraActivaProvider";
import MateriaCard from "@/components/ui/MateriaCard";
import { updateEvaluacion } from "@/lib/firestore";
import { EstadoMateria } from "@/types";

const FILTROS_ESTADO: { label: string; value: EstadoMateria | "todas" }[] = [
  { label: "Todas", value: "todas" },
  { label: "Cursando", value: "cursando" },
  { label: "Aprobadas", value: "aprobada" },
  { label: "Regulares", value: "regular" },
  { label: "Pendientes", value: "pendiente" },
  { label: "Libres", value: "libre" },
];

export default function MateriasPage() {
  const { user } = useAuthContext();
  const { materias, loading } = useMaterias(user?.uid ?? null);
  const { carreraActivaId } = useCarreraActivaContext();

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoMateria | "todas">("todas");

  const materiasFiltradas = materias.filter((m) => {
    const matchBusqueda = m.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === "todas" || m.estado === filtroEstado;
    const matchCarrera = !carreraActivaId || m.carreras_vinculadas?.includes(carreraActivaId);
    return matchBusqueda && matchEstado && matchCarrera;
  });

  async function handleEditarNota(materiaId: string, evalId: string, nota: number | null) {
    if (!user?.uid) return;
    const materia = materias.find((m) => m.id === materiaId);
    if (!materia) return;
    await updateEvaluacion(user.uid, materiaId, evalId, nota, materia.evaluaciones);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--foreground)" }}>
              Todas las materias
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/materias/pasos"
              className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm border transition-all hover:opacity-80"
              style={{ borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
              <Layers size={16} /> <span className="hidden sm:inline">Plan de ruta</span>
            </Link>
            <Link href="/materias/importar"
              className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm border transition-all hover:opacity-80"
              style={{ borderColor: "var(--color-card-border)", color: "var(--foreground)" }}>
              <Import size={16} /> <span className="hidden sm:inline">Importar de SIU Guaraní</span>
            </Link>
            <Link href="/materias/nueva"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "white" }}>
              <Plus size={16} /> Nueva
            </Link>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-subtle)" }} />
          <input
            id="buscar-materia"
            type="text"
            placeholder="Buscar materia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border"
            style={{
              background: "var(--color-card)",
              borderColor: "var(--color-card-border)",
              color: "var(--foreground)",
              outline: "none",
            }}
          />
        </div>

        {/* Filtros de estado */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroEstado(f.value)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filtroEstado === f.value ? "var(--color-primary)" : "var(--color-card)",
                color: filtroEstado === f.value ? "white" : "var(--foreground-muted)",
                border: `1.5px solid ${filtroEstado === f.value ? "var(--color-primary)" : "var(--color-card-border)"}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : materiasFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto mb-3" style={{ color: "var(--foreground-subtle)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground-muted)" }}>
              {busqueda || filtroEstado !== "todas"
                ? "No se encontraron materias con esos filtros"
                : "No tenés materias cargadas aún"}
            </p>
            {!busqueda && filtroEstado === "todas" && (
              <Link href="/materias/nueva"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm mt-4 transition-all hover:opacity-90"
                style={{ background: "var(--color-primary)", color: "white" }}>
                <Plus size={14} /> Agregar primera materia
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {materiasFiltradas.map((m) => (
              <MateriaCard
                key={m.id}
                materia={m}
                onEditarNota={handleEditarNota}
                onAbrirDetalle={(id) => window.location.href = `/materias/${id}`}
              />
            ))}
            <p className="text-xs text-center pt-2" style={{ color: "var(--foreground-subtle)" }}>
              {materiasFiltradas.length} materia{materiasFiltradas.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
