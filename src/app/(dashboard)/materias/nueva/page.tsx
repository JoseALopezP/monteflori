"use client";

// src/app/(dashboard)/materias/nueva/page.tsx
// Formulario para crear una nueva materia

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, AlertCircle } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCarreras } from "@/hooks/useCarreras";
import { useMaterias } from "@/hooks/useMaterias";
import { addMateria } from "@/lib/firestore";
import { gruposPorDefecto } from "@/lib/calculo-notas";
import { Materia } from "@/types";

function NuevaMateriaContent() {
  const { user } = useAuthContext();
  const router = useRouter();
  const { carreras } = useCarreras(user?.uid ?? null);
  const { materias } = useMaterias(user?.uid ?? null);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<Materia["estado"]>("cursando");
  const [periodo, setPeriodo] = useState("");
  const [añoPlan, setAñoPlan] = useState<number | "">("");
  const [cuatrimestre, setCuatrimestre] = useState<number | "">("");
  const [carrerasSeleccionadas, setCarrerasSeleccionadas] = useState<string[]>([]);
  const [correlativas, setCorrelativas] = useState<string[]>([]);
  const [notaAprobar, setNotaAprobar] = useState(4);
  const [notaPromocionar, setNotaPromocionar] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCarrera(id: string) {
    setCarrerasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleCorrelativa(id: string) {
    setCorrelativas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    if (!user?.uid) return;
    setError(null);
    setLoading(true);

    try {
      await addMateria(user.uid, {
        nombre: nombre.trim(),
        codigo_interno: codigo.trim() || undefined,
        estado,
        periodo_cursado: periodo || undefined,
        año_plan: añoPlan !== "" ? Number(añoPlan) : undefined,
        cuatrimestre_plan: cuatrimestre !== "" ? Number(cuatrimestre) : undefined,
        carreras_vinculadas: carrerasSeleccionadas,
        correlativas_requisito: correlativas,
        configuracion_nota: {
          sistema: "grupos_ponderados",
          grupos: gruposPorDefecto(),
          nota_aprobar: notaAprobar,
          nota_promocionar: notaPromocionar,
        },
        evaluaciones: [],
        ultima_actualizacion: new Date().toISOString(),
      });
      router.push("/materias");
    } catch {
      setError("Error al guardar la materia. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
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

        <div className="mb-6">
          <Link href="/materias" className="text-sm mb-1 block hover:underline"
            style={{ color: "var(--foreground-muted)" }}>← Volver a materias</Link>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--foreground)" }}>
            Nueva materia
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5">

            {error && (
              <div className="p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
                style={{ background: "var(--estado-libre-bg)", color: "var(--color-alert)", border: "1px solid var(--color-alert-light)" }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Card: Datos básicos */}
            <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
              <h2 className="font-bold text-base mb-4" style={{ color: "var(--foreground)" }}>Datos básicos</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                    Nombre de la materia *
                  </label>
                  <input id="mat-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                    required placeholder="Ej: Álgebra Lineal" style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Código (opcional)
                    </label>
                    <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ej: MAT-101" style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Estado
                    </label>
                    <select value={estado} onChange={(e) => setEstado(e.target.value as Materia["estado"])}
                      style={inputStyle}>
                      <option value="cursando">Cursando</option>
                      <option value="aprobada">Aprobada</option>
                      <option value="regular">Regular</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="libre">Libre</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Período
                    </label>
                    <input type="text" value={periodo} onChange={(e) => setPeriodo(e.target.value)}
                      placeholder="2024-1C" style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Año plan
                    </label>
                    <input type="number" min={1} max={8} value={añoPlan} onChange={(e) => setAñoPlan(e.target.value ? Number(e.target.value) : "")}
                      placeholder="1" style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Cuatrimestre
                    </label>
                    <select value={cuatrimestre} onChange={(e) => setCuatrimestre(e.target.value ? Number(e.target.value) : "")}
                      style={inputStyle}>
                      <option value="">-</option>
                      <option value="1">1°</option>
                      <option value="2">2°</option>
                      <option value="0">Anual</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Configuración de nota */}
            <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
              <h2 className="font-bold text-base mb-1" style={{ color: "var(--foreground)" }}>Configuración de nota</h2>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                Arranca con parciales 50% + TP 20% + final 30%. Después, desde la materia
                podés armar tu propia fórmula arrastrando y soltando.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Nota para aprobar
                    </label>
                    <input type="number" min={1} max={10} step={0.5} value={notaAprobar}
                      onChange={(e) => setNotaAprobar(Number(e.target.value))}
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Nota para promocionar
                    </label>
                    <input type="number" min={1} max={10} step={0.5} value={notaPromocionar}
                      onChange={(e) => setNotaPromocionar(Number(e.target.value))}
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--color-card-border)")} />
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Carreras vinculadas */}
            {carreras.length > 0 && (
              <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
                <h2 className="font-bold text-base mb-4" style={{ color: "var(--foreground)" }}>Carreras vinculadas</h2>
                <div className="flex flex-wrap gap-2">
                  {carreras.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggleCarrera(c.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
                      style={{
                        background: carrerasSeleccionadas.includes(c.id) ? "var(--color-primary)" : "var(--background-alt)",
                        color: carrerasSeleccionadas.includes(c.id) ? "white" : "var(--foreground-muted)",
                        borderColor: carrerasSeleccionadas.includes(c.id) ? "var(--color-primary)" : "var(--color-card-border)",
                      }}>
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card: Correlativas */}
            {materias.length > 0 && (
              <div className="rounded-2xl p-5 border" style={{ background: "var(--color-card)", borderColor: "var(--color-card-border)" }}>
                <h2 className="font-bold text-base mb-1" style={{ color: "var(--foreground)" }}>Correlativas requisito</h2>
                <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Materias que se deben tener aprobadas para cursar esta
                </p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {materias.map((m) => (
                    <button key={m.id} type="button" onClick={() => toggleCorrelativa(m.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
                      style={{
                        background: correlativas.includes(m.id) ? "var(--color-secondary)" : "var(--background-alt)",
                        color: correlativas.includes(m.id) ? "white" : "var(--foreground-muted)",
                        borderColor: correlativas.includes(m.id) ? "var(--color-secondary)" : "var(--color-card-border)",
                      }}>
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Acciones */}
          <div className="flex gap-3 mt-6">
            <Link href="/materias"
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-center border transition-all hover:opacity-75"
              style={{ borderColor: "var(--color-card-border)", color: "var(--foreground-muted)" }}>
              Cancelar
            </Link>
            <button id="btn-guardar-materia" type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
              style={{ background: "var(--color-primary)", color: "white", boxShadow: "var(--shadow-md)" }}>
              {loading ? "Guardando..." : "Guardar materia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NuevaMateriaPage() {
  return <AuthGuard><NuevaMateriaContent /></AuthGuard>;
}
