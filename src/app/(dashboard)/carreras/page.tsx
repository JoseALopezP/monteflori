"use client";

// src/app/(dashboard)/carreras/page.tsx
// Gestión de carreras del usuario

import { useState } from "react";
import Link from "next/link";
import { Plus, GraduationCap, Trash2, Edit, Building } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreras } from "@/hooks/useCarreras";
import { useMaterias } from "@/hooks/useMaterias";
import { addCarrera, deleteCarrera } from "@/lib/firestore";
import { calcularPorcentajeAvance, calcularPromedioGeneral } from "@/lib/calculo-notas";

const COLORES = [
  "#52796f", "#2196a3", "#d4a017", "#8b5cf6",
  "#e07a5f", "#059669", "#dc2626", "#0284c7",
];

function CarrerasContent() {
  const { user } = useAuthContext();
  const { carreras, loading, setCarreraActivaId, refetch } = useCarreras(user?.uid ?? null);
  const { materias } = useMaterias(user?.uid ?? null);

  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [totalMaterias, setTotalMaterias] = useState<number | "">("");
  const [colorSeleccionado, setColorSeleccionado] = useState(COLORES[0]);
  const [guardando, setGuardando] = useState(false);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !user?.uid) return;
    setGuardando(true);
    try {
      await addCarrera(user.uid, {
        nombre: nombre.trim(),
        institucion: institucion.trim(),
        total_materias_plan: totalMaterias !== "" ? Number(totalMaterias) : undefined,
        color: colorSeleccionado,
      });
      setNombre("");
      setInstitucion("");
      setTotalMaterias("");
      setShowForm(false);
      refetch();
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(cid: string) {
    if (!user?.uid) return;
    if (!confirm("¿Seguro que querés eliminar esta carrera? Las materias vinculadas no se eliminarán.")) return;
    await deleteCarrera(user.uid, cid);
    refetch();
  }

  const inputStyle = {
    background: "var(--background-alt)",
    border: "1.5px solid var(--color-card-border)",
    color: "var(--foreground)",
    outline: "none",
    borderRadius: "var(--radius-md)",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--font-size-sm)",
    width: "100%",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm mb-1 block hover:underline"
              style={{ color: "var(--foreground-muted)" }}>← Volver</Link>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--foreground)" }}>
              Mis carreras
            </h1>
          </div>
          <button
            id="btn-nueva-carrera"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: "var(--color-primary)", color: "white" }}>
            <Plus size={16} /> Nueva carrera
          </button>
        </div>

        {/* Formulario inline */}
        {showForm && (
          <div className="rounded-2xl p-5 border mb-5 animate-fade-in"
            style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
            <h2 className="font-bold text-base mb-4" style={{ color: "var(--foreground)" }}>
              Nueva carrera
            </h2>
            <form onSubmit={handleCrear} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Nombre de la carrera *
                </label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
                  placeholder="Ej: Ingeniería en Sistemas" style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Institución
                </label>
                <input value={institucion} onChange={(e) => setInstitucion(e.target.value)}
                  placeholder="Ej: UTN FRC" style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Total materias del plan
                </label>
                <input type="number" value={totalMaterias} onChange={(e) => setTotalMaterias(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Ej: 48" style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Color identificador
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map((c) => (
                    <button key={c} type="button" onClick={() => setColorSeleccionado(c)}
                      className="w-8 h-8 rounded-full border-4 transition-all"
                      style={{
                        background: c,
                        borderColor: colorSeleccionado === c ? "var(--foreground)" : "transparent",
                        transform: colorSeleccionado === c ? "scale(1.15)" : "scale(1)",
                      }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm border hover:opacity-75"
                  style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                  style={{ background: "var(--color-primary)", color: "white" }}>
                  {guardando ? "Guardando..." : "Crear carrera"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de carreras */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : carreras.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <GraduationCap size={48} className="mx-auto mb-4" style={{ color: "var(--foreground-subtle)" }} />
            <p className="font-bold text-lg mb-1" style={{ color: "var(--foreground)" }}>
              No tenés carreras cargadas
            </p>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              Creá tu primera carrera para empezar a organizar tus materias
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {carreras.map((carrera) => {
              const materiasCarrera = materias.filter(m => m.carreras_vinculadas?.includes(carrera.id));
              const porcentaje = calcularPorcentajeAvance(materiasCarrera, carrera.total_materias_plan);
              const promedio = calcularPromedioGeneral(materiasCarrera);

              return (
                <div key={carrera.id}
                  className="rounded-2xl p-5 border transition-all hover:shadow-md"
                  style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)", borderLeft: `4px solid ${carrera.color ?? "var(--color-primary)"}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate" style={{ color: "var(--foreground)" }}>
                        {carrera.nombre}
                      </h3>
                      {carrera.institucion && (
                        <p className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                          <Building size={12} /> {carrera.institucion}
                        </p>
                      )}
                    </div>
                    <button onClick={() => handleEliminar(carrera.id)} className="p-2 rounded-lg hover:opacity-75 transition-opacity flex-shrink-0"
                      style={{ color: "var(--color-alert)" }} aria-label="Eliminar carrera">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      <span>Avance</span>
                      <span className="font-bold">{porcentaje}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-card-border)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${porcentaje}%`, background: carrera.color ?? "var(--color-primary)" }} />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--foreground-muted)" }}>
                    <span><strong style={{ color: "var(--foreground)" }}>{materiasCarrera.filter(m => m.estado === "aprobada").length}</strong> aprobadas</span>
                    <span><strong style={{ color: "var(--foreground)" }}>{materiasCarrera.length}</strong> total</span>
                    {promedio > 0 && <span>Promedio: <strong style={{ color: "var(--foreground)" }}>{promedio.toFixed(2)}</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CarrerasPage() {
  return <AuthGuard><CarrerasContent /></AuthGuard>;
}
